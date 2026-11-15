"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CombustionSimulationResult,
  FieldProvenanceKey,
  ProvenanceStatus,
  SimulationParams,
} from "@/lib/combustionPhysicsEngine";
import {
  buildMetricAnnotation,
  MetricKey,
} from "@/lib/metricAnnotations";
import {
  FIELD_PROVENANCE_NOTES,
  PROVENANCE_STYLES,
} from "@/lib/provenanceStyles";

type MetricPopoverProps = {
  metric: MetricKey;
  simResult: CombustionSimulationResult;
  params: SimulationParams;
  provenance?: never;
  field?: never;
  children: React.ReactNode;
};

type ProvenancePopoverProps = {
  provenance: ProvenanceStatus;
  field?: FieldProvenanceKey;
  metric?: never;
  simResult?: never;
  params?: never;
  children: React.ReactNode;
};

export type MetricAnnotationPopoverProps =
  | MetricPopoverProps
  | ProvenancePopoverProps;

// Toggletip + hover preview holding clamped equation and provenance telemetry
export function MetricAnnotationPopover(props: MetricAnnotationPopoverProps) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const pinnedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 80,
    left: 16,
  });

  const metricAnnotation = useMemo(() => {
    if ("metric" in props && props.metric && props.simResult && props.params) {
      return buildMetricAnnotation(props.metric, props.simResult, props.params);
    }
    return null;
  }, [props]);

  const provenanceInfo = useMemo(() => {
    const status = metricAnnotation
      ? metricAnnotation.provenance
      : "provenance" in props && props.provenance
        ? props.provenance
        : "ESTIMATED";
    return PROVENANCE_STYLES[status];
  }, [metricAnnotation, props]);

  const fieldNote =
    "field" in props && props.field ? FIELD_PROVENANCE_NOTES[props.field] : null;

  const syncPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(390, window.innerWidth - 24);
    const estHeight = 320;
    const nextLeft = Math.max(
      12,
      Math.min(rect.left, window.innerWidth - width - 12)
    );
    const fitsBelow = rect.bottom + 8 + estHeight <= window.innerHeight - 12;
    const nextTop = fitsBelow
      ? rect.bottom + 8
      : Math.max(12, rect.top - estHeight - 8);
    setCoords({ top: nextTop, left: nextLeft });
  }, []);

  useEffect(() => {
    const popEl = popoverRef.current;
    if (!popEl) return;
    const onToggle = (event: Event) => {
      const nextOpen = (event as ToggleEvent).newState === "open";
      if (nextOpen) {
        syncPosition();
      } else {
        pinnedRef.current = false;
      }
      setIsOpen(nextOpen);
    };
    popEl.addEventListener("toggle", onToggle);
    return () => {
      popEl.removeEventListener("toggle", onToggle);
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, [syncPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onReposition = () => syncPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen, syncPosition]);

  const cancelHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const showPopoverNative = useCallback(() => {
    syncPosition();
    const popEl = popoverRef.current as
      | (HTMLDivElement & { showPopover?: () => void })
      | null;
    if (popEl && typeof popEl.showPopover === "function") {
      try {
        if (!popEl.matches(":popover-open")) {
          popEl.showPopover();
        }
        return;
      } catch {
        // Fallback when Popover API throws on transient detached node.
      }
    }
    setIsOpen(true);
  }, [syncPosition]);

  const hidePopoverNative = useCallback(() => {
    const popEl = popoverRef.current as
      | (HTMLDivElement & { hidePopover?: () => void })
      | null;
    if (popEl && typeof popEl.hidePopover === "function") {
      try {
        if (popEl.matches(":popover-open")) {
          popEl.hidePopover();
        }
      } catch {
        // Already closed.
      }
    }
    pinnedRef.current = false;
    setIsOpen(false);
  }, []);

  const handleMouseEnter = () => {
    cancelHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      showPopoverNative();
    }, 90);
  };

  const handleMouseLeave = () => {
    cancelHoverTimer();
    if (pinnedRef.current) return;
    hoverTimerRef.current = window.setTimeout(() => {
      hidePopoverNative();
    }, 180);
  };

  const handleToggle = () => {
    cancelHoverTimer();
    if (isOpen && pinnedRef.current) {
      hidePopoverNative();
      return;
    }
    pinnedRef.current = true;
    showPopoverNative();
  };

  const handleClose = () => {
    cancelHoverTimer();
    hidePopoverNative();
  };

  const accessibleLabel = metricAnnotation
    ? `Inspect formula and provenance for ${metricAnnotation.label}`
    : `Inspect provenance definition: ${provenanceInfo.title}`;

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label={accessibleLabel}
        className="inline-flex items-center gap-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ap-accent)] rounded"
      >
        {props.children}
      </button>

      <div
        ref={popoverRef}
        id={popoverId}
        role="region"
        aria-label={
          metricAnnotation ? metricAnnotation.label : provenanceInfo.title
        }
        {...({ popover: "auto" } as Record<string, unknown>)}
        onMouseEnter={cancelHoverTimer}
        onMouseLeave={handleMouseLeave}
        style={{
          position: "fixed",
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: "min(390px, calc(100vw - 24px))",
          maxHeight: "min(440px, calc(100vh - 24px))",
        }}
        className="ap-popover overflow-y-auto p-4 text-[12px] space-y-3 z-[200]"
      >
        <div className="ap-divider flex items-start justify-between gap-2 border-b pb-2.5">
          <div>
            <div className="ap-text-1 font-display font-semibold text-[14px] tracking-[-0.22px]">
              {metricAnnotation ? metricAnnotation.label : provenanceInfo.title}
            </div>
            {fieldNote && (
              <div className="ap-text-3 text-[11px] mt-0.5">
                Field: {fieldNote.label}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close annotation"
            className="ap-pill inline-flex items-center justify-center p-1.5 shrink-0"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4l8 8M12 4l-8 8"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-1">
          <div className="ap-eyebrow">Plain-English Meaning</div>
          <p className="ap-text-2 leading-relaxed">
            {metricAnnotation
              ? metricAnnotation.meaning
              : fieldNote
                ? fieldNote.sourceHint
                : provenanceInfo.meaning}
          </p>
        </div>

        <div className="ap-card p-3 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="ap-text-3 text-[11px] font-semibold">
              Provenance Status
            </span>
            <span className={provenanceInfo.badgeClass}>
              {metricAnnotation
                ? metricAnnotation.provenanceBadge
                : provenanceInfo.shortTag}
            </span>
          </div>
          <p className="ap-text-2 text-[11px] leading-snug">
            {provenanceInfo.meaning}
          </p>
        </div>

        {metricAnnotation && (
          <div className="ap-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="ap-text-3 text-[11px] font-semibold">
                Live Equation Breakdown
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  metricAnnotation.verification.verified
                    ? "ap-prov-estimated"
                    : "ap-prov-measured"
                }`}
              >
                {metricAnnotation.verification.verified ? (
                  <>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="w-3 h-3"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.5 8.5l3 3 6-6.5"
                      />
                    </svg>
                    <span>SELF-CHECK MATCH</span>
                  </>
                ) : (
                  `DELTA ${metricAnnotation.verification.delta}`
                )}
              </span>
            </div>

            <div className="ap-text-3 font-mono text-[10px] break-all">
              {metricAnnotation.symbolicFormula}
            </div>
            <div className="ap-callout-info px-2.5 py-1.5 font-mono font-semibold text-[11px] break-all tabular-nums">
              {metricAnnotation.substitutedEquation}
            </div>

            <div className="space-y-1 pt-1">
              {metricAnnotation.terms.map((term) => (
                <div
                  key={term.name}
                  className="ap-divider flex items-baseline justify-between gap-2 border-t pt-1 text-[11px]"
                >
                  <span className="ap-text-2 font-medium">{term.name}</span>
                  <span className="ap-text-1 font-mono font-semibold tabular-nums">{term.value}</span>
                  <span className="ap-text-3 text-right truncate max-w-[165px]" title={term.note}>
                    {term.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </span>
  );
}
