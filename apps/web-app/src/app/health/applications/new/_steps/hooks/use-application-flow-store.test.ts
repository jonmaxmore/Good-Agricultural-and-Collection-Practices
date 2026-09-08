import { isStepComplete, firstIncompleteStep } from './use-application-flow-store';
import type { WizardState } from './use-application-flow-store.state-types';

// Minimal-but-complete WizardState matching the store's initialState shape.
const base = {
  currentStep: 0,
  plantId: null,
  serviceType: null,
  serviceTypes: [],
  certificationPurposes: [],
  siteTypes: [],
  licensePdfUrl: null,
  consentedPDPA: false,
  acknowledgedStandards: false,
  applicantData: null,
  siteData: null,
  productionData: null,
  harvestData: null,
  securityData: null,
  documents: [],
  youtubeUrl: '',
  locationType: null,
  generalInfo: null,
  syncStatus: 'SYNCED',
  cultivationMethods: [],
  cultivationDetails: null,
  stepDocuments: [],
  plantTracking: [],
  qrCount: 0,
  estimatedQRCost: 0,
  farmData: null,
  plots: [],
  lots: [],
} as unknown as WizardState;

describe('wizard step gating — isStepComplete / firstIncompleteStep', () => {
  // Regression: the new-applicant hard-lock. A step that demands something its own
  // screen has no control for can never complete, so firstIncompleteStep pins there
  // and application-step-page bounces every forward navigation back to it — no new
  // application can be created at all. It happened on v1 step 1 (it required
  // certificationPurposes, which only step 2 collected). The v2 shape is different but
  // the trap is the same, so the guard stays and points at v2 step 1.
  it('step 1 completes on what its own screen collects — request type, applicant and PLANT', () => {
    // The plant moved here from step 4 on 2026-09-06 (F-QA-04): the register keys its
    // document rules on the plant, so a filing without one resolves to zero slots and
    // steps 2-3 show no uploads at all.
    const s: WizardState = { ...base, requestType: 'NEW', applicantType: 'INDIVIDUAL', certScope: 'PLANTING', plantId: 'cannabis' };
    expect(isStepComplete(s, 1)).toBe(true);
    expect(firstIncompleteStep(s)).toBe(2); // advances to identity, NOT stuck at 1
  });

  it('step 1 stays incomplete while any of its own three answers is missing', () => {
    // Request type + applicant + PLANT. (The scope question is retired — ขอใหม่ writes
    // PLANTING silently — but the plant itself is asked here since F-QA-04.)
    expect(isStepComplete({ ...base, requestType: 'NEW', applicantType: 'INDIVIDUAL' }, 1)).toBe(false);
    expect(isStepComplete({ ...base, requestType: 'NEW', applicantType: 'INDIVIDUAL', plantId: 'cannabis' }, 1)).toBe(true);
    expect(isStepComplete({ ...base, requestType: 'NEW', certScope: 'PLANTING' }, 1)).toBe(false);
    expect(isStepComplete({ ...base, applicantType: 'INDIVIDUAL', certScope: 'PLANTING' }, 1)).toBe(false);
    expect(firstIncompleteStep({ ...base, requestType: 'NEW' })).toBe(1);
  });

  it('step 4 gates on purpose — the plant moved to step 1 (F-QA-04)', () => {
    // NOT on cultivationMethods: ลักษณะพื้นที่ moved to step 3, where the paper puts it.
    // Demanding it on a step that no longer collects it is the v1 hard-lock exactly.
    const almost: WizardState = { ...base, plantId: 'cannabis' };
    // purpose still empty → step 4 incomplete (the requirement lives on that screen)
    expect(isStepComplete({ ...almost, certificationPurposes: [] }, 4)).toBe(false);
    expect(isStepComplete({ ...almost, certificationPurposes: ['MEDICAL'] }, 4)).toBe(true);
    // The PLANT is still load-bearing — a filing that names none is refused by the submit
    // gate — but it is STEP 1's answer since F-QA-04, and step 1 refuses to complete without
    // it, so the wizard can never reach step 4 with a null plant. Step 4 no longer re-asks.
    expect(isStepComplete({ ...almost, plantId: null }, 1)).toBe(false);
  });
});
