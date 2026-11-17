import React, { useMemo } from 'react';
import katex from 'katex';

interface MathViewProps {
  math: string;
  block?: boolean;
}

export const MathView: React.FC<MathViewProps> = ({ math, block = false }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: block,
        throwOnError: false,
      });
    } catch {
      return math;
    }
  }, [math, block]);

  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        display: block ? 'block' : 'inline-block',
        margin: block ? '6px 0' : '0 2px',
        overflowX: 'auto',
      }}
    />
  );
};
