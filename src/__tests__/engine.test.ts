import { describe, it, expect } from 'vitest';
import { solve, tangentXIntercept, tangentY } from '../engine/solver';
import { parseExpression, ExpressionError, buildEvaluator, differentiate, simplify } from '../engine/parser';
import goldenData from '../../fixtures/golden.json';

describe('Newton-Raphson Engine Parity Tests (Golden Fixtures)', () => {
  for (const fixture of goldenData.fixtures) {
    it(`matches Python engine for ${fixture.name} (${fixture.expression})`, () => {
      let result;
      try {
        result = solve(fixture.expression, fixture.x0, fixture.tolerance, fixture.max_iterations);
      } catch (err) {
        if (fixture.status === 'domain_error' || fixture.status === 'zero_derivative') {
          // Expected failure status or handled
          return;
        }
        throw err;
      }

      expect(result.status).toBe(fixture.status);
      expect(result.converged).toBe(fixture.converged);

      if (fixture.converged) {
        expect(result.finalX).toBeCloseTo(fixture.final_x, 6);
        if (fixture.final_residual !== null) {
          expect(result.finalResidual).toBeLessThanOrEqual(fixture.tolerance);
        }
      }

      expect(result.records.length).toBe(fixture.iteration_count);

      // Verify each step record
      for (let i = 0; i < fixture.records.length; i++) {
        const expectedRec = fixture.records[i]!;
        const actualRec = result.records[i]!;

        expect(actualRec.n).toBe(expectedRec.n);
        expect(actualRec.x_n).toBeCloseTo(expectedRec.x_n, 8);
        expect(actualRec.f_xn).toBeCloseTo(expectedRec.f_xn, 8);
        expect(actualRec.df_xn).toBeCloseTo(expectedRec.df_xn, 8);
        expect(actualRec.correction).toBeCloseTo(expectedRec.correction, 8);
        expect(actualRec.x_next).toBeCloseTo(expectedRec.x_next, 8);
        expect(actualRec.abs_change).toBeCloseTo(expectedRec.abs_change, 8);

        if (expectedRec.residual !== null) {
          expect(actualRec.residual).toBeCloseTo(expectedRec.residual, 8);
        }
      }

      if (fixture.failed_step) {
        expect(result.failedStep).not.toBeNull();
        expect(result.failedStep!.n).toBe(fixture.failed_step.n);
        expect(result.failedStep!.x_n).toBeCloseTo(fixture.failed_step.x_n, 8);
        expect(result.failedStep!.x_next).toBeCloseTo(fixture.failed_step.x_next, 8);
      }
    });
  }
});

describe('Parser Security & Whitelist Tests', () => {
  for (const testCase of goldenData.parser_tests.valid_expressions) {
    it(`successfully parses valid expression: ${testCase.input} (${testCase.description})`, () => {
      expect(() => parseExpression(testCase.input)).not.toThrow();
    });
  }

  for (const testCase of goldenData.parser_tests.invalid_expressions) {
    it(`rejects invalid expression: ${testCase.input} (${testCase.description})`, () => {
      expect(() => parseExpression(testCase.input)).toThrow(ExpressionError);
    });
  }

  it('rejects expressions longer than 200 characters', () => {
    const longExpr = 'x + ' + '1 + '.repeat(70) + 'x';
    expect(() => parseExpression(longExpr)).toThrow(ExpressionError);
  });

  it('rejects dynamic code execution vectors', () => {
    expect(() => parseExpression('__proto__')).toThrow(ExpressionError);
    expect(() => parseExpression('constructor')).toThrow(ExpressionError);
    expect(() => parseExpression('window.alert(1)')).toThrow(ExpressionError);
    expect(() => parseExpression('eval("1+1")')).toThrow(ExpressionError);
    expect(() => parseExpression('Function("return 1")()')).toThrow(ExpressionError);
  });

  it('rejects exponent explosion and constants exceeding 100 in power', () => {
    expect(() => parseExpression('x^101')).toThrow(ExpressionError);
    expect(() => parseExpression('x^(-105)')).toThrow(ExpressionError);
    expect(() => parseExpression('x^(2^3)')).toThrow(ExpressionError);
  });
});

describe('Differentiator Accuracy Tests', () => {
  it('differentiates polynomials correctly: d/dx(x^3 - 2x - 5) = 3x^2 - 2', () => {
    const ast = parseExpression('x^3 - 2*x - 5');
    const dAst = simplify(differentiate(ast));
    const df = buildEvaluator(dAst);

    // At x = 2: 3*(4) - 2 = 10
    expect(df(2)).toBeCloseTo(10, 8);
    // At x = 0: -2
    expect(df(0)).toBeCloseTo(-2, 8);
  });

  it('differentiates trig functions correctly: d/dx(cos(x) - x) = -sin(x) - 1', () => {
    const ast = parseExpression('cos(x) - x');
    const dAst = simplify(differentiate(ast));
    const df = buildEvaluator(dAst);

    expect(df(0)).toBeCloseTo(-1, 8);
    expect(df(Math.PI / 2)).toBeCloseTo(-2, 8);
  });

  it('differentiates exponential correctly: d/dx(exp(-x) - x) = -exp(-x) - 1', () => {
    const ast = parseExpression('exp(-x) - x');
    const dAst = simplify(differentiate(ast));
    const df = buildEvaluator(dAst);

    expect(df(0)).toBeCloseTo(-2, 8);
  });
});

describe('Geometric Tangent Helpers', () => {
  it('tangent evaluates to 0 at x_next', () => {
    const res = solve('x^3 - 2*x - 5', 2.0);
    for (const rec of res.records) {
      const yAtNext = tangentY(rec, rec.x_next);
      expect(yAtNext).toBeCloseTo(0, 10);
    }
  });

  it('computes tangentXIntercept properly', () => {
    const xInt = tangentXIntercept(2.0, -1.0, 10.0);
    expect(xInt).toBeCloseTo(2.1, 10);
  });
});
