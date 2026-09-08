# 📋 Permit Form Feature

> **Domain:** GACP Permit Application Forms
> **Status:** STUB — Slots + Feature Flag ready, waiting for team to implement full forms

## License Forms (ภ.ท.) — via DTAM herbctrl.dtam.moph.go.th

| แบบฟอร์ม | คำอธิบาย | Slot ID | สถานะ |
|---|---|---|---|
| **ภ.ท.9** | คำขอรับใบอนุญาตศึกษาวิจัยสมุนไพรควบคุม | `license_pt09` | ⚠️ STUB |
| **ภ.ท.10** | คำขอรับใบอนุญาตส่งออกสมุนไพรควบคุมเพื่อการค้า | `license_pt10` | ⚠️ STUB |
| **ภ.ท.11** | คำขออนุญาตจำหน่าย/แปรรูปสมุนไพรควบคุมเพื่อการค้า | `license_pt11` | ⚠️ STUB |
| **ภ.ท.12** | คำขอรับอนุญาตจำหน่าย/ครอบครองสมุนไพรควบคุม (กทล.1) | `license_pt12` | ⚠️ STUB |
| **ภ.ท.13** | ใบอนุญาตแปรรูป (เจ้าหน้าที่ออก) | `license_pt13` | Conditional |
| **ภ.ท.16** | คำขอรับใบแทนใบอนุญาต (สูญหาย/ชำรุด) | `license_pt16` | Conditional |

## Monthly Reports (ภ.ท.27-32) — Backend: `routes/api/report-submissions.js`

| แบบฟอร์ม | คำอธิบาย | Report Type Code |
|---|---|---|
| **ภ.ท.27** | รายงานข้อมูลแหล่งที่มาและจำนวนที่เก็บไว้ | `PT27` |
| **ภ.ท.28** | รายงานข้อมูลการนำไปใช้ | `PT28` |
| **ภ.ท.29** | รายงานแปรรูป/จำหน่าย | `PT29` |
| **ภ.ท.30** | รายงานศึกษาวิจัย | `PT30` |
| **ภ.ท.31** | รายงานการส่งออก (ส่วน 1) | `PT31` |
| **ภ.ท.32** | รายงานการส่งออก (ส่วน 2 — มูลค่า) | `PT32` |

## Feature Flag

```typescript
useFeatureFlag(FEATURE_FLAGS.PERMIT_FORMS)
// false by default — turn ON when forms are ready
```

## Conditional Logic (Document Slots)

Slots are auto-activated based on:

- `plantType` → cannabis/kratom triggers PT09/10/11/12
- `objectives` → RESEARCH (PT09), EXPORT (PT10), COMMERCIAL (PT11/12)
- `applicationType` → REPLACEMENT (PT16)
- `objectives` → PROCESSING (PT13)

## Components

- PermitSubmissionForm (TODO)
- DocumentUploader ✅
- ProgressTracker ✅

## Validation

- Thai ID Checksum ✅
- Document completeness check ✅
- Slot-to-objective mapping ✅
