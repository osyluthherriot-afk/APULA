"use client";

import React from "react";
import { SettingsPopover } from "@/components/SettingsPopover";
import { CombustionRegime } from "@/lib/combustionPhysicsEngine";

export interface HeaderNavProps {
  regime: CombustionRegime;
  rowCount: number;
  campaignCount: number;
  onLaunchTutorial(): void;
  onOpenScenarios(): void;
}

const REGIME_PILL_STYLE: Record<CombustionRegime, string> = {
  NO_IGNITION_QUENCHED: "ap-regime-quenched",
  NO_IGNITION_BLOWOFF: "ap-regime-blowoff",
  COOL_FLAME_CFI_G: "ap-regime-cool",
  SPHERICAL_DIFFUSION_FLAME: "ap-regime-spherical",
  ELONGATED_MICROGRAVITY_FLAME: "ap-regime-elongated",
  CRITICAL_ACCELERATED_BURN: "ap-regime-critical",
};

// Top command strip holding brand patch, status pill, and quick modals 🥷
export function HeaderNav({
  regime,
  rowCount,
  campaignCount,
  onLaunchTutorial,
  onOpenScenarios,
}: HeaderNavProps) {
  const statusClass =
    REGIME_PILL_STYLE[regime] ?? REGIME_PILL_STYLE.NO_IGNITION_QUENCHED;

  return (
    <header
      data-tour="header-bar"
      className="ap-header w-full z-[100]"
    >
      <div className="ap-container py-2.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          <img
            src="/apulla.svg"
            alt="Project APULA"
            width={178}
            height={52}
            className="w-auto h-[48px] sm:h-[52px] shrink-0 object-contain"
          />
          <div className="min-w-0">
            <div className="ap-text-1 font-display text-[15px] font-semibold tracking-[-0.22px] flex flex-wrap items-center gap-2">
              <span>Atmospheric Prediction &amp; Unified Low-gravity Analysis</span>
            </div>
            <p className="ap-text-3 text-[12px] tracking-[-0.12px] truncate">
              NASA PSI Empirical Ledger ({rowCount} Runs across {campaignCount} Campaigns) · Physics Engine v2 Frozen
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold tracking-[-0.12px] ${statusClass}`}
            title="Live predicted combustion regime"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            <span>{regime}</span>
          </span>

          <button
            type="button"
            onClick={onOpenScenarios}
            className="ap-btn-secondary px-3.5 py-1.5 text-[12px]"
          >
            Historical Missions
          </button>

          <button
            type="button"
            onClick={onLaunchTutorial}
            className="ap-btn-primary px-3.5 py-1.5 text-[12px]"
          >
            Launch Tutorial
          </button>

          <SettingsPopover onRestartTutorial={onLaunchTutorial} />
        </div>
      </div>
    </header>
  );
}
