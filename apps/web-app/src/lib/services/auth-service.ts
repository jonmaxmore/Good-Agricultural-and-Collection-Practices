import { logger } from '@/lib/logger';
import {
    checkIdentifierWithAuthApi,
    loginWithAuthApi,
    registerWithAuthApi,
    type LoginCredentials,
    updateProfileWithAuthApi,
} from './auth-service-api';
import {
    decodeJwtToken,
    getJwtExpiry,
    getMsUntilJwtExpiry,
    isJwtExpired,
} from './auth-service-jwt';
import {
    clearLastActivity,
    clearRememberMe,
    clearStoredAuthSession,
    getRememberMe,
    getStoredAccessToken,
    getStoredUser,
    isProviderUser,
    saveRememberMe as saveRememberMeToStorage,
    setStoredAccessToken,
    setStoredUser,
    resolveSessionCookieKey,
    clearActiveEntityId,
} from './auth-service-session';
import {
    setupCrossTabSync,
    setupActivityTracking,
    updateLastActivity as activityUpdate,
    isSessionTimedOut as activityTimedOut,
    type ActivityHandles,
} from './auth-service-activity';
import {
    DEFAULT_CONFIG,
    type AuthConfig,
    type AuthEventCallback,
    type AuthEventType,
    type AuthUser,
    type JWTPayload,
    type SessionData,
} from './auth-service.types';

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

/**
 * Read the `csrf_token` value out of a document.cookie string.
 * Returns null when the cookie is absent. URL-decoded so the value matches the
 * raw cookie the backend's double-submit check compares against.
 */
export function readCsrfCookie(cookieString: string | null | undefined): string | null {
    if (!cookieString) return null;
    const match = cookieString.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    const value = match?.[1];
    return value ? decodeURIComponent(value) : null;
}

/**
 * Build the CSRF header map for a mutating request (e.g. logout), given a
 * document.cookie string. The backend csrf-middleware requires the double-submit
 * pair (cookie csrf_token === header x-csrf-token); without it logout 403s and
 * the server never revokes the session/JTI. Pure + side-effect-free for testing.
 */
export function buildLogoutHeaders(cookieString: string | null | undefined): Record<string, string> {
    const token = readCsrfCookie(cookieString);
    return token ? { 'x-csrf-token': token } : {};
}

/**
 * setTimeout treats delays above 2^31-1 ms (~24.8 days) as a 32-bit overflow
 * and fires the callback IMMEDIATELY. A long-lived token (e.g. the dev/E2E
 * fixture with exp years away) therefore triggered an instant refresh on
 * every page load — and with the backend down, that failed refresh wiped the
 * session (W1-CORE king bug). All refresh scheduling must clamp to this.
 */
export const MAX_TIMEOUT_DELAY_MS = 2_147_483_647;

/** Pure: ms until the refresh should fire — expiry minus buffer, clamped to [0, MAX_TIMEOUT_DELAY_MS]. */
export function computeRefreshDelayMs(msUntilExpiry: number, bufferMs: number): number {
    return Math.min(Math.max(0, msUntilExpiry - bufferMs), MAX_TIMEOUT_DELAY_MS);
}

/** Bounded backoff for INDETERMINATE refresh failures (network/5xx/timeout). */
export const REFRESH_RETRY_BASE_DELAY_MS = 30_000;
export const REFRESH_RETRY_MAX_DELAY_MS = 5 * 60_000;
export const REFRESH_RETRY_MAX_ATTEMPTS = 5;

/**
 * Pure: delay before retry number `attempt` (0-based), or null once the retry
 * budget is exhausted. Exhaustion does NOT log the user out — the current
 * token stays; a genuine 401 on a real API call is what ends a dead session.
 */
export function computeRefreshRetryDelayMs(attempt: number): number | null {
    if (attempt >= REFRESH_RETRY_MAX_ATTEMPTS) return null;
    return Math.min(REFRESH_RETRY_BASE_DELAY_MS * 2 ** attempt, REFRESH_RETRY_MAX_DELAY_MS);
}

class AuthServiceClass {
    private config: AuthConfig;
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;
    private activityHandles: ActivityHandles = { activityTimer: null };
    private eventListeners: AuthEventCallback[] = [];
    private initialized = false;
    /** Consecutive INDETERMINATE refresh failures — resets on success/new session. */
    private refreshRetryCount = 0;

    // Incremented whenever the session identity changes (save/clear). An
    // in-flight refreshToken() snapshots this on entry and discards its
    // outcome if the session changed underneath it — a stale settle must
    // never clear a NEW session, emit session_expired after logout, or
    // resurrect a retry timer on a dead session.
    private sessionEpoch = 0;

    // True while a one-shot focus/visibility re-arm listener is registered
    // after the refresh retry budget is exhausted (long outage). The next
    // time the user returns to the tab we try one fresh refresh instead of
    // leaving them to be logged out by the next 401.
    private exhaustionRearmArmed = false;

    private readonly exhaustionRearmHandler = (): void => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        this.disarmExhaustionRearm();
        if (!this.getToken()) return;
        this.refreshRetryCount = 0;
        void this.refreshToken();
    };

    private disarmExhaustionRearm(): void {
        if (!this.exhaustionRearmArmed || !this.isBrowser()) return;
        this.exhaustionRearmArmed = false;
        window.removeEventListener('focus', this.exhaustionRearmHandler);
        document.removeEventListener('visibilitychange', this.exhaustionRearmHandler);
    }

    constructor(config: Partial<AuthConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    private normalizeUser(user?: AuthUser | null): AuthUser | null {
        if (!user || typeof user !== 'object') {
            return null;
        }

        const normalizedPhone = typeof user.phone === 'string' && user.phone.trim()
            ? user.phone
            : (typeof user.phoneNumber === 'string' ? user.phoneNumber : undefined);

        if (!normalizedPhone) {
            return user;
        }

        return {
            ...user,
            phone: normalizedPhone,
            phoneNumber: normalizedPhone,
        };
    }

    async login(credentials: LoginCredentials): Promise<{ success: boolean; error?: string | undefined; mfaRequired?: boolean | undefined; mfaSession?: string | undefined }> {
        return loginWithAuthApi(credentials, (data) => this.saveSession(data));
    }

    async register(data: unknown): Promise<{ success: boolean; error?: string | undefined; data?: unknown }> {
        return registerWithAuthApi(data);
    }

    async checkIdentifier(identifier: string): Promise<{ available: boolean; error?: string | undefined }> {
        return checkIdentifierWithAuthApi(identifier);
    }

    async updateProfile(data: Partial<AuthUser>): Promise<{ success: boolean; error?: string; data?: AuthUser }> {
        return updateProfileWithAuthApi(data, {
            normalizeUser: (user) => this.normalizeUser(user),
            getUser: () => this.getUser(),
            updateUser: (user) => this.updateUser(user),
            emitLogin: (user) => this.emit('login', { user }),
        });
    }

    initialize(): void {
        if (this.initialized || !this.isBrowser()) return;

        this.initialized = true;

        if (this.config.enableCrossTabSync) {
            setupCrossTabSync(this);
        }

        if (this.config.enableSessionTimeout) {
            setupActivityTracking(this, this.activityHandles, this.config.sessionTimeoutMinutes);
        }

        if (this.isAuthenticated()) {
            this.scheduleTokenRefresh();
        }

        if (isDev) {
            logger.info('[AuthService] Initialized with config:', {
                sessionTimeout: this.config.sessionTimeoutMinutes,
                crossTabSync: this.config.enableCrossTabSync,
            });
        }
    }

    isBrowser(): boolean {
        return typeof window !== 'undefined';
    }

    emit(event: AuthEventType, data?: unknown): void {
        this.eventListeners.forEach(cb => cb(event, data));
        this.config.onAuthEvent?.(event, data);
    }

    onAuthChange(callback: AuthEventCallback): () => void {
        this.eventListeners.push(callback);
        return () => {
            this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
        };
    }

    decodeToken(token?: string): JWTPayload | null {
        return decodeJwtToken(token || this.getToken());
    }

    getTokenExpiry(): number | null {
        return getJwtExpiry(this.getToken());
    }

    isTokenExpired(): boolean {
        return isJwtExpired(this.getToken());
    }

    getTimeUntilExpiry(): number {
        return getMsUntilJwtExpiry(this.getToken());
    }

    async saveSession(data: SessionData): Promise<void> {
        if (!this.isBrowser()) return;

        // New session identity: invalidate any in-flight refresh settle from
        // the previous session and reset the retry/re-arm machinery.
        this.sessionEpoch += 1;
        this.refreshRetryCount = 0;
        this.disarmExhaustionRearm();

        const accessToken = data.tokens?.accessToken || data.accessToken || data.token;
        const refreshToken = data.tokens?.refreshToken || data.refreshToken;
        const normalizedUser = this.normalizeUser(data.user || null);
        const cookieKey = resolveSessionCookieKey(normalizedUser || data.user || null);
        const isProviderAccount = isProviderUser(normalizedUser || data.user || null);

        // Account-switch hygiene: if this login establishes a DIFFERENT account
        // than the one currently stored (e.g. logging into the provider portal
        // while a health session is still present, without an explicit logout),
        // the prior session's selected entity (`gacp.activeEntityId`) is stale.
        // It would be sent as `x-active-entity-id` and the backend rejects every
        // entity-scoped read with 403 ACTIVE_ENTITY_MISMATCH. Clear it so the new
        // session falls back to the new user's default entity (the
        // active-entity-provider re-resolves it). A same-user re-login keeps the
        // selected entity untouched.
        const priorUser = getStoredUser();
        if (!priorUser || !normalizedUser || priorUser.id !== normalizedUser.id) {
            clearActiveEntityId();
        }

        if (accessToken) {
            setStoredAccessToken(accessToken);

            try {
                await fetch('/api/session/set-cookie', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: accessToken, cookieName: cookieKey }),
                    credentials: 'include',
                });
            } catch (e) {
                logger.warn('[AuthService] Failed to set server-side cookie:', e);
            }
        }

        if (normalizedUser) {
            setStoredUser(normalizedUser);
        }

        this.updateLastActivity();
        this.scheduleTokenRefresh();
        this.emit('login', { user: normalizedUser || data.user });

        if (isDev) {
            logger.info('[AuthService] Session saved:', {
                hasAccessToken: !!accessToken,
                hasRefreshToken: !!refreshToken,
                isProviderUser: isProviderAccount,
            });
        }
    }

    getToken(): string | null {
        if (!this.isBrowser()) return null;
        return getStoredAccessToken();
    }

    getUser(): AuthUser | null {
        if (!this.isBrowser()) return null;
        return this.normalizeUser(getStoredUser());
    }

    updateUser(user: AuthUser): void {
        if (!this.isBrowser()) return;
        const normalizedUser = this.normalizeUser(user) || user;
        setStoredUser(normalizedUser);
    }

    isAuthenticated(): boolean {
        const token = this.getToken();
        const user = this.getUser();

        const hasIdentity = Boolean(user?.healthId || user?.providerId || user?.id);
        if (!token || !hasIdentity) return false;

        if (this.isTokenExpired()) {
            if (isDev) { logger.info('[AuthService] Token expired'); }
            return false;
        }

        return true;
    }

    clearSession(): void {
        if (!this.isBrowser()) return;

        if (this.activityHandles.activityTimer) {
            clearTimeout(this.activityHandles.activityTimer);
            this.activityHandles.activityTimer = null;
        }

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        this.sessionEpoch += 1;
        this.refreshRetryCount = 0;
        this.disarmExhaustionRearm();

        clearStoredAuthSession();
        clearLastActivity();

        document.cookie = 'auth_token=; path=/; max-age=0';
        document.cookie = 'provider_token=; path=/; max-age=0';
        document.cookie = 'refresh_token=; path=/; max-age=0';
        document.cookie = 'csrf_token=; path=/; max-age=0';

        void fetch('/api/session/clear-cookie', {
            method: 'POST',
            credentials: 'include',
        }).catch(() => {
            if (isDev) {
                logger.warn('[AuthService] Failed to clear server-side cookies');
            }
        });

        this.emit('logout');

        if (isDev) { logger.info('[AuthService] Session cleared'); }
    }

    private scheduleTokenRefresh(): void {
        if (!this.isBrowser()) return;

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        const user = this.getUser();
        if (isProviderUser(user)) {
            return;
        }

        const timeUntilExpiry = this.getTimeUntilExpiry();
        if (timeUntilExpiry <= 0) return;

        // Fresh schedule for a (re)established session — reset the backoff budget.
        this.refreshRetryCount = 0;

        const bufferMs = this.config.tokenRefreshBufferMinutes * 60 * 1000;
        // Clamped: an unclamped multi-year delay overflows setTimeout's 32-bit
        // signed int and fires IMMEDIATELY (the W1-CORE king-bug trigger).
        const refreshIn = computeRefreshDelayMs(timeUntilExpiry, bufferMs);

        if (refreshIn > 0) {
            this.refreshTimer = setTimeout(() => {
                this.refreshToken();
            }, refreshIn);

            if (isDev) { logger.info('[AuthService] Token refresh scheduled in', Math.round(refreshIn / 1000 / 60), 'minutes'); }
        }
    }

    /**
     * INDETERMINATE refresh failure (network/5xx/timeout): the current access
     * token may still be perfectly valid, so the session is kept and the
     * refresh is retried with bounded exponential backoff. Once the budget is
     * exhausted we stop retrying — a genuine 401 on a real API call (handled
     * by api-client) is the only thing that ends a session after that.
     */
    private scheduleRefreshRetry(): void {
        if (!this.isBrowser()) return;

        // A dead session must never keep a retry loop alive (e.g. an
        // in-flight refresh settling indeterminately after logout).
        if (!this.getToken()) return;

        const delay = computeRefreshRetryDelayMs(this.refreshRetryCount);
        if (delay === null) {
            if (isDev) { logger.warn('[AuthService] Refresh retry budget exhausted; keeping session'); }
            // Long outage: re-arm ONE fresh refresh attempt the next time the
            // user returns to the tab, so a recovered backend re-establishes
            // the session instead of the next API 401 forcing a logout.
            if (!this.exhaustionRearmArmed) {
                this.exhaustionRearmArmed = true;
                window.addEventListener('focus', this.exhaustionRearmHandler);
                document.addEventListener('visibilitychange', this.exhaustionRearmHandler);
            }
            return;
        }

        this.refreshRetryCount += 1;

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => {
            void this.refreshToken();
        }, delay);

        if (isDev) { logger.info('[AuthService] Refresh retry scheduled in', Math.round(delay / 1000), 'seconds'); }
    }

    async refreshToken(): Promise<boolean> {
        const user = this.getUser();
        if (isProviderUser(user)) {
            if (isDev) {
                logger.info('[AuthService] Provider session refresh is disabled');
            }
            return false;
        }

        // Snapshot the session identity: if it changes while the fetch is in
        // flight (logout, or logout + new login), the settle below must be a
        // no-op — no clear, no emit, no reschedule.
        const epochAtStart = this.sessionEpoch;

        try {
            const response = await fetch('/api/auth/health/refresh', {
                method: 'POST',
                credentials: 'include',
            });

            if (epochAtStart !== this.sessionEpoch) return false;

            // DEFINITIVE rejection: the auth server saw the refresh credential
            // and refused it. This is the ONLY failure allowed to end the session.
            if (response.status === 401 || response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                if (epochAtStart !== this.sessionEpoch) return false;
                logger.error('[AuthService] Refresh rejected by auth server:', errorData);
                this.clearSession();
                this.emit('session_expired');
                return false;
            }

            // INDETERMINATE: 5xx / gateway error / backend unreachable. The
            // stored token may still be valid — keep the session, retry later.
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (epochAtStart !== this.sessionEpoch) return false;
                logger.warn('[AuthService] Refresh unavailable (keeping session):', errorData);
                this.scheduleRefreshRetry();
                return false;
            }

            const data = await response.json() as {
                success?: boolean;
                data?: { accessToken?: string };
            };

            if (epochAtStart !== this.sessionEpoch) return false;

            if (data.success && data.data?.accessToken) {
                this.refreshRetryCount = 0;
                setStoredAccessToken(data.data.accessToken);
                this.scheduleTokenRefresh();
                this.emit('token_refresh');
                if (isDev) { logger.info('[AuthService] Token refreshed successfully'); }
                return true;
            }

            // Malformed 2xx body — a proxy/backend bug, not proof of expiry.
            logger.warn('[AuthService] Invalid refresh response (keeping session)');
            this.scheduleRefreshRetry();
            return false;
        } catch (error: unknown) {
            if (epochAtStart !== this.sessionEpoch) return false;
            // Network error / timeout — INDETERMINATE by definition.
            logger.warn('[AuthService] Refresh network failure (keeping session):', error);
            this.scheduleRefreshRetry();
            return false;
        }
    }

    updateLastActivity(): void {
        activityUpdate(this, this.activityHandles, this.config.sessionTimeoutMinutes);
    }

    isSessionTimedOut(): boolean {
        return activityTimedOut(this.config.sessionTimeoutMinutes);
    }

    saveRememberMe(accountType: string, identifier: string): void {
        if (!this.isBrowser()) return;
        saveRememberMeToStorage(accountType, identifier);
    }

    getRememberMe(): { accountType: string; identifier: string } | null {
        if (!this.isBrowser()) return null;
        return getRememberMe();
    }

    clearRememberMe(): void {
        if (!this.isBrowser()) return;
        clearRememberMe();
    }

    // Double-submit CSRF: mint a `csrf_token` cookie if this session never
    // seeded one, so the logout POST can carry a matching x-csrf-token header
    // (else the backend csrf-middleware 403s and the session/JTI is never
    // revoked server-side). Mirrors apiClient.getCsrfToken's mint pattern.
    private mintCsrfCookie(): void {
        if (!this.isBrowser()) return;
        try {
            const minted = (typeof globalThis.crypto?.randomUUID === 'function')
                ? globalThis.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            document.cookie = `csrf_token=${minted}; path=/; SameSite=Lax`;
        } catch {
            // ignore — logout still proceeds and clears the local session
        }
    }

    async logout(callApi = true): Promise<void> {
        if (callApi) {
            try {
                const user = this.getUser();
                const logoutEndpoint = isProviderUser(user)
                    ? '/api/auth/provider/logout'
                    : '/api/auth/health/logout';
                // Ensure a csrf_token cookie exists, then send the matching header
                // so the backend accepts the mutation and revokes the session/JTI.
                if (this.isBrowser() && !readCsrfCookie(document.cookie)) {
                    this.mintCsrfCookie();
                }
                await fetch(logoutEndpoint, {
                    method: 'POST',
                    credentials: 'include',
                    headers: buildLogoutHeaders(this.isBrowser() ? document.cookie : null),
                });
            } catch {
            }
        }
        this.clearSession();
    }
}

export const AuthService = new AuthServiceClass();

export { AuthServiceClass };

export type {
    AuthConfig,
    AuthEventCallback,
    AuthEventType,
    AuthUser,
    SessionData,
} from './auth-service.types';
