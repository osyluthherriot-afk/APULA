
import { readFileSync } from "node:fs";

import {
  loadMasterPsiDataset,
  mapRunToSimulatorMaterial,
  simulateCombustionPhysics,
  type NormalizedRun,
} from "../src/lib/combustionPhysicsEngine.ts";

import { MASTER_PSI_CSV } from "../datum/masterPsiData.ts";

type AuditedIgnition = true | false | null;

function auditObservedIgnition(
  run: NormalizedRun
): AuditedIgnition {
  const status = (run.ignitionStatus ?? "").trim().toLowerCase();
  const note = (run.airDisplay ?? "").trim().toLowerCase();

  // Explicit evidence that ignition did not occur
  if (/no\s*ign(?:ition)?\s+at\s+any\s+flow/i.test(note) ||
    /no\s+ignition/i.test(note)
  ) {return false;}

  if (/would\s*not\s*stay\s*lit/i.test(note)) {return null;}

  // Use normalized status only when the notes do not contradict/qualify it
  if (status === "ignited") {return true;}

  if (status === "not ignited" || status === "no ignition") {return false;}

  return null;
}

const mode = process.argv[2];

if (mode === "export") {
  const runs = loadMasterPsiDataset(MASTER_PSI_CSV);
  process.stdout.write(JSON.stringify(runs));
}

else if (mode === "predict") {
  const runs = JSON.parse(
    readFileSync(0, "utf8")
  ) as NormalizedRun[];

  const results = runs.map((run) => {
    const sim = simulateCombustionPhysics({
      o2Pct: run.initialO2Pct ?? 21,
      pressurePsi: run.pressurePsi ?? 14.7,
      airflowCmS: run.initialAirflowCmS ?? 5,
      gravityG: run.gravityG ?? 0,
      electricFieldVoltsCm: 0,
      co2DilutionPct: run.initialCO2Pct ?? 0,
      material: mapRunToSimulatorMaterial(run),
    });

    const observedIgnition = auditObservedIgnition(run);

    return {
      experimentId: run.experimentId,
      testNumber: run.testNumber,
      observedIgnition, // audited experimental outcome
      sourceIgnitionStatus: run.ignitionStatus, // original source label retained
      predictedIgnition: sim.oxygenMarginPct > 0, // independent of observed outcome
      oxygenMarginPct: sim.oxygenMarginPct,
      predictedFlameSpreadMmS: sim.flameSpreadRateMmS,
      observedFlameSpreadMmS: run.flameSpreadMmS,
    };
  });

  process.stdout.write(JSON.stringify(results));
}

else {throw new Error("Use mode: export/predict");}