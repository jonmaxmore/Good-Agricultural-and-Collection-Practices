/**
 * ราคาค่าธรรมเนียม — คิดเงิน ไม่ใช่รับเงิน
 *
 * ระบบเต็มวางไฟล์นี้ไว้ใน modules/billing/internal/ พร้อมกับ payment-constants
 * (คีย์ Stripe, ช่องทางชำระ) ราวกับเป็นเรื่องเดียวกัน · มันคนละเรื่อง: การคิดราคาคือ
 * กติกาของกรมฯ ส่วนการรับเงินคือช่องทางที่ลูกค้าเลือกเอง GACP Lite ทิ้งอย่างหลังและ
 * เก็บอย่างแรกไว้ทั้งดุ้น เพราะราคาต้องตรงกับของจริง
 *
 * ตัวเลขทั้งหมดมาจาก config/business-rules.js ซึ่งอ่านทับได้ด้วย SystemConfig —
 * ไม่มีราคาใดถูกพิมพ์ไว้ในโค้ดเส้นทาง API
 */
const { FEES } = require('../config/business-rules');

const FEE_RATES = {
  PHASE1_PER_SCOPE: FEES.PHASE1_PER_SCOPE,
  PHASE2_PER_SCOPE: FEES.PHASE2_PER_SCOPE,
  // Certificate renewal — ONE charge (operator ruling 2026-08-22, final).
  // Published here so the public pricing route reads it from the same object
  // it reads the phase fees from, instead of re-spelling a literal.
  //
  // It deliberately does NOT enter calculatePhase1Fee / calculatePhase2Fee: a
  // renewal is not a phased application. Making the CHECKOUT charge this once
  // instead of billing the phase pair means touching invoice/checkout creation,
  // which is money-mutation territory (L3) — that change is written up as a
  // PROPOSAL in reports/design-cleanup-2026-08-21/W12-renewal-fast-path.md and
  // is deliberately NOT applied here.
  RENEWAL_PER_SCOPE: FEES.RENEWAL_PER_SCOPE,
};

const PLATFORM_RATE = FEES.PLATFORM_RATE;
const VAT_RATE = FEES.VAT_RATE;

function toPositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeMethod(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized || null;
}

function collectUniqueCultivationMethods(payload = {}) {
  const unique = new Set();

  // ลักษณะพื้นที่ — what the SIX-STEP wizard actually writes (กทล.๑ ส่วนที่ ๒ is a
  // checkbox row; the wizard stores the ticks nested under farmData) and what the
  // farmer SEES and SELECTS. It is AUTHORITATIVE when present.
  //
  // Operator ruling 2026-09-06 (superseding the earlier "legacy cultivationMethods
  // wins"): the price must equal what step 3 selected. A demo filing carried a stale
  // cultivationMethods=[3 methods] alongside areaTypes=[INDOOR] and was billed for
  // three — "เลือก 1 รูปแบบการปลูก ทำไมจ่ายของ 3". areaTypes now outranks the legacy
  // key; cultivationMethods is only the fallback for old filings that never wrote
  // areaTypes. The submit gate reads the SAME precedence (canonical-application-
  // validator) so the gate and the price never disagree.
  const nestedAreaTypes = Array.isArray(payload?.formData?.farmData?.areaTypes)
    ? payload.formData.farmData.areaTypes
    : (Array.isArray(payload?.farmData?.areaTypes) ? payload.farmData.areaTypes : []);
  for (const method of nestedAreaTypes) {
    const normalized = normalizeMethod(method);
    if (normalized) {
      unique.add(normalized);
    }
  }

  // Legacy cultivationMethods (direct + nested) — FALLBACK only, used when the filing
  // wrote no areaTypes (pre-six-step data). Skipped entirely once areaTypes answered.
  if (unique.size === 0) {
    const legacy = [
      ...(Array.isArray(payload?.cultivationMethods) ? payload.cultivationMethods : []),
      ...(Array.isArray(payload?.formData?.cultivationMethods) ? payload.formData.cultivationMethods : []),
    ];
    for (const method of legacy) {
      const normalized = normalizeMethod(method);
      if (normalized) {
        unique.add(normalized);
      }
    }
  }

  if (unique.size === 0) {
    const plots = Array.isArray(payload?.plots) ? payload.plots : [];
    for (const plot of plots) {
      const normalized = normalizeMethod(plot?.solarSystem || plot?.cultivationMethod || plot?.locationType);
      if (normalized) {
        unique.add(normalized);
      }
    }
  }

  if (unique.size === 0) {
    const fallbackSingle = normalizeMethod(payload?.locationType || payload?.areaType);
    if (fallbackSingle) {
      unique.add(fallbackSingle);
    }
  }

  return [...unique];
}

/**
 * WHICH cultivation types this filing declared — the list, not the tally.
 *
 * Operator ruling 2026-09-06: *"มันเป็นการบวกมากกว่า ... ราคาก็เอามารวมกัน"*. The fee is a
 * SUM over the declared types, so the types themselves are what the pricing needs; a count
 * is only what you keep when every type happens to cost the same, and it stops being true
 * the day one of them does not.
 *
 * `options.scopes` overrides for a caller that already resolved them (the combined
 * calculation resolves once and hands both phases the same answer). `options.scopeCount`
 * is still honoured for older callers and yields anonymous placeholder scopes, because a
 * caller that only knew a number never knew which types they were.
 */
function resolveCultivationScopes(formData = {}, options = {}) {
  if (Array.isArray(options.scopes) && options.scopes.length > 0) {
    return options.scopes.map(normalizeMethod).filter(Boolean);
  }

  const methods = collectUniqueCultivationMethods(formData);
  const explicit = toPositiveInt(options.scopeCount);

  if (explicit) {
    // A caller that names a count AND a filing that names its types agree in the ordinary
    // case, and then the TYPES win — losing the names to an anonymous SCOPE_n would put
    // "รูปแบบการปลูกที่ 1" on a document that could have said "แบบกลางแจ้ง".
    //
    // When they disagree the caller knows something the filing no longer does — a frozen
    // row was priced for N types and the application now names a different number — and
    // no line may claim to be one of them (ruling 12, 2026-08-28). That is the only case
    // that earns the placeholders.
    if (methods.length === explicit) {
      return methods;
    }
    return Array.from({ length: explicit }, (_unused, i) => `SCOPE_${i + 1}`);
  }

  if (methods.length > 0) {
    return methods;
  }

  // A filing that declares nothing is charged for one, never zero: a zero-scope fee is a
  // free certificate, which is a worse answer than the minimum charge.
  return ['SCOPE_1'];
}

function resolveCultivationScopeCount(formData = {}, options = {}) {
  return resolveCultivationScopes(formData, options).length;
}

function buildPhaseFee({ scopes, scopeCount, ratePerScope, rateForScope, phase, label }) {
  // W14 — single-issuer fee model (operator ruling 2026-08-22, HARNESS_LOG.md
  // @ c28355ea; figures confirmed @ d1c33ea0):
  //
  //   ค่าบริการ (service fee) = ราคาเต็ม (state) + ค่าแพลตฟอร์ม (10% of state)
  //   ยอดชำระ (payable)      = ค่าบริการ + VAT 7% OF THE WHOLE SERVICE FEE
  //
  // The retired formula charged VAT on the platform portion only
  // (`vatAmount = Math.round(platformAmount * VAT_RATE)`). It is gone, not
  // flagged off: ONE company issues the quotation, the billing note and the
  // receipt, so the entire ค่าบริการ is that company's VATable supply. The state
  // portion is no longer a VAT-exempt government receipt collected by an agent
  // — the farmer buys a service from the company, and the company settles with
  // DTAM separately, outside this system.
  //
  // ROUNDING: none is load-bearing. state is a multiple of 5,000, so platform
  // (10% of it) and VAT (7% of 11/10 × state) both land on integers at every
  // scope count — 5,500 × 0.07 = 385 exactly. Math.round is kept so that a
  // SystemConfig rate override cannot mint fractional satang, but at the
  // configured rates it never actually rounds. That is why phase 1 + phase 2
  // equals the single renewal charge exactly (385n + 1,925n = 2,310n), with no
  // residue-absorption rule anywhere.
  // ── บวก ไม่ใช่คูณ (operator ruling 2026-09-06) ───────────────────────────
  //
  // The state amount is the SUM of one line per declared cultivation type, and every
  // figure below is computed from that sum. It used to be `ratePerScope × scopeCount`,
  // and the quotation then DIVIDED the phase total back by the count to invent a
  // per-type line — the arithmetic running backwards. At today's uniform rates both
  // give the same number; the moment one type is priced differently, multiplication
  // gives wrong lines under a right-looking total, and this gives right lines whose
  // sum IS the total.
  //
  // `rateForScope` is the seam a dated per-type rate table lands on. It defaults to the
  // configured rate for every type, so nothing re-prices today.
  if (!Array.isArray(scopes) || scopes.length === 0) {
    // Loud, not lenient. A caller that reaches here has a scopeCount and no scopes, which
    // under the additive model means nobody knows WHAT is being charged for — and the
    // quiet answer (fall back to a count) is exactly the multiplication this ruling
    // replaced.
    throw new Error(
      'buildPhaseFee needs the declared cultivation scopes — pass `scopes` from '
      + 'resolveCultivationScopes(). A count alone cannot price an additive fee.',
    );
  }

  const rateOf = typeof rateForScope === 'function'
    ? (method) => Number(rateForScope(method)) || 0
    : () => ratePerScope;

  const scopeBreakdown = scopes.map((method) => {
    const lineState = rateOf(method);
    const linePlatform = Math.round(lineState * PLATFORM_RATE);
    const lineService = lineState + linePlatform;
    const lineVat = Math.round(lineService * VAT_RATE);
    return {
      method,
      phase,
      stateAmount: lineState,
      platformAmount: linePlatform,
      serviceFeeAmount: lineService,
      vatAmount: lineVat,
      phaseTotal: lineService + lineVat,
    };
  });

  const stateAmount = scopeBreakdown.reduce((sum, line) => sum + line.stateAmount, 0);
  const platformAmount = Math.round(stateAmount * PLATFORM_RATE);
  const serviceFeeAmount = stateAmount + platformAmount;
  const vatAmount = Math.round(serviceFeeAmount * VAT_RATE);
  const phaseTotal = serviceFeeAmount + vatAmount;
  // `label` only renames the human-readable line descriptions; the amounts
  // above are untouched by it. W12 uses it so the renewal's single charge does
  // not describe itself as "Phase 2" on an invoice.
  const phaseLabel = label || (phase === 'PHASE_1' ? 'Phase 1' : 'Phase 2');

  return {
    scopeCount: scopeBreakdown.length,
    // One entry per declared cultivation type. The document prints these as its
    // numbered lines; their sum is the amount above, not the other way round.
    scopeBreakdown,
    stateAmount,
    platformAmount,
    // ค่าบริการ — the company's VATable supply, and the base VAT is charged on.
    // Published so consumers (quotation subtotal, invoice/receipt subtotal, the
    // pricing API) read the base rather than re-adding state + platform and
    // risking a different answer.
    serviceFeeAmount,
    vatAmount,
    phaseTotal,
    stateItems: [
      {
        description: `${phaseLabel} state fee for ${scopeCount} cultivation method(s)`,
        amount: stateAmount,
      },
    ],
    platformItems: [
      {
        description: `${phaseLabel} platform fee (10% of state fee)`,
        amount: platformAmount,
      },
    ],
    // W14: the VAT base is the whole service fee, and the line says so. The
    // old wording ("7% of platform fee") described the retired formula and
    // would now be a false statement on a tax document.
    vatItems: [
      {
        description: `${phaseLabel} VAT (7% of service fee)`,
        amount: vatAmount,
      },
    ],
    serviceFeeItems: [
      {
        description: `${phaseLabel} service fee (state fee + 10% platform fee)`,
        amount: serviceFeeAmount,
      },
    ],
    // Backward compatibility with existing consumers (state-only items)
    items: [
      {
        description: `${phaseLabel} state fee for ${scopeCount} cultivation method(s)`,
        amount: stateAmount,
      },
    ],
    // `total` is the FULL phase amount (state + platform + VAT) — this is
    // what the gateway charges and what the invoice/receipt sum to. Callers
    // that genuinely need the state-only sub-total should read .stateAmount.
    // (Pre-2026-04-28 audit, this returned stateAmount, which caused a
    // revenue leak: the gateway charged stateAmount while invoices were
    // written for the full phaseTotal.)
    total: phaseTotal,
  };
}


function calculatePhase1Fee(formData = {}, options = {}) {
  return buildPhaseFee({
    scopes: resolveCultivationScopes(formData, options),
    ratePerScope: FEE_RATES.PHASE1_PER_SCOPE,
    rateForScope: options.rateForScope,
    phase: 'PHASE_1',
  });
}

function calculatePhase2Fee(formData = {}, options = {}) {
  return buildPhaseFee({
    scopes: resolveCultivationScopes(formData, options),
    ratePerScope: FEE_RATES.PHASE2_PER_SCOPE,
    rateForScope: options.rateForScope,
    phase: 'PHASE_2',
  });
}

/**
 * W12 (operator ruling 2026-08-22, HARNESS_LOG.md 67ef3612 / 851fd516;
 * billing change authorised as a one-time L3 exception, eabfc020).
 *
 * A certificate renewal is ONE charge. It does not walk the phase-1/phase-2
 * pair, so it has no calculatePhaseNFee of its own — but it must be grossed up
 * by exactly the same arithmetic, or the number the applicant is shown and the
 * number the invoice carries drift apart. It therefore goes through the same
 * buildPhaseFee the phase fees go through: the rates are reused, never
 * re-declared, and the rounding cannot diverge because it is the same code.
 *
 * PER SCOPE (operator correction 2026-08-22, HARNESS_LOG.md 8b8d581f):
 * "ไม่ว่าใหม่ หรือต่อ ต้องคิดเงินแยกรูปแบบการปลูก". scopeCount is resolved by
 * resolveCultivationScopeCount and multiplied inside buildPhaseFee — the exact
 * path calculatePhase1Fee and calculatePhase2Fee take — rather than a second
 * multiplication written here. 1/2/3 scopes bill a base of 30,000 / 60,000 /
 * 90,000 and a payable of 35,310 / 70,620 / 105,930.
 *
 * Those payables were 33,210 / 66,420 / 99,630 here until 2026-09-07, and had been
 * wrong since W14: they are the pre-W14 arithmetic, where VAT was charged on the
 * platform fee alone. W14 made the company the single seller, so VAT is charged on
 * the WHOLE service fee, and the figures rose. Measured, not retyped — read back off
 * calculateRenewalFee on the dated rate table the day this line was written. A money
 * comment that outlives its formula has already misled one operator ruling in this
 * file (line 243 note); this one had drifted the same way.
 *
 * The result is shaped like a phase fee because everything downstream
 * (quotation installments, invoice mint, receipts) already speaks that shape.
 * It is mapped onto the PHASE_2 slot by quotation-service — see the note there
 * for why PHASE_2 and not a new service type.
 */
function calculateRenewalFee(formData = {}, options = {}) {
  return buildPhaseFee({
    scopes: resolveCultivationScopes(formData, options),
    ratePerScope: FEE_RATES.RENEWAL_PER_SCOPE,
    rateForScope: options.rateForScope,
    phase: 'PHASE_2',
    label: 'Certificate renewal',
  });
}

function calculateApplicationFees(formData = {}, options = {}) {
  // Resolved ONCE and handed to both phases, so the two instalments can never disagree
  // about which types the filing declared.
  const scopes = resolveCultivationScopes(formData, options);
  const scopeCount = scopes.length;
  const phase1 = calculatePhase1Fee(formData, { ...options, scopes });
  const phase2 = calculatePhase2Fee(formData, { ...options, scopes });

  const stateTotal = phase1.stateAmount + phase2.stateAmount;
  const platformTotal = phase1.platformAmount + phase2.platformAmount;
  // W14 — ค่าบริการ across both phases. Equals stateTotal + platformTotal and
  // is the base the 7% VAT below is charged on.
  const serviceFeeTotal = phase1.serviceFeeAmount + phase2.serviceFeeAmount;
  const vatTotal = phase1.vatAmount + phase2.vatAmount;
  const grandTotal = serviceFeeTotal + vatTotal;

  return {
    scopeCount,
    phase1,
    phase2,
    // `total` is the sum of phase totals (state + platform + VAT). Equal to
    // grandTotal — kept for back-compat with consumers that already read
    // .total but match what the user actually pays at the gateway.
    total: phase1.total + phase2.total,
    stateTotal,
    platformTotal,
    serviceFeeTotal,
    vatTotal,
    grandTotal,
  };
}


module.exports = {
  FEE_RATES,
  PLATFORM_RATE,
  VAT_RATE,
  resolveCultivationScopeCount,
  resolveCultivationScopes,
  collectUniqueCultivationMethods,
  calculatePhase1Fee,
  calculatePhase2Fee,
  calculateRenewalFee,
  calculateApplicationFees,
};
