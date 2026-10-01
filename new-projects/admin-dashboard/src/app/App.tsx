import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../data/store";
import { Landing } from "../features/landing/Landing";
import { MotionPreferenceProvider, useReduced } from "../motion/MotionPreference";
import { duration, ease } from "../motion/tokens";
import { useRoute } from "./router";
import { Workspace } from "./Shell";

export function App() {
  const route = useRoute();
  const { db } = useStore();
  const home = route.section === "home";
  return (
    <MotionPreferenceProvider preference={db?.settings.motion ?? "system"}>
      <Root>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={home ? "landing" : "workspace"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: duration.slow, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.in } }}
          >
            {home ? <Landing /> : <Workspace route={route} />}
          </motion.div>
        </AnimatePresence>
      </Root>
    </MotionPreferenceProvider>
  );
}

// CSS-only loops (orbits, pulses, shimmer) read this flag, so the workspace setting stops them too.
function Root({ children }: { children: React.ReactNode }) {
  const reduced = useReduced();
  return (
    <div className="o-root" data-reduced={reduced ? "true" : undefined}>
      {children}
    </div>
  );
}
