/**
 * Plant Selection Step — Configuration, Types, and Constants
 * Extracted from plant-selection-step.tsx to reduce component file size.
 */

import type {
    CertificationPurpose,
    DocumentUpload,
    MainCultivationType,
    PlantId,
    ServiceType,
} from '../hooks/use-application-flow-store';

// TYPES

export interface PlantOption {
    id: string;
    code: PlantId;
    nameTH: string;
    nameEN: string;
    group: 'HIGH_CONTROL' | 'GENERAL';
    enabled: boolean;
    availableServiceTypes: ServiceType[];
}

export interface PlantApiOption {
    id?: string;
    code?: string;
    nameTH?: string;
    nameEN?: string;
    group?: 'HIGH_CONTROL' | 'GENERAL';
}

// Canonical M1 document types — exactly 3 forms regardless of purpose:
//   ภท.09 cultivation permit, ภท.10 distribution permit, ภท.11 controlled-herb permit.
// Multi-select certification purpose dedupes by `type`, so giving every
// purpose the same canonical IDs makes "all purposes selected → 3 unique
// upload slots" by construction.
export type PurposeDocumentType =
    | 'M1_PT09'
    | 'M1_PT10'
    | 'M1_PT11';

export interface PurposeDocumentConfig {
    type: PurposeDocumentType;
    labelTH: string;
    labelEN: string;
    descriptionTH: string;
    descriptionEN: string;
    required: boolean;
}

export interface PurposeOption {
    id: CertificationPurpose;
    labelTH: string;
    labelEN: string;
    descriptionTH: string;
    descriptionEN: string;
    documents: PurposeDocumentConfig[];
}

export interface CultivationOption {
    id: MainCultivationType;
    labelTH: string;
    labelEN: string;
    descriptionTH: string;
    descriptionEN: string;
}

export interface PurposeDocumentState {
    name: string;
    url?: string | undefined;
    uploaded: boolean;
    required: boolean;
}

export interface ApplicationFlowStep {
    key: string;
    labelTH: string;
    labelEN: string;
    descriptionTH: string;
    descriptionEN: string;
}

// CONSTANTS

export const FALLBACK_PLANTS: PlantOption[] = [
    {
        id: '1',
        code: 'cannabis',
        nameTH: 'กัญชา',
        nameEN: 'Cannabis',
        group: 'HIGH_CONTROL',
        enabled: true,
        availableServiceTypes: ['NEW', 'RENEWAL'],
    },
    {
        id: '3',
        code: 'kratom',
        nameTH: 'กระท่อม',
        nameEN: 'Kratom',
        group: 'HIGH_CONTROL',
        enabled: false,
        availableServiceTypes: ['NEW'],
    },
    {
        id: '4',
        code: 'turmeric',
        nameTH: 'ขมิ้นชัน',
        nameEN: 'Turmeric',
        group: 'GENERAL',
        enabled: false,
        availableServiceTypes: ['NEW'],
    },
    {
        id: '5',
        code: 'ginger',
        nameTH: 'ขิง',
        nameEN: 'Ginger',
        group: 'GENERAL',
        enabled: false,
        availableServiceTypes: ['NEW'],
    },
    {
        id: '6',
        code: 'plai',
        nameTH: 'ไพล',
        nameEN: 'Plai',
        group: 'GENERAL',
        enabled: false,
        availableServiceTypes: ['NEW'],
    },
    {
        id: '7',
        code: 'black_galangal',
        nameTH: 'กระชายดำ',
        nameEN: 'Black Galangal',
        group: 'GENERAL',
        enabled: false,
        availableServiceTypes: ['NEW'],
    },
];

export const SERVICE_OPTIONS: Array<{
    id: ServiceType;
    labelTH: string;
    labelEN: string;
    descriptionTH: string;
    descriptionEN: string;
}> = [
        {
            id: 'NEW',
            labelTH: 'ขอรับรองใหม่',
            labelEN: 'New certification',
            descriptionTH: 'ยื่นคำขอครั้งแรก หรือใบรับรองเดิมหมดอายุแล้ว',
            descriptionEN: 'For first-time submission or expired certificate.',
        },
        {
            id: 'RENEWAL',
            labelTH: 'ต่ออายุใบรับรอง',
            labelEN: 'Renewal',
            descriptionTH: 'ใช้สำหรับต่ออายุใบรับรองที่ยังมีผลบังคับ',
            descriptionEN: 'For extending an active certificate.',
        },
        // 'MODIFY' ("แก้ไขข้อมูลในใบรับรองเดิมโดยไม่เริ่มคำขอใหม่ทั้งหมด") was removed on
        // 2026-09-05. It promised the opposite of the คำรับรอง the same applicant signs
        // three steps later — กทล.1 ส่วนที่ ๔ (๓), "ไม่เปลี่ยนพื้นที่/เมล็ดพันธุ์/ส่วนที่ใช้
        // โดยไม่ยื่นคำขอใหม่" — and it mapped to nothing: the requirement engine knows
        // NEW / RENEWAL / REPLACEMENT only, so picking it filed an ordinary new
        // application without saying so. Zero filings on either database used it.
    ];

// Canonical M1 document set — every purpose lists the same 3 forms by
// the same `type` IDs. The multi-select dedup pass in
// PlantSelectionConfigPanels collapses duplicates by `type`, so picking
// 1, 2, or all 3 purposes always yields exactly the 3 upload slots
// below: ภท.11, ภท.09, ภท.10 (in that display order — most-fundamental
// first).
const M1_DOCUMENT_SET: PurposeOption['documents'] = [
    {
        type: 'M1_PT11',
        labelTH: 'ภท.11 (คำขออนุญาตสมุนไพรควบคุม)',
        labelEN: 'PT.11 — Controlled herb permit application',
        descriptionTH: 'แบบคำขออนุญาตสำหรับสมุนไพรควบคุมตามกฎหมาย บังคับสำหรับทุกวัตถุประสงค์',
        descriptionEN: 'Controlled herb permit — required for every purpose.',
        required: true,
    },
    {
        type: 'M1_PT09',
        labelTH: 'ภท.09 (คำขออนุญาตเพาะปลูก)',
        labelEN: 'PT.09 — Cultivation permit application',
        descriptionTH: 'แบบคำขออนุญาตเพาะปลูกสมุนไพรควบคุม',
        descriptionEN: 'Cultivation permit application form.',
        required: true,
    },
    {
        type: 'M1_PT10',
        labelTH: 'ภท.10 (คำขออนุญาตจำหน่าย/ส่งออก)',
        labelEN: 'PT.10 — Distribution / export permit application',
        descriptionTH: 'แบบคำขออนุญาตจำหน่ายหรือส่งออกสมุนไพรควบคุม',
        descriptionEN: 'Distribution or export permit application form.',
        required: true,
    },
];

export const PURPOSE_OPTIONS: PurposeOption[] = [
    {
        id: 'MEDICAL',
        labelTH: 'ใช้ทางการแพทย์',
        labelEN: 'Medical use',
        descriptionTH: 'ผลผลิตนำไปใช้ในทางการแพทย์หรือการผลิตยาภายในประเทศ',
        descriptionEN: 'Produce intended for medical or domestic pharmaceutical use.',
        documents: M1_DOCUMENT_SET,
    },
    {
        id: 'EXPORT',
        labelTH: 'เพื่อการส่งออก',
        labelEN: 'Export',
        descriptionTH: 'ปลูกเพื่อจำหน่ายหรือส่งออกไปต่างประเทศ',
        descriptionEN: 'Cultivation intended for export and international distribution.',
        documents: M1_DOCUMENT_SET,
    },
];

export const CULTIVATION_OPTIONS: CultivationOption[] = [
    {
        id: 'outdoor',
        labelTH: 'กลางแจ้ง',
        labelEN: 'Outdoor',
        descriptionTH: 'ปลูกบนแปลงเปิด ใช้สภาพแวดล้อมธรรมชาติ',
        descriptionEN: 'Open-field cultivation with natural environment conditions.',
    },
    {
        id: 'greenhouse',
        labelTH: 'โรงเรือน',
        labelEN: 'Greenhouse',
        descriptionTH: 'ปลูกในโรงเรือน ควบคุมสภาพแวดล้อมบางส่วน',
        descriptionEN: 'Semi-controlled greenhouse cultivation setup.',
    },
    {
        id: 'indoor',
        labelTH: 'อาคาร/โรงเรือนระบบปิด',
        labelEN: 'Indoor controlled',
        descriptionTH: 'ปลูกในอาคารควบคุมแสง อุณหภูมิ และความชื้น',
        descriptionEN: 'Fully controlled indoor cultivation environment.',
    },
];

export const PURPOSE_DOCUMENT_SET = new Set<PurposeDocumentType>(
    PURPOSE_OPTIONS.flatMap((option) => option.documents.map((document) => document.type)),
);

/**
 * slug ของวิซาร์ด → รหัสในทะเบียนพืช (`plant_species.code`)
 *
 * คำศัพท์สองชุดนี้ผูกกันอยู่แล้วที่ `apps/backend/config/plant-species-slugs.js` ซึ่งเอกสาร
 * ของมันเขียนเองว่าเป็น "the one place the two vocabularies meet" · ฝั่งเบราว์เซอร์เรียก
 * ไฟล์นั้นไม่ได้ จึงมีสำเนาไว้ที่นี่ และผูกให้ตรงกันด้วยเทสที่อ่านไฟล์ฝั่งหลังบ้านเป็นข้อความ
 * (`health/planting/new/__tests__/the-plant-picked-is-the-plant-meant.test.ts`) —
 * สำนวนเดียวกับที่ `plant-slug-map-covers-the-wizard.test.js` ใช้อยู่แล้วฝั่งหลังบ้าน
 *
 * ทำไมถึงต้องมี: หน้าสร้างรอบปลูกเคยเทียบ `plant.code === 'cannabis'` กับสิ่งที่ประตู
 * `/api/plants` คืนมา ซึ่งคือรหัสทะเบียน `CAN` ⇒ เงื่อนไขไม่มีวันจริง และหน้าจอเลือก
 * แถวแรกของทะเบียนให้เสมอ (บังเอิญเป็นกัญชาอยู่ จึงไม่มีใครเห็น)
 */
export const PLANT_MASTER_CODE: Record<PlantId, string> = {
    cannabis: 'CAN',
    kratom: 'KRA',
    turmeric: 'TUR',
    ginger: 'GIN',
    plai: 'PLA',
    black_galangal: 'GAL',
};

export const PLANT_CODE_ALIAS: Record<string, PlantId> = {
    cannabis: 'cannabis',
    kratom: 'kratom',
    turmeric: 'turmeric',
    ginger: 'ginger',
    plai: 'plai',
    black_galangal: 'black_galangal',
    black_galingale: 'black_galangal',
    bsd: 'black_galangal',
};

// Re-export from Single Source of Truth (constants/fees.ts)
//
// W12 (2026-08-22) — this alias pointed at GACP_RENEWAL_FEE. Its consumer,
// plant-selection-step.tsx:140, multiplies it by the cultivation-method count
// to estimate a NEW application, which is phase 1 + phase 2 per method
// (5,000 + 25,000), not the certificate RENEWAL fee. Both are 30,000 today, so
// the estimate was right by coincidence. The operator has now set the renewal
// fee as a single charge in its own right (business-rules.js
// FEES.RENEWAL_PER_CERT), free to move on its own, which turns that
// coincidence into a live drift hazard: the next renewal-fee change would
// silently move a new application's quote. Value unchanged; pinned by
// src/__tests__/renewal-fee-display.test.ts.
export { GACP_PER_TYPE_TOTAL as CULTIVATION_FEE_PER_METHOD } from '@/constants/fees';

export const APPLICATION_FLOW_STEPS: ApplicationFlowStep[] = [
    {
        key: 'profile',
        labelTH: 'กำหนดข้อมูลคำขอ',
        labelEN: 'Application profile',
        descriptionTH: 'เลือกพืช ประเภทบริการ วัตถุประสงค์ และรูปแบบการปลูก',
        descriptionEN: 'Select herb, service type, purpose, and cultivation methods.',
    },
    {
        key: 'farm',
        labelTH: 'ฟาร์มและแปลงปลูก',
        labelEN: 'Farm and plots',
        descriptionTH: 'ข้อมูลฟาร์ม ที่อยู่ แปลงปลูก ที่ดิน และแหล่งน้ำ',
        descriptionEN: 'Farm location, plots, land documents, and water sources.',
    },
    {
        key: 'cultivation',
        labelTH: 'การเพาะปลูก',
        labelEN: 'Cultivation',
        descriptionTH: 'ที่มาพันธุ์ วิธีปลูก ดิน ระยะปลูก ปุ๋ย/สาร',
        descriptionEN: 'Seed sources, propagation, soil, spacing, and inputs.',
    },
    {
        key: 'harvest',
        labelTH: 'เก็บเกี่ยวและคุณภาพ',
        labelEN: 'Harvest and quality',
        descriptionTH: 'วิธีเก็บเกี่ยว อบแห้ง บ่ม จัดเก็บ บรรจุ มาตรการ GACP',
        descriptionEN: 'Harvest method, drying, curing, storage, packaging, QC checks.',
    },
    {
        key: 'documents',
        labelTH: 'แนบเอกสารประกอบ',
        labelEN: 'Attach documents',
        descriptionTH: 'อัปโหลดเอกสาร M1 และเอกสารภาคบังคับให้ครบ',
        descriptionEN: 'Upload M1 forms and all mandatory attachments.',
    },
    {
        key: 'review',
        labelTH: 'ตรวจทานและส่ง',
        labelEN: 'Review and submit',
        descriptionTH: 'ตรวจสอบข้อมูล ยืนยัน และส่งคำขอเข้าสู่ระบบ',
        descriptionEN: 'Review, confirm, and submit application.',
    },
    {
        key: 'payment',
        labelTH: 'ชำระค่าธรรมเนียม',
        labelEN: 'Payment and tracking',
        descriptionTH: 'ชำระงวดแรก ติดตามสถานะ และรับแจ้งเตือนขั้นตอนถัดไป',
        descriptionEN: 'Pay phase 1 fee and track next required actions.',
    },
];

// HELPERS

export function getLocalizedText(language: 'th' | 'en', th: string, en: string) {
    return language === 'en' ? en : th;
}

export function toPlantCode(code?: string | null): PlantId | null {
    if (!code) {
        return null;
    }
    const normalized = String(code).trim().toLowerCase();
    return PLANT_CODE_ALIAS[normalized] || null;
}

export function buildPurposeDocumentState(documents: DocumentUpload[]) {
    const result = {} as Record<PurposeDocumentType, PurposeDocumentState>;

    for (const document of documents || []) {
        const type = String(document?.type || document?.id || '').trim() as PurposeDocumentType;
        if (!PURPOSE_DOCUMENT_SET.has(type)) {
            continue;
        }

        result[type] = {
            name: document.name || type,
            url: document.url,
            uploaded: Boolean(document.uploaded),
            required: Boolean((document.metadata as Record<string, unknown>)?.required),
        };
    }

    return result;
}
