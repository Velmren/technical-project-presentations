import { Search, X } from "lucide-react";
import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useI18n } from "../i18n";
import { Kbd } from "./Badge";
import { Button, cx } from "./Button";

export type Option = { value: string; label: string };

/** Compact native select for toolbars: works with the keyboard, screen readers and phone pickers. */
export function Select({ label, value, onChange, options, className }: { label: string; value: string; onChange: (value: string) => void; options: Option[]; className?: string }) {
  return (
    <label className={cx("ui-select", className)}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** List search. "/" anywhere on the page focuses it. */
export const SearchField = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void; placeholder: string; className?: string }>(function SearchField({ value, onChange, placeholder, className }, forwarded) {
  const { t } = useI18n();
  const local = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = () => local.current?.focus();
    window.addEventListener("orbit:focus-search", focus);
    return () => window.removeEventListener("orbit:focus-search", focus);
  }, []);
  return (
    <label className={cx("search-field", className)}>
      <Search />
      <input
        ref={(node) => {
          local.current = node;
          if (typeof forwarded === "function") forwarded(node);
          else if (forwarded) forwarded.current = node;
        }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <button type="button" className="search-field__clear" aria-label={t("common.clear")} onClick={() => onChange("")}>
          <X />
        </button>
      ) : (
        <Kbd>/</Kbd>
      )}
    </label>
  );
});

type FieldProps = { label: string; error?: string; hint?: string; children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode; className?: string };

/** Label, control and message kept together; the error explains how to fix it. */
export function Field({ label, error, hint, children, className }: FieldProps) {
  const id = useId();
  const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx("field", error && "has-error", className)}>
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": described })}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} {...props} className={cx("ui-input", props.className)} />;
});

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx("ui-input ui-textarea", props.className)} />;
}

export function NativeSelect({ options, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: Option[] }) {
  return (
    <select {...props} className={cx("ui-input ui-input--select", props.className)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Rows-per-page and previous/next, with the visible range spelled out. */
export function Pager({ page, pages, total, size, sizes, onPage, onSize }: { page: number; pages: number; total: number; size: number; sizes: readonly number[]; onPage: (page: number) => void; onSize: (size: number) => void }) {
  const { t, number } = useI18n();
  return (
    <footer className="pager">
      <p className="num">{t("common.range", { from: total ? number((page - 1) * size + 1) : "0", to: number(Math.min(page * size, total)), total: number(total) })}</p>
      <div className="pager__controls">
        <Select label={t("common.rows")} value={String(size)} onChange={(value) => onSize(Number(value))} options={sizes.map((value) => ({ value: String(value), label: t("common.rowsValue", { count: value }) }))} />
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("common.previousPage")}>
          ‹
        </Button>
        <span className="pager__page num">
          {page} / {pages}
        </span>
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t("common.nextPage")}>
          ›
        </Button>
      </div>
    </footer>
  );
}
