"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type SimulatorMaterial,
  type GeometryType,
  type SimulationParams,
  type CombustionSimulationResult,
  type FlameRenderGeometry,
  type FlammabilityEnvelopeData,
  type AdvancedFlameField,
  type FlammabilityPhaseMatrix,
  type NormalizedRun,
  type EmpiricalRunMatch,
  type ProvenanceStatus,
  type RunDataQuality,
  parseAndNormalizePsiCsv,
  loadMasterPsiDataset,
  simulateCombustionPhysics,
  generateFlameRenderGeometry,
  generateAdvancedFlameField,
  generateFlammabilityEnvelopeData,
  generateFlammabilityPhaseMatrix,
  findClosestEmpiricalRuns,
} from "@/lib/combustionPhysicsEngine";
import {
  type DataProvenanceTier,
  EMPIRICAL_CAMPAIGN_IDS,
  MASTER_PSI_CSV,
  PSI_INVESTIGATIONS,
  getRunCampaignId,
  rankPsiInvestigations,
} from "@/data/psiCatalog";
import ThreeFlameChamber from "@/components/ThreeFlameChamber";
import FlammabilityPhaseCharts from "@/components/FlammabilityPhaseCharts";
import CosmicNebulaShader from "@/components/CosmicNebulaShader";
import { HeaderNav } from "@/components/HeaderNav";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { SpotlightTour } from "@/components/SpotlightTour";
import { HistoricalScenarios } from "@/components/HistoricalScenarios";
import { MetricAnnotationPopover } from "@/components/MetricAnnotationPopover";
import { buildMetricAnnotation, type MetricKey } from "@/lib/metricAnnotations";
import { useApulaTheme } from "@/context/ThemeContext";
import { APULA_TOUR_STEPS } from "@/data/tourSteps";
import {
  doesLiveResultMatchVariant,
  HISTORICAL_SCENARIOS,
} from "@/data/historicalScenarios";

interface HabitatPreset {
  label: string;
  subtitle: string;
  params: Partial<SimulationParams>;
}

const HABITAT_PRESETS: HabitatPreset[] = [
  {
    label: "ISS",
    subtitle: "21% O2, 14.7 psi, 0g",
    params: {
      o2Pct: 21,
      pressurePsi: 14.7,
      gravityG: 0,
      airflowCmS: 5,
      electricFieldVoltsCm: 0,
      co2DilutionPct: 0,
    },
  },
  {
    label: "Lunar Base",
    subtitle: "34% O2, 10.2 psi, 0.16g",
    params: {
      o2Pct: 34,
      pressurePsi: 10.2,
      gravityG: 0.16,
      airflowCmS: 5,
      electricFieldVoltsCm: 0,
      co2DilutionPct: 0,
    },
  },
  {
    label: "Mars Habitat",
    subtitle: "21% O2, 10.2 psi, 0.38g",
    params: {
      o2Pct: 21,
      pressurePsi: 10.2,
      gravityG: 0.38,
      airflowCmS: 5,
      electricFieldVoltsCm: 0,
      co2DilutionPct: 0,
    },
  },
  {
    label: "EVA Suit",
    subtitle: "100% O2, 4.3 psi, 0g",
    params: {
      o2Pct: 100,
      pressurePsi: 4.3,
      gravityG: 0,
      airflowCmS: 5,
      electricFieldVoltsCm: 0,
      co2DilutionPct: 0,
    },
  },
  {
    label: "Earth",
    subtitle: "21% O2, 14.7 psi, 1g",
    params: {
      o2Pct: 21,
      pressurePsi: 14.7,
      gravityG: 1,
      airflowCmS: 0,
      electricFieldVoltsCm: 0,
      co2DilutionPct: 0,
    },
  },
  {
    label: "ACME CFI-G",
    subtitle: "85% O2, Propane",
    params: {
      o2Pct: 85,
      pressurePsi: 14.7,
      gravityG: 0,
      airflowCmS: 2,
      electricFieldVoltsCm: 0,
      co2DilutionPct: 0,
      material: "PROPANE_CFI_G",
    },
  },
];

const SIMULATOR_MATERIALS: { value: SimulatorMaterial; label: string }[] = [
  { value: "PMMA_FILM_0.1MM", label: "PMMA_FILM_0.1MM (Thin Acrylic Film)" },
  { value: "PMMA_SLAB_3MM", label: "PMMA_SLAB_3MM (Thick Acrylic Slab)" },
  { value: "SIBAL_FABRIC", label: "SIBAL_FABRIC (75% Cotton / 25% Fiberglass)" },
  { value: "NOMEX", label: "NOMEX (Flame-Resistant Meta-Aramid)" },
  { value: "HEPTANE_DROPLET", label: "HEPTANE_DROPLET (FLEX Liquid Fuel)" },
  { value: "PROPANE_CFI_G", label: "PROPANE_CFI_G (ACME-CFI-G Spherical Burner)" },
];

// Poke cylindrical rod (D/4) or sphere (D/6) curvature straight into Biot scaling instead of choking on flat slabs.
const GEOMETRY_OVERRIDE_PILLS: {
  label: string;
  value: GeometryType | undefined;
}[] = [
  { label: "Preset Default", value: undefined },
  { label: "Flat Slab [1.0x]", value: "Slab" },
  { label: "Cylindrical Rod [D/4]", value: "Cylinder/Rod" },
  { label: "Sphere [D/6]", value: "Sphere" },
  { label: "Fabric [0.85x]", value: "Fabric" },
];

// Map dataset provenance tiers onto dual-theme CSS badges 🥷
const PROVENANCE_BADGE_CLASSES: Record<DataProvenanceTier, string> = {
  EMPIRICAL_CSV_LOADED: "ap-prov-measured",
  PHYSICS_AND_METADATA_MODEL: "ap-prov-inferred",
  FUTURE_LUNAR_FLIGHT: "ap-prov-defaulted",
};

const getProvenanceBadgeClasses = (tier: DataProvenanceTier): string =>
  PROVENANCE_BADGE_CLASSES[tier];

// Map telemetry and CSV row flags onto dual-theme provenance badges 💦
const FIELD_PROVENANCE_BADGE_CLASSES: Record<ProvenanceStatus, string> = {
  MEASURED: "ap-prov-measured",
  INFERRED: "ap-prov-inferred",
  DEFAULTED: "ap-prov-defaulted",
  ESTIMATED: "ap-prov-estimated",
};

const RUN_QUALITY_BADGE_CLASSES: Record<RunDataQuality, string> = {
  FULLY_MEASURED: "ap-prov-measured",
  PARTIALLY_INFERRED: "ap-prov-inferred",
  MODEL_ESTIMATED: "ap-prov-defaulted",
};

function getBiotCurvatureTag(geometry: GeometryType): string {
  switch (geometry) {
    case "Cylinder/Rod":
      return "Rod [D/4]";
    case "Sphere":
      return "Sphere [D/6]";
    case "Fabric":
      return "Fabric [0.85x]";
    case "Slab":
    default:
      return "Slab [1.0x]";
  }
}

// Wire the APULA dashboard cards, sliders, 3D chamber, tour modals, and NASA PSI tables
export default function ApulaWireframePage() {
  const { onboardingSeen, markOnboardingSeen, resetTutorial } = useApulaTheme();
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(false);
  const [tourActive, setTourActive] = useState<boolean>(false);
  const [scenariosOpen, setScenariosOpen] = useState<boolean>(false);
  const [expandedMetric, setExpandedMetric] = useState<MetricKey | null>(null);
  const [pinnedHud, setPinnedHud] = useState<boolean>(false);
  const [regimePulse, setRegimePulse] = useState<boolean>(false);
  const lastRegimeSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onboardingSeen) {
      setWelcomeOpen(true);
    }
  }, [onboardingSeen]);

  const [params, setParams] = useState<SimulationParams>({
    o2Pct: 21,
    pressurePsi: 14.7,
    airflowCmS: 5,
    gravityG: 0,
    electricFieldVoltsCm: 0,
    material: "PMMA_FILM_0.1MM",
    co2DilutionPct: 0,
  });

  const [parsedRuns, setParsedRuns] = useState<NormalizedRun[]>(() =>
    loadMasterPsiDataset(MASTER_PSI_CSV),
  );
  const [csvSourceLabel, setCsvSourceLabel] = useState<string>(
    "datum/masterPsiData.ts (Pre-loaded 8-Campaign Masterfile)",
  );
  const [csvLoadMode, setCsvLoadMode] = useState<"append" | "replace">(
    "append",
  );
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pillarFilter, setPillarFilter] = useState<string>("All");
  const [provenanceFilter, setProvenanceFilter] = useState<
    "All" | DataProvenanceTier
  >("All");
  const [selectedIds, setSelectedIds] = useState<string[]>(["SAME", "DAFT"]);
  const [empiricalCampaignFilter, setEmpiricalCampaignFilter] =
    useState<string>("All");

  const simResult: CombustionSimulationResult = useMemo(
    () => simulateCombustionPhysics(params),
    [params],
  );

  const flameGeo: FlameRenderGeometry = useMemo(
    () => generateFlameRenderGeometry(simResult),
    [simResult],
  );

  const advancedFlameField: AdvancedFlameField = useMemo(
    () => generateAdvancedFlameField(simResult),
    [simResult],
  );

  const envelopeData: FlammabilityEnvelopeData = useMemo(
    () => generateFlammabilityEnvelopeData(params),
    [params],
  );

  const rankedInvestigations = useMemo(() => {
    const ranked = rankPsiInvestigations(params, pillarFilter, parsedRuns);
    if (provenanceFilter === "All") return ranked;
    return ranked.filter((inv) => inv.provenanceTier === provenanceFilter);
  }, [params, pillarFilter, provenanceFilter, parsedRuns]);

  const campaignCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of parsedRuns) {
      const cid = getRunCampaignId(run);
      counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
    return counts;
  }, [parsedRuns]);

  const filteredEmpiricalRuns = useMemo(() => {
    if (empiricalCampaignFilter === "All") return parsedRuns;
    return parsedRuns.filter(
      (run) => getRunCampaignId(run) === empiricalCampaignFilter,
    );
  }, [parsedRuns, empiricalCampaignFilter]);

  const phaseMatrix: FlammabilityPhaseMatrix = useMemo(
    () => generateFlammabilityPhaseMatrix(params, filteredEmpiricalRuns),
    [params, filteredEmpiricalRuns],
  );

  const closestRuns: EmpiricalRunMatch[] = useMemo(
    () => findClosestEmpiricalRuns(params, filteredEmpiricalRuns, 5),
    [params, filteredEmpiricalRuns],
  );

  const comparedInvestigations = useMemo(
    () =>
      selectedIds
        .map((id) => PSI_INVESTIGATIONS.find((inv) => inv.id === id))
        .filter((inv): inv is NonNullable<typeof inv> => Boolean(inv)),
    [selectedIds],
  );

  const laserBeam = advancedFlameField.chamberSensors.aerosolLaserBeam;

  useEffect(() => {
    const nextSig = `${simResult.regime}|${advancedFlameField.isBurning}`;
    if (lastRegimeSigRef.current === null) {
      lastRegimeSigRef.current = nextSig;
      return;
    }
    if (lastRegimeSigRef.current !== nextSig) {
      lastRegimeSigRef.current = nextSig;
      setRegimePulse(true);
      const timer = window.setTimeout(() => setRegimePulse(false), 650);
      return () => window.clearTimeout(timer);
    }
  }, [simResult.regime, advancedFlameField.isBurning]);

  const activeXRay = useMemo(
    () =>
      expandedMetric
        ? buildMetricAnnotation(expandedMetric, simResult, params)
        : null,
    [expandedMetric, simResult, params],
  );

  function updateParam<K extends keyof SimulationParams>(
    key: K,
    value: SimulationParams[K],
  ) {
    setParams((prev) => {
      if (key === "material") {
        return { ...prev, material: value as SimulatorMaterial, rawThicknessMm: undefined };
      }
      return { ...prev, [key]: value };
    });
  }

  function applyScenarioParams(nextParams: SimulationParams) {
    setParams({ ...nextParams });
  }

  function handleLaunchTutorial() {
    resetTutorial();
    setScenariosOpen(false);
    setTourActive(false);
    setWelcomeOpen(true);
  }

  function handleCsvFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const newlyParsed = parseAndNormalizePsiCsv(text);
        setCsvError(null);
        setParsedRuns((prev) =>
          csvLoadMode === "append" ? [...prev, ...newlyParsed] : newlyParsed,
        );
        setCsvSourceLabel(
          `${file.name} (+${newlyParsed.length} rows ${csvLoadMode === "append" ? "appended" : "replaced"})`,
        );
      } catch (err) {
        setCsvError(
          err instanceof Error ? err.message : "Failed to parse CSV file.",
        );
      }
    };
    reader.readAsText(file);
  }

  function handleInvestigationCheckbox(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  }

  return (
    <main className="ap-shell font-sans">
      <CosmicNebulaShader airflowCmS={params.airflowCmS} />
      <HeaderNav
        regime={simResult.regime}
        rowCount={parsedRuns.length}
        campaignCount={campaignCounts.size}
        onLaunchTutorial={handleLaunchTutorial}
        onOpenScenarios={() => setScenariosOpen(true)}
      />

      <OnboardingWelcome
        open={welcomeOpen}
        onClose={() => {
          setWelcomeOpen(false);
          markOnboardingSeen(true);
        }}
        onStartTour={() => {
          setWelcomeOpen(false);
          markOnboardingSeen(true);
          setTourActive(true);
        }}
        onOpenScenarios={() => {
          setWelcomeOpen(false);
          markOnboardingSeen(true);
          setScenariosOpen(true);
        }}
      />

      <SpotlightTour
        active={tourActive}
        steps={APULA_TOUR_STEPS}
        onExit={() => {
          setTourActive(false);
          markOnboardingSeen(true);
        }}
      />

      <HistoricalScenarios
        open={scenariosOpen}
        onClose={() => setScenariosOpen(false)}
        onApplyParams={applyScenarioParams}
        liveResult={simResult}
      />

      <div
        className={`ap-container relative z-10 py-8 md:py-10 space-y-12 ${
          pinnedHud ? "pb-24" : ""
        }`}
      >

        <section className="ap-enter grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <span className="ap-eyebrow block">Spacecraft Fire Safety Intelligence</span>
              <h1 className="ap-display-hero">
                Microgravity &amp; Partial-Gravity Combustion Risk Modeling
              </h1>
              <p className="ap-body ap-text-2">
                Unified semi-empirical flammability solver cross-checked continuously against{" "}
                <strong className="ap-text-1">{parsedRuns.length}</strong> NASA Physical Sciences Informatics flight tests across{" "}
                <strong className="ap-text-1">{campaignCounts.size}</strong> orbital campaigns.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setScenariosOpen(true)}
                className="ap-btn-primary px-5 py-2.5 text-[13px]"
              >
                Open Guided Mission Theater
              </button>
              <a
                href="#phase-charts"
                className="ap-btn-secondary px-4 py-2.5 text-[13px]"
              >
                Inspect Phase Envelope
              </a>
            </div>

            <div className="ap-card p-6 space-y-4">
              <div className="space-y-2">
                <span className="ap-eyebrow block">Empirical Flight Ledger</span>
                <h2 className="ap-h3">Pre-Loaded NASA Dataset</h2>
                <p className="ap-body-sm font-semibold ap-text-1">
                  Active Masterfile: {parsedRuns.length} Flight Test Rows across {campaignCounts.size} PSI Campaigns
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {EMPIRICAL_CAMPAIGN_IDS.map((cid) => (
                    <span
                      key={cid}
                      className="ap-subcard px-2.5 py-1 font-mono text-[11px] ap-text-2 tabular-nums"
                    >
                      {cid}: {campaignCounts.get(cid) ?? 0}
                    </span>
                  ))}
                </div>
              </div>

              <div className="ap-divider border-t pt-4 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="ap-btn-secondary px-3.5 py-1.5 text-[12px]"
                    >
                      Import CSV
                    </button>
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="ctrl-csv-mode"
                        className="ap-text-3 text-[11px] font-semibold"
                      >
                        CSV Import Mode
                      </label>
                      <select
                        id="ctrl-csv-mode"
                        value={csvLoadMode}
                        onChange={(e) =>
                          setCsvLoadMode(e.target.value as "append" | "replace")
                        }
                        className="ap-select px-2.5 py-1 text-[12px]"
                      >
                        <option value="append">Append</option>
                        <option value="replace">Replace</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRuns(loadMasterPsiDataset(MASTER_PSI_CSV));
                      setCsvSourceLabel(
                        "datum/masterPsiData.ts (Pre-loaded 8-Campaign Masterfile)",
                      );
                      setCsvError(null);
                    }}
                    className="ap-text-3 hover:ap-text-1 text-[12px] font-medium underline"
                  >
                    Reset
                  </button>
                </div>
                <div className="ap-text-3 text-[11px] truncate" title={csvSourceLabel}>
                  Source: {csvSourceLabel}
                  {csvError && (
                    <span className="ml-1 ap-prov-measured font-semibold">
                      · Error: {csvError}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div data-tour="telemetry" className="ap-card p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="ap-eyebrow block">Provenance X-Ray &amp; Solver HUD</span>
                  <h2 className="ap-h3">Live Combustion Telemetry</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPinnedHud((prev) => !prev)}
                  aria-pressed={pinnedHud}
                  className={`px-3 py-1.5 text-[11px] font-semibold transition ${
                    pinnedHud ? "ap-pill-active" : "ap-pill"
                  }`}
                >
                  {pinnedHud ? "HUD Pinned" : "Pin Floating Telemetry HUD"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <article
                  className={`ap-subcard ap-motion-ease p-3 space-y-1.5 ${
                    expandedMetric === "limitingO2Pct"
                      ? "ring-2 ring-[var(--ap-accent)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="ap-text-3 text-[11px] font-semibold">
                      Limiting O2 (LOI %)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="ap-prov-estimated text-[10px]">ESTIMATED</span>
                      <MetricAnnotationPopover
                        metric="limitingO2Pct"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="ap-pill px-1.5 py-0 text-[10px] font-mono">?</span>
                      </MetricAnnotationPopover>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMetric((prev) =>
                        prev === "limitingO2Pct" ? null : "limitingO2Pct",
                      )
                    }
                    aria-expanded={expandedMetric === "limitingO2Pct"}
                    className="w-full text-left font-mono tabular-nums space-y-1.5"
                  >
                    <div className="ap-text-1 text-[16px] font-bold">
                      {simResult.limitingO2Pct.toFixed(2)}% LOI
                    </div>
                    <div className="ap-meter-track">
                      <div
                        className="ap-meter-fill bg-[#38BDF8]"
                        style={{
                          width: `${Math.max(8, Math.min(100, (simResult.limitingO2Pct / 35) * 100)).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <div className="ap-text-3 text-[10px]">
                      Click tile for LOI equation X-ray
                    </div>
                  </button>
                </article>

                <article
                  className={`ap-subcard ap-motion-ease p-3 space-y-1.5 ${
                    regimePulse ? "ap-regime-pulse" : ""
                  } ${
                    expandedMetric === "oxygenMarginPct"
                      ? "ring-2 ring-[var(--ap-accent)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="ap-text-3 text-[11px] font-semibold">
                      O2 Safety Margin
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`ap-motion-ease rounded-full border px-2 py-0 text-[10px] font-semibold ${
                          advancedFlameField.isBurning
                            ? "ap-regime-elongated"
                            : "ap-regime-quenched"
                        } ${regimePulse ? "ap-regime-pulse" : ""}`}
                      >
                        {advancedFlameField.isBurning ? "IGNITED" : "QUENCHED"}
                      </span>
                      <MetricAnnotationPopover
                        metric="oxygenMarginPct"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="ap-pill px-1.5 py-0 text-[10px] font-mono">?</span>
                      </MetricAnnotationPopover>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMetric((prev) =>
                        prev === "oxygenMarginPct" ? null : "oxygenMarginPct",
                      )
                    }
                    aria-expanded={expandedMetric === "oxygenMarginPct"}
                    className="w-full text-left font-mono tabular-nums space-y-1.5"
                  >
                    <div className="ap-text-1 text-[16px] font-bold">
                      {simResult.oxygenMarginPct >= 0 ? "+" : ""}
                      {simResult.oxygenMarginPct.toFixed(2)}%
                    </div>
                    <div className="ap-meter-track">
                      <div
                        className={`ap-meter-fill ${
                          advancedFlameField.isBurning ? "bg-[#F97316]" : "bg-[#10B981]"
                        }`}
                        style={{
                          width: `${Math.max(8, Math.min(100, 38 + simResult.oxygenMarginPct * 4.5)).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <div className="ap-text-3 text-[10px]">
                      O2 ({params.o2Pct.toFixed(1)}%) - LOI ({simResult.limitingO2Pct.toFixed(2)}%)
                    </div>
                  </button>
                </article>

                <article
                  className={`ap-subcard ap-motion-ease p-3 space-y-1.5 ${
                    regimePulse ? "ap-regime-pulse" : ""
                  } ${
                    expandedMetric === "flameSpreadRateMmS"
                      ? "ring-2 ring-[var(--ap-accent)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="ap-text-3 text-[11px] font-semibold">
                      Flame Spread Rate
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="ap-prov-estimated text-[10px]">ESTIMATED</span>
                      <MetricAnnotationPopover
                        metric="flameSpreadRateMmS"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="ap-pill px-1.5 py-0 text-[10px] font-mono">?</span>
                      </MetricAnnotationPopover>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMetric((prev) =>
                        prev === "flameSpreadRateMmS"
                          ? null
                          : "flameSpreadRateMmS",
                      )
                    }
                    aria-expanded={expandedMetric === "flameSpreadRateMmS"}
                    className="w-full text-left font-mono tabular-nums space-y-1.5"
                  >
                    <div className="ap-text-1 text-[16px] font-bold">
                      {simResult.flameSpreadRateMmS.toFixed(2)} mm/s
                    </div>
                    <div className="ap-meter-track">
                      <div
                        className="ap-meter-fill bg-[#F59E0B]"
                        style={{
                          width: `${Math.max(4, Math.min(100, (simResult.flameSpreadRateMmS / 45) * 100)).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <div className="ap-text-3 text-[10px]">
                      Regime: {simResult.regime}
                    </div>
                  </button>
                </article>

                <article
                  className={`ap-subcard ap-motion-ease p-3 space-y-1.5 ${
                    expandedMetric === "effectiveVelocityCmS" ||
                    expandedMetric === "equivalentGravityG"
                      ? "ring-2 ring-[var(--ap-accent)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="ap-text-3 text-[11px] font-semibold">
                      v_eff / Eq. Gravity
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="ap-prov-estimated text-[10px]">ESTIMATED</span>
                      <MetricAnnotationPopover
                        metric="effectiveVelocityCmS"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="ap-pill px-1.5 py-0 text-[10px] font-mono">?</span>
                      </MetricAnnotationPopover>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMetric((prev) =>
                        prev === "effectiveVelocityCmS"
                          ? "equivalentGravityG"
                          : prev === "equivalentGravityG"
                            ? null
                            : "effectiveVelocityCmS",
                      )
                    }
                    aria-expanded={
                      expandedMetric === "effectiveVelocityCmS" ||
                      expandedMetric === "equivalentGravityG"
                    }
                    className="w-full text-left font-mono tabular-nums space-y-1.5"
                  >
                    <div className="ap-text-1 text-[15px] font-bold">
                      {simResult.effectiveVelocityCmS.toFixed(2)} cm/s
                    </div>
                    <div className="ap-meter-track">
                      <div
                        className="ap-meter-fill bg-[#06B6D4]"
                        style={{
                          width: `${Math.max(5, Math.min(100, (simResult.effectiveVelocityCmS / 30) * 100)).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <div className="ap-text-3 text-[10px]">
                      g_eq: {simResult.equivalentGravityG.toFixed(4)}g · ion {simResult.ionWindVelocityCmS.toFixed(1)} cm/s
                    </div>
                  </button>
                </article>

                <article
                  className={`ap-subcard ap-motion-ease p-3 space-y-1.5 ${
                    expandedMetric === "effectiveThicknessMm"
                      ? "ring-2 ring-[var(--ap-accent)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="ap-text-3 text-[11px] font-semibold">
                      Biot Curvature
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="ap-prov-inferred text-[10px]">INFERRED</span>
                      <MetricAnnotationPopover
                        metric="effectiveThicknessMm"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="ap-pill px-1.5 py-0 text-[10px] font-mono">?</span>
                      </MetricAnnotationPopover>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMetric((prev) =>
                        prev === "effectiveThicknessMm"
                          ? null
                          : "effectiveThicknessMm",
                      )
                    }
                    aria-expanded={expandedMetric === "effectiveThicknessMm"}
                    className="w-full text-left font-mono tabular-nums space-y-1.5"
                  >
                    <div className="ap-text-1 text-[15px] font-bold">
                      {getBiotCurvatureTag(simResult.geometryType)}
                    </div>
                    <div className="ap-meter-track">
                      <div
                        className="ap-meter-fill bg-[#A855F7]"
                        style={{
                          width: `${Math.max(10, Math.min(100, (simResult.effectiveThicknessMm / 3) * 100)).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <div className="ap-text-3 text-[10px]">
                      {simResult.effectiveThicknessMm.toFixed(2)} mm eff · raw {simResult.rawThicknessMm.toFixed(2)} mm
                    </div>
                  </button>
                </article>

                <article
                  className={`ap-subcard ap-motion-ease p-3 space-y-1.5 ${
                    expandedMetric === "adiabaticFlameTempK"
                      ? "ring-2 ring-[var(--ap-accent)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="ap-text-3 text-[11px] font-semibold">
                      Flame Temp &amp; Laser
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="ap-prov-estimated text-[10px]">ESTIMATED</span>
                      <MetricAnnotationPopover
                        metric="adiabaticFlameTempK"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="ap-pill px-1.5 py-0 text-[10px] font-mono">?</span>
                      </MetricAnnotationPopover>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMetric((prev) =>
                        prev === "adiabaticFlameTempK"
                          ? null
                          : "adiabaticFlameTempK",
                      )
                    }
                    aria-expanded={expandedMetric === "adiabaticFlameTempK"}
                    className="w-full text-left font-mono tabular-nums space-y-1.5"
                  >
                    <div className="ap-text-1 text-[15px] font-bold">
                      {simResult.adiabaticFlameTempK} K
                    </div>
                    <div className="ap-meter-track">
                      <div
                        className="ap-meter-fill bg-[#EF4444]"
                        style={{
                          width: `${Math.max(6, Math.min(100, ((simResult.adiabaticFlameTempK - 295) / 2200) * 100)).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <div className="ap-text-3 text-[10px] truncate">
                      {laserBeam.alarmState} · {laserBeam.meanParticleDiameterUm} µm ({laserBeam.obscurationPct}%)
                    </div>
                  </button>
                </article>
              </div>

              {activeXRay && (
                <div className="ap-subcard p-3.5 space-y-2.5 border border-[var(--ap-accent)]/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ap-text-1 font-display text-[13px] font-semibold">
                        {activeXRay.label}
                      </span>
                      <span className={FIELD_PROVENANCE_BADGE_CLASSES[activeXRay.provenance]}>
                        {activeXRay.provenanceBadge}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(expandedMetric === "effectiveVelocityCmS" ||
                        expandedMetric === "equivalentGravityG") && (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedMetric("effectiveVelocityCmS")}
                            className={`px-2 py-0.5 text-[10px] font-mono ${
                              expandedMetric === "effectiveVelocityCmS"
                                ? "ap-pill-active"
                                : "ap-pill"
                            }`}
                          >
                            v_eff
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedMetric("equivalentGravityG")}
                            className={`px-2 py-0.5 text-[10px] font-mono ${
                              expandedMetric === "equivalentGravityG"
                                ? "ap-pill-active"
                                : "ap-pill"
                            }`}
                          >
                            g_eq
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedMetric(null)}
                        aria-label="Collapse formula X-ray"
                        className="ap-pill inline-flex items-center justify-center p-1"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.75}
                          className="w-3 h-3"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 4l8 8M12 4l-8 8"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <p className="ap-text-2 text-[12px] leading-snug">
                    {activeXRay.meaning}
                  </p>

                  {expandedMetric === "adiabaticFlameTempK" && (
                    <div className="ap-text-3 text-[11px] font-mono">
                      Laser Discrimination: {laserBeam.alarmState} · mean {laserBeam.meanParticleDiameterUm} µm · obscuration {laserBeam.obscurationPct}%
                    </div>
                  )}

                  <div className="ap-text-3 font-mono text-[10px] break-all">
                    {activeXRay.symbolicFormula}
                  </div>
                  <div className="ap-callout-info px-2.5 py-1.5 font-mono text-[11px] font-semibold break-all tabular-nums">
                    {activeXRay.substitutedEquation}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="ap-text-3">
                      Value: <strong className="ap-text-1">{activeXRay.liveValue}</strong>
                    </span>
                    <span
                      className={
                        activeXRay.verification.verified
                          ? "ap-prov-estimated"
                          : "ap-prov-measured"
                      }
                    >
                      {activeXRay.verification.verified
                        ? "SELF-CHECK MATCH"
                        : `DELTA ${activeXRay.verification.delta}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div data-tour="chamber" className="ap-card p-4 md:p-5 space-y-3">
              <div className="flex flex-wrap justify-between items-baseline gap-2">
                <div>
                  <span className="ap-eyebrow block">Interactive Simulation</span>
                  <h2 className="ap-h3">
                    3D Microgravity Wind-Tunnel &amp; Flame Morphology Chamber
                  </h2>
                </div>
                <span className="ap-text-3 font-mono text-[11px]">
                  ThreeFlameChamber · 60 FPS WebGL Additive Blending
                </span>
              </div>

              <ThreeFlameChamber
                simResult={simResult}
                flameGeometry={flameGeo}
                advancedField={advancedFlameField}
              />
            </div>

            <div data-tour="controls" className="ap-card p-5 space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="ap-eyebrow block">Atmosphere &amp; Gravity Parameters</span>
                  <h2 className="ap-h3">Cabin Environment &amp; Material Controls</h2>
                </div>
                <span className="ap-text-3 font-mono text-[11px]">
                  Contract: SimulationParams
                </span>
              </div>

              <div className="space-y-2">
                <div className="ap-text-3 text-[11px] font-semibold">
                  Habitat &amp; Experiment Presets
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {HABITAT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setParams((prev) => ({
                          ...prev,
                          ...preset.params,
                          rawThicknessMm: undefined,
                        }))
                      }
                      className="ap-subcard px-3.5 py-2.5 text-left transition hover:opacity-85"
                    >
                      <div className="ap-text-1 font-display text-[13px] font-semibold tracking-[-0.22px]">
                        {preset.label}
                      </div>
                      <div className="ap-text-3 font-mono text-[11px] mt-0.5 tabular-nums">
                        {preset.subtitle}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="ap-subcard p-3.5 space-y-2">
                  <div className="ap-text-1 flex justify-between text-[12px] font-medium">
                    <label htmlFor="ctrl-o2" className="font-semibold">
                      O2 Concentration (% vol)
                    </label>
                    <span className="ap-text-3 font-mono text-[11px] tabular-nums">10–100%</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="ctrl-o2"
                      type="range"
                      min={10}
                      max={100}
                      step={0.5}
                      value={params.o2Pct}
                      onChange={(e) =>
                        updateParam("o2Pct", Number.parseFloat(e.target.value))
                      }
                      className="ap-slider w-full"
                    />
                    <input
                      type="number"
                      aria-label="O2 Concentration (% vol) value"
                      min={10}
                      max={100}
                      step={0.5}
                      value={params.o2Pct}
                      onChange={(e) =>
                        updateParam("o2Pct", Number.parseFloat(e.target.value) || 10)
                      }
                      className="ap-input w-20 px-2 py-1 font-mono text-xs text-right tabular-nums"
                    />
                  </div>
                </div>

                <div className="ap-subcard p-3.5 space-y-2">
                  <div className="ap-text-1 flex justify-between text-[12px] font-medium">
                    <label htmlFor="ctrl-pressure" className="font-semibold">
                      Cabin Pressure (psi)
                    </label>
                    <span className="ap-text-3 font-mono text-[11px] tabular-nums">4.0–15.0</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="ctrl-pressure"
                      type="range"
                      min={4}
                      max={15}
                      step={0.1}
                      value={params.pressurePsi}
                      onChange={(e) =>
                        updateParam(
                          "pressurePsi",
                          Number.parseFloat(e.target.value),
                        )
                      }
                      className="ap-slider w-full"
                    />
                    <input
                      type="number"
                      aria-label="Cabin Pressure (psi) value"
                      min={4}
                      max={15}
                      step={0.1}
                      value={params.pressurePsi}
                      onChange={(e) =>
                        updateParam(
                          "pressurePsi",
                          Number.parseFloat(e.target.value) || 4,
                        )
                      }
                      className="ap-input w-20 px-2 py-1 font-mono text-xs text-right tabular-nums"
                    />
                  </div>
                </div>

                <div className="ap-subcard p-3.5 space-y-2">
                  <div className="ap-text-1 flex justify-between text-[12px] font-medium">
                    <label htmlFor="ctrl-airflow" className="font-semibold">
                      Airflow Velocity (cm/s)
                    </label>
                    <span className="ap-text-3 font-mono text-[11px] tabular-nums">0–60</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="ctrl-airflow"
                      type="range"
                      min={0}
                      max={60}
                      step={0.5}
                      value={params.airflowCmS}
                      onChange={(e) =>
                        updateParam("airflowCmS", Number.parseFloat(e.target.value))
                      }
                      className="ap-slider w-full"
                    />
                    <input
                      type="number"
                      aria-label="Airflow Velocity (cm/s) value"
                      min={0}
                      max={60}
                      step={0.5}
                      value={params.airflowCmS}
                      onChange={(e) =>
                        updateParam(
                          "airflowCmS",
                          Number.parseFloat(e.target.value) || 0,
                        )
                      }
                      className="ap-input w-20 px-2 py-1 font-mono text-xs text-right tabular-nums"
                    />
                  </div>
                </div>

                <div className="ap-subcard p-3.5 space-y-2">
                  <div className="ap-text-1 flex justify-between text-[12px] font-medium">
                    <label htmlFor="ctrl-gravity" className="font-semibold">
                      Gravity Level (g)
                    </label>
                    <span className="ap-text-3 font-mono text-[11px] tabular-nums">0.00–1.00g</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="ctrl-gravity"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={params.gravityG}
                      onChange={(e) =>
                        updateParam("gravityG", Number.parseFloat(e.target.value))
                      }
                      className="ap-slider w-full"
                    />
                    <input
                      type="number"
                      aria-label="Gravity Level (g) value"
                      min={0}
                      max={1}
                      step={0.01}
                      value={params.gravityG}
                      onChange={(e) =>
                        updateParam(
                          "gravityG",
                          Number.parseFloat(e.target.value) || 0,
                        )
                      }
                      className="ap-input w-20 px-2 py-1 font-mono text-xs text-right tabular-nums"
                    />
                  </div>
                </div>

                <div className="ap-subcard p-3.5 space-y-2">
                  <div className="ap-text-1 flex justify-between text-[12px] font-medium">
                    <label htmlFor="ctrl-efield" className="font-semibold">
                      Electric Field (V/cm)
                    </label>
                    <span className="ap-text-3 font-mono text-[11px] tabular-nums">0–3000</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="ctrl-efield"
                      type="range"
                      min={0}
                      max={3000}
                      step={25}
                      value={params.electricFieldVoltsCm}
                      onChange={(e) =>
                        updateParam(
                          "electricFieldVoltsCm",
                          Number.parseFloat(e.target.value),
                        )
                      }
                      className="ap-slider w-full"
                    />
                    <input
                      type="number"
                      aria-label="Electric Field (V/cm) value"
                      min={0}
                      max={3000}
                      step={25}
                      value={params.electricFieldVoltsCm}
                      onChange={(e) =>
                        updateParam(
                          "electricFieldVoltsCm",
                          Number.parseFloat(e.target.value) || 0,
                        )
                      }
                      className="ap-input w-20 px-2 py-1 font-mono text-xs text-right tabular-nums"
                    />
                  </div>
                </div>

                <div className="ap-subcard p-3.5 space-y-2">
                  <div className="ap-text-1 flex justify-between text-[12px] font-medium">
                    <label htmlFor="ctrl-co2" className="font-semibold">
                      CO2 Dilution (% vol)
                    </label>
                    <span className="ap-text-3 font-mono text-[11px] tabular-nums">0–20%</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="ctrl-co2"
                      type="range"
                      min={0}
                      max={20}
                      step={0.5}
                      value={params.co2DilutionPct}
                      onChange={(e) =>
                        updateParam(
                          "co2DilutionPct",
                          Number.parseFloat(e.target.value),
                        )
                      }
                      className="ap-slider w-full"
                    />
                    <input
                      type="number"
                      aria-label="CO2 Dilution (% vol) value"
                      min={0}
                      max={20}
                      step={0.5}
                      value={params.co2DilutionPct}
                      onChange={(e) =>
                        updateParam(
                          "co2DilutionPct",
                          Number.parseFloat(e.target.value) || 0,
                        )
                      }
                      className="ap-input w-20 px-2 py-1 font-mono text-xs text-right tabular-nums"
                    />
                  </div>
                </div>

                <div className="ap-subcard p-3.5 sm:col-span-2 space-y-2.5">
                  <div className="ap-text-1 flex flex-wrap justify-between gap-2 text-[12px] font-medium">
                    <label htmlFor="ctrl-material" className="font-semibold">
                      Material &amp; Sample Geometry
                    </label>
                    <span className="ap-text-3 font-mono text-[11px] tabular-nums">
                      Active: {simResult.geometryType} ({simResult.effectiveThicknessMm.toFixed(2)} mm eff)
                    </span>
                  </div>
                  <select
                    id="ctrl-material"
                    value={params.material}
                    onChange={(e) =>
                      updateParam("material", e.target.value as SimulatorMaterial)
                    }
                    className="ap-select w-full px-3 py-1.5 text-[13px]"
                  >
                    {SIMULATOR_MATERIALS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="ap-text-3 text-[11px] font-semibold mr-1">
                      Geometry
                    </span>
                    {GEOMETRY_OVERRIDE_PILLS.map((pill) => {
                      const isActive = params.geometryType === pill.value;
                      return (
                        <button
                          key={pill.label}
                          type="button"
                          onClick={() => updateParam("geometryType", pill.value)}
                          className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            isActive ? "ap-pill-active" : "ap-pill"
                          }`}
                        >
                          {pill.label}
                        </button>
                      );
                    })}
                    {typeof params.rawThicknessMm === "number" && (
                      <button
                        type="button"
                        onClick={() => updateParam("rawThicknessMm", undefined)}
                        title="Reset mission thickness override back to preset default"
                        className="ap-prov-inferred inline-flex items-center gap-1 px-2 py-0.5 text-[11px] underline"
                      >
                        <span>Thickness: {params.rawThicknessMm.toFixed(3)} mm</span>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.75}
                          className="w-3 h-3"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 4l8 8M12 4l-8 8"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ap-enter ap-divider border-t pt-10 space-y-6">
          <div className="space-y-1">
            <span className="ap-eyebrow block">Spacecraft Fire Architecture</span>
            <h2 className="ap-h2">Empirical Pillars &amp; Partial-Gravity Bounds</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6">
            <div className="ap-card p-6 md:p-7 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <span className="ap-eyebrow block">Pillar 01 · Material Screening</span>
                <h3 className="ap-h3">Prevention: BASS &amp; SAFFIRE-3</h3>
                <p className="ap-body-sm">
                  Screens spacecraft polymers and Nomex textiles across low-speed microgravity flow ducts and full-scale Cygnus logistics hulls so ignition thresholds stay above cabin oxygen limits.
                </p>
              </div>
              <div className="ap-text-3 font-mono text-[11px]">
                Curvature-scaled thermal thickness feeds direct Biot conduction response
              </div>
            </div>

            <div className="ap-card p-6 md:p-7 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <span className="ap-eyebrow block">Analytical Bounds</span>
                <h3 className="ap-h3">Theory Meets Empirical Proof</h3>
                <p className="ap-body-sm">
                  Full-scale Lunar (<strong className="ap-text-1">0.16g</strong>) and Martian (<strong className="ap-text-1">0.38g</strong>) combustion flight datasets await orbital flight validation. The solver simulates cool flames and ion wind while bounding partial-gravity habitats between proven <strong className="ap-text-1">0g</strong> and <strong className="ap-text-1">1g</strong> baselines.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] gap-6">
            <div className="ap-card p-6 md:p-7 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <span className="ap-eyebrow block">Pillar 02 · False-Alarm Rejection</span>
                <h3 className="ap-h3">Detection: SAME &amp; DAFT</h3>
                <p className="ap-body-sm">
                  Separates sub-micron smoldering wire smoke from 1–20 µm floating cabin lint and regolith dust so deep-space crews avoid spurious smoke alarms without delaying true fire alerts.
                </p>
              </div>
            </div>

            <div className="ap-card p-6 md:p-7 flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <span className="ap-eyebrow block">Pillar 03 · Extinguishment</span>
                <h3 className="ap-h3">Suppression: FLEX &amp; FLEX-2</h3>
                <p className="ap-body-sm">
                  Quantifies radiative cool-flame plateaus, CO2 dilution thresholds, and low-flow droplet extinction limits in weightlessness, addressing hazard regimes learned since Apollo 1 and Mir.
                </p>
              </div>
              <div className="ap-text-3 font-mono text-[11px]">
                Low-flow spherical regimes tracked from 20 cm/s down to quiescent 0 cm/s
              </div>
            </div>
          </div>
        </section>

        <section data-tour="scenarios" className="ap-enter ap-divider border-t pt-10 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="ap-eyebrow block">Orbital &amp; Partial-G Case Studies</span>
              <h2 className="ap-h2">Historical Spaceflight Burn Recreator</h2>
              <p className="ap-body-sm ap-text-3">
                One-click replay of five documented spaceflight experiments comparing NASA observations with APULA predictions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScenariosOpen(true)}
              className="ap-btn-primary px-5 py-2.5 text-[14px]"
            >
              Open Guided Mission Theater
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {HISTORICAL_SCENARIOS.map((scenario) => {
              const defVariant =
                scenario.variants.find((v) => v.id === scenario.defaultVariantId) ??
                scenario.variants[0];
              const active = scenario.variants.some((v) =>
                doesLiveResultMatchVariant(simResult, v),
              );
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => {
                    applyScenarioParams(defVariant.params);
                    setScenariosOpen(true);
                  }}
                  className={`ap-card p-5 text-left transition flex flex-col justify-between gap-3 ${
                    active ? "ring-2 ring-[var(--ap-accent)]" : "hover:opacity-90"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="ap-eyebrow truncate">
                        {scenario.missionTag}
                      </span>
                      {active && (
                        <span className="ap-prov-measured inline-flex items-center gap-1 shrink-0">
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
                          <span>Active</span>
                        </span>
                      )}
                    </div>
                    <div className="ap-text-1 font-display text-[16px] font-semibold tracking-[-0.22px] mt-1.5 line-clamp-2">
                      {scenario.title}
                    </div>
                  </div>
                  <div className="ap-text-3 font-mono text-[11px] tabular-nums">
                    {defVariant.expected.limitingO2Pct}% LOI · {defVariant.expected.flameSpreadRateMmS} mm/s
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="ap-enter ap-divider border-t pt-10 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="space-y-1">
              <span className="ap-eyebrow block">Real-Time Solver Output</span>
              <h2 className="ap-h2">Detailed Solver &amp; Flame Geometry Matrix</h2>
            </div>
            <span className="ap-text-3 text-[12px]">
              Hover or click any provenance indicator or ? trigger to inspect live equation terms
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6">

            <div className="ap-card p-5 ap-table-wrap">
              <div className="ap-divider flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 mb-2">
                <h3 className="ap-h3">Combustion Simulation Result</h3>
                <MetricAnnotationPopover
                  metric="limitingO2Pct"
                  simResult={simResult}
                  params={params}
                >
                  <span className={FIELD_PROVENANCE_BADGE_CLASSES.ESTIMATED}>
                    {simResult.metricProvenance.limitingO2Pct?.badge} ?
                  </span>
                </MetricAnnotationPopover>
              </div>
              <table className="w-full text-[13px]">
                <tbody>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">regime</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold">
                      {simResult.regime}
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">
                      Biot Curvature / effThicknessMm ({simResult.geometryType})
                    </td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      <MetricAnnotationPopover
                        metric="effectiveThicknessMm"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{simResult.effectiveThicknessMm.toFixed(2)} mm</span>
                          <span className="ap-text-3 font-normal text-[11px]">
                            (raw {simResult.rawThicknessMm.toFixed(2)})
                          </span>
                          <span className="ap-prov-inferred">?</span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">limitingO2Pct (LOI)</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      <MetricAnnotationPopover
                        metric="limitingO2Pct"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{simResult.limitingO2Pct.toFixed(2)} %</span>
                          <span className={FIELD_PROVENANCE_BADGE_CLASSES.ESTIMATED}>
                            ESTIMATED ?
                          </span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">oxygenMarginPct</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      <MetricAnnotationPopover
                        metric="oxygenMarginPct"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>
                            {simResult.oxygenMarginPct >= 0 ? "+" : ""}
                            {simResult.oxygenMarginPct.toFixed(2)} %
                          </span>
                          <span className="ap-prov-estimated">?</span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">buoyantVelocityCmS</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs tabular-nums">
                      {simResult.buoyantVelocityCmS.toFixed(2)} cm/s
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">ionWindVelocityCmS</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs tabular-nums">
                      {simResult.ionWindVelocityCmS.toFixed(2)} cm/s
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">effectiveVelocityCmS</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      <MetricAnnotationPopover
                        metric="effectiveVelocityCmS"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{simResult.effectiveVelocityCmS.toFixed(2)} cm/s</span>
                          <span className="ap-prov-estimated">?</span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">equivalentGravityG</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs tabular-nums">
                      <MetricAnnotationPopover
                        metric="equivalentGravityG"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{simResult.equivalentGravityG.toFixed(4)} g</span>
                          <span className={FIELD_PROVENANCE_BADGE_CLASSES.ESTIMATED}>
                            ION-PROXY ?
                          </span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">flameSpreadRateMmS</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      <MetricAnnotationPopover
                        metric="flameSpreadRateMmS"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{simResult.flameSpreadRateMmS.toFixed(2)} mm/s</span>
                          <span className={FIELD_PROVENANCE_BADGE_CLASSES.ESTIMATED}>
                            ESTIMATED ?
                          </span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">adiabaticFlameTempK</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      <MetricAnnotationPopover
                        metric="adiabaticFlameTempK"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{simResult.adiabaticFlameTempK} K</span>
                          <span className={FIELD_PROVENANCE_BADGE_CLASSES.ESTIMATED}>
                            ESTIMATED ?
                          </span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">estimatedCO_ppm</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      <MetricAnnotationPopover
                        metric="estimatedCO_ppm"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{simResult.estimatedCO_ppm} ppm</span>
                          <span className="ap-prov-estimated">?</span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">estimatedCO2_pct</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs tabular-nums">
                      <MetricAnnotationPopover
                        metric="estimatedCO2_pct"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{simResult.estimatedCO2_pct.toFixed(2)} %</span>
                          <span className="ap-prov-estimated">?</span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">smokeSootIndex</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      <MetricAnnotationPopover
                        metric="smokeSootIndex"
                        simResult={simResult}
                        params={params}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{simResult.smokeSootIndex} / 100</span>
                          <span className="ap-prov-estimated">?</span>
                        </span>
                      </MetricAnnotationPopover>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="ap-card p-5 ap-table-wrap">
              <div className="ap-divider flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 mb-2">
                <h3 className="ap-h3">Flame Render Geometry</h3>
                <MetricAnnotationPopover provenance="ESTIMATED">
                  <span className={FIELD_PROVENANCE_BADGE_CLASSES.ESTIMATED}>
                    {simResult.metricProvenance.flameGeometryAndTemp?.badge} ?
                  </span>
                </MetricAnnotationPopover>
              </div>
              <table className="w-full text-[13px]">
                <tbody>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">flameLengthMm</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      {flameGeo.flameLengthMm.toFixed(1)} mm
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">flameWidthMm</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      {flameGeo.flameWidthMm.toFixed(1)} mm
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">aspectRatio (L/W)</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                      {flameGeo.aspectRatio.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">isInsideOutBurner</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold">
                      {String(flameGeo.isInsideOutBurner)}
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">coreColorHex</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold flex items-center justify-end gap-1.5">
                      <span
                        className="ap-divider inline-block w-3.5 h-3.5 rounded-sm border"
                        style={{ backgroundColor: flameGeo.coreColorHex }}
                      />
                      {flameGeo.coreColorHex}
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">outerGlowColorHex</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs font-semibold flex items-center justify-end gap-1.5">
                      <span
                        className="ap-divider inline-block w-3.5 h-3.5 rounded-sm border"
                        style={{ backgroundColor: flameGeo.outerGlowColorHex }}
                      />
                      {flameGeo.outerGlowColorHex}
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">sootTailOpacity</td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs tabular-nums">
                      {flameGeo.sootTailOpacity.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-text-3 py-2 font-mono text-xs">
                      flickerFrequencyHz
                    </td>
                    <td className="ap-text-1 py-2 text-right font-mono text-xs tabular-nums">
                      {flameGeo.flickerFrequencyHz.toFixed(1)} Hz
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="phase-charts" data-tour="phase-charts" className="ap-enter ap-divider border-t pt-10 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="space-y-1">
              <span className="ap-eyebrow block">Boundary Phase Space</span>
              <h2 className="ap-h2">
                Partial-Gravity Envelopes &amp; Ventilation U-Curve
              </h2>
            </div>
            <span className="ap-text-3 font-mono text-[11px]">
              generateFlammabilityEnvelopeData + generateFlammabilityPhaseMatrix
            </span>
          </div>

          <div className="ap-banner-disclaimer px-4 py-3 text-[13px] leading-relaxed">
            <strong>Partial-Gravity Bounding Note:</strong> Because Lunar (0.16g) and
            Martian (0.38g) flight combustion datasets await{" "}
            <strong>LUCI</strong> and <strong>FM2</strong>, the engine explicitly
            bounds <code>loi_lunar_016g_bounded</code> and{" "}
            <code>loi_mars_038g_bounded</code> between empirical{" "}
            <strong>0g</strong> (BASS-II / SAFFIRE-3) and{" "}
            <strong>1g</strong> Earth flammability baselines, rendered as the
            shaded phase corridor alongside iso-spread contours and the 12-step
            pre-breathe decompression tradeoff vector.
          </div>

          <FlammabilityPhaseCharts
            params={params}
            envelopeData={envelopeData}
            phaseMatrix={phaseMatrix}
          />
        </section>

        <section className="ap-divider border-t pt-10 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <span className="ap-eyebrow block">Literature &amp; Campaign Ledger</span>
              <h2 className="ap-h2">NASA PSI Investigation Ranker</h2>
              <p className="ap-body-sm ap-text-3">
                Showing {rankedInvestigations.length} of{" "}
                {PSI_INVESTIGATIONS.length} studies · Selected for Comparison Matrix:{" "}
                {selectedIds.join(" vs. ") || "None"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="ap-text-3 text-[11px] font-semibold mr-1">
                  Pillar
                </span>
                {["All", "Prevention", "Detection", "Suppression"].map(
                  (pillar) => (
                    <button
                      key={pillar}
                      type="button"
                      onClick={() => setPillarFilter(pillar)}
                      className={`px-3 py-1 text-[12px] font-medium ${
                        pillarFilter === pillar ? "ap-pill-active" : "ap-pill"
                      }`}
                    >
                      {pillar}
                    </button>
                  ),
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="ap-text-3 text-[11px] font-semibold mr-1">
                  Provenance
                </span>
                {(
                  [
                    { value: "All", label: "All" },
                    {
                      value: "EMPIRICAL_CSV_LOADED",
                      label: "Empirical CSV Loaded",
                    },
                    {
                      value: "PHYSICS_AND_METADATA_MODEL",
                      label: "Physics Simulated",
                    },
                    {
                      value: "FUTURE_LUNAR_FLIGHT",
                      label: "Future Lunar Flight",
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setProvenanceFilter(item.value)}
                    className={`px-3 py-1 text-[12px] font-medium ${
                      provenanceFilter === item.value
                        ? "ap-pill-active"
                        : "ap-pill"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {rankedInvestigations.map((inv) => {
              const isChecked = selectedIds.includes(inv.id);
              const badgeClasses = getProvenanceBadgeClasses(
                inv.provenanceTier,
              );
              return (
                <div
                  key={inv.id}
                  className={`ap-card p-6 flex flex-col justify-between transition ${
                    isChecked ? "ring-2 ring-[var(--ap-accent)]" : ""
                  }`}
                >
                  <div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <span className={badgeClasses}>
                        {inv.provenanceBadgeText}
                        {inv.provenanceTier === "EMPIRICAL_CSV_LOADED" &&
                          ` · ${inv.loadedRowCount} CSV Rows`}
                      </span>
                      <span className="ap-subcard font-mono text-[11px] font-semibold px-2.5 py-0.5 tabular-nums ap-text-1">
                        Match {inv.score}/100
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="ap-h3">
                          {inv.id} — {inv.title}
                        </h3>
                        <p className="ap-text-3 text-[12px] mt-0.5">
                          Pillar: <strong className="ap-text-1">{inv.pillar}</strong> · Rack:{" "}
                          <strong className="ap-text-1">{inv.hardwareRack}</strong> · Phase:{" "}
                          <strong className="ap-text-1">{inv.fuelPhase}</strong>
                        </p>
                      </div>
                      <label className="ap-pill flex items-center gap-1.5 text-[12px] font-medium px-3 py-1 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleInvestigationCheckbox(inv.id)}
                          aria-label={`Select ${inv.id} for Comparison Matrix`}
                          className="h-3.5 w-3.5 accent-[var(--ap-accent)]"
                        />
                        Compare
                      </label>
                    </div>

                    <div className="ap-divider border-l-2 pl-3 py-0.5 mb-3 text-[13px] ap-text-2 leading-relaxed">
                      <strong className="ap-text-3 text-[11px] font-semibold">
                        Purpose in Space Safety:{" "}
                      </strong>
                      {inv.purposeInSpaceSafety}
                    </div>
                  </div>

                  <div className="ap-divider border-t pt-3 mt-1 text-[12px] ap-text-3 space-y-1">
                    <div className="font-mono text-[11px] tabular-nums">
                      <strong className="ap-text-2">Envelope:</strong> O2 {inv.o2RangePct[0]}–
                      {inv.o2RangePct[1]}% · P {inv.pressureRangePsi[0]}–
                      {inv.pressureRangePsi[1]} psi · Flow{" "}
                      {inv.airflowRangeCmS[0]}–{inv.airflowRangeCmS[1]} cm/s
                    </div>
                    <div className="ap-text-2">
                      <strong>Relevance:</strong>{" "}
                      {inv.whyRelevantForHabitat}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ap-divider border-t pt-10 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="space-y-1">
              <span className="ap-eyebrow block">Cross-Experiment Comparison</span>
              <h2 className="ap-h2">
                Intra- vs. Inter-Investigation Comparison Matrix
              </h2>
            </div>
            <span className="ap-text-3 text-[12px]">
              Hardware racks, fixed constants, swept variables, cross-links, and Earth spin-offs
            </span>
          </div>

          {comparedInvestigations.length < 2 ? (
            <div className="ap-card p-6 text-[13px] ap-text-3">
              Select two investigations in the NASA PSI Investigation Ranker above to populate the side-by-side comparison matrix.
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label="Intra- vs. Inter-Investigation Comparison Matrix"
              className="ap-table-wrap"
            >
              <table className="w-full text-[13px] text-left">
                <thead>
                  <tr className="ap-table-head ap-table-row text-[12px] font-semibold">
                    <th className="py-3 pr-4 w-48">Comparison Dimension</th>
                    <th className="ap-divider py-3 px-4 border-l w-1/2 ap-text-1">
                      [A] {comparedInvestigations[0].id} —{" "}
                      {comparedInvestigations[0].title}
                    </th>
                    <th className="ap-divider py-3 pl-4 border-l w-1/2 ap-text-1">
                      [B] {comparedInvestigations[1].id} —{" "}
                      {comparedInvestigations[1].title}
                    </th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="ap-table-row">
                    <td className="ap-table-stripe ap-text-1 py-3 pr-4 font-semibold">
                      Provenance Tier &amp; Safety Purpose
                    </td>
                    <td className="ap-divider py-3 px-4 border-l space-y-1.5">
                      <span
                        className={getProvenanceBadgeClasses(
                          comparedInvestigations[0].provenanceTier,
                        )}
                      >
                        {comparedInvestigations[0].provenanceBadgeText}
                      </span>
                      <p className="ap-text-2">
                        {comparedInvestigations[0].purposeInSpaceSafety}
                      </p>
                    </td>
                    <td className="ap-divider py-3 pl-4 border-l space-y-1.5">
                      <span
                        className={getProvenanceBadgeClasses(
                          comparedInvestigations[1].provenanceTier,
                        )}
                      >
                        {comparedInvestigations[1].provenanceBadgeText}
                      </span>
                      <p className="ap-text-2">
                        {comparedInvestigations[1].purposeInSpaceSafety}
                      </p>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-table-stripe ap-text-1 py-3 pr-4 font-semibold">
                      Pillar &amp; Gravity Regime
                    </td>
                    <td className="ap-divider ap-text-2 py-3 px-4 border-l">
                      <div>
                        <strong className="ap-text-1">Pillar:</strong>{" "}
                        {comparedInvestigations[0].pillar}
                      </div>
                      <div>
                        <strong className="ap-text-1">Regime:</strong>{" "}
                        {comparedInvestigations[0].gravityRegime}
                      </div>
                    </td>
                    <td className="ap-divider ap-text-2 py-3 pl-4 border-l">
                      <div>
                        <strong className="ap-text-1">Pillar:</strong>{" "}
                        {comparedInvestigations[1].pillar}
                      </div>
                      <div>
                        <strong className="ap-text-1">Regime:</strong>{" "}
                        {comparedInvestigations[1].gravityRegime}
                      </div>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-table-stripe ap-text-1 py-3 pr-4 font-semibold">
                      Hardware Rack (MSG, CIR, MDCA, Cygnus)
                    </td>
                    <td className="ap-divider ap-text-1 py-3 px-4 border-l font-semibold">
                      {comparedInvestigations[0].hardwareRack}
                    </td>
                    <td className="ap-divider ap-text-1 py-3 pl-4 border-l font-semibold">
                      {comparedInvestigations[1].hardwareRack}
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-table-stripe ap-text-1 py-3 pr-4 font-semibold">
                      Fuel Phase &amp; Samples
                    </td>
                    <td className="ap-divider py-3 px-4 border-l">
                      <div className="ap-text-1 font-semibold">
                        Phase: {comparedInvestigations[0].fuelPhase}
                      </div>
                      <div className="ap-text-2 mt-1">
                        {comparedInvestigations[0].fuelSamples}
                      </div>
                    </td>
                    <td className="ap-divider py-3 pl-4 border-l">
                      <div className="ap-text-1 font-semibold">
                        Phase: {comparedInvestigations[1].fuelPhase}
                      </div>
                      <div className="ap-text-2 mt-1">
                        {comparedInvestigations[1].fuelSamples}
                      </div>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-table-stripe ap-text-1 py-3 pr-4 font-semibold">
                      Fixed Constants
                    </td>
                    <td className="ap-divider ap-text-2 py-3 px-4 border-l">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[0].intraFixedVars.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="ap-divider ap-text-2 py-3 pl-4 border-l">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[1].intraFixedVars.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-table-stripe ap-text-1 py-3 pr-4 font-semibold">
                      Swept Variables
                    </td>
                    <td className="ap-divider ap-text-2 py-3 px-4 border-l">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[0].intraSweptVars.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="ap-divider ap-text-2 py-3 pl-4 border-l">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[1].intraSweptVars.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-table-stripe ap-text-1 py-3 pr-4 font-semibold">
                      Diagnostic Sensors
                    </td>
                    <td className="ap-divider ap-text-2 py-3 px-4 border-l">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[0].sensors.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="ap-divider ap-text-2 py-3 pl-4 border-l">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[1].sensors.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-table-stripe ap-text-1 py-3 pr-4 font-semibold">
                      Cross-Investigation Link
                    </td>
                    <td className="ap-divider py-3 px-4 border-l">
                      <div className="ap-text-1 font-semibold">
                        Linked Study:{" "}
                        {
                          comparedInvestigations[0].crossInvestigationLink
                            .relatedId
                        }
                      </div>
                      <p className="ap-text-2 mt-1">
                        {
                          comparedInvestigations[0].crossInvestigationLink
                            .explanation
                        }
                      </p>
                    </td>
                    <td className="ap-divider py-3 pl-4 border-l">
                      <div className="ap-text-1 font-semibold">
                        Linked Study:{" "}
                        {
                          comparedInvestigations[1].crossInvestigationLink
                            .relatedId
                        }
                      </div>
                      <p className="ap-text-2 mt-1">
                        {
                          comparedInvestigations[1].crossInvestigationLink
                            .explanation
                        }
                      </p>
                    </td>
                  </tr>
                  <tr className="ap-table-row">
                    <td className="ap-table-stripe ap-text-1 py-3 pr-4 font-semibold">
                      Earth Spin-off &amp; Impact
                    </td>
                    <td className="ap-divider ap-text-2 py-3 px-4 border-l">
                      {comparedInvestigations[0].earthSpinoff}
                    </td>
                    <td className="ap-divider ap-text-2 py-3 pl-4 border-l">
                      {comparedInvestigations[1].earthSpinoff}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="ap-divider border-t pt-10 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <span className="ap-eyebrow block">Empirical Validation</span>
              <h2 className="ap-h2">
                Closest NASA Flight Test Runs
              </h2>
              <p className="ap-body-sm ap-text-3">
                Top 5 nearest telemetry matches out of{" "}
                {filteredEmpiricalRuns.length} runs (click provenance tags for parser audit)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEmpiricalCampaignFilter("All")}
                className={`px-3 py-1 text-[12px] font-medium ${
                  empiricalCampaignFilter === "All"
                    ? "ap-pill-active"
                    : "ap-pill"
                }`}
              >
                All Campaigns ({parsedRuns.length})
              </button>
              {EMPIRICAL_CAMPAIGN_IDS.map((cid) => (
                <button
                  key={cid}
                  type="button"
                  onClick={() => setEmpiricalCampaignFilter(cid)}
                  className={`px-3 py-1 text-[12px] font-medium ${
                    empiricalCampaignFilter === cid
                      ? "ap-pill-active"
                      : "ap-pill"
                  }`}
                >
                  {cid} ({campaignCounts.get(cid) ?? 0})
                </button>
              ))}
            </div>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Closest NASA Flight Test Runs Table"
            className="ap-table-wrap"
          >
            <table className="w-full text-[12px] text-left">
              <thead>
                <tr className="ap-table-head ap-table-row text-[11px] font-semibold">
                  <th className="py-2.5 pr-3">Match</th>
                  <th className="py-2.5 px-3">Campaign / Run ID</th>
                  <th className="py-2.5 px-3">Fuel Material</th>
                  <th className="py-2.5 px-3">
                    Parsed Material / Geometry / Thickness
                  </th>
                  <th className="py-2.5 px-3">O2 % / Pressure</th>
                  <th className="py-2.5 px-3">Airflow Steps</th>
                  <th className="py-2.5 px-3">Spread / Temp</th>
                  <th className="py-2.5 px-3">Extinction / Status</th>
                  <th className="py-2.5 pl-3 text-right">CO / CO2 / Smoke</th>
                </tr>
              </thead>
              <tbody>
                {closestRuns.map((item, idx) => {
                  const cid = getRunCampaignId(item.run);
                  const fp = item.run.fieldProvenance;
                  return (
                    <tr
                      key={`${item.run.experimentId}-${item.run.testNumber}-${idx}`}
                      className="ap-table-row ap-motion-ease align-top"
                    >
                      <td className="ap-text-1 py-3 pr-3 font-mono font-semibold tabular-nums min-w-[78px]">
                        <div>{item.matchScore}</div>
                        <div className="ap-meter-track mt-1.5">
                          <div
                            className="ap-meter-fill ap-matcher-bar bg-[var(--ap-accent)]"
                            data-target-pct={`${Math.max(18, Math.min(98, Math.round(100 / (1 + item.matchScore * 0.08))))}`}
                            style={{
                              width: `${Math.max(18, Math.min(98, Math.round(100 / (1 + item.matchScore * 0.08))))}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="ap-prov-measured block">
                          {cid}
                        </span>
                        <div className="ap-text-1 font-mono font-semibold mt-0.5">
                          {item.run.experimentId} · {item.run.testNumber}
                        </div>
                        <span className={RUN_QUALITY_BADGE_CLASSES[item.run.runDataQuality]}>
                          {item.run.runDataQuality}
                        </span>
                      </td>
                      <td className="ap-text-2 py-3 px-3">{item.run.rawFuelMaterial}</td>
                      <td className="ap-text-2 py-3 px-3">
                        <div>
                          <strong className="ap-text-1">Mat:</strong> {item.run.baseMaterial}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>
                            <strong className="ap-text-1">Geo:</strong> {item.run.geometryType}
                          </span>
                          <MetricAnnotationPopover provenance={fp.geometry} field="geometry">
                            <span className={`${FIELD_PROVENANCE_BADGE_CLASSES[fp.geometry]} underline`}>
                              {fp.geometry} ?
                            </span>
                          </MetricAnnotationPopover>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 font-mono text-[11px] tabular-nums">
                          <span>
                            <strong className="ap-text-1 font-sans text-[12px]">Thk:</strong>{" "}
                            {item.run.thicknessMm !== null
                              ? `${item.run.thicknessMm.toFixed(2)} mm`
                              : "N/A"}
                          </span>
                          <MetricAnnotationPopover provenance={fp.thickness} field="thickness">
                            <span className={`${FIELD_PROVENANCE_BADGE_CLASSES[fp.thickness]} font-sans underline`}>
                              {fp.thickness} ?
                            </span>
                          </MetricAnnotationPopover>
                        </div>
                      </td>
                      <td className="ap-text-2 py-3 px-3 font-mono text-[11px] tabular-nums">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>O2: {item.initialO2Pct ?? "—"}%</span>
                          <MetricAnnotationPopover provenance={fp.o2} field="o2">
                            <span className={`${FIELD_PROVENANCE_BADGE_CLASSES[fp.o2]} font-sans underline`}>
                              {fp.o2} ?
                            </span>
                          </MetricAnnotationPopover>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>P: {item.run.pressurePsi ?? "—"} psi</span>
                          <MetricAnnotationPopover provenance={fp.pressure} field="pressure">
                            <span className={`${FIELD_PROVENANCE_BADGE_CLASSES[fp.pressure]} font-sans underline`}>
                              {fp.pressure === "DEFAULTED"
                                ? "DEFAULTED 14.7 PSI"
                                : fp.pressure}{" "}
                              ?
                            </span>
                          </MetricAnnotationPopover>
                        </div>
                      </td>
                      <td className="ap-text-2 py-3 px-3 font-mono text-[11px] tabular-nums">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{item.airDisplay || "—"}</span>
                          <MetricAnnotationPopover provenance={fp.airflow} field="airflow">
                            <span className={`${FIELD_PROVENANCE_BADGE_CLASSES[fp.airflow]} font-sans underline`}>
                              {fp.airflow} ?
                            </span>
                          </MetricAnnotationPopover>
                        </div>
                        <div className="ap-text-3 text-[10px]">
                          Steps: [{item.run.airflowSteps.join(" → ")}]
                        </div>
                      </td>
                      <td className="ap-text-2 py-3 px-3 font-mono text-[11px] tabular-nums">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>
                            Spread: {item.run.flameSpreadMmS ?? "—"} mm/s
                          </span>
                          <MetricAnnotationPopover provenance={fp.spreadRate} field="spreadRate">
                            <span className={`${FIELD_PROVENANCE_BADGE_CLASSES[fp.spreadRate]} font-sans underline`}>
                              {fp.spreadRate} ?
                            </span>
                          </MetricAnnotationPopover>
                        </div>
                        <div>
                          Temp: {item.run.flameTemperatureK ?? "—"} K
                        </div>
                      </td>
                      <td className="ap-text-2 py-3 px-3">
                        <div className="ap-text-1 font-semibold">
                          {item.run.extinctionStatus ||
                            item.run.extinctionMechanism}
                        </div>
                        <div className="ap-text-3 font-mono text-[10px] mt-0.5 tabular-nums">
                          {item.run.ignitionStatus || "—"} ·{" "}
                          {item.run.burnDurationS !== null
                            ? `${item.run.burnDurationS}s`
                            : "—"}
                        </div>
                      </td>
                      <td className="ap-text-2 py-3 pl-3 text-right font-mono text-[11px] tabular-nums">
                        <div className="ap-text-1 font-semibold">
                          CO: {item.finalCOPpm ?? "—"} ppm
                        </div>
                        <div>
                          CO2: {item.run.finalCO2Pct ?? "—"}% · Smoke:{" "}
                          {item.run.smokeParticleConc ?? "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {pinnedHud && (
        <aside
          aria-label="Pinned Floating Telemetry HUD"
          className="fixed bottom-3 inset-x-0 z-[200] pointer-events-none"
        >
          <div className="ap-container">
            <div className="pointer-events-auto ap-popover px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] tabular-nums">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="ap-text-1 font-bold">{simResult.regime}</span>
                <span className="ap-text-2">
                  LOI <strong className="ap-text-1">{simResult.limitingO2Pct.toFixed(2)}%</strong>
                </span>
                <span className="ap-text-2">
                  Margin{" "}
                  <strong className="ap-text-1">
                    {simResult.oxygenMarginPct >= 0 ? "+" : ""}
                    {simResult.oxygenMarginPct.toFixed(2)}%
                  </strong>
                </span>
                <span className="ap-text-2">
                  V_f <strong className="ap-text-1">{simResult.flameSpreadRateMmS.toFixed(2)} mm/s</strong>
                </span>
                <span className="ap-text-2">
                  v_eff <strong className="ap-text-1">{simResult.effectiveVelocityCmS.toFixed(2)} cm/s</strong>
                </span>
                <span className="ap-text-2">
                  g_eq <strong className="ap-text-1">{simResult.equivalentGravityG.toFixed(4)}g</strong>
                </span>
                <span className="ap-text-2">
                  Biot <strong className="ap-text-1">{getBiotCurvatureTag(simResult.geometryType)}</strong> ({simResult.effectiveThicknessMm.toFixed(2)} mm)
                </span>
                <span className="ap-text-2">
                  Temp <strong className="ap-text-1">{simResult.adiabaticFlameTempK} K</strong>
                </span>
                <span className="ap-text-2">
                  Laser <strong className="ap-text-1">{laserBeam.alarmState}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPinnedHud(false)}
                className="ap-pill px-2.5 py-1 text-[11px] font-semibold"
              >
                Unpin HUD
              </button>
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}
