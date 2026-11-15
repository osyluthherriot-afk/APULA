import {
  GEOMETRY_THERMAL_SCALE,
  MATERIAL_PHYSICS,
  type CombustionSimulationResult,
  type ProvenanceStatus,
  type SimulationParams,
  type SimulatorMaterial,
} from "./combustionPhysicsEngine.ts";

export type MetricKey =
  | "limitingO2Pct"
  | "oxygenMarginPct"
  | "flameSpreadRateMmS"
  | "effectiveVelocityCmS"
  | "equivalentGravityG"
  | "adiabaticFlameTempK"
  | "estimatedCO_ppm"
  | "estimatedCO2_pct"
  | "smokeSootIndex"
  | "effectiveThicknessMm";

export interface EquationTerm {
  name: string;
  value: string;
  note: string;
}

export interface MetricAnnotationResult {
  key: MetricKey;
  label: string;
  unit: string;
  liveValue: string;
  provenance: ProvenanceStatus;
  provenanceBadge: string;
  meaning: string;
  symbolicFormula: string;
  substitutedEquation: string;
  verification: {
    rebuiltValue: number;
    reportedValue: number;
    delta: number;
    tolerance: number;
    verified: boolean;
  };
  terms: EquationTerm[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

interface RebuiltInternals {
  materialKey: SimulatorMaterial;
  materialPhysics: { thicknessMm: number; baseLoiPct: number; spreadFactor: number; sootFactor: number };
  o2Pct: number;
  pressurePsi: number;
  airflowCmS: number;
  gravityG: number;
  electricFieldVoltsCm: number;
  co2DilutionPct: number;
  rawThicknessMm: number;
  geometryScale: number;
  effectiveThicknessMm: number;
  buoyantVelocityCmS: number;
  ionWindVelocityCmS: number;
  naturalDraftCmS: number;
  effectiveVelocityCmS: number;
  equivalentGravityG: number;
  curvatureFlowFactor: number;
  lowFlowPenalty: number;
  highFlowPenalty: number;
  pressureScale: number;
  thicknessCorrection: number;
  baseLoi: number;
  limitingO2Pct: number;
  oxygenMarginPct: number;
  ignited: boolean;
  coolFlame: boolean;
  flameSpreadRateMmS: number;
  adiabaticFlameTempK: number;
  incompleteFraction: number;
  estimatedCO_ppm: number;
  estimatedCO2_pct: number;
  smokeSootIndex: number;
}

// Recompute intermediate scalars straight from engine constants so live equations match 100% 🥷
function rebuildInternals(
  sim: CombustionSimulationResult,
  params: SimulationParams
): RebuiltInternals {
  const materialKey =
    sim.material in MATERIAL_PHYSICS ? sim.material : params.material;
  const materialPhysics = MATERIAL_PHYSICS[materialKey];
  const o2Pct = clamp(finiteOr(sim.o2Pct, params.o2Pct), 0, 100);
  const pressurePsi = clamp(finiteOr(sim.pressurePsi, params.pressurePsi), 4, 15);
  const airflowCmS = clamp(finiteOr(sim.airflowCmS, params.airflowCmS), 0, 60);
  const gravityG = clamp(finiteOr(sim.gravityG, params.gravityG), 0, 1);
  const electricFieldVoltsCm = clamp(
    finiteOr(sim.electricFieldVoltsCm, params.electricFieldVoltsCm),
    0,
    3000
  );
  const co2DilutionPct = clamp(
    finiteOr(sim.co2DilutionPct, params.co2DilutionPct),
    0,
    20
  );

  const rawThicknessMm = clamp(
    finiteOr(params.rawThicknessMm, materialPhysics.thicknessMm),
    0.05,
    30
  );
  const geometryScale = GEOMETRY_THERMAL_SCALE[sim.geometryType] ?? 1.0;
  const effectiveThicknessMm = clamp(rawThicknessMm * geometryScale, 0.05, 10);

  const buoyantVelocityCmS = 22 * Math.sqrt(Math.max(0, gravityG));
  const ionWindVelocityCmS = 0.008 * electricFieldVoltsCm;
  const naturalDraftCmS = buoyantVelocityCmS + ionWindVelocityCmS;
  const effectiveVelocityCmS = Math.sqrt(airflowCmS ** 2 + naturalDraftCmS ** 2);
  const equivalentGravityG = (naturalDraftCmS / 22) ** 2;

  const curvatureFlowFactor = geometryScale <= 0.25 ? 0.55 : 1.0;
  const lowFlowPenalty =
    effectiveVelocityCmS < 2
      ? 4.8 * ((2 - effectiveVelocityCmS) / 2) ** 1.25 * curvatureFlowFactor
      : 0;
  const highFlowPenalty =
    effectiveVelocityCmS > 12 ? 0.04 * (effectiveVelocityCmS - 12) ** 1.4 : 0;

  const pressureScale = (Math.max(0.1, pressurePsi) / 14.7) ** -0.25;
  const thicknessCorrection = 0.22 * Math.log2(effectiveThicknessMm / 0.35);
  const baseLoi =
    materialKey.startsWith("PMMA") && geometryScale <= 0.25
      ? 13.1
      : materialPhysics.baseLoiPct;

  const limitingO2Pct = clamp(
    (baseLoi +
      thicknessCorrection +
      lowFlowPenalty +
      highFlowPenalty +
      co2DilutionPct * 0.32) *
      pressureScale,
    8,
    99
  );
  const oxygenMarginPct = o2Pct - limitingO2Pct;
  const ignited = oxygenMarginPct > 0;
  const coolFlame =
    materialKey === "PROPANE_CFI_G" &&
    o2Pct >= 45 &&
    effectiveVelocityCmS <= 18 &&
    co2DilutionPct < 8;

  const flameSpreadRateMmS = ignited
    ? clamp(
        (0.18 *
          oxygenMarginPct *
          Math.sqrt(Math.max(0.35, effectiveVelocityCmS)) *
          materialPhysics.spreadFactor) /
          effectiveThicknessMm ** 0.65,
        0,
        75
      )
    : 0;

  const adiabaticFlameTempK = !ignited
    ? 295
    : coolFlame
      ? clamp(610 + o2Pct * 1.4 - co2DilutionPct * 8, 550, 750)
      : clamp(
          1250 +
            35 * (o2Pct - 10) +
            8 * Math.sqrt(effectiveVelocityCmS) -
            22 * co2DilutionPct +
            10 * (pressurePsi - 10),
          1350,
          2400
        );

  const incompleteFraction = clamp(
    0.04 +
      0.65 * clamp((2.5 - effectiveVelocityCmS) / 2.5, 0, 1) +
      0.42 * clamp((effectiveVelocityCmS - 20) / 40, 0, 1) +
      0.28 * clamp(effectiveThicknessMm / 5, 0, 0.65) +
      0.35 * clamp((limitingO2Pct + 4 - o2Pct) / 7, 0, 1),
    0,
    1
  );

  const estimatedCO_ppm = ignited
    ? Math.round(
        clamp(
          5 +
            945 *
              incompleteFraction *
              materialPhysics.sootFactor *
              (1 - clamp((o2Pct - 21) / 120, 0, 0.55)),
          5,
          950
        )
      )
    : 0;

  const estimatedCO2_pct = ignited
    ? Number(
        clamp(
          1.4 +
            oxygenMarginPct * 0.28 +
            Math.sqrt(effectiveVelocityCmS) * 0.16 -
            incompleteFraction * 1.4 -
            co2DilutionPct * 0.08,
          0.1,
          12
        ).toFixed(2)
      )
    : 0;

  const smokeSootIndex = ignited
    ? Math.round(
        clamp(
          100 *
            incompleteFraction *
            materialPhysics.sootFactor *
            (0.65 + 0.35 * clamp(flameSpreadRateMmS / 18, 0, 1)),
          0,
          100
        )
      )
    : 0;

  return {
    materialKey,
    materialPhysics,
    o2Pct,
    pressurePsi,
    airflowCmS,
    gravityG,
    electricFieldVoltsCm,
    co2DilutionPct,
    rawThicknessMm,
    geometryScale,
    effectiveThicknessMm,
    buoyantVelocityCmS,
    ionWindVelocityCmS,
    naturalDraftCmS,
    effectiveVelocityCmS,
    equivalentGravityG,
    curvatureFlowFactor,
    lowFlowPenalty,
    highFlowPenalty,
    pressureScale,
    thicknessCorrection,
    baseLoi,
    limitingO2Pct,
    oxygenMarginPct,
    ignited,
    coolFlame,
    flameSpreadRateMmS,
    adiabaticFlameTempK,
    incompleteFraction,
    estimatedCO_ppm,
    estimatedCO2_pct,
    smokeSootIndex,
  };
}

type MetricBuilder = (
  sim: CombustionSimulationResult,
  c: RebuiltInternals
) => Omit<MetricAnnotationResult, "verification"> & {
  rebuiltRaw: number;
  reportedRaw: number;
  tolerance: number;
};

// Dispatch table mapping every telemetry card key to its live formula & provenance badge.
const METRIC_BUILDERS: Record<MetricKey, MetricBuilder> = {
  limitingO2Pct: (sim, c) => ({
    key: "limitingO2Pct",
    label: "Limiting O2 Concentration (LOI)",
    unit: "% O2",
    liveValue: `${sim.limitingO2Pct.toFixed(2)}%`,
    provenance: sim.metricProvenance.limitingO2Pct.status,
    provenanceBadge: sim.metricProvenance.limitingO2Pct.badge,
    meaning:
      "Lowest cabin oxygen percentage that still sustains self-propagating combustion for the active geometry, flow, pressure, and CO2 dilution.",
    symbolicFormula:
      "LOI = clamp((baseLoi + 0.22*log2(tau_eff/0.35) + lowFlow + highFlow + 0.32*CO2) * (P/14.7)^-0.25, 8, 99)",
    substitutedEquation: `((${c.baseLoi.toFixed(2)} + ${c.thicknessCorrection.toFixed(2)} + ${c.lowFlowPenalty.toFixed(2)} + ${c.highFlowPenalty.toFixed(2)} + ${(c.co2DilutionPct * 0.32).toFixed(2)}) * ${c.pressureScale.toFixed(3)}) = ${c.limitingO2Pct.toFixed(2)}%`,
    rebuiltRaw: c.limitingO2Pct,
    reportedRaw: sim.limitingO2Pct,
    tolerance: 0.02,
    terms: [
      { name: "baseLoi", value: `${c.baseLoi.toFixed(2)}%`, note: c.materialKey.startsWith("PMMA") && c.geometryScale <= 0.25 ? "Curved PMMA radial override" : `Preset ${c.materialKey}` },
      { name: "tau_eff", value: `${c.effectiveThicknessMm.toFixed(3)} mm`, note: `${c.rawThicknessMm.toFixed(3)} * ${c.geometryScale}` },
      { name: "thicknessTerm", value: `${c.thicknessCorrection >= 0 ? "+" : ""}${c.thicknessCorrection.toFixed(2)}%`, note: "0.22 * log2(tau_eff / 0.35)" },
      { name: "lowFlowPenalty", value: `+${c.lowFlowPenalty.toFixed(2)}%`, note: `curvatureFlowFactor=${c.curvatureFlowFactor}` },
      { name: "highFlowPenalty", value: `+${c.highFlowPenalty.toFixed(2)}%`, note: `v_eff=${c.effectiveVelocityCmS.toFixed(2)} cm/s` },
      { name: "pressureScale", value: `${c.pressureScale.toFixed(3)}x`, note: `(${c.pressurePsi} / 14.7)^-0.25` },
    ],
  }),
  oxygenMarginPct: (sim, c) => ({
    key: "oxygenMarginPct",
    label: "Oxygen Margin Above LOI",
    unit: "% pts",
    liveValue: `${sim.oxygenMarginPct >= 0 ? "+" : ""}${sim.oxygenMarginPct.toFixed(2)}%`,
    provenance: "ESTIMATED",
    provenanceBadge: sim.metricProvenance.limitingO2Pct.badge,
    meaning:
      "Distance between cabin O2% and the material's predicted LOI threshold. Positive triggers sustained burning; zero or below extinguishes.",
    symbolicFormula: "Margin = cabin_O2_pct - LOI",
    substitutedEquation: `${c.o2Pct.toFixed(2)}% - ${c.limitingO2Pct.toFixed(2)}% = ${c.oxygenMarginPct >= 0 ? "+" : ""}${c.oxygenMarginPct.toFixed(2)}%`,
    rebuiltRaw: c.oxygenMarginPct,
    reportedRaw: sim.oxygenMarginPct,
    tolerance: 0.02,
    terms: [
      { name: "cabin_O2", value: `${c.o2Pct.toFixed(2)}%`, note: "User cabin O2 slider" },
      { name: "predicted_LOI", value: `${c.limitingO2Pct.toFixed(2)}%`, note: "Ignition ceiling under current load" },
      { name: "ignited", value: String(c.ignited), note: c.ignited ? "Margin > 0 burns" : "Margin <= 0 quenched" },
    ],
  }),
  flameSpreadRateMmS: (sim, c) => ({
    key: "flameSpreadRateMmS",
    label: "Flame Spread Rate",
    unit: "mm/s",
    liveValue: `${sim.flameSpreadRateMmS.toFixed(2)} mm/s`,
    provenance: sim.metricProvenance.flameSpreadRateMmS.status,
    provenanceBadge: sim.metricProvenance.flameSpreadRateMmS.badge,
    meaning:
      "Surface regression velocity driven by excess oxygen, square-root convective oxidizer delivery, material spread coefficient, and curvature-scaled thickness.",
    symbolicFormula:
      "V_f = ignited ? clamp((0.18 * Margin * sqrt(max(0.35, v_eff)) * spreadFactor) / tau_eff^0.65, 0, 75) : 0",
    substitutedEquation: c.ignited
      ? `(0.18 * ${c.oxygenMarginPct.toFixed(2)} * sqrt(max(0.35, ${c.effectiveVelocityCmS.toFixed(2)})) * ${c.materialPhysics.spreadFactor}) / ${c.effectiveThicknessMm.toFixed(3)}^0.65 = ${c.flameSpreadRateMmS.toFixed(2)} mm/s`
      : `0 mm/s (oxygen margin ${c.oxygenMarginPct.toFixed(2)}% <= 0)`,
    rebuiltRaw: c.flameSpreadRateMmS,
    reportedRaw: sim.flameSpreadRateMmS,
    tolerance: 0.02,
    terms: [
      { name: "oxygenMargin", value: `${c.oxygenMarginPct.toFixed(2)}%`, note: "Excess O2 driving heat release" },
      { name: "sqrt(v_eff)", value: `${Math.sqrt(Math.max(0.35, c.effectiveVelocityCmS)).toFixed(3)}`, note: `v_eff=${c.effectiveVelocityCmS.toFixed(2)} cm/s` },
      { name: "spreadFactor", value: `${c.materialPhysics.spreadFactor}`, note: c.materialKey },
      { name: "tau_eff^0.65", value: `${(c.effectiveThicknessMm ** 0.65).toFixed(3)}`, note: `tau_eff=${c.effectiveThicknessMm.toFixed(3)} mm` },
    ],
  }),
  effectiveVelocityCmS: (sim, c) => ({
    key: "effectiveVelocityCmS",
    label: "Effective Convective Velocity",
    unit: "cm/s",
    liveValue: `${sim.effectiveVelocityCmS.toFixed(2)} cm/s`,
    provenance: "ESTIMATED",
    provenanceBadge: sim.metricProvenance.equivalentGravityG.badge,
    meaning:
      "Quadrature sum of forced cabin airflow plus natural Froude buoyancy and E-field ion wind, keeping O2 transport defined even at 0g.",
    symbolicFormula:
      "v_eff = sqrt(v_fan^2 + (22*sqrt(g) + 0.008*E)^2)",
    substitutedEquation: `sqrt(${c.airflowCmS.toFixed(2)}^2 + (${c.buoyantVelocityCmS.toFixed(2)} + ${c.ionWindVelocityCmS.toFixed(2)})^2) = ${c.effectiveVelocityCmS.toFixed(2)} cm/s`,
    rebuiltRaw: c.effectiveVelocityCmS,
    reportedRaw: sim.effectiveVelocityCmS,
    tolerance: 0.02,
    terms: [
      { name: "forcedAirflow", value: `${c.airflowCmS.toFixed(2)} cm/s`, note: "Cabin ventilation fan" },
      { name: "buoyantDraft", value: `${c.buoyantVelocityCmS.toFixed(2)} cm/s`, note: `22 * sqrt(${c.gravityG}g)` },
      { name: "ionWind", value: `${c.ionWindVelocityCmS.toFixed(2)} cm/s`, note: `0.008 * ${c.electricFieldVoltsCm} V/cm` },
    ],
  }),
  equivalentGravityG: (sim, c) => ({
    key: "equivalentGravityG",
    label: "Effective Equivalent Gravity",
    unit: "g",
    liveValue: `${sim.equivalentGravityG.toFixed(3)}g`,
    provenance: sim.metricProvenance.equivalentGravityG.status,
    provenanceBadge: sim.metricProvenance.equivalentGravityG.badge,
    meaning:
      "Combines real gravitational buoyancy with electrostatic E-field ion wind, calibrated so 1100 V/cm matches Lunar 0.16g convective lift.",
    symbolicFormula: "g_eq = ((22*sqrt(g) + 0.008*E) / 22)^2",
    substitutedEquation: `((${c.buoyantVelocityCmS.toFixed(2)} + ${c.ionWindVelocityCmS.toFixed(2)}) / 22)^2 = ${c.equivalentGravityG.toFixed(4)}g`,
    rebuiltRaw: c.equivalentGravityG,
    reportedRaw: sim.equivalentGravityG,
    tolerance: 0.02,
    terms: [
      { name: "realGravity", value: `${c.gravityG}g`, note: `Buoyancy=${c.buoyantVelocityCmS.toFixed(2)} cm/s` },
      { name: "electricField", value: `${c.electricFieldVoltsCm} V/cm`, note: `Ion wind=${c.ionWindVelocityCmS.toFixed(2)} cm/s` },
      { name: "naturalDraft", value: `${c.naturalDraftCmS.toFixed(2)} cm/s`, note: "Combined buoyant + electrostatic draft" },
    ],
  }),
  adiabaticFlameTempK: (sim, c) => ({
    key: "adiabaticFlameTempK",
    label: "Peak Flame Temperature",
    unit: "K",
    liveValue: `${sim.adiabaticFlameTempK} K`,
    provenance: sim.metricProvenance.flameGeometryAndTemp.status,
    provenanceBadge: sim.metricProvenance.flameGeometryAndTemp.badge,
    meaning:
      "Estimated gas-phase reaction temperature: ambient 295 K when quenched, 550-750 K during low-T peroxy CFI-G cool flames, or 1350-2400 K in hot diffusion flames.",
    symbolicFormula: c.coolFlame
      ? "T_cool = clamp(610 + 1.4*O2 - 8*CO2, 550, 750)"
      : "T_hot = ignited ? clamp(1250 + 35*(O2-10) + 8*sqrt(v_eff) - 22*CO2 + 10*(P-10), 1350, 2400) : 295",
    substitutedEquation: !c.ignited
      ? "295 K (unignited ambient cabin baseline)"
      : c.coolFlame
        ? `clamp(610 + 1.4*${c.o2Pct.toFixed(1)} - 8*${c.co2DilutionPct.toFixed(1)}, 550, 750) = ${Math.round(c.adiabaticFlameTempK)} K`
        : `clamp(1250 + 35*(${c.o2Pct.toFixed(1)}-10) + 8*sqrt(${c.effectiveVelocityCmS.toFixed(2)}) - 22*${c.co2DilutionPct.toFixed(1)} + 10*(${c.pressurePsi}-10), 1350, 2400) = ${Math.round(c.adiabaticFlameTempK)} K`,
    rebuiltRaw: Math.round(c.adiabaticFlameTempK),
    reportedRaw: sim.adiabaticFlameTempK,
    tolerance: 1,
    terms: [
      { name: "mode", value: c.coolFlame ? "Cool Flame (CFI-G)" : c.ignited ? "Hot Flame" : "Ambient", note: sim.regime },
      { name: "O2 boost", value: `${c.o2Pct.toFixed(1)}%`, note: "Raises flame enthalpy" },
      { name: "CO2 heat sink", value: `${c.co2DilutionPct.toFixed(1)}%`, note: "Diluent cools radical zone" },
    ],
  }),
  estimatedCO_ppm: (sim, c) => ({
    key: "estimatedCO_ppm",
    label: "Estimated Carbon Monoxide (CO)",
    unit: "ppm",
    liveValue: `${sim.estimatedCO_ppm} ppm`,
    provenance: "ESTIMATED",
    provenanceBadge: sim.metricProvenance.flameGeometryAndTemp.badge,
    meaning:
      "Toxic incomplete-combustion CO yield peaking when 0g flames suffocate under low ventilation (< 2.5 cm/s) or burn near extinction margin.",
    symbolicFormula:
      "CO_ppm = ignited ? round(clamp(5 + 945 * f_inc * sootFactor * (1 - clamp((O2-21)/120, 0, 0.55)), 5, 950)) : 0",
    substitutedEquation: c.ignited
      ? `5 + 945 * ${c.incompleteFraction.toFixed(3)} * ${c.materialPhysics.sootFactor} * (1 - ${(clamp((c.o2Pct - 21) / 120, 0, 0.55)).toFixed(3)}) = ${c.estimatedCO_ppm} ppm`
      : "0 ppm (unignited)",
    rebuiltRaw: c.estimatedCO_ppm,
    reportedRaw: sim.estimatedCO_ppm,
    tolerance: 1,
    terms: [
      { name: "incompleteFraction", value: c.incompleteFraction.toFixed(3), note: "Driven by low flow, thick fuel, tight O2 margin" },
      { name: "sootFactor", value: `${c.materialPhysics.sootFactor}`, note: c.materialKey },
    ],
  }),
  estimatedCO2_pct: (sim, c) => ({
    key: "estimatedCO2_pct",
    label: "Estimated Exhaust CO2",
    unit: "%",
    liveValue: `${sim.estimatedCO2_pct}%`,
    provenance: "ESTIMATED",
    provenanceBadge: sim.metricProvenance.flameGeometryAndTemp.badge,
    meaning:
      "Local combustion-product CO2 concentration climbing with oxygen margin and convective replenishment, trimmed by incomplete soot quenching.",
    symbolicFormula:
      "CO2 = ignited ? clamp(1.4 + 0.28*Margin + 0.16*sqrt(v_eff) - 1.4*f_inc - 0.08*CO2_in, 0.1, 12) : 0",
    substitutedEquation: c.ignited
      ? `1.4 + 0.28*${c.oxygenMarginPct.toFixed(2)} + 0.16*sqrt(${c.effectiveVelocityCmS.toFixed(2)}) - 1.4*${c.incompleteFraction.toFixed(3)} - 0.08*${c.co2DilutionPct.toFixed(1)} = ${c.estimatedCO2_pct}%`
      : "0% (unignited)",
    rebuiltRaw: c.estimatedCO2_pct,
    reportedRaw: sim.estimatedCO2_pct,
    tolerance: 0.02,
    terms: [
      { name: "oxygenMargin", value: `${c.oxygenMarginPct.toFixed(2)}%`, note: "Drives complete oxidation" },
      { name: "incompleteFraction", value: c.incompleteFraction.toFixed(3), note: "Shifts yield toward CO & soot" },
    ],
  }),
  smokeSootIndex: (sim, c) => ({
    key: "smokeSootIndex",
    label: "Smoke & Soot Index",
    unit: "/100",
    liveValue: `${sim.smokeSootIndex} / 100`,
    provenance: "ESTIMATED",
    provenanceBadge: sim.metricProvenance.flameGeometryAndTemp.badge,
    meaning:
      "Dimensionless aerosol obscuration severity combining fuel soot propensity, incomplete mixing, and flame spread throughput.",
    symbolicFormula:
      "Soot = ignited ? round(clamp(100 * f_inc * sootFactor * (0.65 + 0.35*clamp(V_f/18, 0, 1)), 0, 100)) : 0",
    substitutedEquation: c.ignited
      ? `100 * ${c.incompleteFraction.toFixed(3)} * ${c.materialPhysics.sootFactor} * (0.65 + 0.35*${clamp(c.flameSpreadRateMmS / 18, 0, 1).toFixed(3)}) = ${c.smokeSootIndex}`
      : "0 (unignited)",
    rebuiltRaw: c.smokeSootIndex,
    reportedRaw: sim.smokeSootIndex,
    tolerance: 1,
    terms: [
      { name: "incompleteFraction", value: c.incompleteFraction.toFixed(3), note: "Unburned soot fraction" },
      { name: "spreadRate", value: `${c.flameSpreadRateMmS.toFixed(2)} mm/s`, note: "Drives particulate release rate" },
    ],
  }),
  effectiveThicknessMm: (sim, c) => ({
    key: "effectiveThicknessMm",
    label: "Curvature-Adjusted Effective Thickness",
    unit: "mm",
    liveValue: `${sim.effectiveThicknessMm.toFixed(3)} mm`,
    provenance: "ESTIMATED",
    provenanceBadge: "[INFERRED + BIOT V/A CURVATURE SCALE]",
    meaning:
      "Thermal conduction length after scaling raw dimension by Biot volume-to-surface ratio (1.0 slab, 0.85 fabric, 0.25 cylindrical rod D/4, 0.167 sphere D/6).",
    symbolicFormula: "tau_eff = clamp(rawThicknessMm * GEOMETRY_THERMAL_SCALE[geo], 0.05, 10)",
    substitutedEquation: `clamp(${c.rawThicknessMm.toFixed(3)} mm * ${c.geometryScale} [${sim.geometryType}], 0.05, 10) = ${c.effectiveThicknessMm.toFixed(3)} mm`,
    rebuiltRaw: c.effectiveThicknessMm,
    reportedRaw: sim.effectiveThicknessMm,
    tolerance: 0.02,
    terms: [
      { name: "rawDimension", value: `${c.rawThicknessMm.toFixed(3)} mm`, note: "Preset thickness or scenario override" },
      { name: "biotScale", value: `${c.geometryScale}x`, note: `Geometry = ${sim.geometryType}` },
    ],
  }),
};

export function buildMetricAnnotation(
  key: MetricKey,
  simResult: CombustionSimulationResult,
  params: SimulationParams
): MetricAnnotationResult {
  const internals = rebuildInternals(simResult, params);
  const raw = METRIC_BUILDERS[key](simResult, internals);
  const delta = Math.abs(raw.rebuiltRaw - raw.reportedRaw);
  const verified = delta <= raw.tolerance;

  return {
    key: raw.key,
    label: raw.label,
    unit: raw.unit,
    liveValue: raw.liveValue,
    provenance: raw.provenance,
    provenanceBadge: raw.provenanceBadge,
    meaning: raw.meaning,
    symbolicFormula: raw.symbolicFormula,
    substitutedEquation: raw.substitutedEquation,
    verification: {
      rebuiltValue: Number(raw.rebuiltRaw.toFixed(4)),
      reportedValue: Number(raw.reportedRaw.toFixed(4)),
      delta: Number(delta.toFixed(4)),
      tolerance: raw.tolerance,
      verified,
    },
    terms: raw.terms,
  };
}

export const ALL_METRIC_KEYS: MetricKey[] = Object.keys(
  METRIC_BUILDERS
) as MetricKey[];
