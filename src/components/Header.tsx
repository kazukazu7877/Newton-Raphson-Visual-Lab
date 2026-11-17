import React from 'react';

export const Header: React.FC = () => {
  return (
    <header style={{ marginBottom: '14px' }}>
      <h1
        className="nr-title"
        style={{
          margin: '0 0 2px 0',
          fontSize: '1.85rem',
          fontWeight: 700,
          color: 'var(--text-1)',
        }}
      >
        Newton–Raphson Visual Lab
      </h1>
      <p
        style={{
          color: 'var(--curve-azure)',
          fontSize: '0.92rem',
          fontWeight: 500,
          margin: 0,
        }}
      >
        See how mathematics finds the root.
      </p>
    </header>
  );
};
