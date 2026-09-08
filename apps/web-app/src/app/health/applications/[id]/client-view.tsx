'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconClipboardText,
  IconClock,
  IconCreditCard,
  IconDownload,
  IconFileDescription,
  IconMessageCircle,
  IconProgressCheck,
} from '@tabler/icons-react';
import { Leaf } from 'lucide-react';

import { apiClient as api } from '@/lib/api';
import { HealthActivityTimeline } from './activity-timeline';
import { HEALTH_LOGIN_ROUTE } from '@/lib/constants/auth-routes';
import { getStoredUser } from '@/lib/services/auth-service-session';
import { Button } from '@/components/ui/primitives/button';
import { Card } from '@/components/ui/primitives/card';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { StatusPipeline } from '@/components/feature';
import { GACP_PHASE1_TOTAL, GACP_PHASE2_TOTAL } from '@/constants/fees';
import { useLanguage } from '@/lib/i18n/language-context';
import {
  normalizeHealthDashboardStage,
  STAGE_LABEL_TH,
  STAGE_DESCRIPTION_TH,
  STAGE_NEXT_ACTION_TH,
  STAGE_BADGE_STYLE,
  STEPPER_STEPS,
  getStepperIndex,
  getProgressPercent,
} from '@/lib/health-dashboard-stage';
import {
  deriveApplicationSummary,
  resolveActionMeta,
  resolveStatusMeta,
  toThaiDate,
  toThaiDateTime,
  type ApplicationDetailPayload,
  type ApplicationHistoryPayload,
  type TrackingStatusPayload,
} from './application-detail-page-config';

import {
  upper,
  formatMoney,
  buildTimeline,
  buildOfficerComments,
  resolveActionTarget,
  resolvePaymentFacts
} from './application-detail-page-helpers';

const badgeToneToClass: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-leaf-soft text-leaf-onSoft',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-sky-100 text-sky-700',
};

// ui_kit reskin (Wave 3): status chip = pill + leading colored dot + word,
// matching the ref AppDetail header (StatusBadge) and the verified
// applications-list / dashboard chips. The dot tones mirror the fill tones
// above so a single statusMeta.tone drives both surfaces.
const badgeToneToDot: Record<string, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-leaf-600',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
};

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { dict, language } = useLanguage();
  // Y1-FIX-B — pull copy from dict.health.applicationDetail so the page
  // bilingually localizes. The Y1-AUDIT §2 most-visited surface flagged
  // 36 hardcoded Thai lines here — every one now resolves through dict.
  const detailCopy = dict.health.applicationDetail;

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetailPayload | null>(null);
  const [tracking, setTracking] = useState<TrackingStatusPayload | null>(null);
  const [history, setHistory] = useState<ApplicationHistoryPayload | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace(HEALTH_LOGIN_ROUTE);
      return;
    }

    async function load() {
      if (!id) {
        setError(detailCopy.errorMissingId);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [detailResult, trackingResult, historyResult] = await Promise.all([
          api.get<ApplicationDetailPayload>(`/applications/${id}`),
          api.get<TrackingStatusPayload>(`/applications/${id}/status`),
          api.get<ApplicationHistoryPayload>(`/applications/${id}/history`),
        ]);

        if (!detailResult.success || !detailResult.data) {
          setError(detailResult.error || detailCopy.errorBody);
          setLoading(false);
          return;
        }

        setDetail(detailResult.data);
        setTracking(trackingResult.success ? trackingResult.data || null : null);
        setHistory(historyResult.success ? historyResult.data || null : null);
      } catch (requestError) {
        console.error('[Application Detail] failed to load', requestError);
        setError(detailCopy.errorLoadFailed);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [id, router, detailCopy]);

  // Prefers the canonical step shape; falls back to the wizard's flat formData
  // (applicantData/farmData/plots) when formData.steps is empty — see
  // deriveApplicationSummary. Fixes the blank "คำขอ" for flat-saved apps (2026-06-24).
  const derived = useMemo(() => deriveApplicationSummary(detail, language), [detail, language]);

  const statusKey = upper(tracking?.displayStatus || detail?.status);
  const statusMeta = resolveStatusMeta(statusKey);
  const actionMeta = resolveActionMeta(tracking?.actionCard?.key);
  const actionTarget = detail ? resolveActionTarget(tracking?.actionCard?.key || '', detail.id, actionMeta) : null;
  const paymentFacts = resolvePaymentFacts(detail?.status || '', history, detail
    ? {
        ...(detail.phase1Status !== undefined ? { phase1Status: detail.phase1Status } : {}),
        ...(detail.phase1PaidAt !== undefined ? { phase1PaidAt: detail.phase1PaidAt } : {}),
        ...(detail.phase2Status !== undefined ? { phase2Status: detail.phase2Status } : {}),
        ...(detail.phase2PaidAt !== undefined ? { phase2PaidAt: detail.phase2PaidAt } : {}),
      }
    : null);
  const timeline = buildTimeline(history);
  const officerComments = buildOfficerComments(history);

  if (!mounted) {
    return null;
  }

  if (loading) {
    return <PageSkeleton type="detail" />;
  }

  if (error || !detail) {
    return (
      <section className="mx-auto w-full max-w-6xl">
        <div className="rounded-[1.375rem] border-2 border-rose-200 bg-rose-50/60 p-6 text-rose-700">
          <div className="mb-2 flex items-center gap-2 text-lg font-semibold text-rose-800">
            <IconAlertCircle size={20} />
            {detailCopy.errorTitle}
          </div>
          <p className="text-sm">{error || detailCopy.errorBody}</p>
          <div className="mt-4">
            <Button href="/health/applications" variant="primary">{detailCopy.backToList}</Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    // ui_kit reskin (Wave 3, 2026-06-09): the header now matches the ref
    // AppDetail identity card — a leaf-icon avatar + title + "ยื่นเมื่อ …"
    // subtitle on the left, a pill status chip (dot + word) + preview CTA
    // on the right, then a hairline divider above the status pipeline.
    // SummaryHeader (a grid stat-strip header) was the wrong primitive for
    // a single-record detail page; the inline identity card reads as the
    // ref's hero. All copy/data/i18n is unchanged. Back button stays above
    // the header card as a separate navigation affordance.
    <section className="space-y-4">
      <Button
        href="/health/applications"
        variant="subtle"
        className="-mx-2 min-h-[44px] px-2 text-slate-700 hover:bg-transparent sm:-mx-0 sm:px-0"
        leftSection={<IconArrowLeft size={16} />}
      >
        {detailCopy.backToList}
      </Button>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-onSoft sm:h-14 sm:w-14">
              <Leaf className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">{detailCopy.eyebrow}</p>
              <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">
                {`${detailCopy.eyebrow.includes('คำขอ') ? 'คำขอ' : 'Application'} ${detail.applicationNumber || `#${detail.id.slice(-6).toUpperCase()}`}`}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {`${detailCopy.submittedOn} ${toThaiDate(detail.submittedAt || detail.createdAt)}`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badgeToneToClass[statusMeta.tone] || badgeToneToClass.neutral}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${badgeToneToDot[statusMeta.tone] || badgeToneToDot.neutral}`} />
              {statusMeta.label}
            </span>
            <Button
              href={`/health/applications/${detail.id}/preview`}
              variant="secondary"
              size="sm"
              leftSection={<IconDownload size={16} />}
            >
              {detailCopy.previewCta}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Wave E.2-G — Smart-buttons row ──
          44px-height bar that gives the user one click to jump
          from "looking at this application" to "managing its
          related records" without backing out to a list.
          Mirrors the smart-buttons pattern used by mature
          business platforms on detail pages.
          Buttons fill the row on mobile (stretch CTAs), then
          right-align at sm: breakpoint and above. */}
      <Card className="flex flex-wrap items-center justify-start gap-2 px-3 py-2 sm:justify-end">
        <Button
          href={`/health/applications/${detail.id}/preview`}
          variant="light"
          size="sm"
          leftSection={<IconFileDescription size={16} />}
        >
          {detailCopy.previewCta}
        </Button>
        <Button
          href={`/health/payments?app=${detail.id}`}
          variant="light"
          size="sm"
          leftSection={<IconCreditCard size={16} />}
        >
          {detailCopy.paymentCta}
        </Button>
        <Button
          href="/health/documents"
          variant="light"
          size="sm"
          leftSection={<IconClipboardText size={16} />}
        >
          {detailCopy.documentsCta}
        </Button>
        {/* PDPA ม.30 — the right to read what an auditor wrote about you is exercised by
            opening a page, so there has to be a way in. Always shown rather than gated on
            "are there notes yet": a farmer asking to see their own data must be able to
            reach the answer "ยังไม่มี" too, not be unable to ask. */}
        <Button
          href={`/health/applications/${detail.id}/audit-notes`}
          variant="light"
          size="sm"
          leftSection={<IconClipboardText size={16} />}
        >
          บันทึกของผู้ตรวจ
        </Button>
      </Card>

      {/* ── Status pipeline (chevron strip) ──
          The previous 8-dot horizontal stepper is replaced by a
          clip-path chevron pipeline (33px height, 12px chevron
          depth). The stage badge + counter + % stay above the
          chevrons; the description card stays below. The pipeline
          itself is the reusable <StatusPipeline> component so other
          detail pages (planting, certificates, provider work-queue)
          can drop it in. */}
      {(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wfState = tracking ? (tracking as any).workflowState : undefined;
        const dashStage = normalizeHealthDashboardStage({
          status: detail.status,
          workflowState: wfState || detail.status,
          hasCertificate: statusKey === 'CERTIFIED',
        });
        const currentIdx = getStepperIndex(dashStage);
        const progressPct = getProgressPercent(dashStage);
        const badgeStyle = STAGE_BADGE_STYLE[dashStage];
        const isTerminal = dashStage === 'CERTIFIED';

        return (
          <Card className="p-5">
            {/* Stage name + counter + progress % */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold ${badgeStyle.bg} ${badgeStyle.text}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${badgeStyle.dot}`} />
                  {STAGE_LABEL_TH[dashStage]}
                </span>
                {/* A closed file is off the ladder (currentIdx === -1); showing
                    "ขั้นตอน 0 จาก 9" there is worse than showing nothing. */}
                {currentIdx >= 0 && (
                  <span className="text-xs text-muted-foreground">
                    {detailCopy.stepCounter
                      .replace('{n}', String(currentIdx + 1))
                      .replace('{total}', String(STEPPER_STEPS.length))}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-primary">{progressPct}%</span>
            </div>

            {/* Chevron pipeline */}
            <StatusPipeline
              steps={STEPPER_STEPS.map(s => ({
                key: s.stage,
                label: s.label,
                shortLabel: s.shortLabel,
              }))}
              currentKey={dashStage}
              isTerminal={isTerminal}
              className="rounded-none border-0 bg-transparent p-0 shadow-none"
            />

            {/* Current stage description */}
            <div className="mt-4 rounded-xl bg-mint-soft px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">{STAGE_DESCRIPTION_TH[dashStage]}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                สิ่งที่ต้องทำ: <span className="font-semibold text-primary">{STAGE_NEXT_ACTION_TH[dashStage]}</span>
              </p>
            </div>
          </Card>
        );
      })()}

      <div className="rounded-[1.375rem] border border-leaf/30 bg-leaf-soft p-4">
        {/* Stack vertically on mobile so the action CTA gets a full-width
            touch target instead of crammed against long Thai title +
            hint text. Switches to side-by-side at sm: (>=640px). */}
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{actionMeta.title}</p>
            <p className="text-sm text-muted-foreground">{actionMeta.hint}</p>
            {tracking?.deadline ? (
              <p className="mt-1 text-xs text-amber-700">
                {detailCopy.actionDeadline
                  .replace('{date}', toThaiDateTime(tracking.deadline.dueAt))
                  .replace('{days}', String(tracking.deadline.remainingWorkingDays))}
              </p>
            ) : null}
          </div>
          {actionTarget ? (
            // PAY actions keep the amber urgency tone (a deliberate
            // functional signal that money is due); every other action
            // uses the leaf primary Button. Both render via the Button
            // primitive — only the PAY case adds an amber className.
            <Button
              href={actionTarget.href}
              variant="primary"
              className={`w-full sm:w-auto ${upper(tracking?.actionCard?.key).includes('PAY') ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
            >
              {actionTarget.label}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Post-certification guidance — แสดงเมื่อได้ใบรับรองแล้ว */}
      {(statusKey === 'CERTIFIED' || statusKey === 'APPROVED') && (
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-primary">{detailCopy.postCertTitle}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Link href="/health/certificates" className="group flex items-center gap-3 rounded-xl bg-mint-soft p-3 transition-colors hover:bg-leaf-soft">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-onSoft">
                <IconFileDescription size={18} />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900">{detailCopy.downloadCert}</p>
                <p className="text-[10px] text-slate-500">{detailCopy.downloadCertDesc}</p>
              </div>
            </Link>
            <Link href="/health/reports" className="group flex items-center gap-3 rounded-xl bg-mint-soft p-3 transition-colors hover:bg-leaf-soft">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-onSoft">
                <IconClipboardText size={18} />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900">{detailCopy.monthlyReports}</p>
                <p className="text-[10px] text-slate-500">{detailCopy.monthlyReportsDesc}</p>
              </div>
            </Link>
            <Link href="/health/applications/renewal" className="group flex items-center gap-3 rounded-xl bg-mint-soft p-3 transition-colors hover:bg-leaf-soft">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-onSoft">
                <IconClock size={18} />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900">{detailCopy.renewCert}</p>
                <p className="text-[10px] text-slate-500">{detailCopy.renewCertDesc}</p>
              </div>
            </Link>
          </div>
        </Card>
      )}

      <HealthActivityTimeline applicationId={detail.id} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-onSoft">
                <IconClipboardText size={18} />
              </span>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">{detailCopy.applicationCardTitle}</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><p className="text-slate-500">{detailCopy.fields.applicantName}</p><p className="font-medium text-slate-900">{derived.operatorName}</p></div>
              <div><p className="text-slate-500">{detailCopy.fields.applicantType}</p><p className="font-medium text-slate-900">{derived.operatorType}</p></div>
              <div><p className="text-slate-500">{detailCopy.fields.plant}</p><p className="font-medium text-slate-900">{derived.plantName}</p></div>
              <div><p className="text-slate-500">{detailCopy.fields.plotName}</p><p className="font-medium text-slate-900">{derived.plotName}</p></div>
              {/* V1-A / D7 fix — province on its own slot (no longer
                  conflated with surroundingEnvironment) */}
              <div><p className="text-slate-500">{detailCopy.fields.province}</p><p className="font-medium text-slate-900">{derived.province}</p></div>
              <div><p className="text-slate-500">{detailCopy.fields.area}</p><p className="font-medium text-slate-900">{derived.areaText}</p></div>
              {/* V1-A / D7 fix — surroundingEnvironment moved to its
                  own labelled row so it never lands in the province
                  slot. Hidden when empty so the layout stays tidy
                  for applicants who didn't fill the optional field. */}
              {derived.surroundingEnvironment && derived.surroundingEnvironment !== '-' ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-slate-500">{detailCopy.fields.surroundingEnvironment}</p>
                  <p className="font-medium text-slate-900">{derived.surroundingEnvironment}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-onSoft">
                <IconCreditCard size={18} />
              </span>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">{detailCopy.paymentStatusTitle}</h2>
            </div>

            <div className="space-y-2">
              <div className={`flex items-center justify-between rounded-xl border p-3 ${paymentFacts.docPaid ? 'border-leaf-300 bg-leaf-soft' : 'border-transparent bg-mint-soft'}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{detailCopy.fields.docFee}</p>
                  <p className="text-xs text-slate-500">{paymentFacts.docPaid ? detailCopy.fields.paidOn.replace('{date}', toThaiDate(paymentFacts.docPaidAt)) : detailCopy.fields.awaitingPayment}</p>
                </div>
                <div className="text-right">
                  <p className="whitespace-nowrap text-lg font-semibold text-slate-900">฿{formatMoney(GACP_PHASE1_TOTAL)}</p>
                  <p className={`text-xs ${paymentFacts.docPaid ? 'text-leaf-700' : 'text-amber-700'}`}>{paymentFacts.docPaid ? detailCopy.fields.paid : detailCopy.fields.pending}</p>
                </div>
              </div>

              <div className={`flex items-center justify-between rounded-xl border p-3 ${paymentFacts.auditPaid ? 'border-leaf-300 bg-leaf-soft' : 'border-transparent bg-mint-soft'}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{detailCopy.fields.auditFee}</p>
                  <p className="text-xs text-slate-500">{paymentFacts.auditPaid ? detailCopy.fields.paidOn.replace('{date}', toThaiDate(paymentFacts.auditPaidAt)) : detailCopy.fields.awaitingPayment}</p>
                </div>
                <div className="text-right">
                  <p className="whitespace-nowrap text-lg font-semibold text-slate-900">฿{formatMoney(GACP_PHASE2_TOTAL)}</p>
                  <p className={`text-xs ${paymentFacts.auditPaid ? 'text-leaf-700' : 'text-amber-700'}`}>{paymentFacts.auditPaid ? detailCopy.fields.paid : detailCopy.fields.pending}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-onSoft">
                <IconMessageCircle size={18} />
              </span>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">{detailCopy.officerCommentsTitle}</h2>
            </div>

            {officerComments.length === 0 ? (
              <p className="rounded-xl bg-mint-soft p-4 text-sm text-slate-500">{detailCopy.officerCommentsEmpty}</p>
            ) : (
              <div className="space-y-2">
                {officerComments.map((comment) => (
                  <div key={comment.id} className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
                      <p className="text-xs text-slate-500">{comment.timestamp}</p>
                    </div>
                    <p className="text-sm text-slate-700">{comment.message}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="self-start p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-soft text-leaf-onSoft">
              <IconProgressCheck size={18} />
            </span>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{detailCopy.timelineTitle}</h2>
          </div>

          {timeline.length === 0 ? (
            <p className="rounded-xl bg-mint-soft p-4 text-sm text-slate-500">{detailCopy.timelineEmpty}</p>
          ) : (
            <div className="space-y-4">
              {timeline.map((item) => (
                <div key={item.id} className="relative pl-6">
                  <span className="absolute left-0 top-1 h-3 w-3 rounded-full bg-leaf" />
                  <span className="absolute left-[5px] top-4 h-[calc(100%-12px)] w-px bg-mint-bg" />
                  <div className={item.isCurrent ? 'rounded-lg bg-leaf-soft p-2' : ''}>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.timestamp}</p>
                    <p className="mt-1 text-xs text-slate-700">{item.description}</p>
                    <p className="mt-1 text-xs text-slate-500">{detailCopy.timelineBy} {item.actor}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-mint-bg pt-3">
            <Button
              href={`/health/applications/${detail.id}/preview`}
              variant="outline"
              rightSection={<IconChevronRight size={14} />}
              leftSection={<IconCheck size={14} />}
              className="w-full"
            >
              {detailCopy.viewDocumentsCta}
            </Button>
            <Button
              href="/health/payments"
              variant="light"
              rightSection={<IconChevronRight size={14} />}
              leftSection={<IconClock size={14} />}
              className="mt-2 w-full"
            >
              {detailCopy.paymentHistoryCta}
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
