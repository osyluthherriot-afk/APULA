# Project APULA — Engine v2 (`combustionPhysicsEngine.ts`)
## wan

The old engine was treating BASS-II cylindrical PMMA rods — `1/4"`, `3/8"`, `1/2"` — like flat slabs of the same thickness Slapping log2 heat-sink penalties on them basically treated as if they were a flat sheet so naturally this was producing False Negatives constantly

So there's now a ✨ **Biot Curvature Lookup Table** ✨💦 (`GEOMETRY_THERMAL_SCALE`, `L438–L457`) that maps geometry to its actual volume-to-surface-area factor so `effectiveThickness` reflects what the material *is*,:

- Flat stuff (Film, Sheet, Slab): `1.0`
- Fabric/Ribbon: `0.85`
- Cylinder/Rod/Candle: `0.25`
- Sphere/Droplet/Gas Burner: `0.167`

`effectiveThicknessMm` is now clamped between `0.05` and `10` and feeds into both the `thicknessCorrection` term (`0.22 * log2(effectiveThicknessMm / 0.35)`) and the flame spread rate denominator (`effectiveThicknessMm ** 0.65`). PMMA geometry with a scale ≤ 0.25 gets the radial heat-focusing baseline LOI of 13.1% applied. Because it's a rod. 👅👅👅 

The material routing rules (`RUN_TO_SIMULATOR_MATERIAL_RULES`, `L725–L740`) were also sending curved PMMA samples to `PMMA_SLAB_3MM` instead of `PMMA_FILM_0.1MM`. That's also fixed now. The airflow parser (`extractAirflowTrajectory`, `L772–L825`) was choking on the BASS-II fan display numbers (`49 44 42 ...`) when perfectly good parenthesized `cm/s` values were sitting right there 
## sorry kira

---

## 2. We Now Track Whether We Made The Numbers Up Or Not

Every parsed NASA PSI row and every simulated output metric has explicit data label attached to it. There are four tiers and we're not pretending otherwise:

Overall run quality rolls up to `FULLY_MEASURED`, `PARTIALLY_INFERRED`, or `MODEL_ESTIMATED`.

**Output-level** (`METRIC_PROVENANCE_LABELS`, `L459–L495`) is tagged on `CombustionSimulationResult.metricProvenance`:
- Empirical Flight Pins: `[MEASURED — ISS FLIGHT TELEMETRY]` — the good stuff
- LOI, Spread Rate, U-Curve Boundaries: `[ESTIMATED — SEMI-EMPIRICAL OLSON/T'IEN + DAMKÖHLER FIT]`
- Lunar and Mars gravity boundaries: `[ESTIMATED — FROUDE √g INTERPOLATION]`
- ACME E-Field equivalent gravity: `[ESTIMATED — LINEAR ION-DRIFT PROXY]`
- 3D Plume Geometry, Adiabatic Flame Temp: `[ESTIMATED — REDUCED-ORDER ANALYTICAL MODEL]`
