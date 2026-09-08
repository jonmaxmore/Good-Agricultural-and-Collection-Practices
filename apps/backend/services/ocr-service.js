/**
 * OCR Service
 * Uses Tesseract.js to extract text from images and PDF documents.
 */
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const logger = require('../shared/logger');

let pdfParse = null;

class OcrService {
    constructor() {
        this.worker = null;
    }

    /**
     * Pre-process image for better OCR:
     * - Grayscale
     * - Threshold
     * - Sharpen
     * - Resize
     */
    async preprocessImage(imagePath) {
        try {
            logger.info('[OCR] Pre-processing image with Sharp');
            const buffer = await sharp(imagePath)
                .grayscale()
                .threshold(128)
                .sharpen()
                .resize(1000, null, { fit: 'inside' })
                .toBuffer();

            return buffer;
        } catch (error) {
            logger.error('[OCR] Sharp preprocessing failed:', error);
            return imagePath; // Fallback to original path if sharp fails
        }
    }

    /**
     * Extract text from an image file.
     * @param {string} imagePath - Absolute path to image
     * @param {string} lang - 'tha' or 'eng' or 'tha+eng'
     * @returns {Promise<{text: string, confidence: number}>}
     */
    async extractText(imagePath, lang = 'tha+eng') {
        try {
            logger.info(`[OCR] Processing file: ${path.basename(imagePath)}`);

            const ext = path.extname(imagePath).toLowerCase();
            if (ext === '.pdf') {
                return await this.extractTextFromPdf(imagePath);
            }

            const imageBuffer = await this.preprocessImage(imagePath);

            const result = await Tesseract.recognize(
                imageBuffer,
                lang,
                {
                    logger: m => {
                        if (m.status === 'recognizing text' && (m.progress * 100) % 50 === 0) {
                            // Keep logs quiet during OCR progress.
                        }
                    },
                    tessedit_char_whitelist: ' 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:/กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮะัาำิีึืฺุูเแโใไ ๆ่้๊๋์',
                },
            );

            const text = result.data.text.replace(/\s+/g, ' ').trim();
            const confidence = result.data.confidence;

            logger.info(`[OCR] Complete (confidence: ${confidence.toFixed(1)}%)`);

            return {
                text,
                confidence,
                words: result.data.words,
            };
        } catch (error) {
            logger.error('[OCR] Failed:', error);
            throw new Error('OCR processing failed');
        }
    }

    /**
     * Extract text from PDF file.
     */
    async extractTextFromPdf(filePath) {
        try {
            if (!pdfParse) {
                // Lazy load to avoid initializing heavy canvas bindings in unrelated flows.
                pdfParse = require('pdf-parse');
            }

            logger.info(`[OCR] Parsing PDF: ${path.basename(filePath)}`);
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);

            const text = data.text.replace(/\s+/g, ' ').trim();
            logger.info('[OCR] PDF parse complete');

            return {
                text,
                confidence: 95,
                isPdf: true,
            };
        } catch (error) {
            logger.error('[OCR] PDF parse failed:', error);
            throw new Error('PDF processing failed');
        }
    }

    /**
     * Verify if ID card image contains the expected ID number.
     * @param {string} imagePath
     * @param {string} expectedIdNumber
     */
    async verifyIdCard(imagePath, expectedIdNumber) {
        const { text, confidence } = await this.extractText(imagePath, 'tha+eng');

        // Strict clean: keep digits only.
        const cleanText = text.replace(/[^0-9]/g, '');
        const cleanId = expectedIdNumber.replace(/[^0-9]/g, '');

        logger.info(`[OCR] Fuzzy check userId=${cleanId} extracted=${cleanText.substring(0, 20)}...`);

        const result = {
            match: false,
            message: 'Unable to detect a valid ID number from the uploaded image',
            confidence: confidence,
            extractedText: text.substring(0, 100),
        };

        // Direct match
        if (cleanText.includes(cleanId)) {
            result.match = true;
            result.message = 'Exact Match Found';
            return result;
        }

        // Fuzzy match (sliding window)
        if (cleanId.length === 13) {
            const threshold = 4;
            for (let i = 0; i < cleanText.length - 12; i++) {
                const chunk = cleanText.substring(i, i + 13);
                const diff = this.levenshtein(cleanId, chunk);
                if (diff <= threshold) {
                    result.match = true;
                    result.message = `Fuzzy Match Found (Diff: ${diff})`;
                    return result;
                }
            }
        }

        return result;
    }

    // Calculate edit distance between two strings.
    levenshtein(a, b) {
        if (a.length === 0) {
            return b.length;
        }
        if (b.length === 0) {
            return a.length;
        }

        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1,
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }
}

module.exports = new OcrService();
