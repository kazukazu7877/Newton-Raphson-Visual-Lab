import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { solve, type NewtonResult } from '../../engine/solver';
import { MathView } from '../MathView';
import { SURFACES, TEXT, SEMANTIC, UI_STATES } from '../../engine/tokens';

interface KeplerDemoProps {
  onOpenInLab: (name: string, expr: string, x0: number, tol?: number, maxIter?: number) => void;
}

export const KeplerDemo: React.FC<KeplerDemoProps> = ({ onOpenInLab }) => {
  const [eVal, setEVal] = useState<number>(0.5);
  const [mVal, setMVal] = useState<number>(1.0);

  // Check user prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Compute starting guess rule: E0 = M for e < 0.8, E0 = pi for e >= 0.8
  const e0Guess = useMemo(() => {
    return eVal < 0.8 ? (mVal === 0 ? 0.1 : mVal) : Math.PI;
  }, [eVal, mVal]);

  // Construct Kepler equation string for engine
  const keplerExpr = useMemo(() => {
    return `x - ${eVal.toFixed(3)}*sin(x) - ${mVal.toFixed(3)}`;
  }, [eVal, mVal]);

  // Solve Kepler equation using engine
  const solveResult: NewtonResult = useMemo(() => {
    try {
      return solve(keplerExpr, e0Guess, 1e-12, 50);
    } catch {
      // Fallback in case of parse/eval issue
      return solve('x - 0.5*sin(x) - 1.0', 1.0, 1e-12, 50);
    }
  }, [keplerExpr, e0Guess]);

  const solvedE = solveResult.converged ? solveResult.finalX : null;
  const rOverA = solvedE !== null ? 1 - eVal * Math.cos(solvedE) : null;

  // Animation interpolation state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animPosRef = useRef<{ x: number; y: number; r: number }>({ x: 0, y: 0, r: 1 });
  const targetPosRef = useRef<{ x: number; y: number; r: number }>({ x: 0, y: 0, r: 1 });

  // Update target position
  useEffect(() => {
    if (solvedE !== null) {
      const tx = Math.cos(solvedE) - eVal;
      const ty = Math.sqrt(Math.max(0, 1 - eVal * eVal)) * Math.sin(solvedE);
      const tr = 1 - eVal * Math.cos(solvedE);
      targetPosRef.current = { x: tx, y: ty, r: tr };

      if (prefersReducedMotion) {
        animPosRef.current = { x: tx, y: ty, r: tr };
      }
    }
  }, [solvedE, eVal, prefersReducedMotion]);

  // Canvas drawing loop with smooth interpolation
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Smooth position interpolation over ~120ms (exp decay rate ~25/s)
      if (!prefersReducedMotion) {
        const factor = 1 - Math.exp(-25 * dt);
        animPosRef.current.x += (targetPosRef.current.x - animPosRef.current.x) * factor;
        animPosRef.current.y += (targetPosRef.current.y - animPosRef.current.y) * factor;
        animPosRef.current.r += (targetPosRef.current.r - animPosRef.current.r) * factor;
      }

      // Coordinates mapping:
      // Focus (star) is at the origin (0, 0) of the focus frame.
      // Semi-major axis a = 1.
      // Ellipse spans x from -(1 + e) at aphelion to (1 - e) at perihelion.
      // Center of canvas will be offset so the whole orbit is centered nicely:
      // Orbit center is at x = -e, y = 0.
      const scale = Math.min((w - 60) / 2.4, (h - 60) / 2.2);
      const originX = w / 2 + eVal * 0.5 * scale;
      const originY = h / 2;

      const toScreenX = (fx: number) => originX + fx * scale;
      const toScreenY = (fy: number) => originY - fy * scale; // invert Y for screen coords

      const b = Math.sqrt(Math.max(0, 1 - eVal * eVal));
      const centerX = toScreenX(-eVal);
      const centerY = originY;

      // 1. Draw subtle background coordinate grid / axes
      ctx.strokeStyle = SURFACES.grid_minor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(w, originY);
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, h);
      ctx.stroke();

      // 2. Auxiliary Circle (radius a = 1 centered at ellipse center (-e, 0))
      ctx.strokeStyle = SURFACES.line;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Elliptical Orbit
      ctx.strokeStyle = SEMANTIC.curve_azure;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, scale, b * scale, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Faint glow for orbit
      ctx.strokeStyle = SEMANTIC.curve_glow;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, scale, b * scale, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 4. Central Star (Focus at origin)
      const starX = toScreenX(0);
      const starY = toScreenY(0);

      // Star halo
      const starGlow = ctx.createRadialGradient(starX, starY, 2, starX, starY, 16);
      starGlow.addColorStop(0, 'rgba(255, 194, 71, 0.45)');
      starGlow.addColorStop(1, 'rgba(255, 194, 71, 0)');
      ctx.fillStyle = starGlow;
      ctx.beginPath();
      ctx.arc(starX, starY, 16, 0, Math.PI * 2);
      ctx.fill();

      // Star core
      ctx.fillStyle = SEMANTIC.tangent;
      ctx.beginPath();
      ctx.arc(starX, starY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 5. Planet & Orbit Line
      if (solvedE !== null) {
        const curPx = animPosRef.current.x;
        const curPy = animPosRef.current.y;
        const pScreenX = toScreenX(curPx);
        const pScreenY = toScreenY(curPy);

        // Radius vector line from Star (Focus) to Planet
        ctx.strokeStyle = 'rgba(182, 243, 107, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(starX, starY);
        ctx.lineTo(pScreenX, pScreenY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Eccentric anomaly projection line up to auxiliary circle
        const circlePtX = centerX + Math.cos(solvedE) * scale;
        const circlePtY = centerY - Math.sin(solvedE) * scale;

        ctx.strokeStyle = 'rgba(77, 163, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pScreenX, pScreenY);
        ctx.lineTo(circlePtX, circlePtY);
        ctx.stroke();

        // Marker on auxiliary circle
        ctx.fillStyle = SEMANTIC.curve_azure;
        ctx.beginPath();
        ctx.arc(circlePtX, circlePtY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Planet Halo
        const planetGlow = ctx.createRadialGradient(pScreenX, pScreenY, 2, pScreenX, pScreenY, 14);
        planetGlow.addColorStop(0, 'rgba(182, 243, 107, 0.5)');
        planetGlow.addColorStop(1, 'rgba(182, 243, 107, 0)');
        ctx.fillStyle = planetGlow;
        ctx.beginPath();
        ctx.arc(pScreenX, pScreenY, 14, 0, Math.PI * 2);
        ctx.fill();

        // Planet Core
        ctx.fillStyle = SEMANTIC.next_x;
        ctx.beginPath();
        ctx.arc(pScreenX, pScreenY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Radius label r/a
        const midX = (starX + pScreenX) / 2;
        const midY = (starY + pScreenY) / 2 - 8;
        ctx.fillStyle = TEXT.text_1;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`r/a = ${animPosRef.current.r.toFixed(3)}`, midX, midY);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [eVal, solvedE, prefersReducedMotion]);

  const handleOpenClick = useCallback(() => {
    onOpenInLab(
      `Kepler Orbit (e = ${eVal.toFixed(2)}, M = ${mVal.toFixed(2)})`,
      keplerExpr,
      e0Guess,
      1e-12,
      50,
    );
  }, [onOpenInLab, eVal, mVal, keplerExpr, e0Guess]);

  const orbitStatusAria = useMemo(() => {
    if (!solveResult.converged || solvedE === null || rOverA === null) {
      return `Orbit solver status: ${solveResult.statusLabel}.`;
    }
    return `Planet at r/a = ${rOverA.toFixed(3)}, eccentric anomaly E = ${solvedE.toFixed(4)} rad. Solved in ${solveResult.iterations} iterations.`;
  }, [solveResult, solvedE, rOverA]);

  return (
    <div
      className="nr-panel"
      style={{
        backgroundColor: SURFACES.ink_850,
        border: `1px solid ${SURFACES.line}`,
        borderRadius: '6px',
        boxShadow: 'inset 0 1px 0 var(--panel-top-highlight)',
        padding: '18px',
        marginBottom: '20px',
      }}
    >
      {/* Title & Context */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: SEMANTIC.tangent,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Featured Live Demo
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 194, 71, 0.12)',
              color: SEMANTIC.tangent,
              border: '1px solid rgba(255, 194, 71, 0.3)',
              fontWeight: 600,
            }}
          >
            Celestial Mechanics
          </span>
        </div>

        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.2rem',
            fontWeight: 700,
            color: TEXT.text_1,
            margin: '0 0 6px 0',
          }}
        >
          Kepler’s equation: where is the planet?
        </h3>

        <p
          style={{
            fontSize: '0.85rem',
            color: TEXT.text_2,
            lineHeight: 1.5,
            maxWidth: '1000px',
            margin: 0,
          }}
        >
          In an elliptical orbit, time since closest approach is measured by the mean anomaly M, but spatial coordinates depend on the eccentric anomaly E. They are linked by Kepler’s equation M = E − e sin E, which cannot be inverted in closed form. Newton–Raphson is the standard choice used across flight dynamics and planetary science.
        </p>
      </div>

      {/* Equations in KaTeX */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
          padding: '8px 12px',
          backgroundColor: SURFACES.ink_900,
          borderRadius: '6px',
          border: `1px solid ${SURFACES.line}`,
          marginBottom: '16px',
          fontSize: '0.88rem',
        }}
      >
        <div style={{ flex: '1 1 auto', overflowX: 'auto' }}>
          <MathView math="f(E) = E - e \sin E - M = 0 \quad \text{and} \quad f'(E) = 1 - e \cos E" block />
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={handleOpenClick}
          style={{
            fontSize: '0.8rem',
            padding: '7px 14px',
            whiteSpace: 'nowrap',
          }}
        >
          Open in the lab →
        </button>
      </div>

      {/* Main Grid: Interactive Orbit Stage + Real-time Controls & Readout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
          gap: '16px',
        }}
        className="kepler-layout"
      >
        {/* Left: Orbit Canvas Stage */}
        <div
          style={{
            position: 'relative',
            backgroundColor: SURFACES.ink_900,
            border: `1px solid ${SURFACES.line}`,
            borderRadius: '6px',
            height: '320px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '10px',
              fontSize: '0.72rem',
              color: TEXT.text_3,
              backgroundColor: SURFACES.badge_bg,
              padding: '2px 6px',
              borderRadius: '4px',
              border: `1px solid ${SURFACES.line}`,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            FOCUS FRAME (STAR AT ORIGIN)
          </div>

          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
            }}
            aria-label="Interactive elliptical orbit showing planet position relative to focus"
          />
        </div>

        {/* Right: Sliders, Real-time Engine Readout & Iterations Table */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Sliders Container */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label
                  htmlFor="kepler-e-slider"
                  style={{ fontSize: '0.78rem', color: TEXT.text_3, fontWeight: 500 }}
                >
                  Eccentricity e
                </label>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    color: TEXT.text_1,
                    fontWeight: 600,
                  }}
                >
                  {eVal.toFixed(2)}
                </span>
              </div>
              <input
                id="kepler-e-slider"
                type="range"
                min="0"
                max="0.95"
                step="0.01"
                value={eVal}
                onChange={(e) => setEVal(parseFloat(e.target.value))}
                aria-valuemin={0}
                aria-valuemax={0.95}
                aria-valuenow={eVal}
                aria-valuetext={`Eccentricity ${eVal.toFixed(2)}`}
                style={{ width: '100%', accentColor: UI_STATES.primary }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label
                  htmlFor="kepler-m-slider"
                  style={{ fontSize: '0.78rem', color: TEXT.text_3, fontWeight: 500 }}
                >
                  Mean anomaly M
                </label>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    color: TEXT.text_1,
                    fontWeight: 600,
                  }}
                >
                  {mVal.toFixed(2)} rad
                </span>
              </div>
              <input
                id="kepler-m-slider"
                type="range"
                min="0"
                max="6.28"
                step="0.01"
                value={mVal}
                onChange={(e) => setMVal(parseFloat(e.target.value))}
                aria-valuemin={0}
                aria-valuemax={6.28}
                aria-valuenow={mVal}
                aria-valuetext={`Mean anomaly ${mVal.toFixed(2)} radians`}
                style={{ width: '100%', accentColor: UI_STATES.primary }}
              />
            </div>
          </div>

          {/* Screen-reader Live Region */}
          <div className="sr-only" aria-live="polite">
            {orbitStatusAria}
          </div>

          {/* Engine Metric Readouts */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
            }}
          >
            <div className="nr-card" style={{ padding: '6px 8px' }}>
              <div className="nr-card-title">Solved E</div>
              <div className="nr-card-value" style={{ color: SEMANTIC.next_x, fontSize: '0.85rem' }}>
                {solvedE !== null ? solvedE.toFixed(8) : 'NaN'}
              </div>
            </div>

            <div className="nr-card" style={{ padding: '6px 8px' }}>
              <div className="nr-card-title">Iterations</div>
              <div className="nr-card-value" style={{ fontSize: '0.85rem' }}>
                {solveResult.iterations}
              </div>
            </div>

            <div className="nr-card" style={{ padding: '6px 8px' }}>
              <div className="nr-card-title">Residual |f(E)|</div>
              <div className="nr-card-value" style={{ fontSize: '0.85rem' }}>
                {Number.isFinite(solveResult.finalResidual)
                  ? solveResult.finalResidual.toExponential(2)
                  : 'NaN'}
              </div>
            </div>

            <div className="nr-card" style={{ padding: '6px 8px' }}>
              <div className="nr-card-title">Status</div>
              <div
                className="nr-card-value"
                style={{
                  fontSize: '0.82rem',
                  color: solveResult.converged ? UI_STATES.success : UI_STATES.warning,
                }}
              >
                {solveResult.statusLabel}
              </div>
            </div>
          </div>

          {/* Compact Iterate Table for this solve */}
          <div
            style={{
              overflowX: 'auto',
              maxHeight: '140px',
              backgroundColor: SURFACES.ink_900,
              border: `1px solid ${SURFACES.line}`,
              borderRadius: '4px',
              padding: '2px',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.74rem',
                fontFamily: 'var(--font-mono)',
                textAlign: 'right',
              }}
            >
              <thead>
                <tr style={{ color: TEXT.text_3, borderBottom: `1px solid ${SURFACES.line}` }}>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>Step n</th>
                  <th style={{ padding: '3px 6px' }}>Eₙ (rad)</th>
                  <th style={{ padding: '3px 6px' }}>Correction</th>
                  <th style={{ padding: '3px 6px' }}>Residual |f|</th>
                </tr>
              </thead>
              <tbody>
                {solveResult.records.map((r) => (
                  <tr
                    key={r.n}
                    style={{
                      borderBottom: `1px solid rgba(34, 48, 79, 0.4)`,
                      color: TEXT.text_2,
                    }}
                  >
                    <td style={{ padding: '2px 6px', textAlign: 'left', color: TEXT.text_3 }}>{r.n}</td>
                    <td style={{ padding: '2px 6px' }}>{r.x_n.toFixed(7)}</td>
                    <td style={{ padding: '2px 6px' }}>{r.correction.toExponential(2)}</td>
                    <td style={{ padding: '2px 6px' }}>
                      {Number.isFinite(r.residual) ? r.residual.toExponential(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
