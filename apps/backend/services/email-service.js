// TRANSITION-ONLY: auth email (MFA-OTP + password-reset) — Phases 3/4 retire
// this file; production auth = ThaiD+หมอพร้อม (operator 2026-08-19).
//
// External-services cleanup Task 3 (2026-08-19, spec: docs/superpowers/specs/
// 2026-08-19-external-services-cleanup-design.md) slimmed this file to ONLY
// the transporter + sendMfaOtp + sendPasswordReset. sendApplicationNotification,
// sendAuditScheduleNotification, sendCertificateIssued,
// sendCertificateExpiryReminder, sendSLABreachNotification, sendInvitationEmail,
// and getStatus were deleted (zero production callers — evidence in
// task-3-report.md). Sends real mail when EMAIL_ENABLED=true and SMTP is
// configured; falls back to mock-mode (logs only) otherwise so the server
// never blocks on a misconfigured mail server. HTML templates carry the DTAM /
// กระทรวงสาธารณสุข branding.

const nodemailer = require('nodemailer');
const logger = require('../shared/logger');

class EmailService {
  constructor() {
    this.isEnabled = process.env.EMAIL_ENABLED === 'true';
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';
    this.from = process.env.EMAIL_FROM || 'noreply@gacpth.com';
    this.transporter = null;

    if (this.isEnabled) {
      this._initializeTransporter();
    }
  }

  /**
   * Initialize nodemailer transporter
   * @private
   */
  _initializeTransporter() {
    try {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!host) {
        logger.warn('[EmailService] SMTP_HOST not configured. Email sending will be mocked.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: (user && pass) ? { user, pass } : undefined,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10, // max 10 messages per second
      });

      // Verify transporter on startup (non-blocking)
      this.transporter.verify()
        .then(() => logger.info('[EmailService] SMTP transporter verified successfully'))
        .catch((err) => {
          logger.warn('[EmailService] SMTP verification failed (will retry on send):', err.message);
        });

    } catch (error) {
      logger.error('[EmailService] Failed to initialize transporter:', error.message);
      this.transporter = null;
    }
  }

  /**
   * Wrap content in government-branded HTML template
   * @private
   */
  _wrapTemplate(bodyHtml) {
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; }
    .header { background: #1e3a5f; padding: 24px 32px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 20px; margin: 0; }
    .header p { color: #94b8d4; font-size: 13px; margin: 4px 0 0; }
    .body { padding: 32px; color: #333333; line-height: 1.8; font-size: 15px; }
    .body h2 { color: #1e3a5f; font-size: 18px; margin: 0 0 16px; }
    .body ul { padding-left: 20px; }
    .body li { margin-bottom: 6px; }
    .body a { color: #1e3a5f; text-decoration: underline; }
    .footer { background: #f5f5f5; padding: 16px 32px; text-align: center; font-size: 12px; color: #888888; }
    .btn { display: inline-block; padding: 12px 32px; background: #1e3a5f; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GACP Thailand</h1>
      <p>ระบบรับรองมาตรฐาน GACP สมุนไพร</p>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>&copy; 2026 ระบบรับรองมาตรฐาน GACP สมุนไพร GACP Thai Platform</p>
      <p>อีเมลนี้ถูกส่งโดยอัตโนมัติจากระบบ GACP Thai โปรดอย่าตอบกลับ</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Mask a recipient address for logging — PDPA: the email is PII and the
   * winston transport has no redaction layer, so the raw address must never
   * reach the logs (incl. the MFA-OTP send path). e.g. `al***@example.com`.
   */
  _maskEmail(to) {
    if (typeof to !== 'string' || !to.includes('@')) { return '[recipient]'; }
    // Split at the LAST '@' so a multi-@ input keeps the real domain.
    const at = to.lastIndexOf('@');
    const local = to.slice(0, at);
    const domain = to.slice(at + 1);
    // Never reveal the whole local part: 3+ chars show the first 2, 2 chars show
    // the first 1, 0-1 chars show none. Always at least one mask char.
    const head = local.length >= 3 ? local.slice(0, 2) : (local.length === 2 ? local.slice(0, 1) : '');
    const maskLen = Math.max(1, local.length - head.length);
    return `${head}${'*'.repeat(maskLen)}@${domain}`;
  }

  /**
   * ส่งอีเมล
   * @param {Object} options - ตัวเลือกการส่งอีเมล
   * @returns {Promise<Object>} ผลการส่งอีเมล
   */
  async sendEmail(options) {
    const { to, subject, html, text, attachments = [] } = options;

    if (!this.isEnabled) {
      logger.info(`[EmailService] Email disabled. Would send to: ${this._maskEmail(to)}, subject: ${subject}`);
      return { success: true, messageId: 'mock-disabled', mocked: true };
    }

    if (!this.transporter) {
      logger.warn(`[EmailService] No SMTP transporter configured. Mocking email to: ${this._maskEmail(to)}, subject: ${subject}`);
      return { success: true, messageId: 'mock-no-transporter', mocked: true };
    }

    try {
      const wrappedHtml = html ? this._wrapTemplate(html) : undefined;

      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html: wrappedHtml,
        text: text || undefined,
        attachments,
      });

      logger.info(`[EmailService] Email sent successfully to: ${this._maskEmail(to)}, messageId: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        to,
        subject,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[EmailService] Failed to send email to ${this._maskEmail(to)}:`, error.message);

      // Don't throw — callers should handle gracefully
      return {
        success: false,
        error: error.message,
        to,
        subject,
      };
    }
  }

  /**
   * ส่งอีเมลรีเซ็ตรหัสผ่าน
   * @param {string} to - อีเมลผู้รับ
   * @param {string} resetToken - Token สำหรับรีเซ็ตรหัสผ่าน
   */
  async sendPasswordReset(to, resetToken) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const subject = `รีเซ็ตรหัสผ่านระบบ GACP Thai`;
    const html = `
      <h2>รีเซ็ตรหัสผ่าน</h2>
      <p>มีการร้องขอรีเซ็ตรหัสผ่านสำหรับบัญชีของท่าน</p>
      <p>คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" class="btn">ตั้งรหัสผ่านใหม่</a>
      </p>
      <p style="font-size: 13px; color: #666;">
        หากท่านไม่ได้ร้องขอ กรุณาเพิกเฉยอีเมลนี้<br>
        ลิงก์จะหมดอายุภายใน 1 ชั่วโมง
      </p>
    `;

    return this.sendEmail({ to, subject, html });
  }

  /**
   * ส่งรหัส OTP สำหรับยืนยันการเข้าสู่ระบบ (email-OTP 2FA).
   * Returns the sendEmail result — callers MUST inspect `.mocked` (true when
   * EMAIL_ENABLED!=='true' / no SMTP), because a mocked send means the user
   * never received a code and must not be left waiting at the OTP screen.
   * @param {string} to    recipient email (the account's on-file address)
   * @param {string} code  6-digit OTP (already generated by email-otp-service)
   */
  async sendMfaOtp(to, code) {
    const subject = `รหัสยืนยันการเข้าสู่ระบบ GACP`;
    const html = `
      <h2>รหัสยืนยันการเข้าสู่ระบบ</h2>
      <p>รหัสยืนยัน (OTP) สำหรับเข้าสู่ระบบ GACP ของท่านคือ:</p>
      <p style="text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${code}</p>
      <p style="font-size: 13px; color: #666;">
        รหัสนี้หมดอายุภายใน 5 นาที<br>
        หากท่านไม่ได้พยายามเข้าสู่ระบบ กรุณาเพิกเฉยอีเมลนี้และพิจารณาเปลี่ยนรหัสผ่าน
      </p>
    `;
    const text = `รหัส OTP เข้าสู่ระบบ GACP ของท่านคือ ${code} (หมดอายุใน 5 นาที)`;
    return this.sendEmail({ to, subject, html, text });
  }
}

// Export singleton instance
module.exports = new EmailService();
module.exports.EmailService = EmailService;
