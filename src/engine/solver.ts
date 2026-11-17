/**
 * Newton-Raphson numerical engine.
 *
 * CONVERGENCE CRITERION:
 * The algorithm declares convergence IF AND ONLY IF |f(x_next)| <= tolerance.
 * The iterate step change |x_next - x_n| is recorded for diagnostics and table
 * inspection, but is NEVER used alone to declare success.
 *
 * DATA FLOW:
 * User expression text -> parseExpression() -> AST -> differentiate() -> simplify()
 * -> buildEvaluator() -> solve() -> NewtonResult with StepRecord list.
 */

import {
  ExpressionError,
  astToLatex,
  buildEvaluator,
  differentiate,
  parseExpression,
  simplify,
} from './parser';

// ============================================================================
// Data Types
// ============================================================================

export interface StepRecord {
  readonly n: number;
  readonly x_n: number;
  readonly f_xn: number;
  readonly df_xn: number;
  readonly correction: number;
  readonly x_next: number;
  readonly f_xnext: number;   // NaN if evaluation failed
  readonly abs_change: number;
  readonly residual: number;  // NaN if evaluation failed
}

export type SolveStatus =
  | 'converged'
  | 'already_root'
  | 'zero_derivative'
  | 'domain_error'
  | 'numerical_error'
  | 'diverged'
  | 'stalled'
  | 'max_iterations';

export type Severity = 'success' | 'warning' | 'error';

export interface NewtonResult {
  readonly expressionText: string;
  readonly expressionLatex: string;
  readonly derivativeLatex: string;
  readonly f: (x: number) => number;
  readonly df: (x: number) => number;
  readonly x0: number;
  readonly tolerance: number;
  readonly maxIterations: number;
  readonly records: readonly StepRecord[];
  readonly status: SolveStatus;
  readonly statusLabel: string;
  readonly severity: Severity;
  readonly converged: boolean;
  readonly iterations: number;
  readonly message: string;
  readonly finalX: number;
  readonly finalResidual: number;
  readonly failedStep: StepRecord | null;
}

// ============================================================================
// Status Helpers
// ============================================================================

const STATUS_LABELS: Record<SolveStatus, string> = {
  converged: 'Converged',
  already_root: 'Already at Root',
  zero_derivative: 'Zero Derivative (Flat Tangent)',
  domain_error: 'Domain Error (Left Domain)',
  numerical_error: 'Numerical Error',
  diverged: 'Diverged',
  stalled: 'Stalled (Zero Step, High Residual)',
  max_iterations: 'Maximum Iterations Reached',
};

function getSeverity(status: SolveStatus): Severity {
  if (status === 'converged' || status === 'already_root') return 'success';
  if (status === 'stalled' || status === 'max_iterations') return 'warning';
  return 'error';
}

// ============================================================================
// Safe Evaluation
// ============================================================================

function evaluateScalar(fn: (x: number) => number, x: number): number | null {
  try {
    const result = fn(x);
    if (typeof result !== 'number' || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

export function evaluateArray(fn: (x: number) => number, xs: Float64Array): Float64Array {
  const ys = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]!;
    try {
      const y = fn(x);
      ys[i] = (Number.isFinite(y) && Math.abs(y) < 1e12) ? y : NaN;
    } catch {
      ys[i] = NaN;
    }
  }
  return ys;
}

// ============================================================================
// Tangent Line Helpers
// ============================================================================

export function tangentY(step: StepRecord, x: number): number {
  return step.f_xn + step.df_xn * (x - step.x_n);
}

export function tangentXIntercept(x_n: number, f_val: number, df_val: number): number {
  if (df_val === 0 || !Number.isFinite(df_val)) return NaN;
  return x_n - f_val / df_val;
}

// ============================================================================
// Newton-Raphson Solver
// ============================================================================

const ZERO_DERIV_THRESHOLD = 1e-12;
const DIVERGENCE_LIMIT = 1e12;

export function solve(
  text: string,
  x0: number,
  tol: number = 1e-6,
  maxIter: number = 20,
): NewtonResult {
  // Parse and differentiate
  const ast = parseExpression(text);
  const derivAst = simplify(differentiate(ast));

  const f = buildEvaluator(ast);
  const df = buildEvaluator(derivAst);

  const expressionLatex = astToLatex(ast);
  const derivativeLatex = astToLatex(derivAst);

  return newtonRaphson(f, df, x0, tol, maxIter, text, expressionLatex, derivativeLatex);
}

function newtonRaphson(
  f: (x: number) => number,
  df: (x: number) => number,
  x0: number,
  tol: number,
  maxIter: number,
  expressionText: string,
  expressionLatex: string,
  derivativeLatex: string,
): NewtonResult {
  // Input validation
  if (!Number.isFinite(x0)) {
    throw new ExpressionError('Initial guess x0 must be a finite number.');
  }
  if (!(Number.isFinite(tol) && tol > 0)) {
    throw new ExpressionError('Tolerance must be a positive finite number.');
  }
  if (maxIter < 1) {
    throw new ExpressionError('Maximum iterations must be an integer >= 1.');
  }

  const makeResult = (
    records: StepRecord[],
    status: SolveStatus,
    message: string,
    finalX: number,
    finalResidual: number,
    failedStep: StepRecord | null = null,
  ): NewtonResult => ({
    expressionText,
    expressionLatex,
    derivativeLatex,
    f,
    df,
    x0,
    tolerance: tol,
    maxIterations: maxIter,
    records,
    status,
    statusLabel: STATUS_LABELS[status],
    severity: getSeverity(status),
    converged: status === 'converged' || status === 'already_root',
    iterations: records.length,
    message,
    finalX,
    finalResidual,
    failedStep,
  });

  // Evaluate at initial guess
  const f0 = evaluateScalar(f, x0);
  if (f0 === null) {
    return makeResult(
      [], 'domain_error',
      `Initial guess x0 = ${x0} cannot be evaluated (domain error).`,
      x0, NaN,
    );
  }

  // Check if already a root
  if (Math.abs(f0) <= tol) {
    return makeResult(
      [], 'already_root',
      `Initial guess x0 = ${x0} is already a root within tolerance (|f(x0)| = ${Math.abs(f0).toExponential(2)} <= ${tol.toExponential(2)}).`,
      x0, Math.abs(f0),
    );
  }

  const records: StepRecord[] = [];
  let xCurr = x0;
  let status: SolveStatus = 'max_iterations';
  let message = '';
  let failedStep: StepRecord | null = null;

  for (let n = 0; n < maxIter; n++) {
    // Evaluate f and df at x_curr
    const fCurr = evaluateScalar(f, xCurr);
    const dfCurr = evaluateScalar(df, xCurr);

    if (fCurr === null || dfCurr === null) {
      status = 'numerical_error';
      message = `Numerical evaluation failed at step ${n} (x_${n} = ${xCurr}).`;
      break;
    }

    // Check for zero/near-zero derivative
    if (Math.abs(dfCurr) < ZERO_DERIV_THRESHOLD) {
      status = 'zero_derivative';
      message = `Derivative is nearly zero (|f'(${xCurr})| = ${Math.abs(dfCurr).toExponential(2)} < 1e-12) at step ${n}. ` +
        'The tangent line is horizontal and cannot intersect the x-axis.';
      break;
    }

    const correction = fCurr / dfCurr;
    const xNext = xCurr - correction;

    if (!Number.isFinite(xNext)) {
      status = 'numerical_error';
      message = `Next iterate x_${n + 1} became non-finite (${xNext}) at step ${n}.`;
      break;
    }

    // Evaluate f at x_next
    const fNext = evaluateScalar(f, xNext);

    if (fNext === null) {
      // Domain error on next iterate
      failedStep = {
        n, x_n: xCurr, f_xn: fCurr, df_xn: dfCurr,
        correction, x_next: xNext, f_xnext: NaN,
        abs_change: Math.abs(xNext - xCurr), residual: NaN,
      };
      status = 'domain_error';
      message = `Next iterate x_${n + 1} = ${xNext} stepped outside the function domain at step ${n}.`;
      return makeResult(records, status, message, xNext, NaN, failedStep);
    }

    const absChange = Math.abs(xNext - xCurr);
    const residual = Math.abs(fNext);

    const rec: StepRecord = {
      n, x_n: xCurr, f_xn: fCurr, df_xn: dfCurr,
      correction, x_next: xNext, f_xnext: fNext,
      abs_change: absChange, residual,
    };
    records.push(rec);

    // CONVERGENCE TEST (residual-based ONLY)
    if (residual <= tol) {
      status = 'converged';
      message = `Converged to root x = ${xNext.toPrecision(10)} in ${n + 1} iteration${n > 0 ? 's' : ''} ` +
        `(|f(x_${n + 1})| = ${residual.toExponential(2)} <= tol ${tol.toExponential(2)}).`;
      break;
    }

    // Divergence check
    if (Math.abs(xNext) > DIVERGENCE_LIMIT) {
      status = 'diverged';
      message = `Iterate diverged at step ${n}: |x_${n + 1}| = ${Math.abs(xNext).toExponential(2)} exceeded 1e12.`;
      break;
    }

    // Stalled check
    if (absChange === 0 && residual > tol) {
      status = 'stalled';
      message = `The iteration stalled at step ${n} (no change in x: |x_${n + 1} - x_${n}| = 0) ` +
        `while residual |f(x_${n + 1})| = ${residual.toExponential(2)} remains greater than tolerance ${tol.toExponential(2)}. ` +
        'This is NOT convergence.';
      break;
    }

    xCurr = xNext;
  }

  // If loop finished without breaking
  if (status === 'max_iterations') {
    const lastRes = records.length > 0 ? records[records.length - 1]!.residual : Math.abs(f0);
    message = `Maximum iterations (${maxIter}) reached without satisfying tolerance ` +
      `(final residual |f(x)| = ${lastRes.toExponential(2)} > tol ${tol.toExponential(2)}).`;
  }

  const finalX = records.length > 0 ? records[records.length - 1]!.x_next : x0;
  const finalResidual = records.length > 0 ? records[records.length - 1]!.residual : Math.abs(f0);

  return makeResult(records, status, message, finalX, finalResidual, failedStep);
}

// Re-export parser types
export { ExpressionError } from './parser';
export type { ASTNode } from './parser';
