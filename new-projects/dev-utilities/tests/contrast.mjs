import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { transform } from "esbuild";
import { resolve } from "node:path";
const { code } = await transform(await readFile("src/color-utils.ts", "utf8"), {
  loader: "ts",
  format: "esm",
});
const c = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);

// Tokens are read from the stylesheet itself, so the check follows the theme.
const css = await readFile("src/theme.css", "utf8");
function tokens(selector) {
  const start = css.indexOf(selector + " {");
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [
      m[1],
      m[2],
    ]),
  );
}
const light = tokens(":root");
const dark = { ...light, ...tokens(':root[data-theme="dark"]') };

const pairs = [
  ["Main text on panes", "text", "surface", 4.5],
  ["Main text on chrome", "text", "chrome", 4.5],
  ["Secondary text on panes", "text-2", "surface", 4.5],
  ["Secondary text on chrome", "text-2", "chrome", 4.5],
  ["Tertiary text on panes", "text-3", "surface", 4.5],
  ["Tertiary text on chrome", "text-3", "chrome", 4.5],
  ["Text on selected row", "text", "accent-soft", 4.5],
  ["Link and accent text", "accent-text", "surface", 4.5],
  ["Primary button label", "on-accent", "accent", 4.5],
  ["Toast text", "on-ink", "ink", 4.5],
  ["Active tab marker", "accent", "chrome", 3],
  ["Syntax: keys", "syn-key", "surface", 4.5],
  ["Syntax: strings", "syn-string", "surface", 4.5],
  ["Syntax: numbers", "syn-number", "surface", 4.5],
  ["Syntax: literals", "syn-literal", "surface", 4.5],
  ["Syntax: punctuation", "syn-punct", "surface", 4.5],
  ["Valid status", "ok", "chrome", 4.5],
  ["Warning status", "warn", "chrome", 4.5],
  ["Error status", "err", "chrome", 4.5],
  ["Error text on error notice", "text", "err-soft", 4.5],
  ["Input border", "control-edge", "surface", 3],
  ["Focus ring on panes", "focus", "surface", 3],
  ["Focus ring on chrome", "focus", "chrome", 3],
];

const results = [];
for (const [theme, set] of [
  ["light", light],
  ["dark", dark],
]) {
  for (const [name, fg, bg, minimum] of pairs) {
    const parse = (hex) => {
      const p = c.parseColor(hex);
      if (!p.ok) throw Error(`${theme} ${name}: ${hex}`);
      return p.color;
    };
    assert.ok(set[fg] && set[bg], `${theme}: missing token ${fg} or ${bg}`);
    results.push({
      theme,
      name,
      foreground: `${fg} ${set[fg]}`,
      background: `${bg} ${set[bg]}`,
      ratio:
        Math.round(c.contrastRatio(parse(set[fg]), parse(set[bg])) * 100) / 100,
      minimum,
    });
  }
}
const failed = results.filter((r) => r.ratio < r.minimum);
const out = resolve(process.env.DU_ARTIFACTS || "artifacts");
await mkdir(out, { recursive: true });
await writeFile(
  out + "/contrast-checks.json",
  JSON.stringify(
    {
      passed: failed.length === 0,
      scope:
        "Interface token pairs in both themes, WCAG 2 ratios. Targeted check, not a full accessibility audit.",
      results,
    },
    null,
    2,
  ),
);
assert.deepEqual(failed, [], "Pairs below the minimum");
console.log(
  `Interface contrast: ${results.length} pairs passed (light and dark)`,
);
