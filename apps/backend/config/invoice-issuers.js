/**
 * Invoice Issuer Configuration
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ## Two-money-flow model (confirmed by owner 2026-05-16, batch B16-C)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Owner clarification (Thai, verbatim):
 *   - "ที่อยู่กับ tax id ของฝั่ง DTAM ใน invoice ถูกอยู่แล้ว"
 *     → DTAM tax-ID + address are already correct in invoice config.
 *       DO NOT change the defaults of DTAM_ISSUER or PLATFORM_ISSUER below.
 *   - "ส่วนบริษัท platform ก็เก็บแค่ค่า fee platform เท่านั้น"
 *     → The platform company collects ONLY the platform fee + VAT. The
 *       state fee flows applicant → กรมบัญชีกลาง directly via the
 *       Treasury banking channel — NEVER touches the platform's bank.
 *   - "เลขบัญชี DTAM เหมือนมีอยู่แล้วในเอกสารเก่า"
 *     → DTAM bank account number already exists in old templates;
 *       confirmed found in apps/backend/services/pdf/templates/invoice.html
 *       lines 338-346 (กรุงไทย 4750134376 — "เงินบำรุงศูนย์พัฒนายาไทย
 *       และสมุนไพร", tax-ID 0994000036540).
 *
 * ผู้สมัครต้องโอนเงินสองครั้งต่อ phase:
 *
 *   1. ค่าธรรมเนียมรัฐ (5,000 / 25,000 THB) → บัญชีกรมบัญชีกลาง
 *      (DTAM_BANK_ACCOUNT below).
 *      - DTAM tax-ID + address on the receipt (DTAM_ISSUER).
 *      - ไม่ผ่านบัญชีบริษัทแพลตฟอร์ม — ไม่บันทึก journal entry ในงบเรา.
 *      - ใบเสร็จเงินรายได้แผ่นดิน ออกในนาม DTAM โดยทีม ACCOUNT_DTAM.
 *      - Cash flow: applicant → Treasury (กรมบัญชีกลาง). Platform's
 *        only role is rendering the receipt — no GL posting on our books.
 *
 *   2. ค่าบริการแพลตฟอร์ม + VAT 7% (535 / 2,675 THB) → บัญชีบริษัท
 *      Predictive AI Solution Co., Ltd. (PLATFORM_BANK_ACCOUNT below).
 *      - Predictive AI tax-ID + address on the receipt (PLATFORM_ISSUER).
 *      - บันทึก Dr Cash / Cr Revenue + Cr Output VAT (TFRS for NPAEs
 *        ch.18 / TAS 1 — รับรู้รายได้ตามเกณฑ์เงินสดเข้าบัญชี).
 *      - ใบกำกับภาษีเต็มรูป ออกในนาม Predictive AI โดยทีม ACCOUNT_PLATFORM.
 *
 * ห้ามรวมเงินสองฝั่ง — ลูกค้าต้องโอนสองครั้ง สลิปสองใบ. ผลต่อระบบบัญชี:
 *   - แพลตฟอร์มไม่มีหนี้สิน "Due to DTAM" อีกต่อไป — DTAM/Treasury เก็บเอง
 *     ผ่านระบบ Treasury Cash Management System (TCMS).
 *   - แพลตฟอร์มไม่ออกใบสำคัญรับ (receipt-voucher) ในนาม DTAM แล้ว — เพียง
 *     จัด format ให้ลูกค้านำสลิปไปยื่นต่อ DTAM เพื่อขอใบเสร็จเงินรายได้แผ่นดิน.
 *   - bank-reconciliation report ถูก split เป็น 2 รายงาน (DTAM / PLATFORM)
 *     ตาม bookSide query parameter ใน bank-reconciliation-service.js.
 *
 * อ้างอิงกฎหมาย:
 *   - ป.รัษฎากร ม.77/1 (10) — รายได้แผ่นดินยกเว้น VAT
 *   - กฎกระทรวงการคลังเรื่องเงินรายได้แผ่นดิน — เงินรายได้แผ่นดิน
 *     ต้องนำส่งกระทรวงการคลังโดยตรง
 *   - พ.ร.บ.วินัยการเงินการคลังของรัฐ พ.ศ.2561 ม.34 — รายได้แผ่นดิน
 *     ต้องเข้าบัญชีคลังของกรมบัญชีกลาง ไม่ใช่ผ่านตัวแทนเอกชน
 *   - TFRS for NPAEs ch.18 (รายได้) — รับรู้รายได้เฉพาะที่กิจการได้รับ
 *     หรือมีสิทธิเรียกร้อง
 *
 * Two-money-flow model in English:
 *
 *   The applicant MUST make two transfers per phase:
 *
 *     1. State fee (5,000 / 25,000 THB) → DTAM_BANK_ACCOUNT
 *        - DTAM legal identity on the receipt (DTAM_ISSUER below).
 *        - NEVER enters the platform's bank account. NO journal entry
 *          is posted on the platform's books for STATE invoices.
 *        - Government Revenue Receipt (ใบเสร็จเงินรายได้แผ่นดิน) is
 *          issued in DTAM's name — DTAM finance team handles GL.
 *
 *     2. Platform fee + 7% VAT (535 / 2,675 THB) → PLATFORM_BANK_ACCOUNT
 *        - Predictive AI Solution Co., Ltd. on the receipt (PLATFORM_ISSUER).
 *        - Posted Dr Cash / Cr Revenue + Cr Output VAT per TFRS for
 *          NPAEs ch.18 / TAS 1 (cash-basis revenue recognition).
 *        - Full Tax Invoice (ใบกำกับภาษีเต็มรูป) issued in the platform
 *          company's name — corporate customers may use it for ภ.ง.ด.53
 *          self-withholding.
 *
 *   Funds MUST NOT be combined — two transfers, two slips, two receipts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * System deep-dive Tier 9 — Backend + Compliance + DBA (2026-05-15):
 *
 * The GACP platform issues TWO separate financial documents per phase:
 *
 *   1. STATE invoice/receipt — issued ON BEHALF OF:
 *      **กรมการแพทย์แผนไทยและการแพทย์ทางเลือก (DTAM)**
 *      - State fee only (5,000 / 25,000 THB per scope)
 *      - NO VAT (government revenue, exempt from VAT per Thai tax law)
 *      - Receipt format: "ใบเสร็จเงินรายได้แผ่นดิน" (Government Revenue Receipt)
 *      - Issued by the platform AS COLLECTION AGENT (see §"Collection-agent
 *        accounting relationship" below).
 *
 *   2. PLATFORM invoice/receipt — issued on behalf of:
 *      **บริษัท พรีดิกทีฟ เอไอ โซลูชัน จำกัด (Predictive AI Solution Co., Ltd.)**
 *      - Platform fee 10% of state fee (500 / 2,500 THB)
 *      - + VAT 7% on platform fee (35 / 175 THB)
 *      - Receipt format: "ใบกำกับภาษีเต็มรูป / ใบเสร็จรับเงิน" (Full Tax Invoice / Receipt)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ## Collection-agent accounting relationship — Platform เป็น Collection
 *    Agent ของ DTAM (สำคัญ — อย่าลบ)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * คำอธิบายความสัมพันธ์ทางบัญชีระหว่างแพลตฟอร์ม (บริษัท พรีดิกทีฟ เอไอ
 * โซลูชัน จำกัด) และกรมการแพทย์แผนไทยและการแพทย์ทางเลือก (DTAM):
 *
 *   The platform company operates as a COLLECTION AGENT for DTAM. It
 *   collects the state fee on DTAM's behalf — the state portion is NOT
 *   platform revenue. The legal/accounting flow is:
 *
 *   1. ผู้ยื่นคำขอ (Applicant) โอนเงิน 1 ครั้ง ครอบคลุมทั้ง state fee +
 *      platform fee + VAT 7% on platform fee — เข้าบัญชีของแพลตฟอร์ม
 *      (Predictive AI Solution Co., Ltd.).
 *
 *   2. ในสมุดบัญชีของแพลตฟอร์ม รายการแยกเป็น 3 บัญชี:
 *        - State portion        → "เงินรับฝากเพื่อนำส่ง DTAM"
 *          (Cr. Due to DTAM, account 2191-001 — LIABILITY, ไม่ใช่รายได้)
 *        - Platform portion     → "รายได้ค่าบริการแพลตฟอร์ม"
 *          (Cr. Revenue Platform Fee, account 4110-001)
 *        - VAT portion          → "ภาษีขายตั้งพัก"
 *          (Cr. Output VAT Payable, account 2131-001)
 *
 *   3. State portion จะถูก REMIT (นำส่ง) ให้ DTAM เป็นรอบ (รายเดือน) ผ่าน
 *      ช่องทางที่ Finance/Ops กำหนด (TBD remittance channel — bank transfer
 *      to DTAM's official revenue account "เงินบำรุงศูนย์พัฒนายาไทยและสมุนไพร"
 *      see apps/backend/services/pdf/templates/invoice.html:338-341).
 *      Entry: Dr. Due to DTAM / Cr. Cash.
 *
 *   4. ใบเสร็จเงินรายได้แผ่นดิน (ออกในนาม DTAM) ถูกออก ON BEHALF OF DTAM
 *      โดยมี collection-agent notation ใน fine print ของเอกสาร. ตัวเลข
 *      ภาษีของ DTAM (0994000036540) คือเลข tax ID ของ DTAM เอง — ไม่ใช่
 *      ของแพลตฟอร์ม.
 *
 *   5. แพลตฟอร์มออกใบกำกับภาษีเต็มรูป (ม.86/4 ป.รัษฎากร) ในนามตัวเอง
 *      สำหรับ "platform fee + VAT" portion เท่านั้น — ห้ามรวม state fee
 *      ในใบกำกับภาษี (state fee ยกเว้น VAT ตามกฎกระทรวงการคลังเรื่อง
 *      เงินรายได้แผ่นดิน).
 *
 * ผลลัพธ์ทางบัญชี:
 *
 *   - รายได้แพลตฟอร์ม = เฉพาะ platform fee (500 / 2,500 บาท) เท่านั้น
 *     ไม่ใช่ state fee (5,000 / 25,000 บาท)
 *   - ผู้ยื่นคำขอจะได้รับเอกสาร 2 ชุดต่อ phase: ใบเสร็จเงินรายได้แผ่นดิน
 *     (จาก DTAM) + ใบกำกับภาษีเต็มรูป (จาก Predictive AI)
 *   - VAT 7% คิดเฉพาะ platform fee เท่านั้น — state fee ของ DTAM
 *     ยกเว้น VAT เพราะเป็นรายได้แผ่นดิน
 *
 * อ้างอิงกฎหมาย:
 *   - พระราชบัญญัติการอำนวยความสะดวกในการพิจารณาอนุญาตของทางราชการ
 *     พ.ศ.2558 (Thai Public Service Act, B.E. 2558) — อนุญาตเอกชนทำหน้าที่
 *     รับชำระค่าธรรมเนียมในนามหน่วยงานรัฐ
 *   - ป.รัษฎากร ม.77/1 (10) — รายได้แผ่นดินยกเว้น VAT
 *   - ป.รัษฎากร ม.86/4 — ใบกำกับภาษีเต็มรูปออกในนามผู้ประกอบการ
 *     ที่จดทะเบียน VAT เท่านั้น (= Predictive AI, ไม่ใช่ DTAM)
 *   - กฎกระทรวงการคลังเรื่องเงินรายได้แผ่นดิน
 *
 * Account codes (ดู apps/backend/services/journal-entry-service.js):
 *   - 1110-001  เงินสด/เงินฝากธนาคาร — บัญชีหลัก          (Asset)
 *   - 2131-001  ภาษีขายตั้งพัก (Output VAT 7%)            (Liability — to Revenue Dept)
 *   - 2151-001  เจ้าหนี้ — กรมการแพทย์แผนไทยฯ             (Liability — to DTAM, collection-agent)
 *   - 4110-001  รายได้ค่าบริการแพลตฟอร์ม                  (Revenue — platform only)
 *
 * journal-entry-service.js (Tier 14) ALREADY implements this routing
 * correctly: state-fee portion credits 2151-001 PAYABLE_TO_DTAM
 * (liability), NEVER a revenue account. The remittance entry
 * (`buildRemittanceEntryLines`) clears the liability when the platform
 * transfers the accumulated balance to DTAM. There is NO revenue line
 * for state fees on the platform's books — by design.
 *
 * ## Why config-driven (env vars + placeholders)
 *
 * The actual tax IDs, registered addresses, and legal names of DTAM and
 * the platform company are **authoritative business data** that must be
 * confirmed by Finance + Legal + DTAM coordination. This file provides:
 *
 *   - Schema/shape for the issuer record (what every issuer needs)
 *   - Default values that match the published/registered identity (so
 *     receipts render correctly out of the box). Env vars REMAIN the
 *     override mechanism for ops-driven changes (e.g. office relocation).
 *   - Env var loader that overrides each field individually.
 *   - Validator that warns on startup if production is missing any field.
 *
 * ## Withholding tax (WHT 3%) — NOT implemented (intentional)
 *
 * Per business direction (owner, 2026-05-15):
 *
 *   "ถ้าหัก 3% แล้วเสี่ยงผิดกฎหมาย หรือเราไม่ได้นำส่ง เอาออกก็ได้"
 *
 * Thai tax law makes WHT 3% the duty of the PAYER (corporate customer),
 * not the seller (platform). The platform's role is to:
 *   1. Issue a full tax invoice (ใบกำกับภาษีเต็มรูป) for the corporate
 *      customer to use when withholding.
 *   2. Record the WHT amount the customer remits to themselves when the
 *      customer provides a ทบ.50 ทวิ certificate.
 *
 * Currently neither step is implemented. The Invoice schema therefore
 * has NO `withholdingTax` field, and this config has NO WHT rate.
 * Adding WHT incorrectly (e.g. computing and "deducting" it without a
 * monthly ภ.ง.ด.53 remittance pipeline) would create unremitted
 * collected tax — a serious legal exposure.
 *
 * ## How to fill in real data (Ops runbook)
 *
 * Tier 10 (2026-05-15): Platform issuer real data baked in. B16 (2026-05-16):
 * DTAM real data also baked in — corroborated by tax-ID `0994000036540`
 * appearing in invoice.html payment-info (DTAM bank account "เงินบำรุง
 * ศูนย์พัฒนายาไทยและสมุนไพร") AND in shared/ministry-contact.js (DTAM
 * address). Env vars REMAIN the production override mechanism for any
 * ops-driven correction (DTAM relocation, format change, etc.) via the
 * secret manager (NOT committed .env files):
 *
 *   # DTAM (defaults baked-in; env vars override)
 *   DTAM_LEGAL_NAME_TH=กรมการแพทย์แผนไทยและการแพทย์ทางเลือก
 *   DTAM_LEGAL_NAME_EN=Department of Thai Traditional and Alternative Medicine
 *   DTAM_TAX_ID=0994000036540
 *   DTAM_ADDRESS_LINE1=88/23 หมู่ 4 ถนนติวานนท์ ตำบลตลาดขวัญ อำเภอเมืองนนทบุรี
 *   DTAM_ADDRESS_LINE2=จังหวัดนนทบุรี 11000
 *
 *   # Platform (real data baked-in as default; env vars are pure overrides)
 *   PLATFORM_COMPANY_NAME_TH=บริษัท พรีดิกทีฟ เอไอ โซลูชัน จำกัด (สำนักงานใหญ่)
 *   PLATFORM_TAX_ID=0105568045932
 *   PLATFORM_REGISTRATION_NO=0105568045932
 *   PLATFORM_ADDRESS_LINE1=429/69 หมู่บ้าน พรีเมี่ยมเพลส ถนนสุคนธสวัสดิ์ แขวงลาดพร้าว เขตลาดพร้าว
 *   PLATFORM_ADDRESS_LINE2=กรุงเทพมหานคร 10230
 */

// The tariff owns the VAT rate; this file reads it rather than keeping a second
// copy (config/business-rules FEES.VAT_RATE, guarded by fee-single-source).
const { FEES } = require('./business-rules');

const SERVICE_TYPES = Object.freeze({
    PHASE_1_STATE_FEE: 'PHASE_1_STATE_FEE',
    PHASE_1_PLATFORM_FEE: 'PHASE_1_PLATFORM_FEE',
    PHASE_2_STATE_FEE: 'PHASE_2_STATE_FEE',
    PHASE_2_PLATFORM_FEE: 'PHASE_2_PLATFORM_FEE',
});

/**
 * Two distinct issuer identities.
 * Keep this list closed (no third issuer) — adding one means changing
 * payment-flow + accounting reconciliation in many other files.
 */
const ISSUER_TYPES = Object.freeze({
    DTAM: 'DTAM',           // Government — state fees
    PLATFORM: 'PLATFORM',   // Predictive AI Solution Co., Ltd. — platform fees + VAT
});

/**
 * Sentinel that BOTH (a) is human-readable in a printed receipt so QA
 * spots the gap during UAT and (b) is grep-able in the repo so devs
 * find every site that depends on configuration before production cutover.
 */
const PENDING = 'PENDING_FINANCE_CONFIRMATION';

// System deep-dive B16 — Backend + Compliance (2026-05-16):
// DTAM legal data confirmed by owner — corroborated by:
//   1. Tax ID `0994000036540` appearing in invoice.html payment-info under
//      DTAM's bank account name "เงินบำรุงศูนย์พัฒนายาไทยและสมุนไพร"
//      (apps/backend/services/pdf/templates/invoice.html:341,345). This is
//      the same DTAM-owned tax ID receiving the state-fee transfers — Tier
//      12 execution log explicitly flagged this as DTAM tax ID (see
//      docs/handoffs/system-deep-dive-2026-05-15/TIER-12-EXECUTION-LOG.md
//      line 18: "0994000036540 คือ tax ID ของ DTAM").
//   2. Address "88/23 หมู่ 4 ถนนติวานนท์ ตำบลตลาดขวัญ อำเภอเมืองนนทบุรี
//      จังหวัดนนทบุรี 11000" appears in apps/backend/shared/ministry-contact.js
//      (verified against dtam.moph.go.th 2026-04-28) AND in document-config.ts,
//      gacpthai-document-layout.tsx, i18n dictionaries.
//
// Env vars remain pure overrides for ops correction (DTAM relocation,
// format change, etc.) — not for first-time configuration.
//
// IMPORTANT — collection-agent model: even though this issuer carries
// DTAM's legal identity, the money flow is COLLECTION-AGENT (see header
// comment §"Collection-agent accounting relationship"). The platform
// collects on DTAM's behalf and remits monthly. Receipts in this issuer's
// name carry collection-agent notation in fine print.
const DTAM_ISSUER = Object.freeze({
    type: ISSUER_TYPES.DTAM,
    legalNameTH: process.env.DTAM_LEGAL_NAME_TH
        || 'กรมการแพทย์แผนไทยและการแพทย์ทางเลือก',
    legalNameEN: process.env.DTAM_LEGAL_NAME_EN
        || 'Department of Thai Traditional and Alternative Medicine',
    // DTAM's government revenue tax ID — same 13-digit value that appears
    // on invoice.html payment-info as the receiving-account tax ID for
    // "เงินบำรุงศูนย์พัฒนายาไทยและสมุนไพร" (DTAM revenue account).
    // Confirmed by owner 2026-05-16 via Tier-12 narrative + ministry-contact
    // cross-reference. Finance/Legal: please verify and confirm before
    // public production cutover.
    taxId: process.env.DTAM_TAX_ID || '0994000036540',
    // DTAM registered address — verified against dtam.moph.go.th footer
    // 2026-04-28 (see apps/backend/shared/ministry-contact.js comment).
    addressLine1: process.env.DTAM_ADDRESS_LINE1
        || '88/23 หมู่ 4 ถนนติวานนท์ ตำบลตลาดขวัญ อำเภอเมืองนนทบุรี',
    addressLine2: process.env.DTAM_ADDRESS_LINE2
        || 'จังหวัดนนทบุรี 11000',
    // DTAM issues "ใบเสร็จเงินรายได้แผ่นดิน" (Government Revenue Receipt), not
    // a tax invoice — government revenue is VAT-exempt
    // (ป.รัษฎากร ม.77/1 (10) + กฎกระทรวงการคลังเรื่องเงินรายได้แผ่นดิน).
    receiptDocumentType: 'GOVERNMENT_REVENUE_RECEIPT',
    receiptDocumentTypeTH: 'ใบเสร็จเงินรายได้แผ่นดิน',
    // VAT does not apply to money DTAM itself receives as government revenue.
    // Kept because it still describes DTAM correctly as a legal entity — it is
    // simply never consulted when issuing a farmer document any more, because
    // DTAM does not issue farmer documents under W14.
    chargesVat: false,
    // W14 (operator ruling 2026-08-22, HARNESS_LOG.md c28355ea): the
    // collection-agent fine print is DELETED, not merely left unused.
    //
    // It read "เอกสารนี้ออกโดย บริษัท … ในฐานะตัวแทนรับชำระเงินรายได้แผ่นดินของ
    // กรมการแพทย์แผนไทยฯ" — i.e. the company issues this document as DTAM's
    // authorised collection agent for state revenue. Under the new model the
    // farmer buys a service FROM the company and pays the company; the company
    // settles with DTAM afterwards, outside this system. The company is a
    // principal, not an agent, so that sentence is now FALSE — and a false
    // statement about who collected the money, printed on a tax document, is a
    // compliance problem, not stale wording. The strings are removed rather
    // than orphaned so no future template can print them again.
    //
    // `collectedByPlatform` is removed with them: it drove that fine print and
    // the state-portion accounting split that no longer exists.
});

// System deep-dive Tier 10 — Backend + Compliance + Finance (2026-05-15):
// Platform issuer real data confirmed by owner.
//
// Key facts:
//   - Registered as "บริษัท พรีดิกทีฟ เอไอ โซลูชัน จำกัด" (note: "โซลูชัน" not
//     "โซลูชั่น" — official spelling per DBD records)
//   - "(สำนักงานใหญ่)" suffix is part of the legal name when issuing tax
//     documents (distinguishes from branch offices for VAT purposes per
//     ม.86/4 (1) แห่ง ป.รัษฎากร — full tax invoice must show whether the
//     issuing site is the head office or a branch)
//   - In Thailand the 13-digit corporate registration number (เลขทะเบียน
//     นิติบุคคล) IS the same as the corporate tax ID (เลขประจำตัวผู้เสียภาษี).
//     Hence taxId === registrationNo. The two env vars stay separate so
//     ops can override either independently in edge cases.
const PLATFORM_ISSUER = Object.freeze({
    type: ISSUER_TYPES.PLATFORM,
    legalNameTH: process.env.PLATFORM_COMPANY_NAME_TH
        || 'บริษัท พรีดิกทีฟ เอไอ โซลูชัน จำกัด (สำนักงานใหญ่)',
    legalNameEN: process.env.PLATFORM_COMPANY_NAME_EN
        || 'Predictive AI Solution Co., Ltd. (Head Office)',
    taxId: process.env.PLATFORM_TAX_ID || '0105568045932',
    addressLine1: process.env.PLATFORM_ADDRESS_LINE1
        || '429/69 หมู่บ้าน พรีเมี่ยมเพลส ถนนสุคนธสวัสดิ์ แขวงลาดพร้าว เขตลาดพร้าว',
    addressLine2: process.env.PLATFORM_ADDRESS_LINE2
        || 'กรุงเทพมหานคร 10230',
    // เลขทะเบียนพาณิชย์ / นิติบุคคล (13 digits) — same as taxId in Thailand
    registrationNo: process.env.PLATFORM_REGISTRATION_NO || '0105568045932',
    // The platform issues a full tax invoice that corporate customers can
    // use when withholding 3% under their own ภ.ง.ด.53 obligation.
    receiptDocumentType: 'FULL_TAX_INVOICE_RECEIPT',
    receiptDocumentTypeTH: 'ใบกำกับภาษีเต็มรูป / ใบเสร็จรับเงิน',
    chargesVat: true,
    // Derived, not re-typed. The tariff owns the rate (config/business-rules
    // FEES.VAT_RATE, guarded by the fee-single-source probe); a second literal
    // here would agree with it until the day one of them was edited.
    vatRate: FEES.VAT_RATE,
});

// ──────────────────────────────────────────────────────────────────────────
// Bank-account configuration — two-money-flow model (B16-C, 2026-05-16)
// ──────────────────────────────────────────────────────────────────────────
//
// Each issuer owns its own bank channel. PDF templates, payment-routing
// services, and bank-reconciliation reports MUST read account data from
// here — never hard-code an account number elsewhere.
//
// DTAM_BANK_ACCOUNT — กรมบัญชีกลาง / DTAM revenue account
//   - Source corroboration: apps/backend/services/pdf/templates/invoice.html
//     lines 338-346 (ธนาคารกรุงไทย สาขามหาวิทยาลัยธรรมศาสตร์ รังสิต,
//     account 4750134376, "เงินบำรุงศูนย์พัฒนายาไทยและสมุนไพร",
//     tax-ID 0994000036540).
//   - This is DTAM's published revenue-collection account. Money flowing
//     into it is "เงินรายได้แผ่นดิน" under กฎกระทรวงการคลังเรื่อง
//     เงินรายได้แผ่นดิน and พ.ร.บ.วินัยการเงินการคลังของรัฐ ม.34.
//   - Env-var overrides exist for ops correction (DTAM may rotate the
//     account or change PromptPay registration via กรมบัญชีกลาง's TCMS).
const DTAM_BANK_ACCOUNT = Object.freeze({
    issuer: ISSUER_TYPES.DTAM,
    bankName: process.env.DTAM_BANK_NAME
        || 'ธนาคารกรุงไทย สาขามหาวิทยาลัยธรรมศาสตร์ รังสิต',
    accountNo: process.env.DTAM_BANK_ACCOUNT_NO || '4750134376',
    // Predictable canonical name for the receipt template. The bank-side
    // ledger displays "เงินบำรุงศูนย์พัฒนายาไทยและสมุนไพร" (legacy
    // account name from invoice.html); we keep the modern label here so
    // the customer-facing receipt aligns with the two-flow narrative.
    accountName: process.env.DTAM_BANK_ACCOUNT_NAME
        || 'กรมบัญชีกลาง · รายได้แผ่นดิน (DTAM)',
    // Legacy account-name string still present on the receipt template,
    // surfaced separately so templates can show both forms if needed.
    legacyAccountName: 'เงินบำรุงศูนย์พัฒนายาไทยและสมุนไพร',
    // DTAM's 13-digit tax-ID doubles as the PromptPay identifier on
    // government revenue accounts (per กรมบัญชีกลาง's TCMS practice).
    promptpayId: process.env.DTAM_PROMPTPAY_ID || '0994000036540',
    // ป.รัษฎากร ม.77/1 (10) — รายได้แผ่นดินยกเว้น VAT
    vatExempt: true,
    // กฎกระทรวงการคลังเรื่องเงินรายได้แผ่นดิน — เป็นเงินรายได้แผ่นดิน
    revenueCategoryTH: 'เงินรายได้แผ่นดิน',
    note: 'Treasury collection channel — applicant transfers state fee '
        + 'DIRECTLY to this account. NOT mirrored in the platform\'s GL.',
});

// PLATFORM_BANK_ACCOUNT — Predictive AI Solution corporate account
//   - Default values are PENDING_FINANCE_CONFIRMATION because the platform
//     bank-account number is NOT in any old document found during the
//     B16-C search. Finance team must fill these env vars before
//     production cutover (see "How to fill in real data" §"Ops runbook"
//     in this file's header comment).
//   - PromptPay defaults to the platform's 13-digit registration / tax-ID
//     (0105568045932) — for corporate PromptPay accounts that is the
//     canonical identifier.
const PLATFORM_BANK_ACCOUNT = Object.freeze({
    issuer: ISSUER_TYPES.PLATFORM,
    bankName: process.env.PLATFORM_BANK_NAME || PENDING,
    accountNo: process.env.PLATFORM_BANK_ACCOUNT_NO || PENDING,
    accountName: process.env.PLATFORM_BANK_ACCOUNT_NAME
        || 'บริษัท พรีดิกทีฟ เอไอ โซลูชัน จำกัด',
    promptpayId: process.env.PLATFORM_PROMPTPAY_ID || '0105568045932',
    // ป.รัษฎากร ม.86/4 — ผู้ประกอบการ VAT รับรู้รายได้ + Output VAT
    vatExempt: false,
    // Derived, like PLATFORM_ISSUER.vatRate above. Two literals of one rate in
    // one file is the shape that drifts the day either is edited.
    vatRate: FEES.VAT_RATE,
    revenueCategoryTH: 'รายได้ค่าบริการ + ภาษีขายตั้งพัก',
    note: 'Platform commercial channel — applicant transfers platform fee '
        + '+ VAT to this account. Posted Dr Cash / Cr Revenue + Cr Output '
        + 'VAT per TFRS for NPAEs ch.18.',
});

/**
 * Pick the bank account that matches an issuer type. Mirrors
 * `getInvoiceIssuer(serviceType)` so callers can ask one question at the
 * canonical level (serviceType) and get both legal identity AND the bank
 * channel in a single helper response.
 *
 * @param {string} issuerType — one of ISSUER_TYPES (DTAM / PLATFORM)
 * @returns {object} frozen DTAM_BANK_ACCOUNT or PLATFORM_BANK_ACCOUNT
 * @throws when issuerType is unknown
 */
function getBankAccountForIssuer(issuerType) {
    if (issuerType === ISSUER_TYPES.DTAM) {
        return DTAM_BANK_ACCOUNT;
    }
    if (issuerType === ISSUER_TYPES.PLATFORM) {
        return PLATFORM_BANK_ACCOUNT;
    }
    throw new Error(
        `[invoice-issuers] Unknown issuerType "${issuerType}". `
        + `Expected one of: ${Object.values(ISSUER_TYPES).join(', ')}.`,
    );
}

/**
 * Resolve issuer info from a canonical service type.
 * STATE fees → DTAM. PLATFORM fees → Predictive AI Solution.
 *
 * Post-B16-C: the returned object also carries `.bankAccount` so PDF
 * templates + payment routes can read the legal identity + the bank
 * channel from one helper call. The bank account is the appropriate
 * `DTAM_BANK_ACCOUNT` (state fees) or `PLATFORM_BANK_ACCOUNT` (platform
 * fees + VAT) — see "Two-money-flow model" in this file's header comment.
 *
 * @param {string} serviceType  one of SERVICE_TYPES values
 * @returns {object}  issuer info merged with the matching bank account
 * @throws  if serviceType is not recognized
 */
function getInvoiceIssuer(serviceType) {
    const normalized = String(serviceType || '').toUpperCase();
    // W14 (operator ruling 2026-08-22, HARNESS_LOG.md c28355ea): ONE issuer.
    //
    // Every service type — the two that used to route to DTAM included — is
    // issued by the company. The farmer pays the company for a service; the
    // company settles the state portion with DTAM afterwards, outside this
    // system. So there is one legal identity on the document, one tax ID, one
    // bank account to transfer to, and VAT on the whole ค่าบริการ.
    //
    // The serviceType argument is still VALIDATED rather than ignored: an
    // unrecognised value must stay an error. Collapsing the branches must not
    // quietly turn a typo'd service type into a valid document.
    if (Object.values(SERVICE_TYPES).includes(normalized)) {
        return Object.freeze({ ...PLATFORM_ISSUER, bankAccount: PLATFORM_BANK_ACCOUNT });
    }
    throw new Error(
        `[invoice-issuers] Unknown serviceType "${serviceType}". `
        + `Expected one of: ${Object.values(SERVICE_TYPES).join(', ')}.`,
    );
}

/**
 * Returns true when this issuer should charge VAT on the invoice.
 *
 * W14: always true. There is one issuer — the company — and the whole
 * ค่าบริการ (state fee + platform fee) is its VATable supply. The VAT-exempt
 * government-revenue leg is retired along with the two-issuer model.
 *
 * Kept as a function rather than inlined at ~30 call sites so that if a future
 * ruling reintroduces an exempt supply there is still exactly one place to
 * express it.
 */
function shouldChargeVat(serviceType) {
    return getInvoiceIssuer(serviceType).chargesVat;
}

/**
 * Validates that production has filled in all `PENDING_…` placeholders.
 * Returns an array of [field, issuerType] tuples that are still pending.
 * Empty array = all good.
 *
 * Call this once during app startup in production — log a loud warning
 * if anything is missing so Finance/DevOps spots it before customers do.
 */
function listPendingIssuerFields() {
    const pending = [];
    for (const issuer of [DTAM_ISSUER, PLATFORM_ISSUER]) {
        for (const [key, value] of Object.entries(issuer)) {
            if (value === PENDING) {pending.push([key, issuer.type]);}
        }
    }
    // B16-C: also scan bank accounts so finance staff see the missing
    // PLATFORM_BANK_ACCOUNT_NO etc. surface in the startup readiness
    // check, alongside any DTAM bank-account env override set back to
    // the PENDING sentinel (regression repro flow).
    for (const [type, acct] of [
        ['DTAM_BANK_ACCOUNT', DTAM_BANK_ACCOUNT],
        ['PLATFORM_BANK_ACCOUNT', PLATFORM_BANK_ACCOUNT],
    ]) {
        for (const [key, value] of Object.entries(acct)) {
            if (value === PENDING) {pending.push([key, type]);}
        }
    }
    return pending;
}

module.exports = {
    SERVICE_TYPES,
    ISSUER_TYPES,
    DTAM_ISSUER,
    PLATFORM_ISSUER,
    DTAM_BANK_ACCOUNT,
    PLATFORM_BANK_ACCOUNT,
    PENDING,
    getInvoiceIssuer,
    getBankAccountForIssuer,
    shouldChargeVat,
    listPendingIssuerFields,
};
