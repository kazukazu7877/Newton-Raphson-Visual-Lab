"""Numerical engine for the Newton-Raphson root-finding method.

CONVERGENCE CRITERION:
The algorithm declares convergence IF AND ONLY IF the residual |f(x_next)| <= tolerance.
The iterate step change |x_next - x_n| is recorded for diagnostics and table inspection,
but is NEVER used alone to declare success.

DATA FLOW:
User expression text -> parse_expression() -> SymPy expr and derivative -> lambdified callables ->
solve() / newton_raphson() -> NewtonResult with StepRecord list.
No Streamlit or Plotly imports are permitted in this module.
"""

from __future__ import annotations

import ast
import math
import re
from dataclasses import dataclass
from typing import Callable, Optional, Union

import numpy as np
import sympy as sp


# ============================================================================
# Exceptions
# ============================================================================

class NewtonError(Exception):
    """Base exception for Newton-Raphson engine errors."""
    pass


class ExpressionError(NewtonError):
    """Raised when an expression cannot be parsed or violates safety guards."""
    pass


class NumericalError(NewtonError):
    """Raised when numerical evaluation fails (e.g. domain error, division by zero)."""
    pass


# ============================================================================
# Data Classes
# ============================================================================

@dataclass(frozen=True)
class StepRecord:
    """Detailed record of a single Newton-Raphson iteration step."""
    n: int
    x_n: float
    f_xn: float
    df_xn: float
    correction: float  # f(x_n) / f'(x_n)
    x_next: float      # x_n - correction
    f_xnext: float     # f(x_next), may be NaN if evaluation failed
    abs_change: float  # |x_next - x_n|
    residual: float    # |f(x_next)|, may be NaN if evaluation failed

    def tangent_y(self, x: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        """Compute the y-value of the tangent line at x: y = f(x_n) + f'(x_n)*(x - x_n)."""
        return self.f_xn + self.df_xn * (x - self.x_n)


@dataclass
class NewtonResult:
    """Complete results of a Newton-Raphson root-finding run."""
    expression_text: str
    expr: sp.Expr
    derivative: sp.Expr
    f: Callable[[float], float]
    df: Callable[[float], float]
    x0: float
    tolerance: float
    max_iterations: int
    records: list[StepRecord]
    status: str
    message: str
    final_x: float
    final_residual: float
    failed_step: Optional[StepRecord] = None

    @property
    def converged(self) -> bool:
        """True if the method converged to a root or initial guess was already a root."""
        return self.status in ("converged", "already_root")

    @property
    def iterations(self) -> int:
        """Number of completed iteration steps recorded."""
        return len(self.records)

    @property
    def status_label(self) -> str:
        """Human-readable display label for the outcome status."""
        labels = {
            "converged": "Converged",
            "already_root": "Already at Root",
            "zero_derivative": "Zero Derivative (Flat Tangent)",
            "domain_error": "Domain Error (Left Domain)",
            "numerical_error": "Numerical Error",
            "diverged": "Diverged",
            "stalled": "Stalled (Zero Step, High Residual)",
            "max_iterations": "Maximum Iterations Reached",
        }
        return labels.get(self.status, self.status.replace("_", " ").title())

    @property
    def severity(self) -> str:
        """Severity category for status indicators: 'success', 'warning', or 'error'."""
        if self.status in ("converged", "already_root"):
            return "success"
        if self.status in ("stalled", "max_iterations"):
            return "warning"
        return "error"


# ============================================================================
# Safe Expression Parser
# ============================================================================

WHITELIST_FUNCS = {
    "sin": sp.sin,
    "cos": sp.cos,
    "tan": sp.tan,
    "exp": sp.exp,
    "log": sp.log,
    "ln": sp.log,
    "sqrt": sp.sqrt,
    "abs": sp.Abs,
    "asin": sp.asin,
    "acos": sp.acos,
    "atan": sp.atan,
    "sinh": sp.sinh,
    "cosh": sp.cosh,
    "tanh": sp.tanh,
}

_SUPERSCRIPT_MAP = str.maketrans(
    "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ",
    "0123456789+-abcdefghijklmnoprstuvwxyz"
)


def _preprocess_expression(text: str) -> str:
    """Preprocess user input: unicode normalization, power operator, and implicit multiplication."""
    s = text.strip()

    # Unicode minus signs and multiplication symbols
    s = s.replace("\u2212", "-").replace("\u2013", "-").replace("\u2014", "-")
    s = s.replace("\u00d7", "*").replace("\u22c5", "*").replace("\u00b7", "*")

    # Replace unicode superscripts (e.g. x² -> x**(2), e⁻ˣ -> e**(-x))
    def repl_sup(m: re.Match) -> str:
        content = m.group(0).translate(_SUPERSCRIPT_MAP)
        return f"**({content})"
    s = re.sub(r"[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]+", repl_sup, s)

    # Standard exponentiation
    s = s.replace("^", "**")

    # Implicit multiplication:
    # 1. Number directly before x/X, '(', or a known function / pi.
    # CRITICAL: Exclude scientific notation like 1e-3 or 2e5 by NOT treating bare 'e' generically.
    fn_pattern = r"(?:sin|cos|tan|exp|log|ln|sqrt|abs|asin|acos|atan|sinh|cosh|tanh|pi)\b"
    s = re.sub(rf"(?<=[0-9])\s*(?=[xX]|\(|{fn_pattern})", "*", s)

    # 2. Closing parenthesis before '(', x/X, or known function / pi
    s = re.sub(rf"(?<=\))\s*(?=\(|[xX]|{fn_pattern})", "*", s)

    # 3. Variable x directly before '('
    s = re.sub(r"(?<=[xX])\s*(?=\()", "*", s)

    return s


def parse_expression(text: str) -> tuple[sp.Expr, sp.Expr, sp.Symbol]:
    """Safely parse user text into a SymPy expression and its analytical derivative.

    Guards:
    - Max 200 characters
    - Max 200 AST nodes
    - Whitelist nodes only (no eval/exec/parse_expr)
    - Exponent magnitude <= 100
    - Must depend on real variable 'x'
    - Rejects zoo, nan, oo
    """
    if not text or not text.strip():
        raise ExpressionError("Please enter a function of x.")

    raw = text.strip()
    if len(raw) > 200:
        raise ExpressionError(f"Expression is too long ({len(raw)} characters). Maximum allowed is 200.")

    clean = _preprocess_expression(raw)

    try:
        tree = ast.parse(clean, mode="eval")
    except SyntaxError as e:
        raise ExpressionError(
            "Invalid expression syntax. Please check for unmatched parentheses or misplaced operators."
        ) from e

    node_count = sum(1 for _ in ast.walk(tree))
    if node_count > 200:
        raise ExpressionError("Expression is too complex (exceeds AST node limit of 200).")

    x_sym = sp.Symbol("x", real=True)

    def _convert(node: ast.AST) -> sp.Expr:
        if isinstance(node, ast.Expression):
            return _convert(node.body)

        if isinstance(node, ast.Constant):
            if isinstance(node.value, bool):
                raise ExpressionError("Boolean values (True/False) are not allowed in mathematical expressions.")
            if not isinstance(node.value, (int, float)):
                raise ExpressionError(
                    f"Unsupported constant '{node.value}' ({type(node.value).__name__}). Only numbers are allowed."
                )
            return sp.Integer(node.value) if isinstance(node.value, int) else sp.Float(node.value)

        if isinstance(node, ast.Name):
            if node.id == "x":
                return x_sym
            if node.id == "pi":
                return sp.pi
            if node.id == "e":
                return sp.E
            raise ExpressionError(
                f"Unknown name '{node.id}'. Use the variable x, constants pi and e, and functions "
                "such as sin, cos, tan, exp, log, ln, sqrt, abs, asin, acos, atan, sinh, cosh, tanh."
            )

        if isinstance(node, ast.UnaryOp):
            if isinstance(node.op, ast.UAdd):
                return +_convert(node.operand)
            if isinstance(node.op, ast.USub):
                return -_convert(node.operand)
            raise ExpressionError(f"Unsupported unary operator: {type(node.op).__name__}.")

        if isinstance(node, ast.BinOp):
            # Guard against exponent explosion like 9**9**9 or constant exponents with |n| > 100
            if isinstance(node.op, ast.Pow):
                # Inspect right operand for dangerous exponents
                def _check_exponent_bound(exp_node: ast.AST) -> None:
                    if isinstance(exp_node, ast.Constant) and isinstance(exp_node.value, (int, float)):
                        if abs(exp_node.value) > 100:
                            raise ExpressionError(
                                f"Exponent magnitude {exp_node.value} exceeds maximum allowed limit (100)."
                            )
                    elif isinstance(exp_node, ast.UnaryOp) and isinstance(exp_node.op, ast.USub):
                        if isinstance(exp_node.operand, ast.Constant) and isinstance(exp_node.operand.value, (int, float)):
                            if abs(exp_node.operand.value) > 100:
                                raise ExpressionError("Exponent magnitude exceeds maximum allowed limit (100).")
                    elif isinstance(exp_node, ast.BinOp) and isinstance(exp_node.op, ast.Pow):
                        raise ExpressionError("Nested powers in exponents are not permitted.")

                _check_exponent_bound(node.right)

                # If both left and right are constants, check evaluation size
                if isinstance(node.left, ast.Constant) and isinstance(node.right, ast.Constant):
                    if isinstance(node.left.value, (int, float)) and isinstance(node.right.value, (int, float)):
                        if abs(node.right.value) > 100:
                            raise ExpressionError("Exponent magnitude exceeds maximum allowed limit (100).")
                        try:
                            val = abs(float(node.left.value) ** float(node.right.value))
                            if val > 1e100:
                                raise ExpressionError("Constant exponentiation produces a number exceeding 1e100.")
                        except (OverflowError, ValueError) as err:
                            raise ExpressionError("Constant exponentiation overflow or error.") from err

                left_expr = _convert(node.left)
                right_expr = _convert(node.right)
                return left_expr ** right_expr

            left_expr = _convert(node.left)
            right_expr = _convert(node.right)

            if isinstance(node.op, ast.Add):
                return left_expr + right_expr
            if isinstance(node.op, ast.Sub):
                return left_expr - right_expr
            if isinstance(node.op, ast.Mult):
                return left_expr * right_expr
            if isinstance(node.op, ast.Div):
                return left_expr / right_expr

            raise ExpressionError(f"Unsupported binary operator: {type(node.op).__name__}.")

        if isinstance(node, ast.Call):
            if node.keywords:
                raise ExpressionError("Keyword arguments are not allowed in mathematical function calls.")
            if not isinstance(node.func, ast.Name):
                raise ExpressionError("Unsupported function invocation syntax.")
            func_name = node.func.id
            if len(node.args) != 1:
                raise ExpressionError(f"Function '{func_name}' expects exactly 1 argument, got {len(node.args)}.")
            if func_name not in WHITELIST_FUNCS:
                raise ExpressionError(
                    f"Unknown function '{func_name}'. Supported functions: "
                    f"{', '.join(sorted(WHITELIST_FUNCS.keys()))}."
                )
            arg = _convert(node.args[0])
            return WHITELIST_FUNCS[func_name](arg)

        # Explicitly reject all other constructs: attributes, lambdas, comprehensions, subscripts, ternary
        raise ExpressionError(f"Unsupported syntax or construct: '{type(node).__name__}' is not allowed.")

    expr = _convert(tree)

    # Validate that expression depends on x
    if x_sym not in expr.free_symbols:
        raise ExpressionError("Expression must depend on the variable 'x'.")

    # Reject non-finite values (zoo, nan, oo)
    if expr.has(sp.zoo, sp.nan, sp.oo, -sp.oo):
        raise ExpressionError("Expression contains undefined or infinite values (zoo, nan, or infinity).")

    # Analytical differentiation
    try:
        deriv = sp.diff(expr, x_sym)
    except Exception as e:
        raise ExpressionError(f"Could not compute the derivative of the expression: {e}") from e

    if deriv.has(sp.Derivative, sp.zoo, sp.nan, sp.oo, -sp.oo):
        raise ExpressionError(
            "The derivative contains undefined values or unresolved derivatives and cannot be evaluated."
        )

    return expr, deriv, x_sym


# ============================================================================
# Evaluation Helpers
# ============================================================================

def make_callables(expr: sp.Expr, deriv: sp.Expr, x_sym: sp.Symbol) -> tuple[Callable[[float], float], Callable[[float], float]]:
    """Lambdify SymPy expressions to fast NumPy/Python callables."""
    f_raw = sp.lambdify(x_sym, expr, modules=["numpy"])
    df_raw = sp.lambdify(x_sym, deriv, modules=["numpy"])
    return f_raw, df_raw


def evaluate_scalar(fn: Callable[[float], float], val: float) -> float:
    """Evaluate a callable at a single scalar value, returning a finite Python float or raising NumericalError."""
    try:
        with np.errstate(all="ignore"):
            res = fn(float(val))
    except (ZeroDivisionError, OverflowError, ValueError, TypeError, FloatingPointError) as e:
        raise NumericalError(f"Evaluation error at x = {val}: {e}") from e

    # Check for array returned from lambdify (e.g. constant expressions)
    if isinstance(res, np.ndarray):
        if res.size == 1:
            res = res.item()
        else:
            raise NumericalError(f"Unexpected array result of size {res.size} at x = {val}.")

    # Check for complex, NaN, Inf
    if isinstance(res, complex) or np.iscomplexobj(res):
        if abs(getattr(res, "imag", 0.0)) > 1e-12:
            raise NumericalError(f"Function produced a complex value at x = {val}: {res}.")
        res = float(getattr(res, "real", res))

    try:
        f_val = float(res)
    except (ValueError, TypeError) as e:
        raise NumericalError(f"Cannot convert result {res} to float at x = {val}.") from e

    if not math.isfinite(f_val):
        raise NumericalError(f"Function produced a non-finite value ({f_val}) at x = {val}.")

    return f_val


def evaluate_array(fn: Callable[[np.ndarray], np.ndarray], x_arr: np.ndarray) -> np.ndarray:
    """Evaluate a callable over a 1D NumPy array for plotting; invalid points become NaN."""
    try:
        with np.errstate(all="ignore"):
            y = fn(x_arr)
            if not isinstance(y, np.ndarray):
                y = np.full_like(x_arr, float(y), dtype=float)
            else:
                y = np.asarray(y, dtype=float)
    except Exception:
        # Fallback to element-wise evaluation
        y = np.empty_like(x_arr, dtype=float)
        for i, xv in enumerate(x_arr):
            try:
                y[i] = evaluate_scalar(fn, xv)
            except NumericalError:
                y[i] = np.nan
        return y

    # Replace complex, inf, or values exceeding 1e12 with NaN
    if np.iscomplexobj(y):
        mask_complex = np.abs(np.imag(y)) > 1e-12
        y = np.real(y)
        y[mask_complex] = np.nan

    y[~np.isfinite(y)] = np.nan
    y[np.abs(y) > 1e12] = np.nan
    return y


def tangent_x_intercept(x_n: float, f_val: float, df_val: float) -> float:
    """Compute the x-intercept of the tangent line at (x_n, f_val): x_intercept = x_n - f_val / df_val."""
    if df_val == 0.0 or not math.isfinite(df_val):
        return float("nan")
    return x_n - (f_val / df_val)


# ============================================================================
# Newton-Raphson Algorithm
# ============================================================================

def newton_raphson(
    expr: sp.Expr,
    derivative: sp.Expr,
    f: Callable[[float], float],
    df: Callable[[float], float],
    x0: float,
    tol: float = 1e-6,
    max_iter: int = 20,
    expression_text: str = "",
) -> NewtonResult:
    """Execute the Newton-Raphson numerical algorithm.

    All convergence checks are strictly residual-based: |f(x_next)| <= tol.
    """
    # 0. Input validation
    if not math.isfinite(x0):
        raise ExpressionError("Initial guess x0 must be a finite number.")
    if not (math.isfinite(tol) and tol > 0):
        raise ExpressionError("Tolerance must be a positive finite number.")
    if max_iter < 1:
        raise ExpressionError("Maximum iterations must be an integer >= 1.")

    # 1. Evaluate at initial guess x0
    try:
        f0 = evaluate_scalar(f, x0)
    except NumericalError as e:
        return NewtonResult(
            expression_text=expression_text,
            expr=expr,
            derivative=derivative,
            f=f,
            df=df,
            x0=x0,
            tolerance=tol,
            max_iterations=max_iter,
            records=[],
            status="domain_error",
            message=f"Initial guess x0 = {x0:g} cannot be evaluated (domain error): {e}",
            final_x=x0,
            final_residual=float("nan"),
            failed_step=None,
        )

    # 2. Check if x0 is already a root
    if abs(f0) <= tol:
        return NewtonResult(
            expression_text=expression_text,
            expr=expr,
            derivative=derivative,
            f=f,
            df=df,
            x0=x0,
            tolerance=tol,
            max_iterations=max_iter,
            records=[],
            status="already_root",
            message=f"Initial guess x0 = {x0:g} is already a root within tolerance (|f(x0)| = {abs(f0):.2e} <= {tol:.2e}).",
            final_x=x0,
            final_residual=abs(f0),
            failed_step=None,
        )

    records: list[StepRecord] = []
    x_curr = float(x0)
    status = "max_iterations"
    message = ""
    failed_step: Optional[StepRecord] = None

    # 3. Iteration loop
    for n in range(max_iter):
        # Evaluate f and df at x_curr
        try:
            f_curr = evaluate_scalar(f, x_curr)
            df_curr = evaluate_scalar(df, x_curr)
        except NumericalError as e:
            status = "numerical_error"
            message = f"Numerical evaluation failed at step {n} (x_{n} = {x_curr:g}): {e}"
            break

        # Check for zero or near-zero derivative
        if abs(df_curr) < 1e-12:
            status = "zero_derivative"
            message = (
                f"Derivative is nearly zero (|f'({x_curr:g})| = {abs(df_curr):.2e} < 1e-12) at step {n}. "
                "The tangent line is horizontal and cannot intersect the x-axis."
            )
            break

        correction = f_curr / df_curr
        x_next = x_curr - correction

        if not math.isfinite(x_next):
            status = "numerical_error"
            message = f"Next iterate x_{n+1} became non-finite ({x_next}) at step {n}."
            break

        # Evaluate f at x_next
        try:
            f_next = evaluate_scalar(f, x_next)
        except NumericalError as e:
            # Domain error on next iterate
            failed_step = StepRecord(
                n=n,
                x_n=x_curr,
                f_xn=f_curr,
                df_xn=df_curr,
                correction=correction,
                x_next=x_next,
                f_xnext=float("nan"),
                abs_change=abs(x_next - x_curr),
                residual=float("nan"),
            )
            status = "domain_error"
            message = (
                f"Next iterate x_{n+1} = {x_next:g} stepped outside the function domain at step {n} "
                f"(f(x_{n+1}) is undefined): {e}"
            )
            return NewtonResult(
                expression_text=expression_text,
                expr=expr,
                derivative=derivative,
                f=f,
                df=df,
                x0=x0,
                tolerance=tol,
                max_iterations=max_iter,
                records=records,
                status=status,
                message=message,
                final_x=x_next,
                final_residual=float("nan"),
                failed_step=failed_step,
            )

        abs_change = abs(x_next - x_curr)
        residual = abs(f_next)

        rec = StepRecord(
            n=n,
            x_n=x_curr,
            f_xn=f_curr,
            df_xn=df_curr,
            correction=correction,
            x_next=x_next,
            f_xnext=f_next,
            abs_change=abs_change,
            residual=residual,
        )
        records.append(rec)

        # CONVERGENCE TEST (residual-based ONLY)
        if residual <= tol:
            status = "converged"
            message = (
                f"Converged to root x = {x_next:.10g} in {n + 1} iteration{'s' if n > 0 else ''} "
                f"(|f(x_{n+1})| = {residual:.2e} <= tol {tol:.2e})."
            )
            break

        # Extra stop rule: Divergence
        if abs(x_next) > 1e12:
            status = "diverged"
            message = f"Iterate diverged at step {n}: |x_{n+1}| = {abs(x_next):.2e} exceeded 1e12."
            break

        # Extra stop rule: Stalled
        if abs_change == 0.0 and residual > tol:
            status = "stalled"
            message = (
                f"The iteration stalled at step {n} (no change in x: |x_{n+1} - x_{n}| = 0) "
                f"while residual |f(x_{n+1})| = {residual:.2e} remains greater than tolerance {tol:.2e}. "
                "This is NOT convergence."
            )
            break

        x_curr = x_next
    else:
        # Loop finished without breaking
        status = "max_iterations"
        last_res = records[-1].residual if records else abs(f0)
        message = (
            f"Maximum iterations ({max_iter}) reached without satisfying tolerance "
            f"(final residual |f(x)| = {last_res:.2e} > tol {tol:.2e})."
        )

    # Determine final_x and final_residual
    if records:
        final_x = records[-1].x_next
        final_residual = records[-1].residual
    else:
        final_x = x0
        final_residual = abs(f0)

    return NewtonResult(
        expression_text=expression_text,
        expr=expr,
        derivative=derivative,
        f=f,
        df=df,
        x0=x0,
        tolerance=tol,
        max_iterations=max_iter,
        records=records,
        status=status,
        message=message,
        final_x=final_x,
        final_residual=final_residual,
        failed_step=failed_step,
    )


def solve(text: str, x0: float, tol: float = 1e-6, max_iter: int = 20) -> NewtonResult:
    """Complete wrapper: parses input text, builds derivatives and callables, and solves."""
    expr, deriv, x_sym = parse_expression(text)
    f, df = make_callables(expr, deriv, x_sym)
    return newton_raphson(
        expr=expr,
        derivative=deriv,
        f=f,
        df=df,
        x0=x0,
        tol=tol,
        max_iter=max_iter,
        expression_text=text.strip(),
    )

