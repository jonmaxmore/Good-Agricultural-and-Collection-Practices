-- คำศัพท์ปิดต้องถูกคุมที่ฐานข้อมูล ไม่ใช่แค่ในจาวาสคริปต์
--
-- วัดจริง 2026-09-09 บนฐานข้อมูลที่ migrate ครบแล้ว: ทั้งสคีมามี CHECK constraint
-- ศูนย์ตัว · เขียน SQL ตรง ๆ ใส่ค่าที่ไม่มีอยู่จริงได้ทั้งคู่
--
--   UPDATE applications SET status = 'ไม่มีสถานะนี้อยู่จริง'      -> UPDATE 1
--   INSERT INTO fee_payments (phase, "amountThb") VALUES ('PHASE_999', -1) -> INSERT 1
--
-- ตัวที่สองร้ายกว่า: ค่าธรรมเนียมติดลบบนแถวที่ทั้งระบบใช้เป็นหลักฐานว่าเงินเข้าแล้ว
-- และคอมเมนต์ใน prisma/schema/fee.prisma เขียนไว้เองว่า "CHECK constraint ใน
-- migration เป็นตัวคุมคำ" — คำสัญญาที่ไม่เคยถูกเขียน
--
-- ทำไมไม่ใช้ enum ของ Postgres: การเพิ่มค่าใน enum ต้องใช้ ALTER TYPE ซึ่งล็อกและ
-- ย้อนยากกว่า · CHECK แก้ได้ด้วย DROP+ADD ในทรานแซกชันเดียว และอ่านออกด้วยตาเปล่า

-- ── สถานะคำขอ: 18 คำ ตรงกับ WORKFLOW_STATES ใน services/workflow-transition-service.js
ALTER TABLE "applications" DROP CONSTRAINT IF EXISTS "applications_status_vocabulary";
ALTER TABLE "applications" ADD CONSTRAINT "applications_status_vocabulary"
  CHECK (status IN (
    'DRAFT','SUBMITTED','PENDING_DOC_FEE','DOC_FEE_PAID','ASSIGNED_FOR_REVIEW',
    'REVISION_REQUESTED','DOC_APPROVED','PENDING_AUDIT_FEE','AUDIT_FEE_PAID',
    'AUDIT_CONFIRMED','CAR_PENDING','CAR_REVIEWING','AUDIT_PASSED','APPROVED',
    'CERTIFIED','REJECTED','EXPIRED','CANCEL_EXPIRED'
  ));

-- ── งวดค่าธรรมเนียม: สองงวด ตรงกับ PHASES ใน routes/api/fees/fee-payments.js
ALTER TABLE "fee_payments" DROP CONSTRAINT IF EXISTS "fee_payments_phase_vocabulary";
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_phase_vocabulary"
  CHECK (phase IN ('PHASE_1','PHASE_2'));

-- ── จำนวนเงินต้องเป็นบวก · ศูนย์ก็ไม่ได้ เพราะแถวนี้แปลว่า "รับเงินแล้ว"
ALTER TABLE "fee_payments" DROP CONSTRAINT IF EXISTS "fee_payments_amount_positive";
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_amount_positive"
  CHECK ("amountThb" > 0);

-- ── ราคาที่ตรึงบนคำขอต้องไม่ติดลบเช่นกัน (ศูนย์ได้ ระหว่างที่ยังเป็นร่าง)
ALTER TABLE "applications" DROP CONSTRAINT IF EXISTS "applications_phase_amounts_nonnegative";
ALTER TABLE "applications" ADD CONSTRAINT "applications_phase_amounts_nonnegative"
  CHECK ("phase1Amount" >= 0 AND "phase2Amount" >= 0);

-- ── หลักฐานการรับเงินต้องไม่หายไปพร้อมคำขอ
--
-- fee_payments.applicationId เคยเป็น ON DELETE CASCADE ซึ่งขัดกับ docblock ของ
-- ตารางตัวเองที่เขียนว่า "ไม่มีใครลบได้ (ไม่มี soft delete โดยตั้งใจ)" · การลบคำขอ
-- หนึ่งใบจะลบบันทึกว่าใครบอกว่าเงินเข้าแล้วไปด้วย เงียบ ๆ
--
-- RESTRICT แปลว่าคำขอที่มีประวัติการรับเงินจะลบจริงไม่ได้เลย ซึ่งถูกต้องสำหรับ
-- ทะเบียนราชการ — applications มี isDeleted + retainUntil 5 ปี + legalHold อยู่แล้ว
-- การลบจริงจึงเป็นสิ่งที่ไม่ควรเกิด และตอนนี้เกิดไม่ได้ถ้ามีเงินผูกอยู่
ALTER TABLE "fee_payments" DROP CONSTRAINT IF EXISTS "fee_payments_applicationId_fkey";
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── index รองรับคิวของฝ่ายบัญชี: กรอง status+isDeleted แล้วเรียง updatedAt
--
-- แผนปัจจุบัน (41 แถว) ใช้ applications_status_isDeleted_idx แล้ว sort ในหน่วยความจำ
-- 0.133 ms · เพิ่ม updatedAt เข้าไปให้อ่านมาเรียงแล้ว จึงข้ามขั้น sort ไปได้เมื่อคิวยาว
CREATE INDEX IF NOT EXISTS "applications_status_isDeleted_updatedAt_idx"
  ON "applications" (status, "isDeleted", "updatedAt");
