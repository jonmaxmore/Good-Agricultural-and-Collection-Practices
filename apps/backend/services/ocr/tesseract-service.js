/**
 * Tesseract OCR Service
 * Extracts text from uploaded images and PDFs using Tesseract.js
 * 
 * @module services/ocr/tesseract-service
 */

const Tesseract = require('tesseract.js');
const logger = require('../../shared/logger');
const { TESSDATA_DIR, TESSERACT_WORKER_OPTIONS } = require('./tessdata');

class TesseractService {
    constructor() {
        // Worker pool for performance
        this.scheduler = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the Tesseract scheduler with Thai + English languages
     */
    async initialize() {
        if (this.isInitialized) {return;}

        try {
            this.scheduler = Tesseract.createScheduler();

            // Create worker for Thai + English.
            // TESSERACT_WORKER_OPTIONS pins langPath to the local tessdata
            // directory. Without it tesseract.js falls back to downloading the
            // .traineddata models from a foreign CDN on first use — see
            // services/ocr/tessdata.js and data/tessdata/README.md. Recognition
            // itself has always been local WASM; nothing about the uploaded
            // image changes here.
            const worker = await Tesseract.createWorker(
                ['tha', 'eng'],
                undefined,
                TESSERACT_WORKER_OPTIONS,
            );
            this.scheduler.addWorker(worker);

            this.isInitialized = true;
            logger.info(`Tesseract OCR initialized (Thai + English), langPath=${TESSDATA_DIR}`);
        } catch (error) {
            logger.error('Failed to initialize Tesseract:', error.message);
            throw error;
        }
    }

    /**
     * Extract text from an image file or buffer
     * @param {string|Buffer} input - File path or Buffer
     * @returns {Promise<Object>} Extracted text and confidence
     */
    async extractText(input) {
        await this.initialize();

        try {
            const startTime = Date.now();

            const result = await this.scheduler.addJob('recognize', input);

            const duration = Date.now() - startTime;
            logger.info(`OCR completed in ${duration}ms, confidence: ${result.data.confidence}%`);

            return {
                success: true,
                text: result.data.text,
                confidence: result.data.confidence,
                words: result.data.words?.map(w => ({
                    text: w.text,
                    confidence: w.confidence,
                    bbox: w.bbox,
                })),
                duration,
            };
        } catch (error) {
            logger.error('OCR extraction failed:', error.message);
            return {
                success: false,
                error: error.message,
                text: '',
                confidence: 0,
            };
        }
    }

    /**
     * Extract text and detect document type based on keywords
     * @param {string|Buffer} input - File path or Buffer
     * @returns {Promise<Object>} Extracted text with detected type
     */
    async extractAndClassify(input) {
        const extraction = await this.extractText(input);

        if (!extraction.success) {
            return extraction;
        }

        const _text = extraction.text.toLowerCase();
        const detectedTypes = [];

        // Thai ID Card Detection
        const idCardPatterns = [
            /\d{1}-\d{4}-\d{5}-\d{2}-\d{1}/,  // Thai ID format
            /บัตรประจำตัวประชาชน/,
            /identification card/i,
            /หมายเลขบัตร/,
        ];
        if (idCardPatterns.some(p => p.test(extraction.text))) {
            detectedTypes.push({ type: 'ID_CARD', confidence: 0.9 });
        }

        // House Registration Detection
        const housePatterns = [
            /ทะเบียนบ้าน/,
            /สำเนาทะเบียนบ้าน/,
            /house registration/i,
            /เลขรหัสประจำบ้าน/,
        ];
        if (housePatterns.some(p => p.test(extraction.text))) {
            detectedTypes.push({ type: 'HOUSE_REGISTRATION', confidence: 0.85 });
        }

        // Farm/Business License Detection
        const licensePatterns = [
            /ใบอนุญาต/,
            /license/i,
            /permit/i,
            /ใบรับรอง/,
            /certificate/i,
        ];
        if (licensePatterns.some(p => p.test(extraction.text))) {
            detectedTypes.push({ type: 'LICENSE', confidence: 0.8 });
        }

        // Medical Certificate Detection
        const medicalPatterns = [
            /ใบรับรองแพทย์/,
            /medical certificate/i,
            /health certificate/i,
            /โรงพยาบาล/,
            /hospital/i,
        ];
        if (medicalPatterns.some(p => p.test(extraction.text))) {
            detectedTypes.push({ type: 'MEDICAL_CERTIFICATE', confidence: 0.85 });
        }

        // Land Title Detection
        const landPatterns = [
            /โฉนด/,
            /นส\.?\s?3/,
            /land title/i,
            /เอกสารสิทธิ์/,
        ];
        if (landPatterns.some(p => p.test(extraction.text))) {
            detectedTypes.push({ type: 'LAND_TITLE', confidence: 0.85 });
        }

        return {
            ...extraction,
            detectedTypes: detectedTypes.sort((a, b) => b.confidence - a.confidence),
            primaryType: detectedTypes[0]?.type || 'UNKNOWN',
        };
    }

    /**
     * Terminate all workers (cleanup)
     */
    async terminate() {
        if (this.scheduler) {
            await this.scheduler.terminate();
            this.isInitialized = false;
            logger.info('Tesseract workers terminated');
        }
    }
}

module.exports = new TesseractService();
