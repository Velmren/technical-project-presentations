import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const temporary = await mkdtemp(join(tmpdir(), "du-oklch-"));
let checks = 0;
const ok = (value, message) => {
  assert.ok(value, message);
  checks++;
};
const near = (a, b, tolerance, message) =>
  ok(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);
try {
  await build({
    entryPoints: ["src/color/perceptual.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: join(temporary, "p.cjs"),
    logLevel: "silent",
  });
  const p = createRequire(import.meta.url)(join(temporary, "p.cjs"));
  const rgb = (r, g, b, a = 1) => ({ r, g, b, a });

  // Reference values from CSS Color 4: white, black, sRGB red.
  assert.equal(p.formatOklch(rgb(255, 255, 255)), "oklch(100% 0 0)");
  assert.equal(p.formatOklch(rgb(0, 0, 0)), "oklch(0% 0 0)");
  assert.equal(p.formatOklab(rgb(255, 255, 255)), "oklab(100% 0 0)");
  checks += 3;
  const red = p.oklchOf(rgb(255, 0, 0));
  near(red.l, 0.628, 0.001, "red L");
  near(red.c, 0.2577, 0.001, "red C");
  near(red.h, 29.23, 0.05, "red H");
  ok(p.formatOklch(rgb(255, 0, 0, 0.5)).endsWith(" / 50%)"), "alpha suffix");

  // Round trips through both text forms stay within half a channel step.
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) {
    const c = rgb(
      Math.round(random() * 255),
      Math.round(random() * 255),
      Math.round(random() * 255),
    );
    for (const [format, kind] of [
      [p.formatOklch, "oklch"],
      [p.formatOklab, "oklab"],
    ]) {
      const back = p.parsePerceptual(format(c), kind);
      assert.ok(back.ok, format(c));
      for (const ch of ["r", "g", "b"])
        assert.ok(Math.abs(back.color[ch] - c[ch]) < 0.6, `${format(c)} ${ch}`);
    }
  }
  checks++;

  // Out-of-gamut input is reported and mapped into sRGB.
  const vivid = p.parsePerceptual("oklch(70% 0.4 145)", "oklch");
  ok(
    vivid.ok && !vivid.inSrgb && !vivid.inP3,
    "vivid green outside both gamuts",
  );
  ok(
    ["r", "g", "b"].every(
      (ch) => vivid.color[ch] >= 0 && vivid.color[ch] <= 255,
    ),
    "mapped into range",
  );
  const p3only = p.parsePerceptual("oklch(65% 0.28 30)", "oklch");
  ok(
    p3only.ok && !p3only.inSrgb && p3only.inP3,
    "red beyond sRGB but inside P3",
  );
  ok(!p.parsePerceptual("rgb(1 2 3)", "oklch").ok, "wrong syntax rejected");
  ok(!p.parsePerceptual("oklch(banana)", "oklch").ok, "garbage rejected");
  ok(
    p.parsePerceptual("oklab(50% 0.1 -0.1 / 40%)", "oklab").color.a === 0.4,
    "oklab alpha",
  );

  // Perceptual scale: eleven steps, lightness falls evenly, colors stay valid.
  for (const base of [
    rgb(47, 111, 98),
    rgb(217, 87, 59),
    rgb(128, 128, 128),
    rgb(10, 30, 250),
  ]) {
    const scale = p.perceptualScale(base);
    ok(scale.length === 11, "eleven steps");
    const ls = scale.map((s) => p.oklchOf(s.color).l);
    ok(
      ls.every((l, i) => i === 0 || l < ls[i - 1]),
      "lightness decreases",
    );
    ok(
      scale.every((s, i) => Math.abs(ls[i] - s.lightness) < 0.02),
      "lightness near targets",
    );
    ok(
      scale.every((s) =>
        ["r", "g", "b"].every((ch) => s.color[ch] >= 0 && s.color[ch] <= 255),
      ),
      "in range",
    );
  }

  // Vision simulation.
  const grey = p.simulate(rgb(217, 87, 59), "achromatopsia");
  ok(
    Math.abs(grey.r - grey.g) < 1 && Math.abs(grey.g - grey.b) < 1,
    "achromatopsia is grey",
  );
  const prot = p.simulate(rgb(255, 0, 0), "protanopia");
  ok(prot.r < 200 && prot.g > 20, "protanopia shifts red");
  const same = p.simulate(rgb(1, 2, 3, 0.5), "normal");
  ok(same.r === 1 && same.a === 0.5, "normal is identity");
  ok(p.simulate(rgb(255, 0, 0, 0.3), "tritanopia").a === 0.3, "alpha kept");
  // Greys have no hue: their scale stays neutral instead of turning pink.
  for (const grey of [rgb(128, 128, 128), rgb(0, 0, 0), rgb(255, 255, 255)])
    for (const stop of p.perceptualScale(grey))
      ok(
        Math.abs(stop.color.r - stop.color.g) < 1e-6 &&
          Math.abs(stop.color.g - stop.color.b) < 1e-6,
        "neutral " + stop.label,
      );

  console.log(`Perceptual color: ${checks} checks passed`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
