# GACP Lite — Execution Plan

ที่มา: `GACP-Certification-Application` (full) → `Good-Agricultural-and-Collection-Practices` (lite, repo ว่าง)
วันที่วาง: 2026-09-08 · ทุกตัวเลขในเอกสารนี้มาจากการสแกนโค้ดจริง ไม่ใช่การประมาณ

## 0. ข้อเท็จจริงที่วัดได้ก่อนเริ่ม

| สิ่งที่วัด | ค่า |
|---|---|
| ไฟล์ backend ทั้งหมด (.js, ไม่รวม node_modules) | 1,539 |
| ไฟล์ web-app (.ts/.tsx) | 1,085 |
| ไฟล์ schema prisma | 33 ไฟล์ · ~110 model |
| หน้าจอ `page.tsx` | health 60 · provider 58 · admin 11 · อื่น ๆ 32 |
| **dependency closure ของ 5 route หลักที่ต้องเก็บ** | **246 ไฟล์** |
| จุดสัมผัสกับโมดูลที่ต้องตัด (ในกรวย 246) | 24 ไฟล์ |
| package ภายนอกที่กรวยนั้นเรียก | 27 |

> **แก้ความเข้าใจในโจทย์ข้อ 1**: ไม่มี "External Auth Gateway ที่ https://demo.gacpth.com/auth"
> `demo.gacpth.com` คือ hostname ของ deployment เดโมเอง (docker-compose.demo.yml) ไม่ใช่ระบบ auth ภายนอก
> สิ่งที่ต่อออกไปข้างนอกจริงคือ **IdP ของรัฐ (ThaiD / หมอพร้อม)** ที่ `routes/api/auth/auth-idp.js`
> + `auth-provider.js` + `apps/web-app/src/lib/api/idp-client.ts` · เจตนาตรงกัน สิ่งที่ตัดคือตัวนี้

## 1. คำตัดสินที่ operator ให้แล้ว (2026-09-08)

1. **ค่าธรรมเนียม**: คงขั้นตอนไว้ในเส้นทางคำขอ แต่ไม่มี payment gateway — เจ้าหน้าที่กดยืนยันว่ารับเงินแล้ว
2. **role**: แยก `document_reviewer` (ตรวจเอกสาร) กับ `auditor` (ตรวจแปลง) เป็นคนละตำแหน่ง

## 2. state machine ที่ Lite จะใช้ (ตัดจากของเต็ม ไม่ได้คิดใหม่)

ของเต็ม (`services/workflow-transition-service.js:48-90`) มี slip-review 2 สถานะที่มาจากระบบสลิปที่เลิกใช้แล้ว
Lite ตัดสองตัวนั้นทิ้ง แล้วให้เจ้าหน้าที่ยิง transition ตรง:

```
DRAFT → SUBMITTED → PENDING_DOC_FEE → DOC_FEE_PAID → ASSIGNED_FOR_REVIEW
                         ↑ officer กดยืนยันรับเงิน          ↓
                                            DOC_APPROVED ─┴─ REVISION_REQUESTED ⟲
                                                 ↓
   PENDING_AUDIT_FEE → AUDIT_FEE_PAID → AUDIT_CONFIRMED → AUDIT_PASSED → APPROVED → CERTIFIED
        ↑ officer กดยืนยัน                     ├─ CAR_PENDING ⟲ CAR_REVIEWING
                                               └─ REJECTED
```

## 3. รายการตัด (PURGE) — ระบุเป็นไฟล์จริง

### 3.1 Track & Trace + QR ของบันทึกการปลูก
```
apps/backend/routes/api/trace/                    (4 ไฟล์)
apps/backend/routes/api/helpers/lots-label-routes.js
apps/backend/services/traceability-service.js
apps/backend/services/harvest-service.js
apps/backend/services/pdf/lot-label-template-service.js
apps/backend/prisma/schema/trace.prisma           ← ยกเว้น PlantSpecies + DocumentRequirement (ย้ายออกก่อนลบ)
apps/backend/prisma/schema/harvest.prisma
apps/backend/prisma/schema/batch-lab-result.prisma
apps/web-app/src/app/trace/                       (5 pages)
apps/web-app/src/app/health/tracking/
apps/web-app/src/app/provider/tracking/
```
> `services/qrcode/public-trace-url.js` **ไม่ตัด** — มันสร้าง URL ตรวจสอบใบรับรองด้วย (`publicVerifyUrlFor`)

### 3.2 บันทึกการปลูก
```
apps/backend/routes/api/cultivation/              (12 ไฟล์)
apps/backend/prisma/schema/cultivation.prisma
apps/backend/prisma/schema/gacp-compliance.prisma  ← ตรวจก่อน: ถ้าคำขออ้างถึง ให้ย้ายเข้า application
apps/web-app/src/app/health/planting/             (6 pages)
```

### 3.3 ความรู้สมุนไพร / แบบสำรวจ / SOP
```
apps/backend/routes/api/herbs/ · routes/api/surveys/
apps/backend/routes/api/documents/sop-documents.js
apps/backend/prisma/schema/herb.prisma · survey.prisma
model SOPDocument ใน prisma/schema/system.prisma
apps/web-app/src/app/health/herbs/ · health/surveys/ · health/sop-builder/ · health/sop-templates/
apps/web-app/src/app/provider/herbs/ · provider/surveys/
```

### 3.4 IdP ภายนอก (ข้อ 1 ของโจทย์)
```
apps/backend/routes/api/auth/auth-idp.js · auth-provider.js
apps/backend/config/auth-providers.js
apps/backend/routes/api/identity/            (consent, mfa)
apps/web-app/src/lib/api/idp-client.ts
apps/web-app/src/app/verify-identity/
model IdentityLink ใน prisma/schema/auth.prisma
```

### 3.5 ระบบเงินเต็มรูป (คงเฉพาะสถานะ ตามคำตัดสินข้อ 1)
```
apps/backend/routes/api/finance/             (19 ไฟล์)
apps/backend/routes/api/webhooks/            (stripe webhook)
apps/backend/services/checkout/ · services/payment/ · services/billing/
apps/backend/modules/billing/
apps/backend/config/stripe.js
apps/backend/prisma/schema/billing.prisma    (21 model) → เหลือ FeePayment ใบเดียวที่เขียนใหม่
apps/web-app/src/app/health/payments/ · health/billing/
apps/web-app/src/app/provider/accounting/ · provider/receipts/
```

### 3.6 ส่วนที่ไม่อยู่ในขอบเขต Lite
```
apps/mobile-app/                             ทั้งโฟลเดอร์
apps/backend/routes/api/{entities,interoperability,integration,datasets,preview,platform-admin}/
apps/web-app/src/app/health/workspaces/ · health/establishments/ (multi-tenant)
prisma/schema/{entity*,tenancy,work-distribution-ledger,tickets,waiver}.prisma
evidence/ · reports/ · scripts/probes/ · monitoring/ · testsprite_tests/   (harness ของทีมเรา ไม่ใช่ของลูกค้า)
```

## 4. รายการเก็บ (RETAIN)

| ชั้น | ของที่เก็บ |
|---|---|
| schema | `auth`(User,UserConsent) `farm` `application*` `attachment` `certification` `audit` `audit-onsite-evidence` `correction-*` `requirement-rule` `application-document*` · `PlantSpecies`+`DocumentRequirement` ย้ายมาจาก trace · `system`(Notification,SystemConfig,DocumentTemplate,WizardStepConfig,AuditChecklist) |
| routes | `applications` `documents` `certificates` `audit` `files` `auth`(local เท่านั้น) `system`(บางส่วน) · `provider` เฉพาะ reviewer/audits/applications/certificates/dashboard |
| หน้าจอผู้ขอ | `health/{home,dashboard,applications/*,documents,certificates,profile,notifications,status,start}` |
| หน้าจอเจ้าหน้าที่ | `provider/{login,home,dashboard,applications,reviewer,audits,certificates,calendar,profile}` |

## 5. ลำดับลงมือ

| # | ขั้น | คำสั่งยืนยันผล |
|---|---|---|
| 1 | คัดลอกเฉพาะที่เก็บเข้ามาใน `~/work/gacp-lite` (allowlist ไม่ใช่ copy-then-delete) | `find . -name '*.js' \| wc -l` เทียบกับกรวย 246 |
| 2 | รวม schema 33 ไฟล์ → เหลือชุด Lite แล้ว `prisma validate` | `npx prisma validate` |
| 3 | เขียน `FeePayment` + transition `markFeeReceived` แทน billing ทั้งกอง | `npx jest markFeeReceived` |
| 4 | auth: ตัด IdP เหลือ local JWT + 4 role (`applicant/document_reviewer/auditor/admin`) | `npx jest auth` |
| 5 | ไล่ import ที่ค้าง จนกระทั่ง `node -e "require('./server.js')"` ผ่าน | `node --check` ทุกไฟล์ + boot |
| 6 | ตัด dependency ที่ไม่ใช้ออกจาก `package.json` ทั้งสองแอป | `npx depcheck` |
| 7 | `docker-compose.yml` ใบเดียว: postgres + backend + web (พอร์ตไม่ชนของเต็ม) | `docker compose config` |
| 8 | build ทั้งสองฝั่ง | `npx tsc --noEmit` · `npx next build` |
| 9 | seed + เดินเส้นทางจริง 1 รอบ: ยื่น → จ่าย → ตรวจเอกสาร → ตรวจแปลง → ออกใบรับรอง | script `scripts/smoke-full-journey.js` |

## 6. การแยกจากเวอร์ชันเต็ม (ไม่ชนกัน)

| ชั้น | เวอร์ชันเต็ม | Lite |
|---|---|---|
| โฟลเดอร์ | `~/work/GACP-Certification-Application` | `~/work/gacp-lite` |
| git | `GACP-Certification-Application.git` | `Good-Agricultural-and-Collection-Practices.git` (repo คนละใบ ไม่ใช่ worktree) |
| ประวัติ | — | **เริ่มใหม่ commit เดียว** — ไม่ลากประวัติเก่าไป (ของเต็ม gitleaks ยังแดง) |
| docker project | `gacp-*` | `gacplite-*` |
| พอร์ต | 3001/3003/8001/8003/8080/8099/3200/9000-9001/9090/55450 | web 3100 · api 8100 · postgres 55460 |
| ฐานข้อมูล | Supabase สิงคโปร์ (demo/staging) | **postgres ใน compose ของตัวเอง** — ไม่แตะ Supabase เด็ดขาด |
