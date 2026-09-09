const express = require('express');
const router = express.Router();
const { prisma } = require('../../../services/prisma-database');
const logger = require('../../../shared/logger');
const cacheService = require('../../../services/cache-service');

const CACHE_KEY_PLANTS = 'master:plantSpecies:all';
const CACHE_TTL_PLANTS = 3600; // 1 hour

// GET /api/admin/plants - List all (including inactive, cached)
router.get('/', async (req, res) => {
    try {
        const plants = await cacheService.getOrSet(
            CACHE_KEY_PLANTS,
            () => prisma.plantSpecies.findMany({ orderBy: { sortOrder: 'asc' } }),
            CACHE_TTL_PLANTS,
        );
        res.json({ success: true, data: plants });
    } catch (error) {
        logger.error('Failed to fetch plants:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch plants' });
    }
});

// POST /api/admin/plants - Create new plant
router.post('/', async (req, res) => {
    try {
        // C-class: PlantSpecies has NO `name` column — the required scalars are
        // `code` (@unique) + `nameTH`. The old create used `name` (→ validation
        // error) AND omitted the required unique `code`, and findUnique keyed on
        // the non-unique `name` (also throws). POST was 500 on every call.
        const { code, name, nameEN, productionInputs } = req.body;

        if (!code || !name) {
            return res.status(400).json({ success: false, error: 'Plant code and name (nameTH) are required' });
        }

        const existing = await prisma.plantSpecies.findUnique({
            where: { code },
        });

        if (existing) {
            return res.status(400).json({ success: false, error: 'Plant code already exists' });
        }

        const plant = await prisma.plantSpecies.create({
            data: {
                code,
                nameTH: name,
                ...(nameEN ? { nameEN } : {}),
                productionInputs: productionInputs || {}, // Default to empty object if not provided
                sortOrder: 100, // Default sort order
                isActive: true,
            },
        });

        await cacheService.del(CACHE_KEY_PLANTS);
        logger.info(`Plant created: ${name} (${plant.id})`);
        res.status(201).json({ success: true, data: plant });
    } catch (error) {
        logger.error('Failed to create plant:', error);
        res.status(500).json({ success: false, error: 'Failed to create plant' });
    }
});

// PATCH /api/admin/plants/:id - Update
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, nameEN, productionInputs, isActive, sortOrder } = req.body;

        const plant = await prisma.plantSpecies.update({
            where: { id },
            data: {
                ...(name && { nameTH: name }), // C-class: column is nameTH, not name
                ...(nameEN && { nameEN }),
                ...(productionInputs && { productionInputs }),
                ...(isActive !== undefined && { isActive }),
                ...(sortOrder !== undefined && { sortOrder }),
            },
        });

        await cacheService.del(CACHE_KEY_PLANTS);
        logger.info(`Plant updated: ${plant.name} (${plant.id})`);
        res.json({ success: true, data: plant });
    } catch (error) {
        logger.error('Failed to update plant:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, error: 'Plant not found' });
        }
        res.status(500).json({ success: false, error: 'Failed to update plant' });
    }
});

// DELETE /api/admin/plants/:id - Soft Delete (or Hard Delete if no dependencies)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // ตรวจว่ามีอะไรผูกอยู่ก่อนลบ
        //
        // เดิมถาม prisma.plantingCycle ซึ่งถูกตัดออกพร้อมกับ T&T — เป็น undefined
        // การเรียก .findFirst บนนั้นโยน TypeError ทำให้ประตูตอบ 500 ทุกครั้ง (ไม่ใช่
        // 400 หรือ 200) แปลว่าลบชนิดพืชไม่ได้เลย และข้อความก็ไม่ได้บอกเหตุผลจริง
        //
        // สิ่งที่ผูกกับชนิดพืชใน Lite คือคำขอ — Application.plantId
        // (prisma/schema/application.prisma:303) ลบชนิดพืชที่มีคำขออ้างอยู่ไม่ได้
        // เพราะคำขอนั้นจะเหลือรหัสพืชที่แปลไม่ออก
        const species = await prisma.plantSpecies.findUnique({
            where: { id },
            select: { code: true },
        });
        if (!species) {
            return res.status(404).json({ success: false, error: 'ไม่พบชนิดพืชนี้' });
        }

        // PlantSpecies.code คือ 'CAN' ส่วน Application.plantId คือ slug ของวิซาร์ด
        // ('cannabis') · config/plant-species-slugs.js เขียนไว้ว่าเป็น "ที่เดียวที่
        // สองคำศัพท์มาเจอกัน" จึงแปลผ่านมัน ไม่เขียนตัวแปลใบที่สอง
        const slugs = Object.entries(PLANT_SLUG_TO_CODE)
            .filter(([, code]) => code === species.code)
            .map(([slug]) => slug);

        const usedBy = slugs.length
            ? await prisma.application.findFirst({
                where: { plantId: { in: slugs }, isDeleted: false },
                select: { id: true },
            })
            : null;

        if (usedBy) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete plant species that applications still reference',
                messageTh: 'ลบชนิดพืชนี้ไม่ได้ เพราะมีคำขออ้างถึงอยู่',
            });
        }

        await prisma.plantSpecies.delete({ where: { id } });

        await cacheService.del(CACHE_KEY_PLANTS);
        logger.info(`Plant deleted: ${id}`);
        res.json({ success: true, message: 'Plant deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete plant:', error);
        res.status(500).json({ success: false, error: 'Failed to delete plant' });
    }
});

module.exports = router;
