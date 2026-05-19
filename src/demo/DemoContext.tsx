import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DEMO_STEPS, type DemoStep } from "./steps";

type DemoState = {
  active: boolean;
  stepIndex: number;
  isPlaying: boolean;
  projectId: string | null;
};

type DemoContextValue = DemoState & {
  start: (projectId: string) => void;
  exit: () => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  goTo: (i: number) => void;
  steps: DemoStep[];
  currentStep: DemoStep | null;
};

const STORAGE_KEY = "dronie.demo.state";

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be inside DemoProvider");
  return ctx;
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<DemoState>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as DemoState;
    } catch {}
    return { active: false, stepIndex: 0, isPlaying: true, projectId: null };
  });

  const timerRef = useRef<number | null>(null);
  const lastRunStepRef = useRef<number>(-1);

  // Persist
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const currentStep = state.active ? DEMO_STEPS[state.stepIndex] ?? null : null;

  // Navigate to step route when step changes
  useEffect(() => {
    if (!state.active || !currentStep || !state.projectId) return;
    const target = currentStep.route(state.projectId);
    if (location.pathname !== target.split("?")[0]) {
      navigate(target);
    }
    // Run onEnter side-effect once per step entry
    if (lastRunStepRef.current !== state.stepIndex) {
      lastRunStepRef.current = state.stepIndex;
      currentStep.onEnter?.({ projectId: state.projectId }).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.active, state.stepIndex, state.projectId]);

  // Auto-advance
  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!state.active || !state.isPlaying || !currentStep) return;
    const dur = currentStep.durationMs;
    timerRef.current = window.setTimeout(() => {
      setState((s) => {
        if (s.stepIndex >= DEMO_STEPS.length - 1) {
          return { ...s, isPlaying: false };
        }
        return { ...s, stepIndex: s.stepIndex + 1 };
      });
    }, dur);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [state.active, state.isPlaying, state.stepIndex, currentStep]);

  const start = useCallback((projectId: string) => {
    lastRunStepRef.current = -1;
    setState({ active: true, stepIndex: 0, isPlaying: true, projectId });
  }, []);

  const exit = useCallback(() => {
    setState((s) => ({ ...s, active: false, isPlaying: false }));
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  const next = useCallback(() => {
    setState((s) => ({ ...s, stepIndex: Math.min(s.stepIndex + 1, DEMO_STEPS.length - 1) }));
  }, []);

  const prev = useCallback(() => {
    setState((s) => ({ ...s, stepIndex: Math.max(s.stepIndex - 1, 0) }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((s) => ({ ...s, isPlaying: !s.isPlaying }));
  }, []);

  const goTo = useCallback((i: number) => {
    setState((s) => ({ ...s, stepIndex: Math.max(0, Math.min(i, DEMO_STEPS.length - 1)) }));
  }, []);

  const value = useMemo<DemoContextValue>(() => ({
    ...state,
    start, exit, next, prev, togglePlay, goTo,
    steps: DEMO_STEPS,
    currentStep,
  }), [state, start, exit, next, prev, togglePlay, goTo, currentStep]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}