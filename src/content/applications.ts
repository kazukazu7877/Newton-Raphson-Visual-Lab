/**
 * Practical applications data for the Newton-Raphson Visual Lab.
 *
 * All applications are factual, mathematically verified, and use
 * the exact syntax required by the TypeScript solver engine.
 */

export interface ApplicationCardData {
  readonly id: string;
  readonly domain: string;
  readonly title: string;
  readonly problem: string;
  readonly latex: string;
  readonly rationale: string;
  readonly kind: 'try' | 'concept';
  readonly expr?: string;
  readonly x0?: number;
  readonly altX0?: number;
  readonly altX0Label?: string;
  readonly tol?: number;
  readonly maxIter?: number;
  readonly expectedRoot?: number;
  readonly expectedIters?: number;
  readonly note?: string;
  readonly thumbnailWindow?: {
    readonly xMin: number;
    readonly xMax: number;
    readonly yMin: number;
    readonly yMax: number;
  };
}

export const APPLICATION_CARDS: readonly ApplicationCardData[] = [
  // --------------------------------------------------------------------------
  // Try in the Lab (Single-variable real-world systems)
  // --------------------------------------------------------------------------
  {
    id: 'pipe-flow',
    domain: 'Pipe flow',
    title: 'Colebrook friction factor',
    problem: 'The friction factor f in turbulent pipe flow is defined implicitly by the Colebrook equation.',
    latex: '\\frac{1}{\\sqrt{f}} = -2 \\log_{10} \\left( \\frac{\\varepsilon/D}{3.7} + \\frac{2.51}{\\mathrm{Re} \\sqrt{f}} \\right)',
    rationale: 'Substituting x = 1/\\sqrt{f} turns the relation into a single equation that Newton–Raphson resolves in very few iterations.',
    kind: 'try',
    expr: 'x + 2*log(0.001/3.7 + 2.51*x/100000)/log(10)',
    x0: 7,
    tol: 1e-6,
    maxIter: 20,
    expectedRoot: 6.7154,
    expectedIters: 2,
    note: 'Illustrative values for relative roughness ε/D = 0.001 and Reynolds number Re = 100,000 (yielding f ≈ 0.0222).',
    thumbnailWindow: { xMin: 5, xMax: 8, yMin: -2, yMax: 2 },
  },
  {
    id: 'finance-irr',
    domain: 'Finance',
    title: 'Internal rate of return',
    problem: 'The discount rate r that makes the net present value of scheduled cash flows equal to zero.',
    latex: '\\mathrm{NPV}(r) = -C_0 + \\sum_{t=1}^T \\frac{C_t}{(1+r)^t} = 0',
    rationale: 'Because polynomial degrees match project lifespans, numerical root finding is the standard way financial software computes yield.',
    kind: 'try',
    expr: '-1000 + 300/(1+x) + 400/(1+x)**2 + 500/(1+x)**3',
    x0: 0.1,
    tol: 1e-6,
    maxIter: 20,
    expectedRoot: 0.08896,
    expectedIters: 3,
    note: 'Initial cash outlay of 1,000 followed by cash returns of 300, 400, and 500 over three periods.',
    thumbnailWindow: { xMin: 0, xMax: 0.25, yMin: -150, yMax: 200 },
  },
  {
    id: 'computing-sqrt',
    domain: 'Computing',
    title: 'Square root computation',
    problem: 'Evaluating √a by finding the positive zero of f(x) = x² − a.',
    latex: 'x_{n+1} = \\frac{1}{2}\\left(x_n + \\frac{a}{x_n}\\right)',
    rationale: 'Newton’s method reduces to simple addition and division—the classic Babylonian averaging rule used in numerical math libraries.',
    kind: 'try',
    expr: 'x**2 - 10',
    x0: 3,
    tol: 1e-6,
    maxIter: 20,
    expectedRoot: 3.16227766,
    expectedIters: 3,
    note: 'Computing √10 starting from integer guess x₀ = 3.',
    thumbnailWindow: { xMin: 1, xMax: 5, yMin: -10, yMax: 15 },
  },
  {
    id: 'computing-reciprocal',
    domain: 'Computing',
    title: 'Division without dividing',
    problem: 'Evaluating 1/a without hardware division by finding the zero of f(x) = 1/x − a.',
    latex: 'x_{n+1} = x_n (2 - a x_n)',
    rationale: 'The iteration needs only multiplication and subtraction, which is why this style of iteration is used to compute reciprocals in hardware.',
    kind: 'try',
    expr: '1/x - 3',
    x0: 0.3,
    tol: 1e-6,
    maxIter: 20,
    expectedRoot: 0.33333333,
    expectedIters: 4,
    note: 'Evaluating 1/3 without performing floating-point division.',
    thumbnailWindow: { xMin: 0.15, xMax: 0.6, yMin: -2, yMax: 4 },
  },
  {
    id: 'graphics-rsqrt',
    domain: 'Computer graphics',
    title: 'Fast inverse square root',
    problem: 'Computing 1/√a for vector normalisation in real-time 3D simulation.',
    latex: 'y_{n+1} = y_n \\left(1.5 - 0.5 a y_n^2\\right)',
    rationale: 'One Newton step refines a rough first guess, famously used in real-time 3D rendering to bypass slow square root instructions.',
    kind: 'try',
    expr: '1/x**2 - 5',
    x0: 0.4,
    tol: 1e-6,
    maxIter: 20,
    expectedRoot: 0.4472136,
    expectedIters: 4,
    note: 'Refining 1/√5 starting from guess x₀ = 0.4.',
    thumbnailWindow: { xMin: 0.25, xMax: 0.75, yMin: -4, yMax: 8 },
  },
  {
    id: 'thermo-vdw',
    domain: 'Thermodynamics',
    title: 'van der Waals gas volume',
    problem: 'Real gases deviate from the ideal gas law at high pressures due to molecular attraction and volume.',
    latex: '\\left(P + \\frac{a}{V^2}\\right)(V - b) = R T',
    rationale: 'Solving the cubic relation for molar volume V is standard, with the ideal-gas volume RT/P serving as the natural starting guess.',
    kind: 'try',
    expr: '(10 + 3.640/x**2)*(x - 0.04267) - 0.08314*300',
    x0: 2.4942,
    tol: 1e-6,
    maxIter: 20,
    expectedRoot: 2.3871,
    expectedIters: 3,
    note: 'Illustrative carbon dioxide parameters (litres, bar, kelvin: P = 10 bar, T = 300 K, a = 3.640, b = 0.04267, R = 0.08314).',
    thumbnailWindow: { xMin: 1.5, xMax: 3.5, yMin: -10, yMax: 15 },
  },
  {
    id: 'optimisation-extrema',
    domain: 'Optimisation',
    title: 'Stationary point discovery',
    problem: 'Minimising an objective g(x) by locating points where its derivative g′(x) equals zero.',
    latex: 'x_{n+1} = x_n - \\frac{g\'(x_n)}{g\'\'(x_n)}',
    rationale: 'Applying Newton’s method to the derivative locates stationary points; starting near convex regions finds a minimum.',
    kind: 'try',
    expr: '4*x**3 - 6*x + 1',
    x0: 1,
    altX0: 0.5,
    altX0Label: 'Try x₀ = 0.5',
    tol: 1e-6,
    maxIter: 20,
    expectedRoot: 1.1309,
    expectedIters: 3,
    note: 'Derivative of g(x) = x⁴ − 3x² + x. Starting from x₀ = 1 finds the local minimum near 1.1309; from x₀ = 0.5 it finds 0.1699 (a local maximum) because Newton’s method locates stationary points, not specifically minima.',
    thumbnailWindow: { xMin: -0.5, xMax: 1.8, yMin: -4, yMax: 6 },
  },

  // --------------------------------------------------------------------------
  // Concept Cards (Multi-variable systems)
  // --------------------------------------------------------------------------
  {
    id: 'power-systems',
    domain: 'Power systems',
    title: 'Load-flow studies',
    problem: 'The voltage magnitudes and phase angles across an electrical grid satisfy large networks of nonlinear power-balance equations.',
    latex: '\\mathbf{f}(\\mathbf{V}, \\boldsymbol{\\theta}) = \\mathbf{P}_{\\mathrm{calc}} - \\mathbf{P}_{\\mathrm{spec}} = \\mathbf{0}',
    rationale: 'Industrial grid simulators use Newton-based solvers with sparse Jacobian matrices as the standard approach to solve thousands of buses.',
    kind: 'concept',
  },
  {
    id: 'robotics-ik',
    domain: 'Robotics',
    title: 'Inverse kinematics',
    problem: 'Finding the joint angles that position a robotic manipulator or end-effector at a desired spatial coordinate.',
    latex: '\\mathbf{x}_{\\mathrm{target}} - \\mathbf{K}(\\boldsymbol{\\theta}) = \\mathbf{0}',
    rationale: 'Nonlinear forward kinematics equations are solved iteratively at runtime using the manipulator Jacobian matrix.',
    kind: 'concept',
  },
  {
    id: 'positioning-gps',
    domain: 'Positioning',
    title: 'GPS receiver trilateration',
    problem: 'A navigation receiver determines its three-dimensional position and clock offset from satellite arrival times.',
    latex: '\\rho_i = \\sqrt{(x - x_i)^2 + (y - y_i)^2 + (z - z_i)^2} + c \\Delta t',
    rationale: 'Receivers repeatedly linearise the pseudorange distance equations using a Gauss–Newton iteration, the multi-variable equivalent of the tangent step.',
    kind: 'concept',
  },
  {
    id: 'ml-logistic',
    domain: 'Machine learning',
    title: 'Logistic regression',
    problem: 'Fitting classification models by finding parameter weights that maximize log-likelihood on training data.',
    latex: '\\mathbf{w}_{n+1} = \\mathbf{w}_n - \\mathbf{H}^{-1} \\nabla \\ell(\\mathbf{w}_n)',
    rationale: 'Second-order Newton updates form iteratively reweighted least squares (IRLS), which converges in fewer iterations than gradient descent.',
    kind: 'concept',
  },
  {
    id: 'structural-fea',
    domain: 'Structural engineering',
    title: 'Nonlinear finite elements',
    problem: 'Determining the internal equilibrium of structures subjected to large deformations, material plasticity, or contact.',
    latex: '\\mathbf{K}_{\\mathrm{tan}}(\\mathbf{u}) \\, \\Delta \\mathbf{u} = \\mathbf{F}_{\\mathrm{ext}} - \\mathbf{F}_{\\mathrm{int}}(\\mathbf{u})',
    rationale: 'Equilibrium equations under load are nonlinear, and incremental Newton iterations are the standard way to solve each load step.',
    kind: 'concept',
  },
] as const;
