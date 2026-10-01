import { useEffect, useState } from "react";
import type { Period } from "../../data/types";

const key = "orbit-period";
export const periods: Period[] = [7, 30, 90, 365];

/** The reporting period is a personal view preference, remembered in this browser. */
export function usePeriod(fallback: Period) {
  const [period, setPeriod] = useState<Period>(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return (periods as number[]).includes(saved) ? (saved as Period) : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, String(period));
    } catch {
      /* Not remembered, still applied. */
    }
  }, [period]);
  return [period, setPeriod] as const;
}
