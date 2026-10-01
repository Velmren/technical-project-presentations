import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

export type MenuItem = {
  id: string;
  label: string;
  hint?: string;
  checked?: boolean;
  onSelect: () => void;
};

type Props = {
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
  // Radio menus announce the checked item; action menus do not.
  kind?: "action" | "radio";
};

export function Menu({
  label,
  trigger,
  items,
  align = "start",
  className = "btn",
  kind = "action",
}: Props) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const first =
      list.current?.querySelector<HTMLElement>('[aria-checked="true"]') ||
      list.current?.querySelector<HTMLElement>("[role^=menuitem]");
    first?.focus();
    const outside = (e: PointerEvent) => {
      if (
        !list.current?.contains(e.target as Node) &&
        !button.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    const entries = Array.from(
      list.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") || [],
    );
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) =>
      entries[(i + entries.length) % entries.length]?.focus();
    if (e.key === "ArrowDown") focus(index + 1);
    else if (e.key === "ArrowUp") focus(index - 1);
    else if (e.key === "Home") focus(0);
    else if (e.key === "End") focus(entries.length - 1);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") close(false);
    else return;
    if (e.key !== "Tab") e.preventDefault();
  }

  return (
    <div className="menu">
      <button
        ref={button}
        type="button"
        className={className}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={list}
          id={id}
          role="menu"
          aria-label={label}
          className={`menu-list menu-${align}`}
          onKeyDown={onListKey}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role={kind === "radio" ? "menuitemradio" : "menuitem"}
              aria-checked={kind === "radio" ? !!item.checked : undefined}
              tabIndex={-1}
              className="menu-item"
              onClick={() => {
                close();
                item.onSelect();
              }}
            >
              <span className="menu-check" aria-hidden="true">
                {kind === "radio" && item.checked && <Check size={14} />}
              </span>
              <span className="menu-label">
                {item.label}
                {item.hint && <small className="mono">{item.hint}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
