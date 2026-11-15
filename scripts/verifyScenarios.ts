import {
  simulateCombustionPhysics,
} from "../src/lib/combustionPhysicsEngine.ts";
import {
  HISTORICAL_SCENARIOS,
} from "../src/data/historicalScenarios.ts";

// Cross-check every variant in all 5 scenarios against frozen physics engine outputs 🥷
let variantCount = 0;
const failures: string[] = [];

for (const scenario of HISTORICAL_SCENARIOS) {
  for (const variant of scenario.variants) {
    variantCount++;
    const sim = simulateCombustionPhysics(variant.params);
    const ignited = sim.oxygenMarginPct > 0;
    const checks: [string, string | number | boolean, string | number | boolean][] = [
      ["regime", sim.regime, variant.expected.regime],
      ["ignited", ignited, variant.expected.ignited],
      ["limitingO2Pct", sim.limitingO2Pct, variant.expected.limitingO2Pct],
      ["oxygenMarginPct", sim.oxygenMarginPct, variant.expected.oxygenMarginPct],
      ["flameSpreadRateMmS", sim.flameSpreadRateMmS, variant.expected.flameSpreadRateMmS],
      ["effectiveThicknessMm", sim.effectiveThicknessMm, variant.expected.effectiveThicknessMm],
      [
        "equivalentGravityG",
        Number(sim.equivalentGravityG.toFixed(3)),
        variant.expected.equivalentGravityG,
      ],
    ];

    for (const [field, actual, expected] of checks) {
      if (actual !== expected) {
        failures.push(
          `${scenario.id}/${variant.id} ${field}: actual=${actual}, expected=${expected}`
        );
      }
    }
  }
}

console.log(
  `[verifyScenarios] Verified ${HISTORICAL_SCENARIOS.length} historical missions (${variantCount} variants).`
);

if (failures.length > 0) {
  console.error(`[FAIL] ${failures.length} scenario parity mismatches:`);
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`[PASS] 100% parity across all ${variantCount} scenario variants.`);
