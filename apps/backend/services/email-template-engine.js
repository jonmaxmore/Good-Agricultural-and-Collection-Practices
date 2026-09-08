/**
 * Email Template Engine
 * จัดการเทมเพลตอีเมลในระบบ GACP Thai
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../shared/logger');

class EmailTemplateEngine {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'email-templates');
    this.cache = new Map();
  }

  /**
   * โหลดเทมเพลตจากไฟล์
   * @param {string} templateName - ชื่อเทมเพลต
   * @returns {Promise<string>} เนื้อหาเทมเพลต
   */
  async loadTemplate(templateName) {
    // Check cache first
    if (this.cache.has(templateName)) {
      return this.cache.get(templateName);
    }

    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.html`);
      const content = await fs.readFile(templatePath, 'utf-8');
      
      // Cache the template
      this.cache.set(templateName, content);
      return content;
    } catch (_error) {
      logger.warn(`[EmailTemplateEngine] Template not found: ${templateName}, using default`);
      return this.getDefaultTemplate(templateName);
    }
  }

  /**
   * สร้างเทมเพลตเริ่มต้น
   * @param {string} templateName - ชื่อเทมเพลต
   * @returns {string} เทมเพลตเริ่มต้น
   */
  getDefaultTemplate(templateName) {
    const templates = {
      'application-confirmation': `
        <h2>ยืนยันการสมัครใบรับรอง GACP</h2>
        <p>เรียน {{applicantName}},</p>
        <p>ใบสมัครของท่านได้รับการยืนยันแล้ว</p>
        <p>เลขที่ใบสมัคร: {{applicationNumber}}</p>
      `,
      'audit-scheduled': `
        <h2>นัดหมายตรวจสอบฟาร์ม</h2>
        <p>เรียน {{applicantName}},</p>
        <p>มีการนัดหมายตรวจสอบฟาร์ม:</p>
        <p>วันที่: {{scheduledDate}}</p>
        <p>เจ้าหน้าที่: {{auditorName}}</p>
      `,
      'certificate-issued': `
        <h2>ใบรับรอง GACP ออกแล้ว</h2>
        <p>ขอแสดงความยินดี!</p>
        <p>เลขที่ใบรับรอง: {{certificateNumber}}</p>
        <p>วันหมดอายุ: {{expiryDate}}</p>
      `,
      'password-reset': `
        <h2>รีเซ็ตรหัสผ่าน</h2>
        <p>คลิกลิงก์เพื่อรีเซ็ตรหัสผ่าน:</p>
        <a href="{{resetUrl}}">รีเซ็ตรหัสผ่าน</a>
      `,
      'default': `
        <h2>{{subject}}</h2>
        <p>{{message}}</p>
      `,
    };

    return templates[templateName] || templates['default'];
  }

  /**
   * แทนที่ตัวแปรในเทมเพลต
   * @param {string} template - เทมเพลต HTML
   * @param {Object} variables - ตัวแปรสำหรับแทนที่
   * @returns {string} เทมเพลตที่แทนที่แล้ว
   */
  render(template, variables = {}) {
    let rendered = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, this.escapeHtml(value));
    }

    return rendered;
  }

  /**
   * สร้างอีเมลฉบับสมบูรณ์
   * @param {string} templateName - ชื่อเทมเพลต
   * @param {Object} variables - ตัวแปรสำหรับแทนที่
   * @returns {Promise<string>} เนื้อหาอีเมล HTML
   */
  async renderTemplate(templateName, variables = {}) {
    const template = await this.loadTemplate(templateName);
    const content = this.render(template, variables);
    
    return this.wrapWithLayout(content, variables);
  }

  /**
   * ห่อหุ้มเนื้อหาด้วย layout หลัก
   * @param {string} content - เนื้อหา
   * @param {Object} options - ตัวเลือก
   * @returns {string} HTML สมบูรณ์
   */
  wrapWithLayout(content, options = {}) {
    const { title = 'GACP Thai Platform', preheader = '' } = options;
    
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Sarabun', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3F51B5; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; }
    .footer { background: #eee; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ระบบรับรองมาตรฐาน GACP สมุนไพร</h1>
      <p>ระบบรับรอง GACP</p>
    </div>
    <div class="content">
      ${preheader ? `<p class="preheader">${preheader}</p>` : ''}
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear() + 543} ระบบรับรองมาตรฐาน GACP สมุนไพร</p>
      <p>GACP Thai Platform</p>
      <p>หากมีคำถาม กรุณาติดต่อ: support@gacpth.com</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Escape HTML เพื่อป้องกัน XSS
   * @param {string} text - ข้อความที่ต้องการ escape
   * @returns {string} ข้อความที่ escape แล้ว
   */
  escapeHtml(text) {
    if (typeof text !== 'string') {return text;}
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * เคลียร์แคชเทมเพลต
   */
  clearCache() {
    this.cache.clear();
    logger.info('[EmailTemplateEngine] Template cache cleared');
  }

  /**
   * ดึงรายชื่อเทมเพลตที่มีอยู่
   * @returns {string[]} รายชื่อเทมเพลต
   */
  async getAvailableTemplates() {
    try {
      const files = await fs.readdir(this.templatesDir);
      return files
        .filter(f => f.endsWith('.html'))
        .map(f => f.replace('.html', ''));
    } catch (_error) {
      return Object.keys(this.getDefaultTemplates());
    }
  }

  /**
   * ดึงเทมเพลตเริ่มต้นทั้งหมด
   * @returns {Object} เทมเพลตเริ่มต้น
   */
  getDefaultTemplates() {
    return {
      'application-confirmation': this.getDefaultTemplate('application-confirmation'),
      'audit-scheduled': this.getDefaultTemplate('audit-scheduled'),
      'certificate-issued': this.getDefaultTemplate('certificate-issued'),
      'password-reset': this.getDefaultTemplate('password-reset'),
    };
  }
}

// Export singleton instance
module.exports = new EmailTemplateEngine();
module.exports.EmailTemplateEngine = EmailTemplateEngine;
