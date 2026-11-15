# Project APULA v3 Documentation

## 1. Visual Design System (Apple Default + Barebones Tactical)

Project APULA v3 uses a strict **Apple Design System** palette as its default (`apple`) theme alongside a high-contrast dark **Barebones Tactical** (`barebones`) toggle in Settings.

### Core Tokens (`src/app/globals.css`, `tailwind.config.ts`)
- **Canvas & Surfaces:**
  - `--canvas: #FFFFFF` (primary page canvas)
  - `--surface: #F5F5F7` (`28px` borderless feature cards, zero drop-shadow, zero box-inside-a-box frames)
  - `--surface-dark: #161617` (3D WebGL flame chamber media well and SVG phase plot stage)
  - `--ap-header-bg: rgba(255, 255, 255, 0.8)` (`min-height: 52px`, `backdrop-filter: saturate(180%) blur(20px)`, single `1px solid #D2D2D7` bottom hairline)
- **Ink & Hairlines:**
  - `--ink: #000000` (display headings), `--body: #1D1D1F`, `--muted: #6E6E73`, `--faint: #86868B`, `--hairline: #D2D2D7`
- **Semantic Accents:**
  - `--primary: #0071E3` (primary rounded-full action pills, active scenario focus ring `ring-2 ring-[#0071E3]`, `[ESTIMATED]` provenance tags)
  - `--accent-link-hover: #0066CC`, `--accent: #2997FF`
  - `--accent-decorative: #B64400` (`12px` semibold editorial eyebrows and `[MEASURED]` provenance tags)
- **Barebones Tactical (`data-theme="barebones"`):**
  - Switches `color-scheme: dark`, canvas `#0D0D0F`, navbar `rgba(29, 29, 31, 0.8)`, `#1D1D1F` tactical surfaces with sharp `4px` corners and `rgba(255, 255, 255, 0.16)` hairlines.

### Brand Mark
- Vector logo copied to `public/apulla.svg` (`432x213` viewBox) and rendered directly inside the sticky header (`h-10 md:h-11 w-auto`) and onboarding dialog (`h-10 w-auto`) with `16px` (`gap-4`) spacing and zero enclosing box or shadow.

---

## 2. Architecture & Component Overview

| Module | Path | Role |
| :--- | :--- | :--- |
| Pre-Paint Theme Boot | [ThemeScript.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/components/ThemeScript.tsx) | Reads `apula.theme` (defaults `"apple"`) and `apula.reducedMotion` before hydration to prevent theme flash. |
| Theme & Onboarding State | [ThemeContext.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/context/ThemeContext.tsx) | Persists `"apple"` / `"barebones"`, reduced motion, and onboarding seen flag in `localStorage`. |
| Sticky Top Bar & Settings | [HeaderNav.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/components/HeaderNav.tsx), [SettingsPopover.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/components/SettingsPopover.tsx) | Edge-to-edge frosted navbar (`popover="auto"` Settings menu) with regime status pill, Historical Missions trigger, Tutorial launcher, and theme switcher. |
| Onboarding & Spotlight Tour | [OnboardingWelcome.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/components/OnboardingWelcome.tsx), [SpotlightTour.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/components/SpotlightTour.tsx), [tourSteps.ts](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/data/tourSteps.ts) | Native `<dialog>` welcome screen (`closedby="any"` + fallback) and 5-step `[data-tour]` cutout walkthrough using `#0071E3` highlights. |
| Provenance & Formula X-Ray | [MetricAnnotationPopover.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/components/MetricAnnotationPopover.tsx), [metricAnnotations.ts](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/lib/metricAnnotations.ts), [provenanceStyles.ts](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/lib/provenanceStyles.ts) | Typographic provenance labels (`[MEASURED]`, `[INFERRED]`, `[DEFAULTED]`, `[ESTIMATED]`) opening live equation breakdowns with self-check deltas. |
| Historical Spaceflight Missions | [HistoricalScenarios.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/components/HistoricalScenarios.tsx), [historicalScenarios.ts](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/data/historicalScenarios.ts) | 5 documented orbital case studies (14 state variants) comparing NASA outcomes against live APULA predictions and explicit caveats. |
| 3D Chamber & Phase Charts | [ThreeFlameChamber.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/components/ThreeFlameChamber.tsx), [FlammabilityPhaseCharts.tsx](file:///C:/Users/Nicholai-PC/.gemini/antigravity/scratch/apula/src/components/FlammabilityPhaseCharts.tsx) | WebGL flame morphology chamber in `#161617` dark media well (`28px` radius) and multi-gravity flammability SVG envelopes paired with sharp `0px` hairline data tables. |

---

## 3. Physics Engine Freeze & Verification Ledger

No physics equations, lookup tables, or empirical datasets were modified:
- `git status -s -- src/lib/combustionPhysicsEngine.ts scripts/verifyPhysics.ts` -> clean (0 changes).

### Automated Check Results
- `node .\node_modules\typescript\bin\tsc --noEmit --incremental false` -> **`TSC_EXIT=0`**
- `node scripts\verifyPhysics.ts` -> **`PHYS_EXIT=0`** (matching baseline physics PASS output; stderr module warning accounted for)
- `node scripts\verifyAnnotations.ts` -> **`ANNOT_EXIT=0`** (`8640` grid points swept; `86400/86400` metric equation checks `PASS`)
- `node scripts\verifyScenarios.ts` -> **`SCEN_EXIT=0`** (`5` historical missions / `14` variants `100% parity`)
- `node .\node_modules\next\dist\bin\next build` -> **`BUILD_EXIT=0`** (`Compiled successfully in 9.6s`)
- Live Chromium QA (`http://127.0.0.1:3099`): Verified onboarding dialog dismissal, Apple light default (`#FFFFFF` canvas, `#F5F5F7` `28px` borderless cards, `#B64400` eyebrows, bare `/apulla.svg` navbar logo, `#161617` 3D chamber & plots), live equation popover, historical missions modal, and `Barebones Tactical` dark theme switching.
