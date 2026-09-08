const Queue = require('bull');
const path = require('path');
const fs = require('fs');

const logger = require('../shared/logger');
const checkSlaBreaches = require('../jobs/sla-processor');

let slaQueue = null;
let pdfQueue = null;
let webhookDlqQueue = null;

function loadWebhookDlqProcessor() {
    const processorPath = path.join(__dirname, '../jobs/webhook-dlq-processor.js');
    if (!fs.existsSync(processorPath)) {
        return null;
    }

    try {
        return require(processorPath);
    } catch (error) {
        logger.error('[Queue] Failed to load webhook DLQ processor:', error.message);
        return null;
    }
}

function bindStandardQueueEvents(queue, label) {
    queue.on('error', (error) => {
        logger.warn(`[Queue] ${label} error: ${error.message}`);
    });

    queue.on('failed', (job, error) => {
        logger.error(`[Queue] ${label} job ${job.id} failed:`, error.message);
    });
}

const initQueues = () => {
    // Bull creates its own connection, so we only need the Redis URL here.
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

    try {
        logger.info('[Queue] Initializing SLA monitor queue...');

        slaQueue = new Queue('sla-monitor', redisUrl, {
            redis: {
                maxRetriesPerRequest: 3,
                enableReadyCheck: false,
            },
            defaultJobOptions: {
                removeOnComplete: true,
                removeOnFail: 100,
            },
        });

        slaQueue.process(checkSlaBreaches);
        slaQueue.on('ready', () => {
            logger.info('[Queue] SLA queue ready');
            slaQueue.add({}, { repeat: { cron: '0 8 * * *' }, jobId: 'daily-sla-check' })
                .then(() => logger.info('[Queue] SLA daily check scheduled'))
                .catch((error) => logger.error('[Queue] SLA schedule error:', error));
        });
        bindStandardQueueEvents(slaQueue, 'SLA');

        const dlqEnabled = String(process.env.ENABLE_WEBHOOK_DLQ || 'false').trim().toLowerCase() === 'true';
        const processDlqWebhooks = loadWebhookDlqProcessor();
        if (dlqEnabled && typeof processDlqWebhooks === 'function') {
            logger.info('[Queue] Initializing webhook DLQ...');

            webhookDlqQueue = new Queue('webhook-dlq', redisUrl, {
                redis: {
                    maxRetriesPerRequest: 3,
                    enableReadyCheck: false,
                },
                defaultJobOptions: {
                    removeOnComplete: true,
                    removeOnFail: 100,
                },
            });

            webhookDlqQueue.process(processDlqWebhooks);
            webhookDlqQueue.on('ready', () => {
                logger.info('[Queue] Webhook DLQ ready');
                webhookDlqQueue.add({}, { repeat: { cron: '0 2 * * *' }, jobId: 'daily-webhook-dlq' })
                    .catch((error) => logger.error('[Queue] DLQ schedule error:', error));
            });
            bindStandardQueueEvents(webhookDlqQueue, 'Webhook DLQ');
        } else {
            logger.info('[Queue] Webhook DLQ disabled or processor missing; skipping initialization');
        }

        const pdfProcessorPath = path.join(__dirname, '../jobs/pdf-processor.js');
        if (!fs.existsSync(pdfProcessorPath)) {
            pdfQueue = null;
            logger.warn(`[Queue] PDF processor missing at ${pdfProcessorPath}; skipping PDF queue initialization`);
            return;
        }

        try {
            logger.info('[Queue] Initializing PDF generator queue...');

            pdfQueue = new Queue('pdf-generator', redisUrl, {
                redis: {
                    maxRetriesPerRequest: 3,
                    enableReadyCheck: false,
                },
                defaultJobOptions: {
                    removeOnComplete: true,
                    removeOnFail: 100,
                },
            });

            // Run PDF generation in a child process to avoid blocking the API server.
            pdfQueue.process(2, pdfProcessorPath);
            pdfQueue.on('ready', () => logger.info('[Queue] PDF queue ready'));
            bindStandardQueueEvents(pdfQueue, 'PDF');
        } catch (error) {
            pdfQueue = null;
            logger.warn(`[Queue] PDF queue unavailable, falling back to inline PDF generation: ${error.message}`);
        }
    } catch (error) {
        logger.error('[Queue] Failed to initialize queues:', error);
    }
};

const getSlaQueue = () => slaQueue;
const getPdfQueue = () => pdfQueue;

module.exports = {
    initQueues,
    getSlaQueue,
    getPdfQueue,
};
