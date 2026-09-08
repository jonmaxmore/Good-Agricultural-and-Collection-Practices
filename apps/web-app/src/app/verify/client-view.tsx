'use client';

/**
 * ตรวจสอบใบรับรอง — หน้าสาธารณะ ไม่ต้องล็อกอิน
 *
 * ระบบเต็มมีหน้านี้เป็น "Trust Verifier Portal" ที่รวมการตรวจลายเซ็นดิจิทัลของเอกสาร
 * การเปิดเผยรายการเพิกถอน และการเชื่อมต่อ interoperability กับระบบภายนอก
 * GACP Lite เหลือคำถามเดียวที่คนนอกถามจริง ๆ: **ใบรับรองใบนี้ของจริงและยังใช้ได้ไหม**
 *
 * คำตอบมาจาก GET /api/public/verify/:certificateNumber ซึ่งเป็นประตูสาธารณะที่มี
 * rate limit ของตัวเอง — หน้านี้ไม่ตัดสินอะไรเอง มันแค่ถามและแสดงคำตอบ
 */

import { useState } from 'react';
import { CheckCircle2, XCircle, Search } from 'lucide-react';
import { apiClient } from '@/lib/api';

type VerifyResult = {
  valid: boolean;
  certificateNumber?: string;
  farmName?: string;
  holderDisplayName?: string;
  applicantName?: string;
  province?: string;
  cropType?: string;
  issuedDate?: string;
  expiryDate?: string;
  reasonCode?: string;
  reason?: string;
};

const thaiDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export default function VerifyCertificateView() {
  const [certNumber, setCertNumber] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = certNumber.trim();
    if (!value) return;
    setChecking(true);
    setResult(null);
    setError(null);
    const res = await apiClient.get<VerifyResult>(
      `/api/public/verify/${encodeURIComponent(value)}`,
      { skipAuth: true },
    );
    if (res.success && res.data) {
      setResult(res.data);
    } else {
      // ใบที่ไม่มีอยู่จริงก็เป็นคำตอบ ไม่ใช่ความผิดพลาดของระบบ
      setResult({ valid: false, certificateNumber: value, reason: res.error || 'ไม่พบใบรับรองเลขที่นี้' });
    }
    setChecking(false);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-foreground">ตรวจสอบใบรับรอง GACP</h1>
      <p className="mt-2 text-muted-foreground">
        กรอกเลขที่ใบรับรองที่ปรากฏบนเอกสาร เพื่อตรวจสอบว่าออกโดยระบบนี้จริงและยังไม่หมดอายุ
      </p>

      <form onSubmit={check} className="mt-6 flex gap-2">
        <input
          type="text"
          value={certNumber}
          onChange={(e) => setCertNumber(e.target.value)}
          placeholder="เช่น GACP-TH-2569-XXXXXX"
          aria-label="เลขที่ใบรับรอง"
          className="h-11 flex-1 rounded-xl border border-border bg-card px-4 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={checking || !certNumber.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-white disabled:opacity-50"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {checking ? 'กำลังตรวจ…' : 'ตรวจสอบ'}
        </button>
      </form>

      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

      {result && (
        <section
          aria-live="polite"
          className={`mt-8 rounded-2xl border p-6 ${
            result.valid ? 'border-leaf-300 bg-leaf-soft/40' : 'border-destructive/30 bg-destructive/5'
          }`}
        >
          <div className="flex items-center gap-3">
            {result.valid
              ? <CheckCircle2 className="h-7 w-7 text-leaf-onSoft" aria-hidden="true" />
              : <XCircle className="h-7 w-7 text-destructive" aria-hidden="true" />}
            <h2 className="text-lg font-bold text-foreground">
              {result.valid ? 'ใบรับรองถูกต้อง' : 'ใบรับรองไม่ถูกต้องหรือหมดอายุ'}
            </h2>
          </div>

          {result.valid ? (
            <dl className="mt-4 grid gap-2 text-sm">
              {[
                ['เลขที่ใบรับรอง', result.certificateNumber],
                ['ชื่อฟาร์ม', result.farmName],
                ['ผู้ถือใบรับรอง', result.holderDisplayName || result.applicantName],
                ['จังหวัด', result.province],
                ['พืชที่รับรอง', result.cropType],
                ['วันที่ออก', thaiDate(result.issuedDate)],
                ['วันหมดอายุ', thaiDate(result.expiryDate)],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex gap-3">
                  <dt className="w-32 flex-none text-muted-foreground">{label}</dt>
                  <dd className="text-foreground">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {result.reason || 'ระบบไม่พบใบรับรองเลขที่นี้ หรือใบรับรองถูกเพิกถอน/หมดอายุแล้ว'}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
