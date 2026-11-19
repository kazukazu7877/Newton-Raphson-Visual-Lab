import { describe, it, expect } from 'vitest';
import { APPLICATION_CARDS } from '../content/applications';
import { solve } from '../engine/solver';
import { parseExpression } from '../engine/parser';

describe('Applications Content & Solver Parity', () => {
  const tryCards = APPLICATION_CARDS.filter((c) => c.kind === 'try');

  it('contains exactly 7 "try" cards and 5 "concept" cards', () => {
    const conceptCards = APPLICATION_CARDS.filter((c) => c.kind === 'concept');
    expect(tryCards.length).toBe(7);
    expect(conceptCards.length).toBe(5);
  });

  for (const card of tryCards) {
    it(`card "${card.id}" (${card.title}) parses, solves, and converges to expected root`, () => {
      expect(card.expr).toBeDefined();
      expect(card.x0).toBeDefined();

      // Ensure expression parses cleanly in the engine
      expect(() => parseExpression(card.expr!)).not.toThrow();

      const tol = card.tol ?? 1e-6;
      const maxIter = card.maxIter ?? 20;
      const res = solve(card.expr!, card.x0!, tol, maxIter);

      expect(res.status).toBe('converged');
      expect(res.converged).toBe(true);

      if (card.expectedRoot !== undefined) {
        expect(res.finalX).toBeCloseTo(card.expectedRoot, 3);
      }

      if (card.expectedIters !== undefined) {
        expect(Math.abs(res.iterations - card.expectedIters)).toBeLessThanOrEqual(1);
      }

      if (card.thumbnailWindow) {
        expect(res.finalX).toBeGreaterThanOrEqual(card.thumbnailWindow.xMin);
        expect(res.finalX).toBeLessThanOrEqual(card.thumbnailWindow.xMax);
      }
    });
  }

  it('Colebrook friction factor converts correctly to f ≈ 0.02217', () => {
    const card = APPLICATION_CARDS.find((c) => c.id === 'pipe-flow')!;
    const res = solve(card.expr!, card.x0!, card.tol ?? 1e-6, card.maxIter ?? 20);
    expect(res.converged).toBe(true);

    const x = res.finalX;
    const f = 1 / (x * x);
    expect(f).toBeCloseTo(0.02217, 4);
  });

  it('Optimisation card differentiates between minimum and maximum based on starting guess', () => {
    const card = APPLICATION_CARDS.find((c) => c.id === 'optimisation-extrema')!;
    
    // x0 = 1 -> local minimum near 1.1309
    const resMin = solve(card.expr!, 1, 1e-6, 20);
    expect(resMin.converged).toBe(true);
    expect(resMin.finalX).toBeCloseTo(1.1309, 3);
    // g''(x) = 12x^2 - 6
    const gppMin = 12 * resMin.finalX ** 2 - 6;
    expect(gppMin).toBeGreaterThan(0); // Positive second derivative => local minimum

    // x0 = 0.5 -> local maximum near 0.1699
    const resMax = solve(card.expr!, 0.5, 1e-6, 20);
    expect(resMax.converged).toBe(true);
    expect(resMax.finalX).toBeCloseTo(0.1699, 3);
    const gppMax = 12 * resMax.finalX ** 2 - 6;
    expect(gppMax).toBeLessThan(0); // Negative second derivative => local maximum
  });

  it('Kepler orbit grid: solves and converges across e in [0, 0.95] and M in [0, 2π]', () => {
    const numE = 20;
    const numM = 40;

    for (let i = 0; i < numE; i++) {
      const e = (0.95 * i) / (numE - 1);
      for (let j = 0; j < numM; j++) {
        const M = (2 * Math.PI * j) / (numM - 1);

        // Documented safe guess rule: E0 = M for e < 0.8, E0 = pi for e >= 0.8
        const E0 = e < 0.8 ? (M === 0 ? 0.1 : M) : Math.PI;
        const expr = `x - ${e}*sin(x) - ${M}`;

        const res = solve(expr, E0, 1e-12, 50);
        expect(res.converged).toBe(true);

        const E = res.finalX;
        const residual = Math.abs(E - e * Math.sin(E) - M);
        expect(residual).toBeLessThan(1e-10);

        // Planet coordinates in focus frame
        const x = Math.cos(E) - e;
        const y = Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);

        // Check ellipse equation: (x + e)^2 + y^2 / (1 - e^2) = 1 (when e < 1)
        if (e < 0.94) {
          const ellipseVal = (x + e) ** 2 + (y ** 2) / (1 - e * e);
          expect(ellipseVal).toBeCloseTo(1.0, 6);
        }

        // Check r/a = 1 - e*cos(E)
        const expectedR = 1 - e * Math.cos(E);
        const actualR = Math.hypot(x, y);
        expect(actualR).toBeCloseTo(expectedR, 6);
      }
    }
  });
});
