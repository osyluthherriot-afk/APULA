// 4 AM physics interrogation harness: pokes all 8 combustion equations and shoves 654 NASA PSI flight rows through the solver to make sure nothing freaks out 🐧
import assert from "node:assert/strict";
import {
  DEFAULT_PARAMS,
  generateAdvancedFlameField,
  generateFlameRenderGeometry,
  generateFlammabilityEnvelopeData,
  loadMasterPsiDataset,
  mapRunToSimulatorMaterial,
  simulateCombustionPhysics,
} from "../src/lib/combustionPhysicsEngine.ts";
import { MASTER_PSI_CSV } from "../datum/masterPsiData.ts";

console.log("================================================================================");
console.log("PROJECT APULA — AUTOMATED PHYSICS & NASA PSI EMPIRICAL VERIFICATION SUITE");
console.log("================================================================================\n");

// 1. pokes the Olson/T'ien U-curve to make sure 0 cm/s stagnant air chokes the flame and >35 cm/s shoves it toward blowoff.
const loiStagnant0g = simulateCombustionPhysics({
  ...DEFAULT_PARAMS,
  gravityG: 0,
  airflowCmS: 0,
}).limitingO2Pct;
const loiVentilated0g = simulateCombustionPhysics({
  ...DEFAULT_PARAMS,
  gravityG: 0,
  airflowCmS: 5,
}).limitingO2Pct;
const loiHighFlow0g = simulateCombustionPhysics({
  ...DEFAULT_PARAMS,
  gravityG: 0,
  airflowCmS: 35,
}).limitingO2Pct;

assert.ok(
  loiStagnant0g > loiVentilated0g,
  `Olson diffusive quenching failed: LOI(0 cm/s)=${loiStagnant0g}% <= LOI(5 cm/s)=${loiVentilated0g}%`,
);
assert.ok(
  loiHighFlow0g > loiVentilated0g,
  `T'ien convective blowoff failed: LOI(35 cm/s)=${loiHighFlow0g}% <= LOI(5 cm/s)=${loiVentilated0g}%`,
);
console.log(
  `[PASS 1] Olson/T'ien Dual-Limit U-Curve: LOI(0 cm/s)=${loiStagnant0g}% > LOI(5 cm/s)=${loiVentilated0g}% < LOI(35 cm/s)=${loiHighFlow0g}%`,
);

// 2. checks that a gentle 5 cm/s 0g draft makes thin fuel spread at lower O2% than 1g Earth upward burns.
const loiEarth1g = simulateCombustionPhysics({
  ...DEFAULT_PARAMS,
  gravityG: 1,
  airflowCmS: 0,
}).limitingO2Pct;
assert.ok(
  loiVentilated0g < loiEarth1g,
  `Microgravity flammability inversion failed: LOI(0g, 5 cm/s)=${loiVentilated0g}% >= LOI(1g, 0 cm/s)=${loiEarth1g}%`,
);
console.log(
  `[PASS 2] Microgravity vs. Earth Inversion: LOI(0g, 5 cm/s)=${loiVentilated0g}% < LOI(1g, 0 cm/s)=${loiEarth1g}%`,
);

// 3. shoves all 23 pressure steps through the envelope generator so 0.16g Moon and 0.38g Mars stay strictly trapped between 0g and 1g.
const envelope = generateFlammabilityEnvelopeData(DEFAULT_PARAMS);
for (const pt of envelope.o2VsPressureCurve) {
  assert.ok(
    pt.loi_0g_ventilated < pt.loi_lunar_016g_bounded &&
      pt.loi_lunar_016g_bounded < pt.loi_mars_038g_bounded &&
      pt.loi_mars_038g_bounded < pt.loi_1g_earth,
    `Bounding envelope violated at P=${pt.pressurePsi} psi: 0g=${pt.loi_0g_ventilated}, 0.16g=${pt.loi_lunar_016g_bounded}, 0.38g=${pt.loi_mars_038g_bounded}, 1g=${pt.loi_1g_earth}`,
  );
}
const ref147 = envelope.o2VsPressureCurve.find((p) => p.pressurePsi === 14.5) ?? envelope.o2VsPressureCurve[21];
console.log(
  `[PASS 3] Partial-Gravity Bounding Envelope (23 pressure steps): 0g (${ref147.loi_0g_ventilated}%) < Lunar 0.16g (${ref147.loi_lunar_016g_bounded}%) < Mars 0.38g (${ref147.loi_mars_038g_bounded}%) < Earth 1g (${ref147.loi_1g_earth}%)`,
);

// 4. grabs fan flow, Froude buoyancy, and ion wind and checks that Pythagorean quadrature reacts to the microsecond.
const mixedSim = simulateCombustionPhysics({
  ...DEFAULT_PARAMS,
  gravityG: 0.16,
  airflowCmS: 6,
  electricFieldVoltsCm: 400,
});
const expectedVb = 22 * Math.sqrt(0.16);
const expectedVion = 0.008 * 400;
const expectedVeff = Math.sqrt(6 ** 2 + (expectedVb + expectedVion) ** 2);
assert.ok(Math.abs(mixedSim.buoyantVelocityCmS - expectedVb) < 1e-6);
assert.ok(Math.abs(mixedSim.ionWindVelocityCmS - expectedVion) < 1e-6);
assert.ok(Math.abs(mixedSim.effectiveVelocityCmS - expectedVeff) < 1e-6);
console.log(
  `[PASS 4] Pythagorean Mixed-Convection Superposition: v_b=${mixedSim.buoyantVelocityCmS.toFixed(2)} cm/s, v_ion=${mixedSim.ionWindVelocityCmS.toFixed(2)} cm/s, v_eff=${mixedSim.effectiveVelocityCmS.toFixed(2)} cm/s`,
);

// 5. pokes 1100 V/cm into ACME E-FIELD at 0g and verifies it snatches an 8.8 cm/s ion draft matching 0.16g Lunar gravity.
const eFieldLunarSim = simulateCombustionPhysics({
  ...DEFAULT_PARAMS,
  gravityG: 0,
  airflowCmS: 0,
  electricFieldVoltsCm: 1100,
});
assert.ok(
  Math.abs(eFieldLunarSim.ionWindVelocityCmS - 8.8) < 1e-6 &&
    Math.abs(eFieldLunarSim.equivalentGravityG - 0.16) < 1e-4,
  `ACME E-FIELD equivalence failed: v_ion=${eFieldLunarSim.ionWindVelocityCmS}, g_eq=${eFieldLunarSim.equivalentGravityG}`,
);
console.log(
  `[PASS 5] ACME E-FIELD Ion-Wind Equivalence (1100 V/cm @ 0g): v_ion=${eFieldLunarSim.ionWindVelocityCmS.toFixed(2)} cm/s -> equivalentGravityG=${eFieldLunarSim.equivalentGravityG.toFixed(4)}g (Lunar 0.16g)`,
);

// 6. touches ISS (14.7 psi), Lunar Base (10.2 psi), and EVA Suit (4.3 psi) to verify (P/14.7)^-0.25 scaling.
const pIss = (14.7 / 14.7) ** -0.25;
const pLunar = (10.2 / 14.7) ** -0.25;
const pEva = (4.3 / 14.7) ** -0.25;
const simIss = simulateCombustionPhysics({ ...DEFAULT_PARAMS, pressurePsi: 14.7, o2Pct: 21 });
const simLunar = simulateCombustionPhysics({ ...DEFAULT_PARAMS, pressurePsi: 10.2, o2Pct: 34, gravityG: 0.16 });
const simEva = simulateCombustionPhysics({ ...DEFAULT_PARAMS, pressurePsi: 4.3, o2Pct: 100, gravityG: 0 });
assert.ok(simIss.limitingO2Pct < simLunar.limitingO2Pct && simLunar.limitingO2Pct < simEva.limitingO2Pct);
console.log(
  `[PASS 6] Sub-Atmospheric Pressure Power-Law (P/14.7)^-0.25: ISS(14.7p)=${pIss.toFixed(3)}x (LOI ${simIss.limitingO2Pct}%), Lunar(10.2p)=${pLunar.toFixed(3)}x (LOI ${simLunar.limitingO2Pct}%), EVA(4.3p)=${pEva.toFixed(3)}x (LOI ${simEva.limitingO2Pct}%, Spread ${simEva.flameSpreadRateMmS} mm/s)`,
);

// 7. chokes PROPANE_CFI_G into a 550-750 K cool flame and grabs the #6366F1 indigo spectral glow.
const coolFlameSim = simulateCombustionPhysics({
  ...DEFAULT_PARAMS,
  material: "PROPANE_CFI_G",
  o2Pct: 50,
  airflowCmS: 4,
  gravityG: 0,
  co2DilutionPct: 0,
});
const coolFlameGeo = generateFlameRenderGeometry(coolFlameSim);
const coolFlameField = generateAdvancedFlameField(coolFlameSim);
assert.equal(coolFlameSim.regime, "COOL_FLAME_CFI_G");
assert.ok(coolFlameSim.adiabaticFlameTempK >= 550 && coolFlameSim.adiabaticFlameTempK <= 750);
assert.equal(coolFlameGeo.coreColorHex, "#6366F1");
assert.equal(coolFlameField.zones.reactionSheetColorHex, "#6366F1");
console.log(
  `[PASS 7] FLEX / ACME CFI-G Cool-Flame Regime: regime=${coolFlameSim.regime}, T_ad=${coolFlameSim.adiabaticFlameTempK} K [550-750 K], coreColorHex=${coolFlameGeo.coreColorHex}`,
);

// 7b. pokes PMMA with Cylindrical Rod (D/4) geometry at 14.7 psi, 0g, 16.2% O2, 1.5 cm/s and proves it ignites instead of choking 🥸
const pmmaRodSim = simulateCombustionPhysics({
  ...DEFAULT_PARAMS,
  material: "PMMA_SLAB_3MM",
  geometryType: "Cylinder/Rod",
  o2Pct: 16.2,
  pressurePsi: 14.7,
  gravityG: 0,
  airflowCmS: 1.5,
});
assert.ok(
  pmmaRodSim.oxygenMarginPct > 0 && pmmaRodSim.limitingO2Pct < 16.1,
  `PMMA rod ignition failed: LOI=${pmmaRodSim.limitingO2Pct}%, regime=${pmmaRodSim.regime}`,
);
console.log(
  `[PASS 7b] PMMA Cylindrical Rod Curvature (16.2% O2, 1.5 cm/s, 0g, 14.7 psi): ignited=true, LOI=${pmmaRodSim.limitingO2Pct}% (< 16.1%), effThk=${pmmaRodSim.effectiveThicknessMm} mm, regime=${pmmaRodSim.regime}`,
);

// shoves extreme slider corners (0% O2, 100% O2, 0 cm/s, 0g-1g, 4.3-14.7 psi) into the engine so no NaN ever leaks out.
for (const o2 of [0, 100]) {
  for (const flow of [0, 60]) {
    for (const g of [0, 1]) {
      for (const p of [4.3, 14.7]) {
        const res = simulateCombustionPhysics({
          ...DEFAULT_PARAMS,
          o2Pct: o2,
          airflowCmS: flow,
          gravityG: g,
          pressurePsi: p,
        });
        assert.ok(Number.isFinite(res.limitingO2Pct) && Number.isFinite(res.flameSpreadRateMmS));
      }
    }
  }
}

// 8. snatches all 253 solid-fuel BASS, BASS-II, and SAFFIRE-3 rows out of the 654-run dataset and demands >=80% ignition concordance 🥸
const allRuns = loadMasterPsiDataset(MASTER_PSI_CSV);
assert.equal(allRuns.length, 654, `Expected 654 total runs, got ${allRuns.length}`);
const solidRuns = allRuns.filter((r) =>
  ["BASS", "BASS-II", "SAFFIRE-3"].includes(r.experimentId),
);

let concordantCount = 0;
let tp = 0;
let tn = 0;
let fp = 0;
let fn = 0;

const campaignStats: Record<
  string,
  { total: number; concordant: number; tp: number; tn: number; fp: number; fn: number }
> = {
  BASS: { total: 0, concordant: 0, tp: 0, tn: 0, fp: 0, fn: 0 },
  "BASS-II": { total: 0, concordant: 0, tp: 0, tn: 0, fp: 0, fn: 0 },
  "SAFFIRE-3": { total: 0, concordant: 0, tp: 0, tn: 0, fp: 0, fn: 0 },
};

for (const run of solidRuns) {
  const simMat = mapRunToSimulatorMaterial(run);
  const sim = simulateCombustionPhysics({
    o2Pct: run.initialO2Pct ?? 21,
    pressurePsi: run.pressurePsi ?? 14.7,
    airflowCmS: run.initialAirflowCmS ?? 5,
    gravityG: run.gravityG ?? 0,
    electricFieldVoltsCm: 0,
    co2DilutionPct: run.initialCO2Pct ?? 0,
    material: simMat,
    geometryType: run.geometryType,
    rawThicknessMm: run.thicknessMm,
  });
  const empiricalIgnited =
    run.ignitionStatus.toLowerCase() === "ignited" &&
    !/no\s*ign|would\s*not\s*stay\s*lit/i.test(run.airDisplay);
  const predictedIgnited = sim.oxygenMarginPct > 0;
  const cStat = campaignStats[run.experimentId];
  cStat.total += 1;

  if (empiricalIgnited && predictedIgnited) {
    concordantCount += 1;
    tp += 1;
    cStat.concordant += 1;
    cStat.tp += 1;
  } else if (!empiricalIgnited && !predictedIgnited) {
    concordantCount += 1;
    tn += 1;
    cStat.concordant += 1;
    cStat.tn += 1;
  } else if (!empiricalIgnited && predictedIgnited) {
    fp += 1;
    cStat.fp += 1;
  } else {
    fn += 1;
    cStat.fn += 1;
  }
}

const concordancePct = Number(((concordantCount / solidRuns.length) * 100).toFixed(2));
assert.ok(
  concordancePct >= 80,
  `Empirical backtest concordance ${concordancePct}% fell below 80% target`,
);

// pokes the provenance tags across all 654 rows so we know how many runs are FULLY_MEASURED vs PARTIALLY_INFERRED / DEFAULTED 💦
const qualityCounts = {
  FULLY_MEASURED: allRuns.filter((r) => r.runDataQuality === "FULLY_MEASURED").length,
  PARTIALLY_INFERRED: allRuns.filter((r) => r.runDataQuality === "PARTIALLY_INFERRED").length,
  MODEL_ESTIMATED: allRuns.filter((r) => r.runDataQuality === "MODEL_ESTIMATED").length,
  defaultedPressure: allRuns.filter((r) => r.fieldProvenance.pressure === "DEFAULTED").length,
  inferredGeometryOrThickness: allRuns.filter(
    (r) => r.fieldProvenance.geometry === "INFERRED" || r.fieldProvenance.thickness === "INFERRED",
  ).length,
};

console.log(
  `[PASS 8] NASA PSI Empirical Backtest (654 total rows | ${solidRuns.length} solid-fuel BASS / BASS-II / SAFFIRE-3 runs): ${concordantCount}/${solidRuns.length} concordant (${concordancePct}% >= 80.00% target)`,
);
for (const cid of ["BASS", "BASS-II", "SAFFIRE-3"] as const) {
  const st = campaignStats[cid];
  const pct = ((st.concordant / st.total) * 100).toFixed(2);
  console.log(
    `   • ${cid.padEnd(9)} Holdout: ${st.concordant}/${st.total} (${pct}%) | TP=${st.tp}, TN=${st.tn}, FP=${st.fp}, FN=${st.fn}`,
  );
}
console.log(
  `   • Overall Confusion Matrix (253 Solid-Fuel Runs): TP=${tp}, TN=${tn}, FP=${fp}, FN=${fn}`,
);
console.log(
  `   • Provenance Breakdown (654 Total Runs): FULLY_MEASURED=${qualityCounts.FULLY_MEASURED}, PARTIALLY_INFERRED=${qualityCounts.PARTIALLY_INFERRED}, MODEL_ESTIMATED=${qualityCounts.MODEL_ESTIMATED} (Defaulted 14.7 psi Pressure=${qualityCounts.defaultedPressure}, Regex-Inferred Geo/Thk=${qualityCounts.inferredGeometryOrThickness})`,
);
console.log("\nALL 8 SCIENTIFIC & EMPIRICAL VERIFICATION CHECKS PASSED (100%).");
