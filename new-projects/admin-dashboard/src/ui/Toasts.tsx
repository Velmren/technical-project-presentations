import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { forwardRef, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore, useToasts, type Toast } from "../data/store";
import { useI18n } from "../i18n";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease, spring } from "../motion/tokens";
import { cx } from "./Button";

const lifetime = 5200;

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  const { undo } = useStore();
  const latest = useRef<Toast | undefined>(undefined);
  latest.current = [...toasts].reverse().find((toast) => toast.undo);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const toast = latest.current;
      if (!toast?.undo) return;
      event.preventDefault();
      undo(toast.undo);
      dismiss(toast.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, dismiss]);
  return createPortal(
    <div className="ui-toasts" aria-live="polite" aria-relevant="additions">
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

const ToastItem = forwardRef<HTMLDivElement, { toast: Toast }>(function ToastItem({ toast }, forwarded) {
  const { dismiss } = useToasts();
  const { undo } = useStore();
  const { t, tx } = useI18n();
  const reduced = useReduced();
  const progress = useMotionValue(1);
  const paused = useRef(false);
  const control = useRef<ReturnType<typeof animate> | null>(null);

  // The bar shrinks with the remaining time; hovering or focusing the toast pauses it.
  useEffect(() => {
    control.current = animate(progress, 0, { duration: lifetime / 1000, ease: "linear", onComplete: () => dismiss(toast.id) });
    return () => control.current?.stop();
  }, [dismiss, progress, toast.id]);
  const pause = () => {
    if (paused.current) return;
    paused.current = true;
    control.current?.pause();
  };
  const resume = () => {
    paused.current = false;
    control.current?.play();
  };

  const Icon = toast.kind === "error" ? AlertCircle : toast.kind === "info" ? Info : CheckCircle2;
  return (
    <motion.div
      ref={forwarded}
      layout={!reduced}
      role={toast.kind === "error" ? "alert" : "status"}
      className={cx("ui-toast", `ui-toast--${toast.kind}`)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: 40, transition: { duration: duration.fast, ease: ease.in } }}
      transition={spring.pop}
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
      drag={reduced ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.1, right: 0.8 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 90 || info.velocity.x > 500) dismiss(toast.id);
      }}
    >
      <Icon className="ui-toast__icon" aria-hidden="true" />
      <p className="ui-toast__text">{tx(toast.text)}</p>
      {toast.undo && (
        <button
          type="button"
          className="ui-toast__undo"
          onClick={() => {
            undo(toast.undo!);
            dismiss(toast.id);
          }}
        >
          {t("common.undo")}
        </button>
      )}
      <button type="button" className="ui-toast__close" aria-label={t("common.close")} onClick={() => dismiss(toast.id)}>
        <X />
      </button>
      <motion.span className="ui-toast__progress" style={{ scaleX: progress }} aria-hidden="true" />
    </motion.div>
  );
});
