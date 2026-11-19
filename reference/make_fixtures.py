"""Generate golden test fixtures from the Python engine using SymPy.

Output: fixtures/golden.json
Used by TypeScript parity tests to verify the engine port.
"""

import json
import math
import sys
import os

# Add reference and parent directories to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from newton_raphson import solve, parse_expression
import sympy as sp


def make_fixture(name, expr_text, x0, tol=1e-6, max_iter=20):
    """Generate a single test fixture from the Python engine."""
    res = solve(expr_text, x0, tol=tol, max_iter=max_iter)

    # Get symbolic derivative
    expr, deriv, x_sym = parse_expression(expr_text)

    records = []
    for r in res.records:
        records.append({
            "n": r.n,
            "x_n": r.x_n,
            "f_xn": r.f_xn,
            "df_xn": r.df_xn,
            "correction": r.correction,
            "x_next": r.x_next,
            "f_xnext": r.f_xnext if math.isfinite(r.f_xnext) else None,
            "abs_change": r.abs_change,
            "residual": r.residual if math.isfinite(r.residual) else None,
        })

    failed = None
    if res.failed_step is not None:
        fs = res.failed_step
        failed = {
            "n": fs.n,
            "x_n": fs.x_n,
            "f_xn": fs.f_xn,
            "df_xn": fs.df_xn,
            "correction": fs.correction,
            "x_next": fs.x_next,
            "abs_change": fs.abs_change,
        }

    return {
        "name": name,
        "expression": expr_text,
        "derivative_latex": sp.latex(deriv),
        "x0": x0,
        "tolerance": tol,
        "max_iterations": max_iter,
        "status": res.status,
        "converged": res.converged,
        "final_x": res.final_x,
        "final_residual": res.final_residual if math.isfinite(res.final_residual) else None,
        "iteration_count": len(res.records),
        "records": records,
        "failed_step": failed,
    }


def main():
    fixtures = []

    # 1. Standard benchmark
    fixtures.append(make_fixture(
        "standard_benchmark",
        "x**3 - 2*x - 5", 2.0, tol=1e-6, max_iter=20
    ))

    # 2. Square root of 2
    fixtures.append(make_fixture(
        "sqrt2",
        "x**2 - 2", 1.0, tol=1e-6, max_iter=20
    ))

    # 3. Plastic constant
    fixtures.append(make_fixture(
        "plastic_constant",
        "x**3 - x - 1", 1.5, tol=1e-6, max_iter=20
    ))

    # 4. Dottie number
    fixtures.append(make_fixture(
        "dottie_number",
        "cos(x) - x", 1.0, tol=1e-6, max_iter=20
    ))

    # 5. Omega constant
    fixtures.append(make_fixture(
        "omega_constant",
        "exp(-x) - x", 0.5, tol=1e-6, max_iter=20
    ))

    # 6. Already at root
    fixtures.append(make_fixture(
        "already_root",
        "x**2 - 4", 2.0, tol=1e-6, max_iter=20
    ))

    # 7. Zero derivative failure
    fixtures.append(make_fixture(
        "zero_derivative",
        "x**2 - 2", 0.0, tol=1e-6, max_iter=20
    ))

    # 8. Cycling (max iterations)
    fixtures.append(make_fixture(
        "cycling_max_iter",
        "x**3 - 2*x + 2", 0.0, tol=1e-6, max_iter=15
    ))

    # 9. Domain error (log leaves domain)
    fixtures.append(make_fixture(
        "domain_error_log",
        "log(x)", 3.0, tol=1e-6, max_iter=20
    ))

    # 10. Tight tolerance (stalls)
    fixtures.append(make_fixture(
        "tight_tolerance_stall",
        "x**2 - 2", 1.0, tol=1e-300, max_iter=50
    ))

    # 11. Single iteration
    fixtures.append(make_fixture(
        "single_iteration",
        "x**3 - 2*x - 5", 2.0, tol=1e-12, max_iter=1
    ))

    # 12. Implicit multiplication
    fixtures.append(make_fixture(
        "implicit_mult",
        "2x^2 - 8", 3.0, tol=1e-8, max_iter=20
    ))

    # 13. Unicode superscript
    fixtures.append(make_fixture(
        "unicode_superscript",
        "x\u00b2 \u2212 2", 1.0, tol=1e-8, max_iter=20
    ))

    # 14. Applications: Colebrook pipe friction factor
    fixtures.append(make_fixture(
        "app_colebrook",
        "x + 2*log(0.001/3.7 + 2.51*x/100000)/log(10)", 7.0, tol=1e-6, max_iter=20
    ))

    # 15. Applications: Internal rate of return (finance)
    fixtures.append(make_fixture(
        "app_irr",
        "-1000 + 300/(1+x) + 400/(1+x)**2 + 500/(1+x)**3", 0.1, tol=1e-6, max_iter=20
    ))

    # 16. Applications: Square root computation
    fixtures.append(make_fixture(
        "app_sqrt",
        "x**2 - 10", 3.0, tol=1e-6, max_iter=20
    ))

    # 17. Applications: Reciprocal computation without division
    fixtures.append(make_fixture(
        "app_reciprocal",
        "1/x - 3", 0.3, tol=1e-6, max_iter=20
    ))

    # 18. Applications: Fast inverse square root
    fixtures.append(make_fixture(
        "app_fast_rsqrt",
        "1/x**2 - 5", 0.4, tol=1e-6, max_iter=20
    ))

    # 19. Applications: van der Waals gas volume
    fixtures.append(make_fixture(
        "app_vdw",
        "(10 + 3.640/x**2)*(x - 0.04267) - 0.08314*300", 2.4942, tol=1e-6, max_iter=20
    ))

    # 20. Applications: van der Waals variant
    fixtures.append(make_fixture(
        "app_vdw_variant",
        "(15 + 3.640/x**2)*(x - 0.04267) - 0.08314*350", 1.8, tol=1e-6, max_iter=20
    ))

    # 21. Applications: Optimisation local minimum
    fixtures.append(make_fixture(
        "app_opt_min",
        "4*x**3 - 6*x + 1", 1.0, tol=1e-6, max_iter=20
    ))

    # 22. Applications: Optimisation local maximum
    fixtures.append(make_fixture(
        "app_opt_max",
        "4*x**3 - 6*x + 1", 0.5, tol=1e-6, max_iter=20
    ))

    # 23. Applications: Kepler celestial orbit demo
    fixtures.append(make_fixture(
        "app_kepler_std",
        "x - 0.5*sin(x) - 1.0", 1.0, tol=1e-12, max_iter=50
    ))

    # 24. Applications: Kepler high eccentricity
    fixtures.append(make_fixture(
        "app_kepler_high_e",
        "x - 0.8*sin(x) - 2.0", math.pi, tol=1e-12, max_iter=50
    ))

    # Also generate parser test cases
    parser_tests = {
        "valid_expressions": [
            {"input": "x**3 - 2*x - 5", "description": "standard polynomial"},
            {"input": "sin(x)", "description": "basic trig"},
            {"input": "cos(x) - x", "description": "trig with subtraction"},
            {"input": "exp(-x) - x", "description": "exponential"},
            {"input": "log(x)", "description": "natural log"},
            {"input": "sqrt(x) - 1", "description": "square root"},
            {"input": "x^2 - 4", "description": "caret power"},
            {"input": "2x^2 - 8", "description": "implicit multiplication"},
            {"input": "2(x - 2)", "description": "implicit mult with parens"},
            {"input": "abs(x) - 1", "description": "absolute value"},
            {"input": "sinh(x) - 1", "description": "hyperbolic sine"},
            {"input": "asin(x)", "description": "inverse trig"},
            {"input": "pi*x - 3", "description": "pi constant"},
            {"input": "e*x - 2", "description": "euler constant"},
        ],
        "invalid_expressions": [
            {"input": "", "description": "empty string"},
            {"input": "   ", "description": "whitespace only"},
            {"input": "5", "description": "constant (no x)"},
            {"input": "x +", "description": "incomplete syntax"},
            {"input": "__import__('os').system('echo hi')", "description": "import injection"},
            {"input": "open('f')", "description": "file open"},
            {"input": "x.__class__", "description": "attribute access"},
            {"input": "lambda: 1", "description": "lambda"},
            {"input": "[x for x in range(5)]", "description": "list comprehension"},
            {"input": "1 if x > 0 else 0", "description": "ternary"},
            {"input": "exec('1')", "description": "exec call"},
            {"input": "eval('1')", "description": "eval call"},
            {"input": "9**9**9", "description": "nested exponents"},
            {"input": "x**105 - 1", "description": "exponent > 100"},
            {"input": "'hello' + x", "description": "string literal"},
            {"input": "True + x", "description": "boolean literal"},
            {"input": "x + y", "description": "unknown variable y"},
            {"input": "sin(x, 2)", "description": "multi-arg function"},
        ],
    }

    output = {
        "generated_by": "make_fixtures.py (Python engine with SymPy)",
        "engine_thresholds": {
            "zero_derivative_threshold": 1e-12,
            "divergence_limit": 1e12,
            "convergence_criterion": "residual_only: |f(x_next)| <= tolerance",
        },
        "fixtures": fixtures,
        "parser_tests": parser_tests,
    }

    # Write to fixtures/golden.json
    fixtures_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures")
    os.makedirs(fixtures_dir, exist_ok=True)
    output_path = os.path.join(fixtures_dir, "golden.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(fixtures)} fixtures to {output_path}")
    print(f"Generated {len(parser_tests['valid_expressions'])} valid + {len(parser_tests['invalid_expressions'])} invalid parser tests")
    size_kb = os.path.getsize(output_path) / 1024
    print(f"File size: {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
