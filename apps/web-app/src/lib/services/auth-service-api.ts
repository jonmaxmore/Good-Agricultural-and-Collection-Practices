import { apiClient } from '../api/api-client';
import type { AuthUser, SessionData } from './auth-service.types';
import { HEALTH_LOGIN_ROUTE, PROVIDER_LOGIN_ROUTE } from '../constants/auth-routes';

export type HealthLoginCredentials = {
    identifier?: string;
    healthId?: string;
    password: string;
    providerId?: never;
    accountType?: never;
};

export type ProviderLoginCredentials = {
    providerId: string;
    password: string;
    accountType?: string;
    identifier?: never;
    healthId?: never;
};

export type LoginCredentials = HealthLoginCredentials | ProviderLoginCredentials;

/**
 * Login posts to this platform's own API and nowhere else.
 *
 * A flag-gated Firebase Authentication exchange used to sit in front of this
 * function for both portals. It was removed under the data-sovereignty
 * requirement: it made Google the identity provider for Thai citizens and
 * DTAM officers, handing Google a permanent account record keyed by the
 * national-ID hash plus every login's IP, user agent and timestamp. Both
 * flags were off in every environment, and this legacy path — national ID or
 * provider ID plus password, verified against our own Postgres — was already
 * the only active one, so nothing was lost with it.
 *
 * Do not reintroduce a foreign IdP here. If federated identity is ever
 * needed, it must be self-hosted on Thai infrastructure (e.g. Keycloak in
 * the DTAM cluster). See docs/audit-reports/2026-07-25-data-sovereignty-audit.md.
 */
export async function loginWithAuthApi(
    credentials: LoginCredentials,
    saveSession: (data: SessionData) => void | Promise<void>,
): Promise<{ success: boolean; error?: string | undefined; mfaRequired?: boolean | undefined; mfaSession?: string | undefined }> {
    try {
        const isProviderLogin = Boolean(credentials.providerId);

        const payload: Record<string, unknown> = { password: credentials.password };

        if (credentials.healthId) {
            payload.healthId = credentials.healthId;
        } else if (credentials.providerId) {
            payload.providerId = credentials.providerId;
        } else {
            payload.identifier = credentials.identifier;
        }
        if (isProviderLogin && credentials.accountType) {
            payload.accountType = credentials.accountType;
        } else if (!isProviderLogin) {
            payload.accountType = 'INDIVIDUAL';
        }

        const endpoint = isProviderLogin ? PROVIDER_LOGIN_ROUTE : HEALTH_LOGIN_ROUTE;
        const response = await apiClient.post<SessionData>(endpoint, payload);

        if (!response.success || !response.data) {
            return {
                success: false,
                error: response.error || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
            };
        }

        const data = response.data as SessionData & { mfa_required?: boolean; mfa_session?: string };

        // 2FA challenge: the backend validated the password and returned an
        // mfa_session (no token yet) instead of a session. Surface it so the
        // login page can prompt for the OTP/TOTP code. (These fields live INSIDE
        // body.data, so they survive apiClient's envelope-strip; the bug was that
        // the token-guard below fired first and masked them as 'token not received'.)
        if (data.mfa_required && data.mfa_session) {
            return { success: false, mfaRequired: true, mfaSession: data.mfa_session };
        }

        const token = data.tokens?.accessToken || data.token || data.accessToken;

        if (!token) {
            return { success: false, error: 'ไม่ได้รับ Token จากระบบ' };
        }

        await saveSession({
            ...data,
            token,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('[AuthService] Login failed:', error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
}

export async function registerWithAuthApi(data: unknown): Promise<{ success: boolean; error?: string | undefined; data?: unknown }> {
    try {
        const response = await apiClient.post<{ user: AuthUser }>('/auth/health/register', data);

        if (!response.success) {
            return { success: false, error: response.error };
        }

        return { success: true, data: response.data };
    } catch (error: unknown) {
        console.error('[AuthService] Register failed:', error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
}

export async function checkIdentifierWithAuthApi(identifier: string): Promise<{ available: boolean; error?: string | undefined }> {
    try {
        const response = await apiClient.post<{ available: boolean; error?: string }>('/auth/health/check-identifier', {
            identifier,
            accountType: 'INDIVIDUAL',
        });

        if (!response.success) {
            return { available: false, error: response.error };
        }

        const result = response.data;
        if (!result) return { available: false, error: 'No data' };

        return {
            available: !!result.available,
            error: result.error,
        };
    } catch (_error) {
        return { available: false, error: 'Connection Error' };
    }
}

interface UpdateProfileDeps {
    normalizeUser: (user?: AuthUser | null) => AuthUser | null;
    getUser: () => AuthUser | null;
    updateUser: (user: AuthUser) => void;
    emitLogin: (user: AuthUser) => void;
}

export async function updateProfileWithAuthApi(
    data: Partial<AuthUser>,
    deps: UpdateProfileDeps,
): Promise<{ success: boolean; error?: string; data?: AuthUser }> {
    try {
        const response = await apiClient.patch<AuthUser>('/auth/health/me', data);

        if (!response.success || !response.data) {
            return { success: false, error: response.error || 'Update failed' };
        }

        const updatedFromApi = deps.normalizeUser(response.data) || response.data;
        const currentUser = deps.getUser();

        if (currentUser) {
            const updatedUser = deps.normalizeUser({ ...currentUser, ...updatedFromApi }) || { ...currentUser, ...updatedFromApi };
            deps.updateUser(updatedUser);
            deps.emitLogin(updatedUser);
        }

        return { success: true, data: updatedFromApi };
    } catch (error: unknown) {
        console.error('[AuthService] Update Profile failed:', error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
}
