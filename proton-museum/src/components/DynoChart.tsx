import React, { useState } from "react";
import { ProtonCar, PROTON_CARS } from "../data/proton-archive";

interface DynoChartProps {
  primaryCar: ProtonCar;
  compareCarId?: string | null;
  onSelectCompare?: (carId: string | null) => void;
}

export const DynoChart: React.FC<DynoChartProps> = ({
  primaryCar,
  compareCarId = null,
  onSelectCompare,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const compareCar = compareCarId
    ? PROTON_CARS.find((c) => c.id === compareCarId) ?? null
    : null;

  const width = 560;
  const height = 230;
  const padL = 44;
  const padR = 44;
  const padT = 22;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allPoints = [
    ...primaryCar.dynoCurve,
    ...(compareCar ? compareCar.dynoCurve : []),
  ];
  const minRpm = Math.min(...allPoints.map((d) => d.rpm));
  const maxRpm = Math.max(...allPoints.map((d) => d.rpm));
  const maxVal = Math.max(
    340,
    ...allPoints.map((d) => Math.max(d.torqueNm, d.powerHp))
  );

  const xOf = (rpm: number) =>
    padL + ((rpm - minRpm) / Math.max(1, maxRpm - minRpm)) * plotW;
  const yOf = (val: number) => padT + plotH - (val / maxVal) * plotH;

  const buildPath = (pts: { rpm: number; val: number }[]) =>
    pts
      .map(
        (p, idx) =>
          `${idx === 0 ? "M" : "L"}${xOf(p.rpm).toFixed(1)},${yOf(p.val).toFixed(1)}`
      )
      .join(" ");

  const buildArea = (pts: { rpm: number; val: number }[]) => {
    if (!pts.length) return "";
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    return `${buildPath(pts)} L${xOf(last.rpm).toFixed(1)},${(padT + plotH).toFixed(1)} L${xOf(first.rpm).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
  };

  const torquePts = primaryCar.dynoCurve.map((d) => ({
    rpm: d.rpm,
    val: d.torqueNm,
  }));
  const powerPts = primaryCar.dynoCurve.map((d) => ({
    rpm: d.rpm,
    val: d.powerHp,
  }));

  const cmpTorquePts = compareCar
    ? compareCar.dynoCurve.map((d) => ({ rpm: d.rpm, val: d.torqueNm }))
    : [];
  const cmpPowerPts = compareCar
    ? compareCar.dynoCurve.map((d) => ({ rpm: d.rpm, val: d.powerHp }))
    : [];

  const activePoint =
    hoverIndex !== null && primaryCar.dynoCurve[hoverIndex]
      ? primaryCar.dynoCurve[hoverIndex]!
      : primaryCar.dynoCurve[primaryCar.dynoCurve.length - 2]!;

  return (
    <div className="dyno-panel">
      <div className="dyno-header">
        <div>
          <span className="dyno-kicker">
            DYNAMOMETER TELEMETRY // TORQUE (NM) &amp; POWER (BHP)
          </span>
          <div className="dyno-readout-row">
            <span className="dyno-stat">
              <strong>{activePoint.rpm.toLocaleString()}</strong> RPM
            </span>
            <span className="dyno-stat torque-stat">
              TORQUE: <strong>{activePoint.torqueNm} Nm</strong>
            </span>
            <span className="dyno-stat power-stat">
              OUTPUT: <strong>{activePoint.powerHp} bhp</strong>
            </span>
          </div>
        </div>

        {onSelectCompare && (
          <div className="dyno-compare-picker">
            <label htmlFor="dyno-cmp-select">BENCHMARK VS:</label>
            <select
              id="dyno-cmp-select"
              value={compareCarId ?? ""}
              onChange={(e) =>
                onSelectCompare(e.target.value ? e.target.value : null)
              }
            >
              <option value="">— Single Vehicle Telemetry —</option>
              {PROTON_CARS.filter((c) => c.id !== primaryCar.id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} {c.name} ({c.engine.powerHp} hp / {c.engine.torqueNm} Nm)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <svg
        className="dyno-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Dynamometer curve for ${primaryCar.name}`}
      >
        <defs>
          <linearGradient id="dynoTorqueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#eab308" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="dynoPowerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Reference Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const val = Math.round(t * maxVal);
          const y = yOf(val);
          return (
            <g key={t}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeDasharray={t === 0 ? undefined : "3 3"}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                className="dyno-axis-text"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Primary Car Torque & Power Areas + Curves */}
        <path d={buildArea(torquePts)} fill="url(#dynoTorqueGrad)" />
        <path d={buildArea(powerPts)} fill="url(#dynoPowerGrad)" />

        <path
          d={buildPath(torquePts)}
          fill="none"
          stroke="#eab308"
          strokeWidth={2.2}
        />
        <path
          d={buildPath(powerPts)}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2.2}
        />

        {/* Comparison Car Dashed Curves */}
        {compareCar && (
          <>
            <path
              d={buildPath(cmpTorquePts)}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={1.8}
              strokeDasharray="4 4"
            />
            <path
              d={buildPath(cmpPowerPts)}
              fill="none"
              stroke="#34d399"
              strokeWidth={1.8}
              strokeDasharray="4 4"
            />
          </>
        )}

        {/* Interactive Data Nodes */}
        {primaryCar.dynoCurve.map((pt, idx) => {
          const cx = xOf(pt.rpm);
          const ty = yOf(pt.torqueNm);
          const py = yOf(pt.powerHp);
          const isHovered = hoverIndex === idx;
          return (
            <g
              key={pt.rpm}
              className="dyno-node-group"
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <line
                x1={cx}
                y1={padT}
                x2={cx}
                y2={padT + plotH}
                stroke="currentColor"
                strokeOpacity={isHovered ? 0.35 : 0.06}
              />
              <circle
                cx={cx}
                cy={ty}
                r={isHovered ? 5 : 3.2}
                fill="#eab308"
              />
              <circle
                cx={cx}
                cy={py}
                r={isHovered ? 5 : 3.2}
                fill="#ef4444"
              />
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                className="dyno-axis-text"
              >
                {pt.rpm}
              </text>
              <rect
                x={cx - 18}
                y={padT}
                width={36}
                height={plotH}
                fill="transparent"
                style={{ cursor: "crosshair" }}
              />
            </g>
          );
        })}
      </svg>

      <div className="dyno-legend-row">
        <span className="dyno-legend-item">
          <i className="swatch-dot" style={{ background: "#eab308" }} />
          {primaryCar.name} Torque (Nm)
        </span>
        <span className="dyno-legend-item">
          <i className="swatch-dot" style={{ background: "#ef4444" }} />
          {primaryCar.name} Power (bhp)
        </span>
        {compareCar && (
          <>
            <span className="dyno-legend-item">
              <i className="swatch-dot" style={{ background: "#60a5fa" }} />
              {compareCar.name} Torque (Nm)
            </span>
            <span className="dyno-legend-item">
              <i className="swatch-dot" style={{ background: "#34d399" }} />
              {compareCar.name} Power (bhp)
            </span>
          </>
        )}
      </div>
    </div>
  );
};
