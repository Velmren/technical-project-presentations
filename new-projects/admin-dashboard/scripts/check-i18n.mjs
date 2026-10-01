// Checks that both dictionaries have the same keys and that every Russian plural has all four forms.
// TypeScript already enforces the key set; this also catches plural objects written as plain strings and missing forms.
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "orbit-i18n-"));
const outfile = join(dir, "dicts.mjs");
await build({ stdin: { contents: 'export { en } from "./src/i18n/en"; export { ru } from "./src/i18n/ru";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", outfile, logLevel: "silent" });
const { en, ru } = await import(pathToFileURL(outfile).href);
rmSync(dir, { recursive: true, force: true });

const problems = [];
const isPlural = (v) => v && typeof v === "object" && "other" in v && "one" in v;
function walk(a, b, path) {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const here = path ? `${path}.${key}` : key;
    const x = a[key];
    const y = b[key];
    if (x === undefined || y === undefined) problems.push(`${here}: missing in ${x === undefined ? "en" : "ru"}`);
    else if (isPlural(x) || isPlural(y)) {
      if (!isPlural(x) || !isPlural(y)) problems.push(`${here}: plural in one language only`);
      else for (const form of ["one", "few", "many", "other"]) if (!y[form]) problems.push(`${here}: ru plural lacks "${form}"`);
    } else if (typeof x === "object" || typeof y === "object") {
      if (typeof x !== "object" || typeof y !== "object") problems.push(`${here}: shape differs`);
      else walk(x, y, here);
    } else if (!String(y).trim()) problems.push(`${here}: empty ru text`);
    else {
      const px = [...String(x).matchAll(/\{(\w+)/g)].map((m) => m[1]).sort().join();
      const py = [...String(y).matchAll(/\{(\w+)/g)].map((m) => m[1]).sort().join();
      if (px !== py) problems.push(`${here}: placeholders differ (${px} / ${py})`);
    }
  }
}
walk(en, ru, "");
if (problems.length) {
  console.log(problems.join("\n"));
  process.exit(1);
}
console.log("i18n: dictionaries match, plurals complete");
