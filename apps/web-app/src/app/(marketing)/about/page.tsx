/**
 * About page — Iter 28 marketing site.
 *
 * Explains who runs the GACP Thailand platform: DTAM as the certifying
 * authority and Predictive AI Solution as the technology partner.
 * Includes mission, scope, and contact channels.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingSection, MarketingCard } from '@/components/marketing/marketing-section';
import { MINISTRY_CONTACT } from '@/lib/ministry-contact';

export const metadata: Metadata = {
  title: 'เกี่ยวกับเรา',
  description:
    'ระบบรับรองมาตรฐาน GACP สมุนไพรไทย ดำเนินงานโดยกรมการแพทย์แผนไทยและการแพทย์ทางเลือก (DTAM) ร่วมกับ Predictive AI Solution ผู้พัฒนาแพลตฟอร์ม',
  alternates: { canonical: 'https://gacpth.com/about' },
};

const PARTNERS = [
  {
    title: 'กรมการแพทย์แผนไทยและการแพทย์ทางเลือก (DTAM)',
    description:
      'หน่วยงานราชการในสังกัดกระทรวงสาธารณสุข ผู้กำกับมาตรฐานสมุนไพรไทย ผู้ออกใบรับรอง GACP ตามอำนาจหน้าที่ของรัฐ',
    badge: 'ผู้ออกใบรับรอง',
  },
  {
    title: 'Predictive AI Solution',
    description:
      'ผู้พัฒนาและดูแลแพลตฟอร์มเทคโนโลยี GACP Thailand รับผิดชอบด้านระบบ ความมั่นคงปลอดภัย และการสนับสนุนผู้ใช้งานในเชิงเทคนิค',
    badge: 'ผู้พัฒนาระบบ',
  },
];

const MISSION_POINTS = [
  {
    title: 'ยกระดับสมุนไพรไทยสู่สากล',
    description:
      'สร้างมาตรฐานเดียวกันทั่วประเทศ ทำให้ผลผลิตสมุนไพรไทยมีคุณภาพสม่ำเสมอและตรวจสอบย้อนกลับได้',
  },
  {
    title: 'ลดต้นทุนและเวลาให้เกษตรกร',
    description:
      'ลดขั้นตอนเอกสารกระดาษ ตัดการเดินทาง และเปิดให้ติดตามสถานะการรับรองได้ทุกขั้นตอนผ่านระบบออนไลน์',
  },
  {
    title: 'โปร่งใส ตรวจสอบได้',
    description:
      'ใบรับรองทุกฉบับมี QR Code ผู้ซื้อ ผู้นำเข้า และผู้บริโภคสามารถตรวจสอบความถูกต้องได้สาธารณะ',
  },
];

export default function AboutPage() {
  return (
    <>
      <section
        aria-labelledby="about-hero"
        className="bg-primary-50 dark:bg-zinc-950"
      >
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <p className="mb-2 text-xs font-semibold text-primary-700 dark:text-primary-300">
            เกี่ยวกับเรา
          </p>
          <h1 id="about-hero" className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl md:text-5xl">
            พันธมิตรเพื่อมาตรฐานสมุนไพรไทย
          </h1>
          <p className="mt-4 max-w-3xl text-base text-zinc-600 dark:text-zinc-300 sm:text-lg">
            GACP Thailand เกิดจากความร่วมมือระหว่างหน่วยงานราชการผู้กำกับมาตรฐาน
            กับผู้พัฒนาเทคโนโลยีที่เข้าใจบริบทเกษตรกรไทย เพื่อให้กระบวนการรับรองสมุนไพรเป็นเรื่องที่
            เกษตรกรทุกคนเข้าถึงได้
          </p>
        </div>
      </section>

      <MarketingSection
        id="partners"
        eyebrow="ผู้ดำเนินงาน"
        title="ใครอยู่เบื้องหลังระบบ"
        description="หน่วยงานราชการรับรองมาตรฐาน ผู้พัฒนาดูแลด้านเทคโนโลยี"
      >
        <div className="grid gap-6 md:grid-cols-2">
          {PARTNERS.map((partner) => (
            <MarketingCard
              key={partner.title}
              title={partner.title}
              description={partner.description}
              badge={partner.badge}
            />
          ))}
        </div>
      </MarketingSection>

      <div className="bg-primary-50/40 dark:bg-primary-900/20">
        <MarketingSection
          id="mission"
          eyebrow="พันธกิจ"
          title="พันธกิจของเรา"
          description="สามเป้าหมายที่ทีมงานยึดเป็นกรอบในการพัฒนาแพลตฟอร์ม"
        >
          <div className="grid gap-6 md:grid-cols-3">
            {MISSION_POINTS.map((item) => (
              <MarketingCard key={item.title} title={item.title} description={item.description} />
            ))}
          </div>
        </MarketingSection>
      </div>

      <MarketingSection
        id="about-contact"
        eyebrow="ช่องทางติดต่อ"
        title="ติดต่อเจ้าหน้าที่กรมฯ"
        description="สำหรับคำถามเชิงนโยบาย กระบวนการรับรอง หรือสิทธิผู้ใช้งาน"
      >
        <div className="rounded-2xl border border-primary-100 bg-white p-6 shadow-sm dark:border-primary-900/40 dark:bg-zinc-900">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">หน่วยงาน</dt>
              <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{MINISTRY_CONTACT.ministry}</dd>
              <dd className="text-xs text-zinc-500 dark:text-zinc-400" lang="en">{MINISTRY_CONTACT.ministryEn}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ที่อยู่</dt>
              <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{MINISTRY_CONTACT.address}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">โทรศัพท์</dt>
              <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{MINISTRY_CONTACT.phone}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">อีเมล</dt>
              <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{MINISTRY_CONTACT.email}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">เว็บไซต์</dt>
              <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                <a
                  href={MINISTRY_CONTACT.website}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded text-primary-700 underline hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2 dark:text-primary-300"
                  aria-label={`${MINISTRY_CONTACT.website} (เปิดในแท็บใหม่)`}
                >
                  {MINISTRY_CONTACT.website}
                </a>
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 font-semibold text-white hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              เริ่มสมัครใช้งาน
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-md border border-primary-300 px-4 py-2 font-semibold text-primary-800 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:border-primary-700 dark:text-primary-200 dark:hover:bg-primary-900/30"
            >
              ดูค่าธรรมเนียม
            </Link>
          </div>
        </div>
      </MarketingSection>
    </>
  );
}
