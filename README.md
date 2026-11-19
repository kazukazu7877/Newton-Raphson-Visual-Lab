# Newton–Raphson Visual Lab

> See how mathematics finds the root.

An interactive computational simulator and motion visualizer demonstrating the Newton–Raphson root-finding algorithm. The application pairs an analytical engine with high-framerate 2D Canvas choreography to illustrate the mechanics of iterative convergence and numerical edge cases.

Live deployment: https://newton-raphson-visual-lab.vercel.app

---

## Overview

The simulator translates user mathematical expressions into an abstract syntax tree (AST), computes exact symbolic derivatives via rule-based differentiation, and executes the Newton–Raphson iterative scheme:

$$x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}$$

All mathematical calculations run strictly in client-side TypeScript. The visual stage animates the curve emergence, per-step plumb line projections, tangent rotations, axis intercepts, and final root bloom without server round-trips.

---

## Features

- **Emergence Canvas Stage**: 60 FPS hardware-accelerated HTML5 Canvas with HiDPI scaling, smooth camera tracking (`Cinematic`, `Follow step`, `Whole path`), and particle/star bloom on convergence.
- **Strict Numerical Honesty**: Convergence is declared if and only if the residual satisfies $|f(x_{n+1})| \le \text{tolerance}$. Iterate step size is recorded for diagnostics but never substituted for residual tests.
- **Analytical AST Engine**: Custom Pratt precedence-climbing parser supporting standard operators, parentheses, implicit multiplication, unicode superscripts, and functions (`sin`, `cos`, `tan`, `exp`, `log`, `ln`, `sqrt`, `abs`, `asin`, `acos`, `atan`, `sinh`, `cosh`, `tanh`, `pi`, `e`).
- **Comprehensive Failure Modes**: Graceful detection and visual handling of zero derivative ($|f'(x)| < 10^{-12}$), initial root placement, domain departure, divergence ($|x| > 10^{12}$), and stalled iterations.
- **Interactive Calculation & Diagnostics**: Step-by-step mathematical substitution cards, tabular history, and dual real-time convergence charts (linear trajectory and log-scale residual convergence).
- **Practical Applications & Featured Kepler Demo**: Dedicated "Where it is used" section featuring an interactive canvas orbit solving Kepler's equation for planetary position, alongside 12 practical applications across engineering, finance, graphics, and computing. Card definitions live in `src/content/applications.ts`.
- **Self-Contained & Secure**: Zero external runtime requests, zero dynamic code evaluation (`eval` / `new Function`), self-hosted fonts (`Space Grotesk`, `Inter`), and strict Content Security Policy (CSP).

---

## Performance & Accessibility

- **Bundle Size**: Initial gzipped JavaScript bundle is ~77 KB (well within the 200 KB performance budget).
- **Typography & Theme**: "Observatory" dark-mode palette adhering strictly to WCAG AA contrast ratios ($\ge 4.5:1$ for text, $\ge 3.0:1$ for graphical markers).
- **Motion Restraint**: Full support for the `prefers-reduced-motion` media query with instant transitions.

---

## Project Structure

```text
├── fixtures/
│   └── golden.json           # SymPy-verified reference datasets
├── reference/
│   ├── make_fixtures.py      # Fixture generator using SymPy
│   ├── newton_raphson.py     # Python reference engine
│   └── palette.py            # Token source of truth
├── src/
│   ├── components/
│   │   ├── applications/
│   │   │   ├── ApplicationCard.tsx
│   │   │   ├── ApplicationsSection.tsx
│   │   │   ├── FunctionThumbnail.tsx
│   │   │   └── KeplerDemo.tsx
│   │   ├── CalculationPanel.tsx
│   │   ├── CommandBar.tsx
│   │   ├── ConvergenceCharts.tsx
│   │   ├── EmergenceStage.tsx
│   │   ├── Header.tsx
│   │   ├── IterationTable.tsx
│   │   ├── MathView.tsx
│   │   └── UnderstandMethod.tsx
│   ├── content/
│   │   └── applications.ts       # Typed definitions for 12 application cards
│   ├── engine/
│   │   ├── animation.ts
│   │   ├── parser.ts
│   │   ├── solver.ts
│   │   └── tokens.ts
│   ├── styles/
│   │   └── index.css
│   ├── __tests__/
│   │   ├── applications.test.ts
│   │   ├── engine.test.ts
│   │   ├── quality_gates.test.ts
│   │   └── ui_parity.test.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js $\ge$ 18.0.0
- npm $\ge$ 9.0.0

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

### Automated Testing

Run the automated test suite (81 unit, parity, applications, and security checks):

```bash
npm test
```

### Production Build

Compile TypeScript and generate optimized assets in `dist/`:

```bash
npm run build
```

---

## Sources

- Richard L. Burden and J. Douglas Faires, *Numerical Analysis*.
- Steven C. Chapra and Raymond P. Canale, *Numerical Methods for Engineers*.
- Frank M. White, *Fluid Mechanics* (for the Colebrook friction factor equation).
- Howard D. Curtis, *Orbital Mechanics for Engineering Students* (for Kepler's equation and eccentric anomaly).

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
