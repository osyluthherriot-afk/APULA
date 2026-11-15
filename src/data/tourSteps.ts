export interface TourStep {
  id: string;
  selector: string;
  badge: string;
  title: string;
  description: string;
}

// Five sequential stops sweeping the chamber, telemetry, charts, and replay vault 👁️
export const APULA_TOUR_STEPS: TourStep[] = [
  {
    id: "controls",
    selector: '[data-tour="controls"]',
    badge: "Step 1 of 5 • Inputs",
    title: "Atmosphere, Gravity & Geometry Controls",
    description:
      "Tune O2%, total cabin pressure, ventilation airflow, gravity (0g to 1g), high-voltage E-field, CO2 dilution, and material preset. Switch between Flat Slab [1.0x], Cylindrical Rod [D/4], Sphere [D/6], and Fabric [0.85x] to see Biot volume-to-surface curvature prevent thick PMMA rods from false-quenching.",
  },
  {
    id: "chamber",
    selector: '[data-tour="chamber"]',
    badge: "Step 2 of 5 • 3D Viewport",
    title: "Interactive 3D Microgravity Flame Chamber",
    description:
      "Orbit 360 degrees and zoom inside the combustion test section. Watch the flame transition from symmetrical 0g soot spheres to elongated ventilated plumes, buoyant 1g cones, or inside-out CFI-G cool flames. Toggle Sensor Probes for thermocouple rake and radiometer flux telemetry.",
  },
  {
    id: "telemetry",
    selector: '[data-tour="telemetry"]',
    badge: "Step 3 of 5 • Provenance X-Ray",
    title: "Telemetry Readouts & Provenance Badges",
    description:
      "Inspect limiting O2% (LOI), oxygen margin, flame spread rate, adiabatic flame temperature, and CO/CO2 yields. Click any info (?) icon or [MEASURED] / [INFERRED] / [DEFAULTED] / [ESTIMATED] pill to open an equation breakdown populated with the exact live numbers.",
  },
  {
    id: "phase-charts",
    selector: '[data-tour="phase-charts"]',
    badge: "Step 4 of 5 • Phase Space",
    title: "Flammability Envelopes & U-Curve Phase Maps",
    description:
      "Compare APULA's 0g, 0.16g Lunar, 0.38g Mars, and 1g Earth flammability ceilings against clustered NASA PSI flight runs. Toggle Boundary Zone zoom (12–38% O2) to inspect the zero-g ventilation U-curve where gentle 3–10 cm/s airflow yields the lowest ignition threshold.",
  },
  {
    id: "scenarios",
    selector: '[data-tour="scenarios"]',
    badge: "Step 5 of 5 • Flight Validation",
    title: "Historical Spaceflight Burn Recreator",
    description:
      "Open documented orbital experiments—FLEX-2 inside-out cool flames, BASS-II 3/8-inch PMMA rods, Saffire-III SIBAL cloth, Artemis pre-breathe hazards, and E-field ion wind—to apply real mission parameters and inspect APULA predictions beside empirical outcomes and model caveats.",
  },
];
