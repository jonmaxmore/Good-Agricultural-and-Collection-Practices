# Step 3.1 — Refactor · โค้ดที่เขียนโดยไม่มีแบบ · GACP Lite

**วิธีตรวจ: ไล่กราฟ require จาก `server.js` จริง แล้วยิงทุกข้อสรุปบนระบบที่รันอยู่**
ไม่ได้ grep แล้วเดา — ตัวไล่กราฟรุ่นแรกของผมเองก็ตอบผิด และที่จับได้คือการยิงจริง

---

## สรุป

| # | เรื่อง | ระดับ | สถานะ |
|---|---|---|---|
| REF-01 | mount ชี้ไปหาโมดูลที่ถูกลบ — ผู้ใช้เจอ 500 ไม่ใช่ deploy เจอ | 🟠 HIGH | แก้แล้ว |
| REF-02 | ฟีเจอร์เปลี่ยนผู้ตรวจตายทั้งเส้น — หน้าจอมี ประตูไม่ถูก mount | 🟠 HIGH | แก้แล้ว |
| REF-03 | เส้นทางที่ลงทะเบียนไว้เพื่อบอกว่าตัวเองไม่มี | 🟡 MEDIUM | แก้แล้ว |
| REF-04 | ประตูสิทธิ์ลบข้อมูลตาม PDPA ไม่ถูก mount — ไม่มีที่ไหนในระบบเลย | 🟠 HIGH | **รอคำตัดสิน** |
| REF-05 | การเข้ารหัสฟิลด์ PDPA ไม่เคยถูกเปิดในไฟล์ config ใด | 🟠 HIGH | **รอคำตัดสิน** |
| REF-06 | ไฟล์ route 17 ไฟล์ (3,743 บรรทัด) เข้าไม่ถึงจาก server.js | 🟡 MEDIUM | ยกไป Step 5 |

---

## 🟠 HIGH · REF-01 · โมดูลที่หายไป ไปโผล่เป็น 500 ในหน้าผู้ใช้

`routes/api/provider/index.js` mount router 15 ตัวผ่าน `createLazyRouter` ซึ่ง
`require` ตอนมีคนยิงเข้ามาครั้งแรก · mount ที่ชี้ไปหาโมดูลที่ไม่มีจึงไม่ทำให้ boot ล้ม

**วัดจริงก่อนแก้:**
```
GET /api/provider/planting-cycles  ->  500 {"code":"MODULE_NOT_FOUND"}
GET /api/provider/waiver-reopen    ->  500 {"code":"MODULE_NOT_FOUND"}
```

`./planting` ถูกลบตอนตัด T&T ออกจาก Lite · `./waiver-reopen` ไม่ได้ถูกนำมาด้วยตอน
แยก repo · **ไม่มีอะไรในขั้นตอน deploy จับได้เลย เพราะแอปขึ้นปกติ**

**แก้แล้ว** — `require.resolve` ตอน mount ทำให้ความผิดพลาดชนิดนี้ล้มตั้งแต่ boot
ซึ่งเห็นทันทีตอน deploy · การโหลดจริงยังขี้เกียจเหมือนเดิม ไม่ได้เพิ่มต้นทุน boot ·
mount ที่ตายทั้งสองถูกถอดออก

**หลังแก้:** ทั้งสองพาธตอบ 404 สะอาด ทุกวิธี

## 🟠 HIGH · REF-02 · ฟีเจอร์เปลี่ยนผู้ตรวจ ตายทั้งเส้น

`apps/web-app/src/app/provider/scheduler/reassign/page.tsx` เรียก
```
GET  /audits/reassign/reassignable
POST /audits/reassign/:id/reassign
```
และ `routes/api/audit/audits-reassign.js` (281 บรรทัด) ประกาศเส้นทางทั้งสองไว้ครบ
พร้อมด่าน `authenticateProvider + providerOnly` และ `REASSIGN_ROLES` — **แต่ไม่เคย
ถูก mount ใน `routes/api/index.js`**

**วัดจริงก่อนแก้:** ทั้งสองเส้นทางตอบ 404 · หน้าจอโหลดขึ้นมาแล้วทำอะไรไม่ได้เลย

**แก้แล้ว** — mount ที่ `/audits/reassign` โดยวางไว้ **ก่อน** `/audits` เพราะ
`/audits/:id` จะกลืน `/audits/reassign`

**หลังแก้ · ยิงจริง:**
```
GET  /api/audits/reassign/reassignable  200 {"success":true,"data":{"applications":[]}}
POST /api/audits/reassign/x/reassign    400  (เส้นทางมีอยู่ ตกที่การตรวจข้อมูล)
GET  /api/audits                        200  (ไม่ถูกกลืน)
```

## 🟡 MEDIUM · REF-03 · เส้นทางที่มีไว้เพื่อบอกว่าตัวเองไม่มี

```js
// Legacy provider route removed
router.get('/stats', (req, res) => { res.status(404).json({...}); });
```

เส้นทางแบบนี้ทำให้ตัวแยก 405/404 อ่านว่า "มี GET ลงทะเบียนไว้" · ผลคือ
`DELETE /api/provider/stats` ได้ **405 Allow: GET** แล้ว `GET` ก็ได้ **404** —
คำตอบที่ขัดกันเอง ชนิดเดียวกับ API-01 ของ Step 2.3 คนละสาเหตุ

**แก้แล้ว** — ไม่ลงทะเบียนเลย ตัวจับที่ท้าย `/api` ตอบ 404 ให้ทุกวิธีอย่างสม่ำเสมอ

---

## 🟠 HIGH · REF-04 · ไม่มีประตูใช้สิทธิ์ลบข้อมูลตาม PDPA — **รอคำตัดสิน**

`routes/api/pdpa/erasure.js` (183 บรรทัด) ประกาศไว้ครบ:
```
POST /request      (authenticateHealth)
POST /confirm      (authenticateHealth)
POST /:id/cancel   (authenticateHealth)
GET  ...           (authenticateProvider + requireRole(['admin']))
```
บริการเบื้องหลังก็มีอยู่จริงและใหญ่ — `services/pdpa-erasure-service.js` 1,008 บรรทัด

**วัดจริง:** ทั้ง 4 เส้นทางตอบ 404 · ค้นตารางเส้นทางทั้ง 258 เส้น **ไม่มีประตู PDPA
ที่ไหนเลย** เจ้าของข้อมูลจึงใช้สิทธิ์ขอลบไม่ได้ผ่านระบบ

**ยังไม่แก้ — ต้องให้ operator ตัดสิน** เพราะการเปิดประตูลบข้อมูลคือการเปิดทางให้
ข้อมูลหายจริง · ถ้าอนุมัติ การแก้คือหนึ่งบรรทัดใน `routes/api/index.js`:
```js
router.use('/pdpa/erasure', require('./pdpa/erasure'));
```
แล้วต้องเดินทดสอบจริงว่า flow request → confirm → cancel ทำงานตามที่บริการเขียนไว้
และดูว่า `retainUntil` (SEC-05) กันใบรับรองไว้จริงหรือไม่

## 🟠 HIGH · REF-05 · การเข้ารหัสฟิลด์ PDPA ไม่เคยถูกเปิด — **รอคำตัดสิน**

`services/prisma-pdpa-extension.js` (1,175 บรรทัด) เข้ารหัสคอลัมน์ PII ของ `User`
และเปิดด้วย `ENABLE_PDPA_FIELD_ENCRYPTION=true` เท่านั้น (`:860`) — ค่าอื่นทั้งหมด
คืน client เดิมโดยไม่ทำอะไร

**วัดจริง:** ค้นทุกไฟล์ที่ shipped (`docker-compose.yml`, `.env.example`,
`apps/backend/.env`) — **ไม่มีที่ไหนตั้งสวิตช์นี้เลย** มีแต่ `ENCRYPTION_KEY` ·
คอลัมน์ `phoneNumber` และ `address` จึงเป็นข้อความธรรมดาในทุก deployment ที่สร้างจาก
ไฟล์เหล่านี้

**ยังไม่แก้ — ต้องให้ operator ตัดสิน** การเปิดสวิตช์เปลี่ยนวิธีเขียนและอ่านข้อมูล
แถวที่มีอยู่แล้วเป็น plaintext จะอ่านไม่ออกถ้าเปิดโดยไม่ย้ายข้อมูลก่อน · ลำดับที่ต้อง
ทำคือ ตัดสิน → เขียน migration แปลงแถวเดิม → เปิดสวิตช์ → ยืนยันบน staging
ไม่ใช่เปิดแล้วค่อยดู

---

## 🟡 MEDIUM · REF-06 · ไฟล์ route 17 ไฟล์เข้าไม่ถึงจาก `server.js` — **ยกไป Step 5**

ไล่กราฟ `require` จาก `server.js` (รวมทางที่ `createLazyRouter` โหลดด้วยสตริง ซึ่ง
ตัววิเคราะห์แบบ static มองไม่เห็น): เส้นทาง 125 ไฟล์ · เข้าถึงได้ 108 · **เข้าไม่ถึง 17
(3,743 บรรทัด)**

| บรรทัด | ไฟล์ | ข้อเสนอ |
|---|---|---|
| 603 | `applications/application-bundles.js` | **ถาม** — แตะเรื่องเงิน (ขอหลายใบพร้อมกัน) |
| 428 | `audit/fraud-detection.js` | ถาม |
| 387 | `system/cron.js` | ถาม |
| 349 | `system/analytics.js` | ลบ — ซ้ำกับ `provider/analytics.js` ที่ mount อยู่ |
| 327 | `system/analytics-predictive-performance-routes.js` | ลบ |
| 322 | `documents/reports.js` | ลบ — ซ้ำกับ `provider/reports.js` ที่ mount อยู่ |
| 185 | `system/tickets.js` | ลบ — ระบบ ticket ไม่อยู่ในขอบเขต Lite |
| 183 | `pdpa/erasure.js` | **mount** — ดู REF-04 |
| 123 | `system/subscription-orders.js` | ลบ — subscription ไม่อยู่ในขอบเขต |
| 119 | `applications/wizard.js` | ลบ — ชนกับ `/journey` ที่ mount อยู่ |
| 109 | `system/system.js` | ถาม |
| 102 | `system/provider-cms.js` | ลบ — CMS ไม่อยู่ในขอบเขต |
| 97 | `audit/image-assessment.js` | ลบ — เป็นโมดูลของสัญญาอื่น (C05F680149) |
| 60 | `system/e2e.js` | ลบ — พื้นผิวสำหรับเทสเท่านั้น |
| 38 | `system/subscription.js` | ลบ |
| 30 | `system/sync.js` | ลบ |
| 281 | `audit/audits-reassign.js` | **mount แล้ว** — REF-02 |

**ยกไป Step 5 (Housekeeping) โดยตั้งใจ** · Step นี้แก้เฉพาะสิ่งที่ทำให้ระบบตอบผิด
ตอนนี้ (500, ฟีเจอร์ตาย, คำตอบขัดกันเอง) · การลบ 3,700 บรรทัดคือการตัดสินขอบเขต
ผลิตภัณฑ์ ควรวางรายการทั้งหมดให้ operator เห็นพร้อมกันทีเดียว ไม่ใช่ทยอยลบระหว่างแก้บั๊ก

---

## หมายเหตุเรื่องวิธี — และข้อที่ผมสรุปผิดเอง

ตัวไล่กราฟ require รุ่นแรกของผมรายงานว่าเข้าไม่ถึง 65 ไฟล์ ซึ่งรวม
`provider/document-reviews.js` ที่ผมเพิ่งยิงจริงไปเมื่อชั่วโมงก่อนใน Step 4 ·
ความขัดแย้งนั้นคือสิ่งที่ทำให้ไปหาสาเหตุแทนที่จะเขียนรายงาน แล้วจึงพบว่า
`createLazyRouter('./x')` คือ require ที่เกิดตอนรัน — เครื่องมือ static ทุกตัวมองไม่เห็น
ตัวเลขจริงคือ 17 ไม่ใช่ 65

**และในการอ่าน `server.js` ครั้งเดียวกันนั้น พบว่า SEC-04 ของ Step 4 ผมสรุปผิด** —
CSP ถูกปิดเฉพาะ `NODE_ENV=development` เท่านั้น (`server.js:100,150`) staging และ
production ใช้ CSP มาตรฐานของ helmet อยู่แล้ว · ผมวัด header บนเครื่อง dev แล้วสรุป
เป็นข้อบกพร่องของระบบ · แก้ในรายงาน Step 4 แล้ว
