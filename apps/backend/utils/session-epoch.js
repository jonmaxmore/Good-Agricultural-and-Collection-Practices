'use strict';

/**
 * Session-epoch timestamp for credential invalidation (BE-AUTH-03 session epoch).
 *
 * Stamp `User.sessionsRevokedAt` with this on EVERY credential mutation
 * (password change/reset, PDPA anonymize/erase) so that access/refresh tokens
 * issued BEFORE the mutation are evicted: the refresh + auth-middleware checks
 * reject a token whose `iat` predates `sessionsRevokedAt`.
 *
 * SF-2: rounded UP to the next whole second. JWT `iat` is floored to whole
 * seconds, so a sub-second (`.xyz`) stamp would let a token minted later in the
 * SAME second survive the strict `iat*1000 < sessionsRevokedAt` comparison.
 * Rounding the stamp up to the next second closes that ~1s survival window
 * without switching the comparator to `<=` (which would falsely 401 a legitimate
 * same-second re-login).
 *
 * @returns {Date} the next whole-second boundary, in ms.
 */
function sessionEpochStamp() {
    return new Date((Math.floor(Date.now() / 1000) + 1) * 1000);
}

module.exports = { sessionEpochStamp };
