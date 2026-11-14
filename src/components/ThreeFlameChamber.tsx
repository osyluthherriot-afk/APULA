// 60fps Three.js microgravity wind-tunnel chamber with additive-blended morphing sphere-to-teardrop flame meshes.
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  type AdvancedFlameField,
  type CombustionSimulationResult,
  type FlameRenderGeometry,
  generateAdvancedFlameField,
} from "@/lib/combustionPhysicsEngine";

export interface ThreeFlameChamberProps {
  simResult: CombustionSimulationResult;
  flameGeometry: FlameRenderGeometry;
  advancedField?: AdvancedFlameField;
}

interface OrbitState {
  isDragging: boolean;
  lastX: number;
  lastY: number;
  azimuth: number;
  elevation: number;
  distance: number;
}

// nuked the 5-branch morphology badge if-chain into a declarative rule table so the HUD header stays clean.
const MORPHOLOGY_BADGE_RULES: readonly {
  match: (sim: CombustionSimulationResult, geo: FlameRenderGeometry) => boolean;
  modeLabel: string;
  badgeColorClass: string;
}[] = [
  {
    match: (sim) => sim.regime === "NO_IGNITION_QUENCHED",
    modeLabel: "DIFFUSIVE QUENCHED (NO IGNITION)",
    badgeColorClass: "border-slate-500 bg-slate-900/90 text-slate-300",
  },
  {
    match: (sim) => sim.regime === "NO_IGNITION_BLOWOFF",
    modeLabel: "CONVECTIVE BLOWOFF (NO IGNITION)",
    badgeColorClass: "border-rose-500/70 bg-rose-950/90 text-rose-200",
  },
  {
    match: (sim, geo) => geo.isInsideOutBurner || sim.regime === "COOL_FLAME_CFI_G",
    modeLabel: "INSIDE-OUT COOL FLAME SPHERE (CFI-G)",
    badgeColorClass: "border-indigo-400/80 bg-indigo-950/90 text-indigo-200",
  },
  {
    match: (sim) => sim.gravityG < 0.05 && sim.airflowCmS < 2.5,
    modeLabel: "SPHERICAL DIFFUSION (0g)",
    badgeColorClass: "border-cyan-400/80 bg-cyan-950/90 text-cyan-200",
  },
  {
    match: (sim) => sim.gravityG >= 0.85,
    modeLabel: "BUOYANT TEARDROP (1g)",
    badgeColorClass: "border-amber-400/80 bg-amber-950/90 text-amber-200",
  },
];

function getMorphologyBadgeText(
  simResult: CombustionSimulationResult,
  flameGeometry: FlameRenderGeometry,
): { modeLabel: string; badgeColorClass: string } {
  return (
    MORPHOLOGY_BADGE_RULES.find((rule) => rule.match(simResult, flameGeometry)) ?? {
      modeLabel: "PARTIAL-G / FORCED-FLOW PLUME",
      badgeColorClass: "border-sky-400/80 bg-sky-950/90 text-sky-200",
    }
  );
}

const LASER_ALARM_COLORS: Record<
  AdvancedFlameField["chamberSensors"]["aerosolLaserBeam"]["alarmState"],
  string
> = {
  SMOKE_ALARM: "#EF4444",
  DUST_DISCRIMINATED: "#F59E0B",
  NOMINAL: "#10B981",
};

const LASER_BADGE_CLASSES: Record<
  AdvancedFlameField["chamberSensors"]["aerosolLaserBeam"]["alarmState"],
  string
> = {
  SMOKE_ALARM: "border-rose-500/80 bg-rose-950/90 text-rose-200",
  DUST_DISCRIMINATED: "border-amber-500/80 bg-amber-950/90 text-amber-200",
  NOMINAL: "border-emerald-500/80 bg-emerald-950/90 text-emerald-200",
};

// stretches the 3D sphere into a teardrop when gravity or airflow shows up, don't touch the aspect ratio math unless you want cursed geometry.
function deformFlameSphereGeometry(
  geometry: THREE.SphereGeometry,
  basePositions: Float32Array,
  layerScale: number,
  stretchFactor: number,
  taperStrength: number,
  radiusScale: number,
  tiltRad: number,
  timeSec: number,
  flickerHz: number,
  flickerAmp: number,
  isSphericalMode: boolean,
): void {
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  const count = posAttr.count;

  const dirX = Math.cos(tiltRad);
  const dirY = Math.sin(tiltRad);
  const perpX = -dirY;
  const perpY = dirX;

  const breath = isSphericalMode
    ? 1 + 0.038 * Math.sin(timeSec * 2.4 + layerScale * 1.3)
    : 1 + 0.018 * Math.sin(timeSec * 3.2);

  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    const bx = basePositions[idx];
    const by = basePositions[idx + 1];
    const bz = basePositions[idx + 2];

    const axial = bx * dirX + by * dirY;
    const transInPlane = bx * perpX + by * perpY;

    if (isSphericalMode) {
      const slightDrift = axial > 0 ? 1 + 0.08 * axial : 1 + 0.02 * axial;
      arr[idx] = bx * radiusScale * layerScale * breath * slightDrift;
      arr[idx + 1] = by * radiusScale * layerScale * breath;
      arr[idx + 2] = bz * radiusScale * layerScale * breath;
      continue;
    }

    let axialMapped: number;
    let radialEnvelope: number;

    if (axial >= 0) {
      const s = axial;
      const tipExtension = 1 + (stretchFactor - 1) * Math.pow(s, 0.82);
      axialMapped = s * tipExtension * radiusScale * layerScale * breath;

      const pinch = Math.max(0.06, 1 - taperStrength * Math.pow(s, 1.32));
      const midBelly = 1 + 0.22 * Math.sin(Math.min(1, s) * Math.PI);
      radialEnvelope = radiusScale * layerScale * pinch * midBelly;
    } else {
      const sBack = -axial;
      axialMapped =
        -sBack * (0.68 - 0.14 * sBack) * radiusScale * layerScale * breath;
      radialEnvelope = radiusScale * layerScale * (1 - 0.12 * sBack * sBack);
    }

    const downstreamFrac = Math.max(0, axial);
    const harmonicWave =
      flickerHz > 0
        ? Math.sin(
            timeSec * Math.PI * 2 * flickerHz -
              downstreamFrac * 4.6 +
              layerScale * 0.7,
          ) *
          Math.pow(downstreamFrac, 1.45) *
          flickerAmp
        : 0;
    const secondaryRipple =
      flickerHz > 0
        ? Math.cos(
            timeSec * Math.PI * 3.4 * flickerHz - downstreamFrac * 7.2,
          ) *
          Math.pow(downstreamFrac, 1.8) *
          (flickerAmp * 0.32)
        : 0;

    const displacedTrans =
      transInPlane * radialEnvelope + harmonicWave;
    const displacedZ =
      bz * radialEnvelope + secondaryRipple * 0.55;

    arr[idx] = axialMapped * dirX + displacedTrans * perpX;
    arr[idx + 1] = axialMapped * dirY + displacedTrans * perpY;
    arr[idx + 2] = displacedZ;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}

export default function ThreeFlameChamber({
  simResult,
  flameGeometry,
  advancedField,
}: ThreeFlameChamberProps) {
  const resolvedField = useMemo(
    () => advancedField ?? generateAdvancedFlameField(simResult),
    [advancedField, simResult],
  );

  const [showProbes, setShowProbes] = useState<boolean>(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<{
    simResult: CombustionSimulationResult;
    flameGeometry: FlameRenderGeometry;
    resolvedField: AdvancedFlameField;
    showProbes: boolean;
  }>({
    simResult,
    flameGeometry,
    resolvedField,
    showProbes,
  });

  useEffect(() => {
    simRef.current = {
      simResult,
      flameGeometry,
      resolvedField,
      showProbes,
    };
  }, [simResult, flameGeometry, resolvedField, showProbes]);

  const orbitRef = useRef<OrbitState>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    azimuth: 0.18,
    elevation: 0.16,
    distance: 6.4,
  });

  function handleResetCamera() {
    orbitRef.current.azimuth = 0.18;
    orbitRef.current.elevation = 0.16;
    orbitRef.current.distance = 6.4;
  }

  useEffect(() => {
    const container = mountRef.current;
    const outerWrapper = wrapperRef.current;
    if (!container || !outerWrapper) return;

    const width = Math.max(320, container.clientWidth || 640);
    const height = Math.max(280, container.clientHeight || 400);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050811");
    scene.fog = new THREE.FogExp2("#050811", 0.048);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight("#334155", 1.15);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight("#94A3B8", 0.9);
    keyLight.position.set(-4, 5, 6);
    scene.add(keyLight);

    const flamePointLight = new THREE.PointLight("#38BDF8", 2.8, 12, 1.6);
    flamePointLight.position.set(-0.8, 0.1, 0);
    scene.add(flamePointLight);

    const chamberGroup = new THREE.Group();
    scene.add(chamberGroup);

    const tunnelCylinderGeo = new THREE.CylinderGeometry(
      1.95,
      1.95,
      7.6,
      32,
      8,
      true,
    );
    tunnelCylinderGeo.rotateZ(Math.PI / 2);
    const tunnelWireMat = new THREE.MeshBasicMaterial({
      color: "#1E293B",
      wireframe: true,
      transparent: true,
      opacity: 0.32,
    });
    const tunnelMesh = new THREE.Mesh(tunnelCylinderGeo, tunnelWireMat);
    chamberGroup.add(tunnelMesh);

    for (const xRing of [-3.6, -1.8, 0, 1.8, 3.6]) {
      const ringGeo = new THREE.RingGeometry(1.91, 1.96, 48);
      ringGeo.rotateY(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: xRing === -1.8 ? "#38BDF8" : "#334155",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: xRing === -1.8 ? 0.45 : 0.28,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(xRing, 0, 0);
      chamberGroup.add(ringMesh);
    }

    const floorGrid = new THREE.GridHelper(7.4, 18, "#1E293B", "#0F172A");
    floorGrid.position.set(0, -1.85, 0);
    chamberGroup.add(floorGrid);

    const holderStingGeo = new THREE.CylinderGeometry(0.06, 0.09, 1.75, 16);
    const holderStingMat = new THREE.MeshStandardMaterial({
      color: "#475569",
      metalness: 0.75,
      roughness: 0.3,
    });
    const holderSting = new THREE.Mesh(holderStingGeo, holderStingMat);
    holderSting.position.set(-1.55, -0.98, 0);
    chamberGroup.add(holderSting);

    const sampleMountGeo = new THREE.BoxGeometry(0.42, 0.16, 0.34);
    const sampleMountMat = new THREE.MeshStandardMaterial({
      color: "#E2E8F0",
      metalness: 0.25,
      roughness: 0.45,
      emissive: "#0F172A",
    });
    const sampleMount = new THREE.Mesh(sampleMountGeo, sampleMountMat);
    sampleMount.position.set(-1.55, -0.08, 0);
    chamberGroup.add(sampleMount);

    const burnerPorousGeo = new THREE.IcosahedronGeometry(0.28, 2);
    const burnerPorousMat = new THREE.MeshStandardMaterial({
      color: "#818CF8",
      emissive: "#312E81",
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const burnerPorousMesh = new THREE.Mesh(burnerPorousGeo, burnerPorousMat);
    burnerPorousMesh.position.set(-1.55, 0, 0);
    chamberGroup.add(burnerPorousMesh);

    const eFieldGroup = new THREE.Group();
    const plateGeo = new THREE.PlaneGeometry(4.8, 1.9);
    plateGeo.rotateX(Math.PI / 2);
    const topPlateMat = new THREE.MeshBasicMaterial({
      color: "#38BDF8",
      wireframe: true,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
    });
    const botPlateMat = new THREE.MeshBasicMaterial({
      color: "#64748B",
      wireframe: true,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const topPlate = new THREE.Mesh(plateGeo, topPlateMat);
    topPlate.position.set(-0.2, 1.65, 0);
    const botPlate = new THREE.Mesh(plateGeo, botPlateMat);
    botPlate.position.set(-0.2, -1.65, 0);
    eFieldGroup.add(topPlate, botPlate);
    chamberGroup.add(eFieldGroup);

    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(2.45, 1.85, 0),
      new THREE.Vector3(2.45, -1.85, 0),
    ]);
    const laserMat = new THREE.LineBasicMaterial({
      color: "#10B981",
      transparent: true,
      opacity: 0.85,
    });
    const laserLine = new THREE.Line(laserGeo, laserMat);
    chamberGroup.add(laserLine);

    const probesGroup = new THREE.Group();
    const tcTips: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i += 1) {
      const tipGeo = new THREE.SphereGeometry(0.065, 14, 14);
      const tipMat = new THREE.MeshBasicMaterial({ color: "#F97316" });
      const tipMesh = new THREE.Mesh(tipGeo, tipMat);

      const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.8, 8);
      const stemMat = new THREE.MeshBasicMaterial({
        color: "#475569",
        transparent: true,
        opacity: 0.65,
      });
      const stemMesh = new THREE.Mesh(stemGeo, stemMat);
      stemMesh.position.set(0, -0.9, 0);
      tipMesh.add(stemMesh);

      probesGroup.add(tipMesh);
      tcTips.push(tipMesh);
    }

    const radConeGeo = new THREE.ConeGeometry(0.85, 2.2, 24, 1, true);
    const radConeMat = new THREE.MeshBasicMaterial({
      color: "#FACC15",
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const radConeMesh = new THREE.Mesh(radConeGeo, radConeMat);
    radConeMesh.position.set(-0.2, 0.75, 0);
    probesGroup.add(radConeMesh);
    chamberGroup.add(probesGroup);

    const flameGroup = new THREE.Group();
    flameGroup.position.set(-1.55, 0, 0);
    scene.add(flameGroup);

    const coreGeo = new THREE.SphereGeometry(1, 64, 64);
    const sootGeo = new THREE.SphereGeometry(1, 64, 64);
    const outerGeo = new THREE.SphereGeometry(1, 64, 64);

    const baseSpherePositions = new Float32Array(
      (coreGeo.attributes.position as THREE.BufferAttribute).array,
    );

    const coreMat = new THREE.MeshBasicMaterial({
      color: "#E0F2FE",
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const sootMat = new THREE.MeshBasicMaterial({
      color: "#FF7A00",
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const outerMat = new THREE.MeshBasicMaterial({
      color: "#00E5FF",
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    const sootMesh = new THREE.Mesh(sootGeo, sootMat);
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    flameGroup.add(coreMesh, sootMesh, outerMesh);

    const flowParticleCount = 120;
    const sootParticleCount = 60;
    const totalParticles = flowParticleCount + sootParticleCount;

    const particlePositions = new Float32Array(totalParticles * 3);
    const particleColors = new Float32Array(totalParticles * 3);
    const particleSeeds = new Float32Array(totalParticles);

    for (let i = 0; i < totalParticles; i += 1) {
      particleSeeds[i] = Math.random();
      const idx = i * 3;
      if (i < flowParticleCount) {
        particlePositions[idx] = -3.6 + Math.random() * 7.2;
        particlePositions[idx + 1] = (Math.random() - 0.5) * 2.8;
        particlePositions[idx + 2] = (Math.random() - 0.5) * 2.4;
        particleColors[idx] = 0.22;
        particleColors[idx + 1] = 0.74;
        particleColors[idx + 2] = 0.97;
      } else {
        particlePositions[idx] = -1.55 + Math.random() * 2.5;
        particlePositions[idx + 1] = (Math.random() - 0.3) * 1.2;
        particlePositions[idx + 2] = (Math.random() - 0.5) * 0.8;
        particleColors[idx] = 1.0;
        particleColors[idx + 1] = 0.55;
        particleColors[idx + 2] = 0.12;
      }
    }

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );
    particlesGeo.setAttribute(
      "color",
      new THREE.BufferAttribute(particleColors, 3),
    );

    const particlesMat = new THREE.PointsMaterial({
      size: 0.065,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particleSystem);

    let rafId: number | null = null;
    let isPausedByVisibility = false;
    let lastTimestamp = performance.now();
    let elapsedSec = 0;

    const renderLoop = (now: number) => {
      if (isPausedByVisibility) {
        rafId = null;
        return;
      }
      rafId = window.requestAnimationFrame(renderLoop);

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;
      elapsedSec += dt;

      const {
        simResult: curSim,
        flameGeometry: curGeo,
        resolvedField: curField,
        showProbes: curProbes,
      } = simRef.current;

      const isBurning = !curSim.regime.startsWith("NO_IGNITION");
      const isSpherical =
        isBurning && curSim.gravityG < 0.05 && curSim.airflowCmS < 2.5;
      const isCoolFlame =
        curGeo.isInsideOutBurner || curSim.regime === "COOL_FLAME_CFI_G";

      burnerPorousMesh.visible = isCoolFlame;
      sampleMount.visible = !isCoolFlame;
      holderSting.position.y = isCoolFlame ? -1.05 : -0.98;
      eFieldGroup.visible = curSim.electricFieldVoltsCm > 0;
      probesGroup.visible = curProbes;

      const alarmState = curField.chamberSensors.aerosolLaserBeam.alarmState;
      laserMat.color.set(LASER_ALARM_COLORS[alarmState]);

      // tilts and lifts the 3D flame group by atan2(buoyant+ion, fan) and standoffDistancePx so blowoff liftoff is physically visible.
      const tiltRad =
        (curField.flameDynamics.plumeTiltAngleDeg * Math.PI) / 180;
      const standoffWorld =
        (curField.flameDynamics.standoffDistancePx / 28) * 0.42;

      flameGroup.position.set(
        -1.55 + Math.cos(tiltRad) * standoffWorld,
        Math.sin(tiltRad) * standoffWorld,
        0,
      );

      // declarative 3D shader state table so we don't nest four else-ifs inside the 60fps loop.
      const sootStrength = Math.min(
        0.78,
        Math.max(
          0.18,
          curGeo.sootTailOpacity * 0.85 + (curSim.gravityG > 0.05 ? 0.22 : 0),
        ),
      );
      const shaderPresets = [
        {
          match: !isBurning,
          coreHex: "#E0F2FE",
          coreOp: 0.05,
          sootHex: "#FF7A00",
          sootOp: 0,
          outerHex: "#475569",
          outerOp: 0.12,
          lightHex: "#38BDF8",
          lightInt: 0.25,
        },
        {
          match: isCoolFlame,
          coreHex: "#C7D2FE",
          coreOp: 0.72,
          sootHex: "#6366F1",
          sootOp: 0.14,
          outerHex: "#818CF8",
          outerOp: 0.42,
          lightHex: "#818CF8",
          lightInt: 2.4,
        },
        {
          match: isSpherical,
          coreHex: "#00E5FF",
          coreOp: 0.78,
          sootHex: "#FF7A00",
          sootOp: 0,
          outerHex: "#38BDF8",
          outerOp: 0.42,
          lightHex: "#00E5FF",
          lightInt: 2.9,
        },
      ];
      const activeShader = shaderPresets.find((p) => p.match) ?? {
        coreHex: "#E0F2FE",
        coreOp: 0.85,
        sootHex: curSim.regime === "CRITICAL_ACCELERATED_BURN" ? "#FEF08A" : "#FF7A00",
        sootOp: sootStrength,
        outerHex: "#00E5FF",
        outerOp: 0.34,
        lightHex: "#FF9E44",
        lightInt:
          2.6 + 0.45 * Math.sin(elapsedSec * Math.max(2, curGeo.flickerFrequencyHz * 5)),
      };

      coreMat.color.set(activeShader.coreHex);
      coreMat.opacity = activeShader.coreOp;
      sootMat.color.set(activeShader.sootHex);
      sootMat.opacity = activeShader.sootOp;
      outerMat.color.set(activeShader.outerHex);
      outerMat.opacity = activeShader.outerOp;
      flamePointLight.color.set(activeShader.lightHex);
      flamePointLight.intensity = activeShader.lightInt;

      const radiusScale = Math.min(
        1.15,
        Math.max(0.36, curGeo.flameWidthMm / 42),
      );
      const stretchFactor = isSpherical
        ? 1.06
        : Math.min(4.4, Math.max(1.25, curGeo.aspectRatio * 1.18));
      const taperStrength = isSpherical
        ? 0.08
        : Math.min(0.88, 0.42 + (stretchFactor - 1) * 0.16);
      const flickerAmp =
        curGeo.flickerFrequencyHz > 0
          ? Math.min(0.22, 0.04 + curSim.gravityG * 0.09 + curSim.airflowCmS * 0.0025)
          : 0;

      deformFlameSphereGeometry(
        coreGeo,
        baseSpherePositions,
        0.52,
        stretchFactor * 0.72,
        taperStrength * 0.75,
        radiusScale,
        tiltRad,
        elapsedSec,
        curGeo.flickerFrequencyHz,
        flickerAmp * 0.55,
        isSpherical || isCoolFlame,
      );

      deformFlameSphereGeometry(
        sootGeo,
        baseSpherePositions,
        0.82,
        stretchFactor * 0.94,
        taperStrength * 0.92,
        radiusScale,
        tiltRad,
        elapsedSec,
        curGeo.flickerFrequencyHz,
        flickerAmp * 0.85,
        isSpherical || isCoolFlame,
      );

      deformFlameSphereGeometry(
        outerGeo,
        baseSpherePositions,
        1.08,
        stretchFactor * 1.05,
        taperStrength * 0.82,
        radiusScale,
        tiltRad,
        elapsedSec,
        curGeo.flickerFrequencyHz,
        flickerAmp,
        isSpherical || isCoolFlame,
      );

      if (curProbes) {
        const tipLenWorld = radiusScale * stretchFactor * 1.05;
        curField.chamberSensors.thermocoupleRake.forEach((probe, idx) => {
          const mesh = tcTips[idx];
          if (!mesh) return;
          const frac = 0.25 + idx * 0.22;
          const dist = Math.max(0.55, tipLenWorld * frac);
          mesh.position.set(
            flameGroup.position.x + Math.cos(tiltRad) * dist,
            flameGroup.position.y + Math.sin(tiltRad) * dist,
            0,
          );
          (mesh.material as THREE.MeshBasicMaterial).color.set(probe.colorHex);
        });
      }

      const pAttr = particlesGeo.attributes.position as THREE.BufferAttribute;
      const cAttr = particlesGeo.attributes.color as THREE.BufferAttribute;
      const pArr = pAttr.array as Float32Array;
      const cArr = cAttr.array as Float32Array;

      const vx = Math.max(0.35, curSim.airflowCmS * 0.14);
      const vy =
        (curSim.buoyantVelocityCmS + curSim.ionWindVelocityCmS) * 0.085;

      for (let i = 0; i < totalParticles; i += 1) {
        const idx = i * 3;
        if (i < flowParticleCount) {
          pArr[idx] += vx * dt;
          if (pArr[idx] > -1.6) {
            pArr[idx + 1] += vy * dt * 0.55;
          }
          if (pArr[idx] > 3.6 || pArr[idx + 1] > 1.85) {
            pArr[idx] = -3.6;
            pArr[idx + 1] = (particleSeeds[i] - 0.5) * 2.7;
            pArr[idx + 2] = (Math.sin(i * 12.7) * 0.5) * 2.2;
          }
          const ionOn = curSim.electricFieldVoltsCm > 0;
          cArr[idx] = ionOn ? 0.22 : 0.38;
          cArr[idx + 1] = ionOn ? 0.85 : 0.65;
          cArr[idx + 2] = 0.98;
        } else {
          if (!isBurning || isSpherical) {
            pArr[idx] = -1.55;
            pArr[idx + 1] = -99;
            pArr[idx + 2] = 0;
          } else {
            if (pArr[idx + 1] < -10) {
              pArr[idx] = flameGroup.position.x;
              pArr[idx + 1] = flameGroup.position.y;
              pArr[idx + 2] = (particleSeeds[i] - 0.5) * 0.3;
            }
            const plumeSpeed = Math.max(0.9, (vx + vy) * 0.85);
            pArr[idx] += Math.cos(tiltRad) * plumeSpeed * dt;
            pArr[idx + 1] +=
              Math.sin(tiltRad) * plumeSpeed * dt +
              Math.sin(elapsedSec * 6 + i) * 0.008;
            const distFromOrigin = Math.hypot(
              pArr[idx] - flameGroup.position.x,
              pArr[idx + 1] - flameGroup.position.y,
            );
            if (distFromOrigin > Math.max(1.2, stretchFactor * radiusScale * 1.45)) {
              pArr[idx] =
                flameGroup.position.x +
                Math.cos(tiltRad) * (particleSeeds[i] * 0.35);
              pArr[idx + 1] =
                flameGroup.position.y +
                Math.sin(tiltRad) * (particleSeeds[i] * 0.35);
              pArr[idx + 2] = (Math.cos(i * 7.3) * 0.5) * 0.28;
            }
          }
        }
      }
      pAttr.needsUpdate = true;
      cAttr.needsUpdate = true;

      const orbit = orbitRef.current;
      const camX =
        orbit.distance * Math.cos(orbit.elevation) * Math.sin(orbit.azimuth);
      const camY = orbit.distance * Math.sin(orbit.elevation);
      const camZ =
        orbit.distance * Math.cos(orbit.elevation) * Math.cos(orbit.azimuth);
      camera.position.set(camX - 0.35, camY, camZ);
      camera.lookAt(-0.35, 0.05, 0);

      renderer.render(scene, camera);
    };

    const startLoop = () => {
      if (rafId === null) {
        lastTimestamp = performance.now();
        rafId = window.requestAnimationFrame(renderLoop);
      }
    };

    const stopLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    startLoop();

    const handleContentVisibility = (event: Event) => {
      const cvEvent = event as Event & { skipped?: boolean };
      if (cvEvent.skipped) {
        isPausedByVisibility = true;
        stopLoop();
      } else {
        isPausedByVisibility = false;
        startLoop();
      }
    };

    outerWrapper.addEventListener(
      "contentvisibilityautostatechange",
      handleContentVisibility,
    );

    let intersectionObserver: IntersectionObserver | null = null;
    const supportsContentVisibility =
      typeof document !== "undefined" &&
      "contentVisibility" in document.documentElement.style;

    if (!supportsContentVisibility && typeof IntersectionObserver !== "undefined") {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              isPausedByVisibility = false;
              startLoop();
            } else {
              isPausedByVisibility = true;
              stopLoop();
            }
          });
        },
        { rootMargin: "200px" },
      );
      intersectionObserver.observe(outerWrapper);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, entry.contentRect.width);
        const h = Math.max(280, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    return () => {
      stopLoop();
      outerWrapper.removeEventListener(
        "contentvisibilityautostatechange",
        handleContentVisibility,
      );
      if (intersectionObserver) intersectionObserver.disconnect();
      resizeObserver.disconnect();
      coreGeo.dispose();
      sootGeo.dispose();
      outerGeo.dispose();
      coreMat.dispose();
      sootMat.dispose();
      outerMat.dispose();
      particlesGeo.dispose();
      particlesMat.dispose();
      tunnelCylinderGeo.dispose();
      tunnelWireMat.dispose();
      renderer.dispose();
    };
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    orbitRef.current.isDragging = true;
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!orbitRef.current.isDragging) return;
    const dx = e.clientX - orbitRef.current.lastX;
    const dy = e.clientY - orbitRef.current.lastY;
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
    orbitRef.current.azimuth = Math.max(
      -1.35,
      Math.min(1.35, orbitRef.current.azimuth - dx * 0.0075),
    );
    orbitRef.current.elevation = Math.max(
      -0.65,
      Math.min(1.05, orbitRef.current.elevation + dy * 0.0065),
    );
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    orbitRef.current.isDragging = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    orbitRef.current.distance = Math.max(
      3.6,
      Math.min(10.5, orbitRef.current.distance + e.deltaY * 0.004),
    );
  }

  const { modeLabel, badgeColorClass } = getMorphologyBadgeText(
    simResult,
    flameGeometry,
  );
  const laserSensor = resolvedField.chamberSensors.aerosolLaserBeam;

  return (
    <div
      ref={wrapperRef}
      style={
        {
          contentVisibility: "auto",
          containIntrinsicSize: "auto none auto 460px",
        } as React.CSSProperties
      }
      className="relative w-full border border-slate-700 bg-slate-950 overflow-hidden select-none"
    >
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleResetCamera}
        onWheel={handleWheel}
        className="w-full h-[420px] cursor-grab active:cursor-grabbing"
      />

      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5 max-w-[70%]">
        <div
          className={`inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide backdrop-blur-md ${badgeColorClass}`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse" />
          <span>3D MORPHOLOGY: {modeLabel}</span>
        </div>
        <div className="inline-flex items-center gap-2 border border-slate-700/80 bg-slate-900/75 px-2.5 py-0.5 font-mono text-[10px] text-slate-300 backdrop-blur-sm w-fit">
          <span>Drag to Orbit 360° • Scroll to Zoom • Double-Click Reset</span>
        </div>
      </div>

      <div className=" absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetCamera}
            className="border border-slate-600 bg-slate-900/85 hover:bg-slate-800 text-slate-200 px-2.5 py-1 font-mono text-[11px] backdrop-blur-md transition"
          >
            Reset View
          </button>
          <button
            type="button"
            onClick={() => setShowProbes((prev) => !prev)}
            className={`border px-3 py-1 font-mono text-[11px] font-bold backdrop-blur-md transition ${
              showProbes
                ? "border-amber-400 bg-amber-500/20 text-amber-200"
                : "border-slate-600 bg-slate-900/85 hover:bg-slate-800 text-slate-200"
            }`}
          >
            {showProbes ? "Hide Sensor Probes" : "Show Sensor Probes"}
          </button>
        </div>

        {showProbes && (
          <div className="w-56 border border-slate-700 bg-slate-900/90 p-2.5 font-mono text-[10px] text-slate-200 backdrop-blur-md shadow-xl space-y-2">
            <div className="border-b border-slate-700 pb-1 font-bold uppercase text-amber-300 flex justify-between">
              <span>Chamber Probe Array</span>
              <span>5x TC + RAD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Radiometer Flux:</span>
              <span className="font-bold text-yellow-300">
                {resolvedField.chamberSensors.radiometer.radiativeFluxKwM2} kW/m²
              </span>
            </div>
            <div className="space-y-1">
              {resolvedField.chamberSensors.thermocoupleRake.map((tip, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border-t border-slate-800/80 pt-1"
                >
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: tip.colorHex }}
                    />
                    TC-{idx + 1} Probe
                  </span>
                  <span className="font-bold" style={{ color: tip.colorHex }}>
                    {tip.tempK} K
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-0 inset-x-0 border-t border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-slate-700 bg-slate-900 px-2 py-0.5">
              Length: <strong>{flameGeometry.flameLengthMm} mm</strong>
            </span>
            <span className="border border-slate-700 bg-slate-900 px-2 py-0.5">
              Width: <strong>{flameGeometry.flameWidthMm} mm</strong>
            </span>
            <span className="border border-slate-700 bg-slate-900 px-2 py-0.5">
              Aspect Ratio: <strong>{flameGeometry.aspectRatio}</strong>
            </span>
            <span className="border border-slate-700 bg-slate-900 px-2 py-0.5">
              Plume Tilt:{" "}
              <strong>{resolvedField.flameDynamics.plumeTiltAngleDeg}°</strong>
            </span>
            <span className="border border-slate-700 bg-slate-900 px-2 py-0.5">
              Standoff:{" "}
              <strong>{resolvedField.flameDynamics.standoffDistancePx} px</strong>
            </span>
            <span className="border border-slate-700 bg-slate-900 px-2 py-0.5">
              Flicker: <strong>{flameGeometry.flickerFrequencyHz} Hz</strong>
            </span>
          </div>

          <div
            className={`border px-2.5 py-0.5 font-bold ${LASER_BADGE_CLASSES[laserSensor.alarmState]}`}
          >
            PIMS/DAFT LASER: {laserSensor.alarmState} (
            {laserSensor.meanParticleDiameterUm} µm •{" "}
            {laserSensor.obscurationPct}% obs)
          </div>
        </div>
      </div>
    </div>
  );
}
