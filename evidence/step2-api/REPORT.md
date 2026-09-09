# Step 2.3 — API Design Audit · GACP Lite

**วิธีตรวจ: ดัมป์ตารางเส้นทางจาก router ตัวจริง (258 เส้นทาง) แล้วยิงทุกข้อบนระบบที่รันอยู่**
(api 8100 · Postgres) ไม่ได้อ่านโค้ดแล้วสรุป

---

## สรุป

| # | เรื่อง | ระดับ | สถานะ |
|---|---|---|---|
| API-01 | header `Allow` บอกชื่อพาธที่ไม่มีอยู่จริง และ 405 หายไปจาก mount หลายเซ็กเมนต์ | 🟠 HIGH | แก้แล้ว |
| API-02 | คิวพังตอบเหมือนคิวว่าง (`success:true, data:[]` ตอน error) | 🟠 HIGH | แก้แล้ว |
| API-03 | คิวตรวจไม่บอกชื่อผู้ยื่น — `applicantName: 'N/A'` ค่าคงที่ | 🟡 MEDIUM | แก้แล้ว |
| API-04 | `plantType` ถูกป้อนด้วย `areaType` หน้าจอพาดหัวว่า "พืช" แสดง OUTDOOR | 🟡 MEDIUM | แก้แล้ว |
| API-05 | `templateCode: 'GAP-001'` ค่าปลอมติดมากับทุกคำตอบ | 🟡 MEDIUM | แก้แล้ว |
| API-06 | การแบ่งหน้าเขียนไว้สามแบบในระบบเดียว | 🟡 MEDIUM | ยังไม่แก้ — ต้องตัดสินรูปแบบเดียว |
| API-07 | `/api/audit` (บันทึกระบบ) กับ `/api/audits` (การตรวจแปลง) ต่างกันตัวอักษรเดียว | 🟡 MEDIUM | ยังไม่แก้ — เป็นการเปลี่ยนสัญญา |

---

## 🟠 HIGH · API-01 · `Allow` บอกชื่อพาธที่ไม่มีอยู่จริง

**ตำแหน่ง:** `apps/backend/middleware/api-not-found.js` — `mountPathOf`

ตัวแยก 405 ออกจาก 404 เดินสแตกของ router แล้วถามว่าพาธนี้มีวิธีไหนลงทะเบียนไว้ ·
Express ไม่เก็บสตริงที่ใช้ mount ต้องกู้จาก regexp เอง และตัวกู้หยุดที่ตัวคั่นแรก:

```
use('/audit/scheduling', r)  ->  '/audit'
use('/auth/health', r)       ->  '/auth'
```

**วัดจริงก่อนแก้ — พังทั้งสองทิศ:**
```
DELETE /api/audit/scheduling/queue   404          (GET มีอยู่จริง ควรเป็น 405)
DELETE /api/auth/health/login        404          (POST มีอยู่จริง)
DELETE /api/auth/login               405 Allow: POST
POST   /api/auth/login               404          <- เดินตาม Allow ของเราเอง
```

คู่สุดท้ายคือข้อหนัก · `/api/auth/login` ไม่ใช่เส้นทางเลย ประตูล็อกอินจริงคือ
`/api/auth/health/login` กับ `/api/auth/provider/login` แต่พาธที่ถูกตัดทำให้
`'/auth' + '/login'` ดูเหมือนเส้นทางที่ลงทะเบียนไว้ · ระบบจึงโฆษณาประตูล็อกอินที่ไม่มีอยู่
พร้อมบอกวิธีที่ต้องใช้ · SDK ที่ generate จาก header หรือหน่วยงานที่ integrate จะเดินเข้า 404

**mount ที่กระทบ:** `/audit/onsite` `/audit/scheduling` `/admin/user-groups`
`/admin/work-config` `/analytics/work-kpis` `/auth/applicant` `/auth/health`
`/auth/officer` `/auth/provider` — ประตูล็อกอินทั้งหมดอยู่ในนี้

**แก้แล้ว** — อ่าน regexp จนจบพาธแทนที่จะหยุดที่ตัวคั่นแรก · mount ที่กู้แล้วยังมีไวยากรณ์
regexp ติดอยู่ (mount ที่มี `:param` ซึ่งโค้ดชุดนี้ยังไม่มี) ถือว่า "อ่านไม่ได้" และตอบ 404
แทน 405 — เสียความสะดวกไปหนึ่งอย่าง แต่ไม่แต่งพาธขึ้นมาเอง ซึ่งคือต้นเหตุของบั๊กนี้

**หลังแก้ · ยิงจริง:**
```
DELETE /api/audit/scheduling/queue   405 Allow: GET, OPTIONS
DELETE /api/auth/health/login        405 Allow: POST, OPTIONS
DELETE /api/auth/provider/login      405 Allow: POST, OPTIONS
DELETE /api/applications/my          405 Allow: GET, OPTIONS   (mount เซ็กเมนต์เดียว ไม่พัง)
GET|POST|DELETE /api/auth/login      404 ทุกวิธี ไม่มี Allow
GET|POST|DELETE /api/audit/queue     404 ทุกวิธี ไม่มี Allow
```
เฝ้าโดย `__tests__/unit/allow-header-never-names-a-path-that-is-not-there.test.js` ·
**พิสูจน์ว่าแดงได้:** ย้อนตัวกู้พาธกลับ -> แดง 8 จาก 10

> ไฟล์นี้เหมือนกันทุกไบต์กับ `apps/backend/middleware/api-not-found.js` ใน repo เต็ม
> (GACP-Certification-Application, merge แล้วที่ fe289fea) — ข้อบกพร่องเดียวกันอยู่ที่นั่นด้วย
> และยังไม่ได้แก้ที่นั่น เพราะเป็นคนละใบงาน

---

## 🟠 HIGH · API-02 · คิวที่พังตอบเหมือนคิวที่ว่าง

**ตำแหน่ง:** `apps/backend/routes/api/audit/audits.js` — `/pending-schedule`, `/scheduled`

```js
} catch (error) {
    logger.error('[Audit] getPendingSchedule error:', error);
    res.json({ success: true, data: [] });     // <- 200 + success:true
}
```

ฐานข้อมูลล่ม query พัง หรือ schema เพี้ยน — คนจัดคิวอ่านหน้าจอได้ว่า **"ไม่มีคิวรอ"**
แล้วก็ไม่ทำอะไร · ไม่มีอะไรบนหน้าจอบอกว่าคำตอบนั้นไม่ใช่ความจริง และ `success: true`
ทำให้ทั้งการ retry ทั้งการ alert ไม่ทำงาน

ประตูรายการหลักป่วยคู่กันคนละแบบ: ตอบ 500 แต่ยังส่ง `data: { audits: [] }` มาด้วย
client ที่อ่าน `data.audits` จึงเห็นคิวว่างอยู่ดี

**แก้แล้ว** — ทั้งสามประตูส่งต่อให้ `respondError` · คิวที่ว่างจริงยังตอบ
`{success:true, count:0, data:[]}` เหมือนเดิม

---

## 🟡 MEDIUM · API-03 · คิวตรวจไม่บอกชื่อผู้ยื่น

```js
applicantName: 'N/A', // We need to fetch User/Applicant name!
```

คอมเมนต์ของผู้เขียนเองบอกไว้ว่ายังไม่ได้ดึง และอีกสามบรรทัดใต้ลงมาเขียนวิธีทำไว้แล้ว
(`Let's use include: { applicant: true }`) · ที่ทำให้ชัดว่าเป็น select gap ไม่ใช่ข้อจำกัด
ของข้อมูล คือ **ประตูรายละเอียด `/api/audits/:id` ดึงชื่อมาถูกอยู่แล้ว** — ข้อมูลห่างไป
include เดียว

**วัดจริงก่อนแก้** (ตั้งคำขอจริงเป็น `AUDIT_FEE_PAID` ชั่วคราวบน scratch DB แล้วคืนค่า):
```json
{"auditNumber":"APP-2569-MTSKYYON-9F43CD","applicantName":"N/A","plantType":"OUTDOOR"}
```

**หลังแก้:**
```json
{"applicantName":"สมชาย ใจดี","plantId":"cannabis","areaType":"OUTDOOR",
 "auditorId":null,"auditorName":null}
```

ชื่อองค์กรมาก่อนชื่อบุคคล เพราะนิติบุคคลถือใบรับรองในชื่อของตัวเอง · ไม่รู้ชื่อจริง ๆ
คืน `null` ไม่ใช่ `'N/A'` — หน้าจอเขียน `|| '-'` ไว้แล้ว และ `null` บอกความจริงว่า
"ไม่มีข้อมูล" ส่วน `'N/A'` อ่านเหมือนเป็นชื่อ

## 🟡 MEDIUM · API-04 · `plantType` ที่ไม่ใช่พืช

`plantType: app.areaType || 'Unknown'` · หน้าจอคนจัดคิวพาดหัวคอลัมน์ว่า **"พืช"**
(`provider/scheduler/reassign/page.tsx:207`) แล้วแสดงคำว่า `OUTDOOR`

`Application` มีคอลัมน์ `plantId` อยู่แล้ว (`application.prisma:303`) · ประตูรายละเอียด
ก็เขียน `plantType: formData?.plantId || areaType || '-'` — เอาลักษณะพื้นที่มาเป็นค่าสำรอง
ของพืช

**แก้แล้ว** — `plantId` คือพืช `areaType` คือลักษณะพื้นที่ ไม่มีตัวไหนเป็นค่าสำรองของอีกตัว ·
`inspector` (ซึ่งบรรจุ uuid) เปลี่ยนเป็น `auditorId` + `auditorName`

> ไม่มีหน้าจอไหนกิน `/api/audits` อยู่ตอนนี้ (ค้นทั้ง `apps/web-app/src`) การตั้งชื่อให้ถูก
> จึงไม่ทำให้ใครพัง และนี่คือเวลาที่ถูกที่สุดที่จะทำ

## 🟡 MEDIUM · API-05 · `templateCode: 'GAP-001'`

ค่าคงที่ติดมากับคำตอบของทุกใบ พร้อมคอมเมนต์ `// Mock Template Code if not present` ·
รหัสแม่แบบที่ไม่ได้มาจากใบนั้นจริง คือข้อมูลผิดที่ดูเหมือนข้อมูลถูก · เปลี่ยนเป็น
`application.standardCode || null`

---

## 🟡 MEDIUM · API-06 · การแบ่งหน้าสามแบบ — **ยังไม่แก้**

กวาด 101 GET ที่ผู้ยื่นเข้าถึงได้ · 69 ตอบ 200 · ซองระดับบนมี 9 รูปแบบ:

| รูปแบบ | จำนวน |
|---|---|
| `{success, data, count}` | 29 |
| `{success, data}` | 28 |
| `{success, data, count, grouped}` | 2 |
| `{success, data, total}` | 1 — `/api/documents` |
| `{success, data, count, page, total, totalPages}` | 1 — `/api/report-submissions` |
| อื่น ๆ (`query`, `filter`, `note`, `objectives`) | 4 |

รายการ 29 ใบบอก `count` แต่ไม่บอก `total` — client จึงบอกไม่ได้ว่าที่ได้มาคือทั้งหมดหรือ
แค่หน้าแรก · และคำว่า `count` เองมีสองความหมาย: ปกติแปลว่า "จำนวนแถวใน data" แต่
`/api/notifications/unread-count` ตอบ `{success, count}` โดยไม่มี `data` เลย

**ยังไม่แก้** — ต้องตัดสินรูปแบบเดียวก่อน (`{data, count, total, page, totalPages}` หรือ
cursor) แล้วไล่แก้ทีเดียว การแก้ทีละใบจะทำให้เกิดรูปแบบที่ 10

## 🟡 MEDIUM · API-07 · `audit` กับ `audits` — **ยังไม่แก้**

สองเส้นทางต่างกันตัวอักษรเดียว และเป็นคนละเรื่องสิ้นเชิง:

| เส้นทาง | คืออะไร | ใครเข้าได้ (วัดจริง) |
|---|---|---|
| `/api/audit` | **บันทึกการใช้งานระบบ** (`queryAuditLogs`) | ผู้ดูแล 200 · คนจัดคิว 403 · บัญชี 403 |
| `/api/audits` | **การตรวจแปลง** | ผู้ดูแล 200 · คนจัดคิว 200 · บัญชี 403 |

ด่านสิทธิ์ **ถูกต้องทั้งคู่** — ไม่มีช่องโหว่ที่นี่ · ปัญหาคือคนอ่านตารางเส้นทางแยกสองอันนี้
ไม่ออก และ guard ที่ใส่ผิดฝั่งจะมองไม่เห็น ซึ่งเป็นชั้นเดียวกับ SEC-06 ของ Step 4
(`/api/audit/scheduling` และ `/api/audit/onsite` ยิ่งทำให้สับสน — สองอันนี้เป็นการตรวจแปลง
แต่อยู่ใต้ prefix ของบันทึกระบบ)

**ยังไม่แก้** — ควรเป็น `/api/audit-logs` กับ `/api/audits` แต่นั่นคือการเปลี่ยนสัญญา
ต้องทำทีเดียวพร้อมย้าย `/audit/scheduling` และ `/audit/onsite` ไปอยู่ใต้ `/audits`

---

## ✅ ตรวจแล้วไม่พบปัญหา

**คำกริยาในเส้นทาง** — ที่พบ (`/verify` `/submit` `/approve` `/confirm` `/assign`
`/export`) ล้วนเป็นการเปลี่ยนสถานะ ซึ่ง REST ยอมรับให้เป็น sub-resource action ·
มีข้อเดียวที่ซ้ำซ้อนคือ `DELETE /api/auth/me/delete` (วิธีบอกอยู่แล้วว่าลบ)

**พาธคงที่ที่อยู่ใต้ prefix เดียวกับ `:id`** — `/applications/config` `/journey/*`
`/validate/*` `/my` ฯลฯ ลงทะเบียนก่อน `:id` ทุกตัว ยิงจริงได้ผลของตัวเองครบ ไม่มีตัวไหน
ถูก `:id` กลืน

**`/journey/full-config`** — คืน 5 กลุ่ม (`purposes, methods, layouts, styles,
journeyConfigs`) ไม่ได้ทับซ้อนกับ 13 endpoint ย่อยแบบตัวต่อตัว จึงไม่ใช่ของซ้ำ

**ซองของ `/api/health` และ `/api/version`** — ไม่ใช้ envelope เหมือน endpoint อื่น
ซึ่งเป็นธรรมเนียมของ probe ปล่อยไว้ตามเดิม

---

## หมายเหตุเรื่องวิธี

ตารางเส้นทางรอบแรกที่ผมดัมป์เองอ่าน mount หลายเซ็กเมนต์ผิด (`/audit/scheduling` กลาย
เป็น `/audit`) ทำให้เกือบรายงานว่า `/api/audit/queue` เป็นเส้นทางที่ตายแล้ว · ที่กันไว้ได้
คือการยิงจริง — `GET` ได้ 404 แต่ `/api/audit/stats` ได้ 401 ซึ่งขัดกันเอง จึงไปตามหา
สาเหตุแทนที่จะเขียนรายงาน · แล้วจึงพบว่า **regex ตัวเดียวกันนี้อยู่ในโค้ดที่รันจริง** และนั่น
กลายเป็น API-01 ซึ่งเป็นข้อหนักที่สุดของรอบนี้

การเปลี่ยนสถานะคำขอเป็น `AUDIT_FEE_PAID` ชั่วคราวเพื่อวัด API-03/04 ทำบน scratch DB
และคืนค่าเดิมแล้ว (ยืนยัน: `APP-2569-MTSKYYON-9F43CD · PENDING_AUDIT_FEE`)
