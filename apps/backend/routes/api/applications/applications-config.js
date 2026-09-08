/**
 * Applications Configuration Routes
 * Provides journey configuration based on purpose and cultivation method
 * 
 * @author ระบบรับรองมาตรฐาน GACP สมุนไพร (DTAM)
 */

const express = require('express');
const router = express.Router();
const JourneyController = require('../../../controllers/journey-controller');

const PURPOSE_ALIAS = Object.freeze({
    new: 'domestic',
});

const METHOD_ALIAS = Object.freeze({
    individual: 'outdoor',
});

function normalizeJourneyParam(value, aliasMap) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) {
        return '';
    }
    return aliasMap[normalized] || normalized;
}

// GET /api/applications/config (query-param fallback)
// Returns default step config for the legacy wizard
router.get('/', (req, res) => {
    res.json({
        success: true,
        data: {
            steps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            plantId: req.query.plantId || 'cannabis',
        },
    });
});

// Application configuration by journey
// GET /api/applications/config/:purpose/:method
router.get('/:purpose/:method', (req, res, next) => {
    req.params.purpose = normalizeJourneyParam(req.params.purpose, PURPOSE_ALIAS);
    req.params.method = normalizeJourneyParam(req.params.method, METHOD_ALIAS);
    return JourneyController.getJourneyConfig(req, res, next);
});

module.exports = router;
