/**
 * Plot CRUD — the land a farm declares on its GACP filing.
 *
 * In the full platform these four functions lived inside `planting-service.js`
 * next to planting cycles, harvests and cultivation logs. That was a naming
 * accident, not a boundary: a plot is part of the FARM, and the filing needs it
 * whether or not anyone ever records a planting. GACP Lite drops planting
 * records entirely, so the four functions were lifted out under the name that
 * describes them.
 *
 * One behaviour changed with the move. `listPlotsByFarm` used to count each
 * plot's plantingCycles and cycleAssignments; those tables do not exist here, so
 * the counts are gone rather than reported as zero — a zero would be a claim
 * about planting, and this system makes no such claim.
 */

const { prisma } = require('./prisma-database');
const { AREA_UNIT } = require('../shared/area-utils');

/** Square metres, always — see the areaUnit note below. */
async function createPlotForFarm({ farmId, name, areaSqm, area, areaUnit: _areaUnit, solarSystem }) {
    const sqm = parseFloat(areaSqm ?? area);
    return prisma.plot.create({
        data: {
            farmId,
            name: String(name).trim(),
            areaSqm: sqm,
            // `area` is the retired name for the same square-metre number, still
            // written so a reader on the old column sees a correct plot.
            area: sqm,
            // The parameter is accepted so an older caller does not break, and
            // ignored so it cannot store anything but square metres.
            areaUnit: AREA_UNIT,
            solarSystem: String(solarSystem || 'OUTDOOR').toUpperCase(),
        },
    });
}

async function listPlotsByFarm(farmId) {
    return prisma.plot.findMany({
        where: { farmId },
        orderBy: { createdAt: 'asc' },
    });
}

/** Returns the owner alongside the plot so a route can 404 on a mismatch. */
async function findPlotWithFarmOwner(plotId) {
    return prisma.plot.findUnique({
        where: { id: plotId },
        select: {
            id: true,
            farm: { select: { ownerId: true } },
        },
    });
}

async function deletePlot(plotId) {
    return prisma.plot.delete({ where: { id: plotId } });
}

module.exports = { createPlotForFarm, listPlotsByFarm, findPlotWithFarmOwner, deletePlot };
