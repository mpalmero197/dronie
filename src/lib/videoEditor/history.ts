/**
 * Undo/redo for the editor document plus local-storage autosave.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorProject, migrateProject } from "./types";

const MAX_HISTORY = 60;
const AUTOSAVE_PREFIX = "dronie.videoEditor.draft.";
const AUTOSAVE_DEBOUNCE_MS = 800;

export interface HistoryApi {
  project: EditorProject;
  /** Commit a change to history (undoable). */
  update: (updater: (p: EditorProject) => EditorProject, label?: string) => void;
  /** Change without touching history — for drag scrubbing in progress. */
  updateTransient: (updater: (p: EditorProject) => EditorProject) => void;
  /** Push the current transient state onto the undo stack. */
  commitTransient: (label?: string) => void;
  /** Replace the whole document and clear history (used when loading). */
  reset: (p: EditorProject) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  lastLabel: string | null;
}

export function autosaveKey(id: string) {
  return `${AUTOSAVE_PREFIX}${id}`;
}

export function loadDraft(id: string): EditorProject | null {
  try {
    const raw = localStorage.getItem(autosaveKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const project = migrateProject(parsed);
    // Blob URLs die with the page, so a draft with local sources cannot be restored.
    if (project.clips.some((c) => c.src.startsWith("blob:"))) return null;
    return project;
  } catch {
    return null;
  }
}

export function saveDraft(p: EditorProject) {
  try {
    if (p.clips.some((c) => c.src.startsWith("blob:"))) return;
    localStorage.setItem(autosaveKey(p.id), JSON.stringify(p));
  } catch {
    /* quota or private mode — autosave is best-effort */
  }
}

export function clearDraft(id: string) {
  try { localStorage.removeItem(autosaveKey(id)); } catch { /* ignore */ }
}

export function useProjectHistory(initial: EditorProject): HistoryApi {
  const [project, setProject] = useState<EditorProject>(initial);
  const past = useRef<EditorProject[]>([]);
  const future = useRef<EditorProject[]>([]);
  const transientBase = useRef<EditorProject | null>(null);
  const [stamp, setStamp] = useState(0);
  const [lastLabel, setLastLabel] = useState<string | null>(null);

  const bump = () => setStamp((s) => s + 1);

  const update = useCallback((updater: (p: EditorProject) => EditorProject, label?: string) => {
    setProject((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      past.current = [...past.current, prev].slice(-MAX_HISTORY);
      future.current = [];
      return next;
    });
    if (label) setLastLabel(label);
    bump();
  }, []);

  const updateTransient = useCallback((updater: (p: EditorProject) => EditorProject) => {
    setProject((prev) => {
      if (!transientBase.current) transientBase.current = prev;
      return updater(prev);
    });
  }, []);

  const commitTransient = useCallback((label?: string) => {
    const base = transientBase.current;
    transientBase.current = null;
    if (!base) return;
    past.current = [...past.current, base].slice(-MAX_HISTORY);
    future.current = [];
    if (label) setLastLabel(label);
    bump();
  }, []);

  const reset = useCallback((p: EditorProject) => {
    past.current = [];
    future.current = [];
    transientBase.current = null;
    setProject(p);
    setLastLabel(null);
    bump();
  }, []);

  const undo = useCallback(() => {
    setProject((prev) => {
      const prevState = past.current[past.current.length - 1];
      if (!prevState) return prev;
      past.current = past.current.slice(0, -1);
      future.current = [...future.current, prev].slice(-MAX_HISTORY);
      return prevState;
    });
    bump();
  }, []);

  const redo = useCallback(() => {
    setProject((prev) => {
      const nextState = future.current[future.current.length - 1];
      if (!nextState) return prev;
      future.current = future.current.slice(0, -1);
      past.current = [...past.current, prev].slice(-MAX_HISTORY);
      return nextState;
    });
    bump();
  }, []);

  // Debounced autosave
  useEffect(() => {
    const t = window.setTimeout(() => saveDraft(project), AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [project]);

  void stamp;
  return {
    project,
    update,
    updateTransient,
    commitTransient,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    lastLabel,
  };
}