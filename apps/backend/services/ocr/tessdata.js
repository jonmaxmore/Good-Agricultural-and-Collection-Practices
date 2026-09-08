/**
 * Local Tesseract language-model location — single source of truth.
 *
 * Data sovereignty (2026-07-25): tesseract.js does the OCR itself entirely
 * in-process (local WASM core from the `tesseract.js-core` package — no network),
 * so an uploaded Thai national-ID image never leaves the server. But
 * `createWorker()` was being called with no `langPath`, and the library's
 * documented fallback in that case is a **foreign CDN**:
 *
 *   node_modules/tesseract.js/src/worker-script/index.js:127-130
 *   "If `langPath` if not explicitly set by the user, the jsdelivr CDN is used."
 *   → https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0
 *
 * So on first OCR the DTAM production host downloaded `tha.traineddata` /
 * `eng.traineddata` from outside Thailand. No PII in the payload, but a hard
 * foreign runtime dependency on the ID-document verification path: if egress is
 * blocked (which a sovereignty lockdown does), ID-card OCR verification fails.
 *
 * Pointing `langPath` at a directory inside the deployment removes that
 * dependency and makes OCR work air-gapped. See data/tessdata/README.md for the
 * files that must be present and where they come from.
 *
 * @module services/ocr/tessdata
 */

const path = require('path');

/**
 * Directory holding `tha.traineddata` and `eng.traineddata`.
 * Overridable with TESSDATA_PATH for deployments that mount the models from a
 * volume or a DTAM-internal artifact store instead of baking them into the image.
 */
const TESSDATA_DIR = process.env.TESSDATA_PATH
    || path.join(__dirname, '..', '..', 'data', 'tessdata');

/**
 * Options every `Tesseract.createWorker()` / `createScheduler()` worker in this
 * codebase must be constructed with.
 *
 *  • `langPath`  — the local directory; set explicitly so the jsdelivr fallback
 *                  above can never be reached.
 *  • `gzip:false` — the vendored files are plain `.traineddata`, not
 *                  `.traineddata.gz`. With the default `gzip: true` the library
 *                  would look for `${langPath}/tha.traineddata.gz` and miss.
 *  • `cachePath` — same directory, so the worker's cache lookup (which reads
 *                  `${cachePath}/${lang}.traineddata`) hits the vendored file
 *                  directly and no stray `./tha.traineddata` is written into
 *                  the process CWD.
 *
 * If a model file is absent the worker now throws a plain ENOENT naming the
 * expected path — a loud, local failure — instead of silently reaching abroad.
 *
 * @type {{langPath: string, gzip: boolean, cachePath: string}}
 */
const TESSERACT_WORKER_OPTIONS = Object.freeze({
    langPath: TESSDATA_DIR,
    gzip: false,
    cachePath: TESSDATA_DIR,
});

module.exports = { TESSDATA_DIR, TESSERACT_WORKER_OPTIONS };
