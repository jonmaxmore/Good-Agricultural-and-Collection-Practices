import { api } from '../api/api-client';
import { AuthService } from './auth-service';
import { PHASE_1_FEE_THRESHOLD } from '@/constants/fees';

export interface PaymentRecord {
    id: string;
    type: 'QUOTATION' | 'INVOICE' | 'RECEIPT';
    documentNumber: string;
    applicationId?: string;       // null when this is a subscription invoice
    subscriptionId?: string;      // set when this is a subscription invoice
    amount: number;
    status: string;
    erpStatus?: string;
    createdAt: string;
    paidAt?: string;
    serviceType?: string;
    phase?: 'PHASE_1' | 'PHASE_2' | 'SUBSCRIPTION' | 'UNKNOWN';
    /**
     * STATE / PLATFORM: one half of the retired per-phase invoice pair.
     * CHECKOUT: the checkout rail's ONE invoice for a whole milestone
     * (serviceType CERTIFICATION_CHECKOUT_M1 / _M2, minted by
     * apps/backend/services/checkout/stripe-checkout-service.js) — it carries
     * the department fee, the platform fee and VAT together, so it is never
     * one side of a pair.
     */
    component?: 'STATE' | 'PLATFORM' | 'CHECKOUT' | 'SUBSCRIPTION' | 'UNKNOWN';
    isPaid?: boolean;
    /** erpStatus === CANCELLED: never payable, never pending; isPaid stays false. */
    isCancelled?: boolean;
    /**
     * Receipt / tax-invoice number once a receipt has been issued against
     * this invoice (Invoice.receiptNumber, allocated by
     * apps/backend/services/invoice-service.js issueReceipt). null until then
     * (ledger F-G4-53): the applicant quotes it from the phase card.
     */
    receiptNumber?: string | null;
    /**
     * ISO timestamp the receipt was issued (Invoice.receiptIssuedAt); null
     * until then. Read by the detail modal on /health/payments so the applicant
     * sees WHEN the receipt they are quoting was issued (ledger F-G4-53).
     */
    receiptIssuedAt?: string | null;
    lineItems?: PaymentLineItem[];
}

export interface PaymentLineItem {
    lineNumber: number;
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    phase?: string | null;
    isTaxable: boolean;
}

interface InvoiceData {
    id: string;
    documentNumber?: string;
    invoiceNumber?: string;
    applicationId?: string | null;
    application?: { id: string; applicationNumber?: string };
    subscriptionId?: string | null;
    subscription?: { id: string; tier?: string; billingCycle?: string };
    amount?: number;
    totalAmount?: number;
    status: string;
    createdAt: string;
    paidAt?: string;
    serviceType?: string;
    erpStatus?: string;
    receiptNumber?: string | null;
    receiptIssuedAt?: string | null;
    lineItems?: PaymentLineItem[];
}

interface ApiResponse {
    success: boolean;
    data: InvoiceData[] | { data: InvoiceData[] } | InvoiceData;
}

// Two-card payment flow (B18-B): issuer + bank channel sourced from
// `apps/backend/config/invoice-issuers.js` via `/api/finance/issuers/*`.
// Used by `PaymentInvoiceCard` so each card on the payment screen knows
// which bank to display and which PromptPay ID to bake into its QR.
export type InvoiceIssuerType = 'DTAM' | 'PLATFORM';

export interface InvoiceIssuerView {
    serviceType: string | null;
    issuerType: InvoiceIssuerType;
    legalNameTH: string;
    legalNameEN: string;
    taxId: string;
    addressLine1: string;
    addressLine2: string;
    receiptDocumentType: string;
    receiptDocumentTypeTH: string;
    chargesVat: boolean;
    vatRate: number;
    collectedByPlatform: boolean;
    collectionAgentNoteTH: string | null;
    bankAccount: {
        bankName: string;
        accountNumber: string;
        accountHolder: string;
        legacyAccountName: string | null;
        promptpayId: string | null;
        promptpayQrPayload: string | null;
        vatExempt: boolean;
        revenueCategoryTH: string | null;
    };
}

// Credit note record (subset of CreditNote prisma model) — used by the
// applicant-facing "การคืนเงิน" panel on /health/payments. We do NOT
// expose internal fields (organizationId, postedBy, glJournalId);
// the applicant only needs to see what was refunded, why, and when.
export type CreditNoteStatus =
    | 'DRAFT'
    | 'ISSUED'
    | 'POSTED'
    | 'CANCELLED';

export interface CreditNoteRecord {
    id: string;
    creditNoteNumber: string;
    originalInvoiceId: string;
    originalInvoiceNumber?: string | null;
    reasonCode?: string | null;
    reason?: string | null;
    subtotal: number;
    vat: number;
    totalAmount: number;
    status: CreditNoteStatus;
    issuedAt?: string | null;
    postedAt?: string | null;
    createdAt: string;
}

/**
 * Classifies an invoice's serviceType into the DTAM (state-fee) or
 * PLATFORM (service-fee + VAT) side. Used by the receipts-issuance
 * filter to show each accounting reviewer only their own side.
 *
 * Subscription invoices default to PLATFORM (DTAM does not sell
 * subscriptions per the canonical RFC).
 */
export type InvoiceSide = 'DTAM' | 'PLATFORM';

/**
 * GET /consent response body (Q4 payment-terms gate). `consents` is an
 * OBJECT keyed by category — `{ PAYMENT_TERMS: { granted, version,
 * currentVersion } }` — matching the real backend (consent-manager
 * getUserConsents), NOT an array.
 */
export interface PaymentTermsConsentStatus {
    consents?: Record<
        string,
        {
            granted?: boolean;
            version?: string;
            /**
             * The version a new grant would be recorded under, as the server
             * reports it (consent-manager getUserConsents). The client never
             * carries a version string of its own: one consent namespace, the
             * server's.
             */
            currentVersion?: string | null;
        } | undefined
    >;
}

/**
 * True when a granted PAYMENT_TERMS consent exists in a GET /consent body.
 * Pure + exported so the parser is testable against the REAL response shape
 * (MUST-2, adversarial verify 2026-07-08: an array-shaped parse here was
 * dead code — the "already accepted" state never rendered).
 */
export function isPaymentTermsGranted(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const consents = (data as PaymentTermsConsentStatus).consents;
    if (!consents || typeof consents !== 'object' || Array.isArray(consents)) return false;
    const paymentTerms = consents.PAYMENT_TERMS;
    if (paymentTerms?.granted !== true) return false;
    // F-G4-64: a grant given under a superseded version is not an acceptance of
    // the terms now in force — the backend gate refuses it
    // (services/billing/payment-terms-gate.js). Answering true here would show
    // "ท่านได้ยอมรับเงื่อนไขนี้ไว้แล้ว", hide the checkbox, and leave the applicant
    // holding a 409 with no control to act on. When the server reports no
    // currentVersion (older deploy), the grant is trusted exactly as before.
    const currentVersion = paymentTerms.currentVersion;
    if (typeof currentVersion === 'string' && currentVersion) {
        return paymentTerms.version === currentVersion;
    }
    return true;
}

export function classifyInvoiceSide(serviceType: string | null | undefined): InvoiceSide {
    const normalized = String(serviceType || '').trim().toUpperCase();
    if (normalized.endsWith('_STATE_FEE')) return 'DTAM';
    // _PLATFORM_FEE, SUBSCRIPTION*, anything else → PLATFORM.
    return 'PLATFORM';
}

/**
 * V6-A — semantic alias of `classifyInvoiceSide()` for the receipts-issuance
 * context (apps/web-app/src/app/provider/receipts/page.tsx). Receipts are
 * issued against invoices, so the classification rule is identical; the
 * alias exists so future contributors searching for "receipt side"
 * (rather than "invoice side") find the canonical helper without having
 * to grep across modules. Behaviour MUST stay in lock-step with the
 * backend `classifyInvoiceSide()` in
 * apps/backend/services/finance/invoice-side.js.
 */
export const classifyReceiptSide = classifyInvoiceSide;

// ── Quotation (ใบเสนอราคา) — farmer review/accept before Phase-1 payment ──
// Mirrors the backend GET /api/applications/:id/quotations contract
// (apps/backend/routes/api/applications/quotations.js). One row per issuer
// side (DTAM state fee / PLATFORM service fee), each carrying per-cultivation-
// type `lineItems` derived from the canonical fee math.

export type QuotationIssuerType = 'DTAM' | 'PLATFORM';

// Lifecycle states from the Quotation schema (billing.prisma). The applicant
// can only accept while PENDING / SENT / DRAFT; the rest are terminal/transient.
export type QuotationStatus =
    | 'DRAFT'
    | 'PENDING'
    | 'SENT'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'INVOICED';

// One per cultivation type (Indoor / Greenhouse / Outdoor) — the same rows the
// official DTAM ใบเสนอราคา PDF renders. Built by buildQuotationLineItems.
export interface QuotationLineItem {
    method: string;
    label: string;
    phase1Amount: number;
    phase2Amount: number;
    netAmount: number;
    taxAmount: number;
}

/**
 * The figures frozen at the moment the applicant pressed ยอมรับ
 * (buildAcceptanceSnapshot, apps/backend/services/quotation-service.js). The
 * checkout screen shows the instalment from HERE, never from a live fee
 * calculation: this is the document the charge is compared against
 * (assertChargeMatchesAcceptedFigures). Only the fields a screen reads are
 * declared; the row carries more.
 */
export interface QuotationAcceptedSnapshot {
    quotationNumber?: string | null;
    issuerType?: string | null;
    currency?: string;
    installments?: Array<{
        phase: string;
        amount: number | string;
        stateAmount?: number | string;
        platformAmount?: number | string;
        vatAmount?: number | string;
        phaseTotal?: number | string;
    }> | null;
}

export interface QuotationRecord {
    id: string;
    applicationId: string;
    issuerType: QuotationIssuerType;
    quotationNumber: string;
    // Prisma Decimal columns serialize to strings — accept either.
    subtotal: number | string;
    vat: number | string;
    totalAmount: number | string;
    /**
     * The row's own instalments, exactly as the register stores them.
     *
     * `amount` is ISSUER-SPECIFIC (a pre-W14 PLATFORM row asks for platform +
     * VAT only); the split below is written identically onto both issuers'
     * entries and describes the WHOLE phase (GAP-5,
     * quotation-service._buildInstallments). A screen naming the price of an
     * instalment must read the split, never `amount` — see acceptedPhaseAmount.
     * A pre-GAP-5 entry carries `{phase, amount}` and nothing else.
     */
    installments?: Array<{
        phase: string;
        amount: number;
        stateAmount?: number | string;
        platformAmount?: number | string;
        vatAmount?: number | string;
        phaseTotal?: number | string;
    }> | null;
    status: QuotationStatus;
    /**
     * The last day the offer stands (quotations.validUntil, 30 days from issue).
     * F-G4-64 final round R1/R21: this is not decoration — the acceptance door
     * itself refuses a lapsed row with QUOTATION_EXPIRED, so every screen that
     * draws an accept button has to read it.
     */
    validUntil?: string | null;
    acceptedAt?: string | null;
    /** Present once the row is ACCEPTED — the figures the acceptance froze. */
    acceptedSnapshot?: QuotationAcceptedSnapshot | null;
    // F-G4-64: who pressed ยอมรับ, and when each instalment was billed. A row
    // closed by the repair script (spec §3.7) is INVOICED with acceptedAt AND
    // acceptedBy null on purpose — the money is a fact, the acceptance is not.
    acceptedBy?: string | null;
    phase1InvoicedAt?: string | null;
    phase2InvoicedAt?: string | null;
    createdAt: string;
    lineItems?: QuotationLineItem[];
    /**
     * Coordinator ruling 12: the row decides how many lines its document has.
     * True when the application's cultivation-method count today differs from
     * the scopeCount the row was priced under (the form was revised after
     * issuance), in which case `lineItems` carry the row's own figures under
     * generic labels. Set by GET /api/applications/:id/quotations.
     */
    scopeMismatch?: boolean;
    applicationScopeCount?: number | null;
}

export interface QuotationsBySide {
    dtam: QuotationRecord | null;
    platform: QuotationRecord | null;
}

/**
 * What POST /quotations/:issuer/accept told us (final round R20). `code` is the
 * backend's stable identifier; its absence means no answer came back at all.
 */
export type QuotationAcceptResult =
    | { ok: true; row: QuotationRecord }
    | { ok: false; code?: string };

/**
 * The two states that mean "the applicant accepted". Mirrors the backend gate's
 * QUOTATION_ACCEPTED_STATES (apps/backend/services/billing/quotation-gate.js):
 * ACCEPTED is the direct result of pressing ยอมรับใบเสนอราคา, INVOICED is the
 * post-acceptance terminal.
 */
export const QUOTATION_ACCEPTED_STATUSES: readonly QuotationStatus[] = ['ACCEPTED', 'INVOICED'];

/** One row is accepted. `null`/`undefined` = nothing to accept = not accepted. */
export function isQuotationAccepted(quotation: QuotationRecord | null | undefined): boolean {
    return Boolean(quotation) && QUOTATION_ACCEPTED_STATUSES.includes(quotation!.status);
}

/**
 * The states in which the applicant may still press ยอมรับใบเสนอราคา. Mirrors
 * markQuotationAccepted's own guard (apps/backend/services/quotation-service.js:
 * DRAFT / PENDING / SENT); every other state is terminal for that act.
 *
 * One source for both surfaces that decide it: the card that draws the accept
 * button (QuotationReviewSection) and the pay entry that points at that card
 * (/health/payments). While the two derived it separately, the entry told
 * applicants with an EXPIRED row to go and press a button the card below
 * deliberately does not draw.
 */
export const QUOTATION_ACCEPTABLE_STATUSES: readonly QuotationStatus[] = ['PENDING', 'SENT', 'DRAFT'];

/** What a screen needs to answer "may this still be accepted?" — nothing more. */
export type QuotationAcceptability = Pick<QuotationRecord, 'status' | 'validUntil'>;

/**
 * Has the offer window closed on a row nobody has accepted yet?
 *
 * F-G4-64 final round R1: `markQuotationAccepted` refuses a lapsed DRAFT /
 * PENDING / SENT row with QUOTATION_EXPIRED, exactly as the payment gate does.
 * An ACCEPTED row never lapses — an agreement does not expire because the offer
 * window closed — which is why the status test comes first.
 */
export function isQuotationLapsed(
    quotation: QuotationAcceptability | null | undefined,
): boolean {
    if (!quotation) return false;
    if (!QUOTATION_ACCEPTABLE_STATUSES.includes(quotation.status)) return false;
    if (!quotation.validUntil) return false;
    const until = new Date(quotation.validUntil).getTime();
    if (!Number.isFinite(until)) return false;
    return until < Date.now();
}

/**
 * `undefined` = that side has no quotation at all, which is nothing to accept.
 *
 * Takes the ROW, not the status alone (final round R21): the backend door reads
 * status AND validUntil, and a screen that read only the status drew a ยอมรับ
 * button whose press could only ever answer 409.
 */
export function isQuotationAcceptable(
    quotation: QuotationAcceptability | null | undefined,
): boolean {
    if (!quotation) return false;
    if (!QUOTATION_ACCEPTABLE_STATUSES.includes(quotation.status)) return false;
    return !isQuotationLapsed(quotation);
}

/**
 * The Thai the applicant is shown when the acceptance itself is refused.
 *
 * Final round R20 (finding S14): `acceptQuotation` used to answer `null` for
 * everything, so both accept surfaces printed "กรุณาลองใหม่อีกครั้ง" — including
 * for the two refusals that can never succeed on retry. One function, two
 * surfaces (the wizard's slot 10 and the payments card), so the same refusal
 * cannot become two different sentences.
 *
 * Each sentence mirrors the catalogue row it stands for
 * (apps/backend/shared/error-codes.js) and adds the one thing the catalogue
 * cannot know: WHICH document. Where staff are named, they are asked to LOOK at
 * a document, never to issue one: the product has no staff issuance door
 * (ledger F-G4-71).
 *
 * Last items of the final round: this sentence used to promise the replacement
 * outright ("ระบบจะออกใบใหม่ให้เมื่อคุณกลับไปที่หน้ารายการชำระเงิน"). The payments
 * read really does replace a lapsed offer — but not for a pre-W14 DTAM+PLATFORM
 * pair, not for an M2-payable application whose lapsed row prices both
 * instalments, and not for a row whose งวดที่ 2 is already invoiced
 * (apps/backend/services/quotation-issuance-on-submit.js: _lapsedOfferToReplace
 * and mayReplaceLapsedQuotation). The surfaces that show THIS constant hold no
 * rows, so they cannot tell those shapes apart; the sentence names the door
 * that may replace the offer and the action for when it does not.
 * Byte-identical with error-codes.js QUOTATION_EXPIRED.messageTh.
 */
export const QUOTATION_EXPIRED_COPY_TH =
    'ใบเสนอราคาเกินกำหนดยืนราคาแล้ว กรุณากลับไปที่หน้ารายการชำระเงิน หากระบบไม่ออกใบใหม่ให้ กรุณาติดต่อเจ้าหน้าที่พร้อมแจ้งเลขที่ใบเสนอราคา';

/**
 * The application holds no quotation at all, so no rail can take money for it.
 *
 * Byte-identical with error-codes.js QUOTATION_NOT_ISSUED.messageTh, and shared
 * by every surface that maps the code (the checkout screen, the
 * preview page's submit door). The read mints a late quotation only inside
 * SELF_HEAL_STATUSES (M1 minus DRAFT), and R3 routes an M2-payable application
 * with no row to this same refusal, so "refresh and it will appear" was false
 * for exactly the applicants who meet it. What is left is the cause and the one
 * thing that lets staff look at the case at all, the application number.
 */
export const QUOTATION_NOT_ISSUED_COPY_TH =
    'ระบบยังไม่ออกใบเสนอราคาของคำขอนี้ จึงยังชำระเงินไม่ได้ กรุณาติดต่อเจ้าหน้าที่พร้อมแจ้งเลขที่คำขอ';

/**
 * The document exists and is still an offer: the tick has not been pressed.
 *
 * Said the same way wherever the refusal is met away from the tick itself (the
 * checkout screen and the preview page's file door), because the button that
 * clears it is on the payments list in both cases.
 */
export const QUOTATION_NOT_ACCEPTED_COPY_TH =
    'กรุณากดยอมรับใบเสนอราคาที่หน้ารายการชำระเงินก่อน แล้วจึงกลับมาชำระเงินอีกครั้ง';

/**
 * The Thai for a quotation-gate refusal met by a surface that carries no
 * quotation of its own, or `null` when the code is not one of the gate's.
 *
 * The gate (apps/backend/services/billing/quotation-gate.js) answers
 * `error: '<CODE>'`, and api-client keeps that identifier in `.code` while
 * `.error` falls through `toUserFriendlyError` unchanged — so a caller that
 * prints `.error` prints the raw enum. This is what a screen with no accept
 * control says instead; the surfaces that DO hold the rows say more, from
 * quotationLapsedNoticeTh and quotationAcceptFailureMessage.
 */
export function quotationGateRefusalTh(code: string | null | undefined): string | null {
    switch (String(code || '').trim().toUpperCase()) {
        case 'QUOTATION_NOT_ISSUED':
            return QUOTATION_NOT_ISSUED_COPY_TH;
        case 'QUOTATION_NOT_ACCEPTED':
            return QUOTATION_NOT_ACCEPTED_COPY_TH;
        case 'QUOTATION_EXPIRED':
            return QUOTATION_EXPIRED_COPY_TH;
        default:
            return null;
    }
}

/**
 * The same fact, told on the payments list itself — where "go back to the
 * payments list" would name the screen the applicant is already standing on.
 * The GET this page makes is what issues the replacement, and the รีเฟรช button
 * is what calls it again.
 */
export const QUOTATION_EXPIRED_ON_LIST_COPY_TH =
    'ใบเสนอราคาของคำขอนี้เกินกำหนดยืนราคาแล้ว ระบบจะออกใบใหม่ให้ กรุณากดรีเฟรชหน้านี้ แล้วกดยอมรับใบใหม่ก่อนชำระเงิน';

/** Nothing came back at all (no HTTP answer) — the one failure a retry clears. */
const ACCEPT_RETRY_COPY_TH =
    'บันทึกการยอมรับใบเสนอราคาไม่สำเร็จ ยังไม่มีการบันทึกการยอมรับของคุณ กรุณาลองใหม่อีกครั้ง';

export function quotationAcceptFailureMessage(
    code: string | null | undefined,
    quotationNumber: string,
): string {
    switch (code) {
        case 'SNAPSHOT_REQUIRED':
            return `ระบบบันทึกการยอมรับใบเสนอราคาไม่ได้เพราะใบนี้ไม่มีตัวเลขครบ กรุณาติดต่อเจ้าหน้าที่พร้อมแจ้งเลขที่ใบเสนอราคา ${quotationNumber}`;
        case 'QUOTATION_EXPIRED':
            return `ใบเสนอราคาเลขที่ ${quotationNumber} เกินกำหนดยืนราคาแล้ว กรุณากลับไปที่หน้ารายการชำระเงินเพื่อให้ระบบตรวจสอบและออกใบใหม่`;
        case 'INVALID_QUOTATION_STATUS':
            return `สถานะของใบเสนอราคาเลขที่ ${quotationNumber} เปลี่ยนไปแล้ว จึงกดยอมรับซ้ำไม่ได้ ระบบได้ดึงสถานะล่าสุดมาแสดงให้แล้ว`;
        default:
            return ACCEPT_RETRY_COPY_TH;
    }
}

/**
 * The two instalments, named the way every screen in this product names them
 * (final round R16). ONE constant: the wizard's document lines, the checkout
 * summary and the created-order screen all read it, so no surface can print the
 * raw enum 'M1' next to a document that calls the same thing งวดที่ 1.
 */
export type QuotationPhase = 'PHASE_1' | 'PHASE_2';
export type PaymentMilestone = 'M1' | 'M2';

// ถ้อยคำตรงกับ apps/backend/shared/instalment-service-names.js (มติ 2026-09-07:
// "เราแยกตามบริการ เช่น ค่าบริการตรวจสอบเอกสาร") — สองฝั่งต้องเรียกงวดด้วยชื่อบริการเดียวกัน
// ไม่งั้นใบเสนอราคากับหน้าจ่ายเงินพูดคนละคำเรื่องเงินก้อนเดียวกัน
export const PHASE_LABEL_TH: Record<QuotationPhase, string> = {
    PHASE_1: 'งวดที่ 1 ค่าบริการตรวจสอบเอกสาร',
    PHASE_2: 'งวดที่ 2 ค่าบริการตรวจประเมินแปลงและออกใบรับรอง',
};

const MILESTONE_PHASE: Record<PaymentMilestone, QuotationPhase> = {
    M1: 'PHASE_1',
    M2: 'PHASE_2',
};

/** The instalment a checkout milestone collects, or null if it names neither. */
export function milestonePhase(milestone: string | null | undefined): QuotationPhase | null {
    const key = String(milestone || '').trim().toUpperCase();
    return key === 'M1' || key === 'M2' ? MILESTONE_PHASE[key] : null;
}

/** Thai name of a checkout milestone, or null — never the raw enum. */
export function milestoneLabelTh(milestone: string | null | undefined): string | null {
    const phase = milestonePhase(milestone);
    return phase ? PHASE_LABEL_TH[phase] : null;
}

/** The whole-phase price an instalment records, or null if it records none. */
function phaseTotalOf(instalment: {
    stateAmount?: number | string;
    platformAmount?: number | string;
    vatAmount?: number | string;
    phaseTotal?: number | string;
} | undefined): number | null {
    if (!instalment) return null;
    if (instalment.phaseTotal !== undefined && instalment.phaseTotal !== null) {
        const frozen = Number(instalment.phaseTotal);
        if (Number.isFinite(frozen)) return frozen;
    }
    // The split. All three columns are written together or not at all
    // (_buildInstallments), so a missing state amount means this is a
    // pre-GAP-5 entry that never recorded what the phase costs.
    const { stateAmount, platformAmount, vatAmount } = instalment;
    if (stateAmount === undefined || stateAmount === null) return null;
    const sum = Number(stateAmount) + Number(platformAmount ?? 0) + Number(vatAmount ?? 0);
    return Number.isFinite(sum) ? sum : null;
}

/**
 * What the accepted document says this INSTALMENT costs — the whole phase.
 *
 * Read, never computed from a rate table: the frozen `phaseTotal` of the
 * acceptance snapshot when the row carries one, otherwise the phase split the
 * row itself records (state + platform + VAT). `null` when the document does
 * not price that instalment at all — the case the backend refuses under
 * CHECKOUT_PHASE_NOT_PRICED — and null, too, when the row is old enough to
 * record no phase price at all.
 *
 * Fix round 1 (reviewer MAJOR): this used to fall back to the row's own
 * `installments[phase].amount`, which is the ISSUER'S slice — on a pre-W14
 * PLATFORM row, platform + VAT alone (4,425 of a 29,425 phase, see
 * apps/backend/services/quotation-line-items.js instalmentPayable). A pre-W14
 * row closed as INVOICED by the repair script (spec §3.7) carries no snapshot,
 * so that fallback was exactly what such an applicant saw on the checkout
 * screen while the charge was minted from the full breakdown: consent taken
 * against one number, money taken against another.
 *
 * The split is the honest reading because it is written identically onto both
 * rows of a pre-W14 pair and describes the FULL phase — so the two documents of
 * a pair cannot answer differently, and no caller has to know which shape it
 * holds.
 */
export function acceptedPhaseAmount(
    quotation: QuotationRecord | null | undefined,
    phase: QuotationPhase,
): number | null {
    if (!quotation) return null;
    const frozen = phaseTotalOf(
        quotation.acceptedSnapshot?.installments?.find((it) => it.phase === phase),
    );
    if (frozen !== null) return frozen;
    return phaseTotalOf((quotation.installments ?? []).find((it) => it.phase === phase));
}

/**
 * Where the applicant is standing when a lapsed offer has to be explained.
 * `payments-list` is the page whose own GET performs the replacement.
 */
export type LapsedNoticeSurface = 'payments-list' | 'elsewhere';

/**
 * What to say about an offer whose window closed — promising the replacement
 * ONLY where the backend really issues one.
 *
 * Fix round 1 (reviewer MINOR): `_lapsedOfferToReplace`
 * (apps/backend/services/quotation-issuance-on-submit.js) returns null the
 * moment an application holds two live rows, because replacing a pre-W14 pair
 * with one W14 document is a repricing decision, not a repair. An applicant
 * with a lapsed pair who was told "ระบบจะออกใบใหม่ให้ กรุณากดรีเฟรชหน้านี้"
 * could refresh for ever: no new document, no accept button, and no staff
 * issuance door (ledger F-G4-71). The FE is the surface that can tell the two
 * cases apart, because it holds both rows.
 */
export function quotationLapsedNoticeTh(
    quotations: QuotationsBySide | null | undefined,
    surface: LapsedNoticeSurface,
): string {
    const rows = [quotations?.dtam, quotations?.platform].filter(Boolean) as QuotationRecord[];
    if (rows.length > 1) {
        const numbers = rows.map((row) => row.quotationNumber).join(' และ ');
        return 'ใบเสนอราคาของคำขอนี้เกินกำหนดยืนราคาแล้ว '
            + `คำขอนี้มีใบเสนอราคา ${rows.length} ฉบับ ระบบจึงออกใบใหม่ให้อัตโนมัติไม่ได้ `
            + `กรุณาติดต่อเจ้าหน้าที่ พร้อมแจ้งเลขที่เอกสาร ${numbers}`;
    }
    return surface === 'payments-list'
        ? QUOTATION_EXPIRED_ON_LIST_COPY_TH
        : QUOTATION_EXPIRED_COPY_TH;
}

/**
 * Would the payment gate let this application pay? The backend requires EVERY
 * quotation the application holds to be accepted — a pre-W14 application
 * legitimately carries a DTAM row as well, and both priced part of the bill —
 * and refuses QUOTATION_NOT_ISSUED when it holds none. This is the FE mirror of
 * that rule, so a screen never offers a button that leads straight to a 409.
 */
export function isQuotationAcceptedForPayment(
    quotations: QuotationsBySide | null | undefined,
): boolean {
    const rows = [quotations?.dtam, quotations?.platform].filter(Boolean) as QuotationRecord[];
    if (rows.length === 0) return false;
    return rows.every((row) => isQuotationAccepted(row));
}

/**
 * Thai label of a CHECKOUT invoice (ledger F-G4-48). One source for the
 * ประเภท column / detail modal on /health/payments and the card title in
 * PaymentInvoiceCard, so the two never drift apart.
 */
export const CHECKOUT_COMPONENT_LABEL_TH = 'ค่าบริการรับรอง (ราคาเต็ม + ค่าแพลตฟอร์ม)';

/**
 * Thai label of an invoice whose receipt has been issued (ledger F-G4-53).
 * One source for the status chip on /health/payments (table, detail modal)
 * and on the phase card in PaymentInvoiceCard.
 */
export const RECEIPT_ISSUED_LABEL_TH = 'ออกใบเสร็จแล้ว';

/**
 * True once a receipt exists for the invoice: the backend derives
 * erpStatus RECEIPT_ISSUED whenever receiptNumber / receiptIssuedAt is set
 * (apps/backend/services/invoice-service.js toErpStatus), and a
 * receiptNumber on the row is the same fact seen directly.
 */
export function invoiceHasReceipt(
    record: Pick<PaymentRecord, 'erpStatus' | 'receiptNumber'>,
): boolean {
    return record.erpStatus === 'RECEIPT_ISSUED' || Boolean(record.receiptNumber);
}

/**
 * What the document carrying `receiptNumber` is called, per side. The state
 * (DTAM) is VAT-exempt and issues a plain receipt; the company's number is a
 * full tax invoice that doubles as the receipt, so calling it "ใบเสร็จ" alone
 * understates it. One document, one name: the phase card (PaymentInvoiceCard)
 * and the detail modal on /health/payments both read it from here, so the two
 * screens can never name the same number differently.
 */
export function receiptDocumentLabelTH(
    record: Pick<PaymentRecord, 'component'>,
): string {
    return record.component === 'STATE' ? 'ใบเสร็จรับเงิน' : 'ใบเสร็จ/ใบกำกับภาษี';
}

/**
 * The same name as a "number of X" row label, for label/value layouts. Thai
 * builds the noun phrase with no space — the way the same dialog prints
 * 'เลขที่เอกสาร' and the preview prints 'เลขที่ใบแจ้งหนี้' — so 'เลขที่ ' with a
 * gap read as two labels stuck together.
 */
export function receiptNumberRowLabelTH(
    record: Pick<PaymentRecord, 'component'>,
): string {
    return `เลขที่${receiptDocumentLabelTH(record)}`;
}

// serviceType prefix of the checkout rail's milestone invoice. Mirrors
// CHECKOUT_SERVICE_TYPE_PREFIX in apps/backend/jobs/payment-closure-job.js:
// the milestone suffix (_M1 / _M2) is what names the phase.
const CHECKOUT_SERVICE_TYPE_PREFIX = 'CERTIFICATION_CHECKOUT';

const PAID_STATUSES = new Set(['PAID', 'PAID_PENDING_RECEIPT', 'RECEIPT_ISSUED', 'APPROVED']);
// Mirrors INVOICE_STATUS.CANCELLED (apps/backend/services/invoice-service.js).
const CANCELLED_STATUS = 'CANCELLED';

function normalizeServiceType(serviceType?: string, amount?: number): string {
    const raw = String(serviceType || '').trim().toUpperCase();
    if (raw) {
        if (raw === 'APPLICATION_FEE') return 'PHASE_1_STATE_FEE';
        if (raw === 'AUDIT_FEE' || raw === 'PHASE_2_AUDIT' || raw === 'PHASE2_AUDIT') return 'PHASE_2_STATE_FEE';
        return raw;
    }
    return (amount || 0) <= PHASE_1_FEE_THRESHOLD ? 'PHASE_1_STATE_FEE' : 'PHASE_2_STATE_FEE';
}

function mapServicePhaseComponent(serviceType: string) {
    const normalized = normalizeServiceType(serviceType);
    if (normalized.startsWith('PHASE_1_')) {
        return {
            phase: 'PHASE_1' as const,
            component: normalized.includes('PLATFORM') ? 'PLATFORM' as const : 'STATE' as const,
        };
    }
    if (normalized.startsWith('PHASE_2_')) {
        return {
            phase: 'PHASE_2' as const,
            component: normalized.includes('PLATFORM') ? 'PLATFORM' as const : 'STATE' as const,
        };
    }
    if (normalized.startsWith('SUBSCRIPTION_')) {
        return {
            phase: 'SUBSCRIPTION' as const,
            component: 'SUBSCRIPTION' as const,
        };
    }
    // Checkout rail (F-G4-48): the invoice IS the milestone. _M1 → งวดที่ 1,
    // _M2 → งวดที่ 2. A bare legacy 'CERTIFICATION_CHECKOUT' row (pre-milestone,
    // still swept by the backend jobs) names no milestone, so its phase stays
    // UNKNOWN while its kind is still CHECKOUT.
    if (normalized.startsWith(CHECKOUT_SERVICE_TYPE_PREFIX)) {
        const phase = normalized.endsWith('_M1')
            ? 'PHASE_1' as const
            : normalized.endsWith('_M2')
                ? 'PHASE_2' as const
                : 'UNKNOWN' as const;
        return { phase, component: 'CHECKOUT' as const };
    }
    return {
        phase: 'UNKNOWN' as const,
        component: 'UNKNOWN' as const,
    };
}

export const PaymentService = {
    /**
     * The applicant's own applications — id + status only. Used by the payments page to
     * find the payable filing when no invoice rows exist yet (payments-application-id.ts):
     * under the checkout rail the first invoice is minted by the checkout this page
     * starts, so invoice rows cannot be the only way to find the application.
     */
    async getMyApplications(): Promise<Array<{ id: string; status?: string | null }>> {
        const res = await api.get<Array<{ id: string; status?: string }>>('/applications/my');
        return res.success && Array.isArray(res.data) ? res.data : [];
    },

    async getMyPayments(): Promise<PaymentRecord[]> {
        const result = await api.get<ApiResponse>('/invoices/my');
        // api-client NEVER throws: a 500, a timeout and a dropped connection all come
        // back as { success: false, error }. Returning [] here made "the read failed"
        // and "you have no invoices" the same value, so the ONE caller's catch — the
        // branch that sets the page's error state — was unreachable for every real
        // failure (evidence/apple-qa-audit-2026-09-07).
        if (!result.success) {
            throw new Error(result.error || 'ไม่สามารถโหลดข้อมูลการชำระเงินได้');
        }
        if (!result.data) return [];

        const invoices = Array.isArray(result.data)
            ? result.data
            : ((result.data as { data: InvoiceData[] }).data || [result.data as unknown as InvoiceData]);

        return invoices.map((inv: InvoiceData) => {
            const erpStatus = String(inv.erpStatus || inv.status || '').trim().toUpperCase();
            // A voided invoice (INVOICE_STATUS.CANCELLED in
            // apps/backend/services/invoice-service.js) is neither paid nor
            // owed: it must never be summed into ยอดรอชำระ or shown as payable.
            const isCancelled = erpStatus === CANCELLED_STATUS;
            const isPaid = !isCancelled && PAID_STATUSES.has(erpStatus);
            const status = erpStatus || 'PENDING';
            const type = status === 'RECEIPT_ISSUED' ? 'RECEIPT' : 'INVOICE';
            // Money columns are Prisma Decimal(15,2) → serialized as STRINGS in JSON.
            // Coerce to a real number HERE at the API boundary, or every downstream
            // `sum + amount` reduce string-CONCATENATES (e.g. ฿2,675 + ฿25,000 →
            // "0267525000…") — the payments-page total bug. Number() keeps the
            // PaymentRecord.amount contract (number) honest for all consumers.
            const amount = Number(inv.totalAmount ?? inv.amount ?? 0) || 0;
            const serviceType = normalizeServiceType(inv.serviceType, amount);
            const phaseInfo = mapServicePhaseComponent(serviceType);

            const applicationId = inv.applicationId || inv.application?.id || undefined;
            const subscriptionId = inv.subscriptionId || inv.subscription?.id || undefined;
            // A missing receipt is null, never '' or a placeholder.
            const receiptNumber = typeof inv.receiptNumber === 'string' && inv.receiptNumber.trim()
                ? inv.receiptNumber.trim()
                : null;
            // Same rule for the issue date: a missing one is null, never ''.
            const receiptIssuedAt = typeof inv.receiptIssuedAt === 'string' && inv.receiptIssuedAt.trim()
                ? inv.receiptIssuedAt.trim()
                : null;
            return {
                id: inv.id,
                type,
                documentNumber: inv.invoiceNumber || inv.documentNumber || inv.id,
                applicationId,
                subscriptionId,
                amount,
                status,
                erpStatus: status,
                createdAt: inv.createdAt,
                paidAt: inv.paidAt,
                serviceType,
                phase: phaseInfo.phase,
                component: phaseInfo.component,
                isPaid,
                isCancelled,
                receiptNumber,
                receiptIssuedAt,
                // Line-item amounts are Decimal strings too — coerce each.
                lineItems: Array.isArray(inv.lineItems)
                    ? inv.lineItems.map((li) => ({ ...li, amount: Number(li.amount ?? 0) || 0 }))
                    : undefined,
            } as PaymentRecord;
        });
    },

    /**
     * Two-card payment flow (B18-B): fetch issuer + bank channel for a
     * canonical service type. Used by `PaymentInvoiceCard` so each card
     * on the payment screen displays the correct bank account + PromptPay
     * QR for its side (DTAM state-fee vs PLATFORM platform-fee + VAT).
     *
     * The serviceType matches the invoice's own `serviceType` field —
     * one of PHASE_1_STATE_FEE, PHASE_1_PLATFORM_FEE, PHASE_2_STATE_FEE,
     * PHASE_2_PLATFORM_FEE.
     */
    async getIssuerByServiceType(serviceType: string) {
        return api.get<InvoiceIssuerView>(
            `/finance/issuers/by-service-type/${encodeURIComponent(serviceType)}`,
        );
    },

    /**
     * Q4 pre-payment disclosure (owner ruling 2026-07-08): the backend
     * rejects checkout with PAYMENT_TERMS_NOT_ACCEPTED 409 until a granted
     * PAYMENT_TERMS consent exists. The checkout screen checks status on
     * open and records the acknowledgment before starting payment.
     * Terms text: docs/legal/payment-terms-th-v1.1.md (v1 is SUPERSEDED).
     *
     * Response shape (REAL backend contract — consent-manager
     * getUserConsents): `consents` is an OBJECT keyed by category,
     * `{ PAYMENT_TERMS: { granted, version, ... }, ... }` — NOT an array.
     */
    async getPaymentTermsConsent() {
        return api.get<PaymentTermsConsentStatus>('/consent');
    },

    async acceptPaymentTerms() {
        return api.post<{ category?: string; granted?: boolean }>('/consent', {
            category: 'PAYMENT_TERMS',
            granted: true,
        });
    },

    /**
     * Iter 23 — applicant refund-visibility panel.
     *
     * Returns all credit notes issued AGAINST any invoice belonging to
     * the given application. The backend `/finance/credit-notes` route
     * supports `?originalInvoiceId=…` but not `?applicationId=…`, so we
     * fan out: fetch the applicant's invoices, then a credit-note list
     * per invoice. Most applicants have ≤ 2 invoices so this is at most
     * 2 round-trips. Errors on individual lookups don't fail the whole
     * panel — we just return what we got.
     *
     * Returned records are de-duped by `id` and sorted newest-first.
     */
    async getCreditNotes(applicationId: string): Promise<CreditNoteRecord[]> {
        if (!applicationId) return [];
        const invoicesRes = await api.get<ApiResponse>('/invoices/my');
        if (!invoicesRes.success || !invoicesRes.data) return [];

        const invoices = Array.isArray(invoicesRes.data)
            ? (invoicesRes.data as unknown as InvoiceData[])
            : ((invoicesRes.data as unknown as { data: InvoiceData[] }).data
                || [invoicesRes.data as unknown as InvoiceData]);

        const applicationInvoices = invoices.filter(
            (inv) =>
                (inv.applicationId || inv.application?.id) === applicationId,
        );
        if (applicationInvoices.length === 0) return [];

        const results: CreditNoteRecord[] = [];
        const seen = new Set<string>();

        for (const inv of applicationInvoices) {
            const invoiceId = inv.id;
            if (!invoiceId) continue;
            const cnRes = await api.get<CreditNoteRecord[]>(
                `/finance/credit-notes?originalInvoiceId=${encodeURIComponent(invoiceId)}`,
                // Optional refund-visibility enrichment. A 401/403 here (authz
                // mismatch) must NOT bounce the applicant to login — suppress the
                // global auth-redirect and just skip this invoice's credit notes.
                { suppressAuthRedirect: true },
            );
            if (!cnRes.success || !Array.isArray(cnRes.data)) continue;
            for (const raw of cnRes.data) {
                if (!raw || !raw.id || seen.has(raw.id)) continue;
                seen.add(raw.id);
                results.push({
                    id: raw.id,
                    creditNoteNumber: raw.creditNoteNumber,
                    originalInvoiceId: raw.originalInvoiceId || invoiceId,
                    originalInvoiceNumber:
                        raw.originalInvoiceNumber
                        || inv.invoiceNumber
                        || inv.documentNumber
                        || null,
                    reasonCode: raw.reasonCode || null,
                    reason: raw.reason || null,
                    subtotal: Number(raw.subtotal || 0),
                    vat: Number(raw.vat || 0),
                    totalAmount: Number(
                        raw.totalAmount
                        || (Number(raw.subtotal || 0) + Number(raw.vat || 0)),
                    ),
                    status: (raw.status || 'DRAFT') as CreditNoteStatus,
                    issuedAt: raw.issuedAt || null,
                    postedAt: raw.postedAt || null,
                    createdAt: raw.createdAt,
                });
            }
        }

        return results.sort(
            (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },

    // ── Quotation review/accept ──────────────────────────────────────────
    // Fetch the application's DTAM + PLATFORM quotations (each with per-type
    // lineItems) so the farmer can review before paying Phase-1.
    //
    // Two different answers, because they are two different facts and the
    // screens say different things about them (F-G4-64 review r0 minor 6):
    //   {dtam:null, platform:null} — the register answered, and holds none.
    //   null                       — the lookup itself failed (5xx, dropped
    //                                connection, 404). The client does NOT know
    //                                whether a quotation exists, so it may not
    //                                tell the applicant that one is being
    //                                issued. Both read as NOT ACCEPTED at every
    //                                gate, so this stays fail-closed.
    // Never throws either way.
    async getQuotations(applicationId: string): Promise<QuotationsBySide | null> {
        // No application in hand: there is no lookup to fail.
        if (!applicationId) return { dtam: null, platform: null };
        const res = await api.get<{ dtam: QuotationRecord | null; platform: QuotationRecord | null }>(
            `/applications/${encodeURIComponent(applicationId)}/quotations`,
            // A 404 here means "not the owner" or "no quotation issued yet" —
            // neither should bounce the applicant to login.
            { suppressAuthRedirect: true },
        );
        if (!res.success || !res.data) return null;
        return {
            dtam: res.data.dtam ?? null,
            platform: res.data.platform ?? null,
        };
    },

    /**
     * Applicant accepts a quotation (PENDING/SENT/DRAFT → ACCEPTED).
     *
     * Answers the ROW on success and the backend's CODE on refusal (final round
     * R20). It used to collapse the whole envelope to `null`, so the two accept
     * surfaces could not tell a dropped connection from SNAPSHOT_REQUIRED and
     * both asked for a retry that, for two of the three refusals, can never
     * succeed. A result with no `code` means no answer arrived — the one
     * failure a retry really can clear.
     *
     * Never throws: `api.post` resolves envelopes.
     */
    async acceptQuotation(
        applicationId: string,
        issuerType: QuotationIssuerType,
    ): Promise<QuotationAcceptResult> {
        if (!applicationId || !issuerType) return { ok: false };
        const res = await api.post<QuotationRecord>(
            `/applications/${encodeURIComponent(applicationId)}/quotations/${issuerType}/accept`,
        );
        if (res.success && res.data) return { ok: true, row: res.data };
        // The identifier rides in `code` after api-client's harvest, and in
        // `error` on envelopes it did not rewrite. Both carry the same string.
        //
        // Fix round 1 (reviewer MINOR): `error` ALSO carries api-client's own
        // transport sentences ('Unable to connect to server', 'Request
        // timeout. Please try again'), which are display copy, not codes.
        // Harvesting those would make a dropped connection read as a permanent
        // refusal at every later `if (result.code)`, so only identifier-shaped
        // values count — the catalogue's codes are SCREAMING_SNAKE
        // (apps/backend/shared/error-codes.js).
        const raw = (res.code || res.error || '').trim();
        const code = /^[A-Z][A-Z0-9_]+$/.test(raw) ? raw : '';
        return code ? { ok: false, code } : { ok: false };
    },

    // Open the per-phase quotation PDF (?phase=1|2) in a new tab. Uses getBlob
    // so the bearer token + active-entity headers ride along, then hands the
    // browser an object URL. Mirrors downloadInvoicePdf's auth approach but
    // opens inline (the backend sends Content-Disposition: inline).
    async viewQuotationPdf(
        applicationId: string,
        issuerType: QuotationIssuerType,
        phase: 1 | 2,
    ): Promise<boolean> {
        if (!applicationId || !issuerType) return false;
        const blob = await api.getBlob(
            `/applications/${encodeURIComponent(applicationId)}/quotations/${issuerType}/pdf?phase=${phase}`,
        );
        if (!blob) return false;
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        // Revoke after a tick so the new tab has time to claim the blob.
        window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
        return true;
    },

    async downloadInvoicePdf(invoiceId: string, invoiceNumber: string) {
        try {
            const token = AuthService.getToken();
            const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            });

            if (!res.ok) {
                throw new Error('Download failed');
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${invoiceNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            return true;
        } catch (error: unknown) {
            console.error('Download error', error);
            return false;
        }
    },
};
