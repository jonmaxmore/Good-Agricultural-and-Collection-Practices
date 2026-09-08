/**
 * GACP Platform — canonical Error Code Catalog
 *
 * Catalog of every error code emitted by the backend services / routes /
 * middleware. Each row carries the HTTP status, Thai + English messages,
 * the source file/line where the code is first thrown, and a one-line
 * remediation hint suitable for surfacing to integrators or operators.
 *
 * AUTHORSHIP:
 *   - Initial seed: the 10 codes in `shared/api-response.js`
 *     DEFAULT_ERROR_MESSAGES and the 11 codes thrown by AppError
 *     subclasses + the JWT/route branches in `shared/errors.js`.
 *   - Bulk content: derived via `scripts/extract-error-codes.js` from
 *     the codebase-wide `code:` / `.code =` / `makeError(...)` patterns
 *     across `routes/**`, `services/**`, `middleware/**`, `shared/**`.
 *   - The extractor's `--validate` mode keeps this file fresh: if a
 *     new code is added to the backend without a catalog row, the
 *     script exits non-zero and CI breaks.
 *
 * SCHEMA:
 *   - code         — UPPER_SNAKE error code identifier
 *   - httpStatus   — 4xx / 5xx HTTP status code
 *   - messageEn    — short English message (≤120 chars)
 *   - messageTh    — Thai equivalent (≤120 chars)
 *   - source       — `<relative-path>:<line>` of the canonical emit site
 *   - remediation  — one-line user-facing action the integrator can take
 *
 * Reviewed and aligned with `shared/api-response.js` DEFAULT_ERROR_MESSAGES
 * (10 codes) and `shared/errors.js` AppError subclasses (8 + 3 branch codes
 * = 11 codes). DO NOT remove rows already present in those source-of-truth
 * modules — the catalog test (`__tests__/unit/error-codes-catalog.test.js`)
 * will fail.
 *
 * To regenerate after adding new throws:
 *   node apps/backend/scripts/extract-error-codes.js --emit-stubs
 *   # → appends TODO_* sentinels for new codes; humans fill in messages
 */

const ERROR_CODES = Object.freeze({
  // ─────────── shared/api-response.js DEFAULT_ERROR_MESSAGES (seed) ───────────
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    httpStatus: 500,
    messageEn: 'Internal server error',
    messageTh: 'เกิดข้อผิดพลาดภายในระบบ',
    source: 'shared/api-response.js:4',
    remediation: 'Retry after a short delay; if persistent, contact platform support with the requestId from the response.',
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    httpStatus: 400,
    messageEn: 'Validation failed',
    messageTh: 'ข้อมูลไม่ถูกต้อง',
    source: 'shared/errors.js:28',
    remediation: 'Review error.details to identify the offending field and resubmit with corrected values.',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    httpStatus: 401,
    messageEn: 'Unauthorized',
    messageTh: 'ไม่มีสิทธิ์เข้าถึง',
    source: 'shared/api-response.js:12',
    remediation: 'Acquire a valid bearer token via /api/auth/login and retry with Authorization: Bearer <token>.',
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    httpStatus: 403,
    messageEn: 'Forbidden',
    messageTh: 'ไม่ได้รับอนุญาตให้ดำเนินการ',
    source: 'shared/api-response.js:16',
    remediation: 'Your role lacks the required capability for this resource. Contact your tenant admin to escalate.',
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    httpStatus: 404,
    messageEn: 'Resource not found',
    messageTh: 'ไม่พบข้อมูลที่ต้องการ',
    source: 'shared/errors.js:58',
    remediation: 'Verify the resource ID; the entity may have been deleted or never existed under this tenant.',
  },
  INVALID_PATH: {
    code: 'INVALID_PATH',
    httpStatus: 400,
    messageEn: 'Malformed or traversal path',
    messageTh: 'เส้นทางไฟล์ไม่ถูกต้อง',
    source: 'middleware/uploads-access.js:42',
    remediation: 'C1: the /uploads request path was malformed or contained a `..`/`.` traversal segment and was rejected before static serving. Request the asset by its canonical, non-traversal URL.',
  },
  REQUEST_FAILED: {
    code: 'REQUEST_FAILED',
    httpStatus: 400,
    messageEn: 'Request failed',
    messageTh: 'คำขอไม่สำเร็จ',
    source: 'shared/api-response.js:24',
    remediation: 'Review request shape against the OpenAPI spec and the response error.details for specifics.',
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    httpStatus: 401,
    messageEn: 'Invalid username or password',
    messageTh: 'ไม่พบผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
    source: 'shared/api-response.js:28',
    remediation: 'Double-check the identifier and password. Repeated failures trigger RATE_LIMIT_EXCEEDED.',
  },
  MISSING_CREDENTIALS: {
    code: 'MISSING_CREDENTIALS',
    httpStatus: 400,
    messageEn: 'Please provide identifier and password',
    messageTh: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน',
    source: 'shared/api-response.js:32',
    remediation: 'Include both identifier and password fields in the request body.',
  },
  CSRF_MISMATCH: {
    code: 'CSRF_MISMATCH',
    httpStatus: 403,
    messageEn: 'Invalid CSRF token',
    messageTh: 'โทเค็นความปลอดภัยไม่ถูกต้อง',
    source: 'middleware/csrf-middleware.js:106',
    remediation: 'Fetch a fresh CSRF token via /api/csrf and send it in the X-CSRF-Token header on the next request.',
  },
  WEBHOOK_PROCESSING_FAILED: {
    code: 'WEBHOOK_PROCESSING_FAILED',
    httpStatus: 500,
    messageEn: 'Webhook callback accepted but processing failed',
    messageTh: 'ระบบรับ callback แล้ว แต่ประมวลผลไม่สำเร็จ',
    source: 'shared/api-response.js:40',
    remediation: 'Provider should retry per their webhook retry policy. Check operator dashboard for processing logs.',
  },
  CONFLICT: {
    code: 'CONFLICT',
    httpStatus: 409,
    messageEn: 'Resource conflict',
    messageTh: 'ทรัพยากรขัดแย้งกัน',
    source: 'shared/api-response.js:216',
    remediation: 'Re-fetch the latest resource state and reconcile your local copy before retrying. (Prisma P2002/P2025 unique/relation conflicts map here.)',
  },

  // ─────────── middleware/partner-api-key.js (interoperability exports) ───────────
  PARTNER_KEY_MISSING: {
    code: 'PARTNER_KEY_MISSING',
    httpStatus: 401,
    messageEn: 'Partner API key required',
    messageTh: 'ต้องระบุคีย์ API ของพาร์ทเนอร์',
    source: 'middleware/partner-api-key.js:58',
    remediation: 'Send your issued partner key in the X-Partner-Key header on interoperability/export endpoints.',
  },
  PARTNER_KEY_INVALID: {
    code: 'PARTNER_KEY_INVALID',
    httpStatus: 401,
    messageEn: 'Invalid partner API key',
    messageTh: 'คีย์ API ของพาร์ทเนอร์ไม่ถูกต้อง',
    source: 'middleware/partner-api-key.js:67',
    remediation: 'Verify the X-Partner-Key value matches your issued credential; rotate via the operator console if compromised.',
  },

  // ─────────── shared/errors.js AppError subclasses + branches ───────────
  AUTH_ERROR: {
    code: 'AUTH_ERROR',
    httpStatus: 401,
    messageEn: 'Authentication failed',
    messageTh: 'การยืนยันตัวตนล้มเหลว',
    source: 'shared/errors.js:38',
    remediation: 'Re-authenticate via /api/auth/login and retry with the fresh access token.',
  },
  AUTHORIZATION_ERROR: {
    code: 'AUTHORIZATION_ERROR',
    httpStatus: 403,
    messageEn: 'Insufficient permissions',
    messageTh: 'สิทธิ์ไม่เพียงพอ',
    source: 'shared/errors.js:48',
    remediation: 'Contact your tenant admin to grant the necessary role or capability.',
  },
  CONFLICT_ERROR: {
    code: 'CONFLICT_ERROR',
    httpStatus: 409,
    messageEn: 'Resource conflict',
    messageTh: 'ทรัพยากรขัดแย้งกัน',
    source: 'shared/errors.js:68',
    remediation: 'Re-fetch the latest resource state and reconcile your local copy before retrying.',
  },
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    httpStatus: 500,
    messageEn: 'Database operation failed',
    messageTh: 'การทำงานกับฐานข้อมูลล้มเหลว',
    source: 'shared/errors.js:79',
    remediation: 'Retry with exponential backoff. Persistent failures should be escalated to platform support.',
  },
  BUSINESS_LOGIC_ERROR: {
    code: 'BUSINESS_LOGIC_ERROR',
    httpStatus: 422,
    messageEn: 'Business rule violated',
    messageTh: 'ไม่เป็นไปตามกติกาทางธุรกิจ',
    source: 'shared/errors.js:89',
    remediation: 'Review error.details.rule for the specific business rule and adjust your request accordingly.',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    httpStatus: 500,
    messageEn: 'Internal server error',
    messageTh: 'ข้อผิดพลาดภายในระบบ',
    source: 'shared/errors.js:154',
    remediation: 'Capture the requestId from the response and report to platform support.',
  },
  ROUTE_NOT_FOUND: {
    code: 'ROUTE_NOT_FOUND',
    httpStatus: 404,
    messageEn: 'Route not found',
    messageTh: 'ไม่พบเส้นทาง API นี้',
    source: 'shared/errors.js:181',
    remediation: 'Verify the URL against the OpenAPI spec at /api-docs; consult docs/api/openapi.json.',
  },
  METHOD_NOT_ALLOWED: {
    code: 'METHOD_NOT_ALLOWED',
    httpStatus: 405,
    messageEn: 'Method not allowed',
    messageTh: 'ปลายทางนี้ไม่รองรับวิธีที่เรียกมา',
    source: 'middleware/api-not-found.js:97',
    // The response carries an `Allow` header and an `allow` array naming the
    // verbs the path does answer, so the caller does not have to guess which
    // half of the request was wrong — the path or the verb.
    remediation: 'Read the Allow header on the response; re-send with one of the methods it lists.',
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    httpStatus: 401,
    messageEn: 'Invalid token',
    messageTh: 'โทเค็นไม่ถูกต้อง',
    source: 'middleware/auth-middleware.js:369',
    remediation: 'Token is malformed or signature invalid. Re-authenticate via /api/auth/login.',
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    httpStatus: 401,
    messageEn: 'Token expired',
    messageTh: 'โทเค็นหมดอายุ',
    source: 'middleware/auth-middleware.js:359',
    remediation: 'Use the refresh-token endpoint to mint a new access token, then retry.',
  },

  // ─────────── middleware/auth-middleware.js + adjacent ───────────
  NO_TOKEN: {
    code: 'NO_TOKEN',
    httpStatus: 401,
    messageEn: 'Missing authorization token',
    messageTh: 'ไม่มีโทเค็นการเข้าใช้',
    source: 'middleware/auth-middleware.js:287',
    remediation: 'Send Authorization: Bearer <token> header. Token obtained via /api/auth/login.',
  },
  NO_IDENTITY: {
    code: 'NO_IDENTITY',
    httpStatus: 401,
    messageEn: 'Authenticated request carries no user identity',
    messageTh: 'คำขอผ่านการยืนยันตัวตนแล้ว แต่ไม่พบรหัสผู้ใช้',
    source: 'routes/api/system/tickets.js:52',
    // Fail-closed marker. A handler that scopes rows to the caller cannot do so
    // without an id, and an absent id must DENY rather than fall through to an
    // unscoped query — an undefined value in a Prisma `where` is dropped, which
    // would widen the query to every row instead of narrowing it to none.
    remediation: 'The session token is missing its `id` claim. Re-authenticate; if it recurs, the token minter is not populating `id`.',
  },
  TOKEN_REVOKED: {
    code: 'TOKEN_REVOKED',
    httpStatus: 401,
    messageEn: 'Token has been revoked',
    messageTh: 'โทเค็นถูกเพิกถอน',
    source: 'middleware/auth-middleware.js:311',
    remediation: 'The token was revoked (logout or admin action). Re-authenticate to obtain a new token.',
  },
  TOKEN_PAYLOAD_INVALID: {
    code: 'TOKEN_PAYLOAD_INVALID',
    httpStatus: 401,
    messageEn: 'Token payload is invalid',
    messageTh: 'ข้อมูลในโทเค็นไม่ถูกต้อง',
    source: 'middleware/auth-middleware.js:327',
    remediation: 'Token is corrupted or generated by a different platform key. Re-authenticate.',
  },
  TOKEN_NO_JTI: {
    code: 'TOKEN_NO_JTI',
    httpStatus: 401,
    messageEn: 'Token is missing a JTI claim',
    messageTh: 'โทเค็นไม่มีตัวระบุที่จำเป็น',
    source: 'middleware/auth-middleware.js:25',
    remediation: 'Token was issued by an outdated client. Re-authenticate to receive a JTI-bearing token.',
  },
  IDENTITY_UNVERIFIED: {
    code: 'IDENTITY_UNVERIFIED',
    httpStatus: 401,
    messageEn: 'Session could not be verified right now (transient). Please retry.',
    messageTh: 'ไม่สามารถยืนยันเซสชันได้ชั่วคราว กรุณาลองใหม่',
    source: 'middleware/auth-middleware.js:270',
    remediation: 'C4: a privileged provider identity/epoch read failed (DB blip) — the provider has no /refresh backstop so this fails CLOSED. Retry the request once the datastore recovers.',
  },
  MFA_CHALLENGE_BINDING_MISMATCH: {
    code: 'MFA_CHALLENGE_BINDING_MISMATCH',
    httpStatus: 401,
    messageEn: 'MFA session does not match this device or network',
    messageTh: 'เซสชัน MFA ไม่ตรงกับอุปกรณ์หรือเครือข่ายนี้',
    source: 'routes/api/identity/mfa.js:277',
    remediation: 'The MFA challenge is being completed from a different IP/User-Agent than it was issued to (AUTH-5 anti-hijack). Log in again from the original device/network.',
  },
  AUTH_FAILED: {
    code: 'AUTH_FAILED',
    httpStatus: 401,
    messageEn: 'Authentication failed',
    messageTh: 'การยืนยันตัวตนล้มเหลว',
    source: 'middleware/auth-middleware.js:377',
    remediation: 'Inspect Authorization header and access-token blocklist. Re-authenticate if uncertain.',
  },
  INVALID_ROLE: {
    code: 'INVALID_ROLE',
    httpStatus: 403,
    messageEn: 'User role is not permitted for this operation',
    messageTh: 'บทบาทผู้ใช้งานไม่มีสิทธิ์ใช้คำสั่งนี้',
    source: 'middleware/auth-middleware.js:451',
    remediation: 'Check the role assignment for your user; contact tenant admin for role escalation if required.',
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    httpStatus: 429,
    messageEn: 'Too many requests — rate limit exceeded',
    messageTh: 'ส่งคำขอบ่อยเกินไป',
    source: 'middleware/auth-middleware.js:688',
    remediation: 'Wait the period indicated by Retry-After header before retrying. Implement exponential backoff.',
  },
  VERIFICATION_REQUIRED: {
    code: 'VERIFICATION_REQUIRED',
    httpStatus: 403,
    messageEn: 'Account requires verification before this action',
    messageTh: 'บัญชีต้องผ่านการยืนยันก่อนใช้งาน',
    source: 'middleware/auth-middleware.js:641',
    remediation: 'Complete the identity-verification flow before retrying.',
  },
  ACTIVE_ENTITY_MISMATCH: {
    code: 'ACTIVE_ENTITY_MISMATCH',
    httpStatus: 403,
    messageEn: 'Active entity context does not match request',
    messageTh: 'บริบทผู้ใช้ปัจจุบันไม่ตรงกับคำขอ',
    source: 'middleware/active-entity-middleware.js:99',
    remediation: 'Switch active entity via /api/entities/{id}/activate before issuing tenant-bound calls.',
  },
  TENANT_CONTEXT_FAILED: {
    code: 'TENANT_CONTEXT_FAILED',
    httpStatus: 500,
    messageEn: 'Failed to resolve tenant context for request',
    messageTh: 'ไม่สามารถระบุบริบทเทแนนต์ของคำขอได้',
    source: 'middleware/tenant-context-middleware.js:77',
    remediation: 'Verify that the user is associated with at least one active entity; re-authenticate if uncertain.',
  },
  CROSS_TENANT_WRITE: {
    code: 'CROSS_TENANT_WRITE',
    httpStatus: 403,
    messageEn: 'Cross-tenant write is forbidden',
    messageTh: 'ห้ามเขียนข้อมูลข้ามเทแนนต์',
    source: 'services/tenant-prisma-extension.js:161',
    remediation: 'Operate only on resources owned by the current active entity.',
  },

  // ─────────── routes/api/auth/auth-provider.js ───────────
  ACCOUNT_INACTIVE: {
    code: 'ACCOUNT_INACTIVE',
    httpStatus: 403,
    messageEn: 'Account is inactive',
    messageTh: 'บัญชีถูกระงับการใช้งาน',
    source: 'routes/api/auth/auth-provider.js:106',
    remediation: 'Contact tenant admin to reactivate the account before logging in.',
  },
  SESSION_REVOKED: {
    code: 'SESSION_REVOKED',
    httpStatus: 401,
    messageEn: 'Session was revoked (password/role change) — please log in again',
    messageTh: 'เซสชันถูกเพิกถอน (เปลี่ยนรหัสผ่าน/สิทธิ์) กรุณาเข้าสู่ระบบใหม่',
    source: 'routes/api/auth/auth-provider.js:416',
    remediation: 'Log in again to mint a fresh token whose iat is after the session-epoch stamp.',
  },
  INVALID_ACCOUNT_TYPE: {
    code: 'INVALID_ACCOUNT_TYPE',
    httpStatus: 403,
    messageEn: 'Account type not permitted on this provider route',
    messageTh: 'ประเภทบัญชีไม่ได้รับอนุญาตให้เข้าสู่ระบบทางช่องนี้',
    source: 'routes/api/auth/auth-provider.js:96',
    remediation: 'Health users must use /api/auth/health/login; provider users must use /api/auth/provider/login.',
  },
  INVALID_PASSWORD: {
    code: 'INVALID_PASSWORD',
    httpStatus: 401,
    messageEn: 'Invalid password',
    messageTh: 'รหัสผ่านไม่ถูกต้อง',
    source: 'routes/api/auth/auth-provider.js:117',
    remediation: 'Verify the password; multiple failures trigger RATE_LIMIT_EXCEEDED. Reset via /api/auth/forgot-password.',
  },
  INVALID_PROVIDER_ID: {
    code: 'INVALID_PROVIDER_ID',
    httpStatus: 400,
    messageEn: 'Provider identifier is invalid',
    messageTh: 'รหัสประจำตัวผู้ให้บริการไม่ถูกต้อง',
    source: 'routes/api/auth/auth-provider.js:48',
    remediation: 'Verify the provider ID format matches the documented schema (UPPER_SNAKE).',
  },
  INVALID_PROVIDER_ROLE: {
    code: 'INVALID_PROVIDER_ROLE',
    httpStatus: 403,
    messageEn: 'Provider role is not allowed for this login surface',
    messageTh: 'บทบาทผู้ให้บริการไม่ตรงกับช่องทางเข้าใช้',
    source: 'routes/api/auth/auth-provider.js:78',
    remediation: 'Use the correct provider-role login endpoint (reviewer / scheduler / auditor / accounting).',
  },
  IDENTITY_CONFLICT: {
    code: 'IDENTITY_CONFLICT',
    httpStatus: 409,
    messageEn: 'Identity already linked to a different user',
    messageTh: 'รหัสนี้ถูกผูกกับผู้ใช้รายอื่นแล้ว',
    source: 'routes/api/auth/auth-provider.js:87',
    remediation: 'Confirm identity attribution with platform support; cannot self-merge identities via API.',
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    httpStatus: 401,
    messageEn: 'No user matches the given identifier',
    messageTh: 'ไม่พบบัญชีตามข้อมูลที่ระบุ',
    source: 'routes/api/auth/auth-provider.js:68',
    remediation: 'Verify the identifier; register via /api/auth/register if the user does not exist yet.',
  },
  SERVER_ERROR: {
    code: 'SERVER_ERROR',
    httpStatus: 500,
    messageEn: 'Unexpected server error during authentication',
    messageTh: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์ขณะตรวจสอบสิทธิ์',
    source: 'routes/api/auth/auth-provider.js:215',
    remediation: 'Retry with exponential backoff; report persistent failures with the requestId.',
  },
  TOKEN_INVALID: {
    code: 'TOKEN_INVALID',
    httpStatus: 401,
    messageEn: 'Refresh token is invalid',
    messageTh: 'รีเฟรชโทเค็นไม่ถูกต้อง',
    source: 'routes/api/auth/auth-provider.js:304',
    remediation: 'Re-authenticate to obtain a fresh refresh-token pair.',
  },
  TOKEN_MISSING: {
    code: 'TOKEN_MISSING',
    httpStatus: 401,
    messageEn: 'Refresh token is missing in the request',
    messageTh: 'ไม่พบรีเฟรชโทเค็นในคำขอ',
    source: 'routes/api/auth/auth-provider.js:245',
    remediation: 'Include the refreshToken in the request body or as an httpOnly cookie.',
  },

  // ─────────── routes/api/applications ───────────
  REVIEW_SLOT_NOT_ATTACHED: {
    code: 'REVIEW_SLOT_NOT_ATTACHED',
    httpStatus: 422,
    messageEn: 'A slot with no attached document cannot be accepted',
    messageTh: 'ยังไม่มีเอกสารในรายการนี้ให้ตรวจ จึงรับไม่ได้ หากต้องการให้ผู้ยื่นส่งเพิ่ม ให้เลือก "ขอเอกสารเพิ่ม"',
    source: 'services/application-document-review-service.js:106',
    remediation: 'Accepting a paper that was never uploaded is a false entry in the audit trail, and ACCEPT_ALL reads those entries: accept an empty REQUIRED slot and the filing clears document review with the paper still missing. Requesting more on an empty slot stays allowed — that is what the button is for.',
  },
  REVIEW_REASON_REQUIRED: {
    code: 'REVIEW_REASON_REQUIRED',
    httpStatus: 422,
    messageEn: 'A reason is required when requesting more documents',
    messageTh: 'กรุณาระบุเหตุผลที่ขอเอกสารเพิ่ม เพื่อให้ผู้ยื่นทราบว่าต้องแก้ไขอะไร',
    source: 'services/application-document-review-service.js:79',
    remediation: 'A request the applicant cannot act on is a rejection wearing the wrong name. Ten characters is the floor, not the target: "ไม่ชัด" tells them nothing, and they will re-upload the same paper.',
  },
  REVIEW_DUE_DATE_INVALID: {
    code: 'REVIEW_DUE_DATE_INVALID',
    httpStatus: 422,
    messageEn: 'The due date must be a working day',
    messageTh: 'วันครบกำหนดต้องเป็นวันทำการ กรุณาเลือกวันอื่น',
    source: 'services/application-document-review-service.js:96',
    remediation: 'utils/working-days.js owns the calendar — weekends and Thai public holidays. A deadline the applicant cannot act on is unfair from the moment it is set, and the officer rarely means it.',
  },
  REVISION_INCOMPLETE: {
    code: 'REVISION_INCOMPLETE',
    httpStatus: 409,
    messageEn: 'Some requested documents have not been replaced yet',
    messageTh: 'ยังมีเอกสารที่ยังไม่ได้อัปโหลดฉบับใหม่ กรุณาอัปโหลดให้ครบก่อนส่งกลับให้เจ้าหน้าที่',
    source: 'services/application-document-review-service.js:200',
    remediation: 'The test is not "is a file attached" — one WAS attached when the officer refused it — but "is it NEWER than the request". A filing returned with the same scan is a round trip that teaches the applicant nothing and costs the officer a second reading. The refusal carries slotIds so the screen can highlight the outstanding rows.',
  },
  REVISION_RESUBMIT_WRONG_STATE: {
    code: 'REVISION_RESUBMIT_WRONG_STATE',
    httpStatus: 409,
    messageEn: 'The filing is not awaiting a document revision',
    messageTh: 'คำขอนี้ไม่ได้อยู่ในสถานะรอแก้ไขเอกสาร จึงส่งกลับให้เจ้าหน้าที่ไม่ได้',
    source: 'routes/api/applications/revision-resubmit.js:96',
    remediation: 'ALLOWED_TRANSITIONS has REVISION_REQUESTED → ASSIGNED_FOR_REVIEW and nothing else from here. Checked BEFORE the document rule so someone on the wrong screen hears that, rather than a list of papers unrelated to their problem.',
  },
  REVISION_RESUBMIT_FAILED: {
    code: 'REVISION_RESUBMIT_FAILED',
    httpStatus: 500,
    messageEn: 'The revision resubmit surface failed unexpectedly',
    messageTh: 'ระบบส่งคำขอกลับให้เจ้าหน้าที่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    source: 'routes/api/applications/revision-resubmit.js:76',
    remediation: 'The catch-all for anything this door does not model; the cause is in the [revision-resubmit] log line beside it.',
  },
  DOCUMENT_DECISION_WRONG_STATE: {
    code: 'DOCUMENT_DECISION_WRONG_STATE',
    httpStatus: 409,
    messageEn: 'The filing is not in the document-review stage',
    messageTh: 'คำขอนี้ไม่ได้อยู่ในขั้นตรวจเอกสาร จึงตัดสินผลการตรวจไม่ได้',
    source: 'routes/api/provider/document-reviews.js:265',
    remediation: 'ALLOWED_TRANSITIONS only has ASSIGNED_FOR_REVIEW → DOC_APPROVED | REVISION_REQUESTED. A decision from any other state is an edge the state machine does not have; refusing here keeps the writer from being asked to record one.',
  },
  DOCUMENT_CHECK_INCOMPLETE: {
    code: 'DOCUMENT_CHECK_INCOMPLETE',
    httpStatus: 409,
    messageEn: 'Required documents have not all been accepted',
    messageTh: 'ยังมีเอกสารที่จำเป็นซึ่งยังไม่ได้รับ กรุณาตรวจให้ครบก่อนรับคำขอ',
    source: 'services/application-document-review-service.js:136',
    remediation: 'An officer may not accept a filing the requirement register says is incomplete. The refusal carries slotIds so the screen can point at the rows rather than making the officer re-read every line. OPTIONAL slots never block.',
  },
  DOCUMENT_CHECK_NOTHING_REQUESTED: {
    code: 'DOCUMENT_CHECK_NOTHING_REQUESTED',
    httpStatus: 409,
    messageEn: 'No document was marked as requested',
    messageTh: 'ยังไม่ได้เลือกเอกสารที่ต้องการเพิ่ม กรุณาระบุอย่างน้อยหนึ่งรายการ',
    source: 'services/application-document-review-service.js:157',
    remediation: 'Sending an applicant back with an empty list costs them a round trip and tells them nothing. Mark at least one slot MORE_REQUESTED first.',
  },
  DOCUMENT_REVIEW_FAILED: {
    code: 'DOCUMENT_REVIEW_FAILED',
    httpStatus: 500,
    messageEn: 'The document review surface failed unexpectedly',
    messageTh: 'ระบบตรวจเอกสารทำงานผิดพลาด กรุณาแจ้งผู้ดูแลระบบ',
    source: 'routes/api/provider/document-reviews.js:88',
    remediation: 'The catch-all for anything the door does not model. It carries no detail on purpose; the cause is in the [document-review] log line beside it.',
  },
  DECLARATIONS_REQUIRED: {
    code: 'DECLARATIONS_REQUIRED',
    httpStatus: 422,
    messageEn: 'The ส่วนที่ ๔ declarations must be accepted before submitting',
    messageTh: 'กรุณายืนยันคำรับรองทั้ง 5 ข้อและการยินยอมเปิดเผยข้อมูลก่อนยื่นคำขอ',
    source: 'services/application-declarations-gate.js:52',
    remediation: 'กทล.๑ ส่วนที่ ๔ is where the applicant certifies the filing is true and consents to inspection — the part an inspector, and later a revocation, rest on. The client may only say "accepted"; the server writes declarationsAcceptedAt itself, because a timestamp the browser supplied is evidence of nothing. A correction resubmit stands on the acceptance already recorded and is not asked again.',
  },
  HEALTH_ROLE_REQUIRED: {
    code: 'HEALTH_ROLE_REQUIRED',
    httpStatus: 403,
    messageEn: 'This action requires a health (applicant) role',
    messageTh: 'การกระทำนี้ต้องมีบทบาทเป็นผู้สมัคร (Health)',
    source: 'routes/api/applications/applications.js:89',
    remediation: 'Login through /api/auth/health/login or have an admin assign the health role.',
  },
  // X1-FIX-A / C-5: provider-branch RBAC gate on
  // `GET /api/applications/` for callers without a healthId.
  // See: docs/handoffs/iter-X1/X1-D.md §4 H-2.
  PROVIDER_ROLE_REQUIRED: {
    code: 'PROVIDER_ROLE_REQUIRED',
    httpStatus: 403,
    messageEn: 'This action requires a provider role',
    messageTh: 'การกระทำนี้ต้องมีบทบาทเจ้าหน้าที่ (Provider)',
    source: 'routes/api/applications/application-listing-handlers.js:71',
    remediation: 'Login through /api/auth/provider/login or have an admin assign a provider role.',
  },
  CAPABILITY_DENIED: {
    code: 'CAPABILITY_DENIED',
    httpStatus: 403,
    messageEn: 'Capability denied for current role',
    messageTh: 'ไม่ได้รับสิทธิ์ดำเนินการนี้สำหรับบทบาทปัจจุบัน',
    source: 'routes/api/applications/applications.js:477',
    remediation: 'Check `apps/backend/shared/canonical-rbac.js` capability matrix; request role escalation if needed.',
  },

  // ─────────── routes/api/admin/user-permissions.js (per-user grants) ───────────
  INVALID_PERMISSION: {
    code: 'INVALID_PERMISSION',
    httpStatus: 400,
    messageEn: 'Permission is not one of the canonical PERMISSIONS values',
    messageTh: 'สิทธิ์ที่ระบุไม่อยู่ในรายการสิทธิ์ที่รองรับ',
    source: 'routes/api/admin/user-permissions.js:189',
    remediation: 'Use a permission key from GET /api/admin/user-permissions/:userId `catalog[].key`.',
  },
  SELF_PERMISSION_CHANGE_FORBIDDEN: {
    code: 'SELF_PERMISSION_CHANGE_FORBIDDEN',
    httpStatus: 403,
    messageEn: 'An admin cannot change their own per-user permission grants',
    messageTh: 'ผู้ดูแลระบบไม่สามารถแก้ไขสิทธิ์ของตนเองได้',
    source: 'routes/api/admin/user-permissions.js:213',
    remediation: 'Have a different admin adjust your grants — self-escalation / self-lockout is blocked.',
  },
  ENTITY_PERMISSION_DENIED: {
    code: 'ENTITY_PERMISSION_DENIED',
    httpStatus: 403,
    messageEn: 'Workspace member lacks the required farm-operation permission',
    messageTh: 'สมาชิกพื้นที่ทำงานไม่มีสิทธิ์ดำเนินการรายการนี้',
    source: 'services/entity-effective-permissions-service.js:251',
    remediation: 'Ask the workspace OWNER to grant the permission named in the response body (PUT /api/entities/:id/members/:userId/permissions).',
  },

  // ─────────── routes/api/entities ───────────
  CANNOT_REVOKE_OWNER: {
    code: 'CANNOT_REVOKE_OWNER',
    httpStatus: 409,
    messageEn: 'Cannot revoke the workspace owner',
    messageTh: 'ห้ามถอนสิทธิ์ของเจ้าของเวิร์กสเปซ',
    source: 'routes/api/entities/index.js:461',
    remediation: 'Transfer ownership to another member before revoking.',
  },
  CANNOT_DEMOTE_OWNER: {
    code: 'CANNOT_DEMOTE_OWNER',
    httpStatus: 409,
    messageEn: 'Cannot change the workspace owner\'s role',
    messageTh: 'ห้ามเปลี่ยนบทบาทของเจ้าของเวิร์กสเปซ',
    source: 'routes/api/entities/index.js:474',
    remediation: 'Transfer ownership to another member before changing this role.',
  },
  UNSAFE_FILENAME: {
    code: 'UNSAFE_FILENAME',
    httpStatus: 400,
    messageEn: 'Filename must be a bare name with no path component',
    messageTh: 'ชื่อไฟล์ต้องไม่มีส่วนของพาธ',
    source: 'shared/safe-path.js:71',
    remediation: 'Pass only the stored filename. Directory components and ".." are rejected, never rewritten.',
  },
  SAME_USER: {
    code: 'SAME_USER',
    httpStatus: 400,
    messageEn: 'Cannot invite or assign the same user as yourself',
    messageTh: 'ไม่สามารถดำเนินการกับผู้ใช้คนเดียวกันได้',
    source: 'routes/api/entities/index.js:507',
    remediation: 'Choose a different target user.',
  },

  // ─────────── services/entity-service.js ───────────
  APPLICANT_VALIDATION_FAILED: {
    code: 'APPLICANT_VALIDATION_FAILED',
    httpStatus: 400,
    messageEn: 'Applicant identity validation failed',
    messageTh: 'ตรวจสอบข้อมูลผู้สมัครไม่ผ่าน',
    source: 'services/entity-service.js:983',
    remediation: 'Cross-check applicant data against the national-ID source-of-truth and resubmit.',
  },
  INVALID_INVITE_CHANNEL: {
    code: 'INVALID_INVITE_CHANNEL',
    httpStatus: 400,
    messageEn: 'Invitation channel is not supported',
    messageTh: 'ช่องทางการเชิญไม่รองรับ',
    source: 'services/entity-service.js:1253',
    remediation: 'Use a supported invite channel (email or phone) per the documented enum.',
  },
  INVALID_WORKSPACE_TYPE: {
    code: 'INVALID_WORKSPACE_TYPE',
    httpStatus: 400,
    messageEn: 'Workspace type is invalid',
    messageTh: 'ประเภทเวิร์กสเปซไม่ถูกต้อง',
    source: 'services/entity-service.js:1196',
    remediation: 'Verify the workspace type against the entity-type enum (INDIVIDUAL / JURISTIC / COMMUNITY_ENTERPRISE).',
  },
  NOT_INVITED: {
    code: 'NOT_INVITED',
    httpStatus: 404,
    messageEn: 'No pending invitation for this user',
    messageTh: 'ไม่พบคำเชิญที่รอตอบ',
    source: 'services/entity-service.js:418',
    remediation: 'Confirm the invitation was sent; ask owner to re-issue.',
  },
  NOT_OWNER: {
    code: 'NOT_OWNER',
    httpStatus: 403,
    messageEn: 'Operation requires workspace ownership',
    messageTh: 'คำสั่งนี้ต้องใช้สิทธิ์เจ้าของเวิร์กสเปซ',
    source: 'services/entity-service.js:606',
    remediation: 'Only the workspace owner can perform this action.',
  },
  NOT_PENDING: {
    code: 'NOT_PENDING',
    httpStatus: 409,
    messageEn: 'Invitation is not in a pending state',
    messageTh: 'คำเชิญไม่ได้อยู่ในสถานะรอตอบ',
    source: 'services/entity-service.js:423',
    remediation: 'Re-fetch the invitation state and act on the actual current status.',
  },
  TARGET_ALREADY_OWNER: {
    code: 'TARGET_ALREADY_OWNER',
    httpStatus: 409,
    messageEn: 'Target user is already the owner',
    messageTh: 'ผู้รับโอนเป็นเจ้าของอยู่แล้ว',
    source: 'services/entity-service.js:626',
    remediation: 'No transfer needed; the user already owns the workspace.',
  },
  TARGET_NOT_MEMBER: {
    code: 'TARGET_NOT_MEMBER',
    httpStatus: 404,
    messageEn: 'Target user is not a workspace member',
    messageTh: 'ผู้รับโอนยังไม่ได้เป็นสมาชิกเวิร์กสเปซ',
    source: 'services/entity-service.js:619',
    remediation: 'Invite the target user to the workspace before transferring ownership.',
  },

  // ─────────── services/period-close-service.js (R1) ───────────
  ALREADY_CLOSED: {
    code: 'ALREADY_CLOSED',
    httpStatus: 409,
    messageEn: 'Accounting period is already closed',
    messageTh: 'งวดบัญชีนี้ถูกปิดแล้ว',
    source: 'services/period-close-service.js:256',
    remediation: 'No action required, or request a re-open via finance manager.',
  },

  // ─────────── services/journal-entry-service.js + manual-journal-entry-service.js ───────────
  DB_UNAVAILABLE: {
    code: 'DB_UNAVAILABLE',
    httpStatus: 503,
    messageEn: 'Database is currently unavailable',
    messageTh: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้',
    source: 'services/manual-journal-entry-service.js:263',
    remediation: 'Retry with exponential backoff; check database health endpoint for status.',
  },
  INVALID_STATE: {
    code: 'INVALID_STATE',
    httpStatus: 409,
    messageEn: 'Resource is not in a state that permits this action',
    messageTh: 'สถานะรายการไม่อนุญาตให้ดำเนินการนี้',
    source: 'services/manual-journal-entry-service.js:324',
    remediation: 'Re-fetch the resource state and call the operation appropriate for its current status.',
  },


  // ─────────── services/purchase-invoice-service.js ───────────
  INVALID_STATUS: {
    code: 'INVALID_STATUS',
    httpStatus: 409,
    messageEn: 'Status transition not allowed from current state',
    messageTh: 'สถานะปัจจุบันไม่อนุญาตให้เปลี่ยนเป็นสถานะใหม่',
    source: 'services/purchase-invoice-service.js:792',
    remediation: 'Refer to the state-machine diagram in docs/api/purchase-invoice.md.',
  },

  // ─────────── services/credit-note-service.js + debit-note-service.js + refund-service.js ───────────
  INVALID_TRANSITION: {
    code: 'INVALID_TRANSITION',
    httpStatus: 409,
    messageEn: 'Credit/debit note status transition not allowed',
    messageTh: 'การเปลี่ยนสถานะไม่ถูกต้อง',
    source: 'services/credit-note-service.js:425',
    remediation: 'See state-machine for credit-note in docs/api/credit-note.md.',
  },


  // ─────────── services/quotation-service.js + receipt-numbering-service.js (R5) ───────────
  APPLICATION_NOT_FOUND: {
    code: 'APPLICATION_NOT_FOUND',
    httpStatus: 404,
    messageEn: 'Application not found',
    messageTh: 'ไม่พบใบสมัคร',
    source: 'services/quotation-service.js:307',
    remediation: 'Verify the applicationId under the current tenant.',
  },
  // ── PDPA ม.30 disclosure (F-TNT-M30-01, 2026-09-06) ────────────────────────
  // The applicant's right to read an auditor's notes about them, and the one
  // exception ม.30 วรรคสอง allows. Every one of these reaches a person, so each
  // carries the Thai sentence rather than leaving the surface to invent one.
  DISCLOSURE_STATE_REQUIRED: {
    code: 'DISCLOSURE_STATE_REQUIRED',
    httpStatus: 422,
    messageEn: 'The disclosure call must state withheld true or false — it is not a toggle',
    messageTh: 'ต้องระบุว่าจะไม่เปิดเผย (true) หรือเปิดเผย (false) — ไม่ใช่การสลับสถานะ',
    source: 'routes/api/audit/onsite.js:851',
    remediation: 'Send an explicit boolean `withheld`, so a repeated call cannot flip a lawful refusal into a disclosure nobody decided.',
  },
  WITHHOLD_REASON_REQUIRED: {
    code: 'WITHHOLD_REASON_REQUIRED',
    httpStatus: 422,
    messageEn: 'Withholding an auditor note requires a recorded reason under PDPA s.30 para 2',
    messageTh: 'การไม่เปิดเผยบันทึกต้องระบุเหตุผลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล มาตรา 30 วรรคสอง',
    source: 'services/audit-notes-disclosure.js:145',
    remediation: 'Write a reason the applicant can read; a refusal nobody has to justify is not a lawful refusal.',
  },
  CHECKLIST_ITEM_NOT_FOUND: {
    code: 'CHECKLIST_ITEM_NOT_FOUND',
    httpStatus: 404,
    messageEn: 'Checklist item not found',
    messageTh: 'ไม่พบรายการตรวจนี้',
    source: 'services/audit-notes-disclosure.js:125',
    remediation: 'Verify the checklist item id belongs to the audit named in the path.',
  },
  AUDIT_NOTES_UNAVAILABLE: {
    code: 'AUDIT_NOTES_UNAVAILABLE',
    httpStatus: 500,
    messageEn: 'The auditor notes could not be read',
    messageTh: 'เปิดบันทึกของผู้ตรวจไม่ได้ กรุณาลองใหม่อีกครั้ง',
    source: 'routes/api/applications/audit-notes.js:50',
    remediation: 'Check the server log; the access right must not fail silently.',
  },
  DISCLOSURE_UPDATE_FAILED: {
    code: 'DISCLOSURE_UPDATE_FAILED',
    httpStatus: 500,
    messageEn: 'The disclosure setting could not be saved',
    messageTh: 'บันทึกการตั้งค่าการเปิดเผยไม่สำเร็จ',
    source: 'routes/api/audit/onsite.js:876',
    remediation: 'Check the server log; the note keeps its previous disclosure state.',
  },
  APPLICATION_INCOMPLETE: {
    code: 'APPLICATION_INCOMPLETE',
    httpStatus: 422,
    messageEn: 'The application is missing required documents or fields for submission',
    messageTh: 'คำขอยังมีเอกสารหรือข้อมูลบังคับไม่ครบสำหรับการยื่น',
    source: 'services/application-document-requirements.js:72',
    remediation: 'Attach every required document listed in missingSlots for the applicant type, then submit again.',
  },
  APPLICATION_NOT_JUDGEABLE: {
    code: 'APPLICATION_NOT_JUDGEABLE',
    httpStatus: 422,
    messageEn: 'No filed requirement law reaches this application, so its documents cannot be judged',
    messageTh: 'ยังไม่สามารถตรวจสอบเอกสารของคำขอนี้ได้ กรุณาตรวจสอบข้อมูลคำขอแล้วลองใหม่อีกครั้ง',
    source: 'services/application-document-requirements.js:67',
    remediation: 'Not a missing-document error and must not be reported as one: the filing names no plant the platform recognises, or names one the requirement register holds no open rules for. The refusal carries blockingIssues[] with its own Thai sentence and the open plant codes. Fix by naming a plant that has law filed, or by filing that plant\'s กทล.1 rules on the register.',
  },
  REQUIREMENTS_RESOLUTION_FAILED: {
    code: 'REQUIREMENTS_RESOLUTION_FAILED',
    httpStatus: 500,
    messageEn: 'The requirement engine refused a dimension derived from this application',
    messageTh: 'ระบบอ่านเงื่อนไขเอกสารของคำขอนี้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หากยังไม่ได้กรุณาแจ้งเจ้าหน้าที่',
    source: 'services/application-requirements-service.js:305',
    remediation: 'This is OUR defect, never the applicant\'s: the derivation layer let a word through that it should have mapped into the closed vocabulary or to null, and rulesAt refused it (INVALID_RULE_DIMENSION). The offending field and the whole derived dimension set are in the logged line; fix the mapping in deriveDimensions rather than widening the rule engine.',
  },
  STEP_PREREQUISITE_UNMET: {
    code: 'STEP_PREREQUISITE_UNMET',
    httpStatus: 422,
    messageEn: 'Data was sent for a wizard step whose earlier steps are not finished',
    messageTh: 'ส่งข้อมูลของขั้นตอนที่ยังกรอกขั้นตอนก่อนหน้าไม่ครบ',
    source: 'routes/api/applications/applications.js:299',
    remediation: 'The response carries `allowedStep`: send the applicant back to that step and finish it. This is the API side of the wizard URL-skip guard (F-G4-11) and its bar is validation/wizard-step-prerequisites.js, which is strictly looser than the submit-time completeness check.',
  },
  APPLICANT_ENTITY_MISSING: {
    code: 'APPLICANT_ENTITY_MISSING',
    httpStatus: 400,
    messageEn: 'No legal applicant (entity) is linked to this account, so an application cannot be created',
    messageTh: 'บัญชีนี้ยังไม่มีผู้ยื่นตามกฎหมาย (entity) จึงสร้างคำขอไม่ได้ กรุณาออกจากระบบแล้วเข้าใหม่ หากยังไม่หาย โปรดติดต่อผู้ดูแลระบบ',
    source: 'routes/api/applications/applications.js:279',
    remediation: 'Have the user re-open the workspace switcher: GET /api/entities/mine self-heals the personal INDIVIDUAL entity for any HEALTH account. For a batch of accounts use scripts/backfill-entities.js. Do NOT re-run the seed as a fix — it reloads fixtures unrelated to this account.',
  },
  APPLICATION_NOT_EDITABLE: {
    code: 'APPLICATION_NOT_EDITABLE',
    httpStatus: 409,
    messageEn: 'This application is no longer editable in its current status',
    messageTh: 'ใบสมัครนี้ไม่สามารถแก้ไขได้ในสถานะปัจจุบัน',
    source: 'routes/api/applications/applications.js:195',
    remediation: 'Only DRAFT / REGISTERED / REVISION_REQUESTED / CAR_PENDING applications can be edited by the applicant.',
  },

  // ─────────── services/payment-slip-service.js ───────────
  INVALID_REVIEWER_SIDE: {
    code: 'INVALID_REVIEWER_SIDE',
    httpStatus: 403,
    messageEn: 'Reviewer side is not permitted for this slip',
    messageTh: 'ฝ่ายผู้ตรวจสอบไม่ตรงกับสลิปนี้',
    source: 'services/payment-slip-service.js:757',
    remediation: 'Cross-side review is forbidden; only the matching side may decide.',
  },

  // ─────────── services/audit-onsite-service.js + audit-scheduling-service.js (V3) ───────────
  AUDIT_NOT_FOUND: {
    code: 'AUDIT_NOT_FOUND',
    httpStatus: 404,
    messageEn: 'Audit not found',
    messageTh: 'ไม่พบบันทึกการตรวจสอบ',
    source: 'routes/api/audit/onsite.js:134',
    remediation: 'Verify the audit ID for the current tenant.',
  },
  AUDIT_AUDITOR_MISMATCH: {
    code: 'AUDIT_AUDITOR_MISMATCH',
    httpStatus: 403,
    messageEn: 'Audit is assigned to a different auditor',
    messageTh: 'ผู้ตรวจสอบไม่ใช่ผู้ที่ได้รับมอบหมาย',
    source: 'routes/api/audit/onsite.js:149',
    remediation: 'Only the assigned auditor (or scheduler) may act on this audit.',
  },
  AUDIT_STATUS_INVALID: {
    code: 'AUDIT_STATUS_INVALID',
    httpStatus: 409,
    messageEn: 'Audit status does not permit this action',
    messageTh: 'สถานะการตรวจสอบไม่อนุญาตให้ดำเนินการ',
    source: 'services/audit-onsite-service.js:355',
    remediation: 'Re-fetch the audit; only certain status transitions are allowed (see V3 spec).',
  },
  CHECKLIST_ITEMS_REQUIRED: {
    code: 'CHECKLIST_ITEMS_REQUIRED',
    httpStatus: 400,
    messageEn: 'Checklist items are required for this submission',
    messageTh: 'ต้องระบุรายการเช็คลิสต์',
    source: 'routes/api/audit/onsite.js:281',
    remediation: 'Supply at least one checklist item with status + evidence.',
  },
  CHECKLIST_ITEM_UNKNOWN: {
    code: 'CHECKLIST_ITEM_UNKNOWN',
    httpStatus: 400,
    messageEn: 'Checklist item references an unknown template question',
    messageTh: 'รายการเช็คลิสต์อ้างอิงคำถามที่ไม่รู้จัก',
    source: 'services/audit-onsite-service.js:504',
    remediation: 'Verify the checklist item question key matches the template version.',
  },
  PHOTO_FILE_REQUIRED: {
    code: 'PHOTO_FILE_REQUIRED',
    httpStatus: 400,
    messageEn: 'Photo file is required for this submission',
    messageTh: 'ต้องแนบไฟล์ภาพถ่าย',
    source: 'routes/api/audit/onsite.js:331',
    remediation: 'Include the photo file in multipart upload under the "photo" field.',
  },
  INSUFFICIENT_PHOTOS: {
    code: 'INSUFFICIENT_PHOTOS',
    httpStatus: 400,
    messageEn: 'Audit photo count is below the minimum',
    messageTh: 'จำนวนภาพถ่ายต่ำกว่ากำหนด',
    source: 'services/audit-onsite-service.js:728',
    remediation: 'Upload additional photos to meet the per-audit minimum (typically 3).',
  },
  INCOMPLETE_CHECKLIST: {
    code: 'INCOMPLETE_CHECKLIST',
    httpStatus: 400,
    messageEn: 'Checklist must be fully completed before submission',
    messageTh: 'ต้องตอบเช็คลิสต์ทุกข้อก่อนส่ง',
    source: 'services/audit-onsite-service.js:738',
    remediation: 'Answer every checklist question before invoking the submit endpoint.',
  },
  PRISMA_UNAVAILABLE: {
    code: 'PRISMA_UNAVAILABLE',
    httpStatus: 503,
    messageEn: 'Database client (Prisma) is unavailable',
    messageTh: 'ระบบฐานข้อมูลไม่พร้อมใช้งาน',
    source: 'routes/api/audit/onsite.js:113',
    remediation: 'Retry with backoff; check database service health.',
  },
  AUDITOR_BUSY: {
    code: 'AUDITOR_BUSY',
    httpStatus: 409,
    messageEn: 'Auditor has a conflicting booking on the requested slot',
    messageTh: 'ผู้ตรวจสอบมีตารางชนกันในช่วงเวลานี้',
    source: 'services/audit-scheduling-service.js:219',
    remediation: 'Choose a different slot or different auditor.',
  },
  AUDITOR_INVALID_ROLE: {
    code: 'AUDITOR_INVALID_ROLE',
    httpStatus: 400,
    messageEn: 'Selected user does not have an auditor role',
    messageTh: 'ผู้ใช้ที่เลือกไม่ใช่ผู้ตรวจสอบ',
    source: 'services/audit-scheduling-service.js:421',
    remediation: 'Choose a user whose canonicalRole is auditor.',
  },
  AUDITOR_NOT_FOUND: {
    code: 'AUDITOR_NOT_FOUND',
    httpStatus: 404,
    messageEn: 'Auditor not found',
    messageTh: 'ไม่พบผู้ตรวจสอบ',
    source: 'services/audit-scheduling-service.js:417',
    remediation: 'Verify the auditor ID; the user may be inactive or recently removed.',
  },
  AUDITOR_OVER_CAP: {
    code: 'AUDITOR_OVER_CAP',
    httpStatus: 409,
    messageEn: 'Auditor already at the daily booking cap',
    messageTh: 'ผู้ตรวจสอบรับงานครบจำนวนต่อวันแล้ว',
    source: 'services/audit-scheduling-service.js:200',
    remediation: 'Schedule on a different date or assign a different auditor.',
  },
  NON_WORKING_DAY: {
    code: 'NON_WORKING_DAY',
    httpStatus: 400,
    messageEn: 'Requested date is not a working day',
    messageTh: 'วันที่เลือกไม่ใช่วันทำงาน',
    source: 'services/audit-scheduling-service.js:365',
    remediation: 'Choose a date that is not a public holiday or weekend per DTAM calendar.',
  },
  FORBIDDEN_ROLE: {
    code: 'FORBIDDEN_ROLE',
    httpStatus: 403,
    messageEn: 'Role is forbidden from this scheduling action',
    messageTh: 'บทบาทผู้ใช้ไม่อนุญาตให้ดำเนินการจัดตาราง',
    source: 'services/audit-scheduling-service.js:99',
    remediation: 'Scheduler role required for booking; auditor for self-decision.',
  },
  FORBIDDEN_OWNER: {
    code: 'FORBIDDEN_OWNER',
    httpStatus: 403,
    messageEn: 'Only the booking owner may modify this booking',
    messageTh: 'เฉพาะผู้จองเท่านั้นที่แก้ไขรายการนี้ได้',
    source: 'services/audit-scheduling-service.js:572',
    remediation: 'Have the original scheduler perform the action.',
  },
  RESCHEDULE_NOT_FOUND: {
    code: 'RESCHEDULE_NOT_FOUND',
    httpStatus: 404,
    messageEn: 'Reschedule request not found',
    messageTh: 'ไม่พบคำขอเปลี่ยนตารางตรวจ',
    source: 'services/audit-scheduling-service.js:695',
    remediation: 'Verify the reschedule request ID.',
  },
  RESCHEDULE_NOT_PENDING: {
    code: 'RESCHEDULE_NOT_PENDING',
    httpStatus: 409,
    messageEn: 'Reschedule request is not pending',
    messageTh: 'คำขอเปลี่ยนตารางไม่ได้อยู่ในสถานะรอตอบ',
    source: 'services/audit-scheduling-service.js:698',
    remediation: 'Re-fetch the reschedule state; only PENDING requests can be decided.',
  },

  // ─────────── services/application-status-writer.js (WF-F7) ───────────
  CONCURRENCY_CONFLICT: {
    code: 'CONCURRENCY_CONFLICT',
    httpStatus: 409,
    messageEn: 'The application was modified by another writer; refetch and retry',
    messageTh: 'คำขอถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่แล้วลองอีกครั้ง',
    source: 'services/application-status-writer.js:246',
    remediation: 'WF-F7 optimistic lock: re-read Application.version and retry the transition.',
  },

  NON_CANONICAL_STATUS: {
    code: 'NON_CANONICAL_STATUS',
    httpStatus: 500,
    messageEn: 'Refused to write an application status that is not a canonical workflow state',
    messageTh: 'ไม่สามารถบันทึกสถานะคำขอที่ไม่ใช่สถานะมาตรฐานของระบบได้',
    source: 'services/application-status-writer.js:189',
    remediation: 'PR 2b vocabulary guard. The caller passed a legacy or unknown status '
      + '(e.g. PAYMENT_1_PAID). Write the canonical WORKFLOW_STATES value named in the '
      + 'error message instead; this is a code defect, not user input.',
  },

  // ─────────── services/correction-submission-version-service.js (R2 M7) ───────────
  CORRECTION_SUBMISSION_ALREADY_RECORDED: {
    code: 'CORRECTION_SUBMISSION_ALREADY_RECORDED',
    httpStatus: 409,
    messageEn: 'This correction round\'s submission was already recorded and cannot be overwritten',
    messageTh: 'บันทึกการยื่นแก้ไขของรอบนี้ไว้แล้ว ไม่สามารถเขียนทับได้',
    source: 'services/correction-submission-version-service.js:129',
    remediation: 'D-6 append-only: each (application, stage, round) has exactly one immutable '
      + 'submission row. The transaction is rolled back so the prior version is protected — the '
      + 'round advances via the M3 CorrectionRound ledger, it is never re-submitted in place.',
  },

  // ─────────── services/certificate-service.js + renewal-service.js ───────────
  CERT_REQUIRES_AUDIT_PASS: {
    code: 'CERT_REQUIRES_AUDIT_PASS',
    httpStatus: 409,
    messageEn: 'Certificate issuance requires a passed audit',
    messageTh: 'การออกใบรับรองต้องผ่านการตรวจสอบก่อน',
    source: 'services/certificate-service.js:133',
    remediation: 'Complete the on-site audit (status PASSED) before requesting the certificate.',
  },
  CERT_SIGNING_UNAVAILABLE: {
    code: 'CERT_SIGNING_UNAVAILABLE',
    httpStatus: 503,
    messageEn: 'The certificate signing key is unavailable; issuance was refused and nothing was changed',
    messageTh: 'ระบบลงลายมือชื่อดิจิทัลของใบรับรองไม่พร้อมใช้งาน จึงยังออกใบรับรองไม่ได้ ระบบไม่ได้บันทึกการเปลี่ยนแปลงใด ๆ กรุณาแจ้งผู้ดูแลระบบแล้วบันทึกผลการตรวจอีกครั้ง',
    source: 'services/certificate-service.js:1100',
    remediation: 'Fail-closed by design (Ruling 2, 2026-08-22): a GACP certificate without its PKI signature cannot be verified by a third party. Mount the signing key read-only, confirm SIGNING_KEY_FINGERPRINT matches, restart, and re-submit the audit result. Never bypass by issuing hash-only.',
  },
  CERTIFICATE_FARM_LOCATION_MISSING: {
    code: 'CERTIFICATE_FARM_LOCATION_MISSING',
    httpStatus: 422,
    messageEn: 'Certificate issuance was refused because the farm location is incomplete; the audit result was not saved and nothing was changed',
    messageTh: 'ไม่สามารถออกใบรับรองได้ เนื่องจากข้อมูลที่ตั้งฟาร์มไม่ครบถ้วน ระบบไม่ได้บันทึกการเปลี่ยนแปลงใด ๆ กรุณาแก้ไขข้อมูลที่ตั้งฟาร์มในคำขอให้ครบถ้วน แล้วบันทึกผลการตรวจอีกครั้ง',
    source: 'services/certificate-service.js:237',
    remediation: 'Fail-closed: a certificate is a government register, so a blank (or a retired stand-in such as Unknown, -, 00000) province/district/sub-district would be signed as fact. The refusal carries missingFields naming the blanks; the audit-result route forwards it. Complete the farm location on the application, then re-submit the audit result. The AUDIT_PASSED flip was rolled back in the same transaction.',
  },
  CERTIFICATE_HOLDER_MISMATCH: {
    code: 'CERTIFICATE_HOLDER_MISMATCH',
    httpStatus: 422,
    messageEn: 'Certificate issuance was refused because the application declares a juristic or community-enterprise applicant but was filed in a person\'s own name; nothing was changed',
    messageTh: 'ไม่สามารถออกใบรับรองได้ เนื่องจากคำขอระบุผู้ยื่นเป็นนิติบุคคลหรือวิสาหกิจชุมชน แต่ยื่นในนามบุคคล ผู้ถือใบรับรองต้องเป็นนิติบุคคลหรือวิสาหกิจชุมชนเอง กรุณาสร้างหรือสลับไปพื้นที่ทำงานนั้น แล้วยื่นคำขอในพื้นที่นั้น',
    source: 'services/certificate-service.js:2370',
    remediation: 'Operator ruling 2026-09-07 (F-HOLDER-01): a company or a community enterprise holds its own certificate, never the person who logged in. The filing declares its applicant type on the paper, but the identity the platform issues to is Application.entityId — and nothing forced the two to agree, so a company\'s certificate was recorded against an INDIVIDUAL with the submitter\'s name while the farm name on its face read as the company. Fail-closed rather than minting a legal identity on someone\'s behalf: create or switch to the juristic / community-enterprise workspace at /health/workspaces/new and file inside it, which makes app.entityId that entity. Certificates already issued under the old behaviour keep the holder they were signed with; correcting one is a revision decision.',
  },
  CERTIFICATE_FARM_NAME_MISSING: {
    code: 'CERTIFICATE_FARM_NAME_MISSING',
    httpStatus: 422,
    messageEn: 'Certificate issuance was refused because the application names no farm; nothing was changed',
    messageTh: 'ไม่สามารถออกใบรับรองได้ เนื่องจากคำขอไม่ได้ระบุชื่อฟาร์ม กรุณากรอกชื่อสถานที่ปลูกในคำขอให้ครบถ้วนก่อนออกใบรับรอง',
    source: 'services/certificate-service.js:290',
    remediation: 'Fail-closed, the same rule as the farm LOCATION refusal beside it (F-G4-52: no literal stand-ins). Until 2026-09-07 a nameless filing was minted a farm called \'Certified Farm\' — an English literal that then became the farm\'s name on the certificate, on both public scan pages and on the COA, for a farm nobody had given that name. Fill the site name on the application (step 3, ชื่อสถานที่ปลูก), then issue again. A farm row already carrying the retired literal is healed on its next issuance, and scripts/repair-platform-named-farms.js pays the debt for rows already certified.',
  },
  CERTIFICATE_PLANT_UNKNOWN: {
    code: 'CERTIFICATE_PLANT_UNKNOWN',
    httpStatus: 422,
    messageEn: 'Certificate issuance was refused because the application names a plant that is not in the plant master (or names none); nothing was changed',
    messageTh: 'ไม่สามารถออกใบรับรองได้ เนื่องจากชนิดพืชในคำขอไม่อยู่ในทะเบียนชนิดพืชของระบบ หรือคำขอไม่ได้ระบุชนิดพืช ระบบไม่ได้บันทึกการเปลี่ยนแปลงใด ๆ กรุณาเลือกชนิดพืชในคำขอจากรายการที่ระบบกำหนด แล้วบันทึกผลการตรวจอีกครั้ง',
    source: 'services/certificate-service.js:274',
    remediation: 'Fail-closed (F-G4-58): cropType is inside the signed canonical JSON, so it is resolved from the plant_species master (nameTH) through services/plant-species-service.js using formData.plantId (wizard slug) or a master code, never a literal. The refusal carries plantReference (the value the application held, or null). Set the plant on the application to one the master knows (config/plant-species-slugs.js lists the wizard slugs; prisma/seed-plants.js the codes), then re-submit the audit result or re-issue the revision. Both the issuance path and the revision door (preview + revise) refuse before any write.',
  },
  CERTIFICATE_ALREADY_REVOKED: {
    code: 'CERTIFICATE_ALREADY_REVOKED',
    httpStatus: 409,
    messageEn: 'This certificate is already revoked; the revocation record (who, when, why) was not overwritten',
    messageTh: 'ใบรับรองนี้ถูกเพิกถอนไปแล้ว คุณไม่ต้องเพิกถอนซ้ำ กรุณาโหลดหน้านี้ใหม่เพื่อดูสถานะล่าสุด',
    source: 'services/certificate-service.js:1620',
    remediation: 'The revocation record is the ISO/IEC 17065 §7.11 record of decision: revokeCertificate refuses a second press (pre-read after the org-guard, plus an atomic status notIn [revoked] write that maps Prisma P2025 to this code). The admin door POST /api/admin/certificates/:id/revoke answers 409 with this entry; reload the certificate to see the existing revokedAt/revokedBy/revokedReason.',
  },
  CERTIFICATE_NOT_REVISABLE: {
    code: 'CERTIFICATE_NOT_REVISABLE',
    httpStatus: 409,
    messageEn: 'Only a certificate in force (status active) can be revised; nothing was changed',
    messageTh: 'ออกฉบับแก้ไขได้เฉพาะใบรับรองที่ยังมีผลบังคับใช้เท่านั้น ใบนี้ถูกเพิกถอน ระงับ หรือหมดอายุแล้ว กรุณาตรวจสอบสถานะใบรับรองก่อน',
    source: 'services/certificate-service.js:1739',
    remediation: 'A revision corrects the register for a live certificate; a revoked/suspended/expired one keeps its history as is.',
  },
  CERTIFICATE_REVISION_NO_CHANGE: {
    code: 'CERTIFICATE_REVISION_NO_CHANGE',
    httpStatus: 409,
    messageEn: 'The farm record and the certificate already agree; there is nothing to revise',
    messageTh: 'ข้อมูลที่ตั้งบนใบรับรองตรงกับบันทึกฟาร์มอยู่แล้ว ไม่มีอะไรต้องแก้ไข หากบันทึกฟาร์มผิด กรุณาแก้ไขบันทึกฟาร์มก่อนแล้วลองใหม่',
    source: 'services/certificate-service.js:1809',
    remediation: 'The corrected values come from the Farm row only; fix the farm first.',
  },
  CERTIFICATE_REVISION_CONFLICT: {
    code: 'CERTIFICATE_REVISION_CONFLICT',
    httpStatus: 409,
    messageEn: 'Another revision of this certificate was recorded first; reload and review the current revision',
    messageTh: 'มีการออกฉบับแก้ไขของใบรับรองนี้ไปก่อนหน้าแล้ว กรุณาโหลดหน้านี้ใหม่เพื่อดูฉบับล่าสุดก่อนดำเนินการอีกครั้ง',
    source: 'services/certificate-service.js:1832',
    remediation: 'The conditional update on revisionNo lost a race, or the archive row for that number already existed (unique index); nothing was written by the loser.',
  },
  REVISION_REASON_REQUIRED: {
    code: 'REVISION_REASON_REQUIRED',
    httpStatus: 400,
    messageEn: 'A reason is required to issue a revision',
    messageTh: 'ระบบยังไม่ได้รับเหตุผลการออกฉบับแก้ไข กรุณาระบุเหตุผลก่อนที่คุณจะกดยืนยันอีกครั้ง',
    source: 'routes/api/admin/certificates.js:269',
    remediation: 'The reason is recorded on the archived revision (never shown publicly).',
  },
  REVISION_REASON_TOO_LONG: {
    code: 'REVISION_REASON_TOO_LONG',
    httpStatus: 400,
    messageEn: 'The revision reason exceeds 500 characters',
    messageTh: 'เหตุผลการออกฉบับแก้ไขยาวเกิน 500 ตัวอักษร กรุณาย่อเหตุผลให้สั้นลงแล้วกดยืนยันอีกครั้ง',
    source: 'routes/api/admin/certificates.js:272',
    remediation: 'Same bound as the revocation reason.',
  },
  REVISION_NOT_FOUND: {
    code: 'REVISION_NOT_FOUND',
    httpStatus: 404,
    messageEn: 'No archived revision with that number exists for this certificate number',
    messageTh: 'ไม่พบฉบับก่อนหน้าหมายเลขนี้ของใบรับรองที่ระบุ กรุณาตรวจสอบเลขที่ใบรับรองและหมายเลขฉบับ แล้วลองใหม่อีกครั้ง',
    source: 'routes/api/auth/public.js:235',
    remediation: 'GET /api/public/verify/:no/revisions/:n answers this one shape for an unknown certificate number, a revision index that is not a positive integer, and a number with no archived row, so an enumerator cannot tell the three apart. Archived revisions are numbered from 1 (the original issue) up to the live revisionNo minus one; read data.revision.history on /verify/:no for the numbers that exist.',
  },
  CERTIFICATE_REVISE_FAILED: {
    code: 'CERTIFICATE_REVISE_FAILED',
    httpStatus: 500,
    messageEn: 'The revision could not be issued right now; nothing was changed',
    messageTh: 'ระบบไม่สามารถออกฉบับแก้ไขใบรับรองได้ในขณะนี้ กรุณาลองใหม่อีกครั้งในอีกสักครู่',
    source: 'routes/api/admin/certificates.js:222',
    remediation: 'The admin revision door caught an error that carries no catalogued code (storage, signing runtime, unexpected shape). The service writes archive + re-sign in one transaction, so a failure here left the live certificate untouched. Read the [admin/certificates] revise failed log line for the cause.',
  },
  CERT_NOT_FOUND: {
    code: 'CERT_NOT_FOUND',
    httpStatus: 404,
    messageEn: 'Certificate not found',
    messageTh: 'ไม่พบใบรับรอง',
    source: 'services/renewal-service.js:234',
    remediation: 'Verify the certificate ID under the current tenant.',
  },
  CERT_NOT_ACTIVE: {
    code: 'CERT_NOT_ACTIVE',
    httpStatus: 409,
    messageEn: 'Certificate is not active',
    messageTh: 'ใบรับรองไม่อยู่ในสถานะใช้งาน',
    source: 'services/renewal-service.js:245',
    remediation: 'Only ACTIVE certificates can be renewed; check certificate status.',
  },
  CERT_ALREADY_EXPIRED: {
    code: 'CERT_ALREADY_EXPIRED',
    httpStatus: 409,
    messageEn: 'Certificate has already expired',
    messageTh: 'ใบรับรองหมดอายุแล้ว',
    source: 'services/renewal-service.js:255',
    remediation: 'Submit a new application instead of renewal.',
  },
  SOURCE_APP_NOT_FOUND: {
    code: 'SOURCE_APP_NOT_FOUND',
    httpStatus: 500,
    messageEn: 'Source application for certificate not found',
    messageTh: 'ไม่พบใบสมัครต้นทางของใบรับรอง',
    source: 'services/renewal-service.js:279',
    remediation: 'Internal data integrity issue; contact platform support.',
  },
  FORBIDDEN_NOT_OWNER: {
    code: 'FORBIDDEN_NOT_OWNER',
    httpStatus: 403,
    messageEn: 'Only the certificate owner may renew',
    messageTh: 'เฉพาะเจ้าของใบรับรองเท่านั้นที่ขอต่ออายุได้',
    source: 'services/renewal-service.js:240',
    remediation: 'Ownership transfer must precede renewal.',
  },

  // ─────────── routes/api/finance/* — RBAC denials ───────────
  BUNDLE_TERMINAL_APPLICATION: {
    code: 'BUNDLE_TERMINAL_APPLICATION',
    httpStatus: 409,
    messageEn: 'Bundle contains an application already in a final state and cannot be linked or submitted',
    messageTh: 'ใบสมัครในชุดนี้มีสถานะสิ้นสุดแล้ว คุณไม่สามารถนำมารวมชุดหรือยื่นซ้ำได้ กรุณานำใบสมัครที่สิ้นสุดออกจากชุดก่อน',
    source: 'routes/api/applications/application-bundles.js:120',
    remediation: 'Remove the finished application (REJECTED/CERTIFIED/EXPIRED/CANCEL_EXPIRED) from the bundle before linking or submitting; a terminal case cannot re-enter the review flow.',
  },


  // ─────────── services/admin-user-service.js ───────────
  ALREADY_ACTIVE: {
    code: 'ALREADY_ACTIVE',
    httpStatus: 409,
    messageEn: 'User is already active',
    messageTh: 'ผู้ใช้นี้ใช้งานอยู่แล้ว',
    source: 'services/admin-user-service.js:328',
    remediation: 'No action required.',
  },
  SELF_DISABLE_FORBIDDEN: {
    code: 'SELF_DISABLE_FORBIDDEN',
    httpStatus: 403,
    messageEn: 'Cannot disable your own account',
    messageTh: 'ห้ามปิดบัญชีของตนเอง',
    source: 'services/admin-user-service.js:286',
    remediation: 'Have a different admin perform the disable action.',
  },
  SELF_MFA_RESET_FORBIDDEN: {
    code: 'SELF_MFA_RESET_FORBIDDEN',
    httpStatus: 403,
    messageEn: 'Cannot reset MFA on your own account via admin endpoint',
    messageTh: 'ห้ามรีเซ็ต MFA บัญชีของตนเองผ่านช่องผู้ดูแล',
    source: 'services/admin-user-service.js:434',
    remediation: 'Use the self-service MFA reset flow instead.',
  },
  SELF_ROLE_CHANGE_FORBIDDEN: {
    code: 'SELF_ROLE_CHANGE_FORBIDDEN',
    httpStatus: 403,
    messageEn: 'Cannot change your own role',
    messageTh: 'ห้ามเปลี่ยนบทบาทตนเอง',
    source: 'services/admin-user-service.js:372',
    remediation: 'Have a different admin assign the new role.',
  },
  ROLE_ADMIN_CANNOT_BE_LAST: {
    code: 'ROLE_ADMIN_CANNOT_BE_LAST',
    httpStatus: 409,
    messageEn: 'Cannot remove the last active ADMIN of the organization',
    messageTh: 'ไม่สามารถถอดผู้ดูแลระบบที่ใช้งานอยู่คนสุดท้ายขององค์กรได้',
    source: 'services/admin-user-service.js:302',
    remediation: 'Promote or activate another ADMIN in the organization first, then retry the demotion/disable/delete.',
  },

  // ─────────── routes/api/system/provider.js (P0-D staff directory) ───────────
  PROVIDER_ID_EDIT_FORBIDDEN: {
    code: 'PROVIDER_ID_EDIT_FORBIDDEN',
    httpStatus: 400,
    messageEn: 'providerId (national ID) cannot be edited — recreate the provider account instead',
    messageTh: 'ไม่สามารถแก้ไขเลขบัตรประชาชน (providerId) ได้ กรุณาสร้างบัญชีเจ้าหน้าที่ใหม่แทน',
    source: 'routes/api/system/provider.js:112',
    remediation: 'providerId is a login identity (HMAC lookup + FK token under the live PDPA flags); editing it strands the account. Create a new provider account with the correct providerId and disable the old one.',
  },


  // ─────────── services/pdpa-* + pdpa-erasure-service.js ───────────
  PDPA_ALREADY_DELETED: {
    code: 'PDPA_ALREADY_DELETED',
    httpStatus: 409,
    messageEn: 'PDPA erasure: data already deleted',
    messageTh: 'PDPA: ข้อมูลถูกลบไปแล้ว',
    source: 'services/pdpa-erasure-service.js:239',
    remediation: 'No further action; the user data is already purged.',
  },
  PDPA_ERASURE_BAD_STATUS: {
    code: 'PDPA_ERASURE_BAD_STATUS',
    httpStatus: 409,
    messageEn: 'PDPA erasure request status invalid',
    messageTh: 'สถานะคำขอลบข้อมูลตาม PDPA ไม่ถูกต้อง',
    source: 'services/pdpa-erasure-service.js:363',
    remediation: 'Refer to PDPA erasure state-machine.',
  },
  PDPA_ERASURE_EXPIRED: {
    code: 'PDPA_ERASURE_EXPIRED',
    httpStatus: 410,
    messageEn: 'PDPA erasure token has expired',
    messageTh: 'โทเค็นยืนยันการลบข้อมูลตาม PDPA หมดอายุ',
    source: 'services/pdpa-erasure-service.js:371',
    remediation: 'Request a fresh erasure token and confirm within the window.',
  },
  PDPA_ERASURE_INVALID_TOKEN: {
    code: 'PDPA_ERASURE_INVALID_TOKEN',
    httpStatus: 401,
    messageEn: 'PDPA erasure confirmation token is invalid',
    messageTh: 'โทเค็นยืนยันการลบข้อมูลตาม PDPA ไม่ถูกต้อง',
    source: 'services/pdpa-erasure-service.js:376',
    remediation: 'Use the token from the confirmation email exactly as issued.',
  },
  PDPA_ERASURE_IN_PROGRESS: {
    code: 'PDPA_ERASURE_IN_PROGRESS',
    httpStatus: 409,
    messageEn: 'PDPA erasure already in progress',
    messageTh: 'การลบข้อมูลตาม PDPA กำลังดำเนินการอยู่',
    source: 'services/pdpa-erasure-service.js:259',
    remediation: 'Wait for the current erasure job to complete before re-requesting.',
  },
  PDPA_ERASURE_NOT_FOUND: {
    code: 'PDPA_ERASURE_NOT_FOUND',
    httpStatus: 404,
    messageEn: 'PDPA erasure request not found',
    messageTh: 'ไม่พบคำขอลบข้อมูลตาม PDPA',
    source: 'services/pdpa-erasure-service.js:358',
    remediation: 'Verify the erasure request ID.',
  },
  PDPA_LEGAL_HOLD: {
    code: 'PDPA_LEGAL_HOLD',
    httpStatus: 409,
    messageEn: 'User is on legal hold — cannot erase data',
    messageTh: 'ข้อมูลถูกกักโดยกระบวนการทางกฎหมาย ไม่สามารถลบได้',
    source: 'services/pdpa-erasure-service.js:248',
    remediation: 'Resolve the legal hold via DPO before erasure.',
  },
  PDPA_PASSWORD_REQUIRED: {
    code: 'PDPA_PASSWORD_REQUIRED',
    httpStatus: 400,
    messageEn: 'Password confirmation required for PDPA self-service action',
    messageTh: 'ต้องยืนยันรหัสผ่านสำหรับการดำเนินการ PDPA',
    source: 'services/pdpa-service.js:262',
    remediation: 'Include the current password in the request body for sensitive PDPA operations.',
  },

  // ─────────── shared/encryption.js ───────────
  CRYPTO_BAD_FORMAT: {
    code: 'CRYPTO_BAD_FORMAT',
    httpStatus: 400,
    messageEn: 'Encrypted blob has invalid format',
    messageTh: 'รูปแบบข้อมูลที่เข้ารหัสไม่ถูกต้อง',
    source: 'shared/encryption.js:58',
    remediation: 'Verify the encrypted blob was produced by this platform; do not concatenate or modify bytes.',
  },
  CRYPTO_BAD_IV: {
    code: 'CRYPTO_BAD_IV',
    httpStatus: 400,
    messageEn: 'Encrypted blob initialization vector is invalid',
    messageTh: 'IV ของข้อมูลเข้ารหัสไม่ถูกต้อง',
    source: 'shared/encryption.js:67',
    remediation: 'IV must be 12 bytes (AES-GCM). Regenerate via the platform encryption helper.',
  },
  CRYPTO_BAD_TYPE: {
    code: 'CRYPTO_BAD_TYPE',
    httpStatus: 400,
    messageEn: 'Encrypted payload type mismatch',
    messageTh: 'ชนิดข้อมูลที่เข้ารหัสไม่ตรงกัน',
    source: 'shared/encryption.js:104',
    remediation: 'Verify the payload origin; encrypted blobs are typed.',
  },
  CRYPTO_DECRYPT_FAILED: {
    code: 'CRYPTO_DECRYPT_FAILED',
    httpStatus: 400,
    messageEn: 'Decryption failed — wrong key or corrupted blob',
    messageTh: 'ถอดรหัสล้มเหลว กุญแจไม่ถูกต้องหรือข้อมูลเสียหาย',
    source: 'shared/encryption.js:117',
    remediation: 'Verify the decryption key version matches; check for byte corruption in transport.',
  },

  // ─────────── services/qrcode + trace-service ───────────
  QR_RSA_REQUIRED_IN_PROD: {
    code: 'QR_RSA_REQUIRED_IN_PROD',
    httpStatus: 500,
    messageEn: 'RSA signing key required for QR code in production',
    messageTh: 'ต้องตั้งค่ากุญแจ RSA สำหรับ QR ในระบบจริง',
    source: 'services/qrcode/qrcode-service.js:289',
    remediation: 'Ops: provision the QRCODE_RSA_PRIVATE_KEY secret per deployment guide.',
  },
  QR_SECRET_MISSING: {
    code: 'QR_SECRET_MISSING',
    httpStatus: 500,
    messageEn: 'QR signing secret is not set',
    messageTh: 'ไม่มีคีย์ลับสำหรับลงนาม QR',
    source: 'services/qrcode/qrcode-service.js:256',
    remediation: 'Ops: set QRCODE_HMAC_SECRET environment variable.',
  },
  QR_SECRET_WEAK: {
    code: 'QR_SECRET_WEAK',
    httpStatus: 500,
    messageEn: 'QR signing secret is below minimum entropy',
    messageTh: 'คีย์ลับสำหรับลงนาม QR อ่อนเกินไป',
    source: 'services/qrcode/qrcode-service.js:245',
    remediation: 'Ops: rotate QRCODE_HMAC_SECRET to a value ≥ 32 random bytes.',
  },
  TRACE_URL_REQUIRED_IN_PROD: {
    code: 'TRACE_URL_REQUIRED_IN_PROD',
    httpStatus: 500,
    messageEn: 'Trace URL must be configured in production',
    messageTh: 'ต้องตั้งค่า URL การติดตามในระบบจริง',
    source: 'services/qrcode/qrcode-service.js:89',
    remediation: 'Ops: set TRACE_URL environment variable.',
  },

  // ─────────── services/subscription/* ───────────
  // M3 (2026-08-23, operator: "ไม่มีค่าสมาชิก"): CONTACT_SALES, INVALID_TIER,
  // INVALID_CYCLE, NO_PRICING and SUBSCRIPTION_ALREADY_EXISTS are gone with the
  // order-minting path that was their only emitter. FEATURE_LOCKED stays — it
  // is a feature gate, not a fee.
  FEATURE_LOCKED: {
    code: 'FEATURE_LOCKED',
    httpStatus: 402,
    messageEn: 'Feature locked by subscription tier',
    messageTh: 'คุณสมบัตินี้ปิดอยู่ตามแผนการสมัครสมาชิก',
    source: 'services/subscription/entitlements-service.js:113',
    remediation: 'Upgrade your subscription tier to unlock this feature.',
  },
  // ─────────── services/prisma-auth-service + misc auth ───────────
  NO_DEFAULT_ORG: {
    code: 'NO_DEFAULT_ORG',
    httpStatus: 400,
    messageEn: 'User has no default organization',
    messageTh: 'ผู้ใช้ไม่มีองค์กรเริ่มต้น',
    source: 'services/prisma-auth-service.js:128',
    remediation: 'Have an admin attach the user to at least one organization.',
  },

  // ─────────── services/fraud-detection/* ───────────
  PATH_TRAVERSAL_BLOCKED: {
    code: 'PATH_TRAVERSAL_BLOCKED',
    httpStatus: 400,
    messageEn: 'Document path attempted directory traversal — blocked',
    messageTh: 'ตรวจพบความพยายามเข้าถึงเส้นทางไฟล์ที่ไม่ปลอดภัย ถูกบล็อก',
    source: 'services/fraud-detection/document-verification-methods.js:30',
    remediation: 'Use only the safe relative paths returned by the upload API.',
  },


  // ─────────── audit scheduling ───────────
  AUDITOR_SLOT_CONFLICT: {
    code: 'AUDITOR_SLOT_CONFLICT',
    httpStatus: 409,
    messageEn: 'Concurrent scheduling detected for this auditor/date',
    messageTh: 'มีการจัดตารางผู้ตรวจในวันเดียวกันพร้อมกัน กรุณาลองใหม่',
    source: 'services/audit-scheduling-service.js:512',
    remediation: 'Two assignments raced for the same auditor and date; simply retry the assignment.',
  },




  // ─────────── storage service ───────────
  STORAGE_UPLOAD_FAILED: {
    code: 'STORAGE_UPLOAD_FAILED',
    httpStatus: 500,
    messageEn: 'File upload to storage failed',
    messageTh: 'อัปโหลดไฟล์ไปยังที่จัดเก็บไม่สำเร็จ',
    source: 'services/storage-service.js:194',
    remediation: 'Retry the upload; if it persists, check the storage backend health and credentials.',
  },
  STORAGE_CLOUD_UNAVAILABLE: {
    code: 'STORAGE_CLOUD_UNAVAILABLE',
    httpStatus: 503,
    messageEn: 'Cloud object storage is unavailable',
    messageTh: 'บริการจัดเก็บไฟล์บนคลาวด์ไม่พร้อมใช้งาน',
    source: 'services/storage-service.js:210',
    remediation: 'The configured object-storage backend is unreachable; verify MinIO/S3 connectivity and retry.',
  },

  // ─────────── consent gate (PDPA) ───────────
  CONSENT_REQUIRED: {
    code: 'CONSENT_REQUIRED',
    httpStatus: 403,
    messageEn: 'Required PDPA consents have not been granted',
    messageTh: 'ยังไม่ได้ให้ความยินยอมตาม PDPA ที่จำเป็น',
    source: 'middleware/consent-manager.js:320',
    remediation: 'Grant the required TERMS_OF_SERVICE and PRIVACY_POLICY consents, then retry the request.',
  },

  // ─────────── certificate lifecycle (ISO 17065 §7.11 suspension) ───────────
  CERTIFICATE_NOT_SUSPENDABLE: {
    code: 'CERTIFICATE_NOT_SUSPENDABLE',
    httpStatus: 409,
    messageEn: 'Certificate is not in an active state and cannot be suspended',
    messageTh: 'ใบรับรองไม่ได้อยู่ในสถานะใช้งาน จึงไม่สามารถพักใช้ได้',
    source: 'services/certificate-service.js:856',
    remediation: 'Only an active certificate can be suspended; reload to see its current status (it may already be suspended, revoked, or expired).',
  },
  CERTIFICATE_NOT_REINSTATABLE: {
    code: 'CERTIFICATE_NOT_REINSTATABLE',
    httpStatus: 409,
    messageEn: 'Certificate is not suspended and cannot be reinstated',
    messageTh: 'ใบรับรองไม่ได้อยู่ในสถานะพักใช้ จึงไม่สามารถคืนสถานะได้',
    source: 'services/certificate-service.js:899',
    remediation: 'Only a suspended certificate can be reinstated; a revoked certificate cannot be reinstated.',
  },

  // ─────────── certification decision (ISO 17065 §7.6 two-person rule) ───────────
  CERTIFICATION_EVALUATOR_UNKNOWN: {
    code: 'CERTIFICATION_EVALUATOR_UNKNOWN',
    httpStatus: 409,
    messageEn: 'Cannot verify certification segregation of duties — no recorded evaluator',
    messageTh: 'ไม่สามารถตรวจสอบการแบ่งแยกหน้าที่การรับรองได้ ไม่พบผู้ตรวจประเมินที่บันทึกไว้',
    source: 'services/workflow-transition-service.js:475',
    remediation: 'The application has no recorded auditor/evaluator; record the audit decision (or set auditorId) before approving so the §7.6 two-person check can run.',
  },
  CERTIFICATION_SOD_VIOLATION: {
    code: 'CERTIFICATION_SOD_VIOLATION',
    httpStatus: 403,
    messageEn: 'Certification decision must be made by someone other than the evaluating auditor',
    messageTh: 'ผู้ตัดสินรับรองต้องไม่ใช่ผู้ตรวจประเมิน (ISO/IEC 17065 §7.6)',
    source: 'services/workflow-transition-service.js:449',
    remediation: 'Have a different authorised person (not the auditor who performed the on-site evaluation) approve the certification.',
  },

  // ─────────── drift-reconciliation batch (2026-06-24): codes thrown by ───────────
  // auth-lockout, CAR, MFA/OTP, onsite, tenant ledger,
  // quotation/receipt finance, and the canonical-review gate (#526). Catalogued
  // here to clear the error-codes-catalog drift ratchet.
  ACCOUNT_LOCKED: {
    code: 'ACCOUNT_LOCKED',
    httpStatus: 423,
    messageEn: 'Account temporarily locked after too many failed login attempts',
    messageTh: 'บัญชีถูกล็อกชั่วคราวเนื่องจากเข้าสู่ระบบผิดหลายครั้ง',
    source: 'routes/api/auth/auth-provider.js:132',
    remediation: 'Wait for the lockout window to elapse, then retry; repeated lockouts should be escalated to an administrator.',
  },
  CAR_COMMENT_REQUIRED: {
    code: 'CAR_COMMENT_REQUIRED',
    httpStatus: 400,
    messageEn: 'A comment is required when raising a Corrective Action Request',
    messageTh: 'ต้องระบุความเห็นเมื่อออกคำขอให้แก้ไข (CAR)',
    source: 'routes/api/audit/audits.js:425',
    remediation: 'Provide a non-empty comment describing the corrective action required before submitting the CAR.',
  },
  USE_CANONICAL_REVIEW: {
    code: 'USE_CANONICAL_REVIEW',
    httpStatus: 422,
    // R2 M3b fix cycle 1 (2026-08-03): the terminal rejection joined the two document
    // decisions in WORK_INBOX_BLOCKED_DECISION_STATES, so this catalogue entry stops
    // describing document review only — a REJECT taken on the work inbox would commit
    // the terminal status with no administrative-order letter and no AuditLog.
    messageEn: 'Decisions with mandatory side-effects (document decision, terminal rejection) must be made on the canonical reviewer surface, not the work inbox',
    messageTh: 'การตัดสินผลคำขอต้องทำผ่านหน้ารายละเอียดคำขอหลัก ไม่ใช่หน้า work inbox',
    source: 'routes/api/provider/work.js:425',
    remediation: 'Open the application at /provider/applications/[id] (canonical reviewer surface) to approve, request a revision, or reject.',
  },
  // ─────────── services/billing/quotation-gate.js — the shared, fail-closed quotation gate (F-G4-64) ───────────
  // One gate module answers both money rails (card checkout and transfer slip),
  // so this vocabulary is rail-neutral: the copy may not tell a card-rail
  // applicant to do something only the slip rail has.
  QUOTATION_NOT_ISSUED: {
    code: 'QUOTATION_NOT_ISSUED',
    httpStatus: 409,
    messageEn: 'No quotation has been issued for this application yet',
    // Fix round 1 of the final round: the copy said "กดรีเฟรชอีกครั้ง". R3
    // narrowed the read's issuance window to SELF_HEAL_STATUSES (M1 minus
    // DRAFT) and routes an unquoted M2-payable application to THIS refusal, so
    // for exactly the applications that meet it, refreshing can never produce a
    // quotation — the instruction sent them round a loop that cannot end, and
    // then to a staff door that does not exist (ledger F-G4-71). What is left
    // is the cause and the one thing that lets staff look at anything at all.
    messageTh: 'ระบบยังไม่ออกใบเสนอราคาของคำขอนี้ จึงยังชำระเงินไม่ได้ กรุณาติดต่อเจ้าหน้าที่พร้อมแจ้งเลขที่คำขอ',
    source: 'services/billing/quotation-gate.js:153',
    remediation: 'Issuance runs on submit and at renewal creation. GET /api/applications/:id/quotations re-issues idempotently ONLY inside SELF_HEAL_STATUSES (services/quotation-issuance-on-submit.js: PAYABLE_STATES.M1 minus DRAFT = SUBMITTED, PENDING_DOC_FEE), because minting in an M2-payable state would bill a งวดที่ 1 the applicant has already paid. The same read also REPLACES a lapsed offer, in that window or on an M2-payable application whose row prices PHASE_2 only (the renewal). An M2-payable application with NO quotation at all can be quoted by nobody: there is no staff issuance door (ledger F-G4-71), and that gap is what this refusal reports. The audit row (action QUOTATION_ISSUE_FAILED) names the original cause.',
  },
  CHECKOUT_PRICE_DRIFT: {
    code: 'CHECKOUT_PRICE_DRIFT',
    httpStatus: 409,
    messageEn: 'The amount to charge differs from the accepted quotation; no payment was created',
    messageTh: 'ยอดที่จะเรียกเก็บไม่ตรงกับใบเสนอราคาที่คุณยอมรับไว้ ระบบจึงไม่สร้างรายการชำระเงิน เจ้าหน้าที่ได้รับแจ้งแล้ว',
    source: 'services/checkout/stripe-checkout-service.js:300',
    remediation: 'The figures this request would charge did not match the accepted snapshot to the satang. Nothing is charged. Raised from ONE comparison that guards both doors, the mint and the re-entry (assertChargeMatchesAcceptedFigures); the audit row (action CHECKOUT_PRICE_DRIFT) carries both figures plus `entry` = MINT or RE_ENTRY, and an URGENT admin notification carries the same, because the applicant copy says staff were told. Unblocking the applicant takes TWO steps, not one: the stale checkout_orders row for that (application, milestone) is what the re-entry lookup keeps returning, so it blocks a corrected mint until it leaves PENDING_PAYMENT — cancel its PaymentIntent in the gateway, whose payment_intent.canceled webhook moves the row to CANCELLED (services/checkout/checkout-settlement-service.js) — and only then re-issue the quotation. Re-issuing alone leaves the applicant unable to pay. The admin alert is sent once per UNREAD incident per (applicationId, milestone), so an applicant retrying the button cannot bury it.',
  },
  QUOTATION_ISSUE_FAILED: {
    code: 'QUOTATION_ISSUE_FAILED',
    httpStatus: 500,
    messageEn: 'The application was submitted but its quotation could not be issued',
    messageTh: 'ระบบรับคำขอของคุณแล้ว แต่ออกใบเสนอราคาไม่สำเร็จ เจ้าหน้าที่ได้รับแจ้งแล้ว กรุณาเปิดหน้าชำระเงินอีกครั้งในภายหลัง',
    source: 'routes/api/applications/applications.js:1211',
    remediation: 'The submitted status is NOT rolled back. GET /api/applications/:id/quotations re-issues idempotently; the audit row and the admin notification carry the cause.',
  },
  ONSITE_NOT_AVAILABLE: {
    code: 'ONSITE_NOT_AVAILABLE',
    httpStatus: 400,
    messageEn: 'On-site audit data is not available for this application',
    messageTh: 'ยังไม่มีข้อมูลการตรวจประเมินภาคสนามสำหรับคำขอนี้',
    source: 'services/audit-onsite-service.js:640',
    remediation: 'Ensure the on-site audit has been scheduled/recorded before requesting on-site data.',
  },
  INVALID_FILE_TYPE: {
    code: 'INVALID_FILE_TYPE',
    httpStatus: 400,
    messageEn: 'Unsupported file type — only JPEG/PNG/WebP image uploads are allowed',
    messageTh: 'ชนิดไฟล์ไม่รองรับ อัปโหลดได้เฉพาะรูปภาพ JPEG/PNG/WebP',
    source: 'routes/api/audit/onsite.js:56',
    remediation: 'Re-capture/convert the photo to JPEG, PNG, or WebP before uploading the on-site evidence.',
  },
  ORG_SCOPE_REQUIRED: {
    code: 'ORG_SCOPE_REQUIRED',
    httpStatus: 403,
    messageEn: 'Tenant organization scope is required for this query (fail-closed)',
    messageTh: 'ต้องมีขอบเขตองค์กร (tenant) สำหรับการเรียกข้อมูลนี้',
    source: 'routes/api/provider/ledger.js:54',
    remediation: 'Call this endpoint with an authenticated provider session whose tenant context resolves an organizationId.',
  },
  MFA_METHOD_MISMATCH: {
    code: 'MFA_METHOD_MISMATCH',
    httpStatus: 400,
    messageEn: 'The MFA method does not match the method bound to this challenge',
    messageTh: 'วิธียืนยันตัวตน (MFA) ไม่ตรงกับวิธีที่ผูกไว้กับ challenge นี้',
    source: 'routes/api/identity/mfa.js:459',
    remediation: 'Submit the verification using the same method (TOTP or EMAIL) that the challenge was issued for.',
  },
  OTP_EXPIRED: {
    code: 'OTP_EXPIRED',
    httpStatus: 401,
    messageEn: 'The one-time passcode has expired',
    messageTh: 'รหัส OTP หมดอายุแล้ว',
    source: 'routes/api/identity/mfa.js:487',
    remediation: 'Request a new OTP and submit it within the validity window (300s).',
  },
  OTP_TOO_MANY: {
    code: 'OTP_TOO_MANY',
    httpStatus: 429,
    messageEn: 'Too many incorrect OTP attempts',
    messageTh: 'ใส่รหัส OTP ผิดเกินจำนวนครั้งที่กำหนด',
    source: 'routes/api/identity/mfa.js:495',
    remediation: 'Wait, then request a fresh OTP; the previous code is invalidated after the attempt cap.',
  },
  MFA_CHALLENGE_REUSED: {
    code: 'MFA_CHALLENGE_REUSED',
    httpStatus: 401,
    messageEn: 'This MFA challenge has already been consumed (replay rejected)',
    messageTh: 'challenge MFA นี้ถูกใช้ไปแล้ว (ปฏิเสธการใช้ซ้ำ)',
    source: 'routes/api/identity/mfa.js:535',
    remediation: 'Restart the login to obtain a fresh single-use MFA challenge.',
  },
  // B6 / กทล.๑ ส่วนที่ ๔ (๓), 2026-09-05 — the clause the applicant signs at step 6, given
  // teeth. Two ordinary requests used to walk around it: move farms.cultivationMethod, then
  // create a plot the plot door compares against that same moved column.
  CERTIFIED_SCOPE_LOCKED: {
    code: 'CERTIFIED_SCOPE_LOCKED',
    httpStatus: 409,
    messageEn: 'The farm holds a live certificate; its cultivation method cannot be changed',
    messageTh: 'ฟาร์มนี้ถือใบรับรองที่ยังมีผลอยู่ จึงเปลี่ยนลักษณะการปลูกไม่ได้ ต้องยื่นคำขอใหม่',
    source: 'services/certified-scope.js:29',
    remediation: 'File a new application (กทล.๑). Amending the scope of a live certificate is not a door the department has defined.',
  },
  CERTIFIED_SCOPE_UNVERIFIABLE: {
    code: 'CERTIFIED_SCOPE_UNVERIFIABLE',
    httpStatus: 503,
    messageEn: 'The certificate scope could not be checked right now, so the change is refused',
    messageTh: 'ระบบตรวจสอบขอบเขตของใบรับรองไม่ได้ในขณะนี้ จึงยังทำรายการนี้ไม่ได้',
    source: 'services/certified-scope.js:31',
    remediation: 'Retry. The guard fails closed on purpose: a scope lock that lapses when the database hiccups is open exactly when things are going wrong.',
  },
  PLOT_OUTSIDE_CERTIFIED_SCOPE: {
    code: 'PLOT_OUTSIDE_CERTIFIED_SCOPE',
    httpStatus: 409,
    messageEn: 'The requested plot type is outside what this farm\'s certificate covers',
    messageTh: 'ลักษณะแปลงที่ขอเพิ่มอยู่นอกขอบเขตที่ใบรับรองครอบคลุม ต้องยื่นคำขอใหม่',
    source: 'services/certified-scope.js:30',
    remediation: 'Create a plot of a type the certificate covers, or file a new application for the new area type.',
  },
  // T10b — the same door's own refusals, catalogued with it (T9/T10, 2026-09-05).
  LAB_FILE_REQUIRED: {
    code: 'LAB_FILE_REQUIRED',
    httpStatus: 400,
    messageEn: 'A laboratory report file is required',
    messageTh: 'กรุณาแนบไฟล์ผลวิเคราะห์ (COA)',
    source: 'services/batch-lab-result-service.js:34',
    remediation: 'Attach the COA as a file. The document is the evidence; there is no field to type its values into.',
  },
  LAB_NAME_REQUIRED: {
    code: 'LAB_NAME_REQUIRED',
    httpStatus: 400,
    messageEn: 'The issuing laboratory must be named',
    messageTh: 'กรุณาระบุชื่อห้องปฏิบัติการที่ออกรายงาน',
    source: 'services/batch-lab-result-service.js:38',
    remediation: 'Send labName. A report with no issuer proves nothing, so it is refused rather than stored unattributed.',
  },
  // Bug 6.5 — resubmit past the 5-working-day revision window is rejected; the app expires.
  REVISION_DEADLINE_EXCEEDED: {
    code: 'REVISION_DEADLINE_EXCEEDED',
    httpStatus: 400,
    messageEn: 'Revision deadline exceeded; the application has expired',
    messageTh: 'เกินกำหนดเวลาแก้ไข คำขอถูกยกเลิกแล้ว กรุณายื่นใหม่',
    source: 'routes/api/applications/applications.js:578',
    remediation: 'The 5-working-day revision window has passed; file a new application and pay the phase-1 fee again.',
  },
  // Upload drill fast-follow (2026-07-06) — an extension/mimetype-rejected upload
  // returns a clean 400 (was a 500). storage-service fileFilter stashes the reason
  // on req + cb(null,false); the route surfaces it under this code.
  UPLOAD_REJECTED: {
    code: 'UPLOAD_REJECTED',
    httpStatus: 400,
    messageEn: 'Upload rejected — unsupported or disallowed file type/extension',
    messageTh: 'อัปโหลดไม่สำเร็จ ชนิดไฟล์หรือนามสกุลไฟล์ไม่รองรับ',
    source: 'services/storage-service.js:244',
    remediation: 'Upload only an allowed type (JPEG/PNG/WebP/PDF) whose file extension matches its content type.',
  },
  // ── Waiver-reopen flow (owner ruling 2026-07-08) ─────────────────────────
  WAIVER_REOPEN_REQUIRED: {
    code: 'WAIVER_REOPEN_REQUIRED',
    httpStatus: 409,
    messageEn: 'Reopening an EXPIRED application requires the waiver-reopen flow or break-glass',
    messageTh: 'การเปิดใบสมัครที่หมดอายุต้องผ่านขั้นตอนเคสอนุโลม (ผู้ตรวจยื่น → บัญชี DTAM อนุมัติ) หรือ break-glass เท่านั้น',
    source: 'services/application-status-writer.js:294',
    remediation: 'Use the waiver-reopen flow; admins may use reasonCode BREAK_GLASS_REOPEN on force-status in emergencies (loudly audited).',
  },
  PAYMENT_TERMS_NOT_WITHDRAWABLE: {
    code: 'PAYMENT_TERMS_NOT_WITHDRAWABLE',
    httpStatus: 400,
    messageEn: 'The payment-terms acknowledgment is contractual evidence and cannot be withdrawn',
    messageTh: 'การยอมรับเงื่อนไขการชำระเงินเป็นหลักฐานทางสัญญา ถอนไม่ได้',
    source: 'middleware/consent-manager.js:89',
    remediation: 'PAYMENT_TERMS is a มาตรา 24(3) contract-basis acknowledgment, not an optional PDPA consent disclosure-before-payment evidence must survive withdrawal attempts.',
  },




  // ─────────── services/onsite-evidence-gate.js — certificate issuance evidence gate ───────────
  NO_ONSITE_AUDIT: {
    code: 'NO_ONSITE_AUDIT',
    httpStatus: 409,
    messageEn: 'No onsite audit is recorded for this application; a certificate cannot be issued',
    messageTh: 'คำขอนี้ยังไม่มีบันทึกการตรวจประเมินในพื้นที่ จึงยังออกใบรับรองไม่ได้ กรุณาให้ผู้ตรวจบันทึกผลการตรวจแปลงก่อน',
    source: 'services/onsite-evidence-gate.js:80',
    remediation: 'Issuance is evidence-gated. An auditor must record the onsite audit (photos + checklist) before AUDIT_PASSED can mint a certificate.',
  },
  DUPLICATE_PHOTO: {
    code: 'DUPLICATE_PHOTO',
    httpStatus: 409,
    messageEn: 'These exact bytes are already recorded on this audit',
    messageTh: 'รูปนี้ถูกอัปโหลดไว้แล้วในการตรวจครั้งนี้ คุณไม่ต้องอัปโหลดซ้ำ หากต้องการหลักฐานเพิ่ม กรุณาถ่ายรูปใหม่',
    source: 'services/audit-onsite-service.js:700',
    remediation: 'The onsite photo minimum counts DISTINCT photographs, so a second copy of the same file would add nothing to the evidence a certificate rests on. Usually this is a double-tap: the first upload succeeded. To add evidence, take another photograph.',
  },
  AUDIT_NOT_ONSITE: {
    code: 'AUDIT_NOT_ONSITE',
    httpStatus: 409,
    messageEn: 'No onsite inspection is booked for this application, so an onsite audit record cannot be opened',
    messageTh: 'คำขอนี้ยังไม่มีการนัดตรวจแบบลงพื้นที่ คุณจึงเปิดแบบบันทึกการตรวจแปลงไม่ได้ กรุณานัดหมายการตรวจแบบ ONSITE ก่อน',
    source: 'controllers/audit-checklist-controller.js:304',
    remediation: 'An ONLINE_MEET (or unbooked) inspection produces no onsite evidence, so opening an audit record for it would let a certificate mint for a farm nobody visited. Re-schedule the audit as ONSITE; never create the checklist row directly.',
  },
  PHOTO_GPS_REQUIRED: {
    code: 'PHOTO_GPS_REQUIRED',
    httpStatus: 400,
    messageEn: 'This photograph carries no position; allow location access and attach it again',
    messageTh: 'ยังไม่มีตำแหน่งของรูปนี้ คุณต้องอนุญาตให้แอปเข้าถึงตำแหน่งก่อน แล้วลองแนบรูปอีกครั้ง',
    source: 'services/audit-onsite-service.js:937',
    remediation: 'Every onsite photograph is bound to where it was taken. The field app acquires a GPS fix at the start of a visit; a RESUMED visit (reload, app switch) must re-acquire one before its first upload. Was a bare TypeError → HTTP 500 until 2026-08-27, which hid this from the auditor as a generic server error.',
  },
  AUDIT_APPLICATION_MISMATCH: {
    code: 'AUDIT_APPLICATION_MISMATCH',
    httpStatus: 409,
    messageEn: 'The pinned onsite audit does not belong to this application; issuance refused',
    messageTh: 'ผลการตรวจที่คำขอนี้อ้างอิงอยู่ ไม่ใช่ผลการตรวจของคำขอนี้ จึงยังออกใบรับรองไม่ได้ กรุณาให้ผู้ตรวจบันทึกผลการตรวจของคำขอนี้อีกครั้ง',
    source: 'services/onsite-evidence-gate.js:156',
    remediation: 'Application.formData.onsiteAuditId names an AuditChecklist row belonging to a different application (or a soft-deleted one). Re-record the decision so the pin names a live audit belonging to this application; never widen the gate lookup to accept it.',
  },
  CRITICAL_CHECKLIST_FAILURE: {
    code: 'CRITICAL_CHECKLIST_FAILURE',
    httpStatus: 409,
    messageEn: 'A critical checklist item is recorded FAIL on this audit; issuance refused',
    messageTh: 'ผลการตรวจแปลงมีข้อกำหนดสำคัญที่ไม่ผ่าน จึงยังออกใบรับรองไม่ได้ กรุณาแก้ไขตามข้อบกพร่องแล้วให้ผู้ตรวจบันทึกผลการตรวจใหม่',
    source: 'services/onsite-evidence-gate.js:283',
    remediation: 'CHECKLIST_TEMPLATE_2026 rule (audit-onsite-service.js:159): one FAIL on a critical item forces an overall FAIL. Issue a CAR, let the farm correct the finding, and re-inspect — never widen the gate to accept a PASS over a failed critical item.',
  },
  EVIDENCE_CAPTURE_UNAVAILABLE: {
    code: 'EVIDENCE_CAPTURE_UNAVAILABLE',
    httpStatus: 503,
    messageEn: 'Onsite evidence cannot be verified because photo/checklist capture is not provisioned; issuance refused',
    messageTh: 'ระบบตรวจหลักฐานการตรวจแปลงยังไม่พร้อมใช้งาน จึงปฏิเสธการออกใบรับรองไว้ก่อน กรุณาแจ้งผู้ดูแลระบบ',
    source: 'services/onsite-evidence-gate.js:89',
    remediation: 'Fail-closed by design: the Prisma client lacks farmAuditPhoto/farmAuditChecklistItem. Deploy the schema that provides them; never bypass the gate.',
  },

  // ─────────── services/redis-service.js — strict accessors (fail-closed auth paths) ───────────
  REDIS_UNAVAILABLE: {
    code: 'REDIS_UNAVAILABLE',
    httpStatus: 503,
    messageEn: 'The session store is unavailable; this security check cannot be completed',
    messageTh: 'ระบบเก็บข้อมูลเซสชันไม่พร้อมใช้งาน จึงยังตรวจสอบความปลอดภัยรายการนี้ไม่ได้ กรุณาลองใหม่ในอีกสักครู่',
    source: 'services/redis-service.js:55',
    remediation: 'Thrown only by getStrict/setStrict/delStrict. Authoritative callers (refresh-token and session-family blocklists, OTP, MFA) fail CLOSED on it; cache callers never see it. Restore Redis or the Postgres-backed auth store.',
  },
  MFA_STORE_UNAVAILABLE: {
    code: 'MFA_STORE_UNAVAILABLE',
    httpStatus: 503,
    messageEn: 'The verification-code store is unavailable; the code could not be checked',
    messageTh: 'ระบบตรวจรหัสยืนยันไม่พร้อมใช้งาน จึงยังตรวจรหัสของคุณไม่ได้ กรุณาลองใหม่ในอีกสักครู่',
    source: 'routes/api/identity/mfa.js:93',
    remediation: 'The OTP/MFA store is unreachable. The code was NOT accepted (fail closed). Retry after the store recovers; do not treat as a wrong code.',
  },

  // ─────────── services/storage-service.js + routes/api/files/files.js — signed URLs ───────────
  SIGNED_URL_KEY_UNAVAILABLE: {
    code: 'SIGNED_URL_KEY_UNAVAILABLE',
    httpStatus: 500,
    messageEn: 'The file-link signing key is not configured',
    messageTh: 'ระบบยังไม่ได้ตั้งค่ากุญแจสำหรับสร้างลิงก์ไฟล์ กรุณาแจ้งผู้ดูแลระบบ',
    source: 'services/storage-service.js:371',
    remediation: 'Set the signed-URL secret in config/secrets.js (UPLOADS_SIGNING_SECRET or the configured name). Never log or echo it.',
  },
  SIGNED_URL_BAD_KEY: {
    code: 'SIGNED_URL_BAD_KEY',
    httpStatus: 400,
    messageEn: 'The requested file key is not a valid upload path',
    messageTh: 'ตำแหน่งไฟล์ที่ขอไม่ถูกต้อง กรุณาเปิดไฟล์จากหน้าที่แสดงรายการไฟล์อีกครั้ง',
    source: 'services/storage-service.js:450',
    remediation: 'Object keys must be relative, normalized /uploads paths without traversal or encoding tricks. Re-request the link from the page that lists the file.',
  },
  SIGNED_URL_FAILED: {
    code: 'SIGNED_URL_FAILED',
    httpStatus: 500,
    messageEn: 'Could not create a download link for this file',
    messageTh: 'สร้างลิงก์สำหรับเปิดไฟล์นี้ไม่สำเร็จ กรุณาลองใหม่ หากยังเปิดไม่ได้ให้แจ้งผู้ดูแลระบบ',
    source: 'routes/api/files/files.js:81',
    remediation: 'Server-side signing failed after entitlement passed. Check the storage-service log line for the underlying cause (key, provider, or object lookup).',
  },
});

/**
 * Resolve a message in the requested language. Falls back to English then
 * to a generic INTERNAL_SERVER_ERROR row if the code is unknown.
 */
function getMessage(code, lang = 'en') {
  const entry = ERROR_CODES[code] || ERROR_CODES.INTERNAL_SERVER_ERROR;
  return lang === 'th' ? entry.messageTh : entry.messageEn;
}

/**
 * Lookup by code — returns the full row or undefined.
 */
function lookup(code) {
  return ERROR_CODES[code];
}

module.exports = {
  ERROR_CODES,
  getMessage,
  lookup,
};
