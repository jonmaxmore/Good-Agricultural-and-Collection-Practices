'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Mail,
  Phone,
  ShieldCheck,
  Globe,
  ArrowLeft,
  Leaf,
  Check,
  AlertCircle,
} from 'lucide-react';
import { apiClient as api } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';

type InputType = 'phone' | 'email';

const COPY = {
  th: {
    title: 'ลืมรหัสผ่าน',
    subtitle: 'กรอกข้อมูลเพื่อรีเซ็ตรหัสผ่าน ระบบจะส่งลิงก์ผ่านช่องทางที่เลือก',
    heroTitle: 'กู้คืน\nรหัสผ่าน',
    heroSub: 'ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ผ่านช่องทางที่ท่านเลือก',
    heroFeature1: 'รีเซ็ตผ่าน SMS หรืออีเมล',
    heroFeature2: 'ลิงก์ใช้ได้ครั้งเดียวภายใน 15 นาที',
    heroFeature3: 'บันทึกตามมาตรฐานความปลอดภัยภาครัฐ',
    channelLabel: 'เลือกช่องทาง',
    tabPhone: 'เบอร์โทรศัพท์',
    tabEmail: 'อีเมล',
    inputLabelPhone: 'เบอร์โทรศัพท์',
    inputLabelEmail: 'อีเมล',
    placeholderPhone: '0812345678',
    placeholderEmail: 'name@example.com',
    invalidPhone: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง',
    invalidEmail: 'กรุณากรอกอีเมลให้ถูกต้อง',
    submit: 'ส่งลิงก์รีเซ็ตรหัสผ่าน',
    submitting: 'กำลังส่ง...',
    successTitle: 'ส่งลิงก์เรียบร้อยแล้ว',
    successBody: 'เราได้ส่งลิงก์รีเซ็ตไปยัง',
    channelPhone: 'เบอร์โทรศัพท์',
    channelEmail: 'อีเมล',
    successSuffix: 'ที่ท่านระบุ',
    retry: 'ส่งคำขอใหม่',
    backToLogin: 'กลับไปหน้าเข้าสู่ระบบ',
    connectError: 'ไม่สามารถเชื่อมต่อระบบได้ในขณะนี้',
    sendError: 'ไม่สามารถส่งลิงก์รีเซ็ตได้',
    secure: 'การกู้คืนบัญชีถูกบันทึกตามมาตรฐานความปลอดภัยภาครัฐ',
  },
  en: {
    title: 'Forgot Password',
    subtitle: 'Enter your details to reset your password. A reset link will be sent via your chosen channel.',
    heroTitle: 'Password\nRecovery',
    heroSub: 'We will send a secure link to reset your password through the channel you select.',
    heroFeature1: 'Reset via SMS or email',
    heroFeature2: 'One-time link valid for 15 minutes',
    heroFeature3: 'Logged per government security standards',
    channelLabel: 'Reset channel',
    tabPhone: 'Phone',
    tabEmail: 'Email',
    inputLabelPhone: 'Phone number',
    inputLabelEmail: 'Email address',
    placeholderPhone: '0812345678',
    placeholderEmail: 'name@example.com',
    invalidPhone: 'Please enter a valid phone number',
    invalidEmail: 'Please enter a valid email address',
    submit: 'Send reset link',
    submitting: 'Sending...',
    successTitle: 'Reset link sent',
    successBody: 'We have sent a reset link to the',
    channelPhone: 'phone number',
    channelEmail: 'email address',
    successSuffix: 'you provided.',
    retry: 'Send another request',
    backToLogin: 'Back to sign in',
    connectError: 'Connection error. Please try again.',
    sendError: 'Unable to send reset link',
    secure: 'Account recovery is logged according to government security standards.',
  },
} as const;

export default function ForgotPasswordPage() {
  const { language, setLanguage } = useLanguage();
  const copy = COPY[language === 'en' ? 'en' : 'th'];

  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<InputType>('phone');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePhone = (value: string) => /^0\d{9}$/.test(value);
  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isValid = inputType === 'phone' ? validatePhone(input) : validateEmail(input);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) {
      setError(inputType === 'phone' ? copy.invalidPhone : copy.invalidEmail);
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const result = await api.post<Record<string, unknown>>('/auth/health/reset-password', {
        [inputType]: input.trim(),
      });
      if (!result.success) {
        setError(result.error || copy.sendError);
        setIsLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError(copy.connectError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="gov-auth-page">
      {/* ── Left Hero Panel (Desktop) ── */}
      <section className="gov-auth-hero">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/20 p-2">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <span className="text-xs font-black text-white/90">
            GACP Platform
          </span>
        </div>

        <div className="gov-auth-hero-content">
          <h1 className="gov-auth-hero-title whitespace-pre-line">{copy.heroTitle}</h1>
          <p className="gov-auth-hero-subtitle">{copy.heroSub}</p>

          <div className="mt-8 space-y-3">
            {[copy.heroFeature1, copy.heroFeature2, copy.heroFeature3].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-white/80">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3 w-3" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-white/80">
          <span>DTAM Official</span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
          <span>MOPH Thailand</span>
        </div>
      </section>

      {/* ── Right Form Panel ── */}
      <section className="gov-auth-form-panel">
        <div className="gov-auth-form-scroll">
          <div className="gov-auth-form-inner">
            <div className="gov-auth-lang-row">
              <button
                type="button"
                onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}
                className="gov-auth-lang-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={language === 'th' ? 'Switch language to English' : 'เปลี่ยนภาษาเป็นภาษาไทย'}
              >
                <Globe size={14} aria-hidden="true" focusable="false" />
                {language === 'th' ? 'EN' : 'TH'}
              </button>
            </div>

            <h2 className="gov-auth-form-title">{copy.title}</h2>
            <p className="gov-auth-form-subtitle">{copy.subtitle}</p>

            {/* Error alert */}
            {error && (
              <div id="reset-input-error" className="gov-auth-alert gov-auth-alert-danger animate-shake mb-4" role="alert">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" focusable="false" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Success message */}
            {sent && (
              <div className="gov-auth-alert gov-auth-alert-success mb-4">
                <div className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">{copy.successTitle}</p>
                    <p className="mt-1 text-sm">
                      {copy.successBody}{' '}
                      {inputType === 'phone' ? copy.channelPhone : copy.channelEmail}{' '}
                      {copy.successSuffix}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Channel picker */}
                <div role="radiogroup" aria-label={copy.channelLabel}>
                  <span className="gov-auth-label" id="reset-channel-label">{copy.channelLabel}</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={inputType === 'phone'}
                      onClick={() => {
                        setInputType('phone');
                        setInput('');
                        setError('');
                      }}
                      className={`gov-auth-outline-btn !h-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${inputType === 'phone'
                          ? '!border-leaf-700 !bg-leaf-soft !text-leaf-onSoft'
                          : ''
                        }`}
                    >
                      <Phone size={14} aria-hidden="true" focusable="false" />
                      {copy.tabPhone}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={inputType === 'email'}
                      onClick={() => {
                        setInputType('email');
                        setInput('');
                        setError('');
                      }}
                      className={`gov-auth-outline-btn !h-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${inputType === 'email'
                          ? '!border-leaf-700 !bg-leaf-soft !text-leaf-onSoft'
                          : ''
                        }`}
                    >
                      <Mail size={14} aria-hidden="true" focusable="false" />
                      {copy.tabEmail}
                    </button>
                  </div>
                </div>

                {/* Input field */}
                <div>
                  <label htmlFor="reset-input" className="gov-auth-label">
                    {inputType === 'phone' ? copy.inputLabelPhone : copy.inputLabelEmail}
                  </label>
                  <div className="gov-auth-input-wrapper">
                    {inputType === 'phone' ? (
                      <Phone className="gov-auth-input-icon" size={18} aria-hidden="true" focusable="false" />
                    ) : (
                      <Mail className="gov-auth-input-icon" size={18} aria-hidden="true" focusable="false" />
                    )}
                    <input
                      id="reset-input"
                      name="reset-input"
                      type={inputType === 'phone' ? 'tel' : 'email'}
                      inputMode={inputType === 'phone' ? 'numeric' : 'email'}
                      autoComplete={inputType === 'phone' ? 'tel' : 'email'}
                      spellCheck={false}
                      value={input}
                      onChange={(event) => {
                        setInput(event.target.value);
                        if (error) setError('');
                      }}
                      className="gov-auth-input"
                      placeholder={
                        inputType === 'phone'
                          ? copy.placeholderPhone
                          : copy.placeholderEmail
                      }
                      required
                      aria-invalid={!!error}
                      aria-describedby={error ? 'reset-input-error' : undefined}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="gov-auth-primary-btn"
                  disabled={isLoading || !isValid}
                  aria-label={copy.submit}
                  aria-disabled={isLoading || !isValid ? 'true' : 'false'}
                  aria-busy={isLoading ? 'true' : 'false'}
                >
                  {isLoading ? copy.submitting : copy.submit}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setInput('');
                  setSent(false);
                  setError('');
                  setInputType('phone');
                }}
                className="gov-auth-primary-btn mt-2"
              >
                {copy.retry}
              </button>
            )}

            <div className="mt-5 text-center text-sm">
              <Link href="/auth/health/login" className="gov-auth-link inline-flex items-center gap-1">
                <ArrowLeft size={14} />
                {copy.backToLogin}
              </Link>
            </div>

            <div className="gov-auth-secure-note">
              <ShieldCheck size={14} className="text-leaf-700" />
              <span>{copy.secure}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
