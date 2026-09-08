'use client';


import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/primitives/badge';
import { Button } from '@/components/ui/primitives/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives/card';
import { Icons } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';
import { apiClient as api } from '@/lib/api';
import { useApplicationFlowStore } from '../../hooks/use-application-flow-store';

interface ApplicationForEdit {
  id: string;
  applicationNumber: string;
  status: string;
  reviewComment?: string;
  // Backend whitelisted formData (apps/backend/routes/api/helpers/
  // application-payload-builders.js). Every field below is read by
  // handleStartEdit() so the wizard mounts with the saved draft.
  formData?: {
    plantId?: string;
    serviceType?: string;
    serviceTypes?: string[];
    certificationPurpose?: string | null;  // Legacy single string
    certificationPurposes?: string[];       // Canonical array
    cultivationMethod?: string;             // Legacy single string
    cultivationMethods?: string[];          // Canonical array
    siteTypes?: string[];
    locationType?: string | null;
    licensePdfUrl?: string | null;
    applicantData?: unknown;
    generalInfo?: unknown;
    farmData?: unknown;
    siteData?: unknown;
    productionData?: unknown;
    harvestData?: unknown;
    securityData?: unknown;
    cultivationDetails?: unknown;
    plantTracking?: unknown[];
    stepDocuments?: unknown[];
    plots?: unknown[];
    lots?: unknown[];
    documents?: unknown[];
    youtubeUrl?: string;
    qrCount?: number;
    estimatedQRCost?: number;
    consentedPDPA?: boolean;
    acknowledgedStandards?: boolean;
    _lastReviewComment?: string;
  };
  // Top-level fallbacks — older API responses sometimes spread these
  // out of formData. Kept for backward compat; new code reads formData.
  applicantData?: unknown;
  siteData?: unknown;
  productionData?: unknown;
  farmData?: unknown;
  plots?: unknown[];
  lots?: unknown[];
  documents?: unknown[];
}

const SUPPORTED_PLANT_IDS = ['cannabis', 'kratom', 'turmeric', 'ginger', 'black_galangal', 'plai'] as const;
const SUPPORTED_SERVICE_TYPES = ['NEW', 'RENEWAL', 'MODIFY', 'REPLACEMENT'] as const;
// The two objectives กทล.1 certifies. A draft saved with the retired RESEARCH or
// COMMERCIAL is filtered out here rather than carried forward, so an applicant editing
// an old draft is asked the question again instead of inheriting a purpose the form no
// longer offers and no officer can act on.
const SUPPORTED_CERTIFICATION_PURPOSES = ['MEDICAL', 'EXPORT'] as const;
const SUPPORTED_CULTIVATION_METHODS = ['outdoor', 'greenhouse', 'indoor'] as const;

function isSupportedPlantId(value: unknown): value is (typeof SUPPORTED_PLANT_IDS)[number] {
  return typeof value === 'string' && (SUPPORTED_PLANT_IDS as readonly string[]).includes(value);
}

function isSupportedServiceType(value: unknown): value is (typeof SUPPORTED_SERVICE_TYPES)[number] {
  return typeof value === 'string' && (SUPPORTED_SERVICE_TYPES as readonly string[]).includes(value);
}

function isSupportedCertificationPurpose(value: unknown): value is (typeof SUPPORTED_CERTIFICATION_PURPOSES)[number] {
  return typeof value === 'string' && (SUPPORTED_CERTIFICATION_PURPOSES as readonly string[]).includes(value);
}

function isSupportedCultivationMethod(value: unknown): value is (typeof SUPPORTED_CULTIVATION_METHODS)[number] {
  return typeof value === 'string' && (SUPPORTED_CULTIVATION_METHODS as readonly string[]).includes(value);
}

export default function EditApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const [application, setApplication] = useState<ApplicationForEdit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // W1-RETRY — transport/5xx load failure. Previously a backend-down 503
  // fell into the terminal 'ไม่พบคำขอที่ระบุ' ("not found") alert with only
  // a back link: a definitive bad-state claim on a fetch failure, with no
  // retry (live probe 2026-07-24). This flag drives the amber indeterminate
  // ServiceUnavailable state (role="status") with a retry that re-fires the
  // same fetch. Terminal outcomes (4xx, non-editable status) keep `error`.
  const [unavailable, setUnavailable] = useState(false);

  const {
    updateState,
    setApplicantData,
    setSiteData,
    setProductionData,
    setHarvestData,
    setSecurityData,
    setFarmData,
    setPlots,
    setLots,
    setDocuments,
    setYoutubeUrl,
    setGeneralInfo,
    setLocationType,
    setSiteTypes,
    setLicensePdfUrl,
    setApplicationId,
    resetWizard,
  } = useApplicationFlowStore();

  const loadApplicationForEdit = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setUnavailable(false);

      const result = await api.get<ApplicationForEdit>(`/applications/${applicationId}`);

      // W1-RETRY: a 5xx or statusless failure (network / timeout — the
      // apiClient returns no `status` for those) means NO verdict was
      // reached about this application. Show the indeterminate retry
      // state instead of claiming the application does not exist.
      if (!result.success && (result.status === undefined || result.status >= 500)) {
        setUnavailable(true);
        return;
      }

      if (!result.success || !result.data) {
        setError('ไม่พบคำขอที่ระบุ');
        return;
      }

      const app = result.data;

      const editableStatuses = ['REVISION_REQUESTED', 'CAR_PENDING', 'DRAFT'];
      if (!editableStatuses.includes(app.status)) {
        setError(`ไม่สามารถแก้ไขคำขอที่มีสถานะ "${app.status}" ได้`);
        return;
      }

      setApplication(app);
    } catch (err: unknown) {
      console.error('[EditPage] Error loading application:', err);
      // Thrown fetch = transport failure — indeterminate, retryable.
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadApplicationForEdit();
  }, [loadApplicationForEdit]);

  const handleStartEdit = () => {
    if (!application) {
      return;
    }

    resetWizard();
    setApplicationId(applicationId);

    // Step 4 — applicant
    if (application.applicantData || application.formData?.applicantData) {
      setApplicantData((application.applicantData || application.formData?.applicantData) as Parameters<typeof setApplicantData>[0]);
    }

    // Step 5 — farm + plots + lots + siteData
    if (application.siteData || application.formData?.siteData) {
      setSiteData((application.siteData || application.formData?.siteData) as Parameters<typeof setSiteData>[0]);
    }
    if (application.farmData || application.formData?.farmData) {
      setFarmData((application.farmData || application.formData?.farmData) as Parameters<typeof setFarmData>[0]);
    }
    if (application.plots || application.formData?.plots) {
      setPlots((application.plots || application.formData?.plots || []) as Parameters<typeof setPlots>[0]);
    }
    if (application.lots || application.formData?.lots) {
      setLots((application.lots || application.formData?.lots || []) as Parameters<typeof setLots>[0]);
    }

    // Step 6 — production + cultivation details
    if (application.productionData || application.formData?.productionData) {
      setProductionData((application.productionData || application.formData?.productionData) as Parameters<typeof setProductionData>[0]);
    }

    // Step 7 — harvest + security (BLOCKING bug: previously not hydrated;
    // step 7 came up blank in edit mode because setHarvestData was never
    // called. Same for security data which is rolled into farmData by
    // some step variants but persisted as its own slice for others).
    if (application.formData?.harvestData) {
      setHarvestData(application.formData.harvestData as Parameters<typeof setHarvestData>[0]);
    }
    if (application.formData?.securityData) {
      setSecurityData(application.formData.securityData as Parameters<typeof setSecurityData>[0]);
    }

    // Step 8 — documents + video link
    if (application.documents || application.formData?.documents) {
      setDocuments((application.documents || application.formData?.documents || []) as Parameters<typeof setDocuments>[0]);
    }
    if (application.formData?.youtubeUrl) {
      setYoutubeUrl(application.formData.youtubeUrl);
    }

    // Cross-cutting (used by reviews / official-document component)
    if (application.formData?.generalInfo) {
      setGeneralInfo(application.formData.generalInfo as Parameters<typeof setGeneralInfo>[0]);
    }
    if (application.formData?.licensePdfUrl) {
      setLicensePdfUrl(application.formData.licensePdfUrl);
    }
    if (application.formData?.locationType) {
      setLocationType(application.formData.locationType as Parameters<typeof setLocationType>[0]);
    }
    if (Array.isArray(application.formData?.siteTypes) && application.formData.siteTypes.length > 0) {
      setSiteTypes(application.formData.siteTypes as Parameters<typeof setSiteTypes>[0]);
    }

    const normalizedPlantId = isSupportedPlantId(application.formData?.plantId)
      ? application.formData.plantId
      : 'cannabis';
    const normalizedServiceType = isSupportedServiceType(application.formData?.serviceType)
      ? application.formData.serviceType
      : 'NEW';
    // Backward-compatible: handle both old certificationPurpose (string) and new certificationPurposes (array)
    const rawPurposes = application.formData?.certificationPurposes
      || (application.formData?.certificationPurpose ? [application.formData.certificationPurpose] : []);
    const normalizedPurposes = rawPurposes.filter(isSupportedCertificationPurpose);
    // Cultivation methods: prefer canonical array; fall back to legacy single string.
    const rawCultivationMethods = (application.formData?.cultivationMethods && application.formData.cultivationMethods.length > 0)
      ? application.formData.cultivationMethods
      : (application.formData?.cultivationMethod ? [application.formData.cultivationMethod] : []);
    const normalizedCultivationMethods = rawCultivationMethods.filter(isSupportedCultivationMethod);

    // V4 store fields without dedicated setters — set via updateState.
    // Without these, step 6 and the review step come up partially blank.
    const cultivationDetails = application.formData?.cultivationDetails;
    const stepDocuments = application.formData?.stepDocuments;
    const plantTracking = application.formData?.plantTracking;
    const qrCount = application.formData?.qrCount;
    const estimatedQRCost = application.formData?.estimatedQRCost;

    updateState({
      plantId: normalizedPlantId,
      serviceType: normalizedServiceType,
      certificationPurposes: normalizedPurposes,
      cultivationMethods: normalizedCultivationMethods,
      // Use saved consent values — hard-coding `true` here meant we
      // silently flipped consent on for any draft that hadn't accepted
      // it yet, which was both incorrect and a compliance footgun.
      consentedPDPA: Boolean(application.formData?.consentedPDPA),
      acknowledgedStandards: Boolean(application.formData?.acknowledgedStandards),
      ...(cultivationDetails !== undefined ? { cultivationDetails: cultivationDetails as NonNullable<Parameters<typeof updateState>[0]['cultivationDetails']> } : {}),
      ...(Array.isArray(stepDocuments) ? { stepDocuments: stepDocuments as NonNullable<Parameters<typeof updateState>[0]['stepDocuments']> } : {}),
      ...(Array.isArray(plantTracking) ? { plantTracking: plantTracking as NonNullable<Parameters<typeof updateState>[0]['plantTracking']> } : {}),
      ...(typeof qrCount === 'number' ? { qrCount } : {}),
      ...(typeof estimatedQRCost === 'number' ? { estimatedQRCost } : {}),
    });

    sessionStorage.setItem('gacp_edit_mode', JSON.stringify({
      isEditMode: true,
      applicationId,
      revisionComment: application.reviewComment || application.formData?._lastReviewComment || '',
      applicationNumber: application.applicationNumber,
    }));

    router.push(`/health/applications/new?edit=${application.id}`);
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-lg bg-card p-4 shadow-sm">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
            <Spinner size="lg" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลคำขอ...</p>
          </CardContent>
        </div>
      </div>
    );
  }

  // W1-RETRY — backend unreachable / 5xx: amber indeterminate
  // ServiceUnavailable pattern (mirrors the public verify page):
  // role="status", Thai headline + English subline, retry re-fires the
  // SAME fetch. Never the red "not found" alert — no verdict was reached.
  if (unavailable) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div
          role="status"
          data-testid="edit-load-unavailable"
          className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
              <Icons.AlertTriangle size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 leading-snug">
              <p className="text-base font-bold text-amber-800">ยังโหลดข้อมูลคำขอไม่ได้ในขณะนี้</p>
              <p className="mt-1 text-sm text-amber-700">
                ระบบขัดข้องชั่วคราว ยังไม่สามารถแสดงข้อมูลคำขอได้ กรุณาลองใหม่อีกครั้ง
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Unable to load the application right now. Please try again.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              data-testid="edit-load-retry"
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => void loadApplicationForEdit()}
            >
              ลองอีกครั้ง
            </Button>
            <Button asChild variant="subtle">
              <Link href={`/health/applications/${applicationId}`}>
                <Icons.ArrowLeft size={16} className="mr-2" />
                กลับไปหน้าคำขอ
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Alert variant="error" title="ไม่สามารถแก้ไขได้">
          <p>{error}</p>
        </Alert>
        <div className="mt-4">
          <Button asChild >
            <Link href={`/health/applications/${applicationId}`}>
              <Icons.ArrowLeft size={16} className="mr-2" />
              กลับไปหน้าคำขอ
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const revisionComment = application?.reviewComment || application?.formData?._lastReviewComment;

  return (
    <div className="w-full px-4 py-8 sm:px-6">
      <div className="space-y-5">
        <Button asChild variant="subtle" className="w-fit">
          <Link href={`/health/applications/${applicationId}`}>
            <Icons.ArrowLeft size={16} className="mr-2" />
            กลับ
          </Link>
        </Button>

        <div className="rounded-lg bg-card p-4 shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Icons.Edit size={22} />
              </div>
              <div>
                <CardTitle className="text-xl">แก้ไขคำขอ</CardTitle>
                <CardDescription>
                  {application?.applicationNumber || `#${applicationId.slice(-6).toUpperCase()}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </div>

        {revisionComment ? (
          <Alert variant="warning" title="หมายเหตุจากเจ้าหน้าที่">
            <p className="whitespace-pre-wrap text-sm">{revisionComment}</p>
            <p className="mt-2 text-xs text-amber-800/80">กรุณาตรวจสอบและแก้ไขข้อมูลตามหมายเหตุด้านบน</p>
          </Alert>
        ) : null}

        <div className="rounded-lg bg-card p-4 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icons.FileText size={18} />
              ขั้นตอนการแก้ไข
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/90">
              <li>อ่านหมายเหตุจากเจ้าหน้าที่ด้านบน</li>
              <li>กดปุ่มเริ่มแก้ไขเพื่อเปิดแบบฟอร์ม</li>
              <li>แก้ไขข้อมูลที่ต้องการในแต่ละขั้นตอน</li>
              <li>ตรวจสอบความถูกต้องและกดส่งใหม่</li>
            </ul>
          </CardContent>
        </div>

        <div className="rounded-lg bg-card p-4 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">สถานะปัจจุบัน</p>
              <Badge tone="warning" className="mt-2">ต้องแก้ไขเอกสาร</Badge>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">หลังส่งแก้ไข</p>
              <Badge tone="info" className="mt-2">รอตรวจสอบอีกครั้ง</Badge>
            </div>
          </CardContent>
        </div>

        <Button size="lg" variant="primary" className="w-full" onClick={handleStartEdit}>
          <Icons.Edit size={18} className="mr-2" />
          เริ่มแก้ไขคำขอ
          <Icons.ChevronRight size={18} className="ml-2" />
        </Button>

        <Button asChild variant="subtle" className="w-full">
          <Link href={`/health/applications/${applicationId}`}>ยกเลิก</Link>
        </Button>
      </div>
    </div>
  );
}
