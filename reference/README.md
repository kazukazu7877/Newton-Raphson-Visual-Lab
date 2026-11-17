# Reference Engine & Tooling

This directory contains reference implementations and test fixture generation scripts:

- `newton_raphson.py`: Python reference numerical engine using SymPy for analytical differentiation and AST inspection.
- `palette.py`: Visual token reference defining colors, font definitions, and WCAG AA contrast helpers.
- `make_fixtures.py`: Script that executes the Python reference engine across standard benchmark problems and failure modes to generate `fixtures/golden.json`.

These files serve as the ground truth against which the TypeScript engine in `src/engine/` is verified.
