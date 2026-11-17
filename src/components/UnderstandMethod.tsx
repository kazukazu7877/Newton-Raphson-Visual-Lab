import React, { useState } from 'react';
import { MathView } from './MathView';
import { SEMANTIC } from '../engine/tokens';

export const UnderstandMethod: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div
      className="nr-panel"
      style={{
        marginTop: '12px',
        marginBottom: '24px',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          color: 'var(--text-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.94rem',
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
        }}
        aria-expanded={isOpen}
      >
        <span>Understand the Method (Mathematical Foundations & Algorithm Guide)</span>
        <span
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            color: 'var(--text-3)',
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: '4px 18px 18px 18px', borderTop: '1px solid var(--line)' }}>
          <h4
            style={{
              fontSize: '0.92rem',
              color: 'var(--curve-azure)',
              marginTop: '12px',
              marginBottom: '10px',
              fontWeight: 600,
            }}
          >
            Conceptual Foundation: 8 Key Principles
          </h4>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px 20px',
              fontSize: '0.82rem',
              lineHeight: 1.45,
            }}
          >
            <div>
              <p style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text-1)' }}>1. What is a root of an equation?</strong>
                <br />
                <span style={{ color: 'var(--text-2)' }}>
                  A root x* satisfies f(x*) = 0, where the curve crosses or touches the x-axis.
                </span>
              </p>

              <p style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text-1)' }}>2. Why do we need an initial approximation?</strong>
                <br />
                <span style={{ color: 'var(--text-2)' }}>
                  Non-linear equations lack exact formulas; an initial guess x0 seeds the sequence of successive refinements.
                </span>
              </p>

              <p style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text-1)' }}>3. Why does the derivative matter?</strong>
                <br />
                <span style={{ color: 'var(--text-2)' }}>
                  The derivative f'(x_n) sets tangent slope and step size; near-zero slopes cause numerical division failure.
                </span>
              </p>

              <p style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text-1)' }}>4. What is the role of the tangent line?</strong>
                <br />
                <span style={{ color: 'var(--text-2)' }}>
                  The tangent replaces the non-linear curve locally with its simplest first-order linear approximation.
                </span>
              </p>
            </div>

            <div>
              <p style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text-1)' }}>5. Why does the tangent line hit the x-axis?</strong>
                <br />
                <span style={{ color: 'var(--text-2)' }}>
                  Every non-horizontal tangent line intersects y = 0 at exactly one point: x_{'{n+1}'} = x_n - f(x_n)/f'(x_n).
                </span>
              </p>

              <p style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text-1)' }}>6. Why is the intercept a better guess?</strong>
                <br />
                <span style={{ color: 'var(--text-2)' }}>
                  Near simple roots, the tangent intercept doubles correct decimal digits each iteration (quadratic convergence).
                </span>
              </p>

              <p style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text-1)' }}>7. Why do we repeat the process?</strong>
                <br />
                <span style={{ color: 'var(--text-2)' }}>
                  Curvature leaves residual error after one step; repeating the linear projection hones in on x*.
                </span>
              </p>

              <p style={{ marginBottom: '8px' }}>
                <strong style={{ color: 'var(--text-1)' }}>8. How do we know when the method has converged?</strong>
                <br />
                <span style={{ color: 'var(--text-2)' }}>
                  Convergence requires residual |f(x_{'{n+1}'})| ≤ tolerance; iterate step size alone never guarantees true convergence.
                </span>
              </p>
            </div>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--line)', margin: '14px 0' }} />

          <h4
            style={{
              fontSize: '0.92rem',
              color: 'var(--curve-azure)',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            The Update Formula & Symbol Breakdown
          </h4>

          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <MathView math="x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}" block />
          </div>

          <ul
            style={{
              listStyle: 'none',
              paddingLeft: 0,
              fontSize: '0.82rem',
              color: 'var(--text-2)',
              lineHeight: 1.6,
            }}
          >
            <li>
              • <strong style={{ color: SEMANTIC.current_x }}>xₙ</strong>: Current numerical approximation at step n.
            </li>
            <li>
              • <strong style={{ color: 'var(--text-1)' }}>f(xₙ)</strong>: Function value (height above axis) at current point.
            </li>
            <li>
              • <strong style={{ color: SEMANTIC.tangent }}>f'(xₙ)</strong>: Analytical derivative (tangent slope) at current point.
            </li>
            <li>
              • <strong style={{ color: 'var(--text-1)' }}>f(xₙ) / f'(xₙ)</strong>: Newton correction increment (horizontal distance to x-intercept).
            </li>
            <li>
              • <strong style={{ color: SEMANTIC.next_x }}>xₙ₊₁</strong>: Next improved approximation (tangent intercept on y = 0).
            </li>
          </ul>

          <div style={{ height: '1px', backgroundColor: 'var(--line)', margin: '14px 0' }} />

          <h4
            style={{
              fontSize: '0.92rem',
              color: 'var(--curve-azure)',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            6-Step Algorithmic Procedure
          </h4>

          <ol
            style={{
              paddingLeft: '18px',
              fontSize: '0.82rem',
              color: 'var(--text-2)',
              lineHeight: 1.6,
            }}
          >
            <li>
              <strong style={{ color: 'var(--text-1)' }}>Validate & Initialize:</strong> Given f(x), initial guess x₀, tolerance ε &gt; 0, and max iterations N. If |f(x₀)| ≤ ε, stop immediately with status <em>Already at Root</em>.
            </li>
            <li>
              <strong style={{ color: 'var(--text-1)' }}>Evaluate Slope:</strong> Compute f'(xₙ). If |f'(xₙ)| &lt; 10⁻¹², stop with status <em>Zero Derivative</em> (horizontal tangent).
            </li>
            <li>
              <strong style={{ color: 'var(--text-1)' }}>Compute Step Correction:</strong> Calculate Δx = f(xₙ) / f'(xₙ).
            </li>
            <li>
              <strong style={{ color: 'var(--text-1)' }}>Update Iterate:</strong> Set xₙ₊₁ = xₙ − Δx. Stop with <em>Diverged</em> if |xₙ₊₁| &gt; 10¹².
            </li>
            <li>
              <strong style={{ color: 'var(--text-1)' }}>Evaluate Next Residual:</strong> Compute f(xₙ₊₁). Stop with <em>Domain Error</em> if outside mathematical domain.
            </li>
            <li>
              <strong style={{ color: 'var(--text-1)' }}>Check Convergence:</strong> If |f(xₙ₊₁)| ≤ ε, stop with <em>Converged</em>. If Δx = 0 while residual &gt; ε, stop with <em>Stalled</em>. If n = N, stop with <em>Maximum Iterations</em>. Otherwise repeat from Step 2.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
};
