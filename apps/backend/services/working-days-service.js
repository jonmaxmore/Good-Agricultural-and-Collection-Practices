/**
 * Weekend arithmetic over an INJECTED holiday set — this module owns no calendar.
 *
 * L-001 (AUDIT_LEDGER.md:20): the backend had two Thai holiday sources. The
 * canonical one is utils/working-days.js — it carries the recurring + lunar
 * holiday tables and evaluates them in Asia/Bangkok. The second one lived here:
 * a loader that merged an environment variable with a system-configuration row
 * (both named in the L-001 ledger entry). Neither input is seeded anywhere in
 * this repository, so that second calendar resolved to an EMPTY set in every
 * environment built from this tree — WITH THE STATE OF THE STAGING DATABASE AND
 * ENVIRONMENT NOT YET VERIFIED (operator check pending, L-001 F1: if that config
 * row or that env var was set by hand on a deployed system, that environment WAS
 * holiday-aware here and this change alters its numbers). Its two callers
 * (routes/api/system/system.js, routes/api/system/cron.js) were already doing
 * weekend-only arithmetic while the code read as though holidays were handled.
 * That is one indirection away from the Blocker F deadline bug, and it is why
 * the loader is gone rather than re-pointed: a holiday source that looks
 * authoritative and contributes nothing is worse than none.
 *
 * What remains is deliberately calendar-free, and note that this is a narrower
 * module than it looks — the `holidaySet` parameter stays, so a caller that
 * needs holiday awareness injects one. Callers that want the real Thai calendar
 * should use utils/working-days directly instead; it evaluates in ICT rather
 * than server-local time, which is the other half of the Blocker F defect.
 * Do NOT reintroduce a holiday table or a holiday loader in this file. Know
 * exactly how far the automation backs that up, because it is narrower than it
 * reads: probe `holiday-single-source` and the SSOT block in
 * __tests__/unit/working-days-service.test.js are BOTH token-scoped AND
 * directory-scoped: they grep for three literal identifiers — the exact list is
 * at scripts/probes/holiday-single-source.sh:5 and scripts/probes/ssot-domains.txt:5,
 * deliberately not repeated here, see below — across services/, utils/, shared/
 * and config/ only. A duplicate calendar under any other name (`THAI_OFF_DAYS`,
 * say) or in any other directory passes all of them silently; verified by
 * mutation in evidence/l001/f3-mutation-guard-scope.txt. So the guard catches
 * the specific regression L-001 fixed and nothing more; the rest is on review.
 *
 * The reason the identifiers are cited by location instead of quoted: those greps
 * match token OCCURRENCES, not declarations, so a comment that names them is
 * itself counted as a holiday source. Writing this warning out in full flipped
 * `holiday-single-source` back to FAIL and pushed dup-source 2 -> 3 with no code
 * change at all. That perverse incentive — documenting the trap re-arms it — is
 * filed against the probe patterns in BACKLOG-FOUND.md.
 */

function toDate(value) {
    const parsed = value instanceof Date ? new Date(value) : new Date(String(value || ''));
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toDateKey(value) {
    const date = toDate(value);
    if (!date) { return null; }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isWeekend(dateValue) {
    const date = toDate(dateValue);
    if (!date) { return false; }
    const day = date.getDay();
    return day === 0 || day === 6;
}

function isWorkingDay(dateValue, holidaySet = new Set()) {
    const key = toDateKey(dateValue);
    if (!key) { return false; }
    if (isWeekend(dateValue)) { return false; }
    return !holidaySet.has(key);
}

function addWorkingDays(startDate, workingDays, holidaySet = new Set()) {
    const result = toDate(startDate) || new Date();
    const daysToAdd = Number.parseInt(String(workingDays || 0), 10);
    if (!Number.isFinite(daysToAdd) || daysToAdd <= 0) {
        return result;
    }

    let added = 0;
    while (added < daysToAdd) {
        result.setDate(result.getDate() + 1);
        if (isWorkingDay(result, holidaySet)) {
            added += 1;
        }
    }
    return result;
}

function countWorkingDays(fromDate, toDateValue, holidaySet = new Set()) {
    const start = toDate(fromDate);
    const end = toDate(toDateValue);
    if (!start || !end || start > end) {
        return 0;
    }

    const cursor = new Date(start);
    let count = 0;
    while (cursor <= end) {
        if (isWorkingDay(cursor, holidaySet)) {
            count += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

module.exports = {
    isWorkingDay,
    addWorkingDays,
    countWorkingDays,
    toDateKey,
};
