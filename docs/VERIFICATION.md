# ผลตรวจสอบที่รันจริง — GACP Lite

ทุกบรรทัดในเอกสารนี้คือผลจากการรันจริงบนเครื่อง ไม่ใช่การประเมิน
วันที่ 2026-09-08 · ฐานข้อมูล Postgres 17 ในคอนเทนเนอร์ชั่วคราว

## 1. สคีมา

```
$ npx prisma validate --schema prisma/schema
The schemas at prisma/schema are valid 🚀

$ npx prisma migrate deploy --schema prisma/schema
All migrations have been successfully applied.

ตารางที่เกิดขึ้นจริง: 51 (50 model + _prisma_migrations)
```

ระบบเต็มมี 33 ไฟล์สคีมา / 110 model · Lite เหลือ 24 ไฟล์ / 50 model

**ข้อผิดพลาดที่จับได้เพราะรันจริง**: ครั้งแรกประกาศ `FeePayment.applicationId` เป็น
`@db.Uuid` · `prisma validate` ผ่าน แต่ Postgres ปฏิเสธตอนสร้าง FK เพราะ
`Application.id` เป็น `text` — ตัวตรวจสคีมาไม่ได้เทียบชนิดข้ามตาราง

## 2. โค้ดฝั่ง backend

```
ไฟล์ .js (ไม่รวมเทส):    697 → 437
require ที่ชี้ไฟล์ที่ไม่มี:  0
node --check ทุกไฟล์:      ผ่านทั้งหมด
routes/api ทั้งต้น:        โหลดได้จริงในหน่วยความจำ
```

## 3. เส้นทางที่ตัดออกแล้วตายจริง

รันกับ backend ที่บูตจริง — ทุกเส้นทางตอบ 404 JSON (ไม่ใช่หน้า HTML)

| เส้นทาง | ผล |
|---|---|
| `/api/trace/lot/x` | 404 |
| `/api/planting-cycles` | 404 |
| `/api/herbs` | 404 |
| `/api/surveys` | 404 |
| `/api/invoices` | 404 |
| `/api/quotes` | 404 |
| `/api/webhooks/stripe` | 404 |
| `/api/auth/idp/providers` | 404 |

เส้นทางที่เก็บไว้ตอบ 401 (ต้องยืนยันตัวตน) ตามที่ควรเป็น ·
`DELETE /api/version` ตอบ `405` พร้อมหัว `Allow: GET, OPTIONS`

## 4. เส้นทางหลักของผลิตภัณฑ์ — เดินจริงทั้งเส้น

```
สมัครผู้ยื่น            POST /api/auth/applicant/register     → success
ล็อกอิน                POST /api/auth/applicant/login        → ได้ JWT
สร้างคำขอ              POST /api/applications/draft          → APP-2569-MTSKYYON-9F43CD
ผู้ยื่นดูค่าธรรมเนียม     GET  /api/fees/:id                    → 5,885 / 29,425 บาท
ล็อกอินเจ้าหน้าที่        POST /api/auth/officer/login          → ได้ JWT
ยืนยันรับค่าตรวจเอกสาร   POST /api/fees/:id/PHASE_1/confirm    → PENDING_DOC_FEE → DOC_FEE_PAID
```

แถวที่บันทึกไว้:
```json
{ "phase": "PHASE_1", "amountThb": 5885,
  "externalReference": "RCPT-2569-0001", "note": "รับโอนเข้าบัญชีหน่วยงาน",
  "confirmedById": "201b97db-…", "confirmedAt": "2026-09-08T11:25:46Z" }
```

## 5. ด่านกันพลาด — ทดสอบทีละข้อ

| ทดสอบ | ผลที่ได้ |
|---|---|
| กดยืนยันงวดเดิมซ้ำ | `FEE_NOT_DUE` — สถานะเดินไปแล้ว ไม่เดินซ้ำ |
| ผู้ตรวจเอกสารยืนยันค่าตรวจ**แปลง** | `FEE_CONFIRM_FORBIDDEN` — คนละครึ่งของเส้นทาง |
| ผู้ยื่นดูใบของตัวเอง | เห็นชื่อเจ้าหน้าที่ผู้ยืนยันและเลขอ้างอิง |
| เรียกโดยไม่มีโทเคน | 401 |

## 6. หน้าจอ

```
$ npx tsc --noEmit
0 errors

$ npx next build
(ผลอยู่ใน docs/VERIFICATION-BUILD.txt)
```

## 7. สิ่งที่ยังไม่ได้พิสูจน์

- ยังไม่ได้เดินเส้นทางเต็มผ่านหน้าจอจริง (ยื่นคำขอครบ 6 ขั้น → ตรวจเอกสาร →
  ตรวจแปลง → ออกใบรับรอง) · ที่พิสูจน์แล้วคือเส้นทาง API และประตูค่าธรรมเนียม
- ยังไม่ได้ build image ด้วย docker compose จริง (ตรวจแล้วแค่ `docker compose config`)
- ยังไม่มีชุดทดสอบอัตโนมัติของ Lite เอง — เทสของระบบเต็มไม่ได้ถูกยกมา
