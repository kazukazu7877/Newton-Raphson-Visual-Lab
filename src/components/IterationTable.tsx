import React from 'react';
import type { NewtonResult } from '../engine/solver';
import { SEMANTIC } from '../engine/tokens';

interface IterationTableProps {
  result: NewtonResult;
  selectedStep: number;
  onSelectStep: (step: number) => void;
}

function formatTableVal(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return 'NaN';
  if (val === 0) return '0.0000000000';
  if (Math.abs(val) < 1e-4 || Math.abs(val) >= 1e7) {
    return val.toExponential(10);
  }
  return val.toFixed(10);
}

export const IterationTable: React.FC<IterationTableProps> = ({
  result,
  selectedStep,
  onSelectStep,
}) => {
  const records = result.records;

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
        Iteration Table
      </h3>

      <div
        style={{
          overflowX: 'auto',
          backgroundColor: 'var(--ink-850)',
          border: '1px solid var(--line)',
          borderRadius: '6px',
          boxShadow: 'inset 0 1px 0 var(--panel-top-highlight)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'right',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--line)',
                color: 'var(--text-3)',
                fontSize: '0.74rem',
                backgroundColor: 'rgba(0,0,0,0.15)',
              }}
            >
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Iteration</th>
              <th style={{ padding: '8px 12px' }}>x_n</th>
              <th style={{ padding: '8px 12px' }}>f(x_n)</th>
              <th style={{ padding: '8px 12px' }}>f'(x_n)</th>
              <th style={{ padding: '8px 12px' }}>f(x_n)/f'(x_n)</th>
              <th style={{ padding: '8px 12px' }}>x_(n+1)</th>
              <th style={{ padding: '8px 12px' }}>Absolute Error</th>
              <th style={{ padding: '8px 12px' }}>|f(x_(n+1))|</th>
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map((r) => {
                const isSelected = r.n === selectedStep;
                return (
                  <tr
                    key={r.n}
                    onClick={() => onSelectStep(r.n)}
                    style={{
                      borderBottom: '1px solid var(--grid-minor)',
                      backgroundColor: isSelected ? SEMANTIC.table_highlight : 'transparent',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <td style={{ padding: '7px 12px', textAlign: 'center', color: 'var(--text-3)' }}>
                      {r.n}
                    </td>
                    <td style={{ padding: '7px 12px', color: isSelected ? SEMANTIC.current_x : 'var(--text-1)' }}>
                      {formatTableVal(r.x_n)}
                    </td>
                    <td style={{ padding: '7px 12px' }}>{formatTableVal(r.f_xn)}</td>
                    <td style={{ padding: '7px 12px', color: isSelected ? SEMANTIC.tangent : 'var(--text-1)' }}>
                      {formatTableVal(r.df_xn)}
                    </td>
                    <td style={{ padding: '7px 12px' }}>{formatTableVal(r.correction)}</td>
                    <td style={{ padding: '7px 12px', color: isSelected ? SEMANTIC.next_x : 'var(--text-1)' }}>
                      {formatTableVal(r.x_next)}
                    </td>
                    <td style={{ padding: '7px 12px' }}>{formatTableVal(r.abs_change)}</td>
                    <td style={{ padding: '7px 12px' }}>{formatTableVal(r.residual)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-3)' }}>
                  No iteration steps recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
