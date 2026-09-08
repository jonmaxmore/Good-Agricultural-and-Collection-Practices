/**
 * Tenant Context (ADR-014, Phase 2)
 *
 * Async-local tenant scope used by:
 *   - the express middleware that resolves a tenant per request
 *   - the Prisma client extension that auto-injects organizationId on writes
 *   - any service code that needs to know the current tenant without
 *     plumbing it through every function signature
 *
 * Single rule: if `getTenantContext()` returns null, the calling code is
 * either platform-admin (and must have entered `withoutTenantScope`) or it
 * is misconfigured. The Prisma extension treats null as "do not inject" so
 * scripts, tests, and migrations continue to work.
 */

const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

/**
 * Read the tenant context bound to the current async chain.
 * @returns {{ organizationId: string } | null}
 */
function getTenantContext() {
  return storage.getStore() || null;
}

/**
 * Convenience accessor that throws if no tenant is bound. Use in code paths
 * that must run inside a tenant scope (e.g., write operations on
 * tenant-scoped tables that did not get an explicit organizationId).
 */
function requireTenantContext() {
  const ctx = storage.getStore();
  if (!ctx || !ctx.organizationId) {
    throw new Error(
      'TenantContext required but not set. ' +
        'Ensure tenant-context-middleware ran before this code path, ' +
        'or wrap admin/system code in withoutTenantScope().',
    );
  }
  return ctx;
}

/**
 * Run `fn` inside a tenant scope. The scope is shared with all async work
 * spawned from `fn` (Promises, setImmediate, etc.) via AsyncLocalStorage.
 *
 * @param {{ organizationId: string }} context
 * @param {() => any} fn
 */
function runWithTenantContext(context, fn) {
  if (!context || !context.organizationId) {
    throw new Error('runWithTenantContext: organizationId is required');
  }
  return storage.run(context, fn);
}

/**
 * Explicit escape hatch for platform-admin / system paths that must read or
 * write across tenants (super-admin listing, billing reconciliation,
 * cross-tenant migrations).
 *
 * Inside `fn`, getTenantContext() returns null. Any write through the
 * Prisma extension will refuse to auto-inject organizationId — callers must
 * either supply it explicitly or operate on global tables only.
 *
 * @param {() => any} fn
 */
function withoutTenantScope(fn) {
  return storage.run(null, fn);
}

/**
 * True only for code running inside an active `withoutTenantScope()` call —
 * an intentional "no tenant, on purpose" bypass. This is NOT the same as
 * "no tenant context is bound": `getTenantContext()` returns null in BOTH
 * that case and the genuinely-unbound case (nothing ever called
 * runWithTenantContext or withoutTenantScope on this async chain), because
 * it normalizes via `storage.getStore() || null`.
 *
 * The raw AsyncLocalStorage store distinguishes the two: it is `undefined`
 * when no `storage.run()` is active, and exactly `null` when the active run
 * is `withoutTenantScope`'s `storage.run(null, fn)`. This accessor exposes
 * that raw distinction so callers (e.g., services/rls-shadow-metrics.js) can
 * tell "genuinely missing context" (a bug/misconfiguration — would fail
 * closed under future RLS enforcement) apart from "deliberately bypassed"
 * (platform-admin / cron / system code) — the metric must fire only for the
 * former.
 */
function isWithoutTenantScope() {
  return storage.getStore() === null;
}

module.exports = {
  getTenantContext,
  requireTenantContext,
  runWithTenantContext,
  withoutTenantScope,
  isWithoutTenantScope,
};
