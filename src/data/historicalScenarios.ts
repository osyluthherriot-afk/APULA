import type {
  CombustionRegime,
  CombustionSimulationResult,
  SimulationParams,
} from "../lib/combustionPhysicsEngine.ts";

export interface ScenarioVariant {
  id: string;
  label: string;
  summary: string;
  params: SimulationParams;
  expected: {
    regime: CombustionRegime;
    ignited: boolean;
    limitingO2Pct: number;
    oxygenMarginPct: number;
    flameSpreadRateMmS: number;
    effectiveThicknessMm: number;
    equivalentGravityG: number;
  };
}

export interface HistoricalScenario {
  id: string;
  missionTag: string;
  title: string;
  narration: string;
  whatToWatch: string[];
  observedOutcome: string;
  honestCaveat: string;
  defaultVariantId: string;
  variants: ScenarioVariant[];
}

// Five documented orbital & analog fire tests paired with verified engine targets 👁️
export const HISTORICAL_SCENARIOS: HistoricalScenario[] = [
  {
    id: "flex-2-transition",
    missionTag: "ISS Ventilation Drawdown / FLEX-2 Analog",
    title: "Low-Flow Extinction vs. Diffusive Persistence (20 -> 0 cm/s)",
    narration:
      "During orbital cabin depressurization or ventilation shutdown, forced duct flow drops from active 20 cm/s down to quiescent 0 cm/s. Step along the drawdown sequence to watch the 3D flame contract from an elongated yellow convective plume into a faint cyan 0g diffusion sphere.",
    whatToWatch: [
      "Watch LOI climb steeply below 2 cm/s (15.18% -> 19.98% for 3 mm PMMA) as product CO2 accumulates around the flame.",
      "Notice morphology flips from ELONGATED_MICROGRAVITY_FLAME (20 to 3 cm/s) to SPHERICAL_DIFFUSION_FLAME at <= 2 cm/s.",
      "Compare 3 mm slab spread collapse (0.03 mm/s at 0 cm/s) versus thinner 1 mm fuel (0.07 mm/s).",
    ],
    observedOutcome:
      "NASA microgravity droplet/solid studies (FLEX-2 & BASS-II) show radiant-heat-loss quenching or dim low-temperature transitions as forced velocity collapses toward stagnant 0g.",
    honestCaveat:
      "Transient FLEX-2 / Cool-Flame radiatively quenched extinction is not modeled as a time-dependent chemical cool-flame on solid PMMA; steady-state PMMA retains a small positive margin at 21% O2 (switch material to Propane CFI-G >= 45% O2 to inspect steady cool-flame behavior).",
    defaultVariantId: "flex-drawdown-3mm-0",
    variants: [
      {
        id: "flex-drawdown-3mm-20",
        label: "3mm PMMA @ 20 cm/s",
        summary: "Active ISS duct flow baseline",
        params: {
          material: "PMMA_SLAB_3MM",
          geometryType: "Slab",
          rawThicknessMm: 3,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 20,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "ELONGATED_MICROGRAVITY_FLAME",
          ignited: true,
          limitingO2Pct: 15.92,
          oxygenMarginPct: 5.08,
          flameSpreadRateMmS: 0.96,
          effectiveThicknessMm: 3.0,
          equivalentGravityG: 0,
        },
      },
      {
        id: "flex-drawdown-3mm-12",
        label: "3mm PMMA @ 12 cm/s",
        summary: "Transitional cabin drawdown",
        params: {
          material: "PMMA_SLAB_3MM",
          geometryType: "Slab",
          rawThicknessMm: 3,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 12,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "ELONGATED_MICROGRAVITY_FLAME",
          ignited: true,
          limitingO2Pct: 15.18,
          oxygenMarginPct: 5.82,
          flameSpreadRateMmS: 0.85,
          effectiveThicknessMm: 3.0,
          equivalentGravityG: 0,
        },
      },
      {
        id: "flex-drawdown-3mm-5",
        label: "3mm PMMA @ 5 cm/s",
        summary: "U-curve sweet spot ventilation",
        params: {
          material: "PMMA_SLAB_3MM",
          geometryType: "Slab",
          rawThicknessMm: 3,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 5,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "ELONGATED_MICROGRAVITY_FLAME",
          ignited: true,
          limitingO2Pct: 15.18,
          oxygenMarginPct: 5.82,
          flameSpreadRateMmS: 0.55,
          effectiveThicknessMm: 3.0,
          equivalentGravityG: 0,
        },
      },
      {
        id: "flex-drawdown-3mm-3",
        label: "3mm PMMA @ 3 cm/s",
        summary: "Low-flow slow convective limit",
        params: {
          material: "PMMA_SLAB_3MM",
          geometryType: "Slab",
          rawThicknessMm: 3,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 3,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "ELONGATED_MICROGRAVITY_FLAME",
          ignited: true,
          limitingO2Pct: 15.18,
          oxygenMarginPct: 5.82,
          flameSpreadRateMmS: 0.43,
          effectiveThicknessMm: 3.0,
          equivalentGravityG: 0,
        },
      },
      {
        id: "flex-drawdown-3mm-2",
        label: "3mm PMMA @ 2 cm/s",
        summary: "Onset of spherical diffusion morphology",
        params: {
          material: "PMMA_SLAB_3MM",
          geometryType: "Slab",
          rawThicknessMm: 3,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 2,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "SPHERICAL_DIFFUSION_FLAME",
          ignited: true,
          limitingO2Pct: 15.18,
          oxygenMarginPct: 5.82,
          flameSpreadRateMmS: 0.35,
          effectiveThicknessMm: 3.0,
          equivalentGravityG: 0,
        },
      },
      {
        id: "flex-drawdown-3mm-0",
        label: "3mm PMMA @ 0 cm/s (Still Air)",
        summary: "Stagnant 0g diffusive sphere near extinction edge",
        params: {
          material: "PMMA_SLAB_3MM",
          geometryType: "Slab",
          rawThicknessMm: 3,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 0,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "SPHERICAL_DIFFUSION_FLAME",
          ignited: true,
          limitingO2Pct: 19.98,
          oxygenMarginPct: 1.02,
          flameSpreadRateMmS: 0.03,
          effectiveThicknessMm: 3.0,
          equivalentGravityG: 0,
        },
      },
      {
        id: "flex-drawdown-1mm-0",
        label: "1mm PMMA @ 0 cm/s (Still Air)",
        summary: "Thinner sheet stays slightly hotter in still 0g",
        params: {
          material: "PMMA_SLAB_3MM",
          geometryType: "Slab",
          rawThicknessMm: 1,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 0,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "SPHERICAL_DIFFUSION_FLAME",
          ignited: true,
          limitingO2Pct: 19.63,
          oxygenMarginPct: 1.37,
          flameSpreadRateMmS: 0.07,
          effectiveThicknessMm: 1.0,
          equivalentGravityG: 0,
        },
      },
    ],
  },
  {
    id: "bass-ii-pmma-rod",
    missionTag: "ISS BASS-II • Solid Fuel Curvature Breakthrough",
    title: 'BASS-II 3/8" (9.525 mm) Black PMMA Rod at 16.2% O2, 1.5 cm/s',
    narration:
      "Flat slab models famously falsely quench 3/8-inch PMMA rods in sub-17% O2 microgravity because they treat rod diameter as planar slab thickness. Switch between Flat Slab [1.0x] and Cylindrical Rod [D/4] to see radial heat focusing flip the false negative to sustained ignition.",
    whatToWatch: [
      "Under Flat Slab [1.0x], tau_eff = 9.525 mm pushes LOI to 16.40% -> false NO_IGNITION_QUENCHED (-0.20% margin).",
      "Under Cylindrical Rod [D/4], Biot V/A scaling shrinks tau_eff to 2.381 mm and drops LOI to 14.18% (+2.02% margin).",
      "Curved-surface factor (0.55x) softens low-flow CO2 blanketing penalty at 1.5 cm/s.",
    ],
    observedOutcome:
      'NASA BASS-II ISS Microgravity Science Glovebox flight runs burned 3/8" (9.525 mm) cylindrical black PMMA rods continuously near 16.2% O2 and 1.5 cm/s.',
    honestCaveat:
      "Uses steady-state Biot D/4 geometry scaling and curved-PMMA base LOI (13.1%) rather than finite-element hot-wire igniter thermal preheat transients.",
    defaultVariantId: "bass-rod-d4",
    variants: [
      {
        id: "bass-rod-d4",
        label: "Cylindrical Rod [D/4] (Flight Truth)",
        summary: "Biot radial focusing yields sustained burn (+2.02% margin)",
        params: {
          material: "PMMA_SLAB_3MM",
          geometryType: "Cylinder/Rod",
          rawThicknessMm: 9.525,
          o2Pct: 16.2,
          pressurePsi: 14.7,
          airflowCmS: 1.5,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "SPHERICAL_DIFFUSION_FLAME",
          ignited: true,
          limitingO2Pct: 14.18,
          oxygenMarginPct: 2.02,
          flameSpreadRateMmS: 0.12,
          effectiveThicknessMm: 2.381,
          equivalentGravityG: 0,
        },
      },
      {
        id: "bass-slab-legacy",
        label: "Flat Slab [1.0x] (Legacy False Negative)",
        summary: "Unscaled 9.525 mm armor slab over-penalizes heat sink",
        params: {
          material: "PMMA_SLAB_3MM",
          geometryType: "Slab",
          rawThicknessMm: 9.525,
          o2Pct: 16.2,
          pressurePsi: 14.7,
          airflowCmS: 1.5,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "NO_IGNITION_QUENCHED",
          ignited: false,
          limitingO2Pct: 16.4,
          oxygenMarginPct: -0.2,
          flameSpreadRateMmS: 0,
          effectiveThicknessMm: 9.525,
          equivalentGravityG: 0,
        },
      },
    ],
  },
  {
    id: "saffire-iii-sibal",
    missionTag: "Cygnus OA-7 / Saffire-III Large-Scale Test",
    title: "Saffire-III Spacecraft Fire Experiment (SIBAL Cloth, 30 cm/s)",
    narration:
      "Inside an uncrewed Cygnus cargo vehicle, NASA burned a 0.4 m x 1.0 m cotton-fiberglass (SIBAL) textile banner at Earth-normoxic 21% O2 under high 30 cm/s airflow to study large-scale spacecraft duct fires.",
    whatToWatch: [
      "Note effectiveThicknessMm drops to 0.297 mm under Fabric [0.85x] curvature weighting.",
      "High 30 cm/s airflow elevates LOI slightly via convective blowoff tension (16.94% vs 14.65% at 5 cm/s), yet 21% O2 still drives a fast 10.13 mm/s spread rate.",
      "Look at the 3D chamber's wind-sheared elongated plume extending downwind.",
    ],
    observedOutcome:
      "Saffire-III produced rapid concurrent-flow flame spread across the meter-scale SIBAL cloth bay in 14.7 psi air at 21% O2.",
    honestCaveat:
      'APULA does not include a sample-length/width scaling law or opposing-vs-concurrent flow direction toggle, and does not auto-parse Saffire\'s ".33 cm" free-text thickness unit.',
    defaultVariantId: "saffire-3-sibal-30",
    variants: [
      {
        id: "saffire-3-sibal-30",
        label: "Saffire-III SIBAL @ 30 cm/s",
        summary: "Fast orbital duct-flow textile burn (10.13 mm/s)",
        params: {
          material: "SIBAL_FABRIC",
          geometryType: "Fabric",
          rawThicknessMm: 0.35,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 30,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "ELONGATED_MICROGRAVITY_FLAME",
          ignited: true,
          limitingO2Pct: 16.94,
          oxygenMarginPct: 4.06,
          flameSpreadRateMmS: 10.13,
          effectiveThicknessMm: 0.297,
          equivalentGravityG: 0,
        },
      },
    ],
  },
  {
    id: "artemis-eva-campout",
    missionTag: "ISS Normoxic vs. Artemis Exploration Atmosphere",
    title: "EVA Pre-Breathe Campout Hazard (26.5% vs. 30% O2 @ 10.2 psi)",
    narration:
      "Before spacewalks, exploration habitats lower total pressure (14.7 -> 10.2 or 8.2 psi) and enrich O2 (26.5% to 30%+) to cut nitrogen decompression risk. Toggle between ISS baseline and 26.5% vs 30% O2 Exploration regimes to quantify the explosive spread jump on SIBAL textiles.",
    whatToWatch: [
      "Pressure drop raises % LOI slightly (14.65% at 14.7 psi -> 16.05% at 10.2 psi via (P/14.7)^-0.25).",
      "Even with higher LOI%, bumping cabin O2 from 21% -> 26.5% jumps SIBAL spread rate from 6.47 to 10.64 mm/s (+64%).",
      "At 30% O2 / 10.2 psi, margin hits +13.95% and regime crosses into CRITICAL_ACCELERATED_BURN (14.20 mm/s).",
    ],
    observedOutcome:
      "NASA EVA exploration atmosphere standards (34% O2 / 8.2 psi & 26.5–30% O2 / 10.2 psi) drastically increase flame spread rate and ignition hazard over ISS sea-level air.",
    honestCaveat:
      "Combustion model captures Damkohler pressure LOI shift and O2-driven spread acceleration accurately, while physiological N2 washout decompression schedules are outside scope.",
    defaultVariantId: "eva-campout-30",
    variants: [
      {
        id: "eva-iss-baseline",
        label: "ISS Normoxic (14.7 psi, 21% O2)",
        summary: "Baseline cabin atmosphere",
        params: {
          material: "SIBAL_FABRIC",
          geometryType: "Fabric",
          rawThicknessMm: 0.35,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 5,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "ELONGATED_MICROGRAVITY_FLAME",
          ignited: true,
          limitingO2Pct: 14.65,
          oxygenMarginPct: 6.35,
          flameSpreadRateMmS: 6.47,
          effectiveThicknessMm: 0.297,
          equivalentGravityG: 0,
        },
      },
      {
        id: "eva-campout-265",
        label: "Exploration 26.5% O2 (10.2 psi)",
        summary: "Modern Exploration Atmosphere target (10.64 mm/s)",
        params: {
          material: "SIBAL_FABRIC",
          geometryType: "Fabric",
          rawThicknessMm: 0.35,
          o2Pct: 26.5,
          pressurePsi: 10.2,
          airflowCmS: 5,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "ELONGATED_MICROGRAVITY_FLAME",
          ignited: true,
          limitingO2Pct: 16.05,
          oxygenMarginPct: 10.45,
          flameSpreadRateMmS: 10.64,
          effectiveThicknessMm: 0.297,
          equivalentGravityG: 0,
        },
      },
      {
        id: "eva-campout-30",
        label: "Legacy Campout 30.0% O2 (10.2 psi)",
        summary: "High-risk accelerated textile burn (14.20 mm/s)",
        params: {
          material: "SIBAL_FABRIC",
          geometryType: "Fabric",
          rawThicknessMm: 0.35,
          o2Pct: 30,
          pressurePsi: 10.2,
          airflowCmS: 5,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "CRITICAL_ACCELERATED_BURN",
          ignited: true,
          limitingO2Pct: 16.05,
          oxygenMarginPct: 13.95,
          flameSpreadRateMmS: 14.2,
          effectiveThicknessMm: 0.297,
          equivalentGravityG: 0,
        },
      },
    ],
  },
  {
    id: "acme-efield-lunar",
    missionTag: "ISS ACME E-FIELD vs. Lunar 0.16g",
    title: "Electrostatic Ion-Wind Gravity Equivalence (1100 V/cm = 0.16g)",
    narration:
      "Electric fields exert Coulomb forces on positive chemi-ions inside a flame, creating an ionic wind that sweeps fresh oxygen inward in 0g much like lunar buoyancy. Compare 0g still air against 0g + 1100 V/cm and real 0.16g Lunar gravity.",
    whatToWatch: [
      "0g still air produces a slow spherical flame (LOI 18.90%, 1.00 mm/s).",
      "Switching on 1100 V/cm ion wind generates 8.80 cm/s draft (g_eq = 0.160g), slashing LOI to 14.10% and multiplying spread rate 16x to 16.45 mm/s.",
      "Switching to true 0.16g Lunar gravity with 0 V/cm yields the exact same convective draft and fire hazard.",
    ],
    observedOutcome:
      "ISS ACME Electric-Field Effects on Laminar Diffusion Flames demonstrated ionic wind deformation and flame anchoring in zero gravity.",
    honestCaveat:
      "0.16g = 1100 V/cm equality holds by calibrated linear ion-drift construction (v_ion = 0.008 * E matched to 22 * sqrt(0.16)); ACME burned gaseous jet fuels rather than thin solid PMMA film.",
    defaultVariantId: "acme-efield-1100",
    variants: [
      {
        id: "acme-still-0g",
        label: "0g Still Air (0 V/cm)",
        summary: "Baseline diffusive sphere (1.00 mm/s)",
        params: {
          material: "PMMA_FILM_0.1MM",
          geometryType: "Film/Sheet",
          rawThicknessMm: 0.1,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 0,
          gravityG: 0,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "SPHERICAL_DIFFUSION_FLAME",
          ignited: true,
          limitingO2Pct: 18.9,
          oxygenMarginPct: 2.1,
          flameSpreadRateMmS: 1.0,
          effectiveThicknessMm: 0.1,
          equivalentGravityG: 0,
        },
      },
      {
        id: "acme-efield-1100",
        label: "0g + 1100 V/cm E-Field",
        summary: "Ion wind mimics 0.16g Lunar buoyancy (16.45 mm/s)",
        params: {
          material: "PMMA_FILM_0.1MM",
          geometryType: "Film/Sheet",
          rawThicknessMm: 0.1,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 0,
          gravityG: 0,
          electricFieldVoltsCm: 1100,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "ELONGATED_MICROGRAVITY_FLAME",
          ignited: true,
          limitingO2Pct: 14.1,
          oxygenMarginPct: 6.9,
          flameSpreadRateMmS: 16.45,
          effectiveThicknessMm: 0.1,
          equivalentGravityG: 0.16,
        },
      },
      {
        id: "acme-lunar-016g",
        label: "0.16g Lunar (0 V/cm)",
        summary: "Real Lunar gravity matches 1100 V/cm draft",
        params: {
          material: "PMMA_FILM_0.1MM",
          geometryType: "Film/Sheet",
          rawThicknessMm: 0.1,
          o2Pct: 21,
          pressurePsi: 14.7,
          airflowCmS: 0,
          gravityG: 0.16,
          electricFieldVoltsCm: 0,
          co2DilutionPct: 0,
        },
        expected: {
          regime: "ELONGATED_MICROGRAVITY_FLAME",
          ignited: true,
          limitingO2Pct: 14.1,
          oxygenMarginPct: 6.9,
          flameSpreadRateMmS: 16.45,
          effectiveThicknessMm: 0.1,
          equivalentGravityG: 0.16,
        },
      },
    ],
  },
];

// Check whether live simulator state currently matches a scenario variant 💦
export function doesLiveResultMatchVariant(
  live: CombustionSimulationResult,
  variant: ScenarioVariant
): boolean {
  const p = variant.params;
  const close = (a: number, b: number) => Math.abs(a - b) < 0.02;
  const targetGeo = p.geometryType ?? live.geometryType;
  const targetThk = p.rawThicknessMm ?? live.rawThicknessMm;
  return (
    live.material === p.material &&
    live.geometryType === targetGeo &&
    close(live.rawThicknessMm, targetThk) &&
    close(live.o2Pct, p.o2Pct) &&
    close(live.pressurePsi, p.pressurePsi) &&
    close(live.airflowCmS, p.airflowCmS) &&
    close(live.gravityG, p.gravityG) &&
    Math.abs(live.electricFieldVoltsCm - p.electricFieldVoltsCm) < 1 &&
    close(live.co2DilutionPct, p.co2DilutionPct)
  );
}
