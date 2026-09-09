'use client';

/**
 * หน้าเลือกทางเข้า — สองประตู เท่าที่ระบบนี้มีจริง
 *
 * ระบบเต็มมีหน้านี้ยาว 687 บรรทัด เพราะมันต้องพาผู้ใช้ไปยัง IdP ของรัฐ (Health ID,
 * ThaID, Provider ID) แล้วรายงานสถานะของแต่ละช่องทางแบบ fail-closed: ปุ่มที่ยัง
 * เชื่อมต่อไม่ได้ต้องบอกว่าเชื่อมต่อไม่ได้ ไม่ใช่เงียบ ๆ แล้วพาไปตาย
 *
 * GACP Lite ไม่ต่อกับ IdP ใดเลย — ลูกค้าที่เอาระบบนี้ไปติดตั้งไม่มี credential ของ
 * กรมการปกครองหรือ สธ. และไม่ควรต้องมีเพื่อให้เกษตรกรล็อกอินได้ · เมื่อไม่มีช่องทาง
 * ที่ "อาจใช้ไม่ได้" ก็ไม่มีสถานะให้รายงาน หน้านี้จึงเหลือเท่าที่มันเป็นจริง: บอกว่า
 * คุณเป็นใคร แล้วพาไปประตูของคุณ
 *
 * สิ่งที่คงไว้จากของเดิมโดยตั้งใจ: ตราของกรมฯ, การแยกสองฝั่งด้วยสี leaf/officer,
 * รายการ "เลือกด้านนี้ถ้าคุณ..." ที่ทำให้ผู้ใช้ตัดสินใจได้โดยไม่ต้องรู้ศัพท์ของระบบ,
 * และปุ่มสลับโหมดมืด
 */

import Link from 'next/link';
import Image from 'next/image';
import { Check, Moon, ShieldCheck, Sprout, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/primitives/button';
import { useAppTheme } from '@/components/theme';
import { HEALTH_LOGIN_ROUTE, PROVIDER_LOGIN_ROUTE } from '@/lib/constants/auth-routes';
import { cn } from '@/lib/utils';
import { ORGANIZATION } from '@/lib/organization-identity';

type DoorAccent = 'leaf' | 'officer';

type DoorConfig = {
  id: string;
  accent: DoorAccent;
  icon: LucideIcon;
  title: string;
  who: string;
  checklistLabel: string;
  checklist: readonly string[];
  loginLabel: string;
  loginHref: string;
};

const DOORS: readonly DoorConfig[] = [
  {
    id: 'applicant',
    accent: 'leaf',
    icon: Sprout,
    title: 'สำหรับประชาชน · เกษตรกร',
    who: 'ผู้ขอรับรอง / เจ้าของแปลง / วิสาหกิจชุมชน',
    checklistLabel: 'เลือกด้านนี้ถ้าคุณต้องการ',
    checklist: [
      'ยื่นคำขอรับรองแปลงสมุนไพร GACP',
      'แนบเอกสารประกอบคำขอ และติดตามสถานะ',
      'ดาวน์โหลดใบรับรองของตนเอง',
    ],
    loginLabel: 'เข้าสู่ระบบด้วยเลขบัตรประชาชน',
    loginHref: HEALTH_LOGIN_ROUTE,
  },
  {
    id: 'officer',
    accent: 'officer',
    icon: ShieldCheck,
    title: 'สำหรับเจ้าหน้าที่',
    who: 'ผู้ตรวจเอกสาร ผู้ตรวจประเมิน และผู้ดูแลระบบ',
    checklistLabel: 'เลือกด้านนี้ถ้าคุณเป็น',
    checklist: [
      'ผู้ตรวจเอกสารคำขอ',
      'ผู้ตรวจประเมินแปลงปลูก',
      'ผู้ดูแลระบบของหน่วยงาน',
    ],
    loginLabel: 'เข้าสู่ระบบสำหรับเจ้าหน้าที่',
    loginHref: PROVIDER_LOGIN_ROUTE,
  },
] as const;

/**
 * คลาสต่อสี · `leaf` ใช้ variant `primary` ของ Button ได้ตรง ๆ (มันคือสีเดียวกันอยู่แล้ว)
 * ส่วน `officer` ต้องข้าม variant แล้วกำหนดเอง เพราะไม่มี variant สีนี้
 */
const ACCENT: Record<DoorAccent, {
  bar: string;
  iconWrap: string;
  tint: string;
  label: string;
  check: string;
  primaryVariant: ButtonProps['variant'];
  primaryClassName: string;
}> = {
  leaf: {
    bar: 'bg-leaf-700',
    iconWrap: 'bg-leaf-soft text-leaf-onSoft',
    tint: 'bg-leaf-soft',
    label: 'text-leaf-onSoft',
    check: 'text-leaf-onSoft',
    primaryVariant: 'primary',
    primaryClassName: '',
  },
  officer: {
    bar: 'bg-officer-700',
    iconWrap: 'bg-officer-soft text-officer-onSoft',
    tint: 'bg-officer-soft',
    label: 'text-officer-onSoft',
    check: 'text-officer-onSoft',
    primaryVariant: null,
    primaryClassName: 'bg-officer-700 text-white shadow-officer-btn hover:bg-officer-800',
  },
};

export default function LoginChooser() {
  const { colorScheme, toggleColorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  // จอเดสก์ท็อปสูง 900px แต่เนื้อหาจบที่ ~470px · เดิมเนื้อหาเกาะขอบบน แล้วเหลือที่ว่าง
  // 450px ข้างล่าง ซึ่งอ่านเป็น "หน้ายังทำไม่เสร็จ" ตั้งแต่แรกเห็น · justify-center
  // จัดกึ่งกลางเมื่อจอสูงพอ และถอยไปเกาะบนเองเมื่อเนื้อหายาวกว่าจอ (มือถือ)
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col justify-center bg-background px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-4 pb-6">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Image
              src="/images/dtam-seal.png"
              alt={`ตรา${ORGANIZATION.name}`}
              width={44}
              height={44}
              priority
              className="h-11 w-11 flex-none object-contain"
            />
            <span className="min-w-0 text-left leading-tight">
              <span className="block truncate text-base font-bold text-foreground">
                ระบบรับรอง GACP สมุนไพร
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Good Agricultural &amp; Collection Practices
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={toggleColorScheme}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
          >
            {isDark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
          </button>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {DOORS.map((door) => {
            const accent = ACCENT[door.accent];
            const Icon = door.icon;
            return (
              <section
                key={door.id}
                aria-labelledby={`door-${door.id}-title`}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className={cn('h-1.5 w-full', accent.bar)} aria-hidden="true" />
                <div className="flex flex-col gap-5 p-6">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={cn('flex h-12 w-12 flex-none items-center justify-center rounded-xl', accent.iconWrap)}
                    >
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 id={`door-${door.id}-title`} className="text-lg font-bold text-foreground">
                        {door.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">{door.who}</p>
                    </div>
                  </div>

                  <div className={cn('rounded-xl p-4', accent.tint)}>
                    <p className={cn('mb-2 text-xs font-semibold', accent.label)}>{door.checklistLabel}</p>
                    <ul className="flex flex-col gap-1.5">
                      {door.checklist.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className={cn('mt-0.5 h-4 w-4 flex-none', accent.check)} aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    asChild
                    variant={accent.primaryVariant ?? 'primary'}
                    className={cn('h-11 w-full', accent.primaryClassName)}
                  >
                    <Link href={door.loginHref} className="no-underline">
                      {door.loginLabel}
                    </Link>
                  </Button>
                </div>
              </section>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          ระบบรับรองมาตรฐาน GACP สมุนไพร
        </p>
      </div>
    </main>
  );
}
