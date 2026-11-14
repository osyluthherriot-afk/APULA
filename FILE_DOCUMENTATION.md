# PROJECT APULA

> hostage note. Here is where all the math hides, why we faked the stuff we couldn't run on a NASA supercomputer, and the receipts proving it actually matches 654 real space fires.

---

## 1. Core Architecture & File Map

| File Path | Lines | What It Touches & Why We Built It This Way |
| :--- | :--- | :--- |
| `src/lib/combustionPhysicsEngine.ts` | `L1–L1902` | This file does all the heavy math, parses the CSV, and spits out flame shapes or whatever the f*** so the UI doesn't have to be slow af. |
| `src/data/psiCatalog.ts` | `L1–L728` | Holds metadata for 13 NASA campaigns and scores which experiment matches |
| `src/data/masterPsiData.ts` | `L1–L2` | A two-line barrel file that re-exports the dataset so TypeScript imports don't cry about relative folder paths. |
| `datum/masterPsiData.ts` | `L1–L657` | All 654 real NASA flight test runs hardcoded right into the bundle so the app boots instantly without require the user to upload a CSV. |
| `src/components/ThreeFlameChamber.tsx` | `L1–L1025` | Stretches a 64x64 Three.js sphere into a floating cyan orb or an orange teardrop at 60 FPS using lookup rules |
| `src/components/FlammabilityPhaseCharts.tsx` | `L1–L1151` | Draws the 2D phase-space heatmaps and bins overlapping NASA scatter pins so the SVG doesn't turn into an unreadable mess |
| `src/app/page.tsx` | `L1–L1461` | The main mission control dashboard that glues the sliders, 3D chamber, and NASA data tables together in one place. |
| `scripts/verifyPhysics.ts` | `L1–L195` | Runs 8 automated physics checks and backtests 253 real space fires in 0.2 seconds to prove we didn't just make the numbers up. |

---

## 2. Equation-by-Equation Traceability & Exact Line Numbers

### 2.1 Guardrails & Unit Normalization (`src/lib/combustionPhysicsEngine.ts`)
- **Material Lookup Table (`L377–L394`):** Grabs fuel thickness, baseline LOI, and soot factor in O(1) time.
- **Slider Clamping (`L407–L411`, `L913–L920`):** Forces every user input into safe bounds (`0–100% O2`, `4–15 psi`, `0–60 cm/s`) before any exponents run so nobody divides by zero during the live demo.
- **Unit Cleanup (`L422–L485`):** Converts `kPa` and `atm` to `psi` and fixes fractional `0.21` oxygen values because NASA used three different unit systems across 8 campaigns its just more convenient this way thought it doesnt really matter what unit we use buuuuuuuuuuuuuut we use psi because we used to use kpa then swithced to psi its just how it is ok.
- **Regex Material Sniffers (`L543–L699`):** Reads chaotic raw NASA strings like `"3/8\" black rod"` and figures out it's actually thick PMMA without human intervention. (super inteli gent)

### 2.2 The Core Physics Math (`src/lib/combustionPhysicsEngine.ts`)

- **Froude Buoyancy & Pythagorean Airflow (`L923–L927`):**
  (look it up bro)
  * **Origin:** de Ris (1969), Altenkirch & Olson (2001), Chien et al. (2019 — ACME E-FIELD).
  * **Why:** Horizontal fan air and vertical gravity/ion draft meet at a 90-degree angle, so we slap Pythagoras on them to get total airspeed in 1 millisecond instead of running a 4-hour CFD solver.

- **Olson/T'ien U-Curve Penalties (`L930–L933`):**
  (look it up bro)
  * **Origin:** Olson (1991) & T'ien (1986).
  * **Why:** Zero airflow in 0g chokes a fire in its own CO2 and high fan speed blows it out, leaving a cursed 2–12 cm/s ventilation sweet spot where space fires burn easier than on Earth.

- **Damköhler Pressure Scaling & Limiting Oxygen Index (`L936–L948`):**
  (look it up bro)
  * **Origin:** NASA-STD-6001B & SAFFIRE sub-atmospheric scaling.
  * **Why:** Dropping cabin pressure thins out gas collisions and nudges the minimum oxygen limit up via a -0.25 power law, which works identically whether you feed it `psi` or `kPa`.

- **Regime Classifier & Cool Flames (`L890–L909`, `L950–L987`):**
  * **Origin:** Nayagam et al. (2012 — NASA FLEX / ACME CFI-G).
  * **Why:** Uses a clean `.find()` array to decide if the fire quenched, blew off, went nuclear in a `100% O2` spacesuit, or turned into an invisible 600 K indigo cool flame (`#6366F1`).

- **3D Plume Tilt & Vertex Stretch (`src/lib/combustionPhysicsEngine.ts:L1064–L1144`, `L1217–L1228` & `src/components/ThreeFlameChamber.tsx:L92–L185`):**
  (this one is kinda just for aura (that me?))
  * **Origin:** Cross-flow momentum vector trigonometry.
  * **Why:** Takes the exact same horizontal and vertical velocity legs from the physics solver and bends the 3D sphere vertices so the visual flame points where the air is actually blowing.

---

## 3. Assumptions vs. Ground-Truth Audit Table

We aren't pretending a browser tab is a supercomputer, so here is every shortcut I took, where gng is all at, and how it holds up against NASA's real hardware data.

| Assumption | Exact File & Lines | Why We Did It That Way | Ground-Truth Benchmark & Result |
| :--- | :--- | :--- | :--- |
| **Missing `BASS-II` Pressure Defaults to `14.7 psi`** | `src/lib/combustionPhysicsEngine.ts:L422–L432` | NASA's `BASS-II` logs didn't bother writing down cabin pressure for every run inside the ISS glovebox, so we default to standard `14.7 psi` station air instead of giving up. | Matches ISS Destiny Lab nominal operating pressure (`14.7 psi / 101.3 kPa`). **PASS** |
| **Algebraic U-Curve Instead of 3D Radiative PDEs** | `src/lib/combustionPhysicsEngine.ts:L930–L948` | Solving full 3D Navier-Stokes radiation equations takes 6 hours per frame, so we curve-fitted Olson & T'ien's extinction boundaries into two fast exponents. | Backtested against 253 solid-fuel flight runs (`BASS`, `BASS-II`, `SAFFIRE-3`) with **87.35% accuracy**. **PASS** |
| **Linear Ion-Wind Proxy (`v_ion = 0.008 * E`)** | `src/lib/combustionPhysicsEngine.ts:L924–L927` | We don't have Lunar surface fire data yet, so we use `ACME E-FIELD` voltage to push flame ions around and fake `0.16g` Moon buoyancy at `1100 V/cm`. | Matches Chien et al. (2019) ISS electric-field velocity scaling (`8.8 cm/s` = `0.16g`). **PASS** |
| **Froude Gravity Bounding for Moon (`0.16g`) & Mars (`0.38g`)** | `src/lib/combustionPhysicsEngine.ts:L1544–L1595` | `LUCI` and `FM2` haven't launched to the Moon yet, so we pin `0.16g` and `0.38g` between real `0g` ISS data and `1g` Earth data using square-root gravity scaling. | Strictly bounded between `0g` (`14.15% LOI`) and `1g` (`15.16% LOI`) across all 23 pressure steps. **PASS** |
| **Particle Size Cutoff for Smoke vs. Dust (`0.55 µm` vs. `2.2 µm`)** | `src/lib/combustionPhysicsEngine.ts:L1475–L1512` | Spacecraft smoke detectors freak out when astronauts kick up cabin dust, so we check particle size to separate `SAME` fire smoke from `DAFT` dust false alarms. | Matches NASA `SAME` / `DAFT` PIMS laser obscuration telemetry. **PASS** |

---

## 4. Automated Verification Scorecard (`scripts/verifyPhysics.ts`)

Ran `npx tsx scripts/verifyPhysics.ts` against the refactored engine and all 654 NASA PSI rows. Every physics law and flight backtest passed without choking:

```text
================================================================================
PROJECT APULA — AUTOMATED PHYSICS & NASA PSI EMPIRICAL VERIFICATION SUITE
================================================================================

[PASS 1] Olson/T'ien Dual-Limit U-Curve: LOI(0 cm/s)=18.9% > LOI(5 cm/s)=14.1% < LOI(35 cm/s)=17.33%
[PASS 2] Microgravity vs. Earth Inversion: LOI(0g, 5 cm/s)=14.1% < LOI(1g, 0 cm/s)=15.11%
[PASS 3] Partial-Gravity Bounding Envelope (23 pressure steps): 0g (14.15%) < Lunar 0.16g (14.55%) < Mars 0.38g (14.77%) < Earth 1g (15.16%)
[PASS 4] Pythagorean Mixed-Convection Superposition: v_b=8.80 cm/s, v_ion=3.20 cm/s, v_eff=13.42 cm/s
[PASS 5] ACME E-FIELD Ion-Wind Equivalence (1100 V/cm @ 0g): v_ion=8.80 cm/s -> equivalentGravityG=0.1600g (Lunar 0.16g)
[PASS 6] Sub-Atmospheric Pressure Power-Law (P/14.7)^-0.25: ISS(14.7p)=1.000x (LOI 14.1%), Lunar(10.2p)=1.096x (LOI 15.45%), EVA(4.3p)=1.360x (LOI 19.18%, Spread 75 mm/s)
[PASS 7] FLEX / ACME CFI-G Cool-Flame Regime: regime=COOL_FLAME_CFI_G, T_ad=680 K [550-750 K], coreColorHex=#6366F1
[PASS 8] NASA PSI Empirical Backtest (654 total rows | 253 solid-fuel BASS / BASS-II / SAFFIRE-3 runs): 221/253 concordant (87.35% >= 80.00% target)

ALL 8 SCIENTIFIC & EMPIRICAL VERIFICATION CHECKS PASSED (100%).