import React, { useRef, useEffect } from 'react';
import type { NewtonResult } from '../engine/solver';
import { SEMANTIC, SURFACES, TEXT, UI_STATES } from '../engine/tokens';

interface ConvergenceChartsProps {
  result: NewtonResult;
  selectedStep: number;
}

export const ConvergenceCharts: React.FC<ConvergenceChartsProps> = ({ result, selectedStep }) => {
  const approxCanvasRef = useRef<HTMLCanvasElement>(null);
  const residualCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw Approximation History Chart
  useEffect(() => {
    const canvas = approxCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padL = 50 * dpr;
    const padR = 25 * dpr;
    const padT = 35 * dpr;
    const padB = 35 * dpr;
    const plotW = canvas.width - padL - padR;
    const plotH = canvas.height - padT - padB;

    const iters = [0];
    const xVals = [result.x0];
    for (const r of result.records) {
      iters.push(r.n + 1);
      xVals.push(r.x_next);
    }

    const minX = 0;
    const maxX = Math.max(1, iters[iters.length - 1]!);

    const allY = [...xVals, result.finalX];
    let minY = Math.min(...allY);
    let maxY = Math.max(...allY);
    if (maxY - minY < 1e-4) {
      minY -= 1;
      maxY += 1;
    }
    const padY = (maxY - minY) * 0.15;
    minY -= padY;
    maxY += padY;

    const toPlotX = (iter: number) => padL + ((iter - minX) / (maxX - minX)) * plotW;
    const toPlotY = (val: number) => padT + (1 - (val - minY) / (maxY - minY)) * plotH;

    // Grid lines
    ctx.strokeStyle = SURFACES.grid_major;
    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i <= maxX; i += Math.max(1, Math.round(maxX / 6))) {
      const gx = toPlotX(i);
      ctx.beginPath();
      ctx.moveTo(gx, padT);
      ctx.lineTo(gx, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = TEXT.text_3;
      ctx.font = `${10 * dpr}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(i.toString(), gx, padT + plotH + 16 * dpr);
    }

    // Reference root line (Lime dashed)
    const rootY = toPlotY(result.finalX);
    ctx.save();
    ctx.strokeStyle = SEMANTIC.next_x;
    ctx.lineWidth = 1.4 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(padL, rootY);
    ctx.lineTo(padL + plotW, rootY);
    ctx.stroke();
    ctx.restore();

    // Trajectory (Azure)
    ctx.save();
    ctx.strokeStyle = SEMANTIC.curve_azure;
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    for (let i = 0; i < iters.length; i++) {
      const px = toPlotX(iters[i]!);
      const py = toPlotY(xVals[i]!);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Dots
    for (let i = 0; i < iters.length; i++) {
      const px = toPlotX(iters[i]!);
      const py = toPlotY(xVals[i]!);
      ctx.fillStyle = SEMANTIC.curve_azure;
      ctx.beginPath();
      ctx.arc(px, py, 3.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Highlight selected step (Coral circle)
    const selIdx = selectedStep + 1;
    if (selIdx < iters.length) {
      const hx = toPlotX(iters[selIdx]!);
      const hy = toPlotY(xVals[selIdx]!);
      ctx.fillStyle = SEMANTIC.current_x;
      ctx.beginPath();
      ctx.arc(hx, hy, 6 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.fillStyle = TEXT.text_1;
    ctx.font = `600 ${12 * dpr}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('Approximation History (xₙ vs Iteration)', padL, 22 * dpr);

    // Y Axis label
    ctx.fillStyle = TEXT.text_2;
    ctx.font = `${10 * dpr}px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(result.finalX.toFixed(4), padL - 8 * dpr, rootY + 3 * dpr);
  }, [result, selectedStep]);

  // Draw Residual Convergence Chart (Log Scale)
  useEffect(() => {
    const canvas = residualCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padL = 55 * dpr;
    const padR = 25 * dpr;
    const padT = 35 * dpr;
    const padB = 35 * dpr;
    const plotW = canvas.width - padL - padR;
    const plotH = canvas.height - padT - padB;

    const iters: number[] = [];
    const residuals: number[] = [];
    const floorVal = 1e-16;

    if (result.records.length === 0) {
      iters.push(0);
      residuals.push(Math.max(result.finalResidual || 1.0, floorVal));
    } else {
      for (const r of result.records) {
        iters.push(r.n + 1);
        residuals.push(Math.max(Number.isFinite(r.residual) ? r.residual : floorVal, floorVal));
      }
    }

    const minX = 1;
    const maxX = Math.max(1, iters[iters.length - 1]!);

    const logResiduals = residuals.map(r => Math.log10(r));
    const logTol = Math.log10(Math.max(result.tolerance, floorVal));

    const minLogY = Math.min(...logResiduals, logTol) - 0.5;
    const maxLogY = Math.max(...logResiduals, logTol) + 0.5;

    const toPlotX = (iter: number) => padL + ((iter - minX) / Math.max(1, maxX - minX)) * plotW;
    const toPlotY = (logVal: number) => padT + (1 - (logVal - minLogY) / (maxLogY - minLogY)) * plotH;

    // Grid lines
    ctx.strokeStyle = SURFACES.grid_major;
    ctx.lineWidth = 1 * dpr;
    for (let i = minX; i <= maxX; i += Math.max(1, Math.round(maxX / 6))) {
      const gx = toPlotX(i);
      ctx.beginPath();
      ctx.moveTo(gx, padT);
      ctx.lineTo(gx, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = TEXT.text_3;
      ctx.font = `${10 * dpr}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(i.toString(), gx, padT + plotH + 16 * dpr);
    }

    // Tolerance threshold line (Amber-Gold dashed)
    const tolY = toPlotY(logTol);
    ctx.save();
    ctx.strokeStyle = SEMANTIC.tangent;
    ctx.lineWidth = 1.4 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(padL, tolY);
    ctx.lineTo(padL + plotW, tolY);
    ctx.stroke();
    ctx.restore();

    // Residual line (Lime)
    ctx.save();
    ctx.strokeStyle = SEMANTIC.next_x;
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    for (let i = 0; i < iters.length; i++) {
      const px = toPlotX(iters[i]!);
      const py = toPlotY(logResiduals[i]!);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    for (let i = 0; i < iters.length; i++) {
      const px = toPlotX(iters[i]!);
      const py = toPlotY(logResiduals[i]!);
      ctx.fillStyle = SEMANTIC.next_x;
      ctx.beginPath();
      ctx.arc(px, py, 3.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Highlight selected step (Coral circle)
    if (selectedStep < logResiduals.length) {
      const hx = toPlotX(iters[selectedStep]!);
      const hy = toPlotY(logResiduals[selectedStep]!);
      ctx.fillStyle = SEMANTIC.current_x;
      ctx.beginPath();
      ctx.arc(hx, hy, 6 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.fillStyle = TEXT.text_1;
    ctx.font = `600 ${12 * dpr}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('Residual Convergence (|f(xₙ₊₁)|, Log Scale)', padL, 22 * dpr);

    // Tolerance label
    ctx.fillStyle = SEMANTIC.tangent;
    ctx.font = `${9.5 * dpr}px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`tol = ${result.tolerance.toExponential(1)}`, padL + plotW - 4 * dpr, tolY - 5 * dpr);
  }, [result, selectedStep]);

  const resText = Number.isFinite(result.finalResidual) ? result.finalResidual.toExponential(3) : 'NaN';
  const statusColor =
    result.severity === 'success'
      ? UI_STATES.success
      : result.severity === 'warning'
      ? UI_STATES.warning
      : UI_STATES.error;

  return (
    <div style={{ marginBottom: '14px' }}>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '1.05rem',
          marginBottom: '8px',
          color: 'var(--text-1)',
        }}
      >
        Convergence Analysis
      </h3>

      {/* 4 Summary Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        <div className="nr-card">
          <div className="nr-card-title">Final Approximate Root</div>
          <div className="nr-card-value" style={{ color: SEMANTIC.root_ring }}>
            {result.finalX.toPrecision(10)}
          </div>
        </div>

        <div className="nr-card">
          <div className="nr-card-title">Total Iterations</div>
          <div className="nr-card-value">{result.iterations}</div>
        </div>

        <div className="nr-card">
          <div className="nr-card-title">Final Residual |f(x*)|</div>
          <div className="nr-card-value">{resText}</div>
        </div>

        <div className="nr-card">
          <div className="nr-card-title">Outcome Status</div>
          <div className="nr-card-value" style={{ color: statusColor, fontSize: '0.95rem' }}>
            {result.statusLabel}
          </div>
        </div>
      </div>

      {/* 2 Diagnostic Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}
      >
        <div
          className="nr-panel"
          style={{
            height: '240px',
            padding: 0,
            overflow: 'hidden',
            backgroundColor: 'var(--ink-900)',
            marginBottom: 0,
          }}
        >
          <canvas ref={approxCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        <div
          className="nr-panel"
          style={{
            height: '240px',
            padding: 0,
            overflow: 'hidden',
            backgroundColor: 'var(--ink-900)',
            marginBottom: 0,
          }}
        >
          <canvas ref={residualCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>
    </div>
  );
};
