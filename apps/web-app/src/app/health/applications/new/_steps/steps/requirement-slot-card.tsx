'use client';

/**
 * The wizard's ONE upload surface.
 *
 * Every step that needs a paper renders this card, and every fact on it comes from the
 * server's answer (`GET /applications/:id/requirements`) — the label, whether it is
 * required, why it is required, and whether the server can already see a file. The
 * browser keeping its own copy of the required set is exactly how a farmer was told
 * ครบ on one screen and ไม่ครบ on the next; a card that renders the server's row
 * cannot drift from it.
 *
 * The second upload door (a separate "documents" step listing everything at the end)
 * was retired for the same reason: two surfaces, two answers.
 */

import { useRef, useState } from 'react';
import { uploadDraftDocument } from '@/lib/services/draft-document-upload';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { RequirementSlot } from '@/lib/services/application-requirements';
import { slotCardState, openSlotDocument, requiredReasonBadge, SLOT_CARD_COPY_TH } from './requirement-slot-card-state';

export interface RequirementSlotCardProps {
    slot: RequirementSlot;
    /** The draft this upload belongs to. */
    appId: string;
    /** Ask the step to re-read the server's answer — never patch it locally. */
    onChanged: () => void;
    /** Which wizard step the upload came from; the server files documents by step. */
    stepKey?: string;
}

export function RequirementSlotCard({ slot, appId, onChanged, stepKey }: RequirementSlotCardProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const state = slotCardState(slot);
    const reasonBadge = requiredReasonBadge(slot);

    const handleFile = async (file: File | undefined) => {
        if (!file) { return; }
        setBusy(true);
        setError(null);
        const result = await uploadDraftDocument({
            file,
            slotId: slot.slotId,
            applicationId: appId,
            ...(stepKey ? { stepKey } : {}),
        });
        setBusy(false);
        if (result.error) {
            setError(result.error);
            return;
        }
        // Re-ask the server rather than marking this card done locally. The server is
        // the only thing that decides whether a slot is satisfied.
        onChanged();
    };

    return (
        <div
            className={cn(
                'rounded-xl border-2 p-4 transition-colors duration-200',
                state === 'attached' && 'border-leaf-300 bg-leaf-soft',
                state === 'missing' && 'border-amber-200 bg-amber-50',
                // An optional gap is NOT a problem: it never counts toward completeness,
                // so it must not wear the same amber as a paper the law demands.
                state === 'optional-missing' && 'border-muted bg-card',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                        {slot.labelTH}
                        {slot.required && <span aria-hidden className="ml-1 text-destructive">*</span>}
                        {slot.required && <span className="sr-only"> (บังคับ)</span>}
                    </p>
                    {reasonBadge && (
                        <p className="mt-1 text-xs font-medium text-leaf-700">{reasonBadge}</p>
                    )}
                    {slot.description && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{slot.description}</p>
                    )}
                    {slot.sourceHint && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {SLOT_CARD_COPY_TH.sourceLabel} {slot.sourceHint}
                        </p>
                    )}
                </div>
                {!slot.required && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {SLOT_CARD_COPY_TH.optionalBadge}
                    </span>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {state === 'attached' ? (
                    <>
                        <span className="inline-flex items-center gap-1 text-xs text-foreground">
                            <Icons.FileCheck size={14} className="text-leaf-700" />
                            {slot.fileName || SLOT_CARD_COPY_TH.attached}
                        </span>
                        {/* A BUTTON, never an anchor at the file. /uploads is served
                            Content-Disposition: attachment, so a link would drop a copy of a
                            national-ID scan onto the reader's disk. */}
                        <button
                            type="button"
                            onClick={() => { void openSlotDocument(slot); }}
                            className="hover:bg-leaf-soft rounded-lg border border-leaf-300 px-2.5 py-1 text-xs text-leaf-700"
                        >
                            {SLOT_CARD_COPY_TH.view}
                        </button>
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            disabled={busy}
                            className="rounded-lg border border-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                        >
                            {SLOT_CARD_COPY_TH.replace}
                        </button>
                    </>
                ) : (
                    <>
                        <span role="status" className="text-xs text-muted-foreground">
                            {SLOT_CARD_COPY_TH.missing}
                        </span>
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            disabled={busy}
                            className="rounded-lg bg-leaf-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-leaf-800 disabled:bg-leaf-300"
                        >
                            {SLOT_CARD_COPY_TH.upload}
                        </button>
                    </>
                )}
            </div>

            {error && (
                <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>
            )}

            <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(e) => { void handleFile(e.target.files?.[0]); }}
            />
        </div>
    );
}

export default RequirementSlotCard;
