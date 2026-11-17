import React from 'react';
import type { NewtonResult, StepRecord } from '../engine/solver';
import { MathView } from './MathView';
import { SEMANTIC, UI_STATES } from '../engine/tokens';

interface CalculationPanelProps {
  result: NewtonResult;
  selectedStep: number;
}

function formatNum(val: number): string {
  if (!Number.isFinite(val)) return String(val);
  if (val === 0) return '0';
  if (Math.abs(val) < 1e-4 || Math.abs(val) >= 1e7) {
    return val.toExponential(6);
  }
  const str = val.toFixed(6).replace(/\.?0+$/, '');
  return str === '-0' ? '0' : str;
}

function formatSubst(val: number): string {
  const s = formatNum(val);
  return val < 0 ? `(${s})` : s;
}

export const CalculationPanel: React.FC<CalculationPanelProps> = ({ result, selectedStep }) => {
  const records = result.records;
  const numRecords = records.length;
  const clampedSel = Math.max(0, Math.min(selectedStep, Math.max(0, numRecords - 1)));

  let activeStep: StepRecord | null = null;
  let isFailedStep = false;

  if (numRecords > 0 && clampedSel < numRecords) {
    activeStep = records[clampedSel]!;
  } else if (result.failedStep) {
    activeStep = result.failedStep;
    isFailedStep = true;
  }

  return (
    <div
      className="nr-panel"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '14px',
        marginBottom: 0,
      }}
    >
      <div>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '1.02rem',
            marginBottom: '6px',
            color: 'var(--text-1)',
          }}
        >
          The Calculation
        </h3>

        {/* Function & Derivative */}
        <div style={{ marginBottom: '4px', textAlign: 'center' }}>
          <MathView
            math={`f(x) = ${result.expressionLatex}, \\quad f'(x) = ${result.derivativeLatex}`}
            block
          />
        </div>

        {/* General Update Formula */}
        <div style={{ marginBottom: '6px', textAlign: 'center' }}>
          <MathView math="x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}" block />
        </div>

        {/* Active Step Substitution */}
        {activeStep && (
          <div style={{ marginBottom: '10px', textAlign: 'center' }}>
            <MathView
              math={`x_{${activeStep.n + 1}} = ${formatNum(activeStep.x_n)} - \\frac{${formatSubst(
                activeStep.f_xn,
              )}}{${formatSubst(activeStep.df_xn)}} = ${formatNum(activeStep.x_next)}`}
              block
            />
          </div>
        )}

        {/* 8 Metric Cards Grid */}
        {activeStep ? (
          <div className="calc-metrics-grid">
            <div className="nr-card">
              <div className="nr-card-title">Iteration n</div>
              <div className="nr-card-value">{activeStep.n}</div>
            </div>

            <div className="nr-card">
              <div className="nr-card-title">xₙ (Guess)</div>
              <div className="nr-card-value" style={{ color: SEMANTIC.current_x }}>
                {formatNum(activeStep.x_n)}
              </div>
            </div>

            <div className="nr-card">
              <div className="nr-card-title">f(xₙ)</div>
              <div className="nr-card-value">{formatNum(activeStep.f_xn)}</div>
            </div>

            <div className="nr-card">
              <div className="nr-card-title">f'(xₙ) (Slope)</div>
              <div className="nr-card-value" style={{ color: SEMANTIC.tangent }}>
                {formatNum(activeStep.df_xn)}
              </div>
            </div>

            <div className="nr-card">
              <div className="nr-card-title">Correction (f/f')</div>
              <div className="nr-card-value">{formatNum(activeStep.correction)}</div>
            </div>

            <div className="nr-card">
              <div className="nr-card-title">xₙ₊₁ (Next)</div>
              <div className="nr-card-value" style={{ color: SEMANTIC.next_x }}>
                {formatNum(activeStep.x_next)}
              </div>
            </div>

            <div className="nr-card">
              <div className="nr-card-title">|xₙ₊₁ − xₙ|</div>
              <div className="nr-card-value">{formatNum(activeStep.abs_change)}</div>
            </div>

            <div className="nr-card">
              <div className="nr-card-title">|f(xₙ₊₁)|</div>
              <div className="nr-card-value">
                {Number.isFinite(activeStep.residual) ? formatNum(activeStep.residual) : 'Undefined'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-3)', fontSize: '0.85rem', padding: '12px 0' }}>
            No iterative steps recorded for this configuration.
          </div>
        )}
      </div>

      {/* Stopping Test Line */}
      {activeStep && (
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--line)' }}>
          {!isFailedStep ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
              Stopping test: |f(x_{activeStep.n + 1})| ={' '}
              {Number.isFinite(activeStep.residual) ? activeStep.residual.toExponential(2) : 'NaN'}{' '}
              {activeStep.residual <= result.tolerance ? '≤' : '>'}{' '}
              {result.tolerance.toExponential(2)} (
              {activeStep.residual <= result.tolerance
                ? 'converged'
                : clampedSel === numRecords - 1
                ? 'run concluded'
                : 'continuing'}
              )
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: UI_STATES.error }}>
              Domain violation: x_{activeStep.n + 1} = {formatNum(activeStep.x_next)} is outside domain of f(x).
            </div>
          )}
        </div>
      )}
    </div>
  );
};
