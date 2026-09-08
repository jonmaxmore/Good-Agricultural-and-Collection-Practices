'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ShieldOff,
  Mail,
  Copy,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  Send,
} from 'lucide-react';

import { apiClient } from '@/lib/api/api-client';
import { AuthService } from '@/lib/services/auth-service';
import { notifications } from '@/lib/notifications';
import { Button } from '@/components/ui/primitives/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives/card';
import { Input } from '@/components/ui/primitives/input';
import { Badge } from '@/components/ui/primitives/badge';
import { SummaryHeader } from '@/components/feature';

// Shared backend MFA endpoints (mounted at /api/mfa). status/disable + the
// EMAIL-OTP enroll endpoints are authenticateAny, so the HEALTH session's
// cookie/bearer is accepted exactly like a provider's. The TOTP /setup path is
// provider-only and is deliberately NOT used here — health 2FA is email-only.
const MFA = {
  status: '/api/mfa/status',
  emailSetup: '/api/mfa/email/setup',
  emailVerifySetup: '/api/mfa/email/verify-setup',
  disable: '/api/mfa/disable',
} as const;

interface MfaStatusResponse {
  enabled: boolean;
  // server's view of whether an email is on file — authoritative for routing
  // the enroll flow (avoids a stale localStorage cache mis-routing to 'no-email')
  hasEmail?: boolean;
}
interface EmailSetupResponse {
  message: string;
  mocked?: boolean;
}
interface EmailVerifySetupResponse {
  message: string;
  backupCodes: string[];
  warning?: string;
}

type Phase =
  | 'loading'
  | 'no-email' // account has no email on file — must set one before enrolling
  | 'disabled' // email on file, 2FA off — offer "Enable"
  | 'enroll-code' // /email/setup sent a code; user enters it to confirm
  | 'backup-codes' // enrolled; show one-time recovery codes
  | 'enabled' // 2FA on — offer "Disable"
  | 'disable-code' // /email/setup sent a code; user enters it to turn 2FA off
  | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function HealthSecurityPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [mockedNotice, setMockedNotice] = useState(false);
  // Resend cooldown (seconds) — mirrors the backend 30s anti-bomb throttle so the
  // resend button self-disables with a countdown instead of erroring.
  const [cooldownSec, setCooldownSec] = useState(0);

  // First-time email set
  const [emailInput, setEmailInput] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Enroll
  const [enrollCode, setEnrollCode] = useState('');
  const [sendingEnroll, setSendingEnroll] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Backup codes (shown once)
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [acknowledgedBackup, setAcknowledgedBackup] = useState(false);

  // Disable
  const [disableCode, setDisableCode] = useState('');
  const [sendingDisable, setSendingDisable] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const loadStatus = useCallback(async () => {
    setPhase('loading');
    setErrorMsg(null);
    const onFileEmail = AuthService.getUser()?.email || null;
    setEmail(onFileEmail);
    try {
      const res = await apiClient.get<MfaStatusResponse>(MFA.status);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'อ่านสถานะ 2FA ไม่สำเร็จ');
      }
      // Prefer the server's hasEmail (authoritative); fall back to the cached
      // value only if an older backend omits the field.
      const hasEmail = res.data.hasEmail ?? Boolean(onFileEmail);
      if (res.data.enabled) {
        setPhase('enabled');
      } else {
        setPhase(hasEmail ? 'disabled' : 'no-email');
      }
    } catch (err) {
      setPhase('error');
      setErrorMsg(err instanceof Error ? err.message : 'อ่านสถานะ 2FA ไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldownSec <= 0) { return; }
    const t = setTimeout(() => setCooldownSec((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  // First-time email set. The backend only allows setting an email when none is
  // on file (changing an existing one needs a verified flow — DTAM staff today).
  const handleSaveEmail = useCallback(async () => {
    const candidate = emailInput.trim().toLowerCase();
    if (!EMAIL_RE.test(candidate)) {
      notifications.show({ title: 'รูปแบบอีเมลไม่ถูกต้อง', message: 'กรุณากรอกอีเมลให้ถูกต้อง', color: 'red' });
      return;
    }
    setSavingEmail(true);
    try {
      const result = await AuthService.updateProfile({ email: candidate });
      if (!result.success) {
        throw new Error(result.error || 'บันทึกอีเมลไม่สำเร็จ');
      }
      setEmail(result.data?.email || candidate);
      setEmailInput('');
      setPhase('disabled');
      notifications.show({ title: 'บันทึกอีเมลแล้ว', message: 'พร้อมเปิดใช้งานการยืนยัน 2 ขั้นตอนทางอีเมล', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'บันทึกอีเมลไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง',
        color: 'red',
      });
    } finally {
      setSavingEmail(false);
    }
  }, [emailInput]);

  // Ask the backend to email a 6-digit code (used for both enroll + disable).
  // Returns whether it was accepted and whether delivery was mocked (no SMTP).
  const requestCode = useCallback(async (): Promise<{ ok: boolean; mocked: boolean }> => {
    const res = await apiClient.post<EmailSetupResponse>(MFA.emailSetup, {});
    if (!res.success) {
      notifications.show({
        title: 'ส่งรหัสไม่สำเร็จ',
        message: res.error || 'กรุณาลองใหม่อีกครั้ง',
        color: 'red',
      });
      return { ok: false, mocked: false };
    }
    const mocked = res.data?.mocked === true;
    setMockedNotice(mocked);
    setCooldownSec(30); // align with the backend re-issue throttle
    return { ok: true, mocked };
  }, []);

  const handleStartEnroll = useCallback(async () => {
    setErrorMsg(null);
    setEnrollCode('');
    setSendingEnroll(true);
    try {
      const r = await requestCode();
      if (r.ok) {
        setPhase('enroll-code');
        notifications.show(r.mocked
          ? { title: 'โหมดทดสอบ', message: 'ระบบยังไม่ได้เปิดส่งอีเมลจริง รหัสจะไม่ถูกส่ง (ติดต่อผู้ดูแลระบบ)', color: 'orange' }
          : { title: 'ส่งรหัสไปที่อีเมลแล้ว', message: `ตรวจสอบกล่องจดหมาย ${email ?? ''}`.trim(), color: 'green' });
      }
    } finally {
      setSendingEnroll(false);
    }
  }, [requestCode, email]);

  const handleVerifyEnroll = useCallback(async () => {
    if (enrollCode.length !== 6) {
      notifications.show({ title: 'รหัส 6 หลักไม่ครบ', message: 'กรอกรหัสจากอีเมลให้ครบ 6 หลัก', color: 'red' });
      return;
    }
    setVerifying(true);
    try {
      const res = await apiClient.post<EmailVerifySetupResponse>(MFA.emailVerifySetup, { code: enrollCode });
      if (!res.success || !res.data) {
        throw new Error(res.error || 'รหัสไม่ถูกต้องหรือหมดอายุ');
      }
      setBackupCodes(res.data.backupCodes || []);
      setAcknowledgedBackup(false);
      setEnrollCode('');
      setPhase('backup-codes');
      notifications.show({ title: 'เปิดใช้งาน 2FA สำเร็จ', message: 'กรุณาบันทึกรหัสสำรองให้ปลอดภัย', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'ยืนยันรหัสไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'รหัสไม่ถูกต้องหรือหมดอายุ',
        color: 'red',
      });
    } finally {
      setVerifying(false);
    }
  }, [enrollCode]);

  const handleStartDisable = useCallback(async () => {
    setErrorMsg(null);
    setDisableCode('');
    setSendingDisable(true);
    try {
      const r = await requestCode();
      if (r.ok) {
        setPhase('disable-code');
        notifications.show(r.mocked
          ? { title: 'โหมดทดสอบ', message: 'ระบบยังไม่ได้เปิดส่งอีเมลจริง ปิด 2FA ทางอีเมลไม่ได้ตอนนี้ (เข้าสู่ระบบด้วยรหัสสำรองได้ หรือติดต่อผู้ดูแลระบบ)', color: 'orange' }
          : { title: 'ส่งรหัสยืนยันไปที่อีเมลแล้ว', message: 'กรอกรหัสเพื่อยืนยันการปิด 2FA', color: 'green' });
      }
    } finally {
      setSendingDisable(false);
    }
  }, [requestCode]);

  const handleDisable = useCallback(async () => {
    if (disableCode.length !== 6) {
      notifications.show({ title: 'รหัส 6 หลักไม่ครบ', message: 'กรอกรหัสจากอีเมลให้ครบ 6 หลัก', color: 'red' });
      return;
    }
    setDisabling(true);
    try {
      const res = await apiClient.delete(MFA.disable, { body: { code: disableCode } });
      if (!res.success) {
        throw new Error(res.error || 'ปิด 2FA ไม่สำเร็จ');
      }
      setDisableCode('');
      setPhase('disabled');
      notifications.show({ title: 'ปิด 2FA แล้ว', message: 'การเข้าสู่ระบบจะใช้รหัสผ่านอย่างเดียว', color: 'orange' });
    } catch (err) {
      notifications.show({
        title: 'ปิด 2FA ไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'รหัสไม่ถูกต้อง',
        color: 'red',
      });
    } finally {
      setDisabling(false);
    }
  }, [disableCode]);

  const handleCopyBackupCodes = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      notifications.show({ title: 'คัดลอกแล้ว', message: 'รหัสสำรองถูกคัดลอกไปยัง clipboard', color: 'green' });
    } catch {
      notifications.show({ title: 'คัดลอกไม่สำเร็จ', message: 'กรุณาคัดลอกด้วยตนเอง', color: 'red' });
    }
  }, [backupCodes]);

  const maskedEmail = (() => {
    if (!email || !email.includes('@')) { return email ?? ''; }
    const at = email.lastIndexOf('@');
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    // Never reveal the whole local part (matches the backend _maskEmail rule).
    const head = local.length >= 3 ? local.slice(0, 2) : (local.length === 2 ? local.slice(0, 1) : '');
    const maskLen = Math.max(1, local.length - head.length);
    return `${head}${'*'.repeat(maskLen)}@${domain}`;
  })();

  return (
    <div className="w-full space-y-6 p-4 pb-20 md:p-6 md:pb-6">
      <SummaryHeader
        eyebrow="ผู้ขอรับรอง · ความปลอดภัย"
        title="การยืนยันตัวตน 2 ขั้นตอน (อีเมล)"
        description="เพิ่มชั้นป้องกันบัญชี ทุกครั้งที่เข้าสู่ระบบ ระบบจะส่งรหัส 6 หลักไปที่อีเมลของคุณ"
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl"
            onClick={() => router.push('/health/profile')}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            กลับ
          </Button>
        }
      />

      {/* Status card */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/30 px-6 py-4">
          <CardTitle className="flex items-center gap-2 text-sm font-black text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Two-Factor Authentication (Email OTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">สถานะ:</span>
            {phase === 'loading' ? (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจสอบ
              </span>
            ) : phase === 'enabled' ? (
              <Badge tone="success" className="rounded-lg text-[10px] font-bold uppercase">เปิดใช้งาน</Badge>
            ) : phase === 'error' ? (
              <Badge tone="danger" className="rounded-lg text-[10px] font-bold uppercase">อ่านสถานะไม่ได้</Badge>
            ) : (
              <Badge tone="warning" className="rounded-lg text-[10px] font-bold uppercase">ยังไม่เปิดใช้งาน</Badge>
            )}
          </div>
          {email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-primary" />
              อีเมลที่ใช้รับรหัส: <span className="font-mono text-foreground">{maskedEmail}</span>
            </div>
          )}
          {mockedNotice && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>โหมดทดสอบ: ระบบยังไม่ได้ตั้งค่าการส่งอีเมลจริง รหัสจะไม่ถูกส่งออกไป (ติดต่อผู้ดูแลระบบเพื่อเปิด SMTP)</span>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase: no-email — must set an email first */}
      {phase === 'no-email' && (
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/30 px-6 py-4">
            <CardTitle className="text-sm font-bold text-muted-foreground">เพิ่มอีเมลก่อนเปิดใช้งาน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              บัญชีของคุณยังไม่มีอีเมลในระบบ กรอกอีเมลที่ใช้รับรหัสยืนยัน
              (ใช้สำหรับการยืนยัน 2 ขั้นตอนและการกู้คืนรหัสผ่าน)
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="max-w-sm flex-1">
                <Input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  disabled={savingEmail}
                  autoComplete="email"
                />
              </div>
              <Button
                onClick={() => void handleSaveEmail()}
                disabled={savingEmail || !EMAIL_RE.test(emailInput.trim())}
                className="rounded-xl"
              >
                {savingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                บันทึกอีเมล
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              หากต้องการเปลี่ยนอีเมลที่มีอยู่แล้ว ต้องยืนยันตัวตน กรุณาติดต่อเจ้าหน้าที่ DTAM
            </p>
          </CardContent>
        </Card>
      )}

      {/* Phase: disabled — offer enable */}
      {phase === 'disabled' && (
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">เปิดใช้งานการยืนยัน 2 ขั้นตอนทางอีเมล</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  ระบบจะส่งรหัส 6 หลักไปที่ <span className="font-mono">{maskedEmail}</span> เพื่อยืนยันว่าเป็นอีเมลของคุณ
                </p>
              </div>
            </div>
            <Button onClick={() => void handleStartEnroll()} disabled={sendingEnroll} className="rounded-xl">
              {sendingEnroll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              ส่งรหัสและเปิดใช้งาน
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: enroll-code — enter the emailed code to enable */}
      {phase === 'enroll-code' && (
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/30 px-6 py-4">
            <CardTitle className="text-sm font-bold text-muted-foreground">ยืนยันรหัสจากอีเมล</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              เราได้ส่งรหัส 6 หลักไปที่ <span className="font-mono">{maskedEmail}</span>  กรอกรหัสด้านล่าง (รหัสมีอายุ 5 นาที)
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="max-w-xs flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="text-center font-mono text-lg tracking-widest"
                  disabled={verifying}
                />
              </div>
              <Button
                onClick={() => void handleVerifyEnroll()}
                disabled={verifying || enrollCode.length !== 6}
                className="rounded-xl"
              >
                {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                ยืนยันและเปิดใช้งาน
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleStartEnroll()}
              disabled={sendingEnroll || cooldownSec > 0}
              className="rounded-xl"
            >
              <Send className="mr-2 h-4 w-4" />
              {cooldownSec > 0 ? `ส่งรหัสใหม่ได้ใน ${cooldownSec} วิ` : 'ส่งรหัสใหม่'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: backup-codes — show one-time recovery codes */}
      {phase === 'backup-codes' && (
        <Card className="rounded-2xl border-amber-300 bg-amber-50 shadow-sm">
          <CardHeader className="border-b border-amber-200 px-6 py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              บันทึก Backup Codes ก่อนปิดหน้านี้
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-foreground">
              หากคุณเข้าอีเมลไม่ได้ ใช้รหัสด้านล่างแทนได้ครั้งเดียวต่อรหัส {' '}
              <strong>เก็บให้ปลอดภัย ระบบจะไม่แสดงอีกครั้ง</strong>
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-card p-4 sm:grid-cols-4">
              {backupCodes.map((code, idx) => (
                <div
                  key={`${code}-${idx}`}
                  className="rounded-md border border-border bg-muted/40 px-3 py-2 text-center font-mono text-sm"
                >
                  {code}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={() => void handleCopyBackupCodes()} className="rounded-xl">
                <Copy className="mr-2 h-4 w-4" /> คัดลอกทั้งหมด
              </Button>
              <Button
                onClick={() => {
                  setAcknowledgedBackup(true);
                  setBackupCodes([]);
                  void loadStatus();
                }}
                disabled={acknowledgedBackup}
                className="rounded-xl"
              >
                ฉันบันทึกแล้ว ดำเนินการต่อ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase: enabled — offer disable */}
      {phase === 'enabled' && (
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/30 px-6 py-4">
            <CardTitle className="text-sm font-bold text-muted-foreground">ปิดใช้งาน 2FA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>การปิด 2FA จะลดความปลอดภัยของบัญชี ใช้เฉพาะเมื่อจำเป็น</span>
            </div>
            <p className="text-sm text-muted-foreground">
              เพื่อยืนยันว่าเป็นคุณ ระบบจะส่งรหัส 6 หลักไปที่อีเมลก่อนปิดใช้งาน
            </p>
            <Button
              variant="destructive"
              onClick={() => void handleStartDisable()}
              disabled={sendingDisable}
              className="rounded-xl"
            >
              {sendingDisable ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
              ส่งรหัสเพื่อปิด 2FA
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: disable-code — enter the emailed code to confirm disable */}
      {phase === 'disable-code' && (
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/30 px-6 py-4">
            <CardTitle className="text-sm font-bold text-muted-foreground">ยืนยันการปิด 2FA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              กรอกรหัส 6 หลักที่ส่งไปที่ <span className="font-mono">{maskedEmail}</span> เพื่อยืนยันการปิดใช้งาน
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="max-w-xs flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="text-center font-mono text-lg tracking-widest"
                  disabled={disabling}
                />
              </div>
              <Button
                variant="destructive"
                onClick={() => void handleDisable()}
                disabled={disabling || disableCode.length !== 6}
                className="rounded-xl"
              >
                {disabling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
                ปิดใช้งาน 2FA
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleStartDisable()}
              disabled={sendingDisable || cooldownSec > 0}
              className="rounded-xl"
            >
              <Send className="mr-2 h-4 w-4" />
              {cooldownSec > 0 ? `ส่งรหัสใหม่ได้ใน ${cooldownSec} วิ` : 'ส่งรหัสใหม่'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
