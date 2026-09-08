/**
 * AI Document Classifier
 * Rule-based document classification with confidence scoring
 * 
 * @module services/ai/document-classifier
 */

const logger = require('../../shared/logger');

/**
 * Document type definitions with expected keywords and patterns
 */
const DOCUMENT_TYPES = {
    ID_CARD: {
        nameTH: 'บัตรประจำตัวประชาชน',
        nameEN: 'National ID Card',
        requiredPatterns: [
            /\d{1}-\d{4}-\d{5}-\d{2}-\d{1}/,  // Thai ID format
        ],
        keywords: ['บัตรประจำตัว', 'identification', 'หมายเลขบัตร', 'ชื่อ-นามสกุล'],
        minConfidence: 0.7,
    },
    HOUSE_REGISTRATION: {
        nameTH: 'สำเนาทะเบียนบ้าน',
        nameEN: 'House Registration',
        requiredPatterns: [],
        keywords: ['ทะเบียนบ้าน', 'house registration', 'เลขรหัสประจำบ้าน', 'ที่อยู่'],
        minConfidence: 0.6,
    },
    LAND_TITLE: {
        nameTH: 'โฉนดที่ดิน/นส.3',
        nameEN: 'Land Title Deed',
        requiredPatterns: [],
        keywords: ['โฉนด', 'นส.3', 'เอกสารสิทธิ์', 'ที่ดิน', 'ไร่', 'งาน', 'ตารางวา'],
        minConfidence: 0.6,
    },
    FARM_LICENSE: {
        nameTH: 'ใบอนุญาตประกอบกิจการ',
        nameEN: 'Farm/Business License',
        requiredPatterns: [],
        keywords: ['ใบอนุญาต', 'permit', 'license', 'กรมการแพทย์', 'อย.'],
        minConfidence: 0.6,
    },
    MEDICAL_CERTIFICATE: {
        nameTH: 'ใบรับรองแพทย์',
        nameEN: 'Medical Certificate',
        requiredPatterns: [],
        keywords: ['ใบรับรองแพทย์', 'medical', 'โรงพยาบาล', 'แพทย์', 'สุขภาพ'],
        minConfidence: 0.6,
    },
    BANK_STATEMENT: {
        nameTH: 'สมุดบัญชีธนาคาร',
        nameEN: 'Bank Statement',
        requiredPatterns: [],
        keywords: ['ธนาคาร', 'bank', 'บัญชี', 'ยอดเงิน', 'statement'],
        minConfidence: 0.6,
    },
    PHOTO: {
        nameTH: 'รูปถ่าย',
        nameEN: 'Photograph',
        requiredPatterns: [],
        keywords: [],  // Photos don't have text, rely on image analysis
        minConfidence: 0.5,
    },
};

class DocumentClassifier {
    /**
     * Classify extracted text against an expected document type
     * @param {string} extractedText - Text from OCR
     * @param {string} expectedType - Expected document type (e.g., 'ID_CARD')
     * @returns {Object} Classification result with confidence
     */
    classify(extractedText, expectedType) {
        const docDef = DOCUMENT_TYPES[expectedType];
        if (!docDef) {
            return {
                valid: false,
                error: `Unknown document type: ${expectedType}`,
                confidence: 0,
            };
        }

        const text = extractedText.toLowerCase();
        const issues = [];
        let score = 0;
        let maxScore = 0;

        // Check required patterns
        for (const pattern of docDef.requiredPatterns) {
            maxScore += 30;
            if (pattern.test(extractedText)) {
                score += 30;
            } else {
                issues.push(`Missing required pattern: ${pattern.toString()}`);
            }
        }

        // Check keywords (5 points each, max 50)
        const keywordPoints = Math.min(docDef.keywords.length * 5, 50);
        maxScore += keywordPoints;

        let keywordsFound = 0;
        for (const keyword of docDef.keywords) {
            if (text.includes(keyword.toLowerCase())) {
                keywordsFound++;
            }
        }

        const keywordScore = docDef.keywords.length > 0
            ? (keywordsFound / docDef.keywords.length) * keywordPoints
            : keywordPoints;
        score += keywordScore;

        if (keywordsFound < docDef.keywords.length * 0.5) {
            issues.push(`Low keyword match: found ${keywordsFound}/${docDef.keywords.length}`);
        }

        // Text length check (documents should have reasonable content)
        maxScore += 20;
        if (extractedText.length > 50) {
            score += 20;
        } else if (extractedText.length > 20) {
            score += 10;
            issues.push('Document text is shorter than expected');
        } else {
            issues.push('Document text is very short or unreadable');
        }

        // Calculate confidence
        const confidence = maxScore > 0 ? score / maxScore : 0;
        const valid = confidence >= docDef.minConfidence;

        logger.info(`Document classification: ${expectedType}, confidence: ${(confidence * 100).toFixed(1)}%, valid: ${valid}`);

        return {
            valid,
            expectedType,
            expectedTypeTH: docDef.nameTH,
            expectedTypeEN: docDef.nameEN,
            confidence,
            confidencePercent: `${(confidence * 100).toFixed(1)}%`,
            score,
            maxScore,
            issues,
            keywordsFound,
            totalKeywords: docDef.keywords.length,
        };
    }

    /**
     * Extract structured data from document text
     * @param {string} extractedText - Text from OCR
     * @param {string} documentType - Document type
     * @returns {Object} Extracted data fields
     */
    extractData(extractedText, documentType) {
        const data = {};

        switch (documentType) {
            case 'ID_CARD': {
                // Extract Thai ID number
                const idMatch = extractedText.match(/\d{1}-\d{4}-\d{5}-\d{2}-\d{1}/);
                if (idMatch) {
                    data.idNumber = idMatch[0];
                }
                break;
            }

            case 'LAND_TITLE': {
                // Extract area measurements
                // Extract area measurements - Try multiple patterns
                // Pattern 1: Full Thai text (e.g., 5 ไร่ 2 งาน 30 ตารางวา)
                let areaMatch = extractedText.match(/(\d+)\s*ไร่\s*(?:(\d+)\s*งาน)?\s*(?:(\d+(?:\.\d+)?)\s*ตารางวา)?/);

                // Pattern 2: Short numeric format commonly found in tables (e.g., 5-2-30 or 5 - 2 - 30)
                if (!areaMatch) {
                    const shortMatch = extractedText.match(/เนื้อที่\s*(\d+)[\s-]*(\d+)[\s-]*(\d+(?:\.\d+)?)/);
                    if (shortMatch) {
                        areaMatch = shortMatch;
                    }
                }

                if (areaMatch) {
                    data.area = {
                        rai: parseInt(areaMatch[1]) || 0,
                        ngan: parseInt(areaMatch[2]) || 0,
                        sqWa: parseFloat(areaMatch[3]) || 0,
                    };
                }
                break;
            }

            default: {
                // Generic extraction - dates, numbers
                const dates = extractedText.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g);
                if (dates) {
                    data.dates = dates;
                }
            }
        }

        return data;
    }

    /**
     * Get all supported document types
     */
    getSupportedTypes() {
        return Object.entries(DOCUMENT_TYPES).map(([key, value]) => ({
            type: key,
            nameTH: value.nameTH,
            nameEN: value.nameEN,
        }));
    }
}

module.exports = new DocumentClassifier();
