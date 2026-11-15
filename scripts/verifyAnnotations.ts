import {
  GEOMETRY_THERMAL_SCALE,
  MATERIAL_PHYSICS,
  simulateCombustionPhysics,
  type GeometryType,
  type SimulatorMaterial,
} from "../src/lib/combustionPhysicsEngine.ts";
import {
  ALL_METRIC_KEYS,
  buildMetricAnnotation,
} from "../src/lib/metricAnnotations.ts";

// Sweep cross-product scenarios to prove annotation equations match live outputs everywhere 🥷
const MATERIALS = Object.keys(MATERIAL_PHYSICS) as SimulatorMaterial[];
const GEOMETRIES: GeometryType[] = [
  "Slab",
  "Cylinder/Rod",
  "Sphere",
  "Fabric",
  "Film/Sheet",
];
const GRAVITIES = [0, 0.16, 1.0];
const PRESSURES = [8.2, 10.2, 14.7];
const AIRFLOWS = [0, 1.5, 5, 18];
const O2_LEVELS = [16.2, 21, 30, 50];
const E_FIELDS = [0, 1100];

let gridCount = 0;
let metricCheckCount = 0;
const failures: string[] = [];

for (const material of MATERIALS) {
  for (const geometryType of GEOMETRIES) {
    for (const gravityG of GRAVITIES) {
      for (const pressurePsi of PRESSURES) {
        for (const airflowCmS of AIRFLOWS) {
          for (const o2Pct of O2_LEVELS) {
            for (const electricFieldVoltsCm of E_FIELDS) {
              if (!(geometryType in GEOMETRY_THERMAL_SCALE)) continue;
              gridCount++;
              const params = {
                material,
                geometryType,
                o2Pct,
                pressurePsi,
                airflowCmS,
                gravityG,
                electricFieldVoltsCm,
                co2DilutionPct: o2Pct === 30 ? 2 : 0,
                rawThicknessMm:
                  geometryType === "Cylinder/Rod" ? 9.525 : undefined,
              };
              const sim = simulateCombustionPhysics(params);

              for (const metricKey of ALL_METRIC_KEYS) {
                metricCheckCount++;
                const annotation = buildMetricAnnotation(metricKey, sim, params);
                if (!annotation.verification.verified) {
                  failures.push(
                    `Mismatch ${material}/${geometryType} g=${gravityG} P=${pressurePsi} v=${airflowCmS} O2=${o2Pct} metric=${metricKey} rebuilt=${annotation.verification.rebuiltValue} reported=${annotation.verification.reportedValue}`
                  );
                }
                if (!annotation.substitutedEquation.trim()) {
                  failures.push(`Empty substituted equation for ${metricKey}`);
                }
              }
            }
          }
        }
      }
    }
  }
}

console.log(
  `[verifyAnnotations] Swept ${gridCount} simulation grid points (${metricCheckCount} metric equation checks).`
);

if (failures.length > 0) {
  console.error(`[FAIL] ${failures.length} annotation verification failures:`);
  console.error(failures.slice(0, 10).join("\n"));
  process.exit(1);
}

console.log(
  `[PASS] 100.00% agreement (${metricCheckCount}/${metricCheckCount} equation checks within tolerance).`
);
