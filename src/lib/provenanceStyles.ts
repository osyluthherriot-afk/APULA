import type {
  FieldProvenanceKey,
  ProvenanceStatus,
  RunDataQuality,
} from "./combustionPhysicsEngine.ts";

export interface ProvenanceDescriptor {
  status: ProvenanceStatus;
  shortTag: string;
  badgeClass: string;
  title: string;
  meaning: string;
}

// Flat lookup map turning NASA PSI provenance flags into crisp badge styles 👁️
export const PROVENANCE_STYLES: Record<ProvenanceStatus, ProvenanceDescriptor> = {
  MEASURED: {
    status: "MEASURED",
    shortTag: "[MEASURED]",
    badgeClass: "ap-prov-measured",
    title: "Directly Logged Hardware Measurement",
    meaning:
      "Read straight from NASA ISS/shuttle sensors or raw NASA PSI CSV telemetry columns with zero estimation.",
  },
  INFERRED: {
    status: "INFERRED",
    shortTag: "[INFERRED]",
    badgeClass: "ap-prov-inferred",
    title: "Parsed Deterministically From Text",
    meaning:
      "Extracted cleanly from NASA sample descriptions (for example, 3/8\" black PMMA rod -> Cylinder/Rod at 9.525 mm) or explicit unit conversion.",
  },
  DEFAULTED: {
    status: "DEFAULTED",
    shortTag: "[DEFAULTED]",
    badgeClass: "ap-prov-defaulted",
    title: "Baseline Assumed Where CSV Blank",
    meaning:
      "Raw NASA PSI log left this column blank; APULA filled the standard ISS ambient baseline (14.7 psi or 0 cm/s still air).",
  },
  ESTIMATED: {
    status: "ESTIMATED",
    shortTag: "[ESTIMATED]",
    badgeClass: "ap-prov-estimated",
    title: "Computed From Physics Model",
    meaning:
      "Predicted by APULA's semi-empirical Olson/T'ien U-curve, Damkohler pressure fit, and Biot curvature scaling equations.",
  },
};

export const RUN_QUALITY_STYLES: Record<RunDataQuality, { className: string; summary: string }> = {
  FULLY_MEASURED: {
    className: "ap-prov-measured",
    summary:
      "Cabin pressure, oxygen concentration, and flow or spread rate all came directly from logged flight hardware.",
  },
  PARTIALLY_INFERRED: {
    className: "ap-prov-inferred",
    summary:
      "Core flight measurements exist, while sample geometry or blank pressure defaulted to standard cabin metadata.",
  },
  MODEL_ESTIMATED: {
    className: "ap-prov-defaulted",
    summary:
      "Multiple ambient or spread cells were omitted in source records and populated via deterministic defaults.",
  },
};

export const FIELD_PROVENANCE_NOTES: Record<
  FieldProvenanceKey,
  { label: string; sourceHint: string }
> = {
  pressure: {
    label: "Chamber / Cabin Pressure (psi)",
    sourceHint:
      "MEASURED when Pressure (psi/kPa) is logged; DEFAULTED to 14.7 psi when blank (common in BASS & BASS-II still-air logs).",
  },
  o2: {
    label: "Oxygen Volume Fraction (% O2)",
    sourceHint:
      "MEASURED from calibrated NASA O2 sensors or normalized from fractional concentrations.",
  },
  airflow: {
    label: "Forced Ventilation Velocity (cm/s)",
    sourceHint:
      "MEASURED when blower/duct telemetry or multi-step drawdown velocities exist; DEFAULTED to 0 cm/s when blank.",
  },
  thickness: {
    label: "Characteristic Sample Dimension (mm)",
    sourceHint:
      "INFERRED from NASA sample descriptions (for example mil/cm/inch strings) or MEASURED from explicit thickness_mm columns.",
  },
  geometry: {
    label: "Sample Geometry Class",
    sourceHint:
      "INFERRED from NASA sample keywords (rod, candle, sphere, fabric, film, sheet) to drive Biot curvature scaling.",
  },
  spreadRate: {
    label: "Flame Spread Rate (mm/s)",
    sourceHint:
      "MEASURED directly from NASA video/radiometer tracking when reported, or ESTIMATED / NOT LOGGED when omitted.",
  },
};
