import { ORGANIZATION } from '@/lib/organization-identity';

export const thFooter = {
footer: {
        landmarkLabel: "ข้อมูลกระทรวงและลิงก์ส่วนล่าง",
        addressLabel: "ที่อยู่:",
        phonePrefix: "โทร",
        phoneAria: "โทรศัพท์ {phone}",
        emailAria: "ส่งอีเมลถึง {email}",

        linksLandmarkLabel: "ลิงก์ส่วนล่าง",
        linksHeading: "เกี่ยวกับและความช่วยเหลือ",
        links: {
            about: "เกี่ยวกับ GACP",
            accessibility: "นโยบายการเข้าถึงเว็บไซต์",
            privacy: "นโยบายความเป็นส่วนตัว",
            terms: "ข้อกำหนดการใช้งาน",
            sitemap: "แผนผังเว็บไซต์",
            help: "วิธีใช้งานระบบ",
        },

        systemHeading: "ระบบและเวอร์ชัน",
        lastUpdated: "ปรับปรุงล่าสุด",
        buildDateFallback: "ไม่ทราบรุ่นบิลด์",
        version: "เวอร์ชัน",
        ministrySite: "เว็บไซต์กรม",
        ministrySiteAria: `เว็บไซต์${ORGANIZATION.name} ${ORGANIZATION.website.replace(/^https?:\/\//, '')} (เปิดในแท็บใหม่)`,

        endorsedBy: "ระบบนี้รับรองโดย{ministry}",
        freeToUse: "เป็นเว็บไซต์ของรัฐบาลไทย ใช้งานฟรี ไม่มีค่าใช้จ่ายแอบแฝง",

        rightsReserved: "สงวนลิขสิทธิ์",
        accessibilityProblem: "หากพบปัญหาในการเข้าถึงเว็บไซต์ โปรดติดต่อ",
        accessibilityProblemAria: "แจ้งปัญหาการเข้าถึงผ่านอีเมล {email}",
    },
};
