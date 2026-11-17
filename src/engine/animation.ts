/**
 * Animation math precomputation and deterministic frame generation for Newton-Raphson Visual Lab.
 *
 * Strict numerical honesty:
 * All math (curve sampling, tangent sweeps, camera interpolation keyframes,
 * dimension brackets, root bloom parameters) is computed deterministically.
 * The Canvas 2D renderer only interpolates and draws these precomputed coordinates.
 */

import { type NewtonResult, evaluateArray } from './solver';
import { SEMANTIC, SURFACES } from './tokens';

export interface CameraWindow {
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

export interface StepAnimationData {
  n: number;
  x_n: number;
  f_xn: number;
  df_xn: number;
  correction: number;
  x_next: number;
  f_xnext: number | null;
  abs_change: number;
  residual: number | null;
  tangent_x0: number;
  tangent_y0: number;
  tangent_x1: number;
  tangent_y1: number;
  equation: string;
}

export interface FailedStepData {
  n: number;
  x_n: number;
  f_xn: number;
  df_xn: number;
  correction: number;
  x_next: number;
  abs_change: number;
  tangent_x0: number;
  tangent_y0: number;
  tangent_x1: number;
  tangent_y1: number;
}

export interface EmergencePayload {
  expression: string;
  x0: number;
  tolerance: number;
  max_iterations: number;
  status: string;
  status_label: string;
  converged: boolean;
  final_x: number;
  final_residual: number | null;
  curve: {
    x: number[];
    y: number[];
  };
  steps: StepAnimationData[];
  failed_step: FailedStepData | null;
  cameras: {
    whole_path: CameraWindow[];
    follow_step: CameraWindow[];
    cinematic: CameraWindow[];
  };
  colors: typeof SURFACES & typeof SEMANTIC;
}

export function computeCameraWindows(
  result: NewtonResult,
  curveXs: Float64Array,
  curveYs: Float64Array,
): { whole_path: CameraWindow[]; follow_step: CameraWindow[]; cinematic: CameraWindow[] } {
  const records = result.records;
  const numSteps = records.length;

  // 1. Base whole path window
  const allX: number[] = [result.x0];
  for (const r of records) {
    allX.push(r.x_n, r.x_next);
  }
  if (result.failedStep) {
    allX.push(result.failedStep.x_n, result.failedStep.x_next);
  }

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const spanX = maxX - minX;
  const padX = Math.max(0.18 * spanX, 0.85);
  const wpXmin = minX - padX;
  const wpXmax = maxX + padX;

  // Collect key Y points
  const keyYs: number[] = [0.0];
  for (const r of records) {
    if (Number.isFinite(r.f_xn)) keyYs.push(r.f_xn);
    if (Number.isFinite(r.f_xnext)) keyYs.push(r.f_xnext);
  }
  if (result.failedStep && Number.isFinite(result.failedStep.f_xn)) {
    keyYs.push(result.failedStep.f_xn);
  }

  const validKeyYs = keyYs.filter(y => Number.isFinite(y) && Math.abs(y) < 1e12);
  const effectiveKeyYs = validKeyYs.length > 0 ? validKeyYs : [0.0, 1.0];

  const minY = Math.min(...effectiveKeyYs);
  const maxY = Math.max(...effectiveKeyYs);
  let spanY = maxY - minY;
  if (spanY < 1.0) spanY = 1.0;
  const padY = 0.20 * spanY;

  const yMinBase = minY - padY;
  const yMaxBase = maxY + padY;

  // Limit curve contribution to at most 2x key span
  const wpYs: number[] = [];
  for (let i = 0; i < curveXs.length; i++) {
    const x = curveXs[i]!;
    const y = curveYs[i]!;
    if (x >= wpXmin && x <= wpXmax && Number.isFinite(y) && Math.abs(y) < 1e12) {
      wpYs.push(y);
    }
  }

  let wpYmin = yMinBase;
  let wpYmax = yMaxBase;

  if (wpYs.length > 0) {
    const cMin = Math.min(...wpYs);
    const cMax = Math.max(...wpYs);
    const maxExt = 2.0 * spanY;
    wpYmin = Math.max(yMinBase - maxExt, Math.min(yMinBase, cMin - padY));
    wpYmax = Math.min(yMaxBase + maxExt, Math.max(yMaxBase, cMax + padY));
  }

  const wholePathWindow: CameraWindow = {
    x_min: wpXmin,
    x_max: wpXmax,
    y_min: wpYmin,
    y_max: wpYmax,
  };

  // 2. Per-step windows for Follow Step
  const followWindows: CameraWindow[] = [];
  const totalSteps = Math.max(1, numSteps);

  for (let i = 0; i < totalSteps; i++) {
    if (records.length > 0 && i < records.length) {
      const rec = records[i]!;
      const xCurr = rec.x_n;
      const xNxt = rec.x_next;
      const stepSpan = Math.abs(xNxt - xCurr);
      const minPad = 1e-9 * Math.max(1.0, Math.abs(xCurr), Math.abs(xNxt));
      const pX = Math.max(stepSpan * 0.9, minPad, 0.35);
      const fXmin = Math.min(xCurr, xNxt) - pX;
      const fXmax = Math.max(xCurr, xNxt) + pX;

      const sYs = [0.0, rec.f_xn];
      if (Number.isFinite(rec.f_xnext)) sYs.push(rec.f_xnext);
      let sSpanY = Math.max(...sYs) - Math.min(...sYs);
      if (sSpanY < 0.6) sSpanY = 0.6;
      const pY = 0.22 * sSpanY;
      let fYmin = Math.min(...sYs) - pY;
      let fYmax = Math.max(...sYs) + pY;

      // Sample curve within step
      const stepCurveYs: number[] = [];
      for (let j = 0; j < curveXs.length; j++) {
        const x = curveXs[j]!;
        const y = curveYs[j]!;
        if (x >= fXmin && x <= fXmax && Number.isFinite(y)) {
          stepCurveYs.push(y);
        }
      }

      if (stepCurveYs.length > 0) {
        const scMin = Math.min(...stepCurveYs);
        const scMax = Math.max(...stepCurveYs);
        fYmin = Math.max(fYmin - 1.5 * sSpanY, Math.min(fYmin, scMin - pY));
        fYmax = Math.min(fYmax + 1.5 * sSpanY, Math.max(fYmax, scMax + pY));
      }

      followWindows.push({ x_min: fXmin, x_max: fXmax, y_min: fYmin, y_max: fYmax });
    } else if (result.failedStep) {
      const rec = result.failedStep;
      const pX = Math.max(Math.abs(rec.x_next - rec.x_n) * 0.9, 0.35);
      followWindows.push({
        x_min: Math.min(rec.x_n, rec.x_next) - pX,
        x_max: Math.max(rec.x_n, rec.x_next) + pX,
        y_min: Math.min(0.0, rec.f_xn) - 1.0,
        y_max: Math.max(0.0, rec.f_xn) + 1.0,
      });
    } else {
      followWindows.push({ ...wholePathWindow });
    }
  }

  // 3. Cinematic Camera: Starts wide, follows step by step, and finishes with zoom-to-root dive
  const cinematicWindows: CameraWindow[] = [
    { ...wholePathWindow },
    ...followWindows.map(w => ({ ...w })),
  ];

  if (result.converged) {
    const rootX = result.finalX;
    const rootZoomSpan = Math.max(1e-4, 0.05 * (wpXmax - wpXmin));
    cinematicWindows.push({
      x_min: rootX - rootZoomSpan,
      x_max: rootX + rootZoomSpan,
      y_min: -rootZoomSpan * 0.6,
      y_max: rootZoomSpan * 0.6,
    });
  }

  return {
    whole_path: Array.from({ length: numSteps + 1 }, () => ({ ...wholePathWindow })),
    follow_step: followWindows,
    cinematic: cinematicWindows,
  };
}

export function buildEmergencePayload(result: NewtonResult): EmergencePayload {
  const ptsX: number[] = [result.x0];
  for (const r of result.records) {
    ptsX.push(r.x_n, r.x_next);
  }
  if (result.failedStep) {
    ptsX.push(result.failedStep.x_n, result.failedStep.x_next);
  }

  const spanX = Math.max(...ptsX) - Math.min(...ptsX);
  const padX = Math.max(0.35 * spanX, 1.5);
  const domainMin = Math.min(...ptsX) - padX;
  const domainMax = Math.max(...ptsX) + padX;

  const count = 700;
  const curveXs = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    curveXs[i] = domainMin + (i / (count - 1)) * (domainMax - domainMin);
  }
  const curveYs = evaluateArray(result.f, curveXs);

  const cameras = computeCameraWindows(result, curveXs, curveYs);

  const stepsData: StepAnimationData[] = result.records.map(r => {
    const span = Math.max(Math.abs(r.x_next - r.x_n), 0.3);
    const tLeft = Math.min(r.x_n, r.x_next) - 0.25 * span;
    const tRight = Math.max(r.x_n, r.x_next) + 0.25 * span;
    const intercept = r.f_xn - r.df_xn * r.x_n;
    const eqStr = `y = ${r.df_xn.toPrecision(4)}x + ${intercept.toPrecision(4)}`;

    return {
      n: r.n,
      x_n: r.x_n,
      f_xn: r.f_xn,
      df_xn: r.df_xn,
      correction: r.correction,
      x_next: r.x_next,
      f_xnext: Number.isFinite(r.f_xnext) ? r.f_xnext : null,
      abs_change: r.abs_change,
      residual: Number.isFinite(r.residual) ? r.residual : null,
      tangent_x0: tLeft,
      tangent_y0: r.f_xn + r.df_xn * (tLeft - r.x_n),
      tangent_x1: tRight,
      tangent_y1: r.f_xn + r.df_xn * (tRight - r.x_n),
      equation: eqStr,
    };
  });

  let failedData: FailedStepData | null = null;
  if (result.failedStep) {
    const fs = result.failedStep;
    const span = Math.max(Math.abs(fs.x_next - fs.x_n), 0.3);
    const tLeft = Math.min(fs.x_n, fs.x_next) - 0.25 * span;
    const tRight = Math.max(fs.x_n, fs.x_next) + 0.25 * span;

    failedData = {
      n: fs.n,
      x_n: fs.x_n,
      f_xn: fs.f_xn,
      df_xn: fs.df_xn,
      correction: fs.correction,
      x_next: fs.x_next,
      abs_change: fs.abs_change,
      tangent_x0: tLeft,
      tangent_y0: fs.f_xn + fs.df_xn * (tLeft - fs.x_n),
      tangent_x1: tRight,
      tangent_y1: fs.f_xn + fs.df_xn * (tRight - fs.x_n),
    };
  }

  // Clean curve points (drop NaNs for clean rendering)
  const cleanX: number[] = [];
  const cleanY: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = curveXs[i]!;
    const y = curveYs[i]!;
    if (Number.isFinite(y) && Math.abs(y) < 1e12) {
      cleanX.push(Math.round(x * 10000) / 10000);
      cleanY.push(Math.round(y * 10000) / 10000);
    }
  }

  return {
    expression: result.expressionText,
    x0: result.x0,
    tolerance: result.tolerance,
    max_iterations: result.maxIterations,
    status: result.status,
    status_label: result.statusLabel,
    converged: result.converged,
    final_x: result.finalX,
    final_residual: Number.isFinite(result.finalResidual) ? result.finalResidual : null,
    curve: { x: cleanX, y: cleanY },
    steps: stepsData,
    failed_step: failedData,
    cameras,
    colors: { ...SURFACES, ...SEMANTIC },
  };
}
