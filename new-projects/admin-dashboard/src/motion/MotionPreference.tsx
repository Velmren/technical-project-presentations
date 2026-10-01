import { MotionConfig, useReducedMotion } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";
import type { MotionPreference } from "../data/types";
import { duration, ease } from "./tokens";

const ReducedContext = createContext(false);

/**
 * Resolves the system setting and the workspace preference into one flag.
 * "system" follows prefers-reduced-motion; "reduced" always reduces; "full" never does.
 * Reduced motion keeps opacity fades but removes movement, layout animation and counting.
 */
export function MotionPreferenceProvider({ preference, children }: { preference: MotionPreference; children: ReactNode }) {
  const system = useReducedMotion() ?? false;
  const reduced = preference === "reduced" || (preference === "system" && system);
  return (
    <ReducedContext.Provider value={reduced}>
      <MotionConfig reducedMotion={reduced ? "always" : "never"} transition={{ duration: duration.base, ease: ease.out }}>
        {children}
      </MotionConfig>
    </ReducedContext.Provider>
  );
}

export function useReduced() {
  return useContext(ReducedContext);
}
