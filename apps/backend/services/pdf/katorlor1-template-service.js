/**
 * แบบกัญชา กทล.๑ — the ministry's own form, assembled from the filing we hold.
 *
 * ONE renderer, two outputs: the HTML that the applicant's review page, the
 * officer's checklist page and the `[id]/preview` page all embed, and the PDF the
 * `/applications/:id/pdf` door serves. Two renderers would be two forms, and the
 * one a farmer signs off on screen has to be the one the department receives.
 *
 * ── WHAT THIS FILE MAY AND MAY NOT DECIDE ─────────────────────────────────────
 * It decides LAYOUT. It decides nothing about requirements: the ส่วนที่ ๓
 * checklist is `requirementsPayload.slots` printed in the order the engine
 * returned them, with the engine's own `satisfied` flag. If this file computed
 * "attached?" for itself there would be two answers to that question and the
 * screen would eventually disagree with the submit gate.
 *
 * The same is true of the dimensions: `dims.areaTypes` and `dims.areaTypeOther`
 * come from the engine, whose own comment says they are carried "so the surfaces
 * do not have to re-read formData". This file honours that.
 *
 * ── THE THREE THINGS A GOVERNMENT FORM MUST NOT GET WRONG ─────────────────────
 *  1. ลักษณะพื้นที่ is a checkbox ROW (กทล.1 ส่วนที่ ๒). Every tick is marked, and
 *     the ☐ อื่น ๆ ระบุ words print beside their own box. Collapsing the ticks to
 *     one is what deleted a required paper in the merged B1 lens.
 *  2. ส่วนที่ ๑ prints the applicant's own legal shape and no other. Blank rows
 *     for a shape they are not read as an incomplete filing to whoever checks it.
 *  3. A required paper that is not attached must LOOK not attached — ☐ plus
 *     "ยังไม่ได้แนบ", never a blank the reader has to interpret.
 *
 * Everything applicant-supplied is escaped. A filing is not a place to inject
 * markup, and this HTML is embedded in staff pages.
 *
 * @module services/pdf/katorlor1-template-service
 */

'use strict';

const pdfGenerator = require('./pdf-generator.service');
const pdfAssets = require('./pdf-assets');

// ── text ──────────────────────────────────────────────────────────────────────

/** Everything applicant-supplied passes through here on its way to the page. */
function esc(value) {
    if (value === null || value === undefined) { return ''; }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * A value, or the form's own way of saying it is not filled in.
 *
 * NEVER returns the string "undefined" or "null". On a government form a stray
 * `undefined` where a นาย/นาง belongs is not a cosmetic defect — it is a filing
 * that looks corrupted to the person deciding it.
 */
function field(value, blank = ' '.repeat(12)) {
    if (value === null || value === undefined) { return blank; }
    if (typeof value === 'number') { return Number.isFinite(value) ? esc(value) : blank; }
    if (typeof value === 'object') { return blank; }
    const text = String(value).trim();
    return text ? esc(text) : blank;
}

const BOX = { on: '☑', off: '☐' };
const box = (checked) => (checked ? BOX.on : BOX.off);

/** Thai date, or the form's own words for a filing not yet submitted. */
function thaiDate(value) {
    if (!value) { return 'ยังไม่ได้ยื่น'; }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) { return 'ยังไม่ได้ยื่น'; }
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// ── the form's own vocabulary ────────────────────────────────────────────────

/**
 * The form's own vocabularies.
 *
 * The key is `value`, not `code`: `code:` beside a SCREAMING_SNAKE string is the
 * shape scripts/extract-error-codes.js reads as an error code, and these are
 * checkbox values on a paper form. Naming them `code` made the catalogue drift
 * test report OTHER, REPLACEMENT, PLANTING, OWNED, STATE_PERMITTED and RENTED as
 * uncatalogued errors — better to stop saying the wrong word than to grow the
 * extractor's ignore list.
 */
/** กทล.1 ส่วนที่ ๒ prints these four boxes, in this order. */
const AREA_BOXES = Object.freeze([
    { value: 'OUTDOOR', label: 'กลางแจ้ง' },
    { value: 'INDOOR', label: 'อาคาร/โรงเรือนระบบปิด' },
    { value: 'GREENHOUSE', label: 'โรงเรือนทั่วไป' },
    { value: 'OTHER', label: 'อื่น ๆ' },
]);

const REQUEST_TYPE_BOXES = Object.freeze([
    { value: 'NEW', label: 'ขอรับรองใหม่' },
    { value: 'RENEWAL', label: 'ต่ออายุการรับรอง' },
    { value: 'REPLACEMENT', label: 'ขอใบแทนใบรับรอง' },
]);

const CERT_SCOPE_BOXES = Object.freeze([
    { value: 'PLANTING', label: 'การปลูก' },
    { value: 'PROCESSING', label: 'การแปรรูปเบื้องต้น' },
]);

const PURPOSE_BOXES = Object.freeze([
    { value: 'MEDICAL', label: 'เพื่อประโยชน์ทางการแพทย์' },
    { value: 'EXPORT', label: 'เพื่อการส่งออก' },
]);

const LAND_TENURE_BOXES = Object.freeze([
    { value: 'OWNED', label: 'เป็นเจ้าของ' },
    { value: 'STATE_PERMITTED', label: 'ได้รับอนุญาตจากรัฐ' },
    { value: 'RENTED', label: 'เช่า' },
]);

// ── reading the filing ───────────────────────────────────────────────────────

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);

function readFiling(application, requirementsPayload) {
    const app = obj(application);
    const formData = obj(app.formData);
    const req = obj(requirementsPayload);
    const dims = obj(req.dims);

    return {
        app,
        formData,
        // The wizard and this template were written with different names for the
        // same identity fields — step 2 writes idCard / presidentIdCard / companyName /
        // taxId / communityRegistrationNo, this form reads nationalId /
        // organizationName / juristicRegistrationNumber / communityRegistrationNumber.
        // With no translator, every printed กทล.1 left the applicant's national ID and
        // registration numbers BLANK: an official form that does not say who filed it.
        // Both spellings are accepted here, the template's own name winning when a
        // filing carries it, so nothing already stored changes meaning.
        applicant: normaliseApplicantIdentity(obj(formData.applicantData)),
        farm: obj(formData.farmData),
        slots: arr(req.slots),
        // Dimensions come from the engine when it ran, and fall back to the
        // filing's own words when this is rendered before it did (a draft the
        // applicant is still filling in).
        holderType: dims.holderType || formData.applicantType || null,
        requestType: dims.requestType || formData.requestType || 'NEW',
        certScope: dims.certScope || formData.certScope || 'PLANTING',
        landTenure: dims.landTenure || obj(formData.farmData).landOwnership || null,
        areaTypes: arr(dims.areaTypes).length
            ? arr(dims.areaTypes)
            : arr(obj(formData.farmData).areaTypes),
        areaTypeOther: dims.areaTypeOther || obj(formData.farmData).areaTypeOther || null,
        purposes: arr(dims.purposes).length ? arr(dims.purposes) : arr(formData.certificationPurposes),
        areaUnreadable: dims.areaDeclarationUnreadable === true,
    };
}

// ── ส่วน builders ────────────────────────────────────────────────────────────

function row(label, value) {
    return `<div class="row"><span class="lbl">${esc(label)}</span><span class="val">${field(value)}</span></div>`;
}

function boxes(options, isOn) {
    return options.map((o) => `<span class="box">${box(isOn(o.value))} ${esc(o.label)}</span>`).join('');
}

function sectionHead(number, title) {
    return `<h2 class="sec">ส่วนที่ ${number} ${esc(title)}</h2>`;
}

/**
 * One place that reconciles the wizard's field names with this form's.
 * Adds only the aliases; never overwrites a value the filing already carries under
 * the template's own name.
 */
function normaliseApplicantIdentity(applicant) {
    const pick = (...keys) => {
        for (const k of keys) {
            const v = applicant[k];
            if (v !== undefined && v !== null && String(v).trim() !== '') { return v; }
        }
        return undefined;
    };
    return {
        ...applicant,
        nationalId: pick('nationalId', 'idCard', 'presidentIdCard', 'authorisedIdCard'),
        organizationName: pick('organizationName', 'companyName', 'communityName', 'juristicName'),
        juristicRegistrationNumber: pick('juristicRegistrationNumber', 'taxId', 'juristicRegNo'),
        communityRegistrationNumber: pick('communityRegistrationNumber', 'communityRegistrationNo', 'svc01No'),
    };
}

/** ส่วนที่ ๑ — identity. Only the applicant's own legal shape is printed. */
function sectionOne(f) {
    const a = f.applicant;
    const common = [
        row('คำนำหน้า ชื่อ นามสกุล', [a.prefix, a.firstName, a.lastName].filter(Boolean).join(' ')),
        row('เลขประจำตัวประชาชน', a.nationalId),
        row('สัญชาติ', a.nationality),
        row('โทรศัพท์', a.phone),
    ].join('');

    let specific = '';
    if (f.holderType === 'COMMUNITY_ENTERPRISE') {
        // The community enterprise's registration paper has its own name on the
        // form; a community filing without this row is missing its identity.
        specific = [
            row('ชื่อวิสาหกิจชุมชน', a.organizationName || f.farm.farmName),
            row('เลขทะเบียนวิสาหกิจชุมชน (สวช.01)', a.communityRegistrationNumber),
            row('เลขรหัสประจำบ้าน', a.houseCode),
        ].join('');
    } else if (f.holderType === 'JURISTIC') {
        specific = [
            row('ชื่อนิติบุคคล', a.organizationName),
            row('เลขทะเบียนนิติบุคคล', a.juristicRegistrationNumber),
            row('ผู้มีอำนาจลงนาม', a.authorizedSignatory),
        ].join('');
    }

    return `${sectionHead('๑', 'ข้อมูลผู้ขอรับการรับรอง')}<div class="body">${common}${specific}</div>`;
}

/**
 * ฟาร์มในภาษาเดียว — เทมเพลตอ่านชุดนี้ชุดเดียว
 *
 * wizard หกขั้นเขียน `siteName` `siteAddress` `landDocumentDetail{type,number}` `coordinates`
 * ส่วนรุ่นก่อนเขียน `farmName` `address` `landDocumentType` `landDocumentNumber`
 * `latitude`/`longitude` · เทมเพลตอ่านชื่อของรุ่นก่อนล้วน ⇒ คำขอที่กรอกจาก wizard ปัจจุบัน
 * พิมพ์ออกมาโดยที่ ชื่อสถานที่ · ที่ตั้ง · เอกสารสิทธิ์ · พิกัด **ว่างทั้งสี่ช่อง**
 * (เห็นตอนเดินจริงถึงหน้าตรวจทาน 2026-09-06)
 *
 * `landlordName` กับ `areaSqm` พิมพ์ถูกมาตลอด เพราะสองชื่อนั้นบังเอิญตรงกันทั้งสองรุ่น —
 * ซึ่งเป็นเหตุผลว่าทำไมหน้ากระดาษถึงดูเหมือนทำงาน
 *
 * ร่างของรุ่นก่อนยังพิมพ์ได้เหมือนเดิม: อ่านชื่อใหม่ก่อน แล้วตกไปชื่อเก่า
 */
function farmForForm(raw) {
    const farm = obj(raw);
    const doc = obj(farm.landDocumentDetail);
    const coordinates = farm.coordinates
        || [farm.latitude, farm.longitude].filter((v) => v || v === 0).join(', ');
    return {
        ...farm,
        name: farm.siteName || farm.farmName || '',
        address: farm.siteAddress || farm.address || '',
        landDocumentType: doc.type || farm.landDocumentType || '',
        landDocumentNumber: doc.number || farm.landDocumentNumber || '',
        coordinates,
    };
}

/** ส่วนที่ ๒ — site, land and variety. */
function sectionTwo(f) {
    const farm = farmForForm(f.farm);
    const ticked = new Set(f.areaTypes);

    const areaLine = f.areaUnreadable || ticked.size === 0
        ? '<div class="note">ยังไม่ได้ระบุลักษณะพื้นที่</div>'
        : `<div class="boxes">${AREA_BOXES.map((o) => {
            const mark = `${box(ticked.has(o.value))} ${esc(o.label)}`;
            // The form's own ☐ อื่น ๆ ระบุ ................ — the applicant's words
            // belong beside THIS box and nowhere else.
            const suffix = o.value === 'OTHER'
                ? ` ระบุ <span class="ink">${field(f.areaTypeOther)}</span>`
                : '';
            return `<span class="box">${mark}${suffix}</span>`;
        }).join('')}</div>`;

    return `${sectionHead('๒', 'ข้อมูลสถานที่ ที่ดิน และพันธุ์พืช')}<div class="body">
        ${row('ชื่อสถานที่/ฟาร์ม', farm.name)}
        ${row('ที่ตั้ง', [farm.address, farm.subDistrict && `ต.${farm.subDistrict}`,
        farm.district && `อ.${farm.district}`, farm.province && `จ.${farm.province}`]
        .filter(Boolean).join(' '))}
        ${row('เอกสารสิทธิ์ที่ดิน', [farm.landDocumentType, farm.landDocumentNumber].filter(Boolean).join(' เลขที่ '))}
        <div class="row"><span class="lbl">การถือครองที่ดิน</span><span class="val">
            ${boxes(LAND_TENURE_BOXES, (c) => c === f.landTenure)}</span></div>
        ${f.landTenure === 'RENTED' ? row('ชื่อผู้ให้เช่า', farm.landlordName) : ''}
        <div class="row"><span class="lbl">ลักษณะพื้นที่</span><span class="val">${areaLine}</span></div>
        ${row('ขนาดพื้นที่ปลูก (ตารางเมตร)', farm.areaSqm)}
        ${row('พิกัด', farm.coordinates)}
        <div class="row"><span class="lbl">วัตถุประสงค์</span><span class="val">
            ${boxes(PURPOSE_BOXES, (c) => f.purposes.includes(c))}</span></div>
    </div>`;
}

/**
 * ส่วนที่ ๓ — the papers, exactly as the engine judged them.
 *
 * "ยังไม่ได้แนบ" is printed ONLY against a paper that is required and missing.
 * An optional paper nobody attached is not something the filing lacks, and
 * marking it as such would put a farmer under a demand the ministry never made.
 */
function sectionThree(f) {
    if (f.slots.length === 0) {
        return `${sectionHead('๓', 'เอกสารประกอบคำขอ')}<div class="body"><div class="note">ยังไม่มีรายการเอกสารสำหรับคำขอนี้</div></div>`;
    }
    const rows = f.slots.map((s) => {
        const label = field(s.labelTH || s.slotId, 'ไม่ทราบชื่อเอกสาร');
        const missing = s.required === true && s.satisfied !== true;
        const tail = missing
            ? '<span class="miss">ยังไม่ได้แนบ</span>'
            : (s.satisfied === true ? `<span class="ok">${field(s.fileName, 'แนบแล้ว')}</span>` : '');
        const flag = s.required === true ? '' : '<span class="opt">(ไม่บังคับ)</span>';
        return `<div class="slot">${box(s.satisfied === true)} ${label} ${flag}${tail}</div>`;
    }).join('');
    return `${sectionHead('๓', 'เอกสารประกอบคำขอ')}<div class="body">${rows}</div>`;
}

/** ส่วนที่ ๔ — the five คำรับรอง the applicant signs, and when they signed. */
const DECLARATIONS = Object.freeze([
    'ข้าพเจ้าขอรับรองว่าข้อความและเอกสารที่ยื่นนี้เป็นความจริงทุกประการ',
    'ข้าพเจ้ายินยอมให้พนักงานเจ้าหน้าที่เข้าตรวจสอบสถานที่ตามที่แจ้งไว้',
    'ข้าพเจ้าจะปฏิบัติตามหลักเกณฑ์และเงื่อนไขการรับรองมาตรฐาน GACP',
    'ข้าพเจ้าจะแจ้งให้ทราบเมื่อมีการเปลี่ยนแปลงข้อมูลที่ยื่นไว้',
    'ข้าพเจ้าทราบว่าการให้ข้อมูลเท็จเป็นเหตุให้เพิกถอนการรับรองได้',
]);

function sectionFour(f) {
    const acceptedAt = f.formData.declarationsAcceptedAt || f.app.declarationsAcceptedAt || null;
    const stamp = acceptedAt
        ? `<div class="stamp">ยืนยันเมื่อ ${esc(thaiDate(acceptedAt))}</div>`
        : '';
    const items = DECLARATIONS
        .map((t) => `<div class="decl">${box(Boolean(acceptedAt))} ${esc(t)}</div>`)
        .join('');
    return `${sectionHead('๔', 'คำรับรองของผู้ขอรับการรับรอง')}<div class="body">${items}${stamp}</div>`;
}

// ── the page ─────────────────────────────────────────────────────────────────

const STYLE = `
  .k1{font-family:"Sarabun","TH Sarabun New",sans-serif;font-size:13px;color:#1a1a1a;line-height:1.7}
  .k1 .code{border:1.5px solid #1a1a1a;display:inline-block;padding:4px 12px;font-weight:700;letter-spacing:.05em}
  .k1 h1{font-size:16px;text-align:center;margin:10px 0 2px;font-weight:700}
  .k1 .sub{text-align:center;font-size:12px;color:#555;margin-bottom:14px}
  .k1 .sec{background:#f1f5f4;border-left:4px solid #0F5F6B;font-size:14px;font-weight:700;margin:16px 0 0;padding:6px 10px}
  .k1 .body{border:1px solid #d9e0df;border-top:0;padding:10px 12px}
  .k1 .row{display:flex;gap:10px;padding:3px 0;align-items:flex-start}
  .k1 .lbl{min-width:190px;color:#555}
  .k1 .val{flex:1}
  .k1 .box{display:inline-block;margin-right:18px;white-space:nowrap}
  .k1 .boxes{display:flex;flex-wrap:wrap;gap:4px 0}
  .k1 .ink{border-bottom:1px dotted #999;padding:0 6px;white-space:normal}
  .k1 .slot{padding:3px 0}
  .k1 .miss{color:#b42318;margin-left:10px}
  .k1 .ok{color:#0F5F6B;margin-left:10px}
  .k1 .opt{color:#777;margin-left:6px}
  .k1 .note{color:#777}
  .k1 .decl{padding:2px 0}
  .k1 .stamp{margin-top:8px;color:#0F5F6B;font-weight:600}
  .k1 .meta{display:flex;justify-content:space-between;font-size:12px;color:#555;margin-top:6px}
`;

/**
 * @param {object} application            the filing (Prisma Application row shape)
 * @param {object} [requirementsPayload]  application-requirements-service output
 * @returns {string} HTML fragment, self-contained and safe to embed
 */
function renderKatorlor1Html(application, requirementsPayload) {
    const f = readFiling(application, requirementsPayload);

    const header = `
      <div class="code">แบบกัญชา กทล ๑</div>
      <h1>คำขอรับการรับรองมาตรฐาน GACP สำหรับกัญชา</h1>
      <div class="sub">กรมการแพทย์แผนไทยและการแพทย์ทางเลือก กระทรวงสาธารณสุข</div>
      <div class="row"><span class="lbl">ประเภทคำขอ</span><span class="val">
        ${boxes(REQUEST_TYPE_BOXES, (c) => c === f.requestType)}</span></div>
      <div class="row"><span class="lbl">ขอบข่ายการรับรอง</span><span class="val">
        ${boxes(CERT_SCOPE_BOXES, (c) => c === f.certScope)}</span></div>
      <div class="meta">
        <span>เลขที่คำขอ ${field(f.app.applicationNumber, 'ยังไม่ออกเลขที่')}</span>
        <span>วันที่ยื่น ${esc(thaiDate(f.app.submittedAt))}</span>
      </div>`;

    return `<style>${STYLE}</style><div class="k1">${header}`
        + `${sectionOne(f)}${sectionTwo(f)}${sectionThree(f)}${sectionFour(f)}</div>`;
}

/**
 * The same form as a PDF, through the engine every other document here uses.
 *
 * Same renderer, so the paper and the screen cannot drift — which is the whole
 * reason this module exists rather than a template file beside the others.
 */
async function renderKatorlor1Pdf(application, requirementsPayload) {
    // Sarabun is VENDORED, never fetched (data-sovereignty ruling 2026-07-25):
    // every template used to @import the face from a foreign font CDN on every
    // render. pdf-assets is the one place that embeds it, and the logo, as data:
    // URIs — which is also what the Puppeteer sub-resource allowlist expects.
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">`
        + `<title>แบบกัญชา กทล ๑</title>`
        + `<style>${pdfAssets.getSarabunFontFaceCss()}</style></head><body>`
        + `${renderKatorlor1Html(application, requirementsPayload)}</body></html>`;
    return pdfGenerator.generatePDF(html, {
        format: 'A4',
        landscape: false,
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
}

module.exports = {
    renderKatorlor1Html,
    renderKatorlor1Pdf,
    AREA_BOXES,
    DECLARATIONS,
    // Exported so a test can guard it from the outside. Since 2026-09-08 the request
    // boundary no longer rewrites input (operator ruling: pass through, escape at
    // render), so THIS function is what stands between applicant text and the two
    // dangerouslySetInnerHTML call sites that display it. Removing it is no longer a
    // style change — see __tests__/unit/input-survives-the-round-trip.test.js.
    escapeHtml: esc,
};
