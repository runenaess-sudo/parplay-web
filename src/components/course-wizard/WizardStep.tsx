"use client";

import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

export const WizardStepContext = createContext<{
  scope: string;
  register: (save: () => Promise<unknown>) => () => void;
} | null>(null);

// Existing standalone forms behave as before outside the wizard.
export function useWizardSave(save: () => Promise<unknown>) {
  const context = useContext(WizardStepContext);
  const latest = useRef(save);
  useEffect(() => { latest.current = save; });
  useEffect(() => context?.register(() => latest.current()), [context]);
}

export function useWizardDraft<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>, () => void] {
  const context = useContext(WizardStepContext);
  const baseline = useRef(JSON.stringify(initial));
  const [value, setValue] = useState<T>(() => {
    if (context && typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(`${context.scope}:${key}`);
        if (raw) return JSON.parse(raw) as T;
      } catch { /* Keep server values if browser storage is unavailable. */ }
    }
    return initial;
  });
  useEffect(() => {
    if (context) {
      try {
        if (JSON.stringify(value) === baseline.current) sessionStorage.removeItem(`${context.scope}:${key}`);
        else sessionStorage.setItem(`${context.scope}:${key}`, JSON.stringify(value));
      } catch { /* Mounted state still preserves navigation. */ }
    }
  }, [context, key, value]);
  return [value, setValue, () => {
    baseline.current = JSON.stringify(value);
    try { if (context) sessionStorage.removeItem(`${context.scope}:${key}`); } catch { /* Optional cache. */ }
  }];
}
