import { logger } from '@/lib/logger';
/**
 * API Client - Centralized HTTP Client with Auth Interceptor
 * 
 * This client fixes "Broken Chain" by automatically attaching
 * Authorization headers to all requests.
 * 
 * Usage:
 *   import { apiClient } from '@/lib/api/api-client';
 *   
 *   // GET request:
 *   const data = await apiClient.get<any>('/api/users/me');
 *   
 *   // POST request:
 *   const result = await apiClient.post<any>('/api/applications', { name: 'test' });
 */

import { AuthService } from '../services/auth-service';
import {
    HEALTH_LOGIN_ROUTE,
    PROVIDER_LOGIN_ROUTE,
    isLoginRoute,
} from '../constants/auth-routes';
import {
    ENTITY_PERMISSION_DENIED_CODE,
    ENTITY_PERMISSION_DENIED_FALLBACK_TH,
    entityPermissionDenialMessage,
    isEntityPermissionDenialBody,
} from './entity-permission-denial';

// Response types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    /**
     * Raw backend error identifier captured BEFORE `toUserFriendlyError`
     * rewriting. Use this to branch on machine-readable codes (e.g.
     * 'PENDING_INVOICES_IN_PERIOD', 'ALREADY_CLOSED') without relying on
     * the human-friendly Thai message in `.error`.
     *
     * Additive — undefined on success and on non-error envelopes.
     * See Iter R1 review H-3 / R5-C for rationale.
     */
    code?: string;
    /**
     * Sibling fields from the backend error envelope that are not
     * `success`/`data`/`error`/`message`/`code`. Lets UIs surface
     * structured metadata such as `openInvoices`, `warnings`,
     * `periodCloseId`, `originalCloser` without backend changes.
     *
     * Additive — undefined on success and when the backend returns
     * no extra metadata.
     */
    meta?: Record<string, unknown>;
    /**
     * HTTP status code of the response (set on error responses). Lets callers
     * branch on HTTP semantics — e.g. the login flow distinguishes
     * a 401 credential rejection (do NOT retry legacy) from a 404/5xx infra
     * failure (fall back to the legacy login path). Additive — undefined on
     * success and on network/timeout errors (no HTTP response).
     */
    status?: number;
}

/**
 * Keys reserved by the envelope itself — every OTHER top-level field
 * the backend ships in a non-2xx body is harvested into `.meta` so
 * callers can read structured metadata without backend changes.
 *
 * Module-level constant (not per-request alloc) — used by the
 * envelope-meta harvester in `request()`.
 */
const ENVELOPE_RESERVED_KEYS = new Set(['success', 'data', 'error', 'message', 'code']);

// Wave C / design-cleanup-2026-08-21 B1 trap — MUST match the localStorage
// key api-client's header-injection reads (below) and
// ActiveEntityProvider's STORAGE_KEY (active-entity-provider.tsx). Kept as
// a literal here (not imported from that 'use client' provider module) to
// avoid pulling a React context module into this plain HTTP client.
const ACTIVE_ENTITY_STORAGE_KEY = 'gacp.activeEntityId';
const ACTIVE_ENTITY_MISMATCH_CODE = 'ACTIVE_ENTITY_MISMATCH';

/**
 * Detect apps/backend/middleware/active-entity-middleware.js's 403 body
 * (`{ success:false, error:'Forbidden', message:'...', code:'ACTIVE_ENTITY_MISMATCH' }`).
 * Before B1 fixed the proxy to forward `x-active-entity-id`, this header
 * never reached the backend, so this path was unreachable in practice. Now
 * that it does, a STALE id left in localStorage (a revoked membership, a
 * switch to a different account on the same browser, etc.) surfaces here
 * instead of silently defaulting — the raw `error:'Forbidden'` would
 * otherwise win the `rawCode = data.error || data.code` harvest below and
 * hide the real code, so this must be checked on the RAW body first.
 */
function isActiveEntityMismatchBody(data: Record<string, unknown> | null): boolean {
    return Boolean(data) && (data as Record<string, unknown>).code === ACTIVE_ENTITY_MISMATCH_CODE;
}

function clearStaleActiveEntitySelection(): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage?.removeItem(ACTIVE_ENTITY_STORAGE_KEY);
    } catch {
        // localStorage unavailable — nothing to clear.
    }
}

function extractEnvelopeMeta(data: Record<string, unknown> | null): Record<string, unknown> | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const meta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
        if (ENVELOPE_RESERVED_KEYS.has(k)) continue;
        meta[k] = v;
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
}

// Request options
interface RequestOptions extends Omit<RequestInit, 'body'> {
    body?: unknown;
    // When true, this request deliberately carries no credential. It therefore
    // implies suppressAuthRedirect — see the default below.
    skipAuth?: boolean;
    timeout?: number;
    // When true, a 401 on this request does NOT clear the session or redirect
    // to login — the error is returned to the caller instead. Use for optional /
    // cross-portal enrichment calls (e.g. a HEALTH page reading a provider-only
    // endpoint): a 401 there means "not authorized for THIS resource", not that
    // the user's session expired, so it must not log the whole session out.
    //
    // Defaults to `skipAuth`: a request that sent no token cannot have had a
    // session expire on it. Pass `false` explicitly to opt back in.
    suppressAuthRedirect?: boolean;
}

class ApiClient {
    private baseUrl: string;
    private defaultTimeout: number;

    constructor(baseUrl = '', timeout = 30000) {
        this.baseUrl = baseUrl;
        this.defaultTimeout = timeout;
    }
    private toUserFriendlyError(error: string | undefined, statusCode?: number): string {
        const raw = String(error || '').trim();
        const normalized = raw.toLowerCase();

        if (!raw) {
            return statusCode
                ? `ไม่สามารถดำเนินการได้ (HTTP ${statusCode})`
                : 'ไม่สามารถดำเนินการได้';
        }

        // ── Auth-related errors → Thai ─────────────────────────────────
        if (normalized.includes('invalid credentials') || normalized.includes('invalid password')) {
            return 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง';
        }
        if (normalized.includes('account not found') || normalized.includes('user not found')) {
            return 'ไม่พบบัญชีผู้ใช้ กรุณาตรวจสอบเลขบัตรประชาชน';
        }
        if (normalized.includes('account locked') || normalized.includes('account disabled')) {
            return 'บัญชีถูกระงับชั่วคราว กรุณาติดต่อเจ้าหน้าที่';
        }
        if (normalized.includes('too many') || normalized.includes('rate limit')) {
            return 'คุณลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
        }
        if (normalized.includes('session expired') || normalized.includes('token expired')) {
            return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
        }
        if (normalized.includes('login failed')) {
            return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง';
        }
        // 403 / authorization → Thai (backend returns a bare 'Forbidden' that used
        // to leak through verbatim under a Thai heading — the most common 403 shape).
        if (statusCode === 403 || normalized === 'forbidden' || normalized.includes('access denied')) {
            return 'คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาเข้าสู่ระบบใหม่หรือติดต่อเจ้าหน้าที่';
        }

        // ── Payment-related errors → Thai ──────────────────────────────
        if (
            normalized.includes('invoice already paid')
            || normalized.includes('phase 1 already paid')
            || normalized.includes('phase 2 already paid')
        ) {
            return 'รายการนี้ชำระเงินแล้ว';
        }

        if (normalized.includes('receipt already issued')) {
            return 'ใบเสร็จรับเงินออกแล้ว';
        }

        // ── System errors → Thai ───────────────────────────────────────
        // W1-COPY: only the backend's explicit "still booting" signal may
        // claim the system is starting. A generic 'service unavailable'
        // (e.g. the Next proxy's 503 BACKEND_UNREACHABLE envelope when the
        // backend is down) is NOT a startup — telling farmers "ระบบกำลัง
        // เริ่มต้น" was a half-truth implying waiting alone will fix it.
        if (normalized.includes('database connection is initializing')) {
            return 'ระบบกำลังเริ่มต้น กรุณารอสักครู่แล้วลองใหม่';
        }
        if (normalized.includes('service unavailable')) {
            return 'ยังเชื่อมต่อระบบไม่ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
        }

        if (normalized.includes('invalid webhook signature')) {
            return 'การตรวจสอบการชำระเงินล้มเหลว กรุณาลองอีกครั้ง';
        }

        if (normalized.includes('unable to connect') || normalized.includes('network error') || normalized.includes('fetch failed')) {
            return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
        }

        // Final safety: detect stack traces, file paths, or internal errors
        // and replace with generic message to prevent leaking developer details
        const looksLikeInternalError =
            /at\s+\w+\s*\(/i.test(raw) ||         // stack trace: "at Function ("
            /\.(js|ts|mjs):\d+/i.test(raw) ||      // file:line patterns
            /node_modules\//i.test(raw) ||          // node_modules paths
            /\/app\//i.test(raw) ||                 // Docker app paths
            /Error:\s/i.test(raw) ||                // "Error: something" patterns
            raw.length > 300;                       // suspiciously long messages

        if (looksLikeInternalError) {
            return statusCode
                ? `เกิดข้อผิดพลาดภายในระบบ (HTTP ${statusCode})`
                : 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้ง';
        }

        return raw;
    }


    private getCsrfToken(): string | null {
        if (typeof document === 'undefined') return null;
        const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
        const csrfValue = match?.[1];
        if (csrfValue) return decodeURIComponent(csrfValue);
        // Double-submit CSRF: the backend (csrf-middleware) only checks that the
        // `csrf_token` cookie === the `x-csrf-token` header — the value itself is
        // not secret; the protection is that a cross-site attacker can neither
        // read nor set this same-origin, non-HttpOnly cookie. The cookie is only
        // seeded on some flows, so if it's missing we MINT one here (the
        // documented "client mints a random csrf_token" pattern) — otherwise
        // every mutation in an un-seeded session 403s with CSRF_MISMATCH
        // (e.g. the provider form-fields edit, 2026-06-25).
        try {
            const minted = (typeof globalThis.crypto?.randomUUID === 'function')
                ? globalThis.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            document.cookie = `csrf_token=${minted}; path=/; SameSite=Lax`;
            return minted;
        } catch {
            return null;
        }
    }

    /**
     * Make HTTP request with automatic auth header injection
     */
    private async request<T>(
        endpoint: string,
        options: RequestOptions = {}
    ): Promise<ApiResponse<T>> {
        // A request that deliberately sends no credential will 401 whenever the door
        // needs one, and that 401 means "this door needs a key" — never "your key
        // expired". Defaulting the redirect suppression to skipAuth closes the class at
        // the source: measured 2026-09-07, a signed-in farmer who pressed a button on the
        // PUBLIC /verify page was logged out of the platform, because the portal's
        // skipAuth calls hit partner-key-gated routes and the 401 fell into the
        // session-expired branch below. Fixing it per-call-site would leave the next
        // caller who forgets to write both flags with the same bug.
        const { skipAuth = false, suppressAuthRedirect = skipAuth, timeout = this.defaultTimeout, body, ...init } = options;
        const method = (init.method || 'GET').toUpperCase();

        // Build headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(init.headers as Record<string, string>),
        };

        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            const csrfToken = this.getCsrfToken();
            if (csrfToken) {
                headers['x-csrf-token'] = csrfToken;
            }
        }

        // Fallback: Only attach Authorization header if no httpOnly cookie available
        // Primary auth is via httpOnly cookie (credentials: 'include')
        // This fallback is for mobile apps that don't use cookies
        if (!skipAuth) {
            const token = AuthService.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        // Wave C — workspace switcher. Send the user's currently-active
        // entity (workspace) so the backend's active-entity middleware
        // can scope the request. localStorage is the canonical source —
        // ActiveEntityProvider keeps it in sync. Never overrides a header
        // explicitly set by the caller.
        if (!skipAuth && typeof window !== 'undefined' && !headers['x-active-entity-id']) {
            try {
                const activeEntityId = window.localStorage?.getItem('gacp.activeEntityId');
                if (activeEntityId) {
                    headers['x-active-entity-id'] = activeEntityId;
                }
            } catch {
                // localStorage unavailable (private browsing, SSR) — skip silently.
            }
        }

        // Smart Path Handling: Auto-prefix with /api if needed
        let fullEndpoint = endpoint;
        if (!endpoint.startsWith('http')) {
            if (!endpoint.startsWith('/api')) {
                // Prefix with /api for all paths
                fullEndpoint = `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
            }
        }

        // Build full URL
        const url = fullEndpoint.startsWith('http') ? fullEndpoint : `${this.baseUrl}${fullEndpoint}`;

        // Setup abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Handle FormData (remove Content-Type to let browser set boundary)
        if (body instanceof FormData) {
            delete headers['Content-Type'];
        }

        try {
            const response = await fetch(url, {
                ...init,
                headers,
                ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
                signal: controller.signal,
                credentials: 'include', // Send httpOnly cookies automatically
            });

            clearTimeout(timeoutId);

            // Handle 401 Unauthorized
            if (response.status === 401) {
                // Login/register endpoints: 401 means "invalid credentials", not "session expired"
                const isAuthEndpoint = url.includes('/auth/') && (
                    url.includes('/login') || url.includes('/register') || url.includes('/check-identifier')
                );

                if (isAuthEndpoint) {
                    let errorData: Record<string, unknown> | null = null;
                    const authContentType = response.headers.get('content-type') || '';
                    if (authContentType.includes('application/json')) {
                        try { errorData = await response.json(); } catch { errorData = null; }
                    }
                    const backendMsg = String(
                        errorData?.messageTh || errorData?.message || errorData?.error || '',
                    ).trim();
                    // Preserve the raw backend code BEFORE the friendly-error rewrite
                    // so callers can still branch on machine-readable identifiers.
                    const rawCode = String(
                        errorData?.code || errorData?.error || '',
                    ).trim() || undefined;
                    const meta = extractEnvelopeMeta(errorData);
                    return {
                        success: false,
                        error: this.toUserFriendlyError(backendMsg || 'Invalid credentials', 401),
                        ...(rawCode !== undefined ? { code: rawCode } : {}),
                        ...(meta !== undefined ? { meta } : {}),
                    };
                }

                // Optional / cross-portal enrichment call: a 401 here means
                // "not authorized for THIS resource", NOT that the session died.
                // Return the error WITHOUT clearing the session or redirecting —
                // otherwise one authz-mismatched sub-request (e.g. a HEALTH user
                // hitting a provider-only endpoint like /finance/credit-notes)
                // would log the whole valid session out and bounce the user to
                // login. (fix/auth-401-no-blanket-logout)
                if (suppressAuthRedirect) {
                    let optErr: Record<string, unknown> | null = null;
                    const ct = response.headers.get('content-type') || '';
                    if (ct.includes('application/json')) {
                        try { optErr = await response.json(); } catch { optErr = null; }
                    }
                    return {
                        success: false,
                        error: String(optErr?.message || optErr?.error || 'Unauthorized for this resource'),
                        ...(optErr?.code ? { code: String(optErr.code) } : {}),
                    };
                }

                // Non-auth endpoints: treat as session expired
                logger.warn('[ApiClient] 401 Received - Session expired');
                AuthService.clearSession();

                // Redirect to appropriate login if in browser (but not if already on login page)
                if (typeof window !== 'undefined') {
                    const currentPath = window.location.pathname;
                    const isAlreadyOnLogin = isLoginRoute(currentPath);

                    if (!isAlreadyOnLogin) {
                        const isProviderRoute = currentPath.startsWith('/provider');
                        const loginUrl = isProviderRoute
                            ? `${PROVIDER_LOGIN_ROUTE}?expired=true`
                            : `${HEALTH_LOGIN_ROUTE}?expired=true`;
                        window.location.href = loginUrl;
                    }
                }

                return {
                    success: false,
                    error: 'Session expired. Please sign in again',
                };
            }

            // Parse JSON response when possible
            let data: Record<string, unknown> | null = null;
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch {
                    data = null;
                }
            } else {
                // Drain body to avoid unread stream warnings
                try {
                    await response.text();
                } catch {
                    // Ignore body parse errors
                }
            }

            // Handle API error responses
            if (!response.ok) {
                // Wave-C F2 — workspace per-permission denials (403
                // ENTITY_PERMISSION_DENIED, both `error`- and `message`-
                // carried Thai shapes) ship their own CORRECT copy from the
                // route. Pass it through instead of the blanket 403 rewrite
                // below, which wrongly told permission-denied workers to
                // re-login (their session is fine — they lack a farm
                // permission). `.code` is NORMALIZED here because the raw
                // harvest (data.error || data.code) would capture the Thai
                // message for the `error`-carried shape.
                // Wave C / design-cleanup-2026-08-21 B1 trap — checked BEFORE
                // the generic 403 rewrite AND before the entity-permission
                // branch (different code, different cause: this is a stale
                // workspace SELECTION, not a missing permission inside a
                // valid one). Recover by clearing the bad selection so the
                // NEXT request falls back to the user's default entity, and
                // tell the user honestly instead of the blanket "re-login"
                // copy below (their session is fine).
                if (response.status === 403 && isActiveEntityMismatchBody(data)) {
                    clearStaleActiveEntitySelection();
                    return {
                        success: false,
                        error: 'พื้นที่ทำงานที่เลือกไว้ใช้งานไม่ได้แล้ว ระบบสลับกลับไปที่ค่าเริ่มต้นให้อัตโนมัติ กรุณาลองใหม่อีกครั้ง',
                        status: 403,
                        code: ACTIVE_ENTITY_MISMATCH_CODE,
                    };
                }
                if (response.status === 403 && isEntityPermissionDenialBody(data)) {
                    const denialMeta = extractEnvelopeMeta(data);
                    return {
                        success: false,
                        error: entityPermissionDenialMessage(data)
                            || ENTITY_PERMISSION_DENIED_FALLBACK_TH,
                        status: 403,
                        code: ENTITY_PERMISSION_DENIED_CODE,
                        ...(denialMeta !== undefined ? { meta: denialMeta } : {}),
                    };
                }
                const backendError = String(data?.error || data?.message || '');
                // Capture the raw backend identifier BEFORE friendly-error
                // rewriting so callers can branch on the machine-readable
                // code (e.g. 'PENDING_INVOICES_IN_PERIOD') instead of the
                // Thai-friendly display string.
                const rawCode = String(data?.error || data?.code || '').trim() || undefined;
                const meta = extractEnvelopeMeta(data);
                return {
                    success: false,
                    error: this.toUserFriendlyError(backendError, response.status),
                    status: response.status,
                    ...(rawCode !== undefined ? { code: rawCode } : {}),
                    ...(meta !== undefined ? { meta } : {}),
                };
            }

            if (!data) {
                return {
                    success: false,
                    error: 'Invalid server response',
                };
            }

            // Gap 24 — harvest sibling fields (counts / total / pagination /
            // summary / meta …) that sit ALONGSIDE `data` onto `.meta`,
            // MIRRORING the error branch above. Previously the success strip
            // returned only the unwrapped `data`, silently dropping siblings —
            // a Scheduler/Admin list reading `res.meta.counts` on a 2xx got
            // `undefined` and blanked. `res.data` is UNCHANGED (existing
            // consumers rely on the unwrapped `body.data ?? body`); we only ADD
            // `.meta`. `extractEnvelopeMeta` strips the reserved envelope keys
            // (success/data/error/message/code), so the standard
            // `{success, data, …siblings}` shape yields exactly the siblings,
            // and a sibling-less envelope yields `undefined` (no `.meta`).
            const meta = extractEnvelopeMeta(data);
            return {
                success: true,
                data: ((data as Record<string, unknown>)?.data ?? data) as T,
                ...(meta !== undefined ? { meta } : {}),
            };
        } catch (error: unknown) {
            clearTimeout(timeoutId);

            // Handle abort/timeout
            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Request timeout. Please try again',
                };
            }

            // Handle network errors
            logger.error('[ApiClient] Request failed:', error);
            return {
                success: false,
                error: 'Unable to connect to server',
            };
        }
    }

    /**
     * GET request
     */
    async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    /**
     * POST request
     */
    async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'POST', body });
    }

    /**
     * PUT request
     */
    async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'PUT', body });
    }

    /**
     * PATCH request
     */
    async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
    }

    /**
     * DELETE request
     */
    async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * GET Blob request (for file downloads)
     */
    async getBlob(endpoint: string, options?: RequestOptions): Promise<Blob | null> {
        const { skipAuth = false, ...init } = options || {};

        const headers: Record<string, string> = {
            ...(init.headers as Record<string, string>),
        };

        if (!skipAuth) {
            const token = AuthService.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        // Wave C — same active-entity propagation as JSON requests.
        if (!skipAuth && typeof window !== 'undefined' && !headers['x-active-entity-id']) {
            try {
                const activeEntityId = window.localStorage?.getItem('gacp.activeEntityId');
                if (activeEntityId) {
                    headers['x-active-entity-id'] = activeEntityId;
                }
            } catch {
                // localStorage unavailable — skip silently.
            }
        }

        let fullEndpoint = endpoint;
        if (!endpoint.startsWith('http')) {
            if (!endpoint.startsWith('/api')) {
                fullEndpoint = `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
            }
        }
        const url = fullEndpoint.startsWith('http') ? fullEndpoint : `${this.baseUrl}${fullEndpoint}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers,
                credentials: 'include',
            });

            if (!response.ok) return null;
            return await response.blob();
        } catch {
            return null;
        }
    }

    /**
     * Health check - for backwards compatibility
     */
    async health(): Promise<boolean> {
        try {
            const response = await this.get('/api/health', { skipAuth: true, timeout: 5000 });
            return response.success;
        } catch {
            return false;
        }
    }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing or custom instances
export { ApiClient };
export const api = apiClient;
