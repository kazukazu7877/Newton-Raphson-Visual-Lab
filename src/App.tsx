import React, { useState, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { CommandBar, PRESETS, type ExternalLoadRequest } from './components/CommandBar';
import { EmergenceStage } from './components/EmergenceStage';
import { CalculationPanel } from './components/CalculationPanel';
import { IterationTable } from './components/IterationTable';
import { ConvergenceCharts } from './components/ConvergenceCharts';
import { UnderstandMethod } from './components/UnderstandMethod';
import { solve, type NewtonResult } from './engine/solver';
import { buildEmergencePayload } from './engine/animation';

// Lazy-load applications section for optimal first paint and code splitting
const ApplicationsSection = React.lazy(() =>
  import('./components/applications/ApplicationsSection').then((m) => ({
    default: m.ApplicationsSection,
  }))
);

export const App: React.FC = () => {
  const [result, setResult] = useState<NewtonResult>(() => {
    const init = PRESETS[0]!;
    return solve(init.expr, init.x0, parseFloat(init.tol), init.maxIter);
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [cameraMode, setCameraMode] = useState<'cinematic' | 'follow_step' | 'whole_path'>('cinematic');
  const [externalLoad, setExternalLoad] = useState<ExternalLoadRequest | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  const handleRun = useCallback((exprText: string, x0Val: number, tolVal: number, maxIterVal: number) => {
    try {
      const res = solve(exprText, x0Val, tolVal, maxIterVal);
      setResult(res);
      setSelectedStep(0);
      setErrorMsg(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An unexpected error occurred during execution.');
      }
    }
  }, []);

  const handleLoadApplication = useCallback(
    (name: string, expr: string, x0: number, tol?: number, maxIter?: number) => {
      setExternalLoad({
        name,
        expr,
        x0,
        tol,
        maxIter,
        timestamp: Date.now(),
      });
      setAnnouncement(`Loaded ${name}`);

      // Smooth scroll to stage (instant jump if prefers-reduced-motion)
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stageEl = document.getElementById('stage-section') || document.querySelector('.hero-layout');
      if (stageEl) {
        stageEl.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      }

      // Move keyboard focus to Play button for accessibility
      setTimeout(() => {
        const playBtn = document.querySelector<HTMLButtonElement>('button[title="Play / Pause"]');
        if (playBtn) {
          playBtn.focus();
        }
      }, prefersReducedMotion ? 50 : 350);
    },
    [],
  );

  const payload = useMemo(() => {
    return buildEmergencePayload(result);
  }, [result]);

  return (
    <div className="app-container">
      {/* Header */}
      <Header />

      {/* Command Bar & Presets */}
      <CommandBar
        onRun={handleRun}
        result={result}
        errorMsg={errorMsg}
        externalLoad={externalLoad}
      />

      {/* Hero Stage [68% Stage | 32% The Calculation] */}
      <div id="stage-section" className="hero-layout">
        <div>
          <EmergenceStage
            payload={payload}
            activeStep={selectedStep}
            onStepChange={setSelectedStep}
            cameraMode={cameraMode}
            onCameraModeChange={setCameraMode}
          />
        </div>

        <div>
          <CalculationPanel result={result} selectedStep={selectedStep} />
        </div>
      </div>

      {/* Iteration Table */}
      <IterationTable
        result={result}
        selectedStep={selectedStep}
        onSelectStep={setSelectedStep}
      />

      {/* Convergence Analysis & Diagnostic Charts */}
      <ConvergenceCharts result={result} selectedStep={selectedStep} />

      {/* Where it is used (Practical Applications & Kepler Demo) */}
      <React.Suspense fallback={<div style={{ minHeight: '120px' }} />}>
        <ApplicationsSection onLoadApplication={handleLoadApplication} />
      </React.Suspense>

      {/* Understand the Method (Educational Guide) */}
      <UnderstandMethod />

      {/* Screen-reader Live Region */}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
};
export default App;
