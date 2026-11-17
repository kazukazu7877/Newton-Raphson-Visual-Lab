import React, { useState, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { CommandBar, PRESETS } from './components/CommandBar';
import { EmergenceStage } from './components/EmergenceStage';
import { CalculationPanel } from './components/CalculationPanel';
import { IterationTable } from './components/IterationTable';
import { ConvergenceCharts } from './components/ConvergenceCharts';
import { UnderstandMethod } from './components/UnderstandMethod';
import { solve, type NewtonResult } from './engine/solver';
import { buildEmergencePayload } from './engine/animation';

export const App: React.FC = () => {
  const [result, setResult] = useState<NewtonResult>(() => {
    const init = PRESETS[0]!;
    return solve(init.expr, init.x0, parseFloat(init.tol), init.maxIter);
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [cameraMode, setCameraMode] = useState<'cinematic' | 'follow_step' | 'whole_path'>('cinematic');

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

  const payload = useMemo(() => {
    return buildEmergencePayload(result);
  }, [result]);

  return (
    <div className="app-container">
      {/* Header */}
      <Header />

      {/* Command Bar & Presets */}
      <CommandBar onRun={handleRun} result={result} errorMsg={errorMsg} />

      {/* Hero Stage [68% Stage | 32% The Calculation] */}
      <div className="hero-layout">
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

      {/* Understand the Method (Educational Guide) */}
      <UnderstandMethod />
    </div>
  );
};
export default App;
