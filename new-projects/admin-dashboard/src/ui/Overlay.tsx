import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease, spring } from "../motion/tokens";
import { Button, cx } from "./Button";

const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const stack: HTMLElement[] = [];

function setInert(element: Element | null, value: boolean) {
  if (!element) return;
  if (value) element.setAttribute("inert", "");
  else element.removeAttribute("inert");
}

/**
 * Keeps focus inside the topmost overlay, makes everything underneath inert,
 * and returns focus to the element that opened it.
 */
function useOverlayFocus(ref: RefObject<HTMLElement | null>, open: boolean) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const opener = document.activeElement as HTMLElement | null;
    const app = document.getElementById("root");
    setInert(app, true);
    stack.at(-1) && setInert(stack.at(-1)!, true);
    stack.push(node);
    document.body.classList.add("o-modal-open");
    const first = node.querySelector<HTMLElement>("[data-autofocus]") ?? node.querySelector<HTMLElement>(focusable);
    requestAnimationFrame(() => (first ?? node).focus({ preventScroll: true }));
    return () => {
      const index = stack.indexOf(node);
      if (index >= 0) stack.splice(index, 1);
      const below = stack.at(-1);
      if (below) setInert(below, false);
      else {
        setInert(app, false);
        document.body.classList.remove("o-modal-open");
      }
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);

  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || stack.at(-1) !== node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(focusable)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, ref]);
}

function useEscape(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stack.at(-1) === ref.current) {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, ref]);
}

function useNarrow(query = "(max-width: 720px)") {
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== "undefined" && matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return narrow;
}

function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
};

/**
 * Detail panel. Slides in from the right on wide screens and rises as a sheet
 * on phones, where it can be dragged down to close.
 */
export function Drawer({ open, onClose, label, header, children, footer, width = 560 }: DrawerProps) {
  return (
    <Portal>
      <AnimatePresence>{open && <DrawerSurface onClose={onClose} label={label} header={header} footer={footer} width={width}>{children}</DrawerSurface>}</AnimatePresence>
    </Portal>
  );
}

function DrawerSurface({ onClose, label, header, children, footer, width }: Omit<DrawerProps, "open">) {
  const ref = useRef<HTMLDivElement>(null);
  const narrow = useNarrow();
  const reduced = useReduced();
  const drag = useDragControls();
  const { t } = useI18n();
  useOverlayFocus(ref, true);
  useEscape(true, ref, onClose);
  const hidden = reduced ? { opacity: 0 } : narrow ? { y: "100%" } : { x: 48, opacity: 0 };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };
  return (
    <div className="ui-overlay" data-kind="drawer">
      <motion.div className="ui-overlay__backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: duration.fast } }} transition={{ duration: duration.base }} />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cx("ui-drawer", narrow && "is-sheet")}
        style={narrow ? undefined : { width }}
        initial={hidden}
        animate={{ x: 0, y: 0, opacity: 1 }}
        exit={{ ...hidden, transition: { duration: duration.fast, ease: ease.in } }}
        transition={spring.panel}
        drag={narrow && !reduced ? "y" : false}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={onDragEnd}
      >
        {narrow && <div className="ui-drawer__grip" onPointerDown={(event) => drag.start(event)} aria-hidden="true" />}
        <header className="ui-drawer__header" onPointerDown={(event) => narrow && drag.start(event)}>
          <div className="ui-drawer__heading">{header}</div>
          <Button variant="ghost" iconOnly icon={<X />} aria-label={t("common.close")} onClick={onClose} className="ui-drawer__close" />
        </header>
        <div className="ui-drawer__body">{children}</div>
        {footer && <footer className="ui-drawer__footer">{footer}</footer>}
      </motion.div>
    </div>
  );
}

type DialogProps = { open: boolean; onClose: () => void; title: string; children: ReactNode; actions?: ReactNode; tone?: "default" | "danger"; icon?: ReactNode; wide?: boolean; className?: string };

export function Dialog({ open, onClose, ...rest }: DialogProps) {
  return (
    <Portal>
      <AnimatePresence>{open && <DialogSurface onClose={onClose} {...rest} />}</AnimatePresence>
    </Portal>
  );
}

function DialogSurface({ onClose, title, children, actions, tone = "default", icon, wide, className }: Omit<DialogProps, "open">) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReduced();
  const { t } = useI18n();
  useOverlayFocus(ref, true);
  useEscape(true, ref, onClose);
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 };
  return (
    <div className="ui-overlay" data-kind="dialog">
      <motion.div className="ui-overlay__backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: duration.fast } }} />
      <motion.div
        ref={ref}
        role={tone === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx("ui-dialog", wide && "is-wide", `ui-dialog--${tone}`, className)}
        initial={hidden}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ ...hidden, transition: { duration: duration.fast, ease: ease.in } }}
        transition={spring.pop}
      >
        <div className="ui-dialog__head">
          {icon && <span className="ui-dialog__icon">{icon}</span>}
          <h2 className="ui-dialog__title">{title}</h2>
          {!actions && <Button variant="ghost" iconOnly size="sm" icon={<X />} aria-label={t("common.close")} onClick={onClose} className="ui-dialog__close" />}
        </div>
        <div className="ui-dialog__body">{children}</div>
        {actions && <div className="ui-dialog__actions">{actions}</div>}
      </motion.div>
    </div>
  );
}

export { useNarrow };
