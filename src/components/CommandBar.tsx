import React, { useState, useEffect } from 'react';
import type { NewtonResult } from '../engine/solver';

export interface PresetConfig {
  name: string;
  expr: string;
  x0: number;
  tol: string;
  maxIter: number;
}

export const PRESETS: PresetConfig[] = [
  {
    name: 'x³ − 2x − 5 (x₀ = 2) [Standard Benchmark]',
    expr: 'x**3 - 2*x - 5',
    x0: 2.0,
    tol: '1e-6',
    maxIter: 20,
  },
  {
    name: 'x² − 2 (x₀ = 1) [Square Root of 2]',
    expr: 'x**2 - 2',
    x0: 1.0,
    tol: '1e-6',
    maxIter: 20,
  },
  {
    name: 'x³ − x − 1 (x₀ = 1.5) [Plastic Constant]',
    expr: 'x**3 - x - 1',
    x0: 1.5,
    tol: '1e-6',
    maxIter: 20,
  },
  {
    name: 'cos(x) − x (x₀ = 1) [Dottie Number]',
    expr: 'cos(x) - x',
    x0: 1.0,
    tol: '1e-6',
    maxIter: 20,
  },
  {
    name: 'e⁻ˣ − x (x₀ = 0.5) [Omega Constant]',
    expr: 'exp(-x) - x',
    x0: 0.5,
    tol: '1e-6',
    maxIter: 20,
  },
  {
    name: 'Failure demo: Flat tangent (x² − 2, x₀ = 0)',
    expr: 'x**2 - 2',
    x0: 0.0,
    tol: '1e-6',
    maxIter: 20,
  },
  {
    name: 'Failure demo: Endless cycle (x³ − 2x + 2, x₀ = 0)',
    expr: 'x**3 - 2*x + 2',
    x0: 0.0,
    tol: '1e-6',
    maxIter: 15,
  },
  {
    name: 'Failure demo: Leaves the domain (log(x), x₀ = 3)',
    expr: 'log(x)',
    x0: 3.0,
    tol: '1e-6',
    maxIter: 20,
  },
];

export interface ExternalLoadRequest {
  name: string;
  expr: string;
  x0: number;
  tol?: number;
  maxIter?: number;
  timestamp: number;
}

interface CommandBarProps {
  onRun: (expr: string, x0: number, tol: number, maxIter: number) => void;
  result: NewtonResult | null;
  errorMsg: string | null;
  externalLoad?: ExternalLoadRequest | null;
}

export const CommandBar: React.FC<CommandBarProps> = ({ onRun, result, errorMsg, externalLoad }) => {
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [customName, setCustomName] = useState<string | null>(null);
  const [expr, setExpr] = useState<string>(PRESETS[0]!.expr);
  const [x0, setX0] = useState<string>(PRESETS[0]!.x0.toString());
  const [tol, setTol] = useState<string>(PRESETS[0]!.tol);
  const [maxIter, setMaxIter] = useState<string>(PRESETS[0]!.maxIter.toString());
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync with external application load requests (e.g. from Applications section)
  useEffect(() => {
    if (externalLoad) {
      setCustomName(externalLoad.name);
      setSelectedPreset(-1);
      setExpr(externalLoad.expr);
      setX0(externalLoad.x0.toString());
      const tolNum = externalLoad.tol ?? parseFloat(tol);
      setTol(tolNum.toString());
      const maxIterNum = externalLoad.maxIter ?? parseInt(maxIter, 10);
      setMaxIter(maxIterNum.toString());
      setLocalError(null);
      onRun(externalLoad.expr, externalLoad.x0, tolNum, maxIterNum);
    }
  }, [externalLoad]);

  const handlePresetChange = (idx: number) => {
    setSelectedPreset(idx);
    if (idx === -1) return;
    setCustomName(null);
    const p = PRESETS[idx];
    if (p) {
      setExpr(p.expr);
      setX0(p.x0.toString());
      setTol(p.tol);
      setMaxIter(p.maxIter.toString());
      setLocalError(null);
      const tolNum = parseFloat(p.tol);
      onRun(p.expr, p.x0, tolNum, p.maxIter);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const x0Num = parseFloat(x0);
    if (!Number.isFinite(x0Num)) {
      setLocalError('Initial guess x₀ must be a finite number.');
      return;
    }

    const tolNum = parseFloat(tol);
    if (!Number.isFinite(tolNum) || tolNum <= 0) {
      setLocalError('Tolerance must be a positive finite number (e.g. 1e-6).');
      return;
    }

    const maxIterNum = parseInt(maxIter, 10);
    if (!Number.isFinite(maxIterNum) || maxIterNum < 1 || maxIterNum > 200) {
      setLocalError('Max iterations must be an integer between 1 and 200.');
      return;
    }

    onRun(expr, x0Num, tolNum, maxIterNum);
  };

  const displayError = localError || errorMsg;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div className="nr-panel command-bar-layout">
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.78rem',
              color: 'var(--text-3)',
              marginBottom: '5px',
              fontWeight: 500,
            }}
          >
            Example Equation or Failure Mode
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(parseInt(e.target.value, 10))}
            aria-label="Example Equation or Failure Mode"
          >
            {customName && (
              <option value={-1}>
                Custom: {customName}
              </option>
            )}
            {PRESETS.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSubmit} className="form-inputs-layout">
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                color: 'var(--text-3)',
                marginBottom: '5px',
                fontWeight: 500,
              }}
            >
              Function f(x)
            </label>
            <input
              type="text"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="x**3 - 2*x - 5"
              title="Supported: + - * / ** sin cos tan exp log ln sqrt abs asin acos atan sinh cosh tanh pi e"
              aria-label="Function f(x)"
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                color: 'var(--text-3)',
                marginBottom: '5px',
                fontWeight: 500,
              }}
            >
              Initial guess x₀
            </label>
            <input
              type="number"
              step="any"
              value={x0}
              onChange={(e) => setX0(e.target.value)}
              aria-label="Initial guess x0"
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                color: 'var(--text-3)',
                marginBottom: '5px',
                fontWeight: 500,
              }}
            >
              Max iter
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={maxIter}
              onChange={(e) => setMaxIter(e.target.value)}
              aria-label="Max iterations"
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                color: 'var(--text-3)',
                marginBottom: '5px',
                fontWeight: 500,
              }}
            >
              Tolerance
            </label>
            <input
              type="text"
              value={tol}
              onChange={(e) => setTol(e.target.value)}
              aria-label="Tolerance"
            />
          </div>

          <div>
            <button type="submit" className="btn-primary" style={{ width: '100%', height: '36px' }}>
              Run Simulation
            </button>
          </div>
        </form>
      </div>

      {displayError && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(255, 107, 127, 0.12)',
            border: '1px solid var(--ui-error)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '0.82rem',
            color: 'var(--ui-error)',
            marginBottom: '8px',
          }}
        >
          <strong>Input Error:</strong> {displayError}
        </div>
      )}

      {result && (
        <div
          role="status"
          style={{
            backgroundColor:
              result.severity === 'success'
                ? 'rgba(110, 231, 168, 0.12)'
                : result.severity === 'warning'
                ? 'rgba(255, 194, 71, 0.12)'
                : 'rgba(255, 107, 127, 0.12)',
            border: `1px solid ${
              result.severity === 'success'
                ? 'var(--ui-success)'
                : result.severity === 'warning'
                ? 'var(--ui-warning)'
                : 'var(--ui-error)'
            }`,
            borderRadius: '6px',
            padding: '7px 12px',
            fontSize: '0.82rem',
            color:
              result.severity === 'success'
                ? 'var(--ui-success)'
                : result.severity === 'warning'
                ? 'var(--ui-warning)'
                : 'var(--ui-error)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px',
            wordBreak: 'break-word',
          }}
        >
          <span style={{ fontWeight: 600 }}>Status: {result.statusLabel}</span>
          <span style={{ opacity: 0.85 }}>— {result.message}</span>
        </div>
      )}
    </div>
  );
};
