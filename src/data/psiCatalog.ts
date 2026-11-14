import {
  type NormalizedRun,
  type SimulationParams,
  loadMasterPsiDataset,
} from "@/lib/combustionPhysicsEngine";
import { MASTER_PSI_CSV } from "../../datum/masterPsiData";

export { MASTER_PSI_CSV };

export type PsiPillar = "Prevention" | "Detection" | "Suppression";

export type DataProvenanceTier =
  | "EMPIRICAL_CSV_LOADED"
  | "PHYSICS_AND_METADATA_MODEL"
  | "FUTURE_LUNAR_FLIGHT";

export type PsiHardwareRack =
  | "MSG (SPICE Flow Duct)"
  | "CIR (Combustion Integrated Rack)"
  | "CIR - MDCA"
  | "Cygnus Spacecraft"
  | "ISS Cabin / Aerosol Rack"
  | "Future Lunar Lander";

export type PsiFuelPhase = "Solid" | "Liquid" | "Gas" | "Aerosol/Dust";

export interface PsiInvestigation {
  id: string;
  title: string;
  pillar: PsiPillar;
  provenanceTier: DataProvenanceTier;
  provenanceBadgeText: string;
  purposeInSpaceSafety: string;
  hardwareRack: PsiHardwareRack;
  fuelPhase: PsiFuelPhase;
  fuelSamples: string;
  o2RangePct: [number, number];
  pressureRangePsi: [number, number];
  airflowRangeCmS: [number, number];
  gravityRegime: string;
  intraFixedVars: string[];
  intraSweptVars: string[];
  sensors: string[];
  crossInvestigationLink: {
    relatedId: string;
    explanation: string;
  };
  earthSpinoff: string;
}

export interface RankedPsiInvestigation extends PsiInvestigation {
  score: number;
  loadedRowCount: number;
  whyRelevantForHabitat: string;
  whyRelevant: string;
}

export const EMPIRICAL_CAMPAIGN_IDS = [
  "BASS-II",
  "BASS",
  "SAFFIRE-3",
  "FLEX",
  "FLEX-2",
  "SAME",
  "SAME-R",
  "DAFT",
] as const;

export const PSI_INVESTIGATIONS: PsiInvestigation[] = [
  {
    id: "BASS-II",
    title: "Burning and Suppression of Solids - II (PSI-25)",
    pillar: "Suppression",
    provenanceTier: "EMPIRICAL_CSV_LOADED",
    provenanceBadgeText: "EMPIRICAL CSV LOADED (ISS Flight Telemetry)",
    purposeInSpaceSafety:
      "Maps low-flow diffusive quenching and high-flow blowoff ventilation cutoffs so astronauts know whether turning off cabin fans extinguishes or fans a solid spacecraft fire.",
    hardwareRack: "MSG (SPICE Flow Duct)",
    fuelPhase: "Solid",
    fuelSamples:
      "PMMA films (0.1 mm), thick PMMA slabs (3 mm), black PMMA rods, SIBAL cotton-fiberglass fabric, Nomex, and paraffin wax candles",
    o2RangePct: [13.6, 29.9],
    pressureRangePsi: [8.2, 14.7],
    airflowRangeCmS: [0.5, 55.0],
    gravityRegime: "Microgravity (0g, ISS US Destiny Lab)",
    intraFixedVars: [
      "7.6 cm x 7.6 cm MSG SPICE miniature flow duct cross-section",
      "Calibrated Kanthal hot-wire igniter geometry and upstream honeycomb flow straightener",
      "Fixed radiometer line-of-sight and Nikon D300s still/HD camera framing",
    ],
    intraSweptVars: [
      "Stepped opposed and concurrent forced airflow velocity (55 cm/s down to 0.5 cm/s quenching)",
      "Ambient oxygen concentration (13.6% to 29.9% O2) and nitrogen dilution",
      "Sample geometry and thermal thickness (0.1 mm thin film vs. 3 mm slab vs. cylindrical rod)",
    ],
    sensors: [
      "Broadband Radiometer (gains 10, 50, 250, 1000)",
      "Hot-Wire Anemometer (Airflow Display cm/s)",
      "Nikon D300s Digital Stills & HD Video Camera",
      "Electrochemical O2, NDIR CO2, and CO ppm Gas Analyzers",
    ],
    crossInvestigationLink: {
      relatedId: "BASS",
      explanation:
        "BASS and BASS-II share the MSG SPICE flow duct originally built for SPICE and SLICE solid combustion tests, extending foundational BASS opposed/concurrent flame spread limits into stepped-flow suppression maps later scaled up in SAFFIRE-3.",
    },
    earthSpinoff:
      "Refined NASA-STD-6001B material flammability screening correlations and improved ventilation fire-cutoff protocols for terrestrial cleanrooms, submarines, and mines.",
  },
  {
    id: "BASS",
    title: "Burning and Suppression of Solids (Original BASS)",
    pillar: "Prevention",
    provenanceTier: "EMPIRICAL_CSV_LOADED",
    provenanceBadgeText: "EMPIRICAL CSV LOADED (ISS Flight Telemetry)",
    purposeInSpaceSafety:
      "Establishes baseline microgravity ignition thresholds and flame spread rates for spacecraft cabin polymers and fabrics before selecting interior habitat materials.",
    hardwareRack: "MSG (SPICE Flow Duct)",
    fuelPhase: "Solid",
    fuelSamples:
      "Cotton-fiberglass (SIBAL), Nomex, clear/black PMMA sheets and rods, Ultem, and wax cylinders",
    o2RangePct: [14.5, 25.0],
    pressureRangePsi: [10.2, 14.7],
    airflowRangeCmS: [1.0, 45.0],
    gravityRegime: "Microgravity (0g, ISS Microgravity Science Glovebox)",
    intraFixedVars: [
      "Shared MSG SPICE/SLICE optical wind tunnel duct housing",
      "Standardized sample clamp and resistive igniter wire current",
      "Baseline ISS cabin pressure and nitrogen-diluted oxidizer supply",
    ],
    intraSweptVars: [
      "Flow orientation relative to flame propagation (concurrent vs. opposed flow)",
      "Polymer chemistry (self-extinguishing Nomex vs. sustained PMMA/SIBAL)",
      "Forced convective airflow speed near the 1–5 cm/s quenching boundary",
    ],
    sensors: [
      "Color Video & High-Resolution Stills Camera",
      "Radiative Heat Flux Radiometer",
      "Duct Anemometer & Thermocouples",
      "Post-Burn Cabin O2 / CO / CO2 Gas Telemetry",
    ],
    crossInvestigationLink: {
      relatedId: "BASS-II",
      explanation:
        "BASS and BASS-II both reused the MSG SPICE flow duct (shared with SPICE and SLICE), proving that thin fuels can burn at lower O2 concentrations in gentle 0g cabin ventilation than in 1g Earth upward tests.",
    },
    earthSpinoff:
      "Improved polymer flame-retardancy ranking criteria for commercial aviation cabin textiles and residential building insulation.",
  },
  {
    id: "SAFFIRE-3",
    title: "Spacecraft Fire Experiment - III",
    pillar: "Prevention",
    provenanceTier: "EMPIRICAL_CSV_LOADED",
    provenanceBadgeText: "EMPIRICAL CSV LOADED (Cygnus Flight Telemetry)",
    purposeInSpaceSafety:
      "Tests full-scale meter-long fires inside an actual uncrewed Cygnus spacecraft to verify whether small ISS glovebox flammability tests accurately predict catastrophic cabin fires.",
    hardwareRack: "Cygnus Spacecraft",
    fuelPhase: "Solid",
    fuelSamples:
      "Large-scale SIBAL fabric panel (0.40 m wide x 0.94 m long, 75% cotton / 25% fiberglass) and PMMA calibration strips",
    o2RangePct: [20.5, 21.5],
    pressureRangePsi: [14.2, 14.7],
    airflowRangeCmS: [15.0, 30.0],
    gravityRegime: "Microgravity (0g, Uncrewed Cygnus OA-7 Post-ISS Departure)",
    intraFixedVars: [
      "Full-scale 0.40 m x 0.94 m SIBAL fabric geometry inside instrumented Cygnus flow module",
      "ISS-nominal cabin atmosphere (21% O2, 14.7 psi)",
      "Sealed Cygnus hull volume allowing true cabin pressure rise and oxygen depletion measurements",
    ],
    intraSweptVars: [
      "Forced cabin duct airflow (20 cm/s vs. 30 cm/s)",
      "Ignition location and concurrent vs. opposed spread length",
      "Transient CO, CO2, and cabin overpressure accumulation over multi-minute burns",
    ],
    sensors: [
      "Thermocouple Rake Array spanning 0.94 m burn length",
      "Dual Narrow-Band Radiometers",
      "Twin HD Cameras with LED Strobe Backlighting",
      "Full-Vehicle O2, CO2, CO, and Differential Pressure Sensors",
    ],
    crossInvestigationLink: {
      relatedId: "BASS-II",
      explanation:
        "Scales up cm-sized BASS and BASS-II SIBAL coupon burns from the MSG SPICE flow duct by >10x to validate flame-spread length limits and radiative heat feedback inside a real spacecraft cabin.",
    },
    earthSpinoff:
      "High-fidelity large-enclosure CFD fire growth benchmarks used to design safer cargo aircraft compartments, road tunnels, and naval shipboard bulkheads.",
  },
  {
    id: "FLEX",
    title: "Flame Extinguishment Experiment",
    pillar: "Suppression",
    provenanceTier: "EMPIRICAL_CSV_LOADED",
    provenanceBadgeText: "EMPIRICAL CSV LOADED (ISS Flight Telemetry)",
    purposeInSpaceSafety:
      "Quantifies how inert gases (CO2, He, Xe, N2) and water-mist agents suppress liquid fuel fires in 0g, addressing Apollo 1 and Mir fire suppression gaps.",
    hardwareRack: "CIR - MDCA",
    fuelPhase: "Liquid",
    fuelSamples:
      "n-Heptane, Methanol, Ethanol, and Decane spherical liquid droplets (1.5 mm to 4.8 mm diameter)",
    o2RangePct: [14.0, 30.0],
    pressureRangePsi: [7.0, 14.7],
    airflowRangeCmS: [0.0, 6.0],
    gravityRegime: "Microgravity (0g, ISS CIR Multi-user Droplet Combustion Apparatus)",
    intraFixedVars: [
      "Quiescent spherical combustion chamber with dual-needle droplet deployment",
      "Hot-wire igniter retraction leaving a nearly motionless spherical droplet",
      "Symmetrical zero-buoyancy radial fuel/oxidizer diffusion field",
    ],
    intraSweptVars: [
      "Suppressant diluent blend (CO2, Nitrogen, Helium, Xenon, and fine-water-mist loading)",
      "Initial droplet diameter (1.5 mm to 4.8 mm) governing radiative heat loss vs. extinction",
      "Ambient oxygen percentage (14% to 30%) and chamber pressure",
    ],
    sensors: [
      "Intensified Ultraviolet OH* Chemiluminescence Camera",
      "Color CCD Camera (soot shell tracking)",
      "Narrow-Band & Broadband Radiometers (radiative extinction detection)",
      "Chamber Gas Chromatograph & O2/CO2/CO Telemetry",
    ],
    crossInvestigationLink: {
      relatedId: "ACME-CFI-G",
      explanation:
        "FLEX unexpectedly discovered dual-stage low-temperature 'cool flames' in liquid heptane droplets after hot-flame radiative extinction; ACME-CFI-G later isolated this same cool-flame chemistry in gaseous propane/butane.",
    },
    earthSpinoff:
      "FLEX fine-water-mist extinguishers & clean-agent halon replacements: directly shaped the ISS Portable Fire Extinguisher (PFE) fine-water-mist system and clean low-temperature combustion engine models.",
  },
  {
    id: "FLEX-2",
    title: "Flame Extinguishment Experiment - 2 (Multi-Fuel & Soot Shells)",
    pillar: "Suppression",
    provenanceTier: "EMPIRICAL_CSV_LOADED",
    provenanceBadgeText: "EMPIRICAL CSV LOADED (ISS Flight Telemetry)",
    purposeInSpaceSafety:
      "Evaluates soot shell trapping, droplet-array fire spread, and multi-component liquid fuel suppression limits for spacecraft propellants and coolant leaks.",
    hardwareRack: "CIR - MDCA",
    fuelPhase: "Liquid",
    fuelSamples:
      "n-Heptane/Hexadecane bi-component mixtures, Octane, and Ethanol droplets (2.0 mm to 5.0 mm)",
    o2RangePct: [15.0, 26.0],
    pressureRangePsi: [7.3, 14.7],
    airflowRangeCmS: [0.0, 8.0],
    gravityRegime: "Microgravity (0g, ISS CIR MDCA)",
    intraFixedVars: [
      "CIR MDCA chamber and dual-needle deployment mechanism",
      "80 µm SiC fiber tethering or untethered free-float droplet suspension",
      "Calibrated UV/visible optical diagnostics",
    ],
    intraSweptVars: [
      "Fuel volatility ratio in bi-component mixtures (heptane + hexadecane)",
      "Inert gas substitution (He vs. N2 vs. CO2) changing thermal diffusivity",
      "Droplet spacing in paired droplet-ignition arrays",
    ],
    sensors: [
      "Backlit High-Speed Shadowgraphy Camera",
      "UV OH* Chemiluminescence Imager",
      "Broadband Radiometer Suite",
      "Residual CO / CO2 Gas Sampling",
    ],
    crossInvestigationLink: {
      relatedId: "FLEX",
      explanation:
        "Extends single-fuel FLEX extinction baselines to multi-component fuel mixtures and interacting droplet pairs, clarifying how trapped soot shells alter radiative heat loss and cool-flame re-ignition.",
    },
    earthSpinoff:
      "Improved spray-combustion soot reduction and fuel-injector fire safety models for terrestrial aviation turbines and clean diesel engines.",
  },
  {
    id: "SAME",
    title: "Smoke Aerosol Measurement Experiment",
    pillar: "Detection",
    provenanceTier: "EMPIRICAL_CSV_LOADED",
    provenanceBadgeText: "EMPIRICAL CSV LOADED (ISS Flight Telemetry)",
    purposeInSpaceSafety:
      "Measures microgravity smoke particle size distributions from overheated wiring and plastics so spacecraft alarms detect real electrical fires before toxic smoke fills the cabin.",
    hardwareRack: "ISS Cabin / Aerosol Rack",
    fuelPhase: "Aerosol/Dust",
    fuelSamples:
      "Overheated spacecraft materials: Kapton wire insulation, Teflon (PTFE), Silicone rubber, cellulose lampwick, and dibutyl phthalate",
    o2RangePct: [20.9, 21.5],
    pressureRangePsi: [14.5, 14.7],
    airflowRangeCmS: [1.5, 10.0],
    gravityRegime: "Microgravity (0g, ISS MSG / Aerosol Rack)",
    intraFixedVars: [
      "Controlled non-flaming resistive pyrolysis heating profile",
      "Fixed optical path geometry across ISS Photoelectric vs. Ionization reference detectors",
      "Standardized aerosol aging manifold volume",
    ],
    intraSweptVars: [
      "Pyrolyzed material (ultrafine Teflon 30–80 nm vs. larger Silicone/cellulose agglomerates)",
      "Duct residence velocity (1.5 to 10 cm/s) controlling Brownian coagulation",
      "Thermal aging delay prior to optical scattering measurement",
    ],
    sensors: [
      "Three-Wavelength Laser Extinction & Scattering Photometer (PIMS)",
      "Condensation Nuclei Counter (CNC)",
      "Thermophoretic TEM Grid Sampler (electron microscope particle sizing)",
      "ISS Flight Photoelectric (Laser) & Ionization Smoke Detectors",
    ],
    crossInvestigationLink: {
      relatedId: "DAFT",
      explanation:
        "SAME smoke sensors reused in DAFT: the PIMS/CNC aerosol scattering hardware and particle-sizing benchmarks built for SAME were reused directly in DAFT to separate real pyrolysis smoke from cabin/lunar nuisance dust.",
    },
    earthSpinoff:
      "SAME multi-criteria firefighter & aircraft smoke/dust discrimination: enabled dual-wavelength optical smoke detectors that resist cooking/steam false alarms and improved particulate respirators for firefighters.",
  },
  {
    id: "SAME-R",
    title: "Smoke Aerosol Measurement Experiment - Reflight (SAME-R)",
    pillar: "Detection",
    provenanceTier: "EMPIRICAL_CSV_LOADED",
    provenanceBadgeText: "EMPIRICAL CSV LOADED (ISS Flight Telemetry)",
    purposeInSpaceSafety:
      "Validates aerosol coagulation models across wider spacecraft ventilation speeds to calibrate Orion and Lunar Gateway smoke detectors.",
    hardwareRack: "ISS Cabin / Aerosol Rack",
    fuelPhase: "Aerosol/Dust",
    fuelSamples:
      "Kapton, Teflon, Silicone rubber, and smoldering cellulose pyrolysis aerosols",
    o2RangePct: [20.5, 21.5],
    pressureRangePsi: [14.3, 14.7],
    airflowRangeCmS: [1.0, 14.0],
    gravityRegime: "Microgravity (0g, ISS MSG)",
    intraFixedVars: [
      "Upgraded SAME PIMS multi-wavelength optical chamber",
      "Calibrated pyrolysis heater voltage ramp",
      "Parallel ISS reference flight detector sampling ports",
    ],
    intraSweptVars: [
      "Extended duct flow velocities (1 to 14 cm/s) and aging dwell times",
      "Smoke optical refractive index across polymer vs. silicone aerosols",
      "Mass vs. number concentration ratios triggering photoelectric alarm thresholds",
    ],
    sensors: [
      "Reflight PIMS Multi-Wavelength Photometer",
      "Condensation Nuclei Counter (CNC)",
      "TEM Grid Aerosol Impactor",
      "Dual-Mode Spacecraft Smoke Detector Testbed",
    ],
    crossInvestigationLink: {
      relatedId: "SAME",
      explanation:
        "Builds directly upon SAME with expanded ventilation velocities and aging loops, feeding calibrated smoke-size lookup tables into DAFT dust rejection algorithms.",
    },
    earthSpinoff:
      "NEXT-GEN multi-criteria aircraft cargo-bay and industrial cleanroom smoke detectors with vastly lower false-alarm rates.",
  },
  {
    id: "DAFT",
    title: "Dust and Aerosol Measurement Feasibility Test (DAFT / DAFT-2)",
    pillar: "Detection",
    provenanceTier: "EMPIRICAL_CSV_LOADED",
    provenanceBadgeText: "EMPIRICAL CSV LOADED (ISS Flight Telemetry)",
    purposeInSpaceSafety:
      "Characterizes floating cabin lint and lunar dust aerosols to prevent false smoke alarms—like the Artemis II smoke alarm incident 80,000 miles from Earth—while preserving rapid fire detection.",
    hardwareRack: "ISS Cabin / Aerosol Rack",
    fuelPhase: "Aerosol/Dust",
    fuelSamples:
      "ISS cabin particulate lint, JSC-1A Lunar Regolith dust simulant, and mixed pyrolysis smoke aerosols",
    o2RangePct: [20.5, 34.0],
    pressureRangePsi: [8.2, 14.7],
    airflowRangeCmS: [2.0, 22.0],
    gravityRegime: "Microgravity (0g, ISS) & Exploration Cabin Dust Simulation",
    intraFixedVars: [
      "Reused SAME / SAME-R PIMS optical scattering geometry and laser wavelengths",
      "Controlled dust dispersion and cabin air sampling inlet",
      "Co-located optical particle counter reference channel",
    ],
    intraSweptVars: [
      "Particle size regime (0.05–0.8 µm pyrolysis smoke vs. 1–20 µm cabin lint/regolith dust)",
      "Airflow turbulence and filter-bypass concentration bursts",
      "Reduced-pressure exploration cabin density (8.2–14.7 psi)",
    ],
    sensors: [
      "Reused SAME PIMS Multi-Angle Laser Scattering Sensor",
      "Optical Particle Counter (OPC)",
      "Piezoelectric Microbalance Mass Monitor",
      "ISS Cabin Photoelectric Smoke Detector Reference",
    ],
    crossInvestigationLink: {
      relatedId: "SAME",
      explanation:
        "SAME smoke sensors reused in DAFT: directly repurposes the SAME/SAME-R optical aerosol characterization suite to differentiate abrasive 1–20 µm lunar/cabin dust from sub-micron electrical smoke.",
    },
    earthSpinoff:
      "Dust-immune optical fire detectors for underground mining, grain silos, woodworking shops, and aerospace assembly hangars.",
  },
  {
    id: "ACME-BRE",
    title: "ACME - Burning Rate Emulator (BRE)",
    pillar: "Prevention",
    provenanceTier: "PHYSICS_AND_METADATA_MODEL",
    provenanceBadgeText: "PHYSICS SIMULATED (CIR Gas Campaign)",
    purposeInSpaceSafety:
      "Emulates solid polymer flammability in still cabin air using a heat-flux-coupled gaseous burner so NASA can map exact material extinction limits without burning hundreds of solid samples.",
    hardwareRack: "CIR (Combustion Integrated Rack)",
    fuelPhase: "Gas",
    fuelSamples:
      "Gaseous Ethylene (C2H4) & Methane (CH4) with Nitrogen dilution emulating PMMA, Delrin, and Polyethylene",
    o2RangePct: [14.0, 40.0],
    pressureRangePsi: [7.0, 14.7],
    airflowRangeCmS: [0.0, 5.0],
    gravityRegime: "Microgravity (0g, ISS CIR Quiescent Chamber)",
    intraFixedVars: [
      "Porous sintered brass hemispherical/flat gas burner (25 mm and 50 mm)",
      "Closed quiescent CIR chamber (still air / zero forced convection)",
      "Real-time thermal feedback loop linking burner heat flux to mass flow controller",
    ],
    intraSweptVars: [
      "Effective B-number and heat of gasification settings mimicking distinct solid plastics",
      "Ambient oxygen fraction (14% to 40% O2) and total pressure",
      "Steady-state radiative heat loss leading to diffusive quenching",
    ],
    sensors: [
      "Burner-Embedded Heat-Flux Transducer",
      "Feedback-Controlled Mass Flow Controller (MFC)",
      "Intensified UV/NIR & Color Imaging Cameras",
      "Chamber Radiometers and O2/CO2/CO Gas Analyzers",
    ],
    crossInvestigationLink: {
      relatedId: "BASS-II",
      explanation:
        "ACME-BRE gaseous burner emulating solid material flammability: reproduces the heat-and-mass-transfer burning rates of solid plastics tested in BASS-II (like PMMA) under zero-flow still air where solid coupons quickly burn out.",
    },
    earthSpinoff:
      "Accelerates fire-safe polymer screening for consumer electronics enclosures and transit interiors at a fraction of destructive burn-test cost.",
  },
  {
    id: "ACME-CFI-G",
    title: "ACME - Cool Flames Investigation with Gases (CFI-G)",
    pillar: "Prevention",
    provenanceTier: "PHYSICS_AND_METADATA_MODEL",
    provenanceBadgeText: "PHYSICS SIMULATED (CIR Gas Campaign)",
    purposeInSpaceSafety:
      "Reveals hidden, nearly invisible low-temperature 'cool flames' (550–750 K) up to 85% O2 using inside-out spherical burners, warning astronauts of invisible re-ignition hazards.",
    hardwareRack: "CIR (Combustion Integrated Rack)",
    fuelPhase: "Gas",
    fuelSamples:
      "Propane (C3H8) & n-Butane (C4H10) in normal and inverse (inside-out) spherical porous diffusion burners",
    o2RangePct: [18.0, 85.0],
    pressureRangePsi: [4.3, 14.7],
    airflowRangeCmS: [0.0, 8.0],
    gravityRegime: "Microgravity (0g, ISS CIR)",
    intraFixedVars: [
      "Spherical porous stainless-steel burner (6.4 mm diameter) in quiescent CIR chamber",
      "Inverse/inside-out plumbing feeding oxidizer into fuel-rich chamber up to 85% O2 safely",
      "Zero buoyant convection maintaining pure spherical reaction-diffusion symmetry",
    ],
    intraSweptVars: [
      "Internal oxidizer O2 concentration up to 85% O2 (simulating EVA/exploration oxygen enrichment)",
      "Chamber pressure (4.3 psi EVA suit regime up to 14.7 psi ISS)",
      "Chemical regime transitions: Hot Flame -> Radiative Extinction -> Cool Flame (CH2O*)",
    ],
    sensors: [
      "Intensified CCD Camera with Formaldehyde (CH2O*) Optical Filter",
      "Fine-Wire Pt/Pt-Rh Thermocouple Rake (550 K – 2200 K)",
      "Wide-Angle UV/Visible/IR Radiometers",
      "Chamber Gas & Pressure Telemetry",
    ],
    crossInvestigationLink: {
      relatedId: "FLEX",
      explanation:
        "ACME-CFI-G 85% O2 inside-out spherical flames: extends FLEX's accidental cool-flame discovery in heptane droplets to clean gaseous propane/butane, isolating low-temperature chemical kinetics up to 85% O2.",
    },
    earthSpinoff:
      "Validates Low-Temperature Combustion (LTC) and HCCI kinetic mechanisms for ultra-low-NOx, high-efficiency automotive and aviation propulsion.",
  },
  {
    id: "ACME-E-FIELD",
    title: "ACME - Electric-Field Effects on Laminar Diffusion Flames",
    pillar: "Suppression",
    provenanceTier: "PHYSICS_AND_METADATA_MODEL",
    provenanceBadgeText: "PHYSICS SIMULATED (CIR Gas Campaign)",
    purposeInSpaceSafety:
      "Uses high-voltage electric fields on flame ions in 0g to generate 'ion wind', both testing electrostatic fire suppression and mimicking Lunar (0.16g) and Mars (0.38g) buoyant convection.",
    hardwareRack: "CIR (Combustion Integrated Rack)",
    fuelPhase: "Gas",
    fuelSamples:
      "Gaseous Methane (CH4) and Ethylene (C2H4) co-flow laminar diffusion flames between mesh electrodes",
    o2RangePct: [18.0, 30.0],
    pressureRangePsi: [10.0, 14.7],
    airflowRangeCmS: [0.0, 15.0],
    gravityRegime: "Microgravity (0g with Electrostatic Body-Force Equivalent to 0g–1g)",
    intraFixedVars: [
      "Co-flow cylindrical burner nozzle inside parallel high-voltage mesh electrode assembly",
      "Zero gravitational thermal buoyancy in ISS microgravity",
      "Controlled fuel/oxidizer co-flow nozzle velocity",
    ],
    intraSweptVars: [
      "Applied DC/AC electric field intensity (0 to 3,000 V/cm) and polarity",
      "Ion-wind velocity mimicking partial-gravity buoyancy (0.16g Lunar ~8.8 cm/s; 0.38g Mars ~13.6 cm/s)",
      "Fuel sootiness (clean CH4 vs. heavily sooting C2H4)",
    ],
    sensors: [
      "High-Voltage Electrometer & Ion Current Picoammeter",
      "OH* Chemiluminescence & Laser Soot Extinction",
      "High-Speed Flame Aspect Ratio & Blowoff Video",
      "CO / CO2 / Soot Exhaust Gas Sensors",
    ],
    crossInvestigationLink: {
      relatedId: "LUCI",
      explanation:
        "ACME-E-FIELD electric-field ion wind mimicking Lunar 0.16g & Mars 0.38g buoyancy: enables APULA to translate electrostatic body force (equivalentGravityG) into partial-gravity convective predictions before LUCI flies.",
    },
    earthSpinoff:
      "Electrostatic burner stabilization for low-soot industrial boilers and non-chemical plasma/electric-field fire-suppression nozzles.",
  },
  {
    id: "LUCI",
    title: "Lunar-g Combustion Investigation (LUCI)",
    pillar: "Prevention",
    provenanceTier: "FUTURE_LUNAR_FLIGHT",
    provenanceBadgeText: "FUTURE LUNAR FLIGHT (Bounded via 0g/1g & E-FIELD)",
    purposeInSpaceSafety:
      "Upcoming Artemis lunar-surface combustion experiment designed to measure actual 0.16g partial-gravity flame spread in 34% O2 / 10.2 psi habitats, currently bounded between 0g and 1g.",
    hardwareRack: "Future Lunar Lander",
    fuelPhase: "Solid",
    fuelSamples:
      "PMMA rods/sheets, SIBAL cotton-fiberglass fabric, and Nomex coupons in Artemis exploration atmospheres",
    o2RangePct: [21.0, 36.0],
    pressureRangePsi: [8.0, 10.5],
    airflowRangeCmS: [0.0, 25.0],
    gravityRegime: "Lunar Partial Gravity (0.16g, ~8.8 cm/s Natural Buoyant Draft)",
    intraFixedVars: [
      "Lunar surface 0.16g gravitational vector (~8.8 cm/s baseline buoyant plume)",
      "Artemis exploration cabin atmosphere target (34% O2, 8.2–10.2 psi)",
      "Standardized upward/concurrent solid sample orientation",
    ],
    intraSweptVars: [
      "Forced cabin ventilation superimposed onto 0.16g natural buoyant draft",
      "Oxygen margin around the bounded Lunar LOI envelope",
      "Sample thickness (0.1 mm thin film vs. 3 mm thick slab)",
    ],
    sensors: [
      "Compact Multispectral UV/IR Flame Imager",
      "TDLAS Laser CO / CO2 Gas Spectrometer",
      "Partial-Gravity Ultrasonic Anemometer",
    ],
    crossInvestigationLink: {
      relatedId: "ACME-E-FIELD",
      explanation:
        "Will validate APULA's bounded 0.16g envelope (interpolated between 0g BASS-II/SAFFIRE-3 and 1g baselines, and cross-checked by ACME-E-FIELD ion-wind buoyancy) with true lunar-surface flight data.",
    },
    earthSpinoff:
      "Hypobaric aviation cargo fire-suppression standards and pressurized medical hyperbaric chamber oxygen-safety rules.",
  },
  {
    id: "FM2",
    title: "Flammability of Materials on the Moon (FM2)",
    pillar: "Prevention",
    provenanceTier: "FUTURE_LUNAR_FLIGHT",
    provenanceBadgeText: "FUTURE LUNAR FLIGHT (Bounded via 0g/1g & E-FIELD)",
    purposeInSpaceSafety:
      "Upcoming lunar-surface material qualification testbed to certify Artemis habitat polymers, spacesuit textiles, and wire insulation at 0.16g before long-duration lunar habitation.",
    hardwareRack: "Future Lunar Lander",
    fuelPhase: "Solid",
    fuelSamples:
      "Habitat polymer composites, Nomex EVA outer layers, SIBAL calibration fabrics, and wire insulation under 34% O2",
    o2RangePct: [21.0, 36.0],
    pressureRangePsi: [7.5, 11.5],
    airflowRangeCmS: [0.0, 30.0],
    gravityRegime: "Lunar Partial Gravity (0.16g) & Exploration Atmospheric Envelopes",
    intraFixedVars: [
      "Lunar 0.16g gravity orientation fixture",
      "Reduced total pressure exploration atmosphere (8.2–10.2 psi)",
      "Standardized NASA-STD-6001 upward/opposed ignition protocol",
    ],
    intraSweptVars: [
      "Oxygen enrichment levels (21% Earth-air up to 34% Artemis Lunar Base)",
      "CO2 / inert gas dilution fraction for habitat fire suppression",
      "Material thickness and thermal backing conditions",
    ],
    sensors: [
      "Broadband Radiometer & High-Definition Flame Camera",
      "NDIR CO2 / TDLAS CO Toxic Gas Array",
      "Sample Backface Thermocouple Matrix",
    ],
    crossInvestigationLink: {
      relatedId: "LUCI",
      explanation:
        "Pairs with LUCI and scales NASA's 0g BASS-II/SAFFIRE-3 and 1g Earth material screening curves to 0.16g lunar surface habitation envelopes.",
    },
    earthSpinoff:
      "Enhanced fire-qualification curves for high-altitude aircraft cabins and oxygen-enriched clinical environments.",
  },
];

export function getRunCampaignId(run: NormalizedRun): string {
  const upper = run.experimentId.trim().toUpperCase();

  if (/^BASS-?II(?=[-:_\s]|$)/.test(upper)) return "BASS-II";
  if (/^BASS(?=[-:_\s]|$)/.test(upper)) return "BASS";
  if (/^SAFFIRE-?3(?=[-:_\s]|$)/.test(upper)) return "SAFFIRE-3";
  if (/^FLEX-?2(?=[-:_\s]|$)/.test(upper)) return "FLEX-2";
  if (/^FLEX(?=[-:_\s]|$)/.test(upper)) return "FLEX";
  if (/^SAME-?R(?=[-:_\s]|$)/.test(upper)) return "SAME-R";
  if (/^SAME(?=[-:_\s]|$)/.test(upper)) return "SAME";
  if (/^DAFT(?:-?2)?(?=[-:_\s]|$)/.test(upper)) return "DAFT";

  const colonIdx = upper.indexOf(":");
  if (colonIdx > 0) {
    return upper.slice(0, colonIdx).trim();
  }

  return "BASS-II";
}

function rangeDistance(value: number, [min, max]: [number, number]): number {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

function parseTargetGravity(gravityRegime: string): number {
  if (gravityRegime.includes("0.16g")) return 0.16;
  if (gravityRegime.includes("0.38g")) return 0.38;
  return 0;
}

export function rankPsiInvestigations(
  params: SimulationParams,
  pillarFilter: string,
  loadedRuns: readonly NormalizedRun[] = [],
): RankedPsiInvestigation[] {
  const normalizedFilter = pillarFilter.trim().toLowerCase();

  const rowCountsByCampaign = new Map<string, number>();
  for (const run of loadedRuns) {
    const campaignId = getRunCampaignId(run);
    rowCountsByCampaign.set(
      campaignId,
      (rowCountsByCampaign.get(campaignId) ?? 0) + 1,
    );
  }

  return PSI_INVESTIGATIONS.filter((inv) => {
    if (!normalizedFilter || normalizedFilter === "all") return true;
    return inv.pillar.toLowerCase() === normalizedFilter;
  })
    .map((inv): RankedPsiInvestigation => {
      const o2Dist = rangeDistance(params.o2Pct, inv.o2RangePct);
      const pressureDist = rangeDistance(
        params.pressurePsi,
        inv.pressureRangePsi,
      );
      const airflowDist = rangeDistance(
        params.airflowCmS,
        inv.airflowRangeCmS,
      );
      const targetG = parseTargetGravity(inv.gravityRegime);
      const gravityDist = Math.abs(params.gravityG - targetG);

      let penalty =
        o2Dist * 1.45 +
        pressureDist * 2.8 +
        airflowDist * 0.75 +
        gravityDist * 38;

      const reasons: string[] = [];

      if (o2Dist === 0) {
        reasons.push(
          `O2 (${params.o2Pct}%) inside [${inv.o2RangePct[0]}–${inv.o2RangePct[1]}%]`,
        );
      } else {
        reasons.push(`ΔO2 ${o2Dist.toFixed(1)}% from envelope`);
      }

      if (pressureDist === 0) {
        reasons.push(
          `P (${params.pressurePsi} psi) in [${inv.pressureRangePsi[0]}–${inv.pressureRangePsi[1]} psi]`,
        );
      }

      if (airflowDist === 0) {
        reasons.push(
          `Flow (${params.airflowCmS} cm/s) in [${inv.airflowRangeCmS[0]}–${inv.airflowRangeCmS[1]} cm/s]`,
        );
      }

      if (inv.id === "ACME-E-FIELD" && params.electricFieldVoltsCm > 0) {
        penalty -= 18;
        reasons.push(
          `Active E-field (${params.electricFieldVoltsCm} V/cm) matches ion-wind buoyancy model`,
        );
      }

      if (
        inv.id === "ACME-CFI-G" &&
        (params.material === "PROPANE_CFI_G" || params.o2Pct >= 45)
      ) {
        penalty -= 20;
        reasons.push(
          "High-O2 / Propane inside-out spherical burner regime",
        );
      }

      if (
        (inv.id === "FLEX" || inv.id === "FLEX-2") &&
        params.material === "HEPTANE_DROPLET"
      ) {
        penalty -= 18;
        reasons.push("Liquid heptane droplet fuel matches MDCA runs");
      }

      if (
        (inv.id === "BASS-II" ||
          inv.id === "BASS" ||
          inv.id === "SAFFIRE-3") &&
        (params.material.startsWith("PMMA") ||
          params.material === "SIBAL_FABRIC" ||
          params.material === "NOMEX")
      ) {
        penalty -= 10;
        reasons.push(`Solid fuel (${params.material}) tested in ${inv.id}`);
      }

      if (
        (inv.id === "LUCI" || inv.id === "FM2") &&
        Math.abs(params.gravityG - 0.16) <= 0.08
      ) {
        penalty -= 15;
        reasons.push("Lunar partial-gravity (0.16g) target regime");
      }

      if (inv.id === "ACME-BRE" && params.airflowCmS <= 3) {
        penalty -= 10;
        reasons.push("Low-flow still-air solid emulation regime");
      }

      const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
      const loadedRowCount = rowCountsByCampaign.get(inv.id) ?? 0;
      const whyRelevantForHabitat = reasons.join(" • ");

      return {
        ...inv,
        score,
        loadedRowCount,
        whyRelevantForHabitat,
        whyRelevant: whyRelevantForHabitat,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export const LOADED_MASTER_PSI_RUNS: NormalizedRun[] =
  loadMasterPsiDataset(MASTER_PSI_CSV);

export const SAMPLE_BASS_II_CSV = `PI,Test #,Date,GMT,Sample #,Fuel Sample Material,Flow restrictor,Fan display,Air display,Radiometer gain   (1000   250   50   10),Total Frames Shot,Calibrated  initial O2 % by vol ,Calibrated final O2 % by vol,Initial CO2 % by vol,Final CO2 % by vol,Initial CO (ppm),Final CO (ppm)
Ferkul,14007A1,3/18/2014,14:22,FA1,0.1 mm thick PMMA film 2 cm wide,In,22,10.5,250,48,20.9,20.4,0.42,0.58,12,38
Ferkul,14008A2,3/18/2014,15:10,FA2,"0.1 mm thick PMMA film, 2 cm wide",In,14,"8.0, 5.0, 2.0, 1.2 ext",250,64,20.8,20.1,0.44,0.69,15,94
Ferkul,14011A5,3/19/2014,11:05,FA5,0.1 mm thick PMMA sheet 2 cm wide,Out,38,"22.0, 35.0, 48.0 blow-off",1000,35,21.0,20.7,0.40,0.49,10,29`;
