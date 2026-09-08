import type { NextConfig } from "next";
import path from "node:path";
import withSerwistInit from "@serwist/next";

// Internal URL for server-side rewrites (uploads)
// Priority: INTERNAL_API_URL -> BACKEND_URL -> localhost:8000
// NOTE: /api/* is NOT rewritten here because app/api/[...path]/route.ts handles it.
const internalBackendUrl =
  process.env.INTERNAL_API_URL ||
  process.env.BACKEND_URL ||
  "http://localhost:8000";

// Public URL for browser traffic (Browser -> Next.js -> backend via proxy route)
const publicBackendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Keep PWA disabled by default until TLS/domain is fully trusted in production.
const pwaEnabled = process.env.NEXT_PUBLIC_PWA_ENABLED === "true";

const nextConfig: NextConfig = {
  // Standalone output for production deployment
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Optimize images: serve modern formats (WebP/AVIF) automatically
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Transpile workspace packages (TypeScript source)
  transpilePackages: ["@gacp/validation"],

  // Rewrites for static assets served by backend
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${internalBackendUrl}/uploads/:path*`,
      },
    ];
  },

  // External packages for server
  serverExternalPackages: ["ioredis"],

  env: {
    NEXT_PUBLIC_API_URL: publicBackendUrl,
    NEXT_PUBLIC_PWA_ENABLED: pwaEnabled ? "true" : "false",
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development" || !pwaEnabled,
  register: pwaEnabled,
});

// DATA SOVEREIGNTY (PDPA) — the third-party error-reporting wrapper that
// previously wrapped this export was removed, along with its three runtime
// config files and its dependency. It shipped unredacted exception messages,
// stack traces, request URLs and breadcrumbs to a US-hosted ingest endpoint,
// with no `beforeSend` scrubber and no PII stripping — from a portal whose
// route params and form state carry national IDs, names and addresses. Its
// `tunnelRoute` option also proxied events through this app's own origin,
// which defeats both the CSP `connect-src` allowlist and any network-level
// egress block. It was dormant only because no DSN was provisioned; a single
// env var would have turned it on with no other code change.
//
// If error aggregation is reintroduced, it MUST be a self-hosted collector
// (GlitchTip or self-hosted Sentry) running on Thai infrastructure inside the
// DTAM cluster, so no citizen data leaves the country. Both speak the same
// wire protocol, so reinstatement is a DSN host swap — but re-add a
// `beforeSend` scrubber and never re-enable `tunnelRoute`.
export default withSerwist(nextConfig);
