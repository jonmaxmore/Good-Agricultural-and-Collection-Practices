/**
 * GACP Platform - Enhanced Payment Fees Configuration
 * ค่าธรรมเนียมที่ปรับปรุงตาม workflow ใหม่ (October 2025)
 *
 * กฎการชำระเงิน:
 * - Phase 1 (5,000 บาท): ค่าธรรมเนียมตรวจสอบเอกสาร
 * - Phase 2 (25,000 บาท): ค่าธรรมเนียมตรวจสอบภาคสนาม
 * - หากถูกขอแก้ไข ต้องแก้ภายใน 5 วันทำการ ไม่งั้น EXPIRED → ต้องยื่นคำขอใหม่ + จ่ายค่าธรรมเนียมใหม่
 * - ไม่มีจำกัดจำนวนรอบการแก้ไข (revision/CAR ไม่จำกัดรอบ)
 * - ไม่มี Phase 3 (ไม่เก็บค่าออกใบรับรอง)
 */

// ── THE TARIFF HAS ONE HOME, AND IT IS NOT THIS FILE ─────────────────────────
// Every amount below is DERIVED from config/business-rules.js (which itself takes
// overrides from the DB), so this module is a VIEW of the tariff and can never hold a
// second opinion about it.
//
// It used to hold literals — 5000, 25000, and the computed totals 5885 / 29425 / 35310
// written out by hand. Two copies of a fee agree until the day one is edited, and from
// then on the amount an applicant is shown, the amount invoiced and the amount remitted
// to the department are three different numbers with no way to say which is right.
// GOALS.md G1 records the consequence as the "บั๊ก 30k/15k" and makes one fee source a
// hard gate for taking real money. scripts/probes/fee-single-source.sh is the machine
// that now enforces it.
//
// The derivation is the W14 ruling (operator 2026-08-22, HARNESS_LOG.md c28355ea):
// VAT is charged on the WHOLE service — state fee plus platform fee — not on the
// platform fee alone.
const { FEES } = require('./business-rules');

/**
 * state fee → { govFee, serviceFee, vat, total }, all derived, none written down.
 *
 * ROUNDING mirrors modules/billing/internal/fee-service.js line for line, because two
 * rounding conventions for one tariff is the duplication this file was cleaned to end.
 * At the configured rates it never actually rounds — state is a multiple of 5,000, so
 * 10% of it and 7% of 11/10 × state both land on integers (5,500 × 0.07 = 385). What
 * Math.round is for is the SystemConfig override: a rate set from the database must not
 * be able to mint fractional satang, and IEEE-754 alone would have published
 * 385.00000000000006 on an invoice.
 */
function phaseAmounts(stateFee) {
  const serviceFee = Math.round(stateFee * FEES.PLATFORM_RATE);
  const vat = Math.round((stateFee + serviceFee) * FEES.VAT_RATE);
  return { govFee: stateFee, serviceFee, vat, total: stateFee + serviceFee + vat };
}

const PHASE_1 = phaseAmounts(FEES.PHASE1_PER_SCOPE);
const PHASE_2 = phaseAmounts(FEES.PHASE2_PER_SCOPE);

const PAYMENT_FEES = {
  // ค่าธรรมเนียมรัฐ — read, never re-declared.
  DOCUMENT_REVIEW_FEE: PHASE_1.govFee, // ค่าธรรมเนียมตรวจสอบเอกสาร (Phase 1)
  FIELD_AUDIT_FEE: PHASE_2.govFee,     // ค่าธรรมเนียมตรวจสอบภาคสนาม (Phase 2)

  // อัตราค่าบริการและภาษี
  SERVICE_FEE_RATE: FEES.PLATFORM_RATE,
  VAT_RATE: FEES.VAT_RATE,

  // ยอดรวมแยกตาม Phase — คำนวณจาก Base + Service Fee + VAT (W14)
  PHASE_1_GOV_FEE: PHASE_1.govFee,
  PHASE_1_SERVICE_FEE: PHASE_1.serviceFee,
  PHASE_1_VAT: PHASE_1.vat,
  PHASE_1_TOTAL: PHASE_1.total,

  PHASE_2_GOV_FEE: PHASE_2.govFee,
  PHASE_2_SERVICE_FEE: PHASE_2.serviceFee,
  PHASE_2_VAT: PHASE_2.vat,
  PHASE_2_TOTAL: PHASE_2.total,

  // ค่าธรรมเนียมพิเศษ — ยื่นซ้ำคิดเท่าค่าตรวจเอกสาร ไม่ใช่ตัวเลขของตัวเอง
  RE_SUBMISSION_FEE: PHASE_1.govFee,
  // M4 (operator ruling 2026-08-23): the rush-processing fee is abolished
  // ("ไม่มีค่าเร่งด่วน"). The constant that stood here said 3,000 while
  // GET /api/pricing advertised 10,000 — one fee, two prices, and no invoice
  // ever carried either. Removed the way BT11/BT13 were; do not reintroduce.

  // การคำนวณยอดรวม (ทั้ง 2 งวด)
  TOTAL_STANDARD_FEE: PHASE_1.total + PHASE_2.total,

  // ขั้นตอนการชำระเงิน (2 Phase เท่านั้น)
  PAYMENT_PHASES: {
    PHASE_1: {
      phase: 1,
      amount: 5000,
      description: 'ค่าธรรมเนียมตรวจสอบเอกสาร',
      description_en: 'Document Review Fee',
      when: 'หลังจากส่งใบสมัคร',
      when_en: 'After application submission',
      triggers: ['APPLICATION_SUBMITTED'],
      next_states: ['DOCUMENT_REVIEW'],
      required: true,
    },
    PHASE_2: {
      phase: 2,
      amount: 25000,
      description: 'ค่าธรรมเนียมตรวจสอบภาคสนาม',
      description_en: 'Field Inspection Fee',
      when: 'หลังจากเอกสารผ่านการตรวจสอบ',
      when_en: 'After document approval',
      triggers: ['DOC_APPROVED'],
      next_states: ['AUDIT_CONFIRMED'],
      required: true,
    },
  },

  // กฎการชำระเงินซ้ำ (ไม่มี rejection limit — ใช้ revision deadline เป็นตัวควบคุม)
  // เมื่อ revision deadline 5 วันทำการหมดอายุ → EXPIRED → ต้องยื่นใหม่ + จ่ายใหม่
  RE_PAYMENT_RULES: {
    RE_PAYMENT_TRIGGERS: [
      {
        condition: 'REVISION_DEADLINE_EXPIRED',
        description: 'revision deadline 5 วันทำการหมดอายุ → EXPIRED → ยื่นคำขอใหม่พร้อมจ่ายค่าธรรมเนียมใหม่',
        action: 'REQUIRE_NEW_APPLICATION',
        amount: 5885,
      },
    ],
  },

  // สถานะการชำระเงิน
  PAYMENT_STATUS: {
    PENDING: 'pending', // รอชำระ
    PROCESSING: 'processing', // กำลังตรวจสอบ
    COMPLETED: 'completed', // ชำระแล้ว
    FAILED: 'failed', // ชำระไม่สำเร็จ
    EXPIRED: 'expired', // หมดอายุ
    REFUNDED: 'refunded', // คืนเงินแล้ว
    CANCELLED: 'cancelled', // ยกเลิก
  },

  // ระยะเวลาชำระเงิน
  PAYMENT_TIMEOUT: {
    PHASE_1: 7 * 24 * 60 * 60 * 1000, // 7 วัน
    PHASE_2: 14 * 24 * 60 * 60 * 1000, // 14 วัน
  },

  // Gateway และช่องทางการชำระเงิน
  PAYMENT_METHODS: {
    CREDIT_CARD: 'credit_card',
    INTERNET_BANKING: 'internet_banking',
    MOBILE_BANKING: 'mobile_banking',
    QR_CODE: 'qr_code',
    BANK_TRANSFER: 'bank_transfer',
    COUNTER_SERVICE: 'counter_service',
  },
  // NOTE: dead dummy BANK_ACCOUNTS config removed (named the wrong department,
  // never read anywhere). Real receiving accounts live in the BankAccount Prisma
  // model (bank-account-service.js / finance/bank-accounts.js, seed-bank-accounts.js).
};

module.exports = {
  PAYMENT_FEES,

  /**
   * คำนวณรายละเอียดค่าใช้จ่ายแยกรายการตามงวด
   * @param {number} phase - 1 or 2
   * @returns {{ govFee, serviceFee, vat, total, lineItems[] }}
   */
  computePhaseBreakdown: (phase) => {
    const p = parseInt(phase);
    const govFee = p === 1 ? PAYMENT_FEES.PHASE_1_GOV_FEE : PAYMENT_FEES.PHASE_2_GOV_FEE;
    const serviceFee = p === 1 ? PAYMENT_FEES.PHASE_1_SERVICE_FEE : PAYMENT_FEES.PHASE_2_SERVICE_FEE;
    const vat = p === 1 ? PAYMENT_FEES.PHASE_1_VAT : PAYMENT_FEES.PHASE_2_VAT;
    const total = p === 1 ? PAYMENT_FEES.PHASE_1_TOTAL : PAYMENT_FEES.PHASE_2_TOTAL;

    return {
      phase: p,
      govFee,
      serviceFee,
      vat,
      total,
      // W14 — ONE wallet: the farmer pays the company, which settles the state
      // portion with DTAM outside this system. walletA/walletB are kept as the
      // internal split the remittance liability is tracked against, NOT as two
      // destinations the farmer transfers to.
      walletA: govFee,                 // owed onward to DTAM (company liability)
      walletB: serviceFee + vat,       // the company keeps
      lineItems: [
        {
          order: 1,
          description: p === 1
            ? 'ค่าธรรมเนียมตรวจสอบเอกสาร (Government Fee)'
            : 'ค่าธรรมเนียมตรวจสอบภาคสนาม (Government Fee)',
          description_en: p === 1 ? 'Document Review Fee' : 'Field Audit Fee',
          amount: govFee,
          // W14 — no line is VAT-exempt: one issuer, one taxable supply.
          taxExempt: false,
          revenueType: 'STATE',
        },
        {
          order: 2,
          description: 'ค่าบริการแพลตฟอร์ม (Platform Service Fee)',
          description_en: 'Platform Service Fee',
          amount: serviceFee,
          taxExempt: false,
          revenueType: 'PLATFORM',
        },
        {
          order: 3,
          description: 'ภาษีมูลค่าเพิ่ม 7% ของค่าบริการ (VAT)',
          description_en: 'Value Added Tax (7%)',
          amount: vat,
          taxExempt: false,
          revenueType: 'VAT',
        },
      ],
    };
  },
};

