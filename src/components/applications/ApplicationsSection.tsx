import React from 'react';
import { APPLICATION_CARDS } from '../../content/applications';
import { KeplerDemo } from './KeplerDemo';
import { ApplicationCard } from './ApplicationCard';
import { TEXT, SURFACES } from '../../engine/tokens';

interface ApplicationsSectionProps {
  onLoadApplication: (name: string, expr: string, x0: number, tol?: number, maxIter?: number) => void;
}

export const ApplicationsSection: React.FC<ApplicationsSectionProps> = ({ onLoadApplication }) => {
  const tryCards = APPLICATION_CARDS.filter((c) => c.kind === 'try');
  const conceptCards = APPLICATION_CARDS.filter((c) => c.kind === 'concept');

  return (
    <section id="applications" style={{ marginBottom: '24px' }}>
      {/* Section Header */}
      <div style={{ marginBottom: '14px' }}>
        <h2
          className="nr-title"
          style={{
            fontSize: '1.45rem',
            fontWeight: 700,
            color: TEXT.text_1,
            margin: '0 0 4px 0',
          }}
        >
          Where it is used
        </h2>
        <p
          style={{
            fontSize: '0.88rem',
            color: TEXT.text_2,
            margin: 0,
          }}
        >
          The same tangent-and-repeat idea sits inside many tools. Try the ones that fit in a single equation.
        </p>
      </div>

      {/* Part A: Featured Live Demo (Kepler's Equation) */}
      <KeplerDemo onOpenInLab={onLoadApplication} />

      {/* Part B: Single-Variable Applications (Try these in the lab) */}
      <div style={{ marginBottom: '20px' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: TEXT.text_1,
            marginBottom: '10px',
          }}
        >
          Try these in the lab
        </h3>

        <div className="applications-grid">
          {tryCards.map((card) => (
            <ApplicationCard key={card.id} card={card} onTry={onLoadApplication} />
          ))}
        </div>
      </div>

      {/* Part C: Multi-Variable Applications (The same idea with many unknowns) */}
      <div style={{ marginBottom: '16px' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: TEXT.text_1,
            marginBottom: '4px',
          }}
        >
          The same idea with many unknowns
        </h3>

        <p
          style={{
            fontSize: '0.82rem',
            color: TEXT.text_3,
            lineHeight: 1.45,
            marginBottom: '12px',
          }}
        >
          These solve many equations at once, using a matrix of derivatives (the Jacobian) in place of the single slope.
        </p>

        <div className="applications-grid">
          {conceptCards.map((card) => (
            <ApplicationCard key={card.id} card={card} onTry={onLoadApplication} />
          ))}
        </div>
      </div>

      {/* Closing Summary */}
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: SURFACES.ink_900,
          border: `1px solid ${SURFACES.line}`,
          borderRadius: '6px',
          fontSize: '0.82rem',
          color: TEXT.text_2,
          lineHeight: 1.5,
        }}
      >
        Newton–Raphson is fast near a root (the number of correct digits roughly doubles each step) but needs a reasonable starting guess and a non-zero slope, which is why real solvers add safeguards.
      </div>
    </section>
  );
};
