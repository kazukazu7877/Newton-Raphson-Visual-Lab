import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { EmergencePayload, CameraWindow, StepAnimationData } from '../engine/animation';

interface EmergenceStageProps {
  payload: EmergencePayload;
  activeStep: number;
  onStepChange: (step: number) => void;
  cameraMode: 'cinematic' | 'follow_step' | 'whole_path';
  onCameraModeChange: (mode: 'cinematic' | 'follow_step' | 'whole_path') => void;
}

interface TimelineItem {
  type: 'scene0' | 'step' | 'final';
  start: number;
  end: number;
  dur: number;
  index?: number;
  step?: StepAnimationData;
}

export const EmergenceStage: React.FC<EmergenceStageProps> = ({
  payload,
  activeStep,
  onStepChange,
  cameraMode,
  onCameraModeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1.0);
  const [badgeText, setBadgeText] = useState<string>('Scene 0: Curve Emergence');
  const [statusToast, setStatusToast] = useState<{ show: boolean; text: string; color: string }>({
    show: false,
    text: '',
    color: '#B6F36B',
  });
  const [tooltip, setTooltip] = useState<{ show: boolean; x: number; y: number; text: string }>({
    show: false,
    x: 0,
    y: 0,
    text: '',
  });

  const stateRef = useRef({
    currentTime: 0,
    totalDuration: 1,
    schedule: [] as TimelineItem[],
    isPlaying: true,
    speed: 1.0,
    cameraMode: cameraMode,
    activeStep: 0,
  });

  stateRef.current.isPlaying = isPlaying;
  stateRef.current.speed = speed;
  stateRef.current.cameraMode = cameraMode;

  // Build timeline schedule
  useEffect(() => {
    const schedule: TimelineItem[] = [];
    let t = 0;
    const scene0Dur = 1.6;
    schedule.push({ type: 'scene0', start: t, end: t + scene0Dur, dur: scene0Dur });
    t += scene0Dur;

    const numSteps = payload.steps ? payload.steps.length : 0;
    for (let i = 0; i < numSteps; i++) {
      const step = payload.steps[i]!;
      const isTiny = step.abs_change < 0.005;
      const stepDur = isTiny ? 1.0 : 2.6;
      schedule.push({
        type: 'step',
        index: i,
        step,
        start: t,
        end: t + stepDur,
        dur: stepDur,
      });
      t += stepDur;
    }

    const finalDur = 2.0;
    schedule.push({ type: 'final', start: t, end: t + finalDur, dur: finalDur });
    t += finalDur;

    stateRef.current.schedule = schedule;
    stateRef.current.totalDuration = t;
    stateRef.current.currentTime = 0;
    setIsPlaying(true);
  }, [payload]);

  // Sync external activeStep changes (e.g. from slider or user click)
  const jumpToStep = useCallback((stepIdx: number) => {
    const item = stateRef.current.schedule.find(s => s.type === 'step' && s.index === stepIdx);
    if (item) {
      stateRef.current.currentTime = item.start + 0.01;
    }
  }, []);

  useEffect(() => {
    if (activeStep !== stateRef.current.activeStep) {
      jumpToStep(activeStep);
    }
  }, [activeStep, jumpToStep]);

  // Easing helpers
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBack = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const getCamera = (time: number): CameraWindow => {
      const camMode = stateRef.current.cameraMode;
      const camList = payload.cameras[camMode] || payload.cameras.whole_path || [];
      if (!camList.length) return { x_min: -3, x_max: 3, y_min: -4, y_max: 4 };

      if (camMode === 'whole_path') return camList[0]!;

      const sched = stateRef.current.schedule;
      if (!sched.length || time <= sched[0]!.end) {
        return camList[0]!;
      }

      for (let i = 1; i < sched.length; i++) {
        const item = sched[i]!;
        if (time >= item.start && time < item.end) {
          const itemIdx =
            item.type === 'step'
              ? (item.index ?? 0) + 1
              : item.type === 'final'
              ? camList.length - 1
              : 0;
          const curCam = camList[Math.min(itemIdx, camList.length - 1)]!;
          const prevCam = camList[Math.max(0, itemIdx - 1)]!;
          const glideDur = Math.min(0.8, item.dur * 0.4);
          const relT = Math.min(1.0, (time - item.start) / glideDur);
          const ease = easeInOutCubic(relT);

          return {
            x_min: prevCam.x_min + (curCam.x_min - prevCam.x_min) * ease,
            x_max: prevCam.x_max + (curCam.x_max - prevCam.x_max) * ease,
            y_min: prevCam.y_min + (curCam.y_min - prevCam.y_min) * ease,
            y_max: prevCam.y_max + (curCam.y_max - prevCam.y_max) * ease,
          };
        }
      }

      return camList[camList.length - 1]!;
    };

    const toScreen = (x: number, y: number, cam: CameraWindow, w: number, h: number, dpr: number) => {
      const pad = 36;
      const innerW = w - pad * 2;
      const innerH = h - pad * 2;
      const sx = pad + ((x - cam.x_min) / (cam.x_max - cam.x_min)) * innerW;
      const sy = h - pad - ((y - cam.y_min) / (cam.y_max - cam.y_min)) * innerH;
      return { x: sx * dpr, y: sy * dpr };
    };

    const drawPolyline = (xs: number[], ys: number[], count: number, cam: CameraWindow, w: number, h: number, dpr: number) => {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < count; i++) {
        const pt = toScreen(xs[i]!, ys[i]!, cam, w, h, dpr);
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
    };

    const render = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (stateRef.current.isPlaying) {
        stateRef.current.currentTime += dt * stateRef.current.speed;
        if (stateRef.current.currentTime >= stateRef.current.totalDuration) {
          stateRef.current.currentTime = stateRef.current.totalDuration;
          setIsPlaying(false);
        }
      }

      const time = stateRef.current.currentTime;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cam = getCamera(time);
      const sched = stateRef.current.schedule;

      // 0. Ambient lighting & vignette
      const lx = w * 0.46 * dpr;
      const ly = h * 0.38 * dpr;
      const maxRadius = Math.max(w, h) * 0.75 * dpr;
      const radGrad = ctx.createRadialGradient(lx, ly, 10 * dpr, lx, ly, maxRadius);
      radGrad.addColorStop(0.0, payload.colors.ambient_glow);
      radGrad.addColorStop(0.35, 'rgba(25, 60, 115, 0.02)');
      radGrad.addColorStop(0.65, 'rgba(15, 24, 48, 0.0)');
      radGrad.addColorStop(0.90, 'rgba(5, 8, 15, 0.20)');
      radGrad.addColorStop(1.0, payload.colors.vignette);
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. Grid
      ctx.save();
      ctx.strokeStyle = payload.colors.grid_major;
      ctx.lineWidth = 1 * dpr;
      const xSpan = cam.x_max - cam.x_min;
      const xStep = Math.pow(10, Math.floor(Math.log10(xSpan))) / 2;
      const startX = Math.floor(cam.x_min / xStep) * xStep;
      for (let x = startX; x <= cam.x_max; x += xStep) {
        const p1 = toScreen(x, cam.y_min, cam, w, h, dpr);
        const p2 = toScreen(x, cam.y_max, cam, w, h, dpr);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Real x-axis (y = 0)
      ctx.save();
      const a1 = toScreen(cam.x_min, 0, cam, w, h, dpr);
      const a2 = toScreen(cam.x_max, 0, cam, w, h, dpr);
      ctx.strokeStyle = payload.colors.axis_x;
      ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
      ctx.fillStyle = '#7585A8';
      ctx.font = `${10 * dpr}px Inter, sans-serif`;
      ctx.fillText('y = 0', a2.x - 40 * dpr, a1.y - 7 * dpr);
      ctx.restore();

      // 3. Curve (Scene 0 Emergence or full)
      const xs = payload.curve.x;
      const ys = payload.curve.y;
      if (xs.length > 1) {
        ctx.save();
        let drawRatio = 1.0;
        if (sched.length > 0 && time < sched[0]!.end) {
          drawRatio = easeOutCubic(Math.min(1.0, time / 1.3));
          setBadgeText(`Scene 0: Curve Emergence (${Math.round(drawRatio * 100)}%)`);
        }

        const drawCount = Math.floor(xs.length * drawRatio);
        if (drawCount >= 2) {
          // Luminous underlays
          ctx.strokeStyle = payload.colors.curve_glow_outer;
          ctx.lineWidth = 10 * dpr;
          drawPolyline(xs, ys, drawCount, cam, w, h, dpr);

          ctx.strokeStyle = payload.colors.curve_glow;
          ctx.lineWidth = 5 * dpr;
          drawPolyline(xs, ys, drawCount, cam, w, h, dpr);

          // Core sharp curve with gradient
          const pStart = toScreen(xs[0]!, 0, cam, w, h, dpr);
          const pEnd = toScreen(xs[drawCount - 1]!, 0, cam, w, h, dpr);
          const grad = ctx.createLinearGradient(pStart.x, 0, pEnd.x, 0);
          grad.addColorStop(0.0, payload.colors.curve_aqua);
          grad.addColorStop(0.5, payload.colors.curve_azure);
          grad.addColorStop(1.0, payload.colors.curve_periwinkle);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.4 * dpr;
          drawPolyline(xs, ys, drawCount, cam, w, h, dpr);

          // Pen head dot during Scene 0
          if (sched.length > 0 && time < sched[0]!.end && drawCount > 0) {
            const headPt = toScreen(xs[drawCount - 1]!, ys[drawCount - 1]!, cam, w, h, dpr);
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(headPt.x, headPt.y, 4 * dpr, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = payload.colors.curve_aqua;
            ctx.lineWidth = 1.8 * dpr;
            ctx.beginPath();
            ctx.arc(headPt.x, headPt.y, 7 * dpr, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 4. Steps & Tangent Animation
      if (sched.length > 0 && time > sched[0]!.end) {
        for (let i = 1; i < sched.length; i++) {
          const item = sched[i]!;
          if (item.type !== 'step' || !item.step) continue;
          const step = item.step;
          const stepIdx = item.index ?? 0;

          if (time >= item.start) {
            const isCurrent = time < item.end;
            const relT = isCurrent ? (time - item.start) / item.dur : 1.0;

            if (isCurrent && stateRef.current.activeStep !== stepIdx) {
              stateRef.current.activeStep = stepIdx;
              onStepChange(stepIdx);
              setBadgeText(`Iteration ${stepIdx}: Tangent Projection`);
            }

            // Draw single step
            ctx.save();
            const pA = Math.min(1.0, relT / 0.20);
            const pB = Math.max(0.0, Math.min(1.0, (relT - 0.20) / 0.30));
            const pC = Math.max(0.0, Math.min(1.0, (relT - 0.50) / 0.25));
            const pD = Math.max(0.0, Math.min(1.0, (relT - 0.75) / 0.15));
            const pE = Math.max(0.0, Math.min(1.0, (relT - 0.90) / 0.10));

            const isFaded = !isCurrent;
            const coralCol = isFaded ? payload.colors.current_x_history : payload.colors.current_x;
            const goldCol = isFaded ? payload.colors.tangent_history : payload.colors.tangent;
            const limeCol = isFaded ? payload.colors.next_x_history : payload.colors.next_x;

            // 1. Vertical plumb line
            const pAxis = toScreen(step.x_n, 0, cam, w, h, dpr);
            const pCurve = toScreen(step.x_n, step.f_xn, cam, w, h, dpr);
            const plumbProgress = isFaded ? 1.0 : easeOutCubic(pA);
            const curPlumbY = pAxis.y + (pCurve.y - pAxis.y) * plumbProgress;

            ctx.strokeStyle = coralCol;
            ctx.lineWidth = (isFaded ? 1.0 : 1.5) * dpr;
            ctx.setLineDash([3 * dpr, 3 * dpr]);
            ctx.beginPath();
            ctx.moveTo(pAxis.x, pAxis.y);
            ctx.lineTo(pAxis.x, curPlumbY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Guess marker on curve
            if (plumbProgress > 0.8) {
              const popScale = isFaded ? 1.0 : easeOutBack((plumbProgress - 0.8) / 0.2);

              ctx.fillStyle = payload.colors.current_x_halo;
              ctx.beginPath();
              ctx.arc(pCurve.x, pCurve.y, 8 * dpr * popScale, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = coralCol;
              ctx.beginPath();
              ctx.arc(pCurve.x, pCurve.y, 4.5 * dpr * popScale, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = payload.colors.current_x_core;
              ctx.beginPath();
              ctx.arc(pCurve.x, pCurve.y, 2 * dpr * popScale, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = payload.colors.current_x;
              ctx.font = `${10.5 * dpr}px Inter, sans-serif`;
              ctx.fillText(`x_${step.n}`, pCurve.x + 7 * dpr, pCurve.y - 6 * dpr);
            }

            // 2. Tangent Sweep
            if (pB > 0 || isFaded) {
              const rotEase = isFaded ? 1.0 : easeInOutCubic(pB);
              const sweepSlope = step.df_xn * rotEase;
              const span = Math.max(Math.abs(step.x_next - step.x_n), 0.35);
              const extProgress = isFaded ? 1.0 : easeOutCubic(pC);
              const leftX = Math.min(step.x_n, step.x_next) - 0.25 * span * extProgress;
              const rightX = Math.max(step.x_n, step.x_next) + 0.25 * span * extProgress;
              const yLeft = step.f_xn + sweepSlope * (leftX - step.x_n);
              const yRight = step.f_xn + sweepSlope * (rightX - step.x_n);

              const pL = toScreen(leftX, yLeft, cam, w, h, dpr);
              const pR = toScreen(rightX, yRight, cam, w, h, dpr);

              if (!isFaded) {
                ctx.strokeStyle = payload.colors.tangent_halo;
                ctx.lineWidth = 5 * dpr;
                ctx.beginPath();
                ctx.moveTo(pL.x, pL.y);
                ctx.lineTo(pR.x, pR.y);
                ctx.stroke();
              }

              ctx.strokeStyle = goldCol;
              ctx.lineWidth = (isFaded ? 1.2 : 2.0) * dpr;
              ctx.beginPath();
              ctx.moveTo(pL.x, pL.y);
              ctx.lineTo(pR.x, pR.y);
              ctx.stroke();
            }

            // 3. Landing at (x_next, 0)
            if (pD > 0 || isFaded) {
              const pNext = toScreen(step.x_next, 0, cam, w, h, dpr);
              const hSz = 9 * dpr;
              ctx.fillStyle = payload.colors.next_x_halo;
              ctx.beginPath();
              ctx.moveTo(pNext.x, pNext.y - hSz);
              ctx.lineTo(pNext.x + hSz, pNext.y);
              ctx.lineTo(pNext.x, pNext.y + hSz);
              ctx.lineTo(pNext.x - hSz, pNext.y);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = limeCol;
              ctx.beginPath();
              const sz = 5.5 * dpr;
              ctx.moveTo(pNext.x, pNext.y - sz);
              ctx.lineTo(pNext.x + sz, pNext.y);
              ctx.lineTo(pNext.x, pNext.y + sz);
              ctx.lineTo(pNext.x - sz, pNext.y);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = payload.colors.next_x_core;
              ctx.beginPath();
              const cSz = 2.2 * dpr;
              ctx.moveTo(pNext.x, pNext.y - cSz);
              ctx.lineTo(pNext.x + cSz, pNext.y);
              ctx.lineTo(pNext.x, pNext.y + cSz);
              ctx.lineTo(pNext.x - cSz, pNext.y);
              ctx.closePath();
              ctx.fill();

              if (!isFaded && pD < 1.0) {
                const ringR = 7 * dpr + easeOutCubic(pD) * 14 * dpr;
                ctx.strokeStyle = `rgba(182, 243, 107, ${0.7 * (1.0 - pD)})`;
                ctx.lineWidth = 1.2 * dpr;
                ctx.beginPath();
                ctx.arc(pNext.x, pNext.y, ringR, 0, Math.PI * 2);
                ctx.stroke();
              }

              ctx.font = `${10.5 * dpr}px Inter, sans-serif`;
              ctx.fillStyle = limeCol;
              ctx.fillText(`x_${step.n + 1}`, pNext.x + 7 * dpr, pNext.y + 13 * dpr);
            }

            // 4. Projection to next curve point
            if ((pE > 0 || isFaded) && step.f_xnext !== null && Number.isFinite(step.f_xnext)) {
              const pNextAxis = toScreen(step.x_next, 0, cam, w, h, dpr);
              const pNextCurve = toScreen(step.x_next, step.f_xnext, cam, w, h, dpr);

              ctx.strokeStyle = limeCol;
              ctx.lineWidth = 1.2 * dpr;
              ctx.setLineDash([3 * dpr, 3 * dpr]);
              ctx.beginPath();
              ctx.moveTo(pNextAxis.x, pNextAxis.y);
              ctx.lineTo(pNextCurve.x, pNextCurve.y);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.strokeStyle = limeCol;
              ctx.lineWidth = 1.8 * dpr;
              ctx.beginPath();
              ctx.arc(pNextCurve.x, pNextCurve.y, 4.5 * dpr, 0, Math.PI * 2);
              ctx.stroke();
            }

            ctx.restore();
          }
        }
      }

      // 5. Final Scene (Root Bloom)
      const finalItem = sched[sched.length - 1];
      if (finalItem && time >= finalItem.start) {
        const relT = Math.min(1.0, (time - finalItem.start) / finalItem.dur);

        if (payload.converged) {
          setBadgeText(`Converged • Root Bloom (x* = ${payload.final_x.toFixed(8)})`);
          const pRoot = toScreen(payload.final_x, 0, cam, w, h, dpr);

          const pulse = (relT * 2.0) % 1.0;
          ctx.strokeStyle = `rgba(182, 243, 107, ${0.7 * (1 - pulse)})`;
          ctx.lineWidth = 1.8 * dpr;
          ctx.beginPath();
          ctx.arc(pRoot.x, pRoot.y, 7 * dpr + pulse * 30 * dpr, 0, Math.PI * 2);
          ctx.stroke();

          // Star
          ctx.save();
          let rot = (Math.PI / 2) * 3;
          const spikes = 5;
          const step = Math.PI / spikes;
          const outerR = 11 * dpr;
          const innerR = 5.5 * dpr;
          ctx.beginPath();
          ctx.moveTo(pRoot.x, pRoot.y - outerR);
          for (let s = 0; s < spikes; s++) {
            ctx.lineTo(pRoot.x + Math.cos(rot) * outerR, pRoot.y + Math.sin(rot) * outerR);
            rot += step;
            ctx.lineTo(pRoot.x + Math.cos(rot) * innerR, pRoot.y + Math.sin(rot) * innerR);
            rot += step;
          }
          ctx.closePath();
          ctx.fillStyle = payload.colors.root_core;
          ctx.fill();
          ctx.strokeStyle = payload.colors.root_ring;
          ctx.lineWidth = 1.8 * dpr;
          ctx.stroke();
          ctx.restore();

          setStatusToast({
            show: true,
            text: `Root: x ≈ ${payload.final_x.toFixed(8)} | Residual: ${
              payload.final_residual ? payload.final_residual.toExponential(2) : 0
            }`,
            color: payload.colors.root_ring,
          });
        } else {
          setStatusToast({
            show: true,
            text: `Status: ${payload.status_label}`,
            color: '#FFC247',
          });
        }
      } else {
        setStatusToast((prev) => (prev.show ? { ...prev, show: false } : prev));
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [payload, onStepChange]);

  // Mouse hover tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pad = 36;
    const innerW = rect.width - pad * 2;
    const innerH = rect.height - pad * 2;

    const camList = payload.cameras[cameraMode] || payload.cameras.whole_path || [];
    const cam = camList[0] || { x_min: -3, x_max: 3, y_min: -4, y_max: 4 };

    const mathX = cam.x_min + ((mx - pad) / innerW) * (cam.x_max - cam.x_min);
    const mathY = cam.y_min + ((rect.height - pad - my) / innerH) * (cam.y_max - cam.y_min);

    setTooltip({
      show: true,
      x: Math.min(rect.width - 120, Math.max(10, mx + 12)),
      y: Math.min(rect.height - 45, Math.max(10, my + 12)),
      text: `x: ${mathX.toFixed(4)}\ny: ${mathY.toFixed(4)}`,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, show: false }));
  };

  // Transport handlers
  const handlePlayToggle = () => setIsPlaying(prev => !prev);
  const handleReset = () => {
    const sched = stateRef.current.schedule;
    stateRef.current.currentTime = sched[0]?.end ?? 0;
  };
  const handleReplay = () => {
    stateRef.current.currentTime = 0;
    setIsPlaying(true);
  };
  const handleSkipIntro = () => {
    const sched = stateRef.current.schedule;
    if (sched[0] && stateRef.current.currentTime < sched[0].end) {
      stateRef.current.currentTime = sched[0].end;
    }
  };
  const handleNext = () => {
    const sched = stateRef.current.schedule;
    const cur = stateRef.current.currentTime;
    for (let i = 1; i < sched.length; i++) {
      if (sched[i]!.start > cur + 0.05) {
        stateRef.current.currentTime = sched[i]!.start;
        break;
      }
    }
  };
  const handlePrev = () => {
    const sched = stateRef.current.schedule;
    const cur = stateRef.current.currentTime;
    for (let i = sched.length - 1; i >= 0; i--) {
      if (sched[i]!.start < cur - 0.1) {
        stateRef.current.currentTime = sched[i]!.start;
        break;
      }
    }
  };
  const handleSpeedToggle = () => {
    if (speed === 1.0) setSpeed(2.0);
    else if (speed === 2.0) setSpeed(0.5);
    else setSpeed(1.0);
  };
  const handleCamToggle = () => {
    if (cameraMode === 'cinematic') onCameraModeChange('follow_step');
    else if (cameraMode === 'follow_step') onCameraModeChange('whole_path');
    else onCameraModeChange('cinematic');
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '580px',
        maxHeight: 'min(580px, 80vh)',
        minHeight: '380px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--ink-900)',
        border: '1px solid var(--line)',
        borderRadius: '6px',
        boxShadow: 'inset 0 1px 0 var(--panel-top-highlight)',
        overflow: 'hidden',
      }}
    >
      {/* Stage Badge */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '12px',
          backgroundColor: 'var(--badge-bg)',
          backdropFilter: 'blur(4px)',
          border: '1px solid var(--line)',
          borderRadius: '6px',
          padding: '3px 8px',
          fontSize: '0.73rem',
          color: 'var(--text-2)',
          fontFamily: 'var(--font-display)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        STAGE • <span style={{ color: 'var(--curve-azure)', fontWeight: 600 }}>{badgeText}</span>
      </div>

      {/* Status Toast */}
      {statusToast.show && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '12px',
            backgroundColor: 'var(--panel-backdrop)',
            border: `1px solid ${statusToast.color}`,
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.76rem',
            fontWeight: 600,
            color: statusToast.color,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          {statusToast.text}
        </div>
      )}

      {/* Hover Tooltip */}
      {tooltip.show && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            backgroundColor: 'rgba(10, 16, 32, 0.95)',
            border: '1px solid var(--curve-azure)',
            borderRadius: '6px',
            padding: '5px 8px',
            fontSize: '0.74rem',
            color: 'var(--text-1)',
            pointerEvents: 'none',
            boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
            whiteSpace: 'pre-line',
            zIndex: 10,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          flex: 1,
          width: '100%',
          height: 'calc(100% - 44px)',
          display: 'block',
          cursor: 'crosshair',
        }}
      />

      {/* Transport Controls Bar */}
      <div
        style={{
          height: '44px',
          backgroundColor: 'var(--ink-850)',
          borderTop: '1px solid var(--line)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          gap: '8px',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button className="btn-secondary" onClick={handleReplay} title="Replay entire sequence">
            Replay
          </button>
          <button className="btn-secondary" onClick={handleReset} title="Reset to initial step">
            Reset
          </button>
          <button
            className="btn-secondary"
            onClick={handlePrev}
            disabled={payload.steps.length <= 1}
            title="Previous step"
          >
            Prev
          </button>
          <button
            className={`btn-secondary ${isPlaying ? 'active' : ''}`}
            onClick={handlePlayToggle}
            title="Play / Pause"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            className="btn-secondary"
            onClick={handleNext}
            disabled={payload.steps.length <= 1}
            title="Next step"
          >
            Next
          </button>
        </div>

        <input
          type="range"
          min="0"
          max="1000"
          value={Math.round(
            (stateRef.current.currentTime / Math.max(1, stateRef.current.totalDuration)) * 1000,
          )}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            stateRef.current.currentTime = (val / 1000) * stateRef.current.totalDuration;
          }}
          style={{
            flex: 1,
            margin: '0 8px',
            height: '5px',
            accentColor: 'var(--curve-azure)',
          }}
          aria-label="Simulation timeline"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button className="btn-secondary" onClick={handleSpeedToggle} title="Toggle playback speed">
            {speed}x
          </button>
          <button className="btn-secondary" onClick={handleCamToggle} title="Toggle camera mode">
            {cameraMode === 'cinematic' ? 'Cinematic' : cameraMode === 'whole_path' ? 'Whole' : 'Follow'}
          </button>
          <button className="btn-secondary" onClick={handleSkipIntro} title="Skip Scene 0 intro">
            Skip Intro
          </button>
        </div>
      </div>
    </div>
  );
};
