// core physics engine + NASA PSI telemetry normalizer with all the 40-line else-if ladders cremated into lookup tables.

export type SimulatorMaterial =
  | "PMMA_FILM_0.1MM"
  | "PMMA_SLAB_3MM"
  | "SIBAL_FABRIC"
  | "NOMEX"
  | "HEPTANE_DROPLET"
  | "PROPANE_CFI_G";

export type BaseMaterial =
  | "PMMA"
  | "SIBAL (Cotton-Fiberglass)"
  | "Nomex"
  | "Paraffin Wax"
  | "Kapton"
  | "Heptane"
  | "Propane/Methane"
  | "Unknown";

export type GeometryType =
  | "Film/Sheet"
  | "Slab"
  | "Fabric"
  | "Candle"
  | "Cylinder/Rod"
  | "Sphere"
  | "Droplet"
  | "Gas Burner";

export type ExtinctionMechanism =
  | "No Extinction Observed"
  | "Diffusive Quenching (Low Flow Limit)"
  | "Convective Blowoff (High Flow Limit)"
  | "Oxygen Depletion / Product Accumulation"
  | "Incomplete Combustion / Sooting";

export type CombustionRegime =
  | "NO_IGNITION_QUENCHED"
  | "NO_IGNITION_BLOWOFF"
  | "SPHERICAL_DIFFUSION_FLAME"
  | "ELONGATED_MICROGRAVITY_FLAME"
  | "COOL_FLAME_CFI_G"
  | "CRITICAL_ACCELERATED_BURN";

export interface MaterialGeometry {
  baseMaterial: BaseMaterial;
  geometryType: GeometryType;
  thicknessMm: number | null;
  widthCm: number | null;
}

export interface AirflowTrajectory {
  initialAirflowCmS: number | null;
  finalAirflowCmS: number | null;
  airflowSteps: number[];
  extinctionMechanism: ExtinctionMechanism;
}

export interface NormalizedRun extends MaterialGeometry, AirflowTrajectory {
  sourceFormat: "NASA_PSI_RAW" | "HUMAN_NORMALIZED";
  experimentId: string;
  pi: string;
  testNumber: string;
  date: string;
  gmt: string;
  sampleNumber: string;
  rawFuelMaterial: string;
  flowRestrictor: string;
  fanDisplay: string;
  airDisplay: string;
  radiometerGain: string;
  totalFramesShot: number | null;
  initialO2Pct: number | null;
  finalO2Pct: number | null;
  initialCO2Pct: number | null;
  finalCO2Pct: number | null;
  initialCOPpm: number | null;
  finalCOPpm: number | null;
  pressurePsi: number | null;
  temperatureK: number | null;
  gravityG: number | null;
  ignitionStatus: string;
  burnDurationS: number | null;
  flameTemperatureK: number | null;
  flameSpreadMmS: number | null;
  extinctionStatus: string;
  smokeParticleConc: number | null;
}

export interface SimulationParams {
  o2Pct: number;
  pressurePsi: number;
  airflowCmS: number;
  gravityG: number;
  electricFieldVoltsCm: number;
  material: SimulatorMaterial;
  co2DilutionPct: number;
}

export interface CombustionSimulationResult {
  material: SimulatorMaterial;
  o2Pct: number;
  pressurePsi: number;
  airflowCmS: number;
  gravityG: number;
  electricFieldVoltsCm: number;
  co2DilutionPct: number;
  buoyantVelocityCmS: number;
  ionWindVelocityCmS: number;
  effectiveVelocityCmS: number;
  equivalentGravityG: number;
  limitingO2Pct: number;
  oxygenMarginPct: number;
  regime: CombustionRegime;
  flameSpreadRateMmS: number;
  adiabaticFlameTempK: number;
  estimatedCO_ppm: number;
  estimatedCO2_pct: number;
  smokeSootIndex: number;
}

export interface FlameRenderGeometry {
  flameLengthMm: number;
  flameWidthMm: number;
  aspectRatio: number;
  isInsideOutBurner: boolean;
  coreColorHex: string;
  outerGlowColorHex: string;
  sootTailOpacity: number;
  flickerFrequencyHz: number;
}

export interface O2PressureCurvePoint {
  pressurePsi: number;
  loi_0g_ventilated: number;
  loi_1g_earth: number;
  loi_lunar_016g_bounded: number;
  loi_mars_038g_bounded: number;
}

export interface O2AirflowCurvePoint {
  airflowCmS: number;
  limitingO2Pct: number;
}

export interface HabitatPin {
  name: string;
  o2Pct: number;
  pressurePsi: number;
  gravityG: number;
  limitingO2Pct: number;
  ignitionLikely: boolean;
}

export interface FlammabilityEnvelopeData {
  o2VsPressureCurve: O2PressureCurvePoint[];
  o2VsAirflowCurve: O2AirflowCurvePoint[];
  habitatPins: HabitatPin[];
}

export interface EmpiricalRunMatch {
  matchScore: number;
  pi: string;
  testNumber: string;
  fuelSampleMaterial: string;
  airDisplay: string;
  initialO2Pct: number | null;
  finalO2Pct: number | null;
  initialCOPpm: number | null;
  finalCOPpm: number | null;
  coPpmJump: number | null;
  run: NormalizedRun;
}

export interface GradientStop {
  offset: string;
  colorHex: string;
  opacity: number;
}

export interface AdvancedFlameZones {
  schlierenHaloPath: string;
  reactionSheetPath: string;
  sootMantlePath: string;
  pyrolysisCorePath: string;
  schlierenOpacity: number;
  reactionSheetColorHex: string;
  sootMantleOpacity: number;
  pyrolysisCoreColorHex: string;
  gradientStops: {
    schlierenHalo: GradientStop[];
    reactionSheet: GradientStop[];
    sootMantle: GradientStop[];
    pyrolysisCore: GradientStop[];
  };
}

export interface WakeVortexNode {
  x: number;
  y: number;
  radius: number;
  rotationSpeed: number;
  opacity: number;
}

export interface AdvancedFlameDynamics {
  standoffDistancePx: number;
  plumeTiltAngleDeg: number;
  wakeVortexNodes: WakeVortexNode[];
}

export interface FlowStreamlineVector {
  id: string;
  d: string;
  speedMultiplier: number;
  strokeDasharray: string;
  isIonDeflected: boolean;
}

export interface RadiometerSensorOverlay {
  x: number;
  y: number;
  fovPolygonPoints: string;
  radiativeFluxKwM2: number;
}

export interface ThermocoupleProbeTip {
  x: number;
  y: number;
  tempK: number;
  colorHex: string;
}

export interface AerosolLaserBeamOverlay {
  x: number;
  y1: number;
  y2: number;
  obscurationPct: number;
  meanParticleDiameterUm: number;
  alarmState: "NOMINAL" | "SMOKE_ALARM" | "DUST_DISCRIMINATED";
}

export interface AdvancedChamberSensors {
  radiometer: RadiometerSensorOverlay;
  thermocoupleRake: ThermocoupleProbeTip[];
  aerosolLaserBeam: AerosolLaserBeamOverlay;
}

export interface AdvancedFlameField {
  viewportWidth: 640;
  viewportHeight: 380;
  anchorX: 170;
  anchorY: 190;
  isBurning: boolean;
  isInsideOutBurner: boolean;
  Zones: AdvancedFlameZones;
  FlameDynamics: AdvancedFlameDynamics;
  Streamlines: FlowStreamlineVector[];
  ChamberSensors: AdvancedChamberSensors;
  zones: AdvancedFlameZones;
  flameDynamics: AdvancedFlameDynamics;
  streamlines: FlowStreamlineVector[];
  chamberSensors: AdvancedChamberSensors;
}

export interface PressureO2HeatmapCell {
  pressurePsi: number;
  o2Pct: number;
  oxygenMarginPct: number;
  flameSpreadMmS: number;
  regime: CombustionRegime;
  riskLevel0to1: number;
  cellColorHex: string;
}

export type AirflowValleyZone =
  | "Diffusive Quenching Wall (< 2 cm/s)"
  | "Microgravity Super-Flammability Trough (2–12 cm/s)"
  | "Transition Cooling Region (12–25 cm/s)"
  | "Convective Blowoff Slope (> 25 cm/s)";

export interface AirflowO2HeatmapCell {
  airflowCmS: number;
  o2Pct: number;
  limitingO2Pct: number;
  oxygenMarginPct: number;
  flameSpreadMmS: number;
  regime: CombustionRegime;
  zoneTag: AirflowValleyZone;
  riskLevel0to1: number;
  cellColorHex: string;
}

export interface IsoSpreadPoint {
  pressurePsi: number;
  o2Pct: number;
}

export interface IsoSpreadContour {
  label: string;
  targetMmS: number;
  colorHex: string;
  points: IsoSpreadPoint[];
}

export interface IsoSpreadContourSet {
  slowCreep1MmS: IsoSpreadContour;
  rapidCabin5MmS: IsoSpreadContour;
  flashoverEva15MmS: IsoSpreadContour;
}

export interface BoundingPolygonPoint {
  x: number;
  y: number;
  pressurePsi: number;
  o2Pct: number;
}

export interface PreBreatheWaypoint {
  stepIndex: number;
  label: string;
  pressurePsi: number;
  o2Pct: number;
  gravityG: number;
  preBreatheTimeMinutes: number;
  flameSpreadMmS: number;
  riskMultiplierVsIss: number;
}

export interface EmpiricalTelemetryNode {
  id: string;
  experimentId: string;
  testNumber: string;
  o2Pct: number;
  pressurePsi: number;
  airflowCmS: number;
  gravityG: number;
  outcomeCategory:
    | "IGNITED_SUSTAINED"
    | "EXTINCTION"
    | "DISRUPTION"
    | "AEROSOL_SMOKE"
    | "DUST_DISCRIMINATION";
  nodeColorHex: string;
  pulseRadius: number;
  label: string;
  keyMetricText: string;
}

export interface FlammabilityPhaseMatrix {
  pressureO2HeatmapGrid: PressureO2HeatmapCell[][];
  airflowO2HeatmapGrid: AirflowO2HeatmapCell[][];
  isoSpreadContours: IsoSpreadContourSet;
  partialGravityBoundingPolygon: BoundingPolygonPoint[];
  preBreatheTradeoffVector: PreBreatheWaypoint[];
  empiricalTelemetryNodes: EmpiricalTelemetryNode[];
}

interface ChemistryDelta {
  initialO2Pct?: number | null;
  finalO2Pct?: number | null;
  initialCO2Pct?: number | null;
  finalCO2Pct?: number | null;
  initialCOPpm?: number | null;
  finalCOPpm?: number | null;
}

interface MaterialPhysics {
  thicknessMm: number;
  baseLoiPct: number;
  spreadFactor: number;
  sootFactor: number;
}

// nuked the 40-line material else-if monstrosity into a constant Record lookup because nobody has time to scroll through that garbage.
export const MATERIAL_PHYSICS: Record<SimulatorMaterial, MaterialPhysics> = {
  "PMMA_FILM_0.1MM": { thicknessMm: 0.1, baseLoiPct: 14.5, spreadFactor: 1.0, sootFactor: 0.55 },
  PMMA_SLAB_3MM: { thicknessMm: 3.0, baseLoiPct: 16.2, spreadFactor: 0.48, sootFactor: 0.86 },
  SIBAL_FABRIC: { thicknessMm: 0.35, baseLoiPct: 14.7, spreadFactor: 1.15, sootFactor: 0.42 },
  NOMEX: { thicknessMm: 0.45, baseLoiPct: 21.5, spreadFactor: 0.24, sootFactor: 0.2 },
  HEPTANE_DROPLET: { thicknessMm: 2.0, baseLoiPct: 12.8, spreadFactor: 0.85, sootFactor: 0.95 },
  PROPANE_CFI_G: { thicknessMm: 1.0, baseLoiPct: 11.8, spreadFactor: 0.7, sootFactor: 0.25 },
};

// direct lookup from simulator preset key to canonical fuel family so we don't chain string prefix checks like cavemen.
const SIMULATOR_TO_BASE_MATERIAL: Record<SimulatorMaterial, BaseMaterial> = {
  "PMMA_FILM_0.1MM": "PMMA",
  PMMA_SLAB_3MM: "PMMA",
  SIBAL_FABRIC: "SIBAL (Cotton-Fiberglass)",
  NOMEX: "Nomex",
  HEPTANE_DROPLET: "Heptane",
  PROPANE_CFI_G: "Propane/Methane",
};

export const DEFAULT_PARAMS: SimulationParams = {
  o2Pct: 21,
  pressurePsi: 14.7,
  airflowCmS: 5,
  gravityG: 0,
  electricFieldVoltsCm: 0,
  material: "PMMA_FILM_0.1MM",
  co2DilutionPct: 0,
};

// clamps wild slider inputs and finite-checks NaNs so 0% O2 or 0 cm/s doesn't blow a hole in the browser tab.
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const finiteOr = (value: number | null | undefined, fallback: number): number =>
  value !== null && value !== undefined && Number.isFinite(value) ? value : fallback;

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").trim().match(/[-+]?(?:\d+\.?\d*|\.\d+)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

// converts kPa (>25) and atm (<=3.5) to psi because NASA couldn't pick one pressure unit across 8 campaigns and neither could we.
const PRESSURE_UNIT_FACTORS: readonly { match: (p: number) => boolean; factor: number }[] = [
  { match: (p) => p > 25, factor: 0.145038 },
  { match: (p) => p <= 3.5, factor: 14.6959 },
];

function normalizePressurePsi(rawPressure: number | null, fallback: number | null = 14.7): number | null {
  if (rawPressure === null || !Number.isFinite(rawPressure) || rawPressure <= 0) return fallback;
  const scale = PRESSURE_UNIT_FACTORS.find((rule) => rule.match(rawPressure))?.factor ?? 1;
  return Number((rawPressure * scale).toFixed(2));
}

// turns Flex2 fractional O2 (0.17) into actual percentages (17%) so the parser stops thinking astronauts breathe 0.21% oxygen.
function normalizeO2Concentration(rawO2: number | null): number | null {
  if (rawO2 === null || !Number.isFinite(rawO2) || rawO2 <= 0) return rawO2;
  return rawO2 <= 1 ? Number((rawO2 * 100).toFixed(2)) : rawO2;
}

// declarative gravity string matcher so "Microgravity (ISS)" maps to 0g without four stacked if statements.
const GRAVITY_KEYWORD_LOOKUP: readonly { regex: RegExp; g: number }[] = [
  { regex: /microgravity|iss|\b0g\b/i, g: 0 },
  { regex: /lunar|moon/i, g: 0.16 },
  { regex: /mars/i, g: 0.38 },
  { regex: /earth/i, g: 1 },
];

function parseGravityG(rawGravity: string): number | null {
  const trimmed = rawGravity.trim();
  if (!trimmed) return null;
  const hit = GRAVITY_KEYWORD_LOOKUP.find((entry) => entry.regex.test(trimmed));
  return hit ? hit.g : parseNumber(trimmed);
}

// ordered boundary regex table so FLEX-20CAL08 stays in FLEX instead of getting hijacked by FLEX-2.
const CAMPAIGN_ID_PATTERNS: readonly { regex: RegExp; canonicalId: string }[] = [
  { regex: /^BASS-?II(?=[-:_\s]|$)(?:[-:_\s]+(.*))?$/i, canonicalId: "BASS-II" },
  { regex: /^BASS(?=[-:_\s]|$)(?:[-:_\s]+(.*))?$/i, canonicalId: "BASS" },
  { regex: /^SAFFIRE-?3(?=[-:_\s]|$)(?:[-:_\s]+(.*))?$/i, canonicalId: "SAFFIRE-3" },
  { regex: /^FLEX-?2(?=[-:_\s]|$)(?:[-:_\s]+(.*))?$/i, canonicalId: "FLEX-2" },
  { regex: /^FLEX(?=[-:_\s]|$)(?:[-:_\s]+(.*))?$/i, canonicalId: "FLEX" },
  { regex: /^SAME-?R(?=[-:_\s]|$)(?:[-:_\s]+(.*))?$/i, canonicalId: "SAME-R" },
  { regex: /^SAME(?=[-:_\s]|$)(?:[-:_\s]+(.*))?$/i, canonicalId: "SAME" },
  { regex: /^DAFT(?:-?2)?(?=[-:_\s]|$)(?:[-:_\s]+(.*))?$/i, canonicalId: "DAFT" },
];

function splitCampaignAndTestId(
  rawExpId: string,
  explicitTestNum = "",
): { experimentId: string; testNumber: string } {
  const trimmed = rawExpId.trim();
  for (const { regex, canonicalId } of CAMPAIGN_ID_PATTERNS) {
    const match = trimmed.match(regex);
    if (match) {
      return {
        experimentId: canonicalId,
        testNumber: explicitTestNum || (match[1] ?? "").trim() || canonicalId,
      };
    }
  }
  return {
    experimentId: trimmed,
    testNumber:
      explicitTestNum || (trimmed.includes(":") ? trimmed.split(":").slice(1).join(":") : trimmed),
  };
}

const canonicalHeader = (header: string): string =>
  header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

// quote-aware CSV tokenizer that chews through embedded commas in BASS-II descriptions without choking.
function readCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const ch = csvText[index];
    const next = csvText[index + 1];
    if (ch === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((v) => v.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((v) => v.length > 0)) rows.push(row);
  return rows;
}

function getValue(record: Record<string, string>, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const value = record[canonicalHeader(alias)];
    if (value !== undefined) return value;
  }
  return "";
}

function baseMaterialSimilarity(simulatorMaterial: SimulatorMaterial, runMaterial: BaseMaterial): number {
  const target = SIMULATOR_TO_BASE_MATERIAL[simulatorMaterial];
  return target === runMaterial ? 0 : runMaterial === "Unknown" ? 0.8 : 3;
}

// regex lookup tables for fuel chemistry, sample geometry, and thickness so extractMaterialGeometry has zero else-if chains.
const BASE_MATERIAL_MATCHERS: readonly { regex: RegExp; material: BaseMaterial }[] = [
  {
    regex: /\bpmma\b|polymethyl\s*methacrylate|plexiglas|acrylic|\brod\b|micron\s*film|thick\s*film|spherical\s*section|200\s*micron|\bsphere\b/,
    material: "PMMA",
  },
  { regex: /\bsibal\b|cotton[\s-]*fiberglass|cotton[\s-]*glass/, material: "SIBAL (Cotton-Fiberglass)" },
  { regex: /\bnomex\b/, material: "Nomex" },
  { regex: /\bparaf+in\b|\bwax\b|\bcandle\b/, material: "Paraffin Wax" },
  {
    regex: /\bkapton\b|polyimide|\bteflon\b|\bsilicone\b|\bpyrell\b|\bultem\b|\blampwick\b|phthalate/,
    material: "Kapton",
  },
  {
    regex: /\bheptane\b|\bmethanol\b|\bethanol\b|(?:iso|n-)?octane\b|\bdecane\b|\bpropanol\b|\bglycerol\b/,
    material: "Heptane",
  },
  { regex: /\bpropane\b|\bmethane\b|\bcfi[\s-]*g\b/, material: "Propane/Methane" },
];

const GEOMETRY_TYPE_MATCHERS: readonly { regex: RegExp; geometry: GeometryType }[] = [
  { regex: /\bpropane\b|\bmethane\b|\bburner\b|\bcfi[\s-]*g\b/, geometry: "Gas Burner" },
  {
    regex: /\bdroplet\b|\bmethanol\b|\bethanol\b|(?:iso|n-)?octane\b|\bdecane\b|\bpropanol\b|\bglycerol\b|\bheptane\b/,
    geometry: "Droplet",
  },
  { regex: /\bcandle\b/, geometry: "Candle" },
  { regex: /\bsphere|spherical/, geometry: "Sphere" },
  { regex: /\brod\b|\bcylinder\b|black rod/, geometry: "Cylinder/Rod" },
  { regex: /\bfilm\b|\bsheet\b/, geometry: "Film/Sheet" },
  { regex: /\bslab\b|\bthick\b/, geometry: "Slab" },
  { regex: /\bfabric\b|\bcloth\b|\bsibal\b|\bnomex\b/, geometry: "Fabric" },
];

const THICKNESS_EXTRACTORS: readonly { regex: RegExp; toMm: (m: RegExpMatchArray) => number }[] = [
  {
    regex: /(\d+(?:\.\d+)?)\s*(?:micron|microns|μm|um)\b/,
    toMm: (m) => Number.parseFloat(m[1]) / 1000,
  },
  {
    regex: /(\d+(?:\.\d+)?)\s*(?:mm|millimeter|millimeters)\b/,
    toMm: (m) => Number.parseFloat(m[1]),
  },
  {
    regex: /(\d+)\s*\/\s*(\d+)(?:\s*(?:"|inches?|inch|\bin\b))?/,
    toMm: (m) => Number(((Number.parseFloat(m[1]) / Number.parseFloat(m[2])) * 25.4).toFixed(3)),
  },
  {
    regex: /(\d+(?:\.\d+)?)\s*(?:"|inches?|inch|\bin\b)/,
    toMm: (m) => Number((Number.parseFloat(m[1]) * 25.4).toFixed(3)),
  },
];

// parses chaotic lab sample notes like '3/8" black rod' or '100 micron film' into clean material and thickness numbers.
export function extractMaterialGeometry(rawMaterial: string): MaterialGeometry {
  const lower = rawMaterial.trim().toLowerCase();
  const baseMaterial =
    BASE_MATERIAL_MATCHERS.find((rule) => rule.regex.test(lower))?.material ?? "Unknown";
  const geometryType =
    GEOMETRY_TYPE_MATCHERS.find((rule) => rule.regex.test(lower))?.geometry ?? "Fabric";

  let thicknessMm: number | null = null;
  for (const extractor of THICKNESS_EXTRACTORS) {
    const match = lower.match(extractor.regex);
    if (match) {
      thicknessMm = extractor.toMm(match);
      break;
    }
  }

  const widthMatch =
    lower.match(/(\d+(?:\.\d+)?)\s*cm\s*(?:wide|width)\b/) ?? lower.match(/(\d+(?:\.\d+)?)\s*cm\b/);

  return {
    baseMaterial,
    geometryType,
    thicknessMm,
    widthCm: widthMatch ? Number.parseFloat(widthMatch[1]) : null,
  };
}

// maps any normalized NASA flight run to our 6 canonical simulator material keys via lookup rules instead of nested ifs.
const RUN_TO_SIMULATOR_MATERIAL_RULES: readonly {
  match: (run: NormalizedRun) => boolean;
  material: SimulatorMaterial;
}[] = [
  { match: (r) => r.baseMaterial === "Nomex", material: "NOMEX" },
  { match: (r) => r.baseMaterial === "SIBAL (Cotton-Fiberglass)", material: "SIBAL_FABRIC" },
  { match: (r) => r.baseMaterial === "Heptane", material: "HEPTANE_DROPLET" },
  { match: (r) => r.baseMaterial === "Propane/Methane", material: "PROPANE_CFI_G" },
  { match: (r) => (r.thicknessMm ?? 0) >= 1.5, material: "PMMA_SLAB_3MM" },
];

export function mapRunToSimulatorMaterial(run: NormalizedRun): SimulatorMaterial {
  return (
    RUN_TO_SIMULATOR_MATERIAL_RULES.find((rule) => rule.match(run))?.material ?? "PMMA_FILM_0.1MM"
  );
}

// declarative extinction mechanism table because five stacked else-ifs for fan ramp-down logs is an eyesore.
const EXTINCTION_MECHANISM_RULES: readonly {
  match: (ctx: {
    lower: string;
    airflowSteps: number[];
    deltaO2: number;
    deltaCO2: number;
    deltaCO: number;
  }) => boolean;
  mechanism: ExtinctionMechanism;
}[] = [
  { match: ({ lower }) => /\bblow[\s-]*off\b/.test(lower), mechanism: "Convective Blowoff (High Flow Limit)" },
  {
    match: ({ lower, airflowSteps }) =>
      /\bext(?:inction)?\b/.test(lower) || airflowSteps.some((step) => step <= 2),
    mechanism: "Diffusive Quenching (Low Flow Limit)",
  },
  {
    match: ({ deltaO2, deltaCO2 }) => deltaO2 >= 1 || deltaCO2 >= 0.2,
    mechanism: "Oxygen Depletion / Product Accumulation",
  },
  { match: ({ deltaCO }) => deltaCO >= 50, mechanism: "Incomplete Combustion / Sooting" },
];

export function extractAirflowTrajectory(
  rawAirDisplay: string,
  chemistry: ChemistryDelta = {},
): AirflowTrajectory {
  const text = rawAirDisplay.trim();
  const lower = text.toLowerCase();
  const airflowSteps = (text.match(/(?:\d+\.?\d*|\.\d+)/g) ?? [])
    .map((v) => Number.parseFloat(v))
    .filter((v) => Number.isFinite(v));

  const deltaO2 =
    chemistry.initialO2Pct != null && chemistry.finalO2Pct != null
      ? chemistry.initialO2Pct - chemistry.finalO2Pct
      : 0;
  const deltaCO2 =
    chemistry.initialCO2Pct != null && chemistry.finalCO2Pct != null
      ? chemistry.finalCO2Pct - chemistry.initialCO2Pct
      : 0;
  const deltaCO =
    chemistry.initialCOPpm != null && chemistry.finalCOPpm != null
      ? chemistry.finalCOPpm - chemistry.initialCOPpm
      : 0;

  const extinctionMechanism =
    EXTINCTION_MECHANISM_RULES.find((rule) =>
      rule.match({ lower, airflowSteps, deltaO2, deltaCO2, deltaCO }),
    )?.mechanism ?? "No Extinction Observed";

  return {
    initialAirflowCmS: airflowSteps.length > 0 ? airflowSteps[0] : null,
    finalAirflowCmS: airflowSteps.length > 0 ? airflowSteps[airflowSteps.length - 1] : null,
    airflowSteps,
    extinctionMechanism,
  };
}

function buildHumanNormalizedRun(record: Record<string, string>, rowIndex: number): NormalizedRun {
  const rawExpId = getValue(record, ["experiment_id"]) || `HUMAN-ROW-${rowIndex + 2}`;
  const explicitTestNum = getValue(record, ["test_number", "test #", "run_id"]);
  const { experimentId, testNumber } = splitCampaignAndTestId(rawExpId, explicitTestNum);
  const rawFuelMaterial = getValue(record, ["fuel_material_type"]);
  const airDisplay = getValue(record, ["airflow"]);
  const o2Pct = normalizeO2Concentration(parseNumber(getValue(record, ["o2_concentration"])));
  const coPpm = parseNumber(getValue(record, ["co"]));
  const co2Pct = parseNumber(getValue(record, ["co2"]));
  const material = extractMaterialGeometry(rawFuelMaterial);
  const airflow = extractAirflowTrajectory(airDisplay, {
    initialO2Pct: o2Pct,
    finalO2Pct: o2Pct,
    initialCO2Pct: co2Pct,
    finalCO2Pct: co2Pct,
    initialCOPpm: 0,
    finalCOPpm: coPpm,
  });

  return {
    sourceFormat: "HUMAN_NORMALIZED",
    experimentId,
    pi: getValue(record, ["pi"]),
    testNumber,
    date: "",
    gmt: "",
    sampleNumber: "",
    rawFuelMaterial,
    flowRestrictor: "",
    fanDisplay: "",
    airDisplay,
    radiometerGain: "",
    totalFramesShot: null,
    initialO2Pct: o2Pct,
    finalO2Pct: o2Pct,
    initialCO2Pct: co2Pct,
    finalCO2Pct: co2Pct,
    initialCOPpm: coPpm !== null ? 0 : null,
    finalCOPpm: coPpm,
    pressurePsi: normalizePressurePsi(
      parseNumber(getValue(record, ["pressure", "pressure_psi", "pressure_kpa"])),
      14.7,
    ),
    temperatureK: parseNumber(getValue(record, ["temperature"])),
    gravityG: parseGravityG(getValue(record, ["gravity_level"])),
    ignitionStatus: getValue(record, ["ignition_status"]),
    burnDurationS: parseNumber(getValue(record, ["burn_duration"])),
    flameTemperatureK: parseNumber(getValue(record, ["flame_temperature"])),
    flameSpreadMmS: parseNumber(getValue(record, ["flame_spread"])),
    extinctionStatus: getValue(record, ["extinction_status"]),
    smokeParticleConc: parseNumber(getValue(record, ["smoke_particle_conc"])),
    ...material,
    ...airflow,
  };
}

// ingests both raw NASA BASS-II tables and our 8-campaign unified CSV schema without whining about missing cells.
export function parseAndNormalizePsiCsv(csvText: string): NormalizedRun[] {
  const csvRows = readCsv(csvText);
  if (csvRows.length < 2) return [];

  const headers = csvRows[0];
  const canonicalHeaders = headers.map(canonicalHeader);
  const isRawPsi = canonicalHeaders.some(
    (h) => h === "fuelsamplematerial" || h === "calibratedinitialo2byvol",
  );
  const isHumanNormalized =
    canonicalHeaders.includes("experimentid") &&
    (canonicalHeaders.includes("fuelmaterialtype") || canonicalHeaders.includes("o2concentration"));

  if (!isRawPsi && !isHumanNormalized) {
    throw new Error(
      "Unsupported CSV format. Expected NASA PSI/BASS-II columns or the normalized experiment_id schema.",
    );
  }

  return csvRows.slice(1).flatMap((cells, rowIndex): NormalizedRun[] => {
    if (!cells.some((cell) => cell.trim().length > 0)) return [];
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[canonicalHeader(header)] = cells[idx] ?? "";
    });

    if (!isRawPsi) return [buildHumanNormalizedRun(record, rowIndex)];

    const initialO2Pct = normalizeO2Concentration(
      parseNumber(getValue(record, ["Calibrated initial O2 % by vol", "Initial O2 % by vol"])),
    );
    const finalO2Pct = normalizeO2Concentration(
      parseNumber(getValue(record, ["Calibrated final O2 % by vol", "Final O2 % by vol"])),
    );
    const initialCO2Pct = parseNumber(getValue(record, ["Initial CO2 % by vol"]));
    const finalCO2Pct = parseNumber(getValue(record, ["Final CO2 % by vol"]));
    const initialCOPpm = parseNumber(getValue(record, ["Initial CO (ppm)", "Initial CO ppm"]));
    const finalCOPpm = parseNumber(getValue(record, ["Final CO (ppm)", "Final CO ppm"]));
    const rawFuelMaterial = getValue(record, ["Fuel Sample Material"]);
    const airDisplay = getValue(record, ["Air display"]);
    const material = extractMaterialGeometry(rawFuelMaterial);
    const airflow = extractAirflowTrajectory(airDisplay, {
      initialO2Pct,
      finalO2Pct,
      initialCO2Pct,
      finalCO2Pct,
      initialCOPpm,
      finalCOPpm,
    });
    const rawExpId = getValue(record, ["experiment_id", "Experiment ID"]) || "BASS-II";
    const explicitTestNum = getValue(record, ["Test #"]) || `PSI-ROW-${rowIndex + 2}`;
    const { experimentId, testNumber } = splitCampaignAndTestId(rawExpId, explicitTestNum);

    return [
      {
        sourceFormat: "NASA_PSI_RAW",
        experimentId,
        pi: getValue(record, ["PI"]),
        testNumber,
        date: getValue(record, ["Date"]),
        gmt: getValue(record, ["GMT"]),
        sampleNumber: getValue(record, ["Sample #"]),
        rawFuelMaterial,
        flowRestrictor: getValue(record, ["Flow restrictor"]),
        fanDisplay: getValue(record, ["Fan display"]),
        airDisplay,
        radiometerGain: getValue(record, ["Radiometer gain (1000 250 50 10)"]),
        totalFramesShot: parseNumber(getValue(record, ["Total Frames Shot"])),
        initialO2Pct,
        finalO2Pct,
        initialCO2Pct,
        finalCO2Pct,
        initialCOPpm,
        finalCOPpm,
        pressurePsi: normalizePressurePsi(
          parseNumber(getValue(record, ["Pressure (psi)", "Pressure"])),
          14.7,
        ),
        temperatureK: null,
        gravityG: 0,
        ignitionStatus: "",
        burnDurationS: null,
        flameTemperatureK: null,
        flameSpreadMmS: null,
        extinctionStatus: airflow.extinctionMechanism,
        smokeParticleConc: null,
        ...material,
        ...airflow,
      },
    ];
  });
}

// unwraps whatever CSV string, array, or module container you throw at it into 654 normalized flight runs.
const CONTAINER_EXTRACTOR_KEYS = ["MASTER_PSI_CSV", "default", "rows"] as const;

export function loadMasterPsiDataset(rawMasterData: unknown): NormalizedRun[] {
  if (typeof rawMasterData === "string") return parseAndNormalizePsiCsv(rawMasterData);

  if (Array.isArray(rawMasterData)) {
    return rawMasterData.flatMap((entry, index): NormalizedRun[] => {
      if (!entry || typeof entry !== "object") return [];
      const record: Record<string, string> = {};
      for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
        record[canonicalHeader(key)] = value == null ? "" : String(value);
      }
      if ("fuelsamplematerial" in record || "calibratedinitialo2byvol" in record) {
        const headers = Object.keys(entry as Record<string, unknown>);
        const syntheticCsv = [
          headers.join(","),
          headers
            .map((h) => `"${String((entry as Record<string, unknown>)[h] ?? "").replace(/"/g, '""')}"`)
            .join(","),
        ].join("\n");
        return parseAndNormalizePsiCsv(syntheticCsv);
      }
      return [buildHumanNormalizedRun(record, index)];
    });
  }

  if (rawMasterData && typeof rawMasterData === "object") {
    const container = rawMasterData as Record<string, unknown>;
    const key = CONTAINER_EXTRACTOR_KEYS.find((k) => k in container);
    if (key) return loadMasterPsiDataset(container[key]);
  }

  throw new Error(
    "Unsupported master PSI dataset input. Expected CSV string or array of run objects.",
  );
}

// declarative regime classifier table that replaces the nested 6-branch if/else-if ladder in simulateCombustionPhysics.
const REGIME_CLASSIFIERS: readonly {
  match: (ctx: {
    ignited: boolean;
    isHighFlowFailure: boolean;
    cfiCoolFlame: boolean;
    o2Pct: number;
    gravityG: number;
    effectiveVelocityCmS: number;
  }) => boolean;
  regime: CombustionRegime;
}[] = [
  { match: ({ ignited, isHighFlowFailure }) => !ignited && isHighFlowFailure, regime: "NO_IGNITION_BLOWOFF" },
  { match: ({ ignited }) => !ignited, regime: "NO_IGNITION_QUENCHED" },
  { match: ({ cfiCoolFlame }) => cfiCoolFlame, regime: "COOL_FLAME_CFI_G" },
  { match: ({ o2Pct }) => o2Pct >= 30, regime: "CRITICAL_ACCELERATED_BURN" },
  {
    match: ({ gravityG, effectiveVelocityCmS }) => gravityG <= 0.05 && effectiveVelocityCmS < 2.5,
    regime: "SPHERICAL_DIFFUSION_FLAME",
  },
];

// core Froude + Olson/T'ien U-curve + Damkohler pressure physics solver, clamped so 0% O2 or 0g never NaNs.
export function simulateCombustionPhysics(params: SimulationParams): CombustionSimulationResult {
  const o2Pct = clamp(finiteOr(params.o2Pct, 21), 0, 100);
  const pressurePsi = clamp(finiteOr(params.pressurePsi, 14.7), 4, 15);
  const airflowCmS = clamp(finiteOr(params.airflowCmS, 5), 0, 60);
  const gravityG = clamp(finiteOr(params.gravityG, 0), 0, 1);
  const electricFieldVoltsCm = clamp(finiteOr(params.electricFieldVoltsCm, 0), 0, 3000);
  const co2DilutionPct = clamp(finiteOr(params.co2DilutionPct, 0), 0, 20);
  const material = params.material in MATERIAL_PHYSICS ? params.material : DEFAULT_PARAMS.material;
  const materialPhysics = MATERIAL_PHYSICS[material];

  // Froude buoyancy (de Ris 1969) + ACME E-FIELD ion wind (Chien et al. 2019) combined in quadrature so 0g doesn't divide by zero.
  const buoyantVelocityCmS = 22 * Math.sqrt(Math.max(0, gravityG));
  const ionWindVelocityCmS = 0.008 * electricFieldVoltsCm;
  const naturalDraftCmS = buoyantVelocityCmS + ionWindVelocityCmS;
  const effectiveVelocityCmS = Math.sqrt(airflowCmS ** 2 + naturalDraftCmS ** 2);
  const equivalentGravityG = (naturalDraftCmS / 22) ** 2;

  // Olson (1991) & T'ien (1986) said stagnant space air chokes fire in its own CO2 under 2 cm/s while >12 cm/s strips heat toward blowoff.
  const lowFlowPenalty =
    effectiveVelocityCmS < 2 ? 4.8 * ((2 - effectiveVelocityCmS) / 2) ** 1.25 : 0;
  const highFlowPenalty =
    effectiveVelocityCmS > 12 ? 0.04 * (effectiveVelocityCmS - 12) ** 1.4 : 0;

  // Damkohler reduced-pressure power law (P / 14.7)^-0.25 + thermal thickness log2 scaling + CO2 heat-capacity inerting.
  const pressureScale = (Math.max(0.1, pressurePsi) / 14.7) ** -0.25;
  const thicknessCorrection = 0.22 * Math.log2(Math.max(0.05, materialPhysics.thicknessMm) / 0.35);

  const limitingO2Pct = clamp(
    (materialPhysics.baseLoiPct +
      thicknessCorrection +
      lowFlowPenalty +
      highFlowPenalty +
      co2DilutionPct * 0.32) *
      pressureScale,
    8,
    99,
  );

  const oxygenMarginPct = o2Pct - limitingO2Pct;
  const isHighFlowFailure = effectiveVelocityCmS >= 25;
  const ignited = oxygenMarginPct > 0;
  const cfiCoolFlame =
    material === "PROPANE_CFI_G" && o2Pct >= 45 && effectiveVelocityCmS <= 18 && co2DilutionPct < 8;

  const regime =
    REGIME_CLASSIFIERS.find((rule) =>
      rule.match({ ignited, isHighFlowFailure, cfiCoolFlame, o2Pct, gravityG, effectiveVelocityCmS }),
    )?.regime ?? "ELONGATED_MICROGRAVITY_FLAME";

  const flameSpreadRateMmS = ignited
    ? clamp(
        (0.18 *
          oxygenMarginPct *
          Math.sqrt(Math.max(0.35, effectiveVelocityCmS)) *
          materialPhysics.spreadFactor) /
          Math.max(0.05, materialPhysics.thicknessMm) ** 0.65,
        0,
        75,
      )
    : 0;

  // Nayagam et al. (2012) FLEX cool-flame regime locks temperature into 550-750 K peroxy chemistry instead of normal 1350-2400 K hot soot.
  const coolFlame = regime === "COOL_FLAME_CFI_G";
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
          2400,
        );

  const incompleteFraction = clamp(
    0.04 +
      0.65 * clamp((2.5 - effectiveVelocityCmS) / 2.5, 0, 1) +
      0.42 * clamp((effectiveVelocityCmS - 20) / 40, 0, 1) +
      0.28 * clamp(materialPhysics.thicknessMm / 5, 0, 0.65) +
      0.35 * clamp((limitingO2Pct + 4 - o2Pct) / 7, 0, 1),
    0,
    1,
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
          950,
        ),
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
          12,
        ).toFixed(2),
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
          100,
        ),
      )
    : 0;

  return {
    material,
    o2Pct,
    pressurePsi,
    airflowCmS,
    gravityG,
    electricFieldVoltsCm,
    co2DilutionPct,
    buoyantVelocityCmS,
    ionWindVelocityCmS,
    effectiveVelocityCmS,
    equivalentGravityG,
    limitingO2Pct: Number(limitingO2Pct.toFixed(2)),
    oxygenMarginPct: Number(oxygenMarginPct.toFixed(2)),
    regime,
    flameSpreadRateMmS: Number(flameSpreadRateMmS.toFixed(2)),
    adiabaticFlameTempK: Math.round(adiabaticFlameTempK),
    estimatedCO_ppm,
    estimatedCO2_pct,
    smokeSootIndex,
  };
}

// spectral color table so generateFlameRenderGeometry picks cyan 0g spheres, indigo #6366F1 cool flames, or orange plumes without else-if soup.
const FLAME_SPECTRAL_LOOKUP: readonly {
  match: (ctx: {
    isBurning: boolean;
    spherical: boolean;
    coolFlame: boolean;
    critical: boolean;
    o2Pct: number;
  }) => boolean;
  coreColorHex: string;
  outerGlowColorHex: string;
}[] = [
  { match: ({ spherical }) => spherical, coreColorHex: "#00E5FF", outerGlowColorHex: "#66F6FF" },
  { match: ({ coolFlame }) => coolFlame, coreColorHex: "#6366F1", outerGlowColorHex: "#A78BFA" },
  {
    match: ({ critical, o2Pct }) => critical || o2Pct >= 55,
    coreColorHex: "#FFFFFF",
    outerGlowColorHex: "#FF7A00",
  },
  { match: ({ isBurning }) => isBurning, coreColorHex: "#FF7A00", outerGlowColorHex: "#FFD166" },
];

// maps physics state into flame dimensions, spectral colors, and buoyant flicker Hz.
export function generateFlameRenderGeometry(
  simResult: CombustionSimulationResult,
): FlameRenderGeometry {
  const isBurning = !simResult.regime.startsWith("NO_IGNITION");
  const spherical = simResult.regime === "SPHERICAL_DIFFUSION_FLAME";
  const coolFlame = simResult.regime === "COOL_FLAME_CFI_G";
  const critical = simResult.regime === "CRITICAL_ACCELERATED_BURN";

  const aspectRatio =
    !isBurning || spherical
      ? 1
      : clamp(1 + simResult.effectiveVelocityCmS / 7 + simResult.gravityG * 1.7, 1, 9);

  const flameWidthMm = !isBurning
    ? 0
    : clamp(18 + simResult.oxygenMarginPct * 1.4 + (spherical ? 14 : 0), 12, 85);

  const flameLengthMm = !isBurning ? 0 : Number((flameWidthMm * aspectRatio).toFixed(1));

  const spectral = FLAME_SPECTRAL_LOOKUP.find((rule) =>
    rule.match({ isBurning, spherical, coolFlame, critical, o2Pct: simResult.o2Pct }),
  ) ?? { coreColorHex: "#1E293B", outerGlowColorHex: "#334155" };

  const sootTailOpacity = isBurning
    ? Number(
        clamp(
          (simResult.smokeSootIndex / 100) * (0.35 + simResult.effectiveVelocityCmS / 90),
          0,
          1,
        ).toFixed(2),
      )
    : 0;

  const laminarZeroG =
    simResult.gravityG <= 0.02 && simResult.airflowCmS < 1 && simResult.electricFieldVoltsCm < 1;

  const flickerFrequencyHz =
    !isBurning || laminarZeroG
      ? 0
      : Number(
          clamp(
            1.5 + 8 * simResult.gravityG + 0.06 * simResult.airflowCmS + (critical ? 1.5 : 0),
            0,
            12,
          ).toFixed(1),
        );

  return {
    flameLengthMm,
    flameWidthMm: Number(flameWidthMm.toFixed(1)),
    aspectRatio: Number(aspectRatio.toFixed(2)),
    isInsideOutBurner:
      simResult.material === "PROPANE_CFI_G" && simResult.o2Pct <= 85 && isBurning,
    coreColorHex: spectral.coreColorHex,
    outerGlowColorHex: spectral.outerGlowColorHex,
    sootTailOpacity,
    flickerFrequencyHz,
  };
}

function buildClosedPlumeBezierPath(
  originX: number,
  originY: number,
  tiltRad: number,
  rearOffset: number,
  tipLength: number,
  halfWidth: number,
  bulgeFraction: number,
): string {
  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);
  const toWorld = (localS: number, localN: number): [number, number] => [
    clamp(originX + localS * cosT + localN * sinT, 12, 626),
    clamp(originY - localS * sinT + localN * cosT, 12, 368),
  ];

  const [backX, backY] = toWorld(-rearOffset, 0);
  const [topX, topY] = toWorld(tipLength * bulgeFraction, -halfWidth);
  const [tipX, tipY] = toWorld(tipLength, 0);
  const [botX, botY] = toWorld(tipLength * bulgeFraction, halfWidth);
  const [c1x, c1y] = toWorld(-rearOffset * 0.45, -halfWidth * 0.92);
  const [c2x, c2y] = toWorld(tipLength * (bulgeFraction * 0.55), -halfWidth);
  const [c3x, c3y] = toWorld(
    tipLength * (bulgeFraction + (1 - bulgeFraction) * 0.55),
    -halfWidth * 0.72,
  );
  const [c4x, c4y] = toWorld(tipLength * 0.94, -halfWidth * 0.24);
  const [c5x, c5y] = toWorld(tipLength * 0.94, halfWidth * 0.24);
  const [c6x, c6y] = toWorld(
    tipLength * (bulgeFraction + (1 - bulgeFraction) * 0.55),
    halfWidth * 0.72,
  );
  const [c7x, c7y] = toWorld(tipLength * (bulgeFraction * 0.55), halfWidth);
  const [c8x, c8y] = toWorld(-rearOffset * 0.45, halfWidth * 0.92);

  return [
    `M ${backX.toFixed(1)} ${backY.toFixed(1)}`,
    `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${topX.toFixed(1)} ${topY.toFixed(1)}`,
    `C ${c3x.toFixed(1)} ${c3y.toFixed(1)}, ${c4x.toFixed(1)} ${c4y.toFixed(1)}, ${tipX.toFixed(1)} ${tipY.toFixed(1)}`,
    `C ${c5x.toFixed(1)} ${c5y.toFixed(1)}, ${c6x.toFixed(1)} ${c6y.toFixed(1)}, ${botX.toFixed(1)} ${botY.toFixed(1)}`,
    `C ${c7x.toFixed(1)} ${c7y.toFixed(1)}, ${c8x.toFixed(1)} ${c8y.toFixed(1)}, ${backX.toFixed(1)} ${backY.toFixed(1)}`,
    "Z",
  ].join(" ");
}

// threshold lookup table for thermocouple probe glow colors so we don't chain four if statements.
const THERMOCOUPLE_COLOR_THRESHOLDS: readonly { minK: number; hex: string }[] = [
  { minK: 1800, hex: "#FEF3C7" },
  { minK: 1350, hex: "#F97316" },
  { minK: 850, hex: "#F59E0B" },
  { minK: 540, hex: "#818CF8" },
];

const thermocoupleColor = (tempK: number): string =>
  THERMOCOUPLE_COLOR_THRESHOLDS.find((t) => tempK >= t.minK)?.hex ?? "#64748B";

// computes 640x380 wind-tunnel Schlieren zones, plume tilt atan2(buoyant+ion, fan), standoff distance, and SAME/DAFT laser obscuration.
export function generateAdvancedFlameField(
  simResult: CombustionSimulationResult,
): AdvancedFlameField {
  const viewportWidth = 640;
  const viewportHeight = 380;
  const anchorX = 170;
  const anchorY = 190;

  const baseFlame = generateFlameRenderGeometry(simResult);
  const isBurning = !simResult.regime.startsWith("NO_IGNITION");
  const isSpherical = simResult.regime === "SPHERICAL_DIFFUSION_FLAME";
  const isCoolFlame = simResult.regime === "COOL_FLAME_CFI_G";
  const isCritical = simResult.regime === "CRITICAL_ACCELERATED_BURN";

  const buoyantPlusIon = simResult.buoyantVelocityCmS + simResult.ionWindVelocityCmS;
  const vFan = Math.max(0.5, simResult.airflowCmS);
  const tiltRad = Math.atan2(buoyantPlusIon, vFan);
  const plumeTiltAngleDeg = Number(((tiltRad * 180) / Math.PI).toFixed(2));

  const standoffDistancePx = !isBurning
    ? simResult.regime === "NO_IGNITION_BLOWOFF"
      ? 32
      : 0
    : Number(
        clamp(4 + 24 * clamp((simResult.effectiveVelocityCmS - 4) / 18, 0, 1.08), 4, 28).toFixed(1),
      );

  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);
  const liftedOriginX = anchorX + standoffDistancePx * cosT;
  const liftedOriginY = anchorY - standoffDistancePx * sinT;

  const haloLength = isBurning
    ? clamp(
        (isSpherical ? 62 : 95) +
          baseFlame.flameLengthMm * 0.88 -
          simResult.effectiveVelocityCmS * 0.4,
        64,
        305,
      )
    : 48;
  const haloHalfW = isBurning
    ? clamp(
        (isSpherical ? 86 : 64) -
          simResult.effectiveVelocityCmS * 0.7 +
          Math.max(0, simResult.oxygenMarginPct) * 0.4,
        24,
        112,
      )
    : 22;

  const schlierenHaloPath = buildClosedPlumeBezierPath(
    liftedOriginX,
    liftedOriginY,
    tiltRad,
    isSpherical ? haloHalfW : 24,
    isSpherical ? haloHalfW : haloLength,
    haloHalfW,
    isSpherical ? 0.5 : 0.34,
  );

  const reactionLen = isBurning
    ? clamp((isSpherical ? 44 : 74) + baseFlame.flameLengthMm * 0.72, 44, 260)
    : 26;
  const reactionHalfW = isBurning
    ? clamp(
        (isSpherical ? 52 : 36) +
          Math.max(0, simResult.oxygenMarginPct) * 0.32 -
          simResult.effectiveVelocityCmS * 0.32,
        14,
        74,
      )
    : 12;

  const reactionSheetPath = buildClosedPlumeBezierPath(
    liftedOriginX,
    liftedOriginY,
    tiltRad,
    isSpherical ? reactionHalfW : 16,
    isSpherical ? reactionHalfW : reactionLen,
    reactionHalfW,
    isSpherical ? 0.5 : 0.3,
  );

  const pureZeroGSpherical = simResult.gravityG <= 0.05 && simResult.effectiveVelocityCmS < 2.5;
  const hasStrongSoot =
    isBurning && (simResult.o2Pct >= 25 || simResult.effectiveVelocityCmS >= 4);

  const sootLen = !isBurning
    ? 14
    : hasStrongSoot
      ? clamp(reactionLen * 0.96 + (simResult.o2Pct - 21) * 1.45, 36, 265)
      : reactionLen * 0.62;
  const sootHalfW = !isBurning
    ? 7
    : clamp(reactionHalfW * (isCritical ? 0.76 : 0.64), 9, 56);

  const sootMantlePath = buildClosedPlumeBezierPath(
    liftedOriginX + 6 * cosT,
    liftedOriginY - 6 * sinT,
    tiltRad,
    isSpherical ? sootHalfW * 0.85 : 8,
    isSpherical ? sootHalfW * 0.85 : sootLen,
    sootHalfW,
    0.42,
  );

  const coreLen = isBurning ? clamp(reactionLen * 0.36, 18, 72) : 14;
  const coreHalfW = isBurning ? clamp(reactionHalfW * 0.38, 7, 22) : 6;
  const pyrolysisCorePath = buildClosedPlumeBezierPath(
    anchorX,
    anchorY,
    tiltRad,
    8,
    coreLen,
    coreHalfW,
    0.28,
  );

  const reactionSheetColorHex = !isBurning
    ? "#475569"
    : isCoolFlame
      ? "#6366F1"
      : isSpherical
        ? "#00E5FF"
        : "#38BDF8";

  const sootMantleOpacity =
    !isBurning || pureZeroGSpherical || isCoolFlame
      ? 0
      : Number(
          clamp(
            0.28 +
              (simResult.smokeSootIndex / 100) * 0.58 +
              (isCritical ? 0.14 : 0),
            0.12,
            0.94,
          ).toFixed(2),
        );

  const zones: AdvancedFlameZones = {
    schlierenHaloPath,
    reactionSheetPath,
    sootMantlePath,
    pyrolysisCorePath,
    schlierenOpacity: 0.18,
    reactionSheetColorHex,
    sootMantleOpacity,
    pyrolysisCoreColorHex: "#0F172A",
    gradientStops: {
      schlierenHalo: [
        { offset: "0%", colorHex: "#94A3B8", opacity: 0.28 },
        { offset: "65%", colorHex: "#38BDF8", opacity: 0.18 },
        { offset: "100%", colorHex: "#0F172A", opacity: 0 },
      ],
      reactionSheet: [
        { offset: "0%", colorHex: reactionSheetColorHex, opacity: 0.92 },
        { offset: "70%", colorHex: baseFlame.outerGlowColorHex, opacity: 0.55 },
        { offset: "100%", colorHex: reactionSheetColorHex, opacity: 0.12 },
      ],
      sootMantle: [
        { offset: "0%", colorHex: "#FFFBEB", opacity: sootMantleOpacity },
        { offset: "55%", colorHex: "#FF7A00", opacity: Number((sootMantleOpacity * 0.85).toFixed(2)) },
        { offset: "100%", colorHex: "#7C2D12", opacity: 0.05 },
      ],
      pyrolysisCore: [
        { offset: "0%", colorHex: "#020617", opacity: 0.95 },
        { offset: "100%", colorHex: "#1E293B", opacity: 0.72 },
      ],
    },
  };

  const wakeVortexNodes: WakeVortexNode[] = Array.from({ length: 6 }, (_, idx) => {
    const dist = haloLength * (0.58 + idx * 0.16);
    const lateralSign = idx % 2 === 0 ? -1 : 1;
    const lateral = lateralSign * (14 + idx * 5.5);
    const vx = clamp(liftedOriginX + dist * cosT + lateral * sinT, 185, 622);
    const vy = clamp(liftedOriginY - dist * sinT + lateral * cosT, 22, 358);
    const radius = Number(clamp(8 + idx * 2.6 + (isBurning ? 4 : 0), 6, 26).toFixed(1));
    const rotationSpeed = Number(
      (baseFlame.flickerFrequencyHz * lateralSign * (0.9 + idx * 0.12)).toFixed(2),
    );
    const opacity =
      !isBurning || baseFlame.flickerFrequencyHz === 0
        ? 0
        : Number(
            clamp(
              (0.22 +
                (simResult.effectiveVelocityCmS / 60) * 0.45 +
                (simResult.smokeSootIndex / 100) * 0.25) *
                (1 - idx * 0.1),
              0.08,
              0.85,
            ).toFixed(2),
          );
    return { x: Number(vx.toFixed(1)), y: Number(vy.toFixed(1)), radius, rotationSpeed, opacity };
  });

  const flameDynamics: AdvancedFlameDynamics = {
    standoffDistancePx,
    plumeTiltAngleDeg,
    wakeVortexNodes,
  };

  const tiltRiseFactor = Math.sin(tiltRad);
  const streamlines: FlowStreamlineVector[] = Array.from({ length: 11 }, (_, index) => {
    const offsetIndex = index - 5;
    const y0 = anchorY + offsetIndex * 30;
    const proximity = Math.exp(-(offsetIndex * offsetIndex) / 9);
    const obstaclePush = offsetIndex === 0 ? -28 : (offsetIndex < 0 ? -1 : 1) * 26 * proximity;
    const wakeUpwardLift = isBurning ? (58 + 70 * proximity) * tiltRiseFactor : 28 * tiltRiseFactor;
    const yApproach = clamp(y0 + obstaclePush * 0.4, 16, 364);
    const yApex = clamp(y0 + obstaclePush - wakeUpwardLift * 0.35, 16, 364);
    const yExit = clamp(y0 - wakeUpwardLift, 16, 364);

    const d = [
      `M 20 ${y0.toFixed(1)}`,
      `C 85 ${y0.toFixed(1)}, 125 ${yApproach.toFixed(1)}, 170 ${yApex.toFixed(1)}`,
      `C 275 ${yApex.toFixed(1)}, 420 ${yExit.toFixed(1)}, 620 ${yExit.toFixed(1)}`,
    ].join(" ");

    const speedMultiplier = Number(
      clamp((0.65 + simResult.effectiveVelocityCmS / 12) * (1 + 0.35 * proximity), 0.35, 6.5).toFixed(
        2,
      ),
    );
    const dashLen = Math.round(clamp(5 + speedMultiplier * 2.5, 4, 18));
    const gapLen = Math.round(clamp(8 - speedMultiplier * 0.6, 4, 9));

    return {
      id: `streamline-${index + 1}`,
      d,
      speedMultiplier,
      strokeDasharray: `${dashLen} ${gapLen}`,
      isIonDeflected: simResult.electricFieldVoltsCm > 0 && Math.abs(offsetIndex) <= 3,
    };
  });

  const radOriginX = 310;
  const radOriginY = 40;
  const fovCenterX = clamp(liftedOriginX + haloLength * 0.42 * cosT, 185, 440);
  const fovLeftX = Math.round(fovCenterX - 95);
  const fovRightX = Math.round(fovCenterX + 95);
  const radiativeFluxKwM2 = !isBurning
    ? 0
    : isCoolFlame
      ? Number(clamp(0.4 + simResult.o2Pct * 0.015, 0.3, 2.2).toFixed(2))
      : Number(
          clamp(
            4.5 *
              (simResult.adiabaticFlameTempK / 1500) ** 4 *
              (0.45 + simResult.smokeSootIndex / 140),
            1.2,
            85,
          ).toFixed(2),
        );

  const thermocoupleRake: ThermocoupleProbeTip[] = [0.22, 0.4, 0.6, 0.8, 0.96].map((frac) => {
    const dist = haloLength * frac;
    const px = clamp(liftedOriginX + dist * cosT, 178, 595);
    const py = clamp(liftedOriginY - dist * sinT, 26, 352);
    const falloff = Math.exp(-((frac - 0.32) ** 2) / 0.22);
    const tempK = !isBurning ? 295 : Math.round(295 + (simResult.adiabaticFlameTempK - 295) * falloff);
    return {
      x: Number(px.toFixed(1)),
      y: Number(py.toFixed(1)),
      tempK,
      colorHex: thermocoupleColor(tempK),
    };
  });

  // SAME sub-micron smoke (<0.55 um) vs DAFT coarse cabin dust (>2.2 um) discrimination without nested else-if spaghetti.
  const isSmokeAlarm =
    isBurning && (simResult.smokeSootIndex >= 22 || simResult.estimatedCO_ppm >= 120);
  const isDustDiscriminated = !isSmokeAlarm && simResult.airflowCmS >= 18;

  const aerosolLaserBeam: AerosolLaserBeamOverlay = isSmokeAlarm
    ? {
        x: 560,
        y1: 28,
        y2: 352,
        alarmState: "SMOKE_ALARM",
        meanParticleDiameterUm: Number(
          clamp(0.48 - (simResult.smokeSootIndex / 100) * 0.36, 0.08, 0.55).toFixed(2),
        ),
        obscurationPct: Number(clamp(12 + simResult.smokeSootIndex * 0.58, 8, 72).toFixed(1)),
      }
    : isDustDiscriminated
      ? {
          x: 560,
          y1: 28,
          y2: 352,
          alarmState: "DUST_DISCRIMINATED",
          meanParticleDiameterUm: Number(
            clamp(2.4 + (simResult.airflowCmS - 18) * 0.14, 2.2, 8.5).toFixed(2),
          ),
          obscurationPct: Number(
            clamp(4.5 + (simResult.airflowCmS - 18) * 0.26, 4.5, 16.5).toFixed(1),
          ),
        }
      : {
          x: 560,
          y1: 28,
          y2: 352,
          alarmState: "NOMINAL",
          meanParticleDiameterUm: isBurning ? 0.35 : 0.45,
          obscurationPct: isBurning
            ? Number(clamp(2.5 + simResult.smokeSootIndex * 0.3, 2, 12).toFixed(1))
            : 1.2,
        };

  const chamberSensors: AdvancedChamberSensors = {
    radiometer: {
      x: radOriginX,
      y: radOriginY,
      fovPolygonPoints: `${radOriginX},${radOriginY} ${fovLeftX},255 ${fovRightX},255`,
      radiativeFluxKwM2,
    },
    thermocoupleRake,
    aerosolLaserBeam,
  };

  return {
    viewportWidth,
    viewportHeight,
    anchorX,
    anchorY,
    isBurning,
    isInsideOutBurner: baseFlame.isInsideOutBurner,
    Zones: zones,
    FlameDynamics: flameDynamics,
    Streamlines: streamlines,
    ChamberSensors: chamberSensors,
    zones,
    flameDynamics,
    streamlines,
    chamberSensors,
  };
}

// sweeps pressure (4-15 psi) and airflow (0-50 cm/s) to bound Lunar 0.16g and Mars 0.38g curves strictly between 0g and 1g.
export function generateFlammabilityEnvelopeData(
  currentParams: Partial<SimulationParams>,
): FlammabilityEnvelopeData {
  const base: SimulationParams = { ...DEFAULT_PARAMS, ...currentParams };

  const o2VsPressureCurve: O2PressureCurvePoint[] = Array.from({ length: 23 }, (_, idx) => {
    const pressurePsi = Number((4 + idx * 0.5).toFixed(1));
    const atPressure = (gravityG: number, airflowCmS: number): number =>
      simulateCombustionPhysics({ ...base, pressurePsi, gravityG, airflowCmS }).limitingO2Pct;
    const loi0g = atPressure(0, 5);
    const loi1g = atPressure(1, 0);
    const span = Math.max(0.4, loi1g - loi0g);

    return {
      pressurePsi,
      loi_0g_ventilated: loi0g,
      loi_1g_earth: loi1g,
      loi_lunar_016g_bounded: Number((loi0g + span * Math.sqrt(0.16)).toFixed(2)),
      loi_mars_038g_bounded: Number((loi0g + span * Math.sqrt(0.38)).toFixed(2)),
    };
  });

  const o2VsAirflowCurve: O2AirflowCurvePoint[] = Array.from({ length: 26 }, (_, idx) => {
    const airflowCmS = idx * 2;
    const result = simulateCombustionPhysics({
      ...base,
      gravityG: 0,
      electricFieldVoltsCm: 0,
      airflowCmS,
    });
    return { airflowCmS, limitingO2Pct: result.limitingO2Pct };
  });

  const habitatScenarios = [
    { name: "ISS", o2Pct: 21, pressurePsi: 14.7, gravityG: 0 },
    { name: "Lunar Base", o2Pct: 34, pressurePsi: 10.2, gravityG: 0.16 },
    { name: "Mars Habitat Reference", o2Pct: 21, pressurePsi: 10.2, gravityG: 0.38 },
    { name: "EVA Suit", o2Pct: 100, pressurePsi: 4.3, gravityG: 0 },
    { name: "Earth", o2Pct: 21, pressurePsi: 14.7, gravityG: 1 },
  ];

  const habitatPins: HabitatPin[] = habitatScenarios.map((scenario) => {
    const result = simulateCombustionPhysics({ ...base, ...scenario, airflowCmS: base.airflowCmS });
    return {
      ...scenario,
      limitingO2Pct: result.limitingO2Pct,
      ignitionLikely: result.oxygenMarginPct > 0,
    };
  });

  return { o2VsPressureCurve, o2VsAirflowCurve, habitatPins };
}

// lookup tables for phase heatmap colors, valley zones, and telemetry pin outcomes so generateFlammabilityPhaseMatrix stays branch-free.
const REGIME_HEATMAP_COLORS: Partial<Record<CombustionRegime, string>> = {
  NO_IGNITION_QUENCHED: "#0F172A",
  NO_IGNITION_BLOWOFF: "#1E293B",
  COOL_FLAME_CFI_G: "#4F46E5",
};

const RISK_HEATMAP_BANDS: readonly { maxRisk: number; hex: string }[] = [
  { maxRisk: 0.25, hex: "#0E7490" },
  { maxRisk: 0.5, hex: "#D97706" },
  { maxRisk: 0.78, hex: "#EA580C" },
];

const heatmapColorForRisk = (riskLevel0to1: number, regime: CombustionRegime): string =>
  REGIME_HEATMAP_COLORS[regime] ??
  RISK_HEATMAP_BANDS.find((b) => riskLevel0to1 < b.maxRisk)?.hex ??
  "#DC2626";

const AIRFLOW_VALLEY_THRESHOLDS: readonly { maxFlow: number; zone: AirflowValleyZone }[] = [
  { maxFlow: 1.999, zone: "Diffusive Quenching Wall (< 2 cm/s)" },
  { maxFlow: 12, zone: "Microgravity Super-Flammability Trough (2–12 cm/s)" },
  { maxFlow: 25, zone: "Transition Cooling Region (12–25 cm/s)" },
];

const classifyAirflowZone = (airflowCmS: number): AirflowValleyZone =>
  AIRFLOW_VALLEY_THRESHOLDS.find((t) => airflowCmS <= t.maxFlow)?.zone ??
  "Convective Blowoff Slope (> 25 cm/s)";

const OUTCOME_NODE_STYLES: Record<
  EmpiricalTelemetryNode["outcomeCategory"],
  { hex: string; radius: number }
> = {
  DUST_DISCRIMINATION: { hex: "#06B6D4", radius: 4 },
  AEROSOL_SMOKE: { hex: "#F59E0B", radius: 4 },
  DISRUPTION: { hex: "#A855F7", radius: 5 },
  EXTINCTION: { hex: "#10B981", radius: 4 },
  IGNITED_SUSTAINED: { hex: "#EF4444", radius: 5.5 },
};

const TELEMETRY_OUTCOME_MATCHERS: readonly {
  match: (expUpper: string, extLower: string) => boolean;
  category: EmpiricalTelemetryNode["outcomeCategory"];
}[] = [
  { match: (exp) => exp.startsWith("DAFT"), category: "DUST_DISCRIMINATION" },
  { match: (exp) => exp.startsWith("SAME"), category: "AEROSOL_SMOKE" },
  { match: (_, ext) => ext.includes("disruption"), category: "DISRUPTION" },
  {
    match: (_, ext) => /extinction|quenching|blowoff|self-extinguish/.test(ext),
    category: "EXTINCTION",
  },
];

// builds the 23x19 pressure-O2 grid, 26x19 airflow-O2 grid, iso-spread contours, bounding corridor, pre-breathe vector, and 654 telemetry pins.
export function generateFlammabilityPhaseMatrix(
  currentParams: SimulationParams,
  empiricalRuns: readonly NormalizedRun[],
): FlammabilityPhaseMatrix {
  const base: SimulationParams = { ...DEFAULT_PARAMS, ...currentParams };
  const matPhysics =
    MATERIAL_PHYSICS[base.material in MATERIAL_PHYSICS ? base.material : DEFAULT_PARAMS.material];

  const computeRisk0to1 = (res: CombustionSimulationResult): number =>
    res.oxygenMarginPct <= 0
      ? 0
      : Number(
          clamp(
            0.2 + (res.oxygenMarginPct / 45) * 0.45 + (res.flameSpreadRateMmS / 22) * 0.35,
            0.08,
            1,
          ).toFixed(3),
        );

  const pressureO2HeatmapGrid: PressureO2HeatmapCell[][] = Array.from({ length: 23 }, (_, pIdx) => {
    const pressurePsi = Number((4 + pIdx * 0.5).toFixed(1));
    return Array.from({ length: 19 }, (__, oIdx) => {
      const o2Pct = 10 + oIdx * 5;
      const res = simulateCombustionPhysics({ ...base, pressurePsi, o2Pct });
      const riskLevel0to1 = computeRisk0to1(res);
      return {
        pressurePsi,
        o2Pct,
        oxygenMarginPct: res.oxygenMarginPct,
        flameSpreadMmS: res.flameSpreadRateMmS,
        regime: res.regime,
        riskLevel0to1,
        cellColorHex: heatmapColorForRisk(riskLevel0to1, res.regime),
      };
    });
  });

  const airflowO2HeatmapGrid: AirflowO2HeatmapCell[][] = Array.from({ length: 26 }, (_, aIdx) => {
    const airflowCmS = aIdx * 2;
    const zoneTag = classifyAirflowZone(airflowCmS);
    return Array.from({ length: 19 }, (__, oIdx) => {
      const o2Pct = 10 + oIdx * 5;
      const res = simulateCombustionPhysics({
        ...base,
        gravityG: 0,
        electricFieldVoltsCm: 0,
        airflowCmS,
        o2Pct,
      });
      const riskLevel0to1 = computeRisk0to1(res);
      return {
        airflowCmS,
        o2Pct,
        limitingO2Pct: res.limitingO2Pct,
        oxygenMarginPct: res.oxygenMarginPct,
        flameSpreadMmS: res.flameSpreadRateMmS,
        regime: res.regime,
        zoneTag,
        riskLevel0to1,
        cellColorHex: heatmapColorForRisk(riskLevel0to1, res.regime),
      };
    });
  });

  const refFlow = simulateCombustionPhysics(base);
  const safeSlope = Math.max(
    0.05,
    (0.18 *
      Math.sqrt(Math.max(0.35, refFlow.effectiveVelocityCmS)) *
      matPhysics.spreadFactor) /
      Math.max(0.05, matPhysics.thicknessMm) ** 0.65,
  );

  const computeIsoContourPoints = (targetMmS: number): IsoSpreadPoint[] =>
    Array.from({ length: 23 }, (_, pIdx) => {
      const pressurePsi = Number((4 + pIdx * 0.5).toFixed(1));
      const atP = simulateCombustionPhysics({ ...base, pressurePsi });
      return {
        pressurePsi,
        o2Pct: Number(clamp(atP.limitingO2Pct + targetMmS / safeSlope, 10, 100).toFixed(2)),
      };
    });

  const isoSpreadContours: IsoSpreadContourSet = {
    slowCreep1MmS: {
      label: "1 mm/s (Slow Creep)",
      targetMmS: 1,
      colorHex: "#38BDF8",
      points: computeIsoContourPoints(1),
    },
    rapidCabin5MmS: {
      label: "5 mm/s (Rapid Cabin Spread)",
      targetMmS: 5,
      colorHex: "#F59E0B",
      points: computeIsoContourPoints(5),
    },
    flashoverEva15MmS: {
      label: "15 mm/s (Flashover / EVA Danger)",
      targetMmS: 15,
      colorHex: "#EF4444",
      points: computeIsoContourPoints(15),
    },
  };

  const envelope = generateFlammabilityEnvelopeData(base);
  const partialGravityBoundingPolygon: BoundingPolygonPoint[] = [
    ...envelope.o2VsPressureCurve.map((pt) => ({
      x: pt.pressurePsi,
      y: pt.loi_0g_ventilated,
      pressurePsi: pt.pressurePsi,
      o2Pct: pt.loi_0g_ventilated,
    })),
    ...[...envelope.o2VsPressureCurve].reverse().map((pt) => ({
      x: pt.pressurePsi,
      y: pt.loi_1g_earth,
      pressurePsi: pt.pressurePsi,
      o2Pct: pt.loi_1g_earth,
    })),
  ];

  const issSpreadBaseline = Math.max(
    0.25,
    simulateCombustionPhysics({ ...base, pressurePsi: 14.7, o2Pct: 21, gravityG: 0 })
      .flameSpreadRateMmS,
  );

  const preBreatheTradeoffVector: PreBreatheWaypoint[] = Array.from({ length: 12 }, (_, stepIndex) => {
    const isPhaseOne = stepIndex <= 5;
    const t = isPhaseOne ? stepIndex / 5 : (stepIndex - 5) / 6;
    const pressurePsi = Number(
      (isPhaseOne ? 14.7 + (10.2 - 14.7) * t : 10.2 + (4.3 - 10.2) * t).toFixed(2),
    );
    const o2Pct = Number((isPhaseOne ? 21 + (34 - 21) * t : 34 + (100 - 34) * t).toFixed(1));
    const gravityG = Number((isPhaseOne ? 0.16 * t : 0.16 * (1 - t)).toFixed(3));
    const preBreatheTimeMinutes = Math.round(isPhaseOne ? 240 - 195 * t : 45 * (1 - t));
    const WAYPOINT_LABELS: Record<number, string> = {
      0: "ISS Nominal (14.7 psi / 21% O2)",
      5: "Lunar Base / Rover (10.2 psi / 34% O2)",
      11: "EVA Spacesuit (4.3 psi / 100% O2)",
    };
    const label =
      WAYPOINT_LABELS[stepIndex] ??
      (isPhaseOne ? `Exploration Transition ${stepIndex}` : `EVA Depressurization ${stepIndex - 5}`);

    const sim = simulateCombustionPhysics({ ...base, pressurePsi, o2Pct, gravityG });
    return {
      stepIndex,
      label,
      pressurePsi,
      o2Pct,
      gravityG,
      preBreatheTimeMinutes,
      flameSpreadMmS: sim.flameSpreadRateMmS,
      riskMultiplierVsIss: Number((sim.flameSpreadRateMmS / issSpreadBaseline).toFixed(2)),
    };
  });

  const empiricalTelemetryNodes: EmpiricalTelemetryNode[] = empiricalRuns.map((run, index) => {
    const o2Pct = clamp(finiteOr(run.initialO2Pct, 21), 10, 100);
    const pressurePsi = clamp(finiteOr(run.pressurePsi, 14.7), 4, 15);
    const airflowCmS = clamp(
      finiteOr(run.initialAirflowCmS, finiteOr(run.finalAirflowCmS, 5)),
      0,
      50,
    );
    const gravityG = clamp(finiteOr(run.gravityG, 0), 0, 1);

    const expUpper = run.experimentId.toUpperCase();
    const extLower = `${run.extinctionStatus} ${run.extinctionMechanism}`.toLowerCase();
    const outcomeCategory =
      TELEMETRY_OUTCOME_MATCHERS.find((m) => m.match(expUpper, extLower))?.category ??
      "IGNITED_SUSTAINED";
    const style = OUTCOME_NODE_STYLES[outcomeCategory];

    const metricParts = [
      run.flameSpreadMmS !== null ? `${run.flameSpreadMmS} mm/s` : null,
      run.finalCOPpm !== null ? `CO ${run.finalCOPpm} ppm` : null,
      run.smokeParticleConc !== null ? `Size ${run.smokeParticleConc} µm` : null,
      run.burnDurationS !== null ? `${run.burnDurationS}s burn` : null,
    ].filter(Boolean);

    return {
      id: `${run.experimentId}-${run.testNumber}-${index}`,
      experimentId: run.experimentId,
      testNumber: run.testNumber,
      o2Pct,
      pressurePsi,
      airflowCmS,
      gravityG,
      outcomeCategory,
      nodeColorHex: style.hex,
      pulseRadius: style.radius,
      label: `${run.experimentId} • ${run.testNumber}`,
      keyMetricText:
        metricParts.length > 0
          ? metricParts.join(" | ")
          : run.extinctionStatus || run.extinctionMechanism,
    };
  });

  return {
    pressureO2HeatmapGrid,
    airflowO2HeatmapGrid,
    isoSpreadContours,
    partialGravityBoundingPolygon,
    preBreatheTradeoffVector,
    empiricalTelemetryNodes,
  };
}

// ranks empirical NASA flight runs by weighted L1 distance so you always see the closest real-world ISS burn tests.
export function findClosestEmpiricalRuns(
  params: SimulationParams,
  parsedRuns: readonly NormalizedRun[],
  limit = 5,
): EmpiricalRunMatch[] {
  const safeLimit = Math.max(1, Math.floor(limit));
  return parsedRuns
    .map((run): EmpiricalRunMatch => {
      const runO2 = finiteOr(run.initialO2Pct, 21);
      const runAirflow = finiteOr(run.initialAirflowCmS, finiteOr(run.finalAirflowCmS, 5));
      const runPressure = finiteOr(run.pressurePsi, 14.7);
      const runGravity = finiteOr(run.gravityG, 0);

      const score =
        Math.abs(runO2 - params.o2Pct) * 1.8 +
        Math.abs(runAirflow - params.airflowCmS) * 0.48 +
        Math.abs(runPressure - params.pressurePsi) * 1.1 +
        Math.abs(runGravity - params.gravityG) * 8 +
        baseMaterialSimilarity(params.material, run.baseMaterial);

      const coPpmJump =
        run.initialCOPpm !== null && run.finalCOPpm !== null
          ? run.finalCOPpm - run.initialCOPpm
          : null;

      return {
        matchScore: Number(score.toFixed(2)),
        pi: run.pi,
        testNumber: run.testNumber,
        fuelSampleMaterial: run.rawFuelMaterial,
        airDisplay: run.airDisplay,
        initialO2Pct: run.initialO2Pct,
        finalO2Pct: run.finalO2Pct,
        initialCOPpm: run.initialCOPpm,
        finalCOPpm: run.finalCOPpm,
        coPpmJump,
        run,
      };
    })
    .sort((a, b) => a.matchScore - b.matchScore)
    .slice(0, safeLimit);
}
