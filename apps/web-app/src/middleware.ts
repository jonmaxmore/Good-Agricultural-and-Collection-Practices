import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
    decideHealthAccess,
    decideProviderRouteAccess,
    decodeCanonicalRoleFromToken,
    PROVIDER_ROUTE_ROLE_RULES,
} from '@/lib/middleware-helpers';
import {
    HEALTH_LOGIN_ROUTE,
    LEGACY_HEALTH_LOGIN_ROUTE,
    LEGACY_PROVIDER_LOGIN_ROUTE,
    PROVIDER_DASHBOARD_ROUTE,
    PROVIDER_LOGIN_ALIASES,
    PROVIDER_LOGIN_ROUTE,
} from '@/lib/constants/auth-routes';

// Canonical routes that require health identity authentication
const protectedHealthRoutes = ['/health'];

// Canonical routes that require provider identity authentication
const protectedProviderRoutes = [
    '/provider',
    '/admin',
];

// Public auth routes (provider identity)
const providerAuthRoutes = [...PROVIDER_LOGIN_ALIASES];

// FE-XC-02: the inline JWT-role decoder + provider-route gate were duplicated
// here (untested) vs the tested helpers in middleware-helpers.ts. middleware()
// now calls `decodeCanonicalRoleFromToken` + `decideProviderRouteAccess`
// directly so the shipping path IS the tested path.

const backendOrigin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || 'https://gacpth.com';

/**
 * Origin of the operator-configured map tile source, for the CSP `img-src`.
 *
 * The tile source is chosen by whoever deploys the platform (see
 * `lib/config/map-tiles`) and there is no built-in default, so the one host
 * `img-src` may admit beyond our own is derived from that same setting rather
 * than hardcoded. A same-origin proxy template (`/api/map-tiles/...`) yields
 * nothing to add; an unset or unparseable value likewise adds nothing, which
 * keeps the directive closed by default.
 */
function configuredTileOrigin(): string | null {
    const template = (process.env.NEXT_PUBLIC_MAP_TILE_URL ?? '').trim();
    if (!template || template.startsWith('/')) {
        return null;
    }
    try {
        return new URL(template).origin;
    } catch {
        return null;
    }
}

const tileOrigin = configuredTileOrigin();

// W2-D: exported as a NAMED const so security-headers-middleware.test.ts
// can pin every directive without spinning up a NextRequest. The literal
// MUST remain a static object so the test can compare against a known
// fixed surface — no dynamic values may be added except `backendOrigin`,
// which is captured via env at module load.
export const securityHeaders = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // geolocation=(self): the onsite field app (/provider/audits/[id]/inspect)
    // needs the device GPS for its check-in + photo coordinates; a blanket
    // deny disabled the API for our own document and made the ≥5-photo
    // evidence gate unsatisfiable (F-PERMISSIONS-POLICY-KILLS-FIELD-GPS,
    // Phase 0 C12 2026-08-19). Third-party iframes remain denied — (self)
    // grants only same-origin documents.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': [
        "default-src 'self'",
        // 'unsafe-inline' + 'unsafe-eval' kept temporarily for ThemeScript +
        // Next.js dev/runtime; tracked for nonce migration in Phase A6.
        // static.cloudflareinsights.com = CF Web Analytics beacon, auto-injected
        // at the Cloudflare edge (gacpth.com is CF-proxied). Allowlisted so it
        // loads instead of throwing a CSP violation console error on every page.
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
        // v3.5.1 (2026-04-28): self-host all fonts via @fontsource — drop
        // fonts.googleapis.com / fonts.gstatic.com from style-src + font-src.
        // 'unsafe-inline' for style-src remains needed by Tailwind JIT
        // arbitrary values (`bg-[#0b1f3a]`) which inject inline styles.
        "style-src 'self' 'unsafe-inline'",
        // A bare `https:` used to sit here, which permits an image request to
        // every HTTPS host on the internet — the hole a foreign map tile or a
        // tracking pixel travels through, and one that would silently undo the
        // component-level fixes. Narrowed to what the app actually renders:
        //   'self'        static assets and everything behind the /uploads rewrite
        //   data:         QR codes, generated inline
        //   blob:         local file previews before upload (never leaves the browser)
        //   backendOrigin uploaded documents when served directly, not proxied
        //   tileOrigin    the operator's own map tile host, if one is configured
        `img-src 'self' data: blob: ${backendOrigin}${tileOrigin ? ` ${tileOrigin}` : ''}`,
        "font-src 'self' data:",
        // v3.5.1: tighten connect-src — drop wildcard `https:` that
        // effectively allowed any HTTPS endpoint. Keep `http://localhost:*`
        // for local dev (Next dev server makes its own HMR connections).
        // Google's identitytoolkit + securetoken domains were allowlisted here
        // for a Firebase Auth login path. That path was removed under the
        // data-sovereignty requirement, so the browser must no longer be able
        // to reach a foreign identity provider at all: login talks to our own
        // backend origin and nothing else.
        // cloudflareinsights.com = where the CF Web Analytics beacon POSTs its
        // (cookieless) metrics — allowlist alongside the beacon script above.
        `connect-src 'self' ${backendOrigin} https://cloudflareinsights.com http://localhost:*`,
        // openstreetmap.org was allowlisted here for an <iframe> on the
        // establishment detail page whose src carried the farm's exact
        // coordinates — a foreign server learned the precise location of a Thai
        // farm on every page view, with no click required. That embed is gone
        // under the data-sovereignty requirement and the allowance goes with
        // it, so the frame cannot come back by accident. Maps are drawn from
        // the operator-configured source only (lib/config/map-tiles).
        "frame-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; '),
} as const;

function isRouteMatch(pathname: string, route: string): boolean {
    return pathname === route || pathname.startsWith(`${route}/`);
}

function redirectTo(request: NextRequest, pathname: string): NextResponse {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname;
    return NextResponse.redirect(redirectUrl);
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // CVE-2025-29927 protection
    const subrequestHeader = request.headers.get('x-middleware-subrequest');
    if (subrequestHeader) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    // Canonical URL redirects
    if (pathname === LEGACY_HEALTH_LOGIN_ROUTE) {
        return redirectTo(request, HEALTH_LOGIN_ROUTE);
    }
    if (pathname === LEGACY_PROVIDER_LOGIN_ROUTE) {
        return redirectTo(request, PROVIDER_LOGIN_ROUTE);
    }

    const response = NextResponse.next();

    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    const suspiciousPatterns = [
        /\.\.\//,
        /<script/i,
        /javascript:/i,
        /\x00/,
    ];

    if (suspiciousPatterns.some((pattern) => pattern.test(pathname))) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const healthToken = request.cookies.get('auth_token')?.value;
    const isProtectedHealthRoute = protectedHealthRoutes.some((route) => isRouteMatch(pathname, route));
    if (isProtectedHealthRoute && !healthToken) {
        const loginUrl = new URL(HEALTH_LOGIN_ROUTE, request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // V1-D D1: enforce HEALTH role on /health/*. Pre-fix this branch
    // only checked cookie presence — a provider with an `auth_token`
    // (dev fixture or cross-tab leakage) bypassed the gate and could
    // reach farmer dashboards. Mirrors the /provider/* role check at
    // lines 151-157 below. See docs/handoffs/iter-V1/00-rfc.md §D1.
    if (isProtectedHealthRoute && healthToken) {
        const decision = decideHealthAccess(healthToken);
        if (decision.decision === 'redirect-provider-dashboard') {
            return NextResponse.redirect(new URL(PROVIDER_DASHBOARD_ROUTE, request.url));
        }
        if (decision.decision === 'redirect-health-login') {
            const loginUrl = new URL(HEALTH_LOGIN_ROUTE, request.url);
            loginUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Keep disabled to avoid redirect loops when localStorage is empty in another tab.
    // if (pathname === HEALTH_LOGIN_ROUTE && healthToken) {
    //     return NextResponse.redirect(new URL('/health/dashboard', request.url));
    // }

    const providerToken = request.cookies.get('provider_token')?.value;
    const isProtectedProviderRoute = protectedProviderRoutes.some((route) => isRouteMatch(pathname, route));
    const isProviderAuthRoute = providerAuthRoutes.some((route) => isRouteMatch(pathname, route));

    // AUDIT-PR11: Debug logging removed for production safety
    // Cookie names and session state should not be logged in middleware

    if (isProtectedProviderRoute && !providerToken) {
        const loginUrl = new URL(PROVIDER_LOGIN_ROUTE, request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (isProtectedProviderRoute && providerToken) {
        const canonicalRole = decodeCanonicalRoleFromToken(providerToken);
        const decision = decideProviderRouteAccess(pathname, canonicalRole, PROVIDER_ROUTE_ROLE_RULES);
        if (decision.decision === 'redirect-provider-dashboard') {
            return NextResponse.redirect(new URL(PROVIDER_DASHBOARD_ROUTE, request.url));
        }
        if (decision.decision === 'redirect-provider-login') {
            // FE-XC-03: a non-provider role in the provider cookie slot — clear the
            // bad cookie and bounce to provider login (redirecting to the dashboard
            // would loop, since the dashboard is the unlisted path being denied).
            const loginUrl = new URL(PROVIDER_LOGIN_ROUTE, request.url);
            loginUrl.searchParams.set('redirect', pathname);
            const denied = NextResponse.redirect(loginUrl);
            denied.cookies.delete('provider_token');
            return denied;
        }
    }

    if (isProviderAuthRoute && providerToken) {
        return NextResponse.redirect(new URL(PROVIDER_DASHBOARD_ROUTE, request.url));
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.png$|.*\\.jpg$).*)',
    ],
};
