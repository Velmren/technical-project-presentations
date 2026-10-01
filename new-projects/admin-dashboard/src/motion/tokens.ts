import type { Transition, Variants } from "motion/react";

// One vocabulary of movement for the whole product.
// Entrances decelerate, exits accelerate and are shorter, springs carry things the hand moves.

export const duration = {
  instant: 0.1, // press feedback
  fast: 0.16, // hover, small fades, exits
  base: 0.24, // content swaps, popovers
  slow: 0.36, // panels, sheets
  chart: 0.9, // first drawing of a chart
  counter: 0.8, // numbers counting up
} as const;

export const ease = {
  out: [0.16, 1, 0.3, 1] as const, // entrances (expo-out)
  in: [0.4, 0, 1, 1] as const, // exits
  inOut: [0.65, 0, 0.35, 1] as const, // morphs between two states
  standard: [0.2, 0, 0, 1] as const,
};

export const spring = {
  // Indicators that follow the selection: nav, tabs, segmented controls.
  indicator: { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as Transition,
  // Layout reflow of rows and cards when lists are filtered or sorted.
  layout: { type: "spring", visualDuration: 0.32, bounce: 0.08 } as Transition,
  // Sheets and drawers: no overshoot, but a physical settle.
  panel: { type: "spring", visualDuration: 0.34, bounce: 0 } as Transition,
  // Things that pop in: toasts, badges, the bulk action bar.
  pop: { type: "spring", visualDuration: 0.3, bounce: 0.22 } as Transition,
  // Dragged cards and anything following the pointer.
  drag: { type: "spring", stiffness: 600, damping: 45 } as Transition,
};

export const distance = { list: 8, panel: 16, hero: 28 } as const;

export const stagger = { list: 0.035, cards: 0.06, max: 0.3 } as const;

/** Delay for the n-th element of a list, capped so long lists never wait. */
export const staggerDelay = (index: number, step: number = stagger.list) => Math.min(index * step, stagger.max);

/**
 * Exit for a list row: it fades first, then gives its height back, so nothing slides over it while its text is visible.
 */
export const foldAway = {
  opacity: 0,
  height: 0,
  minHeight: 0,
  overflow: "hidden",
  transition: {
    opacity: { duration: duration.fast, ease: ease.in },
    height: { duration: duration.base, ease: ease.inOut, delay: duration.fast * 0.6 },
    minHeight: { duration: duration.base, ease: ease.inOut, delay: duration.fast * 0.6 },
  },
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: distance.list },
  show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base, ease: ease.out } },
};
