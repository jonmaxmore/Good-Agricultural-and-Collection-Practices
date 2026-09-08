/**
 * Plant Controller - API endpoints for plant data (Prisma Refactor)
 * 
 * GET /api/v2/plants - Get all active plants
 * GET /api/v2/plants/:plantId - Get single plant by ID
 * GET /api/v2/plants/:plantId/documents - Get document requirements for plant
 */

const { prisma } = require('../services/prisma-database');
const { respondError } = require('../shared/api-response');
const documentAnalysisService = require('../services/document-analysis-service');
const logger = require('../shared/logger');

class PlantController {
    /**
     * GET /api/v2/plants
     * Get all active plants
     */
    async getAllPlants(req, res) {
        try {
            const { group } = req.query;

            const where = { isActive: true };
            if (group) {
                where.group = group.toUpperCase();
            }

            const plants = await prisma.plantSpecies.findMany({
                where,
                orderBy: { sortOrder: 'asc' },
            });

            // Map to legacy format for frontend compatibility if needed, 
            // but the new schema is very similar. 
            // The frontend likely expects 'plantId' property instead of 'code'.
            const mappedPlants = plants.map(p => ({
                ...p,
                plantId: p.code, // Alias code to plantId
            }));

            res.json({
                success: true,
                data: mappedPlants,
                count: mappedPlants.length,
            });
        } catch (error) {
            logger.error('Error fetching plants:', error);
            return respondError(res, req, error, { message: 'Failed to fetch plants' });
        }
    }

    /**
     * GET /api/v2/plants/:plantId
     * Get single plant by ID
     */
    async getPlantById(req, res) {
        try {
            const { plantId } = req.params;

            const plant = await prisma.plantSpecies.findUnique({
                where: { code: plantId },
            });

            if (!plant) {
                return res.status(404).json({
                    success: false,
                    message: `Plant not found: ${plantId}`,
                });
            }

            res.json({
                success: true,
                data: {
                    ...plant,
                    plantId: plant.code,
                },
            });
        } catch (error) {
            logger.error('Error fetching plant:', error);
            return respondError(res, req, error, { message: 'Failed to fetch plant' });
        }
    }

    /**
     * GET /api/v2/plants/:plantId/documents
     * Get document requirements for a plant
     */
    async getPlantDocuments(req, res) {
        try {
            const { plantId } = req.params;
            const { requestType = 'NEW' } = req.query;

            // Verify plant exists
            const plant = await prisma.plantSpecies.findUnique({
                where: { code: plantId },
            });

            if (!plant) {
                return res.status(404).json({
                    success: false,
                    message: `Plant not found: ${plantId}`,
                });
            }

            // Use the service to get base requirements
            const documents = await documentAnalysisService.getBaseRequirements(plantId, requestType.toUpperCase());

            // Group by category
            const grouped = documents.reduce((acc, doc) => {
                const category = doc.category || 'OTHER';
                if (!acc[category]) {
                    acc[category] = [];
                }
                acc[category].push(doc);
                return acc;
            }, {});

            res.json({
                success: true,
                data: {
                    plantId: plant.code,
                    plantName: plant.nameTH,
                    requestType: requestType.toUpperCase(),
                    documents: documents,
                    groupedByCategory: grouped,
                },
                count: documents.length,
            });
        } catch (error) {
            logger.error('Error fetching plant documents:', error);
            return respondError(res, req, error, { message: 'Failed to fetch plant documents' });
        }
    }

    /**
     * GET /api/v2/plants/:plantId/production-inputs
     * Get production input fields for a plant
     */
    async getPlantProductionInputs(req, res) {
        try {
            const { plantId } = req.params;

            const plant = await prisma.plantSpecies.findUnique({
                where: { code: plantId },
            });

            if (!plant) {
                return res.status(404).json({
                    success: false,
                    message: `Plant not found: ${plantId}`,
                });
            }

            res.json({
                success: true,
                data: {
                    plantId: plant.code,
                    plantName: plant.nameTH,
                    group: plant.group,
                    units: plant.units,
                    plantParts: plant.plantParts,
                    productionInputs: plant.productionInputs,
                    securityRequirements: plant.securityRequirements,
                },
            });
        } catch (error) {
            logger.error('Error fetching plant production inputs:', error);
            return respondError(res, req, error, { message: 'Failed to fetch plant production inputs' });
        }
    }

    /**
     * GET /api/v2/plants/summary
     * Get summary of all plants (for dropdown selections)
     */
    async getPlantsSummary(req, res) {
        try {
            const plants = await prisma.plantSpecies.findMany({
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
            });

            const summary = plants.map(p => ({
                id: p.code, // Frontend uses 'id' for value
                nameTH: p.nameTH,
                nameEN: p.nameEN,
                group: p.group,
                requiresLicense: p.requiresLicense,
                unit: (p.units && p.units.length > 0) ? p.units[0] : 'ไร่',
            }));

            res.json({
                success: true,
                data: summary,
                count: summary.length,
            });
        } catch (error) {
            logger.error('Error fetching plants summary:', error);
            return respondError(res, req, error, { message: 'Failed to fetch plants summary' });
        }
    }
}

module.exports = new PlantController();
