import { cx } from "../ui/Button";

// The logotype. The ring with a body travelling along it stands for the letter O, RBIT follows.
// Letters sit on a 5-unit grid: at the default 20 px cap height every stem lands on whole pixels.
// The same outlines ship as files in static/brand.
const RING =
  "M101.882,34.676A52.5,52.5 0 1 1 78.628,6.964A19.5,19.5 0 0 0 65.257,23.699A31.5,31.5 0 1 0 83.079,44.938A19.5,19.5 0 0 0 101.882,34.676Z";
const BODY = "M72.174,25.503A12.5,12.5 0 1 1 97.174,25.503A12.5,12.5 0 1 1 72.174,25.503Z";
const LETTERS =
  "M120,2.5H156.25A28.75,28.75 0 0 1 173.466,54.276L190,102.5H168.857L154.286,60H140V102.5H120ZM140,20V42.5H156.25A8.75,11.25 0 0 0 156.25,20Z" +
  "M200,2.5H232.25A28.75,28.75 0 0 1 254.381,49.601A30,30 0 0 1 235,102.5H200ZM220,20V42.5H232.25A8.75,11.25 0 0 0 232.25,20ZM220,60V85H235A10,12.5 0 0 0 235,60Z" +
  "M280,2.5h20v100h-20Z" +
  "M310,2.5H380V20H355V102.5H335V20H310Z";

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <svg className={cx("wordmark", compact && "is-compact")} viewBox="0 -2.5 380 110" role="img" aria-label="ORBIT">
      <path d={RING} />
      <path className="wordmark__body" d={BODY} />
      <path d={LETTERS} />
    </svg>
  );
}
