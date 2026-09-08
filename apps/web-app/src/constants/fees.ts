/**
 * GACP Fee Constants — Single Source of Truth
 *
 * These are FALLBACK values used when the API is unavailable.
 * Primary source: GET /api/pricing/fees (backed by database)
 *
 * To change fees: update the database via the admin panel.
 * Only change these if the API itself changes its defaults.
 */

/** ค่าตรวจสอบเอกสารเบื้องต้น — Phase 1 (ต่อรูปแบบการปลูก) */
export const GACP_APPLICATION_FEE = 5_000;

/** ค่าตรวจประเมินพื้นที่ — Phase 2 (ต่อรูปแบบการปลูก) */
export const GACP_INSPECTION_FEE = 25_000;

/**
 * ค่าต่ออายุใบรับรอง ฐานก่อน VAT และก่อนค่าบริการแพลตฟอร์ม (มติ operator 2026-08-22)
 *
 * A renewal is ONE charge at this base, with no document-review phase
 * ("ต่ออายุ 30,000 ครั้งเดียว และไม่ตรวจเอกสาร นัดลงพื้นที่อย่างเดียว").
 *
 * MIRROR, not a second source. The amount of record is FEES.RENEWAL_PER_CERT in
 * apps/backend/config/business-rules.js (SystemConfig key fee.renewal_per_cert),
 * served as renewalFee by GET /api/pricing/fees. The two are compared to each
 * other, not to a literal, by apps/backend/__tests__/unit/renewal-fee-ssot.test.js
 * case D, so moving one and forgetting the other turns that suite red.
 *
 * NEVER render this alone: it is the base, not the amount due. Screens must
 * show it beside GACP_RENEWAL_PAYABLE_PER_SCOPE.
 */
export const GACP_RENEWAL_FEE = 30_000;

// M4 (มติ operator 2026-08-23): "ไม่มีค่าเร่งด่วน" — ยกเลิกค่าเร่งด่วนทั้งหมด
// เดิมตรงนี้คือ GACP_EXPEDITE_FEE = 10_000 คู่กับ expediteFee ของ GET /api/pricing
// (และอีกราคาหนึ่ง 3,000 ใน backend config) ไม่มีใบแจ้งหนี้ใดเคยเรียกเก็บ ห้ามนำกลับมา

/** อัตราค่าบริการ Platform (10%) */
export const GACP_PLATFORM_RATE = 0.1;

/** อัตรา VAT (7%) — คิดบน "ค่าบริการ" ทั้งก้อน (ราคาเต็ม + ค่าแพลตฟอร์ม) */
export const GACP_VAT_RATE = 0.07;

/** อัตราค่าบริการ Platform เป็นเปอร์เซ็นต์ (10) */
export const GACP_PLATFORM_FEE_PERCENT = 10;

/**
 * ค่าบริการ = ราคาเต็ม + ค่าแพลตฟอร์ม 10%
 * W14 — มติ operator 2026-08-22 (HARNESS_LOG.md c28355ea, ยืนยันตัวเลข d1c33ea0)
 */
export const gacpServiceFee = (base: number) => base + base * GACP_PLATFORM_RATE;

/**
 * ยอดชำระ = ค่าบริการ + VAT 7% ของค่าบริการทั้งก้อน
 *
 * สูตรเดิมคิด VAT เฉพาะส่วนค่าแพลตฟอร์ม (base × 10% × 7%) — ถอดออกทั้งหมด
 * เพราะบริษัทเป็นผู้ออกเอกสารรายเดียว ค่าบริการทั้งก้อนจึงเป็นรายได้ที่ต้องเสีย
 * VAT ของบริษัท ไม่มีขาที่ยกเว้น VAT อีกต่อไป
 */
const withPlatformAndVat = (base: number) => {
  // Rounded per component, exactly as the backend's buildPhaseFee does, so the
  // fallback shown offline can never differ by a satang from the live quote.
  const fee = gacpServiceFee(base);
  return fee + Math.round(fee * GACP_VAT_RATE);
};

/** ยอดรวม Phase 1 ต่อรูปแบบ (5,000 + 500 = 5,500 + VAT 385 = 5,885) */
export const GACP_PHASE1_TOTAL = withPlatformAndVat(GACP_APPLICATION_FEE);

/** ยอดรวม Phase 2 ต่อรูปแบบ (25,000 + 2,500 = 27,500 + VAT 1,925 = 29,425) */
export const GACP_PHASE2_TOTAL = withPlatformAndVat(GACP_INSPECTION_FEE);

/**
 * ยอดที่ต้องชำระจริงของการต่ออายุ ต่อรูปแบบการปลูก
 * (30,000 + 3,000 = ค่าบริการ 33,000 + VAT 2,310 = 35,310)
 *
 * The renewal base grossed up by withPlatformAndVat above — the SAME helper
 * that turns 5,000 into 5,885 and 25,000 into 29,425, so the rates are not
 * declared a second time here. The backend computes this through
 * modules/billing/internal/fee-service.js buildPhaseFee and serves it as
 * renewalTotalPerScope; the two are pinned equal by
 * apps/backend/__tests__/unit/renewal-fee-ssot.test.js.
 *
 * FALLBACK only. The live number is the API's.
 */
export const GACP_RENEWAL_PAYABLE_PER_SCOPE = withPlatformAndVat(GACP_RENEWAL_FEE);

/** จำนวนงวดที่ต้องชำระสำหรับการต่ออายุ: ครั้งเดียว ไม่มีงวดที่ 2 (ไม่ขึ้นกับจำนวนรูปแบบการปลูก) */
export const GACP_RENEWAL_CHARGE_COUNT = 1;

/** ยอดรวมต่อประเภท (Phase1 + Phase2) */
export const GACP_PER_TYPE_TOTAL = GACP_APPLICATION_FEE + GACP_INSPECTION_FEE;

/**
 * Threshold สำหรับแบ่ง Phase 1 / Phase 2
 * payments ≤ ค่านี้ → Phase 1, payments > ค่านี้ → Phase 2
 */
export const PHASE_1_FEE_THRESHOLD = GACP_APPLICATION_FEE;

// Structured Line Items (SSoT for Invoice generation)

export interface FeeLineItem {
  code: string;
  description: string;
  unitPrice: number;
  phase: 'PHASE_1' | 'PHASE_2' | null;
  isTaxable: boolean;
}

/** รายการค่าธรรมเนียมพื้นฐาน — ใช้สร้าง Invoice Line Items */
export const GACP_FEE_LINE_ITEMS: FeeLineItem[] = [
  {
    code: 'DOC_REVIEW',
    description: 'ค่าอ่าน/พิจารณาเอกสาร',
    unitPrice: GACP_APPLICATION_FEE,
    phase: 'PHASE_1',
    // W14 — ทุกบรรทัดเป็นส่วนหนึ่งของค่าบริการของบริษัท จึงเสีย VAT ทั้งหมด
    // (เดิม false เพราะเคยถือเป็นค่าธรรมเนียมรัฐที่ยกเว้น VAT)
    isTaxable: true,
  },
  {
    code: 'FIELD_AUDIT',
    description: 'ค่าลงพื้นที่ตรวจประเมิน',
    unitPrice: GACP_INSPECTION_FEE,
    phase: 'PHASE_2',
    isTaxable: true,
  },
];
