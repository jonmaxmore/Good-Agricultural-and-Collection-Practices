'use client';

/**
 * คิวงานของฝ่ายบัญชี — คำขอที่รอให้คนบอกว่าเงินเข้าแล้ว
 *
 * ระบบเต็มมีโมดูลบัญชีเต็มรูป: ใบแจ้งหนี้ ใบเสร็จ ใบลดหนี้ สมุดรายวัน งบทดลอง
 * ภ.พ.30 การกระทบยอด Stripe และแยกฝั่ง DTAM กับ PLATFORM เป็นคนละหน้า
 *
 * GACP Lite ไม่ออกเอกสารการเงินและไม่รับเงิน · หน่วยงานเก็บเงินด้วยช่องทางของตัวเอง
 * งานของฝ่ายบัญชีที่นี่จึงเหลืออย่างเดียว และเป็นอย่างที่สำคัญที่สุด: **บอกว่าเงินเข้าแล้ว**
 * เพราะคำขอเดินต่อไม่ได้จนกว่าจะมีคนพูดประโยคนั้น และคน ๆ นั้นต้องระบุตัวได้
 *
 * เจตนาที่หน้านี้ไม่ทำ: ไม่คำนวณราคาใหม่ (ราคาตรึงตอนยื่น) · ไม่ออกใบเสร็จ ·
 * ไม่ตรวจสอบว่าเงินเข้าจริง — ระบบไม่ได้ต่อกับบัญชีธนาคารใด และไม่ควรแสร้งว่าตรวจ
 */

import * as React from 'react';
import Link from 'next/link';
import { PageToolbar, SummaryCard, DataTable, StatusBadge, type DataColumn } from '@/components/finance';
import { apiClient } from '@/lib/api';
import ProviderLayout from '../components/provider-layout';
import { notifications } from '@/lib/notifications';

type PendingFee = {
  applicationId: string;
  applicationNumber: string;
  applicantName: string | null;
  phase: 'PHASE_1' | 'PHASE_2';
  label: string;
  amountThb: number;
  waitingSince: string;
};

const baht = (n: number) => new Intl.NumberFormat('th-TH').format(n);

const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

/** วันที่รอ — ตัวเลขที่บอกว่าเราทำให้ใครเสียเวลาไปเท่าไร */
const daysWaiting = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export default function FeeQueueClient() {
  const [rows, setRows] = React.useState<PendingFee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await apiClient.get<{ count: number; rows: PendingFee[] }>('/api/fees/pending');
    if (res.success && res.data) {
      setRows(res.data.rows);
    } else {
      notifications.show({ title: 'โหลดข้อมูลไม่สำเร็จ', message: res.error || 'อ่านคิวค่าธรรมเนียมไม่สำเร็จ', color: 'red' });
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const confirm = async (row: PendingFee) => {
    // เลขอ้างอิงคือสิ่งที่ทำให้ตามกลับไปที่หลักฐานตัวจริงได้ · ถามทุกครั้ง ไม่ตั้งค่าเริ่มต้น
    const reference = window.prompt(
      `ยืนยันรับ${row.label} ${baht(row.amountThb)} บาท\nคำขอ ${row.applicationNumber}\n\n`
      + 'เลขที่อ้างอิง (เลขใบเสร็จ / เลขรายการโอน / เลขหนังสือนำส่ง):',
    );
    if (reference === null) { return; }   // กดยกเลิก — ไม่ใช่การยืนยันด้วยค่าว่าง

    const key = `${row.applicationId}:${row.phase}`;
    setConfirming(key);
    const res = await apiClient.post(`/api/fees/${row.applicationId}/${row.phase}/confirm`, {
      externalReference: reference.trim() || null,
    });
    setConfirming(null);

    if (res.success) {
      notifications.show({ title: 'บันทึกแล้ว', message: `บันทึกการรับ${row.label}ของคำขอ ${row.applicationNumber} แล้ว`, color: 'green' });
      void load();
    } else {
      notifications.show({ title: 'บันทึกไม่สำเร็จ', message: res.error || 'บันทึกไม่สำเร็จ', color: 'red' });
    }
  };

  const columns: ReadonlyArray<DataColumn<PendingFee>> = [
    {
      key: 'application', header: 'คำขอ', type: 'link',
      render: (r) => (
        <Link href={`/provider/applications/${r.applicationId}`} className="font-medium text-primary hover:underline">
          {r.applicationNumber}
        </Link>
      ),
    },
    { key: 'applicant', header: 'ผู้ยื่น', type: 'text', render: (r) => r.applicantName || '—' },
    {
      key: 'phase', header: 'งวด', type: 'status',
      // `status` คือรหัสที่ใช้เลือกโทนสี ส่วน `label` คือข้อความที่คนอ่าน — ส่งข้อความไทย
      // เข้าช่อง status ทำให้ lookup ไม่เจอ แล้วป้ายขึ้นว่า "ไม่ทราบสถานะ" ซึ่งแปลว่า
      // เจ้าหน้าที่ไม่รู้ว่ากำลังยืนยันงวดไหนอยู่
      render: (r) => (
        <StatusBadge
          status={r.phase}
          label={r.label}
          tone={r.phase === 'PHASE_1' ? 'info' : 'pending'}
        />
      ),
    },
    {
      key: 'amount', header: 'จำนวน (บาท)', type: 'money',
      render: (r) => <span className="tabular-nums">{baht(r.amountThb)}</span>,
    },
    {
      key: 'waiting', header: 'รอมาแล้ว', type: 'date', mobileHidden: true,
      render: (r) => {
        const d = daysWaiting(r.waitingSince);
        return (
          <span className={d >= 7 ? 'font-semibold text-amber-700' : undefined}>
            {d} วัน <span className="text-muted-foreground">({thaiDate(r.waitingSince)})</span>
          </span>
        );
      },
    },
    {
      key: 'action', header: '', type: 'custom', align: 'right',
      render: (r) => {
        const key = `${r.applicationId}:${r.phase}`;
        return (
          <button
            type="button"
            onClick={() => confirm(r)}
            disabled={confirming !== null}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {confirming === key ? 'กำลังบันทึก…' : 'ยืนยันรับเงิน'}
          </button>
        );
      },
    },
  ];

  const total = rows.reduce((sum, r) => sum + r.amountThb, 0);
  const overdue = rows.filter((r) => daysWaiting(r.waitingSince) >= 7).length;

  // ProviderLayout คือแถบนำทางบน/เมนู/ท้ายหน้าของฝั่งเจ้าหน้าที่ · หน้าอื่นทุกหน้า
  // import มันเอง (มันไม่ได้อยู่ใน app/provider/layout.tsx) · ตอนแรกผมลืม ผลคือหน้า
  // ค่าธรรมเนียมแสดงลอย ๆ ไม่มีทางกลับ และเนื้อหาชนขอบจอ
  return (
    <ProviderLayout>
    <div className="flex flex-col gap-6">
      <PageToolbar
        title="ค่าธรรมเนียมที่รอยืนยัน"
        subtitle="คำขอที่ชำระแล้วแต่ระบบยังไม่รับรู้ · กดยืนยันเพื่อให้คำขอเดินต่อ"
        actions={[{ label: 'รีเฟรช', onClick: () => void load() }]}
      />

      <SummaryCard
        totals={[
          { label: 'คำขอที่รอ', value: String(rows.length) },
          { label: 'ยอดรวม (บาท)', value: baht(total) },
          { label: 'รอเกิน 7 วัน', value: String(overdue) },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => `${r.applicationId}:${r.phase}`}
        loading={loading}
        emptyTitle="ไม่มีคำขอรอยืนยัน"
        emptyDescription="ทุกคำขอที่ถึงขั้นชำระค่าธรรมเนียมได้รับการบันทึกแล้ว"
      />

      <p className="text-xs text-muted-foreground">
        ระบบนี้ไม่รับชำระเงินและไม่ตรวจสอบว่าเงินเข้าจริง · การกดยืนยันคือการบันทึกว่า
        <strong> คุณ </strong>ยืนยันว่าได้รับเงินแล้ว ชื่อของคุณและเวลาที่กดจะถูกบันทึกไว้กับคำขอ
      </p>
    </div>
    </ProviderLayout>
  );
}
