"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  type SimulatorMaterial,
  type SimulationParams,
  type CombustionSimulationResult,
  type FlameRenderGeometry,
  type FlammabilityEnvelopeData,
  type AdvancedFlameField,
  type FlammabilityPhaseMatrix,
  type NormalizedRun,
  type EmpiricalRunMatch,
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

// constant provenance badge style lookup dictionary instead of an if/else ladder.
const PROVENANCE_BADGE_CLASSES: Record<DataProvenanceTier, string> = {
  EMPIRICAL_CSV_LOADED: "border-emerald-500 bg-emerald-100 text-emerald-900",
  PHYSICS_AND_METADATA_MODEL: "border-cyan-500 bg-cyan-100 text-cyan-900",
  FUTURE_LUNAR_FLIGHT: "border-amber-500 bg-amber-100 text-amber-900",
};

const getProvenanceBadgeClasses = (tier: DataProvenanceTier): string =>
  PROVENANCE_BADGE_CLASSES[tier];

// main 7-section APULA workstation connecting habitat sliders to the 60fps physics solver, 3D flame chamber, and 654 NASA PSI records.
export default function ApulaWireframePage() {

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

  function updateParam<K extends keyof SimulationParams>(
    key: K,
    value: SimulationParams[K],
  ) {
    setParams((prev) => ({ ...prev, [key]: value }));
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
    <main className="min-h-screen bg-slate-100 text-slate-900 p-4 md:p-6 font-sans">

      <header className="max-w-7xl mx-auto mb-4 border-2 border-slate-400 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500">
              APULA • Atmospheric Prediction &amp; Unified Low-gravity Analysis • NASA Space Apps (Project SIKLAB / ALAB)
            </p>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              Spacecraft Fire Safety &amp; Partial-Gravity Combustion Wireframe (7-Section Architecture)
            </h1>
          </div>
          <div className="text-right font-mono text-xs bg-slate-200 border border-slate-400 px-3 py-1.5">
            <div>ACTIVE REGIME: {simResult.regime}</div>
            <div>
              EMPIRICAL TELEMETRY: {parsedRuns.length} Rows /{" "}
              {campaignCounts.size} Campaigns
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-6">

        <section className="border-2 border-slate-400 bg-slate-50 p-4">
          <div className="border-b border-slate-300 pb-2 mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-800">
              [SECTION 0] Executive Mission Banner — &ldquo;How This SI System Works&rdquo;
            </h2>
            <span className="text-xs font-mono text-slate-500">
              3 Fire Safety Pillars • Analytical vs. Empirical Provenance • Instant Boot Masterfile
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            <div className="border border-slate-300 bg-white p-3.5 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs font-bold uppercase text-slate-800 border-b border-slate-200 pb-1.5 mb-2">
                  Card 1: Why NASA PSI Data Matters
                </div>
                <ul className="text-xs space-y-2 text-slate-700">
                  <li>
                    <strong className="font-mono text-slate-900">
                      1. Prevention (BASS / SAFFIRE-3):
                    </strong>{" "}
                    Screens spacecraft polymers &amp; textiles in 0g flow ducts
                    and full-scale Cygnus hulls so habitat cabins avoid
                    easily-ignited materials.
                  </li>
                  <li>
                    <strong className="font-mono text-slate-900">
                      2. Detection (SAME / DAFT):
                    </strong>{" "}
                    Sizes sub-micron wire smoke vs. 1–20 µm cabin/lunar dust to
                    stop false alarms—like the Artemis II smoke alarm triggered
                    80,000 miles from Earth.
                  </li>
                  <li>
                    <strong className="font-mono text-slate-900">
                      3. Suppression (FLEX / FLEX-2):
                    </strong>{" "}
                    Quantifies CO2, Helium, and fine-water-mist fire
                    extinguishment in microgravity, solving legacy fire hazards
                    from Apollo 1 and Mir.
                  </li>
                </ul>
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-3.5 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs font-bold uppercase text-slate-800 border-b border-slate-200 pb-1.5 mb-2">
                  Card 2: Theory vs. Empirical Proof
                </div>
                <p className="text-xs text-slate-700 leading-relaxed mb-2">
                  No full-scale Lunar (<strong>0.16g</strong>) or Martian (
                  <strong>0.38g</strong>) combustion telemetry exists in NASA
                  PSI yet. Our <strong>Analytical Physics Engine</strong>{" "}
                  simulates live flame geometry, cool-flame regimes, and
                  electric-field ion wind, bounding missing partial-gravity
                  habitats strictly between proven{" "}
                  <strong>0g</strong> (BASS-II / SAFFIRE-3) and{" "}
                  <strong>1g</strong> Earth baselines.
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Meanwhile, our pre-loaded <strong>8-Investigation PSI Masterfile</strong>{" "}
                  anchors predictions against real ISS &amp; Cygnus flight test
                  measurements in real time.
                </p>
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-3.5 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs font-bold uppercase text-slate-800 border-b border-slate-200 pb-1.5 mb-2">
                  Card 3: Live Dataset Status Badge
                </div>
                <div className="border border-emerald-500 bg-emerald-100 text-emerald-900 px-2.5 py-2 font-mono text-xs font-bold mb-2">
                  PRE-LOADED MASTERFILE ACTIVE: {parsedRuns.length} Flight Test
                  Rows across {campaignCounts.size} PSI Campaigns
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {EMPIRICAL_CAMPAIGN_IDS.map((cid) => (
                    <span
                      key={cid}
                      className="border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      {cid}: {campaignCounts.get(cid) ?? 0}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 flex flex-wrap items-center justify-between gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-slate-400 bg-slate-100 hover:bg-slate-200 px-2 py-1 font-mono text-[11px]"
                  >
                    Optional: Import Additional CSV
                  </button>
                  <select
                    aria-label="CSV Import Mode"
                    value={csvLoadMode}
                    onChange={(e) =>
                      setCsvLoadMode(e.target.value as "append" | "replace")
                    }
                    className="border border-slate-300 bg-white px-1.5 py-1 font-mono text-[11px]"
                  >
                    <option value="append">Append</option>
                    <option value="replace">Replace</option>
                  </select>
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
                  className="font-mono text-[11px] underline text-slate-600 hover:text-slate-900"
                >
                  Reset Masterfile
                </button>
              </div>
              <div className="font-mono text-[10px] text-slate-500 mt-1">
                Active Source: {csvSourceLabel}
                {csvError && (
                  <span className="ml-1 text-red-700 font-bold">
                    • ERROR: {csvError}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-2 border-slate-300 bg-slate-50 p-4">
          <div className="border-b border-slate-300 pb-2 mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-800">
              [SECTION 1] Habitat Presets &amp; 7 Physics Sliders
            </h2>
            <span className="text-xs font-mono text-slate-500">
              Input Contract: SimulationParams
            </span>
          </div>

          <div className="mb-4">
            <p className="text-xs font-mono uppercase text-slate-600 mb-2">
              1A. Quick Habitat &amp; Experiment Presets:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {HABITAT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setParams((prev) => ({ ...prev, ...preset.params }))
                  }
                  className="border border-slate-400 bg-white hover:bg-slate-200 active:bg-slate-300 px-2.5 py-2 text-left transition-colors"
                >
                  <div className="font-mono text-xs font-bold text-slate-900">
                    {preset.label}
                  </div>
                  <div className="font-mono text-[11px] text-slate-600">
                    {preset.subtitle}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

            <div className="border border-slate-300 bg-white p-2.5">
              <div className="flex justify-between text-xs font-mono mb-1">
                <label htmlFor="ctrl-o2" className="font-bold">
                  1. o2Pct (% vol)
                </label>
                <span>[10 – 100%]</span>
              </div>
              <div className="flex items-center gap-2">
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
                  className="w-full accent-slate-800"
                />
                <input
                  type="number"
                  min={10}
                  max={100}
                  step={0.5}
                  value={params.o2Pct}
                  onChange={(e) =>
                    updateParam("o2Pct", Number.parseFloat(e.target.value) || 10)
                  }
                  className="w-20 border border-slate-400 px-1.5 py-0.5 font-mono text-xs text-right"
                />
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-2.5">
              <div className="flex justify-between text-xs font-mono mb-1">
                <label htmlFor="ctrl-pressure" className="font-bold">
                  2. pressurePsi (psi)
                </label>
                <span>[4.0 – 15.0]</span>
              </div>
              <div className="flex items-center gap-2">
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
                  className="w-full accent-slate-800"
                />
                <input
                  type="number"
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
                  className="w-20 border border-slate-400 px-1.5 py-0.5 font-mono text-xs text-right"
                />
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-2.5">
              <div className="flex justify-between text-xs font-mono mb-1">
                <label htmlFor="ctrl-airflow" className="font-bold">
                  3. airflowCmS (cm/s)
                </label>
                <span>[0 – 60 cm/s]</span>
              </div>
              <div className="flex items-center gap-2">
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
                  className="w-full accent-slate-800"
                />
                <input
                  type="number"
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
                  className="w-20 border border-slate-400 px-1.5 py-0.5 font-mono text-xs text-right"
                />
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-2.5">
              <div className="flex justify-between text-xs font-mono mb-1">
                <label htmlFor="ctrl-gravity" className="font-bold">
                  4. gravityG (g)
                </label>
                <span>[0.00 – 1.00g]</span>
              </div>
              <div className="flex items-center gap-2">
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
                  className="w-full accent-slate-800"
                />
                <input
                  type="number"
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
                  className="w-20 border border-slate-400 px-1.5 py-0.5 font-mono text-xs text-right"
                />
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-2.5">
              <div className="flex justify-between text-xs font-mono mb-1">
                <label htmlFor="ctrl-efield" className="font-bold">
                  5. electricFieldVoltsCm
                </label>
                <span>[0 – 3000 V/cm]</span>
              </div>
              <div className="flex items-center gap-2">
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
                  className="w-full accent-slate-800"
                />
                <input
                  type="number"
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
                  className="w-20 border border-slate-400 px-1.5 py-0.5 font-mono text-xs text-right"
                />
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-2.5">
              <div className="flex justify-between text-xs font-mono mb-1">
                <label htmlFor="ctrl-co2" className="font-bold">
                  6. co2DilutionPct (%)
                </label>
                <span>[0 – 20%]</span>
              </div>
              <div className="flex items-center gap-2">
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
                  className="w-full accent-slate-800"
                />
                <input
                  type="number"
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
                  className="w-20 border border-slate-400 px-1.5 py-0.5 font-mono text-xs text-right"
                />
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-2.5 lg:col-span-2">
              <div className="flex justify-between text-xs font-mono mb-1">
                <label htmlFor="ctrl-material" className="font-bold">
                  7. material (SimulatorMaterial)
                </label>
                <span>Fuel Chemistry &amp; Thickness</span>
              </div>
              <select
                id="ctrl-material"
                value={params.material}
                onChange={(e) =>
                  updateParam("material", e.target.value as SimulatorMaterial)
                }
                className="w-full border border-slate-400 bg-slate-50 px-2 py-1 font-mono text-xs"
              >
                {SIMULATOR_MATERIALS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="border-2 border-slate-300 bg-slate-50 p-4">
          <div className="border-b border-slate-300 pb-2 mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-800">
              [SECTION 2] Live Physics Readout &amp; SVG Flame Plume / Inside-Out Burner Wireframe
            </h2>
            <span className="text-xs font-mono text-slate-500">
              Outputs: simulateCombustionPhysics() + generateFlameRenderGeometry()
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            <div className="border border-slate-300 bg-white p-3">
              <h3 className="font-mono text-xs font-bold uppercase border-b border-slate-300 pb-1.5 mb-2">
                2A. CombustionSimulationResult
              </h3>
              <table className="w-full font-mono text-xs">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-1 text-slate-600">regime</td>
                    <td className="py-1 text-right font-bold">
                      {simResult.regime}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">limitingO2Pct (LOI)</td>
                    <td className="py-1 text-right font-bold">
                      {simResult.limitingO2Pct.toFixed(2)} %
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">oxygenMarginPct</td>
                    <td className="py-1 text-right font-bold">
                      {simResult.oxygenMarginPct >= 0 ? "+" : ""}
                      {simResult.oxygenMarginPct.toFixed(2)} %
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">buoyantVelocityCmS</td>
                    <td className="py-1 text-right">
                      {simResult.buoyantVelocityCmS.toFixed(2)} cm/s
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">ionWindVelocityCmS</td>
                    <td className="py-1 text-right">
                      {simResult.ionWindVelocityCmS.toFixed(2)} cm/s
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">
                      effectiveVelocityCmS
                    </td>
                    <td className="py-1 text-right font-bold">
                      {simResult.effectiveVelocityCmS.toFixed(2)} cm/s
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">equivalentGravityG</td>
                    <td className="py-1 text-right">
                      {simResult.equivalentGravityG.toFixed(4)} g
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">flameSpreadRateMmS</td>
                    <td className="py-1 text-right font-bold">
                      {simResult.flameSpreadRateMmS.toFixed(2)} mm/s
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">adiabaticFlameTempK</td>
                    <td className="py-1 text-right font-bold">
                      {simResult.adiabaticFlameTempK} K
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">estimatedCO_ppm</td>
                    <td className="py-1 text-right font-bold">
                      {simResult.estimatedCO_ppm} ppm
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">estimatedCO2_pct</td>
                    <td className="py-1 text-right">
                      {simResult.estimatedCO2_pct.toFixed(2)} %
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-600">smokeSootIndex</td>
                    <td className="py-1 text-right font-bold">
                      {simResult.smokeSootIndex} / 100
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border border-slate-300 bg-white p-3">
              <h3 className="font-mono text-xs font-bold uppercase border-b border-slate-300 pb-1.5 mb-2">
                2B. FlameRenderGeometry (8 props)
              </h3>
              <table className="w-full font-mono text-xs">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-1.5 text-slate-600">flameLengthMm</td>
                    <td className="py-1.5 text-right font-bold">
                      {flameGeo.flameLengthMm.toFixed(1)} mm
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">flameWidthMm</td>
                    <td className="py-1.5 text-right font-bold">
                      {flameGeo.flameWidthMm.toFixed(1)} mm
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">aspectRatio (L/W)</td>
                    <td className="py-1.5 text-right font-bold">
                      {flameGeo.aspectRatio.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">isInsideOutBurner</td>
                    <td className="py-1.5 text-right font-bold">
                      {String(flameGeo.isInsideOutBurner)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">coreColorHex</td>
                    <td className="py-1.5 text-right font-bold flex items-center justify-end gap-1.5">
                      <span
                        className="inline-block w-3.5 h-3.5 border border-slate-400"
                        style={{ backgroundColor: flameGeo.coreColorHex }}
                      />
                      {flameGeo.coreColorHex}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">outerGlowColorHex</td>
                    <td className="py-1.5 text-right font-bold flex items-center justify-end gap-1.5">
                      <span
                        className="inline-block w-3.5 h-3.5 border border-slate-400"
                        style={{ backgroundColor: flameGeo.outerGlowColorHex }}
                      />
                      {flameGeo.outerGlowColorHex}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">sootTailOpacity</td>
                    <td className="py-1.5 text-right">
                      {flameGeo.sootTailOpacity.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-600">
                      flickerFrequencyHz
                    </td>
                    <td className="py-1.5 text-right">
                      {flameGeo.flickerFrequencyHz.toFixed(1)} Hz
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border border-slate-300 bg-white p-3 lg:col-span-3">
              <div className="w-full flex flex-wrap justify-between items-center border-b border-slate-300 pb-1.5 mb-2 gap-2">
                <h3 className="font-mono text-xs font-bold uppercase">
                  2C. Interactive 3D Three.js Microgravity Wind-Tunnel &amp; Flame Morphology Chamber
                </h3>
                <span className="font-mono text-[11px] text-slate-500">
                  ThreeFlameChamber • 60 FPS WebGL Additive Blending + 180 GPU Streamline/Soot Particles
                </span>
              </div>

              <ThreeFlameChamber
                simResult={simResult}
                flameGeometry={flameGeo}
                advancedField={advancedFlameField}
              />
            </div>
          </div>
        </section>

        <section className="border-2 border-slate-300 bg-slate-50 p-4">
          <div className="border-b border-slate-300 pb-2 mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-800">
              [SECTION 3] Phase-Space Flammability Matrices — Partial-Gravity Bounding Envelope &amp; Microgravity Ventilation U-Curve
            </h2>
            <span className="text-xs font-mono text-slate-500">
              Outputs: generateFlammabilityEnvelopeData(params) + generateFlammabilityPhaseMatrix(params, runs)
            </span>
          </div>

          <div className="border border-amber-400 bg-amber-50 px-3 py-2 mb-4 font-mono text-xs text-amber-900">
            <strong>PARTIAL-GRAVITY BOUNDING NOTE:</strong> Because Lunar (0.16g) and
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

        <section className="border-2 border-slate-300 bg-slate-50 p-4">
          <div className="border-b border-slate-300 pb-3 mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-800">
                [SECTION 4] Dynamic PSI Investigation Ranker with Data Provenance Badges
              </h2>
              <p className="text-xs font-mono text-slate-500">
                Showing {rankedInvestigations.length} of{" "}
                {PSI_INVESTIGATIONS.length} studies • Selected for Section 5
                Diff: {selectedIds.join(" vs. ") || "None"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="font-mono text-[11px] uppercase text-slate-600 mr-1">
                  Pillar:
                </span>
                {["All", "Prevention", "Detection", "Suppression"].map(
                  (pillar) => (
                    <button
                      key={pillar}
                      type="button"
                      onClick={() => setPillarFilter(pillar)}
                      className={`border px-2 py-1 font-mono text-xs ${
                        pillarFilter === pillar
                          ? "border-slate-900 bg-slate-900 text-white font-bold"
                          : "border-slate-400 bg-white text-slate-800 hover:bg-slate-200"
                      }`}
                    >
                      {pillar}
                    </button>
                  ),
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <span className="font-mono text-[11px] uppercase text-slate-600 mr-1">
                  Provenance:
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
                    className={`border px-2 py-1 font-mono text-xs ${
                      provenanceFilter === item.value
                        ? "border-slate-900 bg-slate-900 text-white font-bold"
                        : "border-slate-400 bg-white text-slate-800 hover:bg-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rankedInvestigations.map((inv) => {
              const isChecked = selectedIds.includes(inv.id);
              const badgeClasses = getProvenanceBadgeClasses(
                inv.provenanceTier,
              );
              return (
                <div
                  key={inv.id}
                  className={`border p-3 bg-white flex flex-col justify-between ${
                    isChecked
                      ? "border-slate-900 ring-1 ring-slate-900 bg-slate-50"
                      : "border-slate-300"
                  }`}
                >
                  <div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span
                        className={`border px-2 py-0.5 font-mono text-[11px] font-bold ${badgeClasses}`}
                      >
                        {inv.provenanceBadgeText}
                        {inv.provenanceTier === "EMPIRICAL_CSV_LOADED" &&
                          ` • ${inv.loadedRowCount} CSV Rows`}
                      </span>
                      <span className="font-mono text-xs font-bold border border-slate-400 bg-slate-100 px-2 py-0.5">
                        Match Score: {inv.score}/100
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-mono text-sm font-bold text-slate-900">
                          {inv.id} — {inv.title}
                        </h3>
                        <p className="font-mono text-[11px] text-slate-600">
                          Pillar: <strong>{inv.pillar}</strong> | Rack:{" "}
                          <strong>{inv.hardwareRack}</strong> | Phase:{" "}
                          <strong>{inv.fuelPhase}</strong>
                        </p>
                      </div>
                      <label className="flex items-center gap-1.5 font-mono text-[11px] border border-slate-300 bg-slate-50 px-2 py-1 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleInvestigationCheckbox(inv.id)}
                          aria-label={`Select ${inv.id} for Section 5 comparison`}
                          className="h-3.5 w-3.5 accent-slate-900"
                        />
                        Compare
                      </label>
                    </div>

                    <div className="border-l-2 border-slate-400 pl-2.5 py-0.5 mb-2 text-xs text-slate-800">
                      <strong className="font-mono text-[11px] uppercase text-slate-600">
                        Purpose in Space Safety:{" "}
                      </strong>
                      {inv.purposeInSpaceSafety}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-2 mt-1 font-mono text-[11px] text-slate-600 space-y-1">
                    <div>
                      <strong>Envelope:</strong> O2 {inv.o2RangePct[0]}–
                      {inv.o2RangePct[1]}% | P {inv.pressureRangePsi[0]}–
                      {inv.pressureRangePsi[1]} psi | Flow{" "}
                      {inv.airflowRangeCmS[0]}–{inv.airflowRangeCmS[1]} cm/s
                    </div>
                    <div className="text-slate-700">
                      <strong>Why Relevant:</strong>{" "}
                      {inv.whyRelevantForHabitat}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-2 border-slate-300 bg-slate-50 p-4">
          <div className="border-b border-slate-300 pb-2 mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-800">
              [SECTION 5] Intra- vs. Inter-Investigation Comparison Matrix
            </h2>
            <span className="text-xs font-mono text-slate-500">
              Compares Hardware Rack, Fixed Constants (intraFixedVars), Swept Variables (intraSweptVars), Cross-Links &amp; Earth Spin-offs
            </span>
          </div>

          {comparedInvestigations.length < 2 ? (
            <div className="border border-slate-300 bg-white p-4 font-mono text-xs text-slate-600">
              Please select 2 investigations in [SECTION 4] above to populate
              the side-by-side comparison matrix.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-300 bg-white">
              <table className="w-full font-mono text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-200">
                    <th className="p-2.5 w-48">Comparison Dimension</th>
                    <th className="p-2.5 border-l border-slate-300 w-1/2">
                      [A] {comparedInvestigations[0].id} —{" "}
                      {comparedInvestigations[0].title}
                    </th>
                    <th className="p-2.5 border-l border-slate-300 w-1/2">
                      [B] {comparedInvestigations[1].id} —{" "}
                      {comparedInvestigations[1].title}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 align-top">
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50">
                      Data Provenance Tier &amp; Safety Purpose
                    </td>
                    <td className="p-2.5 border-l border-slate-300 space-y-1.5">
                      <span
                        className={`inline-block border px-2 py-0.5 text-[11px] font-bold ${getProvenanceBadgeClasses(
                          comparedInvestigations[0].provenanceTier,
                        )}`}
                      >
                        {comparedInvestigations[0].provenanceBadgeText}
                      </span>
                      <p className="font-sans text-slate-700">
                        {comparedInvestigations[0].purposeInSpaceSafety}
                      </p>
                    </td>
                    <td className="p-2.5 border-l border-slate-300 space-y-1.5">
                      <span
                        className={`inline-block border px-2 py-0.5 text-[11px] font-bold ${getProvenanceBadgeClasses(
                          comparedInvestigations[1].provenanceTier,
                        )}`}
                      >
                        {comparedInvestigations[1].provenanceBadgeText}
                      </span>
                      <p className="font-sans text-slate-700">
                        {comparedInvestigations[1].purposeInSpaceSafety}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50">
                      Pillar &amp; Gravity Regime
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <div>
                        <strong>Pillar:</strong>{" "}
                        {comparedInvestigations[0].pillar}
                      </div>
                      <div>
                        <strong>Regime:</strong>{" "}
                        {comparedInvestigations[0].gravityRegime}
                      </div>
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <div>
                        <strong>Pillar:</strong>{" "}
                        {comparedInvestigations[1].pillar}
                      </div>
                      <div>
                        <strong>Regime:</strong>{" "}
                        {comparedInvestigations[1].gravityRegime}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50">
                      Hardware Rack (MSG, CIR, MDCA, Cygnus)
                    </td>
                    <td className="p-2.5 border-l border-slate-300 font-bold">
                      {comparedInvestigations[0].hardwareRack}
                    </td>
                    <td className="p-2.5 border-l border-slate-300 font-bold">
                      {comparedInvestigations[1].hardwareRack}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50">
                      Fuel Phase &amp; Samples
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <div className="font-bold">
                        Phase: {comparedInvestigations[0].fuelPhase}
                      </div>
                      <div className="text-slate-700 mt-1">
                        {comparedInvestigations[0].fuelSamples}
                      </div>
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <div className="font-bold">
                        Phase: {comparedInvestigations[1].fuelPhase}
                      </div>
                      <div className="text-slate-700 mt-1">
                        {comparedInvestigations[1].fuelSamples}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50">
                      Fixed Constants (intraFixedVars)
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[0].intraFixedVars.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[1].intraFixedVars.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50">
                      Swept Variables (intraSweptVars)
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[0].intraSweptVars.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[1].intraSweptVars.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50">
                      Diagnostic Sensors
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[0].sensors.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <ul className="list-disc pl-4 space-y-1">
                        {comparedInvestigations[1].sensors.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50">
                      Cross-Investigation Link (Inter-Study Bridge)
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <div className="font-bold">
                        Linked Study:{" "}
                        {
                          comparedInvestigations[0].crossInvestigationLink
                            .relatedId
                        }
                      </div>
                      <p className="mt-1 text-slate-700">
                        {
                          comparedInvestigations[0].crossInvestigationLink
                            .explanation
                        }
                      </p>
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      <div className="font-bold">
                        Linked Study:{" "}
                        {
                          comparedInvestigations[1].crossInvestigationLink
                            .relatedId
                        }
                      </div>
                      <p className="mt-1 text-slate-700">
                        {
                          comparedInvestigations[1].crossInvestigationLink
                            .explanation
                        }
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold bg-slate-50">
                      Earth Spin-off &amp; Terrestrial Impact
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      {comparedInvestigations[0].earthSpinoff}
                    </td>
                    <td className="p-2.5 border-l border-slate-300">
                      {comparedInvestigations[1].earthSpinoff}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border-2 border-slate-300 bg-slate-50 p-4">
          <div className="border-b border-slate-300 pb-3 mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-800">
                [SECTION 6] Empirical NASA Flight Test Matcher (findClosestEmpiricalRuns)
              </h2>
              <p className="text-xs font-mono text-slate-500">
                Inspecting top 5 nearest telemetry rows out of{" "}
                {filteredEmpiricalRuns.length} matching runs
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setEmpiricalCampaignFilter("All")}
                className={`border px-2 py-1 font-mono text-xs ${
                  empiricalCampaignFilter === "All"
                    ? "border-slate-900 bg-slate-900 text-white font-bold"
                    : "border-slate-400 bg-white text-slate-800 hover:bg-slate-200"
                }`}
              >
                All Campaigns ({parsedRuns.length})
              </button>
              {EMPIRICAL_CAMPAIGN_IDS.map((cid) => (
                <button
                  key={cid}
                  type="button"
                  onClick={() => setEmpiricalCampaignFilter(cid)}
                  className={`border px-2 py-1 font-mono text-xs ${
                    empiricalCampaignFilter === cid
                      ? "border-slate-900 bg-slate-900 text-white font-bold"
                      : "border-slate-400 bg-white text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  {cid} ({campaignCounts.get(cid) ?? 0})
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-300 bg-white">
            <table className="w-full font-mono text-xs text-left">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-200 text-slate-800">
                  <th className="p-2">matchScore</th>
                  <th className="p-2">Campaign / Run ID</th>
                  <th className="p-2">rawFuelMaterial</th>
                  <th className="p-2">
                    Parsed baseMaterial / geometryType / thicknessMm
                  </th>
                  <th className="p-2">O2 % / Pressure</th>
                  <th className="p-2">Airflow Steps (cm/s)</th>
                  <th className="p-2">Flame Spread / Temp</th>
                  <th className="p-2">Extinction / Telemetry Status</th>
                  <th className="p-2 text-right">CO / CO2 / Smoke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {closestRuns.map((item, idx) => {
                  const cid = getRunCampaignId(item.run);
                  return (
                    <tr
                      key={`${item.run.experimentId}-${item.run.testNumber}-${idx}`}
                      className="hover:bg-slate-100"
                    >
                      <td className="p-2 font-bold">{item.matchScore}</td>
                      <td className="p-2">
                        <span className="inline-block border border-emerald-500 bg-emerald-100 text-emerald-900 px-1.5 py-0.5 text-[10px] font-bold mb-0.5">
                          {cid}
                        </span>
                        <div className="font-bold">
                          {item.run.experimentId}
                        </div>
                      </td>
                      <td className="p-2">{item.run.rawFuelMaterial}</td>
                      <td className="p-2">
                        <div>
                          <strong>Mat:</strong> {item.run.baseMaterial}
                        </div>
                        <div>
                          <strong>Geo:</strong> {item.run.geometryType} |{" "}
                          <strong>Thk:</strong>{" "}
                          {item.run.thicknessMm !== null
                            ? `${item.run.thicknessMm.toFixed(2)} mm`
                            : "N/A"}
                        </div>
                      </td>
                      <td className="p-2">
                        <div>O2: {item.initialO2Pct ?? "—"}%</div>
                        <div>P: {item.run.pressurePsi ?? "—"} psi</div>
                      </td>
                      <td className="p-2">
                        <div>{item.airDisplay}</div>
                        <div className="text-[10px] text-slate-500">
                          Steps: [{item.run.airflowSteps.join(" → ")}]
                        </div>
                      </td>
                      <td className="p-2">
                        <div>
                          Spread: {item.run.flameSpreadMmS ?? "—"} mm/s
                        </div>
                        <div>
                          Temp: {item.run.flameTemperatureK ?? "—"} K
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="font-semibold">
                          {item.run.extinctionStatus ||
                            item.run.extinctionMechanism}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.run.ignitionStatus || "—"} •{" "}
                          {item.run.burnDurationS !== null
                            ? `${item.run.burnDurationS}s`
                            : "—"}
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        <div className="font-bold">
                          CO: {item.finalCOPpm ?? "—"} ppm
                        </div>
                        <div>
                          CO2: {item.run.finalCO2Pct ?? "—"}% | Smoke:{" "}
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
    </main>
  );
}
