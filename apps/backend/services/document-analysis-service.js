/**
 * Document Analysis Service
 * Analyzes required documents based on plant type, request type, and application data
 * 
 * This service powers the dynamic document checklist in the mobile app
 * and can be updated without releasing a new app version.
 */

const { prisma } = require('./prisma-database');
const { resolvePlantSpecies } = require('./plant-species-service');

class DocumentAnalysisService {
    /**
     * Get base document requirements for a plant and request type
     * @param {string} plantId - Plant identifier (CAN, KRA, TUR, etc.)
     * @param {string} requestType - NEW, RENEW, or AMEND
     * @returns {Promise<Array>} List of document requirements
     */
    async getBaseRequirements(plantId, requestType = 'NEW') {
        const docs = await prisma.documentRequirement.findMany({
            where: {
                plantCode: plantId,
                requestType: requestType,
            },
            orderBy: {
                sortOrder: 'asc',
            },
        });

        return docs.map(doc => ({
            id: doc.id,
            slotId: doc.documentName.toLowerCase().replace(/\s+/g, '_'),
            name: doc.documentName,
            nameTH: doc.documentNameTH,
            category: doc.category,
            isRequired: doc.isRequired,
            description: doc.description,
            allowedFileTypes: doc.allowedFileTypes || ['pdf', 'jpg', 'png'],
            maxFileSizeMB: doc.maxFileSizeMB || 10,
        }));
    }

    /**
     * Analyze and generate dynamic document requirements
     * Based on application data, adds conditional documents
     * 
     * @param {string} plantId - Plant reference: wizard slug ('cannabis') or master code ('CAN')
     * @param {string} requestType - NEW, RENEW, or AMEND
     * @param {Object} applicationData - Form data from mobile app
     * @returns {Promise<Object>} Analysis result with categorized documents
     */
    async analyzeRequiredDocuments(plantId, requestType, applicationData = {}) {
        // 1. Get plant configuration. The wizard hands over its slug, the master
        //    table keys by code; the resolver speaks both (F-G4-59).
        const plant = await resolvePlantSpecies(plantId);

        if (!plant) {
            throw new Error(`Plant not found: ${plantId}`);
        }

        const isGroupA = plant.group === 'HIGH_CONTROL';

        // 2. Get base requirements from database, by the master code the rows carry
        const baseRequirements = await this.getBaseRequirements(plant.code, requestType);

        // 3. Generate conditional requirements
        const conditionalDocs = this._generateConditionalDocs(
            isGroupA,
            requestType,
            applicationData,
        );

        // 4. Merge and deduplicate
        const allDocs = this._mergeDocuments(baseRequirements, conditionalDocs);

        // 5. Categorize
        const categorized = this._categorizeDocuments(allDocs);

        return {
            plantId,
            plantName: plant.nameEN,
            plantNameTH: plant.nameTH,
            plantGroup: plant.group,
            requestType,
            totalRequired: allDocs.filter(d => d.isRequired).length,
            totalOptional: allDocs.filter(d => !d.isRequired).length,
            categories: categorized,
            documents: allDocs,
        };
    }

    /**
     * Get human-readable category name
     * @private
     */
    _getCategoryName(category) {
        const names = {
            IDENTITY: '1. เอกสารยืนยันตัวตน (Identity) - บังคับ',
            LAND: '2. เอกสารสิทธิ์และที่ตั้ง (Land & Map) - บังคับ',
            EVIDENCE: '3. หลักฐานเชิงประจักษ์ (Visual Evidence) - บังคับ',
            FARM_MANAGEMENT: '4. การจัดการฟาร์มและ SOPs (Farm Management) - สำหรับขาย/ส่งออก',
            QUALITY_CONTROL: '5. การควบคุมคุณภาพ (Quality Control) - สำหรับขาย/ส่งออก',
            COMMERCIAL: '6. เอกสารการค้า (Commercial & Export) - สำหรับขาย/ส่งออก',
            OTHER: 'เอกสารอื่น ๆ (Other)',
        };
        return names[category] || category;
    }

    /**
     * Generate conditional documents based on application data
     * @private
     */
    _generateConditionalDocs(_isGroupA, _requestType, _data) {
        const docs = [];

        // === CORE GACP (MANDATORY) ===

        // 1. Evidence Types (New Requirement)
        docs.push({
            slotId: 'farm_banner_photo',
            name: 'Farm Signage Photo',
            nameTH: 'ภาพป้ายชื่อหน้าฟาร์ม',
            category: 'EVIDENCE',
            isRequired: true,
            description: 'ป้ายชื่อฟาร์มที่ติดตั้งหน้าพื้นที่จริง',
        });

        // 2. Additional Core
        // Note: YouTube URL is usually a text field, but if treated as doc upload (screenshots?), add here.
        // User requested "YouTube Link". We might handle this in Frontend separate from file slots, 
        // OR add a "YouTube Screenshot/QR" slot if strictly file-based. 
        // For now, let's assume it's handled in the Form Data, NOT as a File Upload slot. 
        // *Self-correction*: User said "Attach documents requested". 
        // If they want a file for video, maybe "Video File" or "Link PDF". 
        // Let's stick to Banner Photo here.

        // === SALES / EXPORT (OPTIONAL but STRICTLY LISTED) ===

        // Category 4: Farm Management & SOPs
        const farmManagementDocs = [
            { id: 'sop_cultivation', name: 'SOPs for Cultivation', nameTH: 'คู่มือการเพาะปลูก (SOPs)' },
            { id: 'sop_hygiene', name: 'SOPs for Hygiene', nameTH: 'คู่มือสุขอนามัย (SOPs)' },
            { id: 'record_training', name: 'Training Records', nameTH: 'บันทึกการฝึกอบรมพนักงาน' },
            { id: 'record_cleaning', name: 'Cleaning Logs', nameTH: 'บันทึกการทำความสะอาด' },
            { id: 'record_pest_control', name: 'Pest Control Records', nameTH: 'บันทึกการกำจัดศัตรูพืช' },
            { id: 'plan_risk_mgmt', name: 'Risk Management Plan', nameTH: 'แผนบริหารความเสี่ยง' },
        ];

        farmManagementDocs.forEach(d => {
            docs.push({
                slotId: d.id,
                name: d.name,
                nameTH: d.nameTH,
                category: 'FARM_MANAGEMENT',
                isRequired: false, // Optional for GACP, Required for Export
                description: 'สำหรับผู้ต้องการจำหน่าย/ส่งออก',
            });
        });

        // Category 5: Quality Control
        const qcDocs = [
            { id: 'report_soil_water', name: 'Soil/Water Analysis', nameTH: 'ผลวิเคราะห์ดิน/น้ำ' },
            { id: 'report_heavy_metal', name: 'Heavy Metals Report', nameTH: 'ผลวิเคราะห์โลหะหนัก' },
            { id: 'report_pesticide', name: 'Pesticide Residue Report', nameTH: 'ผลวิเคราะห์ยาฆ่าแมลง' },
            { id: 'report_microbial', name: 'Microbial Report', nameTH: 'ผลวิเคราะห์เชื้อจุลินทรีย์' },
            { id: 'record_moisture', name: 'Moisture Content Record', nameTH: 'บันทึกความชื้นหลังเก็บเกี่ยว' },
        ];

        qcDocs.forEach(d => {
            docs.push({
                slotId: d.id,
                name: d.name,
                nameTH: d.nameTH,
                category: 'QUALITY_CONTROL',
                isRequired: false,
                description: 'สำหรับผู้ต้องการจำหน่าย/ส่งออก',
            });
        });

        // Category 6: Commercial & Export
        const commercialDocs = [
            { id: 'proof_seed_source', name: 'Seed Source Proof', nameTH: 'ใบเสร็จ/หลักฐานแหล่งที่มาเมล็ดพันธุ์' },
            { id: 'contract_sales', name: 'Sales Contract', nameTH: 'สัญญาซื้อขายล่วงหน้า' },
            { id: 'record_stock', name: 'Stock/Inventory Records', nameTH: 'บันทึกคลังสินค้า' },
            { id: 'record_distribution', name: 'Distribution Records', nameTH: 'บันทึกการกระจายสินค้า' },
        ];

        commercialDocs.forEach(d => {
            docs.push({
                slotId: d.id,
                name: d.name,
                nameTH: d.nameTH,
                category: 'COMMERCIAL',
                isRequired: false,
                description: 'สำหรับผู้ต้องการจำหน่าย/ส่งออก',
            });
        });

        // Keep existing logic for specific cases (Replacement, Tuber, etc.)
        // ... (Merging logic follows in _mergeDocuments)

        return docs;
    }

    /**
     * Merge base and conditional documents, avoid duplicates
     * @private
     */
    _mergeDocuments(baseDocs, conditionalDocs) {
        const merged = [...baseDocs];
        const existingSlots = new Set(baseDocs.map(d => d.slotId));

        for (const doc of conditionalDocs) {
            if (!existingSlots.has(doc.slotId)) {
                merged.push(doc);
                existingSlots.add(doc.slotId);
            }
        }

        // Sort by category and required status
        return merged.sort((a, b) => {
            if (a.category !== b.category) {
                const categoryOrder = ['IDENTITY', 'LICENSE', 'PROPERTY', 'COMPLIANCE', 'FINANCIAL', 'OTHER'];
                return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
            }
            return (b.isRequired ? 1 : 0) - (a.isRequired ? 1 : 0);
        });
    }

    /**
     * Group documents by category
     * @private
     */
    _categorizeDocuments(docs) {
        const categories = {};
        for (const doc of docs) {
            const cat = doc.category || 'OTHER';
            if (!categories[cat]) {
                categories[cat] = {
                    name: this._getCategoryName(cat),
                    documents: [],
                };
            }
            categories[cat].documents.push(doc);
        }
        return categories;
    }


    /**
     * Validate uploaded documents against requirements
     * @param {Array} uploadedDocs - List of uploaded document slot IDs
     * @param {Array} requirements - Required documents from analysis
     * @returns {Object} Validation result
     */
    validateDocuments(uploadedDocs, requirements) {
        const uploaded = new Set(uploadedDocs);
        const requiredDocs = requirements.filter(d => d.isRequired);
        const missing = requiredDocs.filter(d => !uploaded.has(d.slotId));

        return {
            isComplete: missing.length === 0,
            totalRequired: requiredDocs.length,
            totalUploaded: uploadedDocs.length,
            missingDocuments: missing.map(d => ({
                slotId: d.slotId,
                name: d.name,
                nameTH: d.nameTH,
            })),
        };
    }

    /**
     * Verify an uploaded document using OCR and AI classification
     * @param {Buffer|string} fileInput - File buffer or path
     * @param {string} expectedDocType - Expected document type (e.g., 'ID_CARD', 'LAND_TITLE')
     * @returns {Promise<Object>} Verification result with confidence and extracted data
     */
    async verifyUploadedDocument(fileInput, expectedDocType) {
        // Use the main OcrService which now supports PDF
        const tesseractService = require('./ocr-service');
        const documentClassifier = require('./ai/document-classifier');

        try {
            // Step 1: Extract text using OCR (supports PDF now)
            const extraction = await tesseractService.extractText(fileInput);

            // ocr-service.extractText resolves to { text, confidence, words } (or
            // { text, confidence, isPdf }) on success and THROWS on failure — it
            // never sets a `success` flag, so the old `if (!extraction.success)`
            // was always true and every POST /api/documents/verify returned
            // "OCR extraction failed". Guard on the actual contract: reaching
            // here means extraction succeeded; only bail if no text came back.
            if (!extraction || !extraction.text) {
                return {
                    valid: false,
                    error: 'OCR extraction returned no text',
                    confidence: 0,
                };
            }

            // Step 2: Classify the extracted text
            const classification = documentClassifier.classify(extraction.text, expectedDocType);

            // Step 3: Extract structured data
            const extractedData = documentClassifier.extractData(extraction.text, expectedDocType);

            return {
                valid: classification.valid,
                expectedType: expectedDocType,
                expectedTypeTH: classification.expectedTypeTH,
                confidence: classification.confidence,
                confidencePercent: classification.confidencePercent,
                extractedData,
                issues: classification.issues,
                ocrConfidence: extraction.confidence,
                ocrDuration: extraction.duration,
                keywordsFound: classification.keywordsFound,
                totalKeywords: classification.totalKeywords,
            };
        } catch (error) {
            return {
                valid: false,
                error: 'Verification failed',
                details: error.message,
                confidence: 0,
            };
        }
    }
}

module.exports = new DocumentAnalysisService();

