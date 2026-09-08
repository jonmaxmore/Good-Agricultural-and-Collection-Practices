# Step 2.1 — Anti-Hardcode Audit · GACP Lite

สแกน 981 ไฟล์ (`apps/backend`, `apps/web-app/src`, `packages` — ข้ามคอมเมนต์และเทส)
ผลดิบ: `scan-after.txt` · สคริปต์: ไล่ตามหมวดที่โจทย์กำหนด 3 หมวด

---

## 1. Hardcode Audit Summary & Risk Assessment

**ความเสี่ยงสูงสุดของ GACP Lite ไม่ใช่ความลับรั่ว — มันคือ "ตัวตนของคนอื่น"**

ระบบนี้ถูกส่งให้ลูกค้าเอาไปติดตั้งบนโดเมนของตัวเอง แต่ชื่อกรมการแพทย์แผนไทยฯ
เบอร์ `0-2591-7007` อีเมล `contact@gacpth.com` และโดเมน `gacpth.com` ถูกพิมพ์ไว้ในโค้ด
**77 จุด** · ผลคือระบบของลูกค้าพิมพ์ข้อมูลติดต่อของหน่วยงานอื่นลงบน:

- ใบรับรองและเอกสาร PDF ทุกใบ (ผ่าน `MINISTRY_CONTACT_LINE`)
- ท้ายทุกหน้าจอ · หน้าติดต่อ · หน้าช่วยเหลือ
- อีเมลแจ้งเตือนที่ส่งถึงเกษตรกร
- canonical URL / OpenGraph / sitemap / robots.txt

และ CORS ในโหมด production ไว้ใจ `gacpth.com` โดยปริยาย ขณะที่โดเมนของลูกค้าเองถูก
ปฏิเสธจนกว่าจะไปตั้ง env — ผิดทั้งสองทาง

| หมวด | พบ | ประเมิน |
|---|---|---|
| ความลับ / ข้อมูลรับรอง | 0 ที่เป็นของจริง | ✅ ผ่าน |
| ตัวตน/ที่อยู่ของหน่วยงาน | 77 | 🔴 แก้แล้วที่ชั้นกลาง |
| URL ภายในคอนเทนเนอร์ | 1 | 🟠 แก้แล้ว |
| ตัวเลขธุรกิจ (ค่าธรรมเนียม) | 0 นอก config | ✅ ผ่าน |

### ✅ ตรวจแล้วถูกต้อง — ไม่ต้องแก้

**JWT secret ที่พิมพ์ไว้ใน `middleware/auth-middleware.js:54-55`**
ใช้ได้เฉพาะ `NODE_ENV=test` เท่านั้น · พิสูจน์ด้วยการรันจริงในโหมด production
โดยไม่มี env:
```
CRITICAL: HEALTH_JWT_SECRET (or HEALTH_JWT_SECRET / JWT_SECRET) is required in production.
```
ระบบปฏิเสธที่จะบูต ซึ่งเป็นพฤติกรรมที่ถูก

**ค่าธรรมเนียม** อยู่ใน `config/business-rules.js` และอ่านทับได้ผ่านตาราง `SystemConfig`
ไม่มีราคาใดถูกพิมพ์ในเส้นทาง API — ตรงกับกติกา "ราคาต้องเป็นข้อมูลที่มีวันที่ ไม่ใช่ค่าคงที่"

**`config/public-urls.js`** มี `gacpth.com` เป็น fallback แต่มีคอมเมนต์ระบุชัดว่าใช้ได้
เฉพาะนอก production และ production บังคับให้ตั้ง env — ออกแบบถูกแล้ว

---

## 2. Inventory of Found Hardcodes

| File | Value | Category | สถานะ |
|---|---|---|---|
| `backend/shared/ministry-contact.js` | `0-2591-7007`, `contact@gacpth.com`, ชื่อ+ที่อยู่กรมฯ | Identity | ✅ อ่านจาก env แล้ว |
| `web-app/src/lib/ministry-contact.ts` | เหมือนกัน (สำเนาฝั่งหน้าจอ) | Identity | ✅ อ่านจาก env แล้ว |
| `backend/server.js:155-160` | `https://gacpth.com` ×3 ใน CORS production default | Config | ✅ เอาออกแล้ว |
| `web-app/src/config/server.config.ts:28` | `http://backend:8000` | Infra | ✅ แก้เป็น `api:8000` |
| `web-app/src/app/help/contact/*` | เบอร์/อีเมล/ที่อยู่ พิมพ์เอง ~10 จุด | Identity | 🟡 ยังไม่แก้ |
| `web-app/src/app/(marketing)/*` | `gacpth.com` ใน metadata 5 หน้า | Identity | 🟡 ยังไม่แก้ |
| `web-app/src/lib/i18n/dictionaries/*` | ชื่อกรมฯ ในสตริงแปล | Identity | 🟡 ยังไม่แก้ |
| `backend/services/storage-service.js:24` | `http://minio:9000` | Infra | 🟡 Lite ไม่มี minio ใน compose |
| `backend/services/crypto/timestamp-providers.js` | freetsa / digicert / globalsign | External | 🟡 บริการภายนอก ตั้งใจให้เป็นรายการคงที่ |
| `backend/constants/document-slots.js:63` | `herbctrl.dtam.moph.go.th` | External | 🟡 ลิงก์ระบบราชการจริง |

---

## 3. Refactoring Plan

### 3.1 `.env.example` — schema ที่เพิ่ม

```bash
# ตัวตนของหน่วยงานที่ติดตั้งระบบนี้
# ไม่ตั้ง = ระบบพิมพ์ชื่อ/เบอร์/อีเมลของกรมฯ ต้นทางลงบนเอกสารและทุกหน้าจอ
ORG_NAME=
ORG_NAME_EN=
ORG_PHONE=
ORG_EMAIL=
ORG_ADDRESS=
ORG_WEBSITE=

# ค่าเดียวกันสำหรับหน้าจอ — Next อ่านตอน build จึงต้องส่งเป็น build arg ด้วย
NEXT_PUBLIC_ORG_NAME=
NEXT_PUBLIC_ORG_NAME_EN=
NEXT_PUBLIC_ORG_PHONE=
NEXT_PUBLIC_ORG_EMAIL=
NEXT_PUBLIC_ORG_ADDRESS=
NEXT_PUBLIC_ORG_WEBSITE=
```

`docker-compose.yml` ส่งค่าเหล่านี้ให้ทั้ง `api` (environment) และ `web` (build args)
และ `apps/web-app/Dockerfile` รับเป็น `ARG`+`ENV` แล้ว เพราะ Next ฝังค่าลงบันเดิลตอน build

### 3.2 Centralized Config Module

**ใหม่** `apps/backend/shared/organization-identity.js`
— อ่าน `ORG_*` จาก env, มีค่าเริ่มต้นเป็นของกรมฯ, และ `unconfiguredKeys()` บอกว่า
ลูกค้ายังไม่ได้ตั้งอะไรบ้าง (ไม่ throw — การพิมพ์ชื่อผิดบนเอกสารเป็นเรื่องที่ต้องรู้
ไม่ใช่เรื่องที่ควรทำให้ระบบบูตไม่ขึ้น)

**ใหม่** `apps/web-app/src/lib/organization-identity.ts` — คู่แฝดฝั่งหน้าจอ ใช้ `NEXT_PUBLIC_*`

### 3.3 Refactored Snippets

`shared/ministry-contact.js` — ชื่อเดิมคงไว้เพราะ PDF เรียกใช้ แต่ค่าไม่พิมพ์แล้ว:
```js
const { ORGANIZATION } = require('./organization-identity');
const MINISTRY_CONTACT = Object.freeze({
    phone: ORGANIZATION.phone,
    email: ORGANIZATION.email,
    ministry: ORGANIZATION.name,
    // …
});
```

`server.js` — CORS ไม่มีโดเมนเริ่มต้นในโหมด production:
```js
// ไม่ตั้ง CORS_ORIGINS / PUBLIC_WEB_URL = รายการว่าง = ปฏิเสธทุกที่มา
// ซึ่งเป็นความล้มเหลวที่ดังและถูกต้อง ดีกว่าเงียบแล้วเปิดให้โดเมนของคนอื่น
const productionDefaultOrigins = [];
```

### 3.4 พิสูจน์แล้ว

```
backend:  ORG_PHONE=053-999888 → โทร: 053-999888 | อีเมล: contact@gacpth.com
frontend: NEXT_PUBLIC_ORG_NAME=สำนักงานเกษตรจังหวัดเชียงใหม่ → แสดงชื่อนั้นจริง
CORS:     production ไม่มี env → (ว่าง) · ตั้ง PUBLIC_WEB_URL → รับโดเมนนั้น
```

เครื่องเฝ้า: `web-app/src/lib/__tests__/no-foreign-identity-hardcoded.test.ts`
พิสูจน์ด้วยการกลายพันธุ์ — ใส่เบอร์กลับเข้าไปในโมดูลกลาง เทสแดงทันที

---

## 4. สิ่งที่แผนนี้ยังไม่แก้ (พูดตรง ๆ)

**~60 จุดที่เหลือเป็นข้อความในหน้าจอ marketing/help/i18n** ที่พิมพ์ชื่อและเบอร์เอง
ไม่ได้อ่านผ่านโมดูลกลาง · การแก้ต้องแตะไฟล์แปลภาษาซึ่งกระทบทั้งสองภาษา และหน้า
marketing ที่ลูกค้าอาจอยากเขียนใหม่ทั้งหน้าอยู่แล้ว — ควรตัดสินใจว่าจะเก็บหน้าเหล่านั้น
ไว้ไหมก่อน (เป็นหัวข้อของ Step 5 Housekeeping)

**`http://minio:9000`** — Lite ไม่มี minio ใน compose · ถ้าไม่ตั้ง `STORAGE_*`
การอัปโหลดจะพยายามต่อไปยังโฮสต์ที่ไม่มีอยู่ · ต้องตัดสินใจว่า Lite เก็บไฟล์ที่ดิสก์
(เหมือนที่ compose ผูก volume ไว้แล้ว) หรือจะรองรับ object storage เป็นทางเลือก
