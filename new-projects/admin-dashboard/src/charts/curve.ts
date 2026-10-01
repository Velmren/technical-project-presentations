// Monotone cubic curves: the line passes through every value without inventing
// peaks or dips between neighbouring points.

export type Curve = { x: number[]; y: number[]; slope: number[] };

export function monotone(values: number[]): Curve {
  if (values.length < 2) {
    const v = values[0] ?? 0;
    return { x: [0, 1], y: [v, v], slope: [0, 0] };
  }
  const n = values.length;
  const x = values.map((_, i) => i / (n - 1));
  const delta = new Array<number>(n - 1);
  const slope = new Array<number>(n);
  for (let i = 0; i < n - 1; i++) delta[i] = (values[i + 1] - values[i]) * (n - 1);
  slope[0] = delta[0];
  slope[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) slope[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (2 * delta[i - 1] * delta[i]) / (delta[i - 1] + delta[i]);
  return { x, y: values.slice(), slope };
}

export function sample(c: Curve, x: number) {
  let i = 0;
  while (i < c.x.length - 2 && c.x[i + 1] < x) i++;
  const h = c.x[i + 1] - c.x[i];
  const u = h ? (x - c.x[i]) / h : 0;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * c.y[i] + (u3 - 2 * u2 + u) * h * c.slope[i] + (-2 * u3 + 3 * u2) * c.y[i + 1] + (u3 - u2) * h * c.slope[i + 1];
}

function derivative(c: Curve, x: number) {
  let i = 0;
  while (i < c.x.length - 2 && c.x[i + 1] < x) i++;
  const h = c.x[i + 1] - c.x[i];
  const u = h ? (x - c.x[i]) / h : 0;
  const u2 = u * u;
  return ((6 * u2 - 6 * u) * c.y[i] + (-6 * u2 + 6 * u) * c.y[i + 1]) / (h || 1) + (3 * u2 - 4 * u + 1) * c.slope[i] + (3 * u2 - 2 * u) * c.slope[i + 1];
}

/** Re-expresses a curve on new knots without changing its shape, so two curves can be blended point by point. */
export function remesh(c: Curve, x: number[]): Curve {
  return { x, y: x.map((v) => sample(c, v)), slope: x.map((v) => derivative(c, v)) };
}

export function blend(a: Curve, b: Curve, t: number, into: Curve) {
  for (let i = 0; i < into.x.length; i++) {
    into.y[i] = a.y[i] + (b.y[i] - a.y[i]) * t;
    into.slope[i] = a.slope[i] + (b.slope[i] - a.slope[i]) * t;
  }
  return into;
}

const r = (n: number) => Math.round(n * 100) / 100;

export function toPath(c: Curve, left: number, right: number) {
  const width = right - left;
  let d = `M${r(left + c.x[0] * width)},${r(c.y[0])}`;
  for (let i = 1; i < c.x.length; i++) {
    const h = c.x[i] - c.x[i - 1];
    const x0 = left + c.x[i - 1] * width;
    const x1 = left + c.x[i] * width;
    d += `C${r(x0 + (h * width) / 3)},${r(c.y[i - 1] + (h * c.slope[i - 1]) / 3)} ${r(x1 - (h * width) / 3)},${r(c.y[i] - (h * c.slope[i]) / 3)} ${r(x1)},${r(c.y[i])}`;
  }
  return d;
}

export function niceScale(max: number, min = 0, ticks = 4) {
  const span = Math.max(max - min, 1);
  const raw = span / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / magnitude;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10) * magnitude;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const values: number[] = [];
  for (let v = lo; v <= hi + step * 0.01; v += step) values.push(Math.round(v * 1000) / 1000);
  return { min: lo, max: hi, values };
}
