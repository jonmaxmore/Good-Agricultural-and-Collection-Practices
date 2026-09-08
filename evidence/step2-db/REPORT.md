# Step 2.2 — Database Audit · GACP Lite

ตรวจจากฐานข้อมูลจริงที่ migrate ครบแล้ว (Postgres 17) ไม่ใช่จากไฟล์สคีมา
ทุกข้อสรุปมาจากการ query ระบบจริงหรือการเขียนข้อมูลทดสอบเข้าไปแล้วดูว่าเกิดอะไรขึ้น

---

## 1. Database Health Score & Executive Summary

**7.5 / 10** — โครงสร้างแข็งแรงเกินคาด แต่มีรูที่ร้ายแรงหนึ่งรูซึ่งเป็นของที่ผมทำเอง

สคีมาสืบทอดวินัยจากระบบเต็มมาครบ: FK ทุกตัวมี index, timestamp ครบทุกตาราง,
soft-delete มี index รองรับ, เงินเป็น integer ไม่มี float, และคำขอไม่มี N+1

สิ่งที่พังคือ **ฐานข้อมูลไม่คุมคำเลย** — CHECK constraint ศูนย์ตัวทั้งสคีมา ผลคือ
คำศัพท์ปิดทั้งหมด (สถานะคำขอ งวดค่าธรรมเนียม) มีชีวิตอยู่แค่ในจาวาสคริปต์
SQL ตรง ๆ เขียนอะไรลงไปก็ได้ · และ `fee_payments` ซึ่งเป็นแถวเดียวที่บอกว่า
"ใครยืนยันว่าเงินเข้าแล้ว" ตั้ง ON DELETE CASCADE ไว้ ทั้งที่ docblock ของตัวมันเอง
เขียนว่า "ไม่มีใครลบได้ (ไม่มี soft delete โดยตั้งใจ)"

| มิติ | ผล |
|---|---|
| FK มี index ครบ | ✅ 96/96 |
| ชนิดข้อมูลเงิน | ✅ integer ทุกคอลัมน์ ไม่มี float |
| timestamp | ✅ createdAt + updatedAt ครบทุกตาราง |
| soft-delete index | ✅ ครบทุกตารางที่มี isDeleted |
| N+1 | ✅ 41 แถว = 4 query = 19 ms |
| **CHECK constraint** | 🔴 **0 ตัว** → แก้แล้วเป็น 4 |
| **หลักฐานการเงิน** | 🔴 **CASCADE** → แก้แล้วเป็น RESTRICT |

---

## 2. Defect & Risk Breakdown

### 🔴 Critical

**DB-01 · ฐานข้อมูลรับค่าที่ไม่มีอยู่จริง**

พิสูจน์ด้วยการเขียนจริงลงฐานข้อมูลที่ migrate ครบแล้ว:

```
UPDATE applications SET status='ไม่มีสถานะนี้อยู่จริง'                 -> UPDATE 1
INSERT INTO fee_payments (phase,"amountThb") VALUES ('PHASE_999',-1)  -> INSERT 1
```

ตัวที่สองร้ายกว่า: **ค่าธรรมเนียม -1 บาท** บนตารางที่ทั้งระบบใช้เป็นหลักฐานว่าเงินเข้าแล้ว
สคริปต์ซ่อมข้อมูล migration หรือ DBA ที่แก้อะไรตอนตีสอง เขียนค่าแบบนี้ลงไปได้เงียบ ๆ
แล้วแอปจะตีความไม่ออกตอนอ่านกลับ

คอมเมนต์ใน `prisma/schema/fee.prisma` เขียนไว้เองว่า *"CHECK constraint ใน migration
เป็นตัวคุมคำ"* — คำสัญญาที่ไม่เคยถูกเขียน

**DB-02 · หลักฐานการรับเงินหายไปพร้อมคำขอ**

`fee_payments.applicationId` เป็น `ON DELETE CASCADE` · ลบคำขอหนึ่งใบ = ลบบันทึกว่า
ใครบอกว่าเงินเข้าแล้วไปด้วย โดยไม่มีอะไรเตือน · ขัดกับ docblock ของตารางเอง และขัดกับ
เจตนาของทั้งระบบที่ `applications` มี `isDeleted` + `retainUntil` 5 ปี + `legalHold`

### 🟠 Performance

**DB-03 · คิวฝ่ายบัญชียัง sort ในหน่วยความจำ**

แผนจริงที่ 41 แถว:
```
Limit (actual time=0.086..0.091 rows=41)
  -> Sort (Sort Method: quicksort  Memory: 30kB)
       -> Index Scan using applications_status_isDeleted_idx  (0.027..0.049)
Execution Time: 0.133 ms
```
index พาไปถึงแถวได้ แต่ยังต้องเรียงเอง · ที่ 41 แถวเร็วมาก แต่คิวที่ยาวขึ้นจะโตตามจำนวน

### 🟡 Cleanliness

**DB-04 · `applications.standardCode` และ `certificates.standardCode` เป็น SET NULL**
ลบมาตรฐานหนึ่งตัว แล้วคำขอ/ใบรับรองจะลืมว่าถูกตัดสินด้วยมาตรฐานอะไร
**ลดระดับลง** เพราะตรวจแล้วพบว่า `certificates` เก็บ `standardName` เป็นสำเนาไว้ด้วย
ใบรับรองจึงยังบอกได้ว่าออกตามมาตรฐานชื่ออะไร แม้ FK จะกลายเป็น null

**DB-05 · `applications.reviewerId/auditorId/schedulerId/submitterId` เป็น SET NULL**
ลบผู้ใช้ = คำขอลืมว่าใครตรวจ · ยอมรับได้เพราะ `AuditLog` บันทึกการกระทำแยกไว้แล้ว
และ `users` เองก็มี soft-delete แต่ควรรู้ไว้

---

## 3. Refactored DDL

`prisma/migrations/20260909000000_integrity_constraints/migration.sql`

```sql
-- คำศัพท์ปิด: 18 สถานะ ตรงกับ WORKFLOW_STATES ในโค้ด
ALTER TABLE "applications" ADD CONSTRAINT "applications_status_vocabulary"
  CHECK (status IN ('DRAFT','SUBMITTED','PENDING_DOC_FEE', /* … 18 คำ … */ 'CANCEL_EXPIRED'));

ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_phase_vocabulary"
  CHECK (phase IN ('PHASE_1','PHASE_2'));

-- จำนวนเงินต้องเป็นบวก · ศูนย์ก็ไม่ได้ เพราะแถวนี้แปลว่า "รับเงินแล้ว"
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_amount_positive"
  CHECK ("amountThb" > 0);

ALTER TABLE "applications" ADD CONSTRAINT "applications_phase_amounts_nonnegative"
  CHECK ("phase1Amount" >= 0 AND "phase2Amount" >= 0);

-- หลักฐานการรับเงินไม่หายไปพร้อมคำขอ
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- คิวฝ่ายบัญชี: อ่านมาเรียงแล้ว ข้ามขั้น sort
CREATE INDEX "applications_status_isDeleted_updatedAt_idx"
  ON "applications" (status, "isDeleted", "updatedAt");
```

**ทำไมไม่ใช้ enum ของ Postgres:** เพิ่มค่าใน enum ต้อง `ALTER TYPE` ซึ่งล็อกและย้อนยาก
CHECK แก้ได้ด้วย DROP+ADD ในทรานแซกชันเดียว และอ่านออกด้วยตาเปล่า

**⚠️ Prisma ไม่รู้จัก CHECK constraint** — `migrate diff --from-empty` จะไม่สร้างมันขึ้นใหม่
ถ้าวันหนึ่งต้องสร้าง migration ชุดแรกใหม่ ต้องคัดลอกไฟล์นี้ตามไปด้วย
บันทึกไว้ในคอมเมนต์ของ `fee.prisma` แล้ว

---

## 4. พิสูจน์หลังแก้

```
สถานะปลอม                        -> violates check constraint "applications_status_vocabulary"
งวดปลอม PHASE_999                -> violates check constraint "fee_payments_phase_vocabulary"
ค่าธรรมเนียมติดลบ                  -> violates check constraint "fee_payments_amount_positive"
ค่าธรรมเนียมศูนย์บาท                -> violates check constraint "fee_payments_amount_positive"
ลบคำขอที่มีหลักฐานรับเงินผูกอยู่      -> violates foreign key constraint

สถานะจริง                        -> UPDATE 1     (ค่าที่ถูกยังผ่าน)
ค่าธรรมเนียมจริง 5,885 บาท          -> INSERT 1
```

สคีมากับฐานข้อมูลตรงกันแล้ว (`migrate diff` ว่าง) · index ประกาศไว้ในสคีมาด้วย
ไม่งั้น `migrate dev` รอบหน้าจะลบทิ้ง

**เครื่องเฝ้า** `__tests__/unit/database-guards-the-vocabulary.test.js` — ผูก CHECK
เข้ากับ `WORKFLOW_STATES` ในโค้ด · พิสูจน์ด้วยการกลายพันธุ์: เพิ่มสถานะในโค้ดโดยไม่แก้
constraint แล้วเทสแดงทันที (ไม่งั้นจะไปพังตอนรันจริงแทน)

---

## 5. สิ่งที่ยังไม่ได้ทำ

- ยังไม่ได้วัดที่ปริมาณจริง (หลักหมื่นแถว) — วัดที่ 41 แถว ซึ่งพอบอกได้ว่าไม่มี N+1
  แต่ไม่พอบอกว่า index ใหม่ช่วยได้เท่าไรเมื่อคิวยาว
- `applications.formData` เป็น JSON ก้อนใหญ่ที่ไม่มี index — query ที่กรองด้วยเนื้อใน
  formData จะ scan ทั้งตาราง · ยังไม่พบ query แบบนั้นในเส้นทางที่ Lite ใช้ แต่ควรรู้
- ยังไม่ได้ตรวจ retention job ว่ามีอะไรลบข้อมูลที่พ้น `retainUntil` จริงหรือไม่

---

# ภาคผนวก — สองข้อที่เจอตอนพิสูจน์การแนบเอกสาร (2026-09-09)

ระหว่างตรวจว่า `minio:9000` ทำให้การอัปโหลดพังไหม (คำตอบ: ไม่ · `STORAGE_PROVIDER`
ปริยายคือ `local` และ compose ผูก volume ไว้ตรงกัน) พบสองข้อที่สำคัญกว่าของค้างเดิม

## 🔴 A · คำปฏิเสธเชิงกฎถูกแสดงเป็นระบบพัง

ผู้ยื่นอัปโหลดเอกสารเข้าคำขอที่อยู่สถานะ `PENDING_AUDIT_FEE` (แก้ไขไม่ได้ — ถูกต้อง)

| | ก่อนแก้ | หลังแก้ |
|---|---|---|
| `code` | `APPLICATION_NOT_EDITABLE` ✓ | เหมือนเดิม |
| `message` | `Failed to upload draft document` | `This application is no longer editable in its current status` |
| `messageTh` | **`เกิดข้อผิดพลาดภายในระบบ`** | `ใบสมัครนี้ไม่สามารถแก้ไขได้ในสถานะปัจจุบัน` |

เหตุ: `respondError` อ่าน `opts.message` ของผู้เรียกเป็น **ข้อความทับ** ทั้งที่ผู้เรียก
ตั้งใจให้เป็น **ข้อความสำรอง** · แคตตาล็อก 204 รหัสมีประโยคไทยที่ถูกต้องอยู่แล้ว
แต่ไม่เคยถูกอ่าน · ผลคือกฎธุรกิจปกติถูกบอกว่าเป็นความผิดพลาดของระบบ

แก้: เมื่อรหัสที่ผู้โยนแนบมาอยู่ในแคตตาล็อก ประโยคของแคตตาล็อกชนะ · รหัสที่แคตตาล็อก
ไม่รู้จักยังใช้ข้อความสำรองเหมือนเดิม (ไม่ทำให้เส้นทางอื่นพัง — มีเทสยืนยันข้อนี้)

## 🟠 B · ไฟล์กำพร้าทุกครั้งที่อัปโหลดล้มเหลว

multer เขียนไฟล์ลงดิสก์ก่อน handler เริ่มทำงาน · เมื่อ handler ปฏิเสธทีหลัง ไฟล์ค้าง

วัดจริง: อัปโหลดล้มเหลว 2 ครั้ง → ไฟล์กำพร้า 2 ไฟล์ ไฟล์ละ 2,430 ไบต์ ไม่มีแถวใน
`application_documents` เลย

ทำไมเป็นเรื่อง PDPA ไม่ใช่แค่ความสะอาด: ไฟล์เหล่านั้นคือ**เอกสารที่ผู้ยื่นอัปโหลด**
(บัตรประชาชน โฉนด) ที่ไม่มีเจ้าของ ไม่มีนาฬิกาเก็บรักษา และคำขอใช้สิทธิ์ลบข้อมูล
หามันไม่เจอ เพราะคำขอลบเดินตามแถวในฐานข้อมูล

แก้: `catch` ลบไฟล์แบบ best-effort · ถ้าลบไม่ได้บันทึกไว้ แต่ยังตอบผู้ใช้ด้วยเหตุผล
จริงของความล้มเหลวเดิม ไม่ใช่เหตุผลของการเก็บกวาด

พิสูจน์: อัปโหลดที่ต้องล้มเหลว → ไฟล์บนดิสก์ 1 → 1 (ไม่มีขยะค้าง) ·
ทางที่ถูกต้องยังทำงาน → 1 → 2 พร้อมแถว `land_doc | doc2.pdf | 2430`

## ✅ ยืนยันแล้ว: การแนบเอกสารทำงานจริง

RETAIN ข้อ 1.2 ของโจทย์ · เดินจริง: สร้างร่าง → อัปโหลด → ไฟล์ลงดิสก์ + แถวในฐานข้อมูล
และประตูปฏิเสธไฟล์ที่เล็กเกินกว่าจะอ่านได้ (< 1.8 KB) ด้วยข้อความที่คนอ่านรู้เรื่อง
