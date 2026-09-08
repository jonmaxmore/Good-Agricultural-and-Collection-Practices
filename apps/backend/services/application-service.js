const crypto = require('crypto');
const { prisma } = require('./prisma-database');
const feeService = require('./fee-calculation');
const { sendNotification, NotifyType } = require('./notification-service');
const logger = require('../shared/logger');
const { createApplicationIdentityMethods } = require('./application-service/application-identity-methods');
const { createApplicationDraftQueryMethods } = require('./application-service/application-draft-query-methods');
const { createApplicationReviewRevisionMethods } = require('./application-service/application-review-revision-methods');
const { createApplicationSubmissionMethods } = require('./application-service/application-submission-methods');
const { createApplicationProviderQueryMethods } = require('./application-service/application-provider-query-methods');
const { createApplicationApplicantQueryMethods } = require('./application-service/application-applicant-query-methods');

/**
 * Service for managing GACP Applications
 * Encapsulates all business logic for creation, updates, and retrieval.
 */
class ApplicationService {}

Object.assign(
    ApplicationService.prototype,
    createApplicationIdentityMethods({ prisma, logger }),
    // ระบบเต็มผูกชุดเมธอด "ออกใบแจ้งหนี้สองงวด" เข้ากับ prototype ตรงนี้
    // GACP Lite ไม่ออกใบแจ้งหนี้ — ราคาถูกคำนวณตอนสร้างคำขอและตรึงไว้บนแถวนั้น
    // การรับเงินอยู่ที่ routes/api/fees/fee-payments.js ซึ่งไม่ผ่าน service นี้
    createApplicationDraftQueryMethods({
        prisma,
        feeService,
        sendNotification,
        NotifyType,
        logger,
    }),
    createApplicationReviewRevisionMethods({
        prisma,
        feeService,
        sendNotification,
        NotifyType,
        logger,
    }),
    createApplicationSubmissionMethods({
        prisma,
        feeService,
        logger,
    }),
    createApplicationProviderQueryMethods({ prisma }),
    createApplicationApplicantQueryMethods({ prisma }),
);

module.exports = new ApplicationService();
