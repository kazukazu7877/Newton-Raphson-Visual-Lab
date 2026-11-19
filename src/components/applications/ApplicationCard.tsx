import React from 'react';
import type { ApplicationCardData } from '../../content/applications';
import { MathView } from '../MathView';
import { FunctionThumbnail } from './FunctionThumbnail';
import { SURFACES, TEXT, SEMANTIC, UI_STATES } from '../../engine/tokens';

interface ApplicationCardProps {
  card: ApplicationCardData;
  onTry: (name: string, expr: string, x0: number, tol?: number, maxIter?: number) => void;
}

export const ApplicationCard: React.FC<ApplicationCardProps> = ({ card, onTry }) => {
  const isTry = card.kind === 'try';

  return (
    <div
      className="nr-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '14px',
        backgroundColor: SURFACES.ink_850,
        border: `1px solid ${SURFACES.line}`,
        borderRadius: '6px',
        boxShadow: 'inset 0 1px 0 var(--panel-top-highlight)',
        minHeight: '260px',
        minWidth: 0,
      }}
    >
      <div>
        {/* Domain Badge & Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: TEXT.text_3,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {card.domain}
          </span>
          {isTry && (
            <span
              style={{
                fontSize: '0.68rem',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(77, 163, 255, 0.12)',
                color: UI_STATES.primary,
                border: '1px solid rgba(77, 163, 255, 0.3)',
                fontWeight: 600,
              }}
            >
              Interactive
            </span>
          )}
        </div>

        <h4
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.96rem',
            fontWeight: 700,
            color: TEXT.text_1,
            marginBottom: '6px',
          }}
        >
          {card.title}
        </h4>

        {/* Problem Statement */}
        <p
          style={{
            fontSize: '0.81rem',
            color: TEXT.text_2,
            lineHeight: 1.45,
            marginBottom: '10px',
          }}
        >
          {card.problem}
        </p>

        {/* Equation */}
        <div
          style={{
            marginBottom: '10px',
            textAlign: 'center',
            overflowX: 'auto',
            maxWidth: '100%',
            padding: '4px 0',
          }}
        >
          <MathView math={card.latex} block />
        </div>

        {/* Rationale */}
        <p
          style={{
            fontSize: '0.8rem',
            color: TEXT.text_2,
            lineHeight: 1.45,
            marginBottom: '12px',
          }}
        >
          {card.rationale}
        </p>

        {/* Optional Note */}
        {card.note && (
          <p
            style={{
              fontSize: '0.74rem',
              color: TEXT.text_3,
              lineHeight: 1.4,
              marginBottom: '12px',
            }}
          >
            {card.note}
          </p>
        )}
      </div>

      {/* Footer: Try in the Lab vs Multi-variable note */}
      <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: `1px solid ${SURFACES.line}` }}>
        {isTry && card.expr && card.x0 !== undefined ? (
          <div>
            {card.thumbnailWindow && card.expectedRoot !== undefined && (
              <div style={{ marginBottom: '10px' }}>
                <FunctionThumbnail
                  expr={card.expr}
                  rootX={card.expectedRoot}
                  window={card.thumbnailWindow}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onTry(card.title, card.expr!, card.x0!, card.tol, card.maxIter)}
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Try it in the lab</span>
                <span aria-hidden="true">→</span>
              </button>

              {card.altX0 !== undefined && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => onTry(`${card.title} (${card.altX0Label ?? 'alt x₀'})`, card.expr!, card.altX0!, card.tol, card.maxIter)}
                  style={{
                    fontSize: '0.74rem',
                    padding: '4px 8px',
                    color: SEMANTIC.tangent,
                  }}
                  title={card.altX0Label ?? 'Try alternative starting guess'}
                >
                  {card.altX0Label ?? `Try x₀ = ${card.altX0}`}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p
            style={{
              fontSize: '0.75rem',
              color: TEXT.text_3,
              fontStyle: 'normal',
              lineHeight: 1.4,
              margin: '4px 0',
            }}
          >
            Multi-variable form; the lab solves one equation at a time.
          </p>
        )}
      </div>
    </div>
  );
};
