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


---

# รอบที่ 2 — คืนตำแหน่ง "คนจัดคิว" และ "บัญชี" (2026-09-08)

operator ทักว่าตารางตำแหน่งงานขาดสองตำแหน่ง · ถูกต้อง — ผมยุบมันทิ้งเอง ทั้งที่คำสั่ง
เดิมบอกแค่ให้แยกคนตรวจเอกสารกับคนตรวจแปลง

## สิ่งที่พบตอนไล่ตรวจ (ทุกข้อวัดด้วยการรัน ไม่ใช่การอ่าน)

| # | สิ่งที่พบ | ความรุนแรง |
|---|---|---|
| 1 | **บัญชีผู้ดูแลที่ seed สร้าง ล็อกอินไม่ได้** — seed ไม่เขียน `providerIdHash` (คอลัมน์ที่ประตูล็อกอินค้นจริง) และ `accountType` · ลูกค้าติดตั้งตามคู่มือแล้วเข้าระบบไม่ได้เลย | ติดตั้งแล้วใช้ไม่ได้ |
| 2 | **landing ของคนจัดคิวชี้ไป `/provider/coordinator` ที่ถูกลบ** — ล็อกอินแล้วเจอ 404 · `platform_admin` ก็ชี้ไป `/admin/organizations` ที่ถูกลบเช่นกัน | เข้าระบบแล้วตัน |
| 3 | **หน้าจอผู้ดูแลยังเสนอตำแหน่ง `account_dtam` / `account_platform` ที่ไม่มีแล้ว** — เลือกแล้วได้บัญชีที่ `normalizeRole()` แปลไม่ออก สร้างสำเร็จแต่ล็อกอินไม่ได้ | สร้างบัญชีตายเงียบ |
| 4 | `seed-all.js` เรียก seed สองตัวที่ถูกลบ — `pnpm db:seed` พังทันที | คำสั่งในคู่มือพัง |
| 5 | `jest.config.cjs` ชี้ `jest.globalsetup.js` ที่ถูกลบ — `pnpm test` รันไม่ได้ | เทสรันไม่ได้ |
| 6 | ผู้ดูแลกรองหาเจ้าหน้าที่บัญชีไม่เจอ (`ROLE_FILTERABLE` ขาด `account`) | สร้างแล้วหาไม่เจอ |
| 7 | รหัสข้อผิดพลาด 182 ตัวจาก 386 อธิบายเส้นทางที่ไม่มีในระบบนี้ | เอกสารหลอก |

## `coordinator` ไม่เคยเป็นตำแหน่ง

ตรวจในคลังชื่อทั้งสองฝั่ง (`shared/canonical-rbac.js`, `constants/canonical-roles.ts`)
— ไม่มี · มันเป็นชื่อ**หน้าจอ** และคอมเมนต์ในระบบเต็มเองเขียนว่าเป็น *"legacy dead
nav key"* ที่เก็บไว้เพราะเทสตรึงไว้ · ตำแหน่งคือ `scheduler` มาตลอด

## คลังชื่อหลังล้าง — สองฝั่งตรงกันเป๊ะ

```
backend : account admin auditor document_reviewer health platform_admin scheduler system
frontend: account admin auditor document_reviewer health platform_admin scheduler system
```

ชื่อสำรองที่แปลตำแหน่งหนึ่งไปเป็นอีกตำแหน่ง (`head_auditor`→auditor,
`reviewer_auditor`→document_reviewer, `finance_dtam`→account_dtam ฯลฯ) ถูกลบทั้งหมด
— มันมีไว้รับค่าเก่าในฐานข้อมูลของระบบเต็ม ซึ่ง Lite ไม่มี

## แบ่งหน้าที่แล้วเดินจริง

```
บัญชียืนยันค่าตรวจเอกสาร   PENDING_DOC_FEE  -> DOC_FEE_PAID     ✓
คนจัดคิวรับช่วงต่อ          DOC_FEE_PAID     -> ASSIGNED_FOR_REVIEW (เฉพาะ scheduler)
บัญชียืนยันค่าตรวจแปลง     PENDING_AUDIT_FEE -> AUDIT_FEE_PAID   ✓
คนจัดคิวรับช่วงต่อ          AUDIT_FEE_PAID   -> AUDIT_CONFIRMED  (เฉพาะ scheduler)
```

ปฏิเสธถูกต้องทุกกรณี: ผู้ตรวจเอกสาร/คนจัดคิวยืนยันเงินไม่ได้ (`FEE_CONFIRM_FORBIDDEN`)
บัญชีตัดสินผลตรวจไม่ได้ · ผู้ดูแลเดินไม่ได้สักขั้น (แบ่งแยกหน้าที่ ไม่ใช่บั๊ก)

## เครื่องเฝ้าที่เพิ่ม ไม่ให้สับสนซ้ำ

| เทส | กันอะไร | พิสูจน์ด้วยการกลายพันธุ์ |
|---|---|---|
| `web-app/src/lib/__tests__/landing-page-must-exist.test.ts` | landing ชี้ไปหน้าที่ไม่มีอยู่จริง (อ่านระบบไฟล์ ไม่ใช่กติกาสิทธิ์) | ชี้กลับไป `/provider/coordinator` → แดง |
| `web-app/src/lib/__tests__/role-vocabulary-is-one-list.test.ts` | ตัวเลือกในหน้าจอเป็นตำแหน่งที่ไม่มีจริง · ชื่อสำรองที่แปลข้ามตำแหน่ง | — |
| `backend/__tests__/unit/role-vocabulary-is-one-list.test.js` | **ทุก edge ในเส้นทางต้องมีเจ้าของ** (จับกรณียุบตำแหน่งแล้วเกิดทางตัน) + แบ่งแยกหน้าที่ | — |
| `backend/prisma/seed-lite.js` `verifyCanLogIn()` | seed สร้างบัญชีที่ล็อกอินไม่ได้ | — |

ผลรัน: backend 33/33 · frontend 18/18 + 7/7 · `tsc --noEmit` 0 error ·
`next build` ผ่าน 121 หน้า
