/**
 * Terms of Service — Iter 28 marketing site.
 *
 * Binding Terms of Service for the GACP Thailand platform. Covers
 * service scope, fees and payment terms, refund policy, user obligations,
 * platform liability limits, dispute resolution, and effective date.
 *
 * Replaces (does not delete) the older /terms shortcut page which now
 * re-exports a legacy summary used inside the registration flow.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  GACP_APPLICATION_FEE,
  GACP_INSPECTION_FEE,
  GACP_PLATFORM_RATE,
  GACP_VAT_RATE,
  GACP_PHASE1_TOTAL,
  GACP_PHASE2_TOTAL,
  gacpServiceFee,
} from '@/constants/fees';

// Fee figures are sourced from the SSoT (constants/fees.ts) so the binding ToS
// can never drift from the charged amounts.
//
// W14 (operator ruling 2026-08-22, HARNESS_LOG.md c28355ea): this clause used to
// state that the state fee was VAT-exempt under ม.77/1(10) and that VAT applied
// only to the platform service fee, and it computed that VAT inline as
// base x 10% x 7%. Both are now FALSE — one company issues every document and
// the whole ค่าบริการ is its taxable supply — and this is the binding ToS the
// applicant agrees to, so it cannot be left saying the retired thing.
const thb = (v: number): string => Math.round(v).toLocaleString('th-TH');

export const metadata: Metadata = {
  title: 'ข้อกำหนดและเงื่อนไขการใช้บริการ',
  description:
    'ข้อกำหนดและเงื่อนไขการใช้บริการระบบรับรองมาตรฐาน GACP สำหรับเกษตรกรไทย ภายใต้กรมการแพทย์แผนไทยและการแพทย์ทางเลือก',
  alternates: { canonical: 'https://gacpth.com/terms-of-service' },
};

const TERMS_VERSION = '1.0';
const TERMS_EFFECTIVE = '16 พฤษภาคม 2569';

const SECTIONS = [
  {
    id: 'definitions',
    title: '1. คำนิยาม',
    body: [
      '"แพลตฟอร์ม" หมายถึง ระบบรับรองมาตรฐาน GACP สมุนไพรไทย ที่ให้บริการผ่านเว็บไซต์ gacpth.com และระบบที่เกี่ยวข้อง',
      '"กรมฯ" หมายถึง กรมการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข ในฐานะหน่วยงานผู้ออกใบรับรอง',
      '"ผู้ใช้งาน" หมายถึง เกษตรกร นิติบุคคล กลุ่มเกษตรกร หรือบุคคลใดที่ลงทะเบียนเข้าใช้แพลตฟอร์ม',
      '"ใบรับรอง GACP" หมายถึง หนังสือรับรองที่กรมฯ ออกให้แก่ผู้ผ่านการตรวจประเมินตามมาตรฐาน GACP',
    ],
  },
  {
    id: 'service-scope',
    title: '2. ขอบเขตการให้บริการ',
    body: [
      'แพลตฟอร์มให้บริการยื่นคำขอ บันทึกข้อมูลฟาร์มและแปลงปลูก อัปโหลดเอกสารประกอบ ติดตามสถานะคำขอ ชำระค่าธรรมเนียม รับผลการตรวจประเมิน และรับใบรับรองในรูปแบบดิจิทัล',
      'การออกใบรับรองเป็นอำนาจหน้าที่ของกรมฯ ตามกฎหมาย แพลตฟอร์มเป็นเครื่องมือสนับสนุนการดำเนินงาน ไม่ใช่ผู้ออกใบรับรอง',
      'ผู้ใช้งานรับทราบว่าผลการตรวจประเมินขึ้นอยู่กับสภาพแปลงปลูก ความสมบูรณ์ของเอกสาร และการพิจารณาของคณะผู้ตรวจตามหลักเกณฑ์ของกรมฯ',
    ],
  },
  {
    id: 'fees',
    title: '3. ค่าธรรมเนียมและเงื่อนไขการชำระเงิน',
    body: [
      `ค่าบริการคิดต่อขอบเขตการปลูก แบ่งชำระเป็น 2 งวด ได้แก่ (1) ค่าตรวจเอกสาร ${thb(GACP_PHASE1_TOTAL)} บาท ประกอบด้วยราคาเต็ม ${thb(GACP_APPLICATION_FEE)} บาท และค่าแพลตฟอร์ม 10% ${thb(GACP_APPLICATION_FEE * GACP_PLATFORM_RATE)} บาท รวมเป็นค่าบริการ ${thb(gacpServiceFee(GACP_APPLICATION_FEE))} บาท บวกภาษีมูลค่าเพิ่ม 7% ของค่าบริการ ${thb(Math.round(gacpServiceFee(GACP_APPLICATION_FEE) * GACP_VAT_RATE))} บาท และ (2) ค่าตรวจประเมินภาคสนาม ${thb(GACP_PHASE2_TOTAL)} บาท ประกอบด้วยราคาเต็ม ${thb(GACP_INSPECTION_FEE)} บาท และค่าแพลตฟอร์ม 10% ${thb(GACP_INSPECTION_FEE * GACP_PLATFORM_RATE)} บาท รวมเป็นค่าบริการ ${thb(gacpServiceFee(GACP_INSPECTION_FEE))} บาท บวกภาษีมูลค่าเพิ่ม 7% ของค่าบริการ ${thb(Math.round(gacpServiceFee(GACP_INSPECTION_FEE) * GACP_VAT_RATE))} บาท`,
      'การชำระเงินรองรับช่องทาง PromptPay และการโอนผ่านบัญชีธนาคารของบริษัท โดยชำระครั้งเดียวต่องวด',
      'บริษัทเป็นผู้ออกใบเสนอราคา ใบวางบิล และใบเสร็จรับเงิน/ใบกำกับภาษีเต็มรูปแต่เพียงผู้เดียว โดยจะออกภายใน 1 วันทำการหลังจากยืนยันการชำระเงิน',
      'นโยบายขอคืนเงิน: ค่าธรรมเนียมงวดที่ 1 (ค่าตรวจเอกสาร) ไม่สามารถขอคืนได้หลังจากเริ่มตรวจสอบเอกสาร ค่าธรรมเนียมงวดที่ 2 (ค่าตรวจประเมินภาคสนาม) สามารถขอคืนได้ก่อนกำหนดวันตรวจไม่น้อยกว่า 7 วันทำการ',
    ],
  },
  {
    id: 'user-obligations',
    title: '4. หน้าที่และความรับผิดชอบของผู้ใช้งาน',
    body: [
      'ผู้ใช้งานต้องให้ข้อมูลที่ถูกต้อง ครบถ้วน และเป็นปัจจุบันในการลงทะเบียนและยื่นคำขอ',
      'ผู้ใช้งานต้องเก็บรักษาข้อมูลเข้าสู่ระบบ (Username, Password, OTP) เป็นความลับ การกระทำใดที่เกิดขึ้นภายใต้บัญชีของผู้ใช้งานถือเป็นการกระทำของผู้ใช้งานเอง',
      'ห้ามใช้ระบบในลักษณะที่ขัดต่อกฎหมาย ก่อให้เกิดความเสียหายต่อระบบ หรือกระทบความมั่นคงปลอดภัยสารสนเทศ',
      'ผู้ใช้งานต้องให้ความร่วมมือกับเจ้าหน้าที่ตรวจประเมิน เปิดให้เข้าตรวจแปลงปลูกตามวันเวลาที่กำหนด',
    ],
  },
  {
    id: 'liability',
    title: '5. ข้อจำกัดความรับผิดของแพลตฟอร์ม',
    body: [
      'แพลตฟอร์มจะดูแลให้ระบบใช้งานได้อย่างต่อเนื่อง อย่างไรก็ตามอาจมีช่วงเวลาบำรุงรักษาหรือเหตุสุดวิสัยที่ทำให้ระบบไม่สามารถใช้งานชั่วคราว',
      'แพลตฟอร์มไม่รับผิดต่อความเสียหายทางอ้อม ความเสียหายโดยบังเอิญ หรือการสูญเสียโอกาสทางธุรกิจที่เกิดจากการใช้งานระบบ เว้นแต่เป็นการกระทำโดยจงใจหรือประมาทเลินเล่ออย่างร้ายแรง',
      'ผลการตรวจประเมินและการออกใบรับรองเป็นดุลพินิจของกรมฯ แพลตฟอร์มไม่อาจรับประกันว่าคำขอใด ๆ จะต้องผ่านการตรวจประเมิน',
    ],
  },
  {
    id: 'suspension',
    title: '6. การระงับและยกเลิกบัญชี',
    body: [
      'หน่วยงานสามารถระงับบัญชีชั่วคราวหรือถาวรได้หากพบการใช้งานที่ขัดต่อข้อกำหนด การให้ข้อมูลเท็จ หรือพฤติกรรมที่อาจกระทบความมั่นคงปลอดภัยของระบบ',
      'ผู้ใช้งานสามารถขอลบบัญชีได้ผ่านช่องทางที่ระบบกำหนด โดยข้อมูลที่อยู่ภายใต้ระยะเวลาเก็บรักษาตามกฎหมายจะยังคงถูกเก็บไว้ตามที่กฎหมายกำหนด',
    ],
  },
  {
    id: 'changes',
    title: '7. การเปลี่ยนแปลงข้อกำหนด',
    body: [
      'หน่วยงานอาจปรับปรุงข้อกำหนดนี้ตามนโยบายภาครัฐ กฎหมาย หรือข้อกำกับที่มีผลบังคับใช้',
      'การเปลี่ยนแปลงสาระสำคัญจะแจ้งผู้ใช้งานล่วงหน้าไม่น้อยกว่า 30 วันผ่านอีเมลและในระบบ การใช้งานต่อหลังวันที่มีผลบังคับใช้ถือว่ายอมรับข้อกำหนดฉบับใหม่',
    ],
  },
  {
    id: 'dispute',
    title: '8. กฎหมายที่ใช้บังคับและเขตอำนาจศาล',
    body: [
      'ข้อกำหนดและเงื่อนไขนี้อยู่ภายใต้กฎหมายของราชอาณาจักรไทย',
      'กรณีเกิดข้อพิพาทจะให้พยายามไกล่เกลี่ยโดยสันติวิธีเป็นลำดับแรก หากไม่สามารถตกลงกันได้ ให้นำคดีขึ้นพิจารณาในศาลปกครองหรือศาลที่มีเขตอำนาจตามกฎหมายไทย',
    ],
  },
  {
    id: 'contact',
    title: '9. ช่องทางติดต่อ',
    body: [
      'หากมีข้อสงสัยเกี่ยวกับข้อกำหนดและเงื่อนไขนี้ สามารถติดต่อกรมการแพทย์แผนไทยและการแพทย์ทางเลือก ที่อีเมล contact@gacpth.com หรือโทร 0-2591-7007 ในวันและเวลาราชการ',
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <>
      <section
        aria-labelledby="tos-hero"
        className="bg-primary-50 dark:bg-zinc-950"
      >
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
          <p className="mb-2 text-xs font-semibold text-primary-700 dark:text-primary-300">
            เอกสารทางสัญญา
          </p>
          <h1 id="tos-hero" className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl md:text-5xl">
            ข้อกำหนดและเงื่อนไขการใช้บริการ
          </h1>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <div className="flex gap-2">
              <dt className="font-semibold">เวอร์ชัน:</dt>
              <dd>{TERMS_VERSION}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold">วันที่มีผลบังคับใช้:</dt>
              <dd>{TERMS_EFFECTIVE}</dd>
            </div>
          </dl>
          <p className="mt-4 max-w-3xl text-base text-zinc-600 dark:text-zinc-300">
            กรุณาอ่านข้อกำหนดและเงื่อนไขฉบับนี้โดยละเอียดก่อนใช้บริการ การลงทะเบียนหรือใช้งานแพลตฟอร์มถือว่าผู้ใช้งานยอมรับข้อกำหนดและเงื่อนไขทั้งหมดที่ระบุไว้
          </p>
        </div>
      </section>

      <section
        aria-label="สารบัญข้อกำหนด"
        className="border-y border-primary-100 bg-white dark:border-primary-900/40 dark:bg-zinc-950"
      >
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">สารบัญ</h2>
          <ol className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-primary-700 underline hover:text-primary-800 dark:text-primary-300">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16 lg:px-0">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="mb-10 scroll-mt-24">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-2xl">{section.title}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-7 text-zinc-700 dark:text-zinc-200">
              {section.body.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ol>
          </section>
        ))}

        <aside className="mt-12 rounded-2xl border border-primary-100 bg-primary-50/60 p-6 dark:border-primary-900/40 dark:bg-primary-900/20">
          <h2 className="text-base font-semibold text-primary-900 dark:text-primary-100">เอกสารอ้างอิงที่เกี่ยวข้อง</h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              <Link href="/privacy-policy" className="text-primary-700 underline hover:text-primary-800 dark:text-primary-300">
                นโยบายความเป็นส่วนตัว
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-primary-700 underline hover:text-primary-800 dark:text-primary-300">
                ค่าธรรมเนียมการรับรอง
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-primary-700 underline hover:text-primary-800 dark:text-primary-300">
                เกี่ยวกับเรา และช่องทางติดต่อ
              </Link>
            </li>
          </ul>
        </aside>
      </article>
    </>
  );
}
