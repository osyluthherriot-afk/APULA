// spreads out the 3A & 3B flammability phase charts with 12-38% O2 boundary focus, smooth thermal gradients, and clustered telemetry pins so the SVG doesn't freak out 💭
"use client";

import React, { useMemo, useState } from "react";
import {
  type EmpiricalTelemetryNode,
  type FlammabilityEnvelopeData,
  type FlammabilityPhaseMatrix,
  type SimulationParams,
  METRIC_PROVENANCE_LABELS,
} from "@/lib/combustionPhysicsEngine";

export interface FlammabilityPhaseChartsProps {
  params: SimulationParams;
  envelopeData: FlammabilityEnvelopeData;
  phaseMatrix: FlammabilityPhaseMatrix;
}

interface BinnedTelemetryCluster {
  clusterKey: string;
  xVal: number;
  o2Pct: number;
  count: number;
  dominantColorHex: string;
  campaigns: string[];
  sampleLabel: string;
  sampleMetric: string;
  defaultedPressureCount: number;
  inferredGeometryCount: number;
}

// shoves ISS (0g) and Earth (1g) callout labels apart via a flat offset lookup so they stop touching at (14.7 psi, 21% O2) 🥸
const HABITAT_CALLOUT_OFFSETS: Record<
  string,
  { dx: number; dy: number; anchor: "start" | "end" }
> = {
  ISS: { dx: -18, dy: -18, anchor: "end" },
  Earth: { dx: -18, dy: 20, anchor: "end" },
  "Lunar Base": { dx: -14, dy: -12, anchor: "end" },
  "Mars Habitat Reference": { dx: -14, dy: 16, anchor: "end" },
};

// grabs overlapping scatter pins and shoves them into binned clusters before 654 raw SVG circles spread all over each other 💦
function buildBinnedClusters(
  nodes: readonly EmpiricalTelemetryNode[],
  mode: "pressure" | "airflow",
): BinnedTelemetryCluster[] {
  const map = new Map<
    string,
    {
      xSum: number;
      o2Sum: number;
      count: number;
      colorCounts: Map<string, number>;
      campaigns: Set<string>;
      sampleLabel: string;
      sampleMetric: string;
      defaultedPressureCount: number;
      inferredGeometryCount: number;
    }
  >();

  for (const node of nodes) {
    const rawX = mode === "pressure" ? node.pressurePsi : node.airflowCmS;
    const binX =
      mode === "pressure"
        ? Math.round(rawX * 2) / 2
        : Math.round(rawX / 2) * 2;
    const binO2 = Math.round(node.o2Pct);
    const key = `${binX}:${binO2}`;
    const isDefaultedPressure = node.fieldProvenance?.pressure === "DEFAULTED" ? 1 : 0;
    const isInferredGeo =
      node.fieldProvenance?.geometry === "INFERRED" ||
      node.fieldProvenance?.thickness === "INFERRED"
        ? 1
        : 0;

    const existing = map.get(key);
    if (!existing) {
      const colorCounts = new Map<string, number>();
      colorCounts.set(node.nodeColorHex, 1);
      map.set(key, {
        xSum: rawX,
        o2Sum: node.o2Pct,
        count: 1,
        colorCounts,
        campaigns: new Set([node.experimentId]),
        sampleLabel: node.label,
        sampleMetric: node.keyMetricText,
        defaultedPressureCount: isDefaultedPressure,
        inferredGeometryCount: isInferredGeo,
      });
    } else {
      existing.xSum += rawX;
      existing.o2Sum += node.o2Pct;
      existing.count += 1;
      existing.colorCounts.set(
        node.nodeColorHex,
        (existing.colorCounts.get(node.nodeColorHex) ?? 0) + 1,
      );
      existing.campaigns.add(node.experimentId);
      existing.defaultedPressureCount += isDefaultedPressure;
      existing.inferredGeometryCount += isInferredGeo;
    }
  }

  const result: BinnedTelemetryCluster[] = [];
  for (const [clusterKey, entry] of map.entries()) {
    let dominantColorHex = "#38BDF8";
    let bestCount = -1;
    for (const [color, c] of entry.colorCounts.entries()) {
      if (c > bestCount) {
        bestCount = c;
        dominantColorHex = color;
      }
    }
    result.push({
      clusterKey,
      xVal: Number((entry.xSum / entry.count).toFixed(2)),
      o2Pct: Number((entry.o2Sum / entry.count).toFixed(1)),
      count: entry.count,
      dominantColorHex,
      campaigns: Array.from(entry.campaigns),
      sampleLabel: entry.sampleLabel,
      sampleMetric: entry.sampleMetric,
      defaultedPressureCount: entry.defaultedPressureCount,
      inferredGeometryCount: entry.inferredGeometryCount,
    });
  }
  return result;
}

export default function FlammabilityPhaseCharts({
  params,
  envelopeData,
  phaseMatrix,
}: FlammabilityPhaseChartsProps) {
  const [zoomMode, setZoomMode] = useState<"focus" | "full">("focus");
  const [showEmpiricalPins, setShowEmpiricalPins] = useState<boolean>(false);
  const [hoveredCluster3A, setHoveredCluster3A] =
    useState<BinnedTelemetryCluster | null>(null);
  const [hoveredCluster3B, setHoveredCluster3B] =
    useState<BinnedTelemetryCluster | null>(null);

  const isFocus = zoomMode === "focus";
  const yMin = isFocus ? 12 : 0;
  const yMax = isFocus ? 38 : 100;
  const yTicks = isFocus
    ? [12, 16, 20, 24, 28, 32, 36, 38]
    : [0, 20, 40, 60, 80, 100];

  const chartW = 560;
  const chartH = 310;
  const padL = 46;
  const padR = 18;
  const padT = isFocus ? 42 : 22;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const mapPressureX = (pPsi: number) =>
    padL + ((Math.min(15, Math.max(4, pPsi)) - 4) / (15 - 4)) * plotW;

  const mapAirflowX = (flowCmS: number) =>
    padL + (Math.min(50, Math.max(0, flowCmS)) / 50) * plotW;

  const mapO2Y = (o2: number) => {
    const clamped = Math.min(yMax, Math.max(yMin, o2));
    return padT + plotH - ((clamped - yMin) / (yMax - yMin)) * plotH;
  };

  const mapO2YUnclamped = (o2: number) =>
    padT + plotH - ((o2 - yMin) / (yMax - yMin)) * plotH;

  const clusters3A = useMemo(
    () => buildBinnedClusters(phaseMatrix.empiricalTelemetryNodes, "pressure"),
    [phaseMatrix.empiricalTelemetryNodes],
  );

  const clusters3B = useMemo(
    () => buildBinnedClusters(phaseMatrix.empiricalTelemetryNodes, "airflow"),
    [phaseMatrix.empiricalTelemetryNodes],
  );

  const pressureCurvePoints = (
    selector: (
      pt: FlammabilityEnvelopeData["o2VsPressureCurve"][number],
    ) => number,
  ) =>
    envelopeData.o2VsPressureCurve
      .map(
        (pt) =>
          `${mapPressureX(pt.pressurePsi).toFixed(1)},${mapO2YUnclamped(selector(pt)).toFixed(1)}`,
      )
      .join(" ");

  const dangerAreaPath3A = useMemo(() => {
    const pts = envelopeData.o2VsPressureCurve;
    if (pts.length === 0) return "";
    const forward = pts
      .map(
        (pt, idx) =>
          `${idx === 0 ? "M" : "L"} ${mapPressureX(pt.pressurePsi).toFixed(1)} ${mapO2YUnclamped(pt.loi_0g_ventilated).toFixed(1)}`,
      )
      .join(" ");
    const rightX = mapPressureX(pts[pts.length - 1].pressurePsi).toFixed(1);
    const leftX = mapPressureX(pts[0].pressurePsi).toFixed(1);
    return `${forward} L ${rightX} ${padT} L ${leftX} ${padT} Z`;
  }, [envelopeData.o2VsPressureCurve, padT, zoomMode]);

  const safeAreaPath3A = useMemo(() => {
    const pts = envelopeData.o2VsPressureCurve;
    if (pts.length === 0) return "";
    const forward = pts
      .map(
        (pt, idx) =>
          `${idx === 0 ? "M" : "L"} ${mapPressureX(pt.pressurePsi).toFixed(1)} ${mapO2YUnclamped(pt.loi_1g_earth).toFixed(1)}`,
      )
      .join(" ");
    const rightX = mapPressureX(pts[pts.length - 1].pressurePsi).toFixed(1);
    const leftX = mapPressureX(pts[0].pressurePsi).toFixed(1);
    const botY = (padT + plotH).toFixed(1);
    return `${forward} L ${rightX} ${botY} L ${leftX} ${botY} Z`;
  }, [envelopeData.o2VsPressureCurve, padT, plotH, zoomMode]);

  const boundingPolygonPoints3A = useMemo(
    () =>
      phaseMatrix.partialGravityBoundingPolygon
        .map(
          (pt) =>
            `${mapPressureX(pt.x).toFixed(1)},${mapO2YUnclamped(pt.y).toFixed(1)}`,
        )
        .join(" "),
    [phaseMatrix.partialGravityBoundingPolygon, zoomMode],
  );

  const isoPolyline = (points: { pressurePsi: number; o2Pct: number }[]) =>
    points
      .map(
        (pt) =>
          `${mapPressureX(pt.pressurePsi).toFixed(1)},${mapO2YUnclamped(pt.o2Pct).toFixed(1)}`,
      )
      .join(" ");

  const preBreathePolyline = useMemo(
    () =>
      phaseMatrix.preBreatheTradeoffVector
        .map(
          (pt) =>
            `${mapPressureX(pt.pressurePsi).toFixed(1)},${mapO2YUnclamped(pt.o2Pct).toFixed(1)}`,
        )
        .join(" "),
    [phaseMatrix.preBreatheTradeoffVector, zoomMode],
  );

  const airflowPolyline3B = useMemo(
    () =>
      envelopeData.o2VsAirflowCurve
        .map(
          (pt) =>
            `${mapAirflowX(pt.airflowCmS).toFixed(1)},${mapO2YUnclamped(pt.limitingO2Pct).toFixed(1)}`,
        )
        .join(" "),
    [envelopeData.o2VsAirflowCurve, zoomMode],
  );

  const dangerAreaPath3B = useMemo(() => {
    const pts = envelopeData.o2VsAirflowCurve;
    if (pts.length === 0) return "";
    const forward = pts
      .map(
        (pt, idx) =>
          `${idx === 0 ? "M" : "L"} ${mapAirflowX(pt.airflowCmS).toFixed(1)} ${mapO2YUnclamped(pt.limitingO2Pct).toFixed(1)}`,
      )
      .join(" ");
    const rightX = mapAirflowX(pts[pts.length - 1].airflowCmS).toFixed(1);
    const leftX = mapAirflowX(pts[0].airflowCmS).toFixed(1);
    return `${forward} L ${rightX} ${padT} L ${leftX} ${padT} Z`;
  }, [envelopeData.o2VsAirflowCurve, padT, zoomMode]);

  const minLoiPoint3B = useMemo(() => {
    return envelopeData.o2VsAirflowCurve.reduce(
      (best, cur) => (cur.limitingO2Pct < best.limitingO2Pct ? cur : best),
      envelopeData.o2VsAirflowCurve[0] ?? { airflowCmS: 8, limitingO2Pct: 14.5 },
    );
  }, [envelopeData.o2VsAirflowCurve]);

  // grabs the leader-line offset for each habitat pin from the lookup table so zero else-if branches touch the render loop.
  const habitatCallouts3A = useMemo(() => {
    return envelopeData.habitatPins.map((pin) => {
      const cx = mapPressureX(pin.pressurePsi);
      const cy = mapO2Y(pin.o2Pct);
      const offset = HABITAT_CALLOUT_OFFSETS[pin.name] ?? {
        dx: 8,
        dy: -6,
        anchor: "start" as const,
      };
      return {
        ...pin,
        cx,
        cy,
        labelX: cx + offset.dx,
        labelY: cy + offset.dy,
        anchor: offset.anchor,
      };
    });
  }, [envelopeData.habitatPins, zoomMode]);

  const evaPin = envelopeData.habitatPins.find((p) => p.name === "EVA Suit");
  const lunarPin = envelopeData.habitatPins.find(
    (p) => p.name === "Lunar Base",
  );

  return (
    <div className="space-y-4">
      <div className="ap-subcard flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="ap-text-2 font-mono text-xs font-bold uppercase">
            Y-Axis Scale Mode:
          </span>
          <button
            type="button"
            onClick={() => setZoomMode("focus")}
            className={`px-2.5 py-1 font-mono text-xs font-bold transition ${
              isFocus ? "ap-pill-active" : "ap-pill"
            }`}
          >
            Focus: 12%–38% O2 Boundary Zone
          </button>
          <button
            type="button"
            onClick={() => setZoomMode("full")}
            className={`px-2.5 py-1 font-mono text-xs font-bold transition ${
              !isFocus ? "ap-pill-active" : "ap-pill"
            }`}
          >
            Full Scale: 0%–100% O2
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEmpiricalPins((prev) => !prev)}
            className={`px-3 py-1.5 text-[12px] font-medium transition ${
              showEmpiricalPins ? "ap-pill-active" : "ap-pill"
            }`}
          >
            {showEmpiricalPins
              ? `Hide Empirical Pins (${phaseMatrix.empiricalTelemetryNodes.length})`
              : `Show Empirical Pins (${phaseMatrix.empiricalTelemetryNodes.length} → ${clusters3A.length} Clusters)`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ap-card p-6">
          <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
            <div>
              <span className="ap-eyebrow block">Gravity &amp; Pressure Envelope</span>
              <h3 className="ap-h3 mt-0.5">
                3A. Partial-Gravity Bounding Envelope (O2% vs Pressure psi)
              </h3>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <span className="ap-prov-estimated">
                  {METRIC_PROVENANCE_LABELS.partialGravityBoundaries.badge}
                </span>
                <span className="ap-prov-measured">
                  {METRIC_PROVENANCE_LABELS.empiricalFlightPins.badge}
                </span>
              </div>
            </div>
            <span className="ap-text-3 font-mono text-[11px] tabular-nums">
              X: 4–15 psi · Y: {yMin}–{yMax}% O2 ({isFocus ? "Boundary Zoom" : "Full Scale"})
            </span>
          </div>

          <div className="relative isolate">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="ap-chart-well w-full mb-3"
            >
              <defs>
                <clipPath id="chart3a-smooth-clip">
                  <rect x={padL} y={padT} width={plotW} height={plotH} />
                </clipPath>
                <linearGradient
                  id="grad3a-danger-zone"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.28} />
                  <stop offset="55%" stopColor="#F59E0B" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient
                  id="grad3a-safe-zone"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#064E3B" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#022C22" stopOpacity={0.35} />
                </linearGradient>
                <linearGradient
                  id="grad3a-corridor"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity={0.22} />
                </linearGradient>
              </defs>

              {isFocus && (
                <g>
                  <rect
                    x={padL}
                    y={6}
                    width={plotW}
                    height={28}
                    fill="#0F172A"
                    stroke="#334155"
                    strokeDasharray="3 2"
                  />
                  <text
                    x={padL + 8}
                    y={18}
                    fontSize={8.5}
                    fontFamily="monospace"
                    fill="#94A3B8"
                  >
                    UPPER SCALE BREAK TRACK (&gt;38% O2):
                  </text>
                  {evaPin && lunarPin && (
                    <g>
                      <circle
                        cx={mapPressureX(evaPin.pressurePsi)}
                        cy={24}
                        r={4.5}
                        fill="#EF4444"
                        stroke="#FFFFFF"
                        strokeWidth={1}
                      />
                      <text
                        x={mapPressureX(evaPin.pressurePsi) + 8}
                        y={27}
                        fontSize={9}
                        fontFamily="monospace"
                        fontWeight="bold"
                        fill="#FCA5A5"
                      >
                        EVA Suit (100% O2, 4.3 psi) — Decompression Target
                      </text>
                      <line
                        x1={mapPressureX(evaPin.pressurePsi) + 4}
                        y1={28}
                        x2={mapPressureX(lunarPin.pressurePsi) - 4}
                        y2={mapO2Y(lunarPin.o2Pct) - 4}
                        stroke="#E879F9"
                        strokeWidth={1.3}
                        strokeDasharray="3 2"
                      />
                    </g>
                  )}
                </g>
              )}

              <g clipPath="url(#chart3a-smooth-clip)">
                <rect
                  x={padL}
                  y={padT}
                  width={plotW}
                  height={plotH}
                  fill="#070B14"
                />

                {dangerAreaPath3A && (
                  <path d={dangerAreaPath3A} fill="url(#grad3a-danger-zone)" />
                )}

                {safeAreaPath3A && (
                  <path d={safeAreaPath3A} fill="url(#grad3a-safe-zone)" />
                )}

                {boundingPolygonPoints3A && (
                  <polygon
                    points={boundingPolygonPoints3A}
                    fill="url(#grad3a-corridor)"
                    stroke="#38BDF8"
                    strokeWidth={0.8}
                    strokeOpacity={0.6}
                  />
                )}
              </g>

              {yTicks.map((o2Val) => (
                <g key={o2Val}>
                  <line
                    x1={padL}
                    y1={mapO2Y(o2Val)}
                    x2={chartW - padR}
                    y2={mapO2Y(o2Val)}
                    stroke="#1E293B"
                    strokeWidth={0.9}
                  />
                  <text
                    x={padL - 6}
                    y={mapO2Y(o2Val) + 3}
                    textAnchor="end"
                    fontSize={9.5}
                    fontFamily="monospace"
                    fill="#94A3B8"
                  >
                    {o2Val}%
                  </text>
                </g>
              ))}

              {[4, 6, 8, 10, 12, 14.7].map((pVal) => (
                <g key={pVal}>
                  <line
                    x1={mapPressureX(pVal)}
                    y1={padT}
                    x2={mapPressureX(pVal)}
                    y2={chartH - padB}
                    stroke="#1E293B"
                    strokeWidth={0.9}
                  />
                  <text
                    x={mapPressureX(pVal)}
                    y={chartH - 12}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontFamily="monospace"
                    fill="#94A3B8"
                  >
                    {pVal} psi
                  </text>
                </g>
              ))}

              <g clipPath="url(#chart3a-smooth-clip)">
                {[
                  phaseMatrix.isoSpreadContours.slowCreep1MmS,
                  phaseMatrix.isoSpreadContours.rapidCabin5MmS,
                  phaseMatrix.isoSpreadContours.flashoverEva15MmS,
                ].map((contour) => (
                  <polyline
                    key={contour.label}
                    fill="none"
                    stroke={contour.colorHex}
                    strokeWidth={1.15}
                    strokeDasharray="3 3"
                    strokeOpacity={0.72}
                    points={isoPolyline(contour.points)}
                  />
                ))}

                <polyline
                  fill="none"
                  stroke="#F8FAFC"
                  strokeWidth={2.4}
                  points={pressureCurvePoints((pt) => pt.loi_0g_ventilated)}
                />
                <polyline
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  points={pressureCurvePoints(
                    (pt) => pt.loi_lunar_016g_bounded,
                  )}
                />
                <polyline
                  fill="none"
                  stroke="#FB923C"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  points={pressureCurvePoints((pt) => pt.loi_mars_038g_bounded)}
                />
                <polyline
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  points={pressureCurvePoints((pt) => pt.loi_1g_earth)}
                />

                <polyline
                  fill="none"
                  stroke="#E879F9"
                  strokeWidth={1.6}
                  strokeDasharray="5 3"
                  points={preBreathePolyline}
                />

                {showEmpiricalPins &&
                  clusters3A.map((cluster) => {
                    if (cluster.o2Pct < yMin || cluster.o2Pct > yMax) {
                      return null;
                    }
                    const cx = mapPressureX(cluster.xVal);
                    const cy = mapO2Y(cluster.o2Pct);
                    const r = Math.min(
                      8,
                      2.6 + Math.log2(cluster.count + 1) * 1.15,
                    );
                    return (
                      <g
                        key={cluster.clusterKey}
                        onMouseEnter={() => setHoveredCluster3A(cluster)}
                        onMouseLeave={() => setHoveredCluster3A(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={cluster.dominantColorHex}
                          fillOpacity={0.82}
                          stroke="#0F172A"
                          strokeWidth={1}
                        />
                        {cluster.count > 1 && (
                          <text
                            x={cx}
                            y={cy + 2.5}
                            textAnchor="middle"
                            fontSize={7}
                            fontFamily="monospace"
                            fontWeight="bold"
                            fill="#FFFFFF"
                          >
                            {cluster.count}
                          </text>
                        )}
                      </g>
                    );
                  })}

                {habitatCallouts3A.map((pin) => {
                  if (isFocus && pin.name === "EVA Suit") return null;
                  return (
                    <g key={pin.name}>
                      <polyline
                        fill="none"
                        stroke="#94A3B8"
                        strokeWidth={1}
                        points={`${pin.cx.toFixed(1)},${pin.cy.toFixed(1)} ${pin.labelX.toFixed(1)},${pin.labelY.toFixed(1)}`}
                      />
                      <circle
                        cx={pin.cx}
                        cy={pin.cy}
                        r={4.2}
                        fill={pin.ignitionLikely ? "#EF4444" : "#22C55E"}
                        stroke="#FFFFFF"
                        strokeWidth={1.2}
                      />
                      <text
                        x={pin.labelX + (pin.anchor === "end" ? -3 : 3)}
                        y={pin.labelY + 3}
                        textAnchor={pin.anchor}
                        fontSize={9}
                        fontFamily="monospace"
                        fontWeight="bold"
                        fill="#F8FAFC"
                      >
                        {pin.name} ({pin.gravityG}g: {pin.o2Pct}%)
                      </text>
                    </g>
                  );
                })}

                <circle
                  cx={mapPressureX(params.pressurePsi)}
                  cy={mapO2Y(params.o2Pct)}
                  r={6.5}
                  fill="none"
                  stroke="#FACC15"
                  strokeWidth={2.2}
                />
              </g>

              <text
                x={padL + 10}
                y={padT + plotH - 8}
                fontSize={8.5}
                fontFamily="monospace"
                fill="#34D399"
              >
                SAFE SUB-LOI QUENCH REGION (SELF-EXTINGUISHING)
              </text>
            </svg>

            {hoveredCluster3A && (
              <div className="ap-hud-panel absolute bottom-4 left-14 z-[200] px-2.5 py-1.5 font-mono text-[10px] text-slate-100 pointer-events-none">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-sky-300">
                  <span>
                    Cluster: ×{hoveredCluster3A.count} Runs @{" "}
                    {hoveredCluster3A.xVal} psi, {hoveredCluster3A.o2Pct}% O2
                  </span>
                  <span className="text-[#FF9F0A] text-[10px] font-semibold">
                    {hoveredCluster3A.defaultedPressureCount > 0
                      ? "[MEASURED + DEFAULTED 14.7 PSI]"
                      : "[MEASURED — ISS FLIGHT TELEMETRY]"}
                  </span>
                </div>
                <div className="text-slate-300">
                  Campaigns: {hoveredCluster3A.campaigns.join(", ")} · Sample:{" "}
                  {hoveredCluster3A.sampleLabel} ({hoveredCluster3A.sampleMetric})
                </div>
                <div className="text-[9px] text-amber-300">
                  Provenance: {hoveredCluster3A.count - hoveredCluster3A.defaultedPressureCount} MEASURED P ·{" "}
                  {hoveredCluster3A.defaultedPressureCount} DEFAULTED P ·{" "}
                  {hoveredCluster3A.inferredGeometryCount} INFERRED Geo/Thk
                </div>
              </div>
            )}
          </div>

          <div className="ap-text-2 flex flex-wrap gap-3 text-[11px] font-medium mb-3">
            <span>▬ White: 0g (BASS-II)</span>
            <span>--- Cyan: 0.16g Lunar (LUCI/FM2)</span>
            <span>- - Orange: 0.38g Mars</span>
            <span>••• Emerald: 1g Earth</span>
            <span>- - Magenta: Pre-Breathe Vector</span>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Habitat Pin Flammability Envelope Comparison"
            className="ap-table-wrap ap-divider border-t pt-3"
          >
            <table className="w-full text-[12px] text-left">
              <thead>
                <tr className="ap-table-head ap-text-3 text-[11px] font-semibold">
                  <th className="py-1.5 pr-2">Habitat Pin</th>
                  <th className="py-1.5 pr-2">O2 %</th>
                  <th className="py-1.5 pr-2">P (psi)</th>
                  <th className="py-1.5 pr-2">G</th>
                  <th className="py-1.5 pr-2">LOI %</th>
                  <th className="py-1.5">IgnitionLikely</th>
                </tr>
              </thead>
              <tbody>
                {envelopeData.habitatPins.map((pin) => (
                  <tr key={pin.name} className="ap-table-row">
                    <td className="py-1.5 pr-2 font-semibold ap-text-1">{pin.name}</td>
                    <td className="py-1.5 pr-2 font-mono tabular-nums">{pin.o2Pct}%</td>
                    <td className="py-1.5 pr-2 font-mono tabular-nums">{pin.pressurePsi}</td>
                    <td className="py-1.5 pr-2 font-mono tabular-nums">{pin.gravityG}g</td>
                    <td className="py-1.5 pr-2 font-mono tabular-nums">{pin.limitingO2Pct}%</td>
                    <td
                      className={`py-1.5 font-mono text-[11px] font-semibold ${
                        pin.ignitionLikely
                          ? "ap-prov-measured"
                          : "ap-prov-estimated"
                      }`}
                    >
                      {pin.ignitionLikely ? "TRUE (BURN)" : "FALSE (SAFE)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ap-card p-6">
          <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
            <div>
              <span className="ap-eyebrow block">Forced Flow Stability</span>
              <h3 className="ap-h3 mt-0.5">
                3B. Microgravity Ventilation U-Curve (O2% vs Airflow cm/s)
              </h3>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <span className="ap-prov-estimated">
                  {METRIC_PROVENANCE_LABELS.uCurveBoundaries.badge}
                </span>
                <span className="ap-prov-measured">
                  {METRIC_PROVENANCE_LABELS.empiricalFlightPins.badge}
                </span>
              </div>
            </div>
            <span className="ap-text-3 font-mono text-[11px] tabular-nums">
              X: 0–50 cm/s · Y: {yMin}–{yMax}% O2 ({isFocus ? "Boundary Zoom" : "Full Scale"})
            </span>
          </div>

          <div className="relative isolate">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="ap-chart-well w-full mb-3"
            >
              <defs>
                <clipPath id="chart3b-smooth-clip">
                  <rect x={padL} y={padT} width={plotW} height={plotH} />
                </clipPath>
                <linearGradient
                  id="grad3b-danger-zone"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.28} />
                  <stop offset="60%" stopColor="#F59E0B" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.04} />
                </linearGradient>
              </defs>

              <g clipPath="url(#chart3b-smooth-clip)">
                <rect
                  x={padL}
                  y={padT}
                  width={plotW}
                  height={plotH}
                  fill="#070B14"
                />

                <rect
                  x={mapAirflowX(0)}
                  y={padT}
                  width={mapAirflowX(2) - mapAirflowX(0)}
                  height={plotH}
                  fill="#06B6D4"
                  fillOpacity={0.15}
                />
                <rect
                  x={mapAirflowX(2)}
                  y={padT}
                  width={mapAirflowX(12) - mapAirflowX(2)}
                  height={plotH}
                  fill="#F59E0B"
                  fillOpacity={0.14}
                />
                <rect
                  x={mapAirflowX(25)}
                  y={padT}
                  width={mapAirflowX(50) - mapAirflowX(25)}
                  height={plotH}
                  fill="#3B82F6"
                  fillOpacity={0.13}
                />

                {dangerAreaPath3B && (
                  <path d={dangerAreaPath3B} fill="url(#grad3b-danger-zone)" />
                )}
              </g>

              {yTicks.map((o2Val) => (
                <g key={o2Val}>
                  <line
                    x1={padL}
                    y1={mapO2Y(o2Val)}
                    x2={chartW - padR}
                    y2={mapO2Y(o2Val)}
                    stroke="#1E293B"
                    strokeWidth={0.9}
                  />
                  <text
                    x={padL - 6}
                    y={mapO2Y(o2Val) + 3}
                    textAnchor="end"
                    fontSize={9.5}
                    fontFamily="monospace"
                    fill="#94A3B8"
                  >
                    {o2Val}%
                  </text>
                </g>
              ))}

              {[0, 10, 20, 30, 40, 50].map((flowVal) => (
                <g key={flowVal}>
                  <line
                    x1={mapAirflowX(flowVal)}
                    y1={padT}
                    x2={mapAirflowX(flowVal)}
                    y2={chartH - padB}
                    stroke="#1E293B"
                    strokeWidth={0.9}
                  />
                  <text
                    x={mapAirflowX(flowVal)}
                    y={chartH - 12}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontFamily="monospace"
                    fill="#94A3B8"
                  >
                    {flowVal} cm/s
                  </text>
                </g>
              ))}

              <line
                x1={mapAirflowX(2)}
                y1={padT}
                x2={mapAirflowX(2)}
                y2={chartH - padB}
                stroke="#22D3EE"
                strokeWidth={1.1}
                strokeDasharray="3 2"
              />
              <line
                x1={mapAirflowX(12)}
                y1={padT}
                x2={mapAirflowX(12)}
                y2={chartH - padB}
                stroke="#FBBF24"
                strokeWidth={1.1}
                strokeDasharray="3 2"
              />
              <line
                x1={mapAirflowX(25)}
                y1={padT}
                x2={mapAirflowX(25)}
                y2={chartH - padB}
                stroke="#60A5FA"
                strokeWidth={1.1}
                strokeDasharray="3 2"
              />

              <g>
                <rect
                  x={padL + 2}
                  y={8}
                  width={132}
                  height={20}
                  fill="#083344"
                  stroke="#06B6D4"
                  strokeWidth={0.8}
                />
                <text
                  x={padL + 68}
                  y={21}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#67E8F9"
                >
                  0–2: DIFFUSIVE QUENCH
                </text>

                <rect
                  x={padL + 138}
                  y={8}
                  width={194}
                  height={20}
                  fill="#451A03"
                  stroke="#F59E0B"
                  strokeWidth={0.8}
                />
                <text
                  x={padL + 235}
                  y={21}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#FDE68A"
                >
                  2–12: SUPER-FLAMMABLE TROUGH
                </text>

                <rect
                  x={padL + 336}
                  y={8}
                  width={158}
                  height={20}
                  fill="#172554"
                  stroke="#3B82F6"
                  strokeWidth={0.8}
                />
                <text
                  x={padL + 415}
                  y={21}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#93C5FD"
                >
                  &gt;25: CONVECTIVE BLOWOFF
                </text>
              </g>

              <g clipPath="url(#chart3b-smooth-clip)">
                <polyline
                  fill="none"
                  stroke="#F8FAFC"
                  strokeWidth={2.5}
                  points={airflowPolyline3B}
                />

                <circle
                  cx={mapAirflowX(minLoiPoint3B.airflowCmS)}
                  cy={mapO2YUnclamped(minLoiPoint3B.limitingO2Pct)}
                  r={4}
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth={1.2}
                />
                <text
                  x={mapAirflowX(minLoiPoint3B.airflowCmS) + 8}
                  y={mapO2YUnclamped(minLoiPoint3B.limitingO2Pct) + 12}
                  fontSize={8.5}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#FDE68A"
                >
                  Min LOI: {minLoiPoint3B.limitingO2Pct}% @{" "}
                  {minLoiPoint3B.airflowCmS} cm/s
                </text>

                {showEmpiricalPins &&
                  clusters3B.map((cluster) => {
                    if (cluster.o2Pct < yMin || cluster.o2Pct > yMax) {
                      return null;
                    }
                    const cx = mapAirflowX(cluster.xVal);
                    const cy = mapO2Y(cluster.o2Pct);
                    const r = Math.min(
                      8,
                      2.6 + Math.log2(cluster.count + 1) * 1.15,
                    );
                    return (
                      <g
                        key={cluster.clusterKey}
                        onMouseEnter={() => setHoveredCluster3B(cluster)}
                        onMouseLeave={() => setHoveredCluster3B(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={cluster.dominantColorHex}
                          fillOpacity={0.82}
                          stroke="#0F172A"
                          strokeWidth={1}
                        />
                        {cluster.count > 1 && (
                          <text
                            x={cx}
                            y={cy + 2.5}
                            textAnchor="middle"
                            fontSize={7}
                            fontFamily="monospace"
                            fontWeight="bold"
                            fill="#FFFFFF"
                          >
                            {cluster.count}
                          </text>
                        )}
                      </g>
                    );
                  })}

                <line
                  x1={mapAirflowX(params.airflowCmS)}
                  y1={padT}
                  x2={mapAirflowX(params.airflowCmS)}
                  y2={chartH - padB}
                  stroke="#FACC15"
                  strokeWidth={1.4}
                  strokeDasharray="4 3"
                />

                <circle
                  cx={mapAirflowX(params.airflowCmS)}
                  cy={mapO2Y(params.o2Pct)}
                  r={6}
                  fill="#EF4444"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
              </g>

              <text
                x={padL + 10}
                y={padT + plotH - 8}
                fontSize={8.5}
                fontFamily="monospace"
                fill="#34D399"
              >
                SUB-LOI EXTINCTION FLOOR (INSUFFICIENT O2 TO SUSTAIN FLAME)
              </text>
            </svg>

            {hoveredCluster3B && (
              <div className="ap-hud-panel absolute bottom-4 left-14 z-[200] px-2.5 py-1.5 font-mono text-[10px] text-slate-100 pointer-events-none">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-amber-300">
                  <span>
                    Cluster: ×{hoveredCluster3B.count} Runs @{" "}
                    {hoveredCluster3B.xVal} cm/s, {hoveredCluster3B.o2Pct}% O2
                  </span>
                  <span className="text-[#FF9F0A] text-[10px] font-semibold">
                    {hoveredCluster3B.defaultedPressureCount > 0
                      ? "[MEASURED + DEFAULTED 14.7 PSI]"
                      : "[MEASURED — ISS FLIGHT TELEMETRY]"}
                  </span>
                </div>
                <div className="text-slate-300">
                  Campaigns: {hoveredCluster3B.campaigns.join(", ")} · Sample:{" "}
                  {hoveredCluster3B.sampleLabel} ({hoveredCluster3B.sampleMetric})
                </div>
                <div className="text-[9px] text-sky-300">
                  Provenance: {hoveredCluster3B.count - hoveredCluster3B.defaultedPressureCount} MEASURED P ·{" "}
                  {hoveredCluster3B.defaultedPressureCount} DEFAULTED P ·{" "}
                  {hoveredCluster3B.inferredGeometryCount} INFERRED Geo/Thk
                </div>
              </div>
            )}
          </div>

          <div className="ap-divider grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3">
            <div tabIndex={0} role="region" aria-label="O2 vs Pressure Curve Table" className="ap-table-wrap max-h-40 overflow-y-auto pr-1">
              <div className="ap-text-3 text-[11px] font-semibold mb-1.5">
                o2VsPressure ({envelopeData.o2VsPressureCurve.length} pts)
              </div>
              <table className="w-full font-mono text-[10px] tabular-nums">
                <thead>
                  <tr className="ap-table-head ap-text-3">
                    <th className="py-1 text-left">psi</th>
                    <th className="py-1 text-right">0g</th>
                    <th className="py-1 text-right">0.16g</th>
                    <th className="py-1 text-right">0.38g</th>
                    <th className="py-1 text-right">1g</th>
                  </tr>
                </thead>
                <tbody>
                  {envelopeData.o2VsPressureCurve.map((pt) => (
                    <tr key={pt.pressurePsi} className="ap-table-row">
                      <td className="py-1">{pt.pressurePsi}</td>
                      <td className="py-1 text-right">{pt.loi_0g_ventilated}%</td>
                      <td className="py-1 text-right">
                        {pt.loi_lunar_016g_bounded}%
                      </td>
                      <td className="py-1 text-right">{pt.loi_mars_038g_bounded}%</td>
                      <td className="py-1 text-right">{pt.loi_1g_earth}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div tabIndex={0} role="region" aria-label="O2 vs Airflow Curve Table" className="ap-table-wrap max-h-40 overflow-y-auto pr-1">
              <div className="ap-text-3 text-[11px] font-semibold mb-1.5">
                o2VsAirflow ({envelopeData.o2VsAirflowCurve.length} pts)
              </div>
              <table className="w-full font-mono text-[10px] tabular-nums">
                <thead>
                  <tr className="ap-table-head ap-text-3">
                    <th className="py-1 text-left">cm/s</th>
                    <th className="py-1 text-right">LOI%</th>
                  </tr>
                </thead>
                <tbody>
                  {envelopeData.o2VsAirflowCurve.map((pt) => (
                    <tr key={pt.airflowCmS} className="ap-table-row">
                      <td className="py-1">{pt.airflowCmS} cm/s</td>
                      <td className="py-1 text-right">{pt.limitingO2Pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div tabIndex={0} role="region" aria-label="Pre-Breathe Vector Table" className="ap-table-wrap max-h-40 overflow-y-auto pr-1">
              <div className="ap-text-3 text-[11px] font-semibold mb-1.5">
                Pre-Breathe Vector ({phaseMatrix.preBreatheTradeoffVector.length} steps)
              </div>
              <table className="w-full font-mono text-[10px] tabular-nums">
                <thead>
                  <tr className="ap-table-head ap-text-3">
                    <th className="py-1 text-left">psi/O2</th>
                    <th className="py-1 text-right">PreB</th>
                    <th className="py-1 text-right">Spread</th>
                    <th className="py-1 text-right">Risk×</th>
                  </tr>
                </thead>
                <tbody>
                  {phaseMatrix.preBreatheTradeoffVector.map((wp) => (
                    <tr key={wp.stepIndex} className="ap-table-row">
                      <td className="py-1" title={wp.label}>
                        {wp.pressurePsi}p/{wp.o2Pct}%
                      </td>
                      <td className="py-1 text-right">
                        {wp.preBreatheTimeMinutes}m
                      </td>
                      <td className="py-1 text-right">{wp.flameSpreadMmS}</td>
                      <td className="py-1 text-right">{wp.riskMultiplierVsIss}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
