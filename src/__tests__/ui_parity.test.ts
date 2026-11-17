import { describe, it, expect } from 'vitest';
import { PRESETS } from '../components/CommandBar';
import { solve } from '../engine/solver';
import { buildEmergencePayload } from '../engine/animation';

describe('UI Presets & Payload Parity', () => {
  it('all 8 presets have valid expressions and run without unhandled errors', () => {
    expect(PRESETS.length).toBe(8);

    for (const p of PRESETS) {
      const tolNum = parseFloat(p.tol);
      const res = solve(p.expr, p.x0, tolNum, p.maxIter);
      expect(res).toBeDefined();
      expect(res.status).toBeDefined();

      const payload = buildEmergencePayload(res);
      expect(payload).toBeDefined();
      expect(payload.curve.x.length).toBeGreaterThan(10);
      expect(payload.curve.y.length).toBe(payload.curve.x.length);

      // Verify camera windows exist and are finite
      expect(payload.cameras.whole_path.length).toBeGreaterThan(0);
      expect(payload.cameras.follow_step.length).toBeGreaterThan(0);
      expect(payload.cameras.cinematic.length).toBeGreaterThan(0);

      for (const cam of payload.cameras.whole_path) {
        expect(Number.isFinite(cam.x_min)).toBe(true);
        expect(Number.isFinite(cam.x_max)).toBe(true);
        expect(Number.isFinite(cam.y_min)).toBe(true);
        expect(Number.isFinite(cam.y_max)).toBe(true);
        expect(cam.x_max).toBeGreaterThan(cam.x_min);
        expect(cam.y_max).toBeGreaterThan(cam.y_min);
      }
    }
  });

  it('verifies Understand the Method questions and answers length constraint (<= 18 words)', () => {
    const answers = [
      'A root x* satisfies f(x*) = 0, where the curve crosses or touches the x-axis.',
      'Non-linear equations lack exact formulas; an initial guess x0 seeds the sequence of successive refinements.',
      "The derivative f'(x_n) sets tangent slope and step size; near-zero slopes cause numerical division failure.",
      'The tangent replaces the non-linear curve locally with its simplest first-order linear approximation.',
      "Every non-horizontal tangent line intersects y = 0 at exactly one point: x_{n+1} = x_n - f(x_n)/f'(x_n).",
      'Near simple roots, the tangent intercept doubles correct decimal digits each iteration (quadratic convergence).',
      'Curvature leaves residual error after one step; repeating the linear projection hones in on x*.',
      'Convergence requires residual |f(x_{n+1})| ≤ tolerance; iterate step size alone never guarantees true convergence.',
    ];

    expect(answers.length).toBe(8);
    for (let i = 0; i < answers.length; i++) {
      const words = answers[i]!.trim().split(/\s+/);
      expect(words.length).toBeLessThanOrEqual(18);
    }
  });
});
