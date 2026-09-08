'use strict';

/**
 * Wizard plant slug → plant_species master code.
 *
 * The application wizard stores formData.plantId as the FE slug, the `code` of each
 * FALLBACK_PLANTS entry in
 * apps/web-app/src/app/health/applications/new/_steps/steps/plant-selection-config.ts.
 * The master table plant_species (prisma/schema/trace.prisma PlantSpecies) keys the same
 * plants by the seed code in prisma/seed-plants.js. Nothing imported one from the other,
 * so a backend lookup with the slug found no plant (F-G4-59).
 *
 * This is the one place the two vocabularies meet. Every wizard slug must appear here
 * and every value must be a code the seed declares — pinned by
 * __tests__/unit/plant-slug-map-covers-the-wizard.test.js, which reads both files as
 * text. When the slug retires, this file goes with it.
 *
 * Resolve a plant to its master row through services/plant-species-service.js; do not
 * read this map at a call site for that. The one thing callers may ask HERE is the
 * closed vocabulary question — "is this word a plant this platform can name" — because
 * that answer is static, synchronous and needed before any database is reachable
 * (the กทล.1 requirement lens and the submit validator both ask it, and they must ask
 * it the same way or a filing is judged by one door and refused by the other).
 */
const PLANT_SLUG_TO_CODE = Object.freeze({
    cannabis: 'CAN',
    kratom: 'KRA',
    turmeric: 'TUR',
    ginger: 'GIN',
    plai: 'PLA',
    black_galangal: 'GAL',
});

/**
 * The wizard slug this word is, or null.
 *
 * ONE normalisation for every caller. The lens lower-cased and the submit validator did
 * not, so `plantId: 'Cannabis'` was judged normally by the requirement engine and then
 * refused at submit — two doors, one vocabulary, two answers.
 */
function asPlantSlug(value) {
    if (value === null || value === undefined) { return null; }
    const slug = String(value).trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PLANT_SLUG_TO_CODE, slug) ? slug : null;
}

module.exports = { PLANT_SLUG_TO_CODE, asPlantSlug };
