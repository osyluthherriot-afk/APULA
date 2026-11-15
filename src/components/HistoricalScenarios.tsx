"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CombustionSimulationResult,
  SimulationParams,
} from "@/lib/combustionPhysicsEngine";
import {
  doesLiveResultMatchVariant,
  HISTORICAL_SCENARIOS,
  ScenarioVariant,
} from "@/data/historicalScenarios";

export interface HistoricalScenariosProps {
  open: boolean;
  onClose(): void;
  onApplyParams(p: SimulationParams): void;
  liveResult: CombustionSimulationResult;
}

// Top-layer historical mission theater pitting documented NASA runs against live physics 👁️
export function HistoricalScenarios({
  open,
  onClose,
  onApplyParams,
  liveResult,
}: HistoricalScenariosProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pointerDownOutsideRef = useRef(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    HISTORICAL_SCENARIOS[1].id
  );
  const [selectedVariantByScenario, setSelectedVariantByScenario] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      HISTORICAL_SCENARIOS.map((s) => [s.id, s.defaultVariantId])
    )
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.returnValue = "";
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.returnValue = "";
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.returnValue = "";
      if (dialog.open) {
        dialog.close();
      }
    }
    onClose();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) {
      pointerDownOutsideRef.current = false;
      return;
    }
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    pointerDownOutsideRef.current = !inside;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || !pointerDownOutsideRef.current || event.target !== dialog) {
      pointerDownOutsideRef.current = false;
      return;
    }
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    pointerDownOutsideRef.current = false;
    if (!inside) {
      handleClose();
    }
  };

  const activeScenario = useMemo(
    () =>
      HISTORICAL_SCENARIOS.find((s) => s.id === selectedScenarioId) ??
      HISTORICAL_SCENARIOS[0],
    [selectedScenarioId]
  );

  const activeVariant: ScenarioVariant = useMemo(() => {
    const vId =
      selectedVariantByScenario[activeScenario.id] ??
      activeScenario.defaultVariantId;
    return (
      activeScenario.variants.find((v) => v.id === vId) ??
      activeScenario.variants[0]
    );
  }, [activeScenario, selectedVariantByScenario]);

  const isLiveMatched = doesLiveResultMatchVariant(liveResult, activeVariant);

  const activeScenarioIndex = Math.max(
    0,
    HISTORICAL_SCENARIOS.findIndex((s) => s.id === activeScenario.id)
  );
  const activeVariantIndex = Math.max(
    0,
    activeScenario.variants.findIndex((v) => v.id === activeVariant.id)
  );

  const handleLoadVariant = (variant: ScenarioVariant) => {
    setSelectedVariantByScenario((prev) => ({
      ...prev,
      [activeScenario.id]: variant.id,
    }));
    onApplyParams(variant.params);
  };

  const handleStepVariant = (delta: -1 | 1) => {
    const nextIdx =
      (activeVariantIndex + delta + activeScenario.variants.length) %
      activeScenario.variants.length;
    handleLoadVariant(activeScenario.variants[nextIdx]);
  };

  const handleStepScenario = (delta: -1 | 1) => {
    const nextIdx =
      (activeScenarioIndex + delta + HISTORICAL_SCENARIOS.length) %
      HISTORICAL_SCENARIOS.length;
    const nextScenario = HISTORICAL_SCENARIOS[nextIdx];
    setSelectedScenarioId(nextScenario.id);
    const chosenId =
      selectedVariantByScenario[nextScenario.id] ?? nextScenario.defaultVariantId;
    const nextVariant =
      nextScenario.variants.find((v) => v.id === chosenId) ??
      nextScenario.variants[0];
    if (nextVariant) {
      onApplyParams(nextVariant.params);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="apula-scenarios-title"
      {...({ closedby: "any" } as Record<string, unknown>)}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="ap-dialog w-full max-w-5xl overflow-hidden z-[300]"
    >
      <div className="ap-divider flex items-center justify-between border-b px-6 py-4">
        <div>
          <span className="ap-eyebrow block">Flight Validation Archive</span>
          <h2
            id="apula-scenarios-title"
            className="ap-text-1 font-display text-[20px] font-semibold tracking-[-0.22px]"
          >
            Historical Spaceflight Burn Recreator
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close historical scenarios"
          className="ap-pill inline-flex items-center justify-center p-2"
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

      <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-y-auto">
        <div className="ap-divider md:col-span-4 border-b md:border-b-0 md:border-r p-4 space-y-2.5">
          {HISTORICAL_SCENARIOS.map((scenario, idx) => {
            const selected = scenario.id === activeScenario.id;
            const anyVariantActive = scenario.variants.some((v) =>
              doesLiveResultMatchVariant(liveResult, v)
            );
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setSelectedScenarioId(scenario.id)}
                className={`w-full text-left p-3.5 transition ${
                  selected
                    ? "ap-subcard ring-2 ring-[var(--ap-accent)]"
                    : "ap-card hover:opacity-90"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="ap-eyebrow">Mission {idx + 1}</span>
                  {anyVariantActive && (
                    <span className="ap-prov-measured inline-flex items-center gap-1">
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
                      <span>ACTIVE</span>
                    </span>
                  )}
                </div>
                <div className="ap-text-1 font-display font-semibold text-[14px] mt-1 leading-snug tracking-[-0.22px]">
                  {scenario.title}
                </div>
                <div className="ap-text-3 text-[11px] mt-0.5">
                  {scenario.missionTag}
                </div>
              </button>
            );
          })}
        </div>

        <div className="md:col-span-8 p-6 space-y-5 text-[13px] overflow-y-auto">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="ap-prov-estimated block">
                {activeScenario.missionTag}
              </span>
              <h3 className="ap-text-1 font-display text-[20px] font-semibold tracking-[-0.22px] mt-0.5">
                {activeScenario.title}
              </h3>
            </div>
            <span className={isLiveMatched ? "ap-prov-measured inline-flex items-center gap-1" : "ap-prov-defaulted"}>
              {isLiveMatched ? (
                <>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="w-3.5 h-3.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.5 8.5l3 3 6-6.5"
                    />
                  </svg>
                  <span>Chamber Matched to Selected State</span>
                </>
              ) : (
                "Live Chamber Differs · Click Load"
              )}
            </span>
          </div>

          <p className="ap-text-2 text-[14px] leading-relaxed">{activeScenario.narration}</p>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="ap-text-3 text-[11px] font-semibold">
                Experiment State / Comparison Toggle ({activeVariantIndex + 1} /{" "}
                {activeScenario.variants.length})
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStepVariant(-1)}
                  className="ap-pill px-2.5 py-1 text-[11px] font-medium"
                >
                  Prev State
                </button>
                <button
                  type="button"
                  onClick={() => handleStepVariant(1)}
                  className="ap-pill px-2.5 py-1 text-[11px] font-medium"
                >
                  Next State
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeScenario.variants.map((variant) => {
                const chosen = variant.id === activeVariant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => handleLoadVariant(variant)}
                    className={`px-3.5 py-1.5 text-[12px] font-medium transition ${
                      chosen ? "ap-pill-active" : "ap-pill"
                    }`}
                    title={variant.summary}
                  >
                    {variant.label}
                  </button>
                );
              })}
            </div>
            <div className="ap-text-3 text-[12px]">{activeVariant.summary}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="ap-card p-4 space-y-1.5">
              <div className="ap-eyebrow">Observed NASA Outcome</div>
              <p className="ap-text-2 text-[12px] leading-relaxed">
                {activeScenario.observedOutcome}
              </p>
            </div>

            <div className="ap-card p-4 space-y-2">
              <div className="ap-eyebrow">APULA Predicts (Active State)</div>
              <div className="space-y-1 text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="ap-text-3">Regime</span>
                  <strong className="ap-text-1 font-mono text-[11px]">
                    {activeVariant.expected.regime}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="ap-text-3">Predicted LOI</span>
                  <strong className="ap-text-1 font-mono tabular-nums">
                    {activeVariant.expected.limitingO2Pct}% O2
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="ap-text-3">O2 Margin</span>
                  <strong className="ap-text-1 font-mono tabular-nums">
                    {activeVariant.expected.oxygenMarginPct >= 0 ? "+" : ""}
                    {activeVariant.expected.oxygenMarginPct}%
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="ap-text-3">Spread Rate</span>
                  <strong className="ap-text-1 font-mono tabular-nums">
                    {activeVariant.expected.flameSpreadRateMmS} mm/s
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="ap-text-3">Eff. Thickness / g_eq</span>
                  <strong className="ap-text-1 font-mono tabular-nums">
                    {activeVariant.expected.effectiveThicknessMm} mm ·{" "}
                    {activeVariant.expected.equivalentGravityG}g
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="ap-card p-4 space-y-1.5">
            <div className="ap-eyebrow">What To Watch In Simulator &amp; Phase Charts</div>
            <ul className="list-disc pl-4 space-y-1 ap-text-2 text-[12px]">
              {activeScenario.whatToWatch.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="ap-banner-disclaimer px-4 py-3 text-[12px] leading-relaxed">
            <strong>Honest Model Caveat:</strong> {activeScenario.honestCaveat}
          </div>

          <div className="ap-divider flex flex-wrap items-center justify-between gap-2.5 border-t pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStepScenario(-1)}
                className="ap-pill px-3 py-1.5 text-[12px] font-medium"
              >
                Prev Mission
              </button>
              <span className="ap-text-3 font-mono text-[11px] tabular-nums">
                Mission {activeScenarioIndex + 1} / {HISTORICAL_SCENARIOS.length}
              </span>
              <button
                type="button"
                onClick={() => handleStepScenario(1)}
                className="ap-pill px-3 py-1.5 text-[12px] font-medium"
              >
                Next Mission
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                className="ap-btn-secondary px-4 py-2 text-[12px]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyParams(activeVariant.params);
                  handleClose();
                }}
                className="ap-btn-primary px-4 py-2 text-[12px]"
              >
                Load Into Simulator &amp; View Chamber
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
