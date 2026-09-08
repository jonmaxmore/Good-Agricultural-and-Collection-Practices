/**
 * Pricing page — Iter 28 marketing site.
 *
 * Full fee transparency for the GACP certification process. Mirrors the
 * pricing teaser table on the landing page but adds detail: who pays
 * what, when, refund policy, and links to the Terms of Service for the
 * binding contractual terms.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingSection } from '@/components/marketing/marketing-section';
import {
  GACP_APPLICATION_FEE,
  GACP_INSPECTION_FEE,
  GACP_PLATFORM_RATE,
  GACP_VAT_RATE,
  GACP_PHASE1_TOTAL,
  GACP_PHASE2_TOTAL,
} from '@/constants/fees';

export const metadata: Metadata = {
  title: 'ค่าธรรมเนียมการรับรอง GACP',
  description:
    'ค่าธรรมเนียมการรับรอง GACP สมุนไพรไทย ตามประกาศกรมการแพทย์แผนไทยและการแพทย์ทางเลือก แบ่งชำระ 2 งวด (ค่าตรวจเอกสาร + ค่าตรวจประเมินภาคสนาม) แสดงค่าธรรมเนียมรัฐและค่าบริการแพลตฟอร์มแยกชัดเจน',
  alternates: { canonical: 'https://gacpth.com/pricing' },
};

// W14 (operator ruling 2026-08-22, HARNESS_LOG.md c28355ea): ONE issuer. The
// company issues every document and the whole ค่าบริการ (ราคาเต็ม + ค่าแพลตฟอร์ม)
// is its taxable supply, so VAT 7% applies to ALL of it. This page used to say
// the state fee was VAT-exempt under ม.77/1(10) — that is no longer true.
// Every number is sourced from the fee SSoT (constants/fees.ts) — no hardcoded
// fee literals. There is NO certificate-issuance fee and NO annual surveillance fee.
const platformPart = (state: number): number => state * GACP_PLATFORM_RATE;
const vatPart = (state: number): number =>
  Math.round((state + platformPart(state)) * GACP_VAT_RATE);

const FEES = [
  {
    code: 'PHASE1',
    name: 'งวดที่ 1 · ค่าตรวจเอกสาร',
    nameEn: 'Phase 1 — Document Review',
    stateAmount: GACP_APPLICATION_FEE,
    platformAmount: platformPart(GACP_APPLICATION_FEE),
    vatAmount: vatPart(GACP_APPLICATION_FEE),
    total: GACP_PHASE1_TOTAL,
    when: 'ชำระหลังยื่นคำขอและยอมรับใบเสนอราคา',
    coverage: 'ค่าตรวจเอกสารและประเมินเบื้องต้นโดยเจ้าหน้าที่ (ต่อขอบเขตการปลูก)',
    refund: 'ไม่สามารถขอคืนหลังเริ่มตรวจสอบเอกสาร',
  },
  {
    code: 'PHASE2',
    name: 'งวดที่ 2 ค่าตรวจประเมินภาคสนาม',
    nameEn: 'Phase 2 — Field Audit',
    stateAmount: GACP_INSPECTION_FEE,
    platformAmount: platformPart(GACP_INSPECTION_FEE),
    vatAmount: vatPart(GACP_INSPECTION_FEE),
    total: GACP_PHASE2_TOTAL,
    when: 'ชำระก่อนวันนัดตรวจประเมิน',
    coverage: 'ค่าตอบแทนคณะผู้ตรวจ ค่าเดินทาง และค่าที่พักเจ้าหน้าที่ตรวจ (ต่อขอบเขตการปลูก)',
    refund: 'ขอคืนได้ก่อนกำหนดวันตรวจไม่น้อยกว่า 7 วันทำการ',
  },
];

const formatTHB = (value: number): string =>
  Math.round(value).toLocaleString('th-TH');

export default function PricingPage() {
  const totalPerScope = FEES.reduce((sum, f) => sum + f.total, 0);

  return (
    <>
      <section
        aria-labelledby="pricing-hero"
        className="bg-primary-50 dark:bg-zinc-950"
      >
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <p className="mb-2 text-xs font-semibold text-primary-700 dark:text-primary-300">
            ค่าธรรมเนียม
          </p>
          <h1 id="pricing-hero" className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl md:text-5xl">
            ค่าธรรมเนียมการรับรอง GACP
          </h1>
          <p className="mt-4 max-w-3xl text-base text-zinc-600 dark:text-zinc-300 sm:text-lg">
            อัตราค่าธรรมเนียมเป็นไปตามประกาศของกรมการแพทย์แผนไทยและการแพทย์ทางเลือก
            ระบบเปิดเผยค่าใช้จ่ายทุกขั้นตอนล่วงหน้า ไม่มีค่าใช้จ่ายแอบแฝง
          </p>
          <div className="mt-6 inline-flex flex-col gap-1 rounded-xl border border-primary-200 bg-white px-5 py-4 text-sm shadow-sm dark:border-primary-800 dark:bg-zinc-900">
            <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">รวมค่าธรรมเนียมต่อขอบเขตการปลูก (2 งวด)</span>
            <span className="text-2xl font-bold tabular-nums text-primary-800 dark:text-primary-200">{formatTHB(totalPerScope)} บาท</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              งวดที่ 1 <span className="tabular-nums">{formatTHB(GACP_PHASE1_TOTAL)}</span> + งวดที่ 2 <span className="tabular-nums">{formatTHB(GACP_PHASE2_TOTAL)}</span>  รวม VAT 7% บนค่าบริการแล้ว
            </span>
          </div>
        </div>
      </section>

      <MarketingSection
        id="fee-breakdown"
        eyebrow="รายละเอียด"
        title="รายละเอียดค่าธรรมเนียมแต่ละรายการ"
      >
        <div className="space-y-4">
          {FEES.map((fee) => (
            <article
              key={fee.code}
              className="rounded-2xl border border-primary-100 bg-white p-6 shadow-sm dark:border-primary-900/40 dark:bg-zinc-900"
              aria-labelledby={`fee-${fee.code}`}
            >
              <header className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 id={`fee-${fee.code}`} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {fee.name}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400" lang="en">{fee.nameEn}</p>
                </div>
                <div className="text-right">
                  {/* `font-mono` here put the digits in Menlo/Courier (no Thai glyphs) while
                      "บาท" fell through to Sukhumvit Set — two typefaces in one money
                      line, measured on the live page. What was wanted is aligned digits,
                      which is `tabular-nums`. */}
                  <p className="text-2xl font-bold tabular-nums text-primary-800 dark:text-primary-200">{formatTHB(fee.total)} บาท</p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    ราคาเต็ม <span className="tabular-nums">{formatTHB(fee.stateAmount)}</span> + ค่าแพลตฟอร์ม <span className="tabular-nums">{formatTHB(fee.platformAmount)}</span> + VAT 7% <span className="tabular-nums">{formatTHB(fee.vatAmount)}</span>
                  </p>
                </div>
              </header>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ระยะเวลาชำระ</dt>
                  <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{fee.when}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ค่าธรรมเนียมครอบคลุม</dt>
                  <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{fee.coverage}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">นโยบายขอคืน</dt>
                  <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{fee.refund}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </MarketingSection>

      <div className="bg-primary-50/40 dark:bg-primary-900/20">
        <MarketingSection
          id="payment-channels"
          eyebrow="ช่องทางชำระเงิน"
          title="ช่องทางการชำระเงิน"
          description="ระบบรองรับการชำระเงินผ่านช่องทางอิเล็กทรอนิกส์ ออกใบเสร็จ e-Tax Invoice ตามมาตรฐานสรรพากร"
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="rounded-xl border border-primary-100 bg-white p-4 text-sm shadow-sm dark:border-primary-900/40 dark:bg-zinc-900">
              <span className="block font-semibold text-zinc-900 dark:text-zinc-50">PromptPay</span>
              <span className="text-zinc-600 dark:text-zinc-300">QR Code พร้อมเพย์เลขประจำตัวผู้เสียภาษีของกรมฯ</span>
            </li>
            <li className="rounded-xl border border-primary-100 bg-white p-4 text-sm shadow-sm dark:border-primary-900/40 dark:bg-zinc-900">
              <span className="block font-semibold text-zinc-900 dark:text-zinc-50">โอนผ่านธนาคาร</span>
              <span className="text-zinc-600 dark:text-zinc-300">บัญชีกรมการแพทย์แผนไทยฯ พร้อมระบุเลขอ้างอิงในระบบ</span>
            </li>
          </ul>
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">
            ใบเสร็จและใบกำกับภาษีอิเล็กทรอนิกส์จะถูกส่งเข้าระบบของผู้ใช้งานภายใน 1 วันทำการหลังจากระบบยืนยันการชำระเงิน
          </p>
        </MarketingSection>
      </div>

      <MarketingSection
        id="legal-link"
        eyebrow="เงื่อนไขสัญญา"
        title="เงื่อนไขทางสัญญาฉบับเต็ม"
        description="รายละเอียดเงื่อนไขการให้บริการ การคืนเงิน และความรับผิดของแพลตฟอร์ม"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/terms-of-service"
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-700"
          >
            อ่านข้อกำหนดและเงื่อนไข
          </Link>
          <Link
            href="/privacy-policy"
            className="inline-flex items-center justify-center rounded-md border border-primary-300 px-5 py-3 text-sm font-semibold text-primary-800 hover:bg-primary-50 dark:border-primary-700 dark:text-primary-200 dark:hover:bg-primary-900/30"
          >
            นโยบายความเป็นส่วนตัว
          </Link>
        </div>
      </MarketingSection>
    </>
  );
}
