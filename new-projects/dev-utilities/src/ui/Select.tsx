import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  id?: string;
  disabled?: boolean;
  className?: string;
};

const GAP = 4;
const EDGE = 8;
const PAGE = 10;

// Select-only combobox (WAI-ARIA APG): focus stays on the button while the
// listbox is open, and the highlighted option is exposed through
// aria-activedescendant. The list is portalled to the body so no pane or
// tool bar clips it, and it is placed to stay inside the viewport.
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  id,
  disabled,
  className = "",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<CSSProperties>({});
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const optionId = (i: number) => `${listId}-${i}`;

  function show(index = current) {
    setActive(index);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    // A new search starts after the list closes.
    typed.current.text = "";
  }
  function commit(index: number) {
    close();
    const next = options[index];
    if (next && next.value !== value) onChange(next.value);
  }

  // Place the list below the button, or above when there is more room there,
  // and keep it inside the viewport horizontally.
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const anchor = button.current?.getBoundingClientRect();
      const popup = list.current;
      if (!anchor || !popup) return;
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const below = height - anchor.bottom - GAP - EDGE;
      const above = anchor.top - GAP - EDGE;
      const needed = popup.scrollHeight + 2;
      const up = needed > below && above > below;
      const listWidth = Math.min(
        Math.max(popup.offsetWidth, anchor.width),
        width - 2 * EDGE,
      );
      setPlace({
        minWidth: anchor.width,
        maxWidth: width - 2 * EDGE,
        maxHeight: Math.max(up ? above : below, 120),
        left: Math.max(EDGE, Math.min(anchor.left, width - EDGE - listWidth)),
        ...(up
          ? { bottom: height - anchor.top + GAP }
          : { top: anchor.bottom + GAP }),
      });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector(`[id="${optionId(active)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!list.current?.contains(target) && !button.current?.contains(target))
        close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  // Type-ahead: letters typed within half a second form one search; repeating
  // one letter steps through the options that start with it.
  function search(key: string) {
    const now = Date.now();
    const state = typed.current;
    state.text = now - state.at > 500 ? key : state.text + key;
    state.at = now;
    const query = state.text.toLocaleLowerCase();
    const repeated = [...query].every((c) => c === query[0]);
    const from = open ? active : current;
    const order = options.map((_, i) => (from + 1 + i) % options.length);
    const starts = (i: number, q: string) =>
      options[i].label.toLocaleLowerCase().startsWith(q);
    const found =
      order.find((i) => starts(i, query)) ??
      (repeated ? order.find((i) => starts(i, query[0])) : undefined);
    if (found !== undefined) show(found);
    else if (!open) show();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    const key = e.key;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) show();
      else if (key === "Home") show(0);
      else if (key === "End") show(last);
      else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
        search(key);
      else return;
      e.preventDefault();
      return;
    }
    if (key === "ArrowDown" && e.altKey) commit(active);
    else if (key === "ArrowUp" && e.altKey) commit(active);
    else if (key === "ArrowDown") setActive(Math.min(active + 1, last));
    else if (key === "ArrowUp") setActive(Math.max(active - 1, 0));
    else if (key === "Home") setActive(0);
    else if (key === "End") setActive(last);
    else if (key === "PageDown") setActive(Math.min(active + PAGE, last));
    else if (key === "PageUp") setActive(Math.max(active - PAGE, 0));
    else if (key === "Enter" || key === " ") commit(active);
    else if (key === "Escape") close();
    else if (key === "Tab") {
      // Tab keeps the highlighted option and moves on, as in the APG pattern.
      commit(active);
      return;
    } else if (key.length === 1 && !e.ctrlKey && !e.metaKey) search(key);
    else return;
    e.preventDefault();
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        id={id}
        role="combobox"
        className={`select ${className}`.trim()}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
        // Space would otherwise click on key up and reopen a list it just closed.
        onKeyUp={(e) => e.key === " " && e.preventDefault()}
        onBlur={() => close()}
      >
        {/* Every label sits in one grid cell, so the button is as wide as the
            longest option and does not jump when the value changes. */}
        <span className="select-value">
          {options.map((o, i) => (
            <span
              key={o.value}
              className={i === current ? undefined : "select-ghost"}
              aria-hidden={i === current ? undefined : true}
            >
              {o.label}
            </span>
          ))}
        </span>
        <ChevronDown
          className="select-chevron"
          size={14}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-label={label}
            className="select-list"
            style={place}
            // Keeps focus on the button, so the list does not close on blur.
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((o, i) => (
              <div
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={i === current}
                className={"select-option" + (i === active ? " active" : "")}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => {
                  commit(i);
                  button.current?.focus();
                }}
              >
                <span className="select-check" aria-hidden="true">
                  {i === current && <Check size={14} strokeWidth={2} />}
                </span>
                {o.label}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
