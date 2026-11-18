import React from "react";
import { FEATURES, labels } from "./ui.jsx";

/**
 * Gráfico de radar SVG ligero para comparar perfiles ambientales normalizados [0, 1].
 */
export function RadarChart({
  centroidProfile,
  userProfile = null,
  centroidLabel = "Centroide de región",
  userLabel = "Tu parcela",
}) {
  if (!centroidProfile) return null;

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 92;
  const axes = FEATURES;
  const n = axes.length;

  const angleFor = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pointAt = (i, val) => {
    const r = Math.max(0, Math.min(1, Number(val) || 0)) * radius;
    const a = angleFor(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const toPath = (profile) =>
    axes
      .map((k, i) => pointAt(i, profile[k]).map((v) => v.toFixed(1)).join(","))
      .join(" ");

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="radar-wrap">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="radar-svg"
        role="img"
        aria-label="Comparación radial del perfil ambiental normalizado"
      >
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={axes
              .map((_, i) => pointAt(i, ring).map((v) => v.toFixed(1)).join(","))
              .join(" ")}
            fill="none"
            stroke="rgba(30, 50, 35, 0.12)"
            strokeWidth="1"
          />
        ))}
        {axes.map((k, i) => {
          const [x2, y2] = pointAt(i, 1);
          const [lx, ly] = pointAt(i, 1.2);
          return (
            <g key={k}>
              <line
                x1={cx}
                y1={cy}
                x2={x2}
                y2={y2}
                stroke="rgba(30, 50, 35, 0.14)"
                strokeWidth="1"
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill="var(--ink-soft, #4b5d4e)"
              >
                {(labels[k] || k).replace(" del suelo", "")}
              </text>
            </g>
          );
        })}
        <polygon
          points={toPath(centroidProfile)}
          fill="rgba(79, 138, 58, 0.22)"
          stroke="#4f8a3a"
          strokeWidth="2"
        />
        {userProfile && (
          <polygon
            points={toPath(userProfile)}
            fill="rgba(185, 107, 75, 0.2)"
            stroke="#b96b4b"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}
      </svg>
      <div className="radar-legend">
        <span>
          <i style={{ background: "#4f8a3a" }} /> {centroidLabel}
        </span>
        {userProfile && (
          <span>
            <i style={{ background: "#b96b4b" }} /> {userLabel}
          </span>
        )}
      </div>
    </div>
  );
}
