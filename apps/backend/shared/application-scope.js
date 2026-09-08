/**
 * How many certification scopes an application is billed for.
 *
 * `Application.cultivationScopeCount` is the column that says what it holds:
 * one scope per DISTINCT cultivation method the applicant declared, resolved by
 * feeService.resolveCultivationScopeCount and stamped by every writer as
 * `fees.scopeCount`. It is the multiplier on every quotation, invoice and
 * receipt line.
 *
 * `Application.totalAreaTypes` is the name it replaces (migration
 * 20260826090000_area_sqm_and_cultivation_scope_expand). It never counted area
 * types; it was named for a design in which one submission fanned out into N
 * sibling applications, one per area type, which nothing writes any more. It is
 * still written by every writer, so a rollback to the previous image prices
 * correctly, and it is what a row carries when it was last written by that
 * image or when a caller's `select` predates the rename.
 *
 * DELETE THE FALLBACK in the contract change, once `totalAreaTypes` is dropped:
 * `application.cultivationScopeCount` then stands alone.
 *
 * Returns null rather than a default, so each caller keeps the default it
 * already chose — `?? 1` where a missing count means one scope, `undefined`
 * where a missing count means "do not override the fee service".
 *
 * @param {{ cultivationScopeCount?: unknown, totalAreaTypes?: unknown }} application
 * @returns {number|null} a positive scope count, or null if the row does not state one
 */
function storedCultivationScopeCount(application) {
    const raw = application?.cultivationScopeCount ?? application?.totalAreaTypes;
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

module.exports = { storedCultivationScopeCount };
