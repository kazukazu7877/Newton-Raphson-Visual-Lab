import React, { useMemo } from 'react';
import { parseExpression, buildEvaluator } from '../../engine/parser';
import { SEMANTIC, SURFACES } from '../../engine/tokens';

interface FunctionThumbnailProps {
  expr: string;
  rootX: number;
  window: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
}

export const FunctionThumbnail: React.FC<FunctionThumbnailProps> = ({ expr, rootX, window }) => {
  const { pathD, axisY, starPos } = useMemo(() => {
    try {
      const ast = parseExpression(expr);
      const fn = buildEvaluator(ast);

      const w = 120;
      const h = 54;
      const pad = 4;
      const plotW = w - pad * 2;
      const plotH = h - pad * 2;

      const numPoints = 40;
      const pts: [number, number][] = [];

      for (let i = 0; i <= numPoints; i++) {
        const x = window.xMin + (i / numPoints) * (window.xMax - window.xMin);
        try {
          const y = fn(x);
          if (Number.isFinite(y)) {
            // Clamp y within visual bounds to prevent runaway asymptotes
            const clampedY = Math.max(window.yMin * 1.5, Math.min(window.yMax * 1.5, y));
            pts.push([x, clampedY]);
          }
        } catch {
          // Skip invalid points
        }
      }

      if (pts.length < 2) return { pathD: '', axisY: null, starPos: null };

      const toSvgX = (x: number) => pad + ((x - window.xMin) / (window.xMax - window.xMin)) * plotW;
      const toSvgY = (y: number) => pad + (1 - (y - window.yMin) / (window.yMax - window.yMin)) * plotH;

      let d = '';
      for (let i = 0; i < pts.length; i++) {
        const [px, py] = pts[i]!;
        const sx = toSvgX(px);
        const sy = Math.max(pad, Math.min(h - pad, toSvgY(py)));
        d += i === 0 ? `M ${sx.toFixed(1)} ${sy.toFixed(1)}` : ` L ${sx.toFixed(1)} ${sy.toFixed(1)}`;
      }

      let y0: number | null = null;
      if (window.yMin <= 0 && window.yMax >= 0) {
        y0 = toSvgY(0);
      }

      let star: { x: number; y: number } | null = null;
      if (rootX >= window.xMin && rootX <= window.xMax) {
        star = {
          x: toSvgX(rootX),
          y: y0 ?? toSvgY(0),
        };
      }

      return { pathD: d, axisY: y0, starPos: star };
    } catch {
      return { pathD: '', axisY: null, starPos: null };
    }
  }, [expr, rootX, window]);

  if (!pathD) {
    return null;
  }

  const gradId = `fn-thumb-grad-${expr.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      width="100%"
      height="54"
      viewBox="0 0 120 54"
      aria-hidden="true"
      style={{
        display: 'block',
        backgroundColor: SURFACES.ink_900,
        borderRadius: '4px',
        border: `1px solid ${SURFACES.line}`,
        overflow: 'hidden',
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={SEMANTIC.curve_aqua} />
          <stop offset="100%" stopColor={SEMANTIC.curve_azure} />
        </linearGradient>
      </defs>

      {/* Axis line if visible */}
      {axisY !== null && (
        <line
          x1="4"
          y1={axisY.toFixed(1)}
          x2="116"
          y2={axisY.toFixed(1)}
          stroke={SURFACES.line}
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}

      {/* Function curve */}
      <path d={pathD} fill="none" stroke={`url(#${gradId})`} strokeWidth="1.6" strokeLinecap="round" />

      {/* Root marker: white star with lime ring */}
      {starPos && (
        <g transform={`translate(${starPos.x.toFixed(1)}, ${starPos.y.toFixed(1)})`}>
          <circle r="4" fill="none" stroke={SEMANTIC.root_ring} strokeWidth="1.2" opacity="0.8" />
          <polygon
            points="0,-3.5 1,-1 3.5,0 1,1 0,3.5 -1,1 -3.5,0 -1,-1"
            fill={SEMANTIC.root_core}
          />
        </g>
      )}
    </svg>
  );
};
