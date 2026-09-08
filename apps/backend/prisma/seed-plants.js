/**
 * Seed Script: PlantMaster and DocumentRequirement (Prisma Version)
 * Run: npx prisma db seed (or node prisma/seed-plants.js)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// PLANT DATA

const plantsData = [
    // ==================== GROUP A: HIGH CONTROL ====================
    {
        code: 'CAN',
        nameEN: 'Cannabis',
        nameTH: 'กัญชา',
        group: 'HIGH_CONTROL',
        requiresLicense: true,
        units: ['ต้น', 'Tree'],
        plantParts: ['ช่อดอก (Flower)', 'ใบ (Leaf)', 'เมล็ด (Seed)', 'ลำต้น (Stem)'],
        securityRequirements: [
            { label: 'CCTV 24/7 (Medical Grade)', required: true, description: 'กล้องวงจรปิดบันทึก 24 ชม.' },
            { label: 'รั้วแข็งแรง ≥2 เมตร', required: true, description: 'High Security Fence' },
            { label: 'สมุดลงชื่อเข้า-ออก', required: true, description: 'Access Log Book' },
            { label: 'Biometric/Key Card Access', required: true, description: 'ระบบสแกนนิ้ว/บัตร' },
            { label: 'เจ้าหน้าที่รักษาความปลอดภัย', required: false, description: 'Security Guard (Optional)' },
        ],
        productionInputs: [
            { fieldName: 'treeCount', fieldType: 'number', label: 'จำนวนต้น (Tree Count)', required: true },
            { fieldName: 'harvestCycle', fieldType: 'text', label: 'รอบการเก็บเกี่ยว (Harvest Cycle)', required: true },
            { fieldName: 'estimatedYield', fieldType: 'number', label: 'ผลผลิตโดยประมาณ (กก./รอบ)', required: true },
            { fieldName: 'licenseType', fieldType: 'select', label: 'ประเภทใบอนุญาต', required: true, options: ['BhT 11', 'BhT 13', 'BhT 16'] },
            { fieldName: 'licenseNumber', fieldType: 'text', label: 'เลขที่ใบอนุญาต', required: true },
            { fieldName: 'licenseExpiry', fieldType: 'text', label: 'วันหมดอายุใบอนุญาต', required: true },
        ],
        sortOrder: 1,
        isActive: true,
    },
    {
        code: 'KRA',
        nameEN: 'Kratom',
        nameTH: 'กระท่อม',
        group: 'HIGH_CONTROL',
        requiresLicense: true,
        units: ['ต้น', 'Tree'],
        plantParts: ['ใบสด (Fresh Leaf)', 'ใบแห้ง (Dried Leaf)', 'ผง (Powder)'],
        securityRequirements: [
            { label: 'CCTV', required: true, description: 'กล้องวงจรปิด' },
            { label: 'รั้วแข็งแรง', required: true, description: 'Security Fence' },
            { label: 'สมุดลงชื่อเข้า-ออก', required: true, description: 'Access Log Book' },
            { label: 'Biometric Access', required: false, description: 'ระบบสแกนนิ้ว (Optional)' },
        ],
        productionInputs: [
            { fieldName: 'treeCount', fieldType: 'number', label: 'จำนวนต้น (Tree Count)', required: true },
            { fieldName: 'harvestCycle', fieldType: 'text', label: 'รอบการเก็บเกี่ยว (ทุก 2-3 เดือน)', required: true },
            { fieldName: 'estimatedYield', fieldType: 'number', label: 'ผลผลิตโดยประมาณ (กก./รอบ)', required: true },
            { fieldName: 'licenseNumber', fieldType: 'text', label: 'เลขที่ใบอนุญาต', required: true },
        ],
        sortOrder: 2,
        isActive: true,
    },

    // ==================== GROUP B: GENERAL HERBS ====================
    {
        code: 'TUR',
        nameEN: 'Turmeric',
        nameTH: 'ขมิ้นชัน',
        group: 'GENERAL',
        requiresLicense: false,
        units: ['ไร่', 'Rai'],
        plantParts: ['เหง้า (Rhizome)', 'ผง (Powder)', 'น้ำมันหอมระเหย (Essential Oil)'],
        securityRequirements: [
            { label: 'รั้วกั้นสัตว์', required: true, description: 'Animal Barrier' },
            { label: 'ป้ายบ่งเขตแปลง', required: true, description: 'Zoning Markers' },
            { label: 'รั้วธรรมดา', required: false, description: 'Basic Fence (Optional)' },
        ],
        productionInputs: [
            { fieldName: 'areaSizeRai', fieldType: 'number', label: 'ขนาดพื้นที่ (ไร่)', required: true },
            { fieldName: 'seedlingPerRai', fieldType: 'number', label: 'จำนวนต้นพันธุ์ (กก./ไร่)', required: false },
            { fieldName: 'harvestCycle', fieldType: 'text', label: 'รอบการเก็บเกี่ยว (8-10 เดือน)', required: true },
            { fieldName: 'estimatedYield', fieldType: 'number', label: 'ผลผลิตโดยประมาณ (กก./ไร่/ปี)', required: true },
            { fieldName: 'hasGapCert', fieldType: 'checkbox', label: 'มีใบรับรอง GAP', required: false },
            { fieldName: 'hasOrganicCert', fieldType: 'checkbox', label: 'มีใบรับรอง Organic', required: false },
        ],
        sortOrder: 3,
        isActive: true,
    },
    {
        code: 'GIN',
        nameEN: 'Ginger',
        nameTH: 'ขิง',
        group: 'GENERAL',
        requiresLicense: false,
        units: ['ไร่', 'Rai'],
        plantParts: ['เหง้าสด (Fresh Rhizome)', 'เหง้าแห้ง (Dried Rhizome)', 'ผง (Powder)'],
        securityRequirements: [
            { label: 'รั้วกั้นสัตว์', required: true, description: 'Animal Barrier' },
            { label: 'ป้ายบ่งเขตแปลง', required: true, description: 'Zoning Markers' },
        ],
        productionInputs: [
            { fieldName: 'areaSizeRai', fieldType: 'number', label: 'ขนาดพื้นที่ (ไร่)', required: true },
            { fieldName: 'seedlingPerRai', fieldType: 'number', label: 'จำนวนต้นพันธุ์ (กก./ไร่)', required: false },
            { fieldName: 'harvestCycle', fieldType: 'text', label: 'รอบการเก็บเกี่ยว (8-12 เดือน)', required: true },
            { fieldName: 'estimatedYield', fieldType: 'number', label: 'ผลผลิตโดยประมาณ (กก./ไร่/ปี)', required: true },
        ],
        sortOrder: 4,
        isActive: true,
    },
    {
        code: 'GAL',
        nameEN: 'Black Galingale',
        nameTH: 'กระชายดำ',
        group: 'GENERAL',
        requiresLicense: false,
        units: ['ไร่', 'Rai'],
        plantParts: ['เหง้า (Rhizome)', 'ผง (Powder)', 'สารสกัด (Extract)'],
        securityRequirements: [
            { label: 'รั้วกั้นสัตว์', required: true, description: 'Animal Barrier' },
            { label: 'ป้ายบ่งเขตแปลง', required: true, description: 'Zoning Markers' },
        ],
        productionInputs: [
            { fieldName: 'areaSizeRai', fieldType: 'number', label: 'ขนาดพื้นที่ (ไร่)', required: true },
            { fieldName: 'bulbsPerRai', fieldType: 'number', label: 'จำนวนหัว/ไร่', required: false },
            { fieldName: 'harvestCycle', fieldType: 'text', label: 'รอบการเก็บเกี่ยว (10-12 เดือน)', required: true },
            { fieldName: 'estimatedYield', fieldType: 'number', label: 'ผลผลิตโดยประมาณ (กก./ไร่/ปี)', required: true },
        ],
        sortOrder: 5,
        isActive: true,
    },
    {
        code: 'PLA',
        nameEN: 'Plai',
        nameTH: 'ไพล',
        group: 'GENERAL',
        requiresLicense: false,
        units: ['ไร่', 'Rai'],
        plantParts: ['เหง้าสด (Fresh Rhizome)', 'น้ำมันหอมระเหย (Essential Oil)', 'สารสกัด (Extract)'],
        securityRequirements: [
            { label: 'รั้วกั้นสัตว์', required: true, description: 'Animal Barrier' },
            { label: 'ป้ายบ่งเขตแปลง', required: true, description: 'Zoning Markers' },
        ],
        productionInputs: [
            { fieldName: 'areaSizeRai', fieldType: 'number', label: 'ขนาดพื้นที่ (ไร่)', required: true },
            { fieldName: 'seedlingPerRai', fieldType: 'number', label: 'จำนวนต้นพันธุ์ (กก./ไร่)', required: false },
            { fieldName: 'harvestCycle', fieldType: 'text', label: 'รอบการเก็บเกี่ยว (8-12 เดือน)', required: true },
            { fieldName: 'estimatedYield', fieldType: 'number', label: 'ผลผลิตโดยประมาณ (กก./ไร่/ปี)', required: true },
        ],
        sortOrder: 6,
        isActive: true,
    },
];

// DOCUMENT REQUIREMENTS DATA

const documentsData = [
    // ==================== CANNABIS (CAN) DOCUMENTS ====================
    // Route A: New Application
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'BhT License', documentNameTH: 'ใบอนุญาต BhT 11/13/16', category: 'LICENSE', isRequired: true, sortOrder: 1 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง/พิกัด GPS', category: 'PROPERTY', isRequired: true, sortOrder: 3 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Building Plan', documentNameTH: 'แบบแปลนโรงเรือน', category: 'PROPERTY', isRequired: true, sortOrder: 4 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Exterior Photos', documentNameTH: 'ภาพถ่ายภายนอก', category: 'PROPERTY', isRequired: true, sortOrder: 5 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Interior Photos', documentNameTH: 'ภาพถ่ายภายใน', category: 'PROPERTY', isRequired: true, sortOrder: 6 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'CCTV Plan', documentNameTH: 'แผนผังกล้อง CCTV', category: 'COMPLIANCE', isRequired: true, sortOrder: 7 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Security Measures', documentNameTH: 'มาตรการรักษาความปลอดภัย', category: 'COMPLIANCE', isRequired: true, sortOrder: 8 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'SOP Document', documentNameTH: 'เอกสาร SOP', category: 'COMPLIANCE', isRequired: true, sortOrder: 9, description: 'ต้องครอบคลุม: เพาะ, เก็บเกี่ยว, ทำแห้ง, ทริม, บรรจุ, จัดเก็บ, กำจัดของเสีย' },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Production Plan', documentNameTH: 'แผนการผลิต', category: 'COMPLIANCE', isRequired: true, sortOrder: 10 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'CP/CCP Analysis', documentNameTH: 'ตารางวิเคราะห์ CP/CCP', category: 'COMPLIANCE', isRequired: true, sortOrder: 11 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Lab Result - Soil', documentNameTH: 'ผลตรวจวัสดุปลูก', category: 'OTHER', isRequired: true, sortOrder: 12 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Lab Result - Water', documentNameTH: 'ผลตรวจน้ำ', category: 'OTHER', isRequired: true, sortOrder: 13 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Lab Result - Flower', documentNameTH: 'ผลตรวจช่อดอก', category: 'OTHER', isRequired: true, sortOrder: 14 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'GACP Training Cert', documentNameTH: 'หนังสือรับรองอบรม GACP', category: 'OTHER', isRequired: true, sortOrder: 15 },
    { plantCode: 'CAN', requestType: 'NEW', documentName: 'Video Link', documentNameTH: 'ลิงค์วิดีโอสถานที่', category: 'OTHER', isRequired: false, sortOrder: 16 },

    // Route B: Renewal
    { plantCode: 'CAN', requestType: 'RENEW', documentName: 'Original Certificate', documentNameTH: 'ต้นฉบับใบรับรองเก่า', category: 'LICENSE', isRequired: true, sortOrder: 1 },
    { plantCode: 'CAN', requestType: 'RENEW', documentName: 'Performance Report', documentNameTH: 'รายงานผลการดำเนินงาน', category: 'COMPLIANCE', isRequired: true, sortOrder: 2 },
    { plantCode: 'CAN', requestType: 'RENEW', documentName: 'Updated SOP', documentNameTH: 'SOP ฉบับปรับปรุง (ถ้ามี)', category: 'COMPLIANCE', isRequired: false, sortOrder: 3 },
    { plantCode: 'CAN', requestType: 'RENEW', documentName: 'Current Lab Results', documentNameTH: 'ผลตรวจวิเคราะห์ปัจจุบัน', category: 'OTHER', isRequired: true, sortOrder: 4 },

    // Route C: Replacement (AMEND)
    { plantCode: 'CAN', requestType: 'AMEND', documentName: 'Police Report', documentNameTH: 'ใบแจ้งความ (กรณีสูญหาย)', category: 'OTHER', isRequired: false, sortOrder: 1, description: 'จำเป็นเฉพาะกรณีสูญหาย' },
    { plantCode: 'CAN', requestType: 'AMEND', documentName: 'Damaged Cert Photo', documentNameTH: 'ภาพถ่ายใบรับรองเดิม (กรณีชำรุด)', category: 'OTHER', isRequired: false, sortOrder: 2, description: 'จำเป็นเฉพาะกรณีชำรุด' },

    // ==================== KRATOM (KRA) DOCUMENTS ====================
    // Similar to Cannabis
    { plantCode: 'KRA', requestType: 'NEW', documentName: 'License', documentNameTH: 'ใบอนุญาต', category: 'LICENSE', isRequired: true, sortOrder: 1 },
    { plantCode: 'KRA', requestType: 'NEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'KRA', requestType: 'NEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง', category: 'PROPERTY', isRequired: true, sortOrder: 3 },
    { plantCode: 'KRA', requestType: 'NEW', documentName: 'SOP', documentNameTH: 'เอกสาร SOP', category: 'COMPLIANCE', isRequired: true, sortOrder: 4 },
    { plantCode: 'KRA', requestType: 'NEW', documentName: 'Strain Certificate', documentNameTH: 'หนังสือรับรองสายพันธุ์', category: 'OTHER', isRequired: true, sortOrder: 5 },

    // ==================== TURMERIC (TUR) DOCUMENTS ====================
    { plantCode: 'TUR', requestType: 'NEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 1 },
    { plantCode: 'TUR', requestType: 'NEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'TUR', requestType: 'NEW', documentName: 'Basic SOP', documentNameTH: 'SOP พื้นฐาน', category: 'COMPLIANCE', isRequired: true, sortOrder: 3 },
    { plantCode: 'TUR', requestType: 'NEW', documentName: 'Soil/Water Analysis', documentNameTH: 'ผลวิเคราะห์ดิน/น้ำ', category: 'OTHER', isRequired: false, sortOrder: 4 },
    { plantCode: 'TUR', requestType: 'NEW', documentName: 'GAP Certificate', documentNameTH: 'ใบรับรอง GAP', category: 'OTHER', isRequired: false, sortOrder: 5, description: 'Optional - if available' },
    { plantCode: 'TUR', requestType: 'NEW', documentName: 'Organic Certificate', documentNameTH: 'ใบรับรอง Organic', category: 'OTHER', isRequired: false, sortOrder: 6, description: 'Optional - if available' },
    { plantCode: 'TUR', requestType: 'RENEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 1 },
    { plantCode: 'TUR', requestType: 'RENEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'TUR', requestType: 'RENEW', documentName: 'Basic SOP', documentNameTH: 'SOP พื้นฐาน', category: 'COMPLIANCE', isRequired: true, sortOrder: 3 },

    // ==================== GINGER (GIN) DOCUMENTS ====================
    { plantCode: 'GIN', requestType: 'NEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 1 },
    { plantCode: 'GIN', requestType: 'NEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'GIN', requestType: 'NEW', documentName: 'Basic SOP', documentNameTH: 'SOP พื้นฐาน', category: 'COMPLIANCE', isRequired: true, sortOrder: 3 },
    { plantCode: 'GIN', requestType: 'NEW', documentName: 'GAP Certificate', documentNameTH: 'ใบรับรอง GAP', category: 'OTHER', isRequired: false, sortOrder: 4 },
    { plantCode: 'GIN', requestType: 'RENEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 1 },
    { plantCode: 'GIN', requestType: 'RENEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'GIN', requestType: 'RENEW', documentName: 'Basic SOP', documentNameTH: 'SOP พื้นฐาน', category: 'COMPLIANCE', isRequired: true, sortOrder: 3 },

    // ==================== BLACK GALINGALE (GAL) DOCUMENTS ====================
    { plantCode: 'GAL', requestType: 'NEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 1 },
    { plantCode: 'GAL', requestType: 'NEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'GAL', requestType: 'NEW', documentName: 'Basic SOP', documentNameTH: 'SOP พื้นฐาน', category: 'COMPLIANCE', isRequired: true, sortOrder: 3 },
    { plantCode: 'GAL', requestType: 'RENEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 1 },
    { plantCode: 'GAL', requestType: 'RENEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'GAL', requestType: 'RENEW', documentName: 'Basic SOP', documentNameTH: 'SOP พื้นฐาน', category: 'COMPLIANCE', isRequired: true, sortOrder: 3 },

    // ==================== PLAI (PLA) DOCUMENTS ====================
    { plantCode: 'PLA', requestType: 'NEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 1 },
    { plantCode: 'PLA', requestType: 'NEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'PLA', requestType: 'NEW', documentName: 'Basic SOP', documentNameTH: 'SOP พื้นฐาน', category: 'COMPLIANCE', isRequired: true, sortOrder: 3 },
    { plantCode: 'PLA', requestType: 'RENEW', documentName: 'Land Title/Lease', documentNameTH: 'โฉนด/สัญญาเช่า', category: 'PROPERTY', isRequired: true, sortOrder: 1 },
    { plantCode: 'PLA', requestType: 'RENEW', documentName: 'Site Map', documentNameTH: 'แผนที่ตั้ง', category: 'PROPERTY', isRequired: true, sortOrder: 2 },
    { plantCode: 'PLA', requestType: 'RENEW', documentName: 'Basic SOP', documentNameTH: 'SOP พื้นฐาน', category: 'COMPLIANCE', isRequired: true, sortOrder: 3 },
];

async function main() {
    try {
        console.log('Seeding PlantMaster data to Prisma...');

        // 1. Seed Plants (Upsert)
        for (const plant of plantsData) {
            await prisma.plantSpecies.upsert({
                where: { code: plant.code },
                update: {
                    nameTH: plant.nameTH,
                    nameEN: plant.nameEN,
                    group: plant.group,
                    requiresLicense: plant.requiresLicense,
                    units: plant.units,
                    plantParts: plant.plantParts,
                    securityRequirements: plant.securityRequirements,
                    productionInputs: plant.productionInputs,
                    sortOrder: plant.sortOrder,
                    isActive: plant.isActive,
                    gacpCategory: plant.group === 'HIGH_CONTROL' ? 'HIGH_CONTROL' : 'MEDICINAL',
                },
                create: {
                    code: plant.code,
                    nameTH: plant.nameTH,
                    nameEN: plant.nameEN,
                    group: plant.group,
                    requiresLicense: plant.requiresLicense,
                    units: plant.units,
                    plantParts: plant.plantParts,
                    securityRequirements: plant.securityRequirements,
                    productionInputs: plant.productionInputs,
                    sortOrder: plant.sortOrder,
                    isActive: plant.isActive,
                    gacpCategory: plant.group === 'HIGH_CONTROL' ? 'HIGH_CONTROL' : 'MEDICINAL',
                },
            });
            console.log(`Synced plant: ${plant.code}`);
        }

        console.log('Seeding DocumentRequirements to Prisma...');

        // 2. Clear existing documents for these plants
        for (const plant of plantsData) {
            await prisma.documentRequirement.deleteMany({
                where: { plantCode: plant.code },
            });
        }

        // 3. Insert Documents
        await prisma.documentRequirement.createMany({
            data: documentsData,
        });

        console.log(`Seeded ${documentsData.length} document requirements.`);

    } catch (e) {
        console.error('Seeding failed:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
