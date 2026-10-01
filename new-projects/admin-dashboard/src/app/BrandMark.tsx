import { cx } from "../ui/Button";

export function BrandMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span className={cx("brand-mark", className)} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <path d="m16 4 12 12-12 12L4 16Z" fill="#20bbfb" />
        <path d="m16 4 12 12H16Z" fill="#98e8ff" />
        <path d="m16 16 12 0-12 12Z" fill="#0787ed" />
        <path d="M4 16h12V4Z" fill="#49d8ff" />
      </svg>
    </span>
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className={cx("wordmark", compact && "is-compact")}>
      <BrandMark size={compact ? 28 : 32} />
      <span className="wordmark__text">ORBIT</span>
    </span>
  );
}
