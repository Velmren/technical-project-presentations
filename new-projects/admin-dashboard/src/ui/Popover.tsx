import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease, spring } from "../motion/tokens";
import { cx } from "./Button";

type Placement = "bottom-end" | "bottom-start" | "top-start" | "top-end";

/**
 * A non-modal panel anchored to its trigger. Closes on Escape, outside click
 * and focus leaving it; returns focus to the trigger when closed with the keyboard.
 */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  placement = "bottom-end",
  label,
  className,
  role = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  placement?: Placement;
  label: string;
  className?: string;
  role?: "dialog" | "menu";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReduced();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.current?.contains(target)) return;
      closeRef.current();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        anchor.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], [role=menuitem], button, a[href]");
    requestAnimationFrame(() => first?.focus({ preventScroll: true }));
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchor]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (role !== "menu" || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const vertical = placement.startsWith("top") ? 1 : -1;
  const origin = `${placement.endsWith("end") ? "right" : "left"} ${placement.startsWith("top") ? "bottom" : "top"}`;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role={role}
          aria-label={label}
          className={cx("ui-popover", `ui-popover--${placement}`, className)}
          style={{ transformOrigin: origin }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 * vertical }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4 * vertical, transition: { duration: duration.fast, ease: ease.in } }}
          transition={spring.pop}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (next && !ref.current?.contains(next) && !anchor.current?.contains(next)) closeRef.current();
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
