'use client';

/**
 * ค่าธรรมเนียม — หน้าที่บอกว่าต้องจ่ายเท่าไร และระบบรับรู้แล้วหรือยัง
 *
 * ระบบเต็มมีหน้านี้เป็นหน้าชำระเงินจริง: ใบเสนอราคาให้กดยอมรับ ใบแจ้งหนี้สองใบ
 * ปุ่มไป Stripe checkout ใบเสร็จ และช่องการคืนเงิน · GACP Lite ไม่รับเงิน ลูกค้า
 * เก็บเงินด้วยช่องทางของตัวเอง แล้วเจ้าหน้าที่บันทึกในระบบ (คำตัดสิน operator 2026-09-08)
 *
 * สิ่งที่หน้านี้ยังต้องทำ และเป็นเหตุผลที่มันไม่ถูกลบไปพร้อมกับ Stripe: ผู้ยื่นต้องรู้
 * ว่าต้องจ่ายเท่าไร และต้องเห็นว่าเจ้าหน้าที่ยืนยันรับแล้วหรือยัง · ถ้าไม่เห็น เขาก็ต้อง
 * โทรถาม ซึ่งเป็นภาระที่ระบบสร้างขึ้นเอง
 *
 * หน้านี้ไม่มีปุ่มจ่ายเงิน โดยตั้งใจ — ปุ่มที่กดแล้วไม่เกิดอะไรขึ้นแย่กว่าไม่มีปุ่ม
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Clock, FileText, Info } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

type FeePhase = {
  phase: 'PHASE_1' | 'PHASE_2';
  label: string;
  amountThb: number;
  confirmed: boolean;
  confirmable: boolean;
};

type FeePayment = {
  id: string;
  phase: string;
  amountThb: number;
  externalReference: string | null;
  note: string | null;
  confirmedAt: string;
  confirmedBy: { id: string; firstName: string | null; lastName: string | null } | null;
};

type FeeStatus = {
  applicationId: string;
  applicationNumber: string;
  status: string;
  phases: FeePhase[];
  payments: FeePayment[];
};

const baht = (n: number) => new Intl.NumberFormat('th-TH').format(n);

const thaiDateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export default function FeeStatusView() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('app');
  const [status, setStatus] = useState<FeeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!applicationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiClient.get<FeeStatus>(`/api/fees/${applicationId}`);
    if (res.success && res.data) {
      setStatus(res.data);
      setError(null);
    } else {
      setError(res.error || 'อ่านข้อมูลค่าธรรมเนียมไม่สำเร็จ');
    }
    setLoading(false);
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  if (!applicationId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">ค่าธรรมเนียม</h1>
        <p className="mt-2 text-muted-foreground">
          เปิดหน้านี้จากคำขอที่ต้องการดู เพื่อให้ระบบรู้ว่าเป็นค่าธรรมเนียมของใบไหน
        </p>
        <Link href="/health/applications" className="mt-4 inline-block text-primary underline">
          ไปที่คำขอของฉัน
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">ค่าธรรมเนียม</h1>
      {status && (
        <p className="mt-1 text-sm text-muted-foreground">
          คำขอเลขที่ {status.applicationNumber}
        </p>
      )}

      {loading && <p className="mt-6 text-muted-foreground">กำลังโหลด…</p>}

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          {error}
        </div>
      )}

      {status && (
        <>
          <div className="mt-6 flex flex-col gap-3">
            {status.phases.map((phase) => {
              const payment = status.payments.find((p) => p.phase === phase.phase);
              return (
                <section
                  key={phase.phase}
                  className={cn(
                    'rounded-xl border p-5',
                    phase.confirmed ? 'border-leaf-300 bg-leaf-soft/40' : 'border-border bg-card',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-foreground">{phase.label}</h2>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                        {baht(phase.amountThb)} <span className="text-base font-normal">บาท</span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                        phase.confirmed ? 'bg-leaf-soft text-leaf-onSoft' : 'bg-amber-100 text-amber-900',
                      )}
                    >
                      {phase.confirmed
                        ? <><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />เจ้าหน้าที่ยืนยันรับแล้ว</>
                        : <><Clock className="h-3.5 w-3.5" aria-hidden="true" />รอชำระ</>}
                    </span>
                  </div>

                  {payment && (
                    <dl className="mt-4 grid gap-1 border-t border-border/60 pt-3 text-sm">
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">ยืนยันเมื่อ</dt>
                        <dd className="text-foreground">{thaiDateTime(payment.confirmedAt)}</dd>
                      </div>
                      {payment.confirmedBy && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground">ยืนยันโดย</dt>
                          <dd className="text-foreground">
                            {[payment.confirmedBy.firstName, payment.confirmedBy.lastName].filter(Boolean).join(' ') || 'เจ้าหน้าที่'}
                          </dd>
                        </div>
                      )}
                      {payment.externalReference && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground">อ้างอิง</dt>
                          <dd className="text-foreground">{payment.externalReference}</dd>
                        </div>
                      )}
                      {payment.note && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground">หมายเหตุ</dt>
                          <dd className="text-foreground">{payment.note}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </section>
              );
            })}
          </div>

          <div className="mt-6 flex gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-[18px] w-[18px] flex-none" aria-hidden="true" />
            <p>
              ระบบนี้ไม่รับชำระเงินโดยตรง · กรุณาชำระตามช่องทางที่หน่วยงานแจ้ง
              แล้วเจ้าหน้าที่จะบันทึกการรับเงินให้ สถานะด้านบนจะเปลี่ยนเมื่อบันทึกแล้ว
            </p>
          </div>

          <Link
            href={`/health/applications/${status.applicationId}`}
            className="mt-6 inline-flex items-center gap-2 text-sm text-primary underline"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            กลับไปที่คำขอ
          </Link>
        </>
      )}
    </main>
  );
}
