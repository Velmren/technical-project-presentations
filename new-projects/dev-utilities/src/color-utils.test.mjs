// Run from the project directory: node src/color-utils.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
const source = await readFile(
  new URL("./color-utils.ts", import.meta.url),
  "utf8",
);
const { code } = await transform(source, {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const c = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
let checks = 0;
const test = (name, run) => {
  run();
  checks++;
  console.log(`PASS ${name}`);
};
const close = (actual, expected, epsilon = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const parse = (input) => {
  const result = c.parseColor(input);
  assert.equal(result.ok, true, input);
  return result.color;
};

test("HEX short/full alpha forms and opaque RGB", () => {
  assert.equal(c.toHex(parse("#abc")), "#AABBCC");
  assert.equal(c.toHex(parse("#abcd")), "#AABBCCDD");
  assert.deepEqual(parse("#12345678"), { r: 18, g: 52, b: 86, a: 120 / 255 });
  assert.equal(c.toHex(parse("rgb(255 0 127)")), "#FF007F");
  assert.equal(c.toHex(parse("rgba(100%, 0%, 50%, 50%)")), "#FF008080");
});
test("Modern RGB/HSL, hue units, negative/wrapped hue and zero alpha", () => {
  assert.equal(c.toHex(parse("rgb(100% 0% 0% / .5)")), "#FF000080");
  assert.equal(c.toHex(parse("hsl(1turn 100% 50%)")), "#FF0000");
  assert.equal(c.toHex(parse("hsl(-120deg 100% 50% / 0)")), "#0000FF00");
  assert.equal(c.toHex(parse("hsl(200grad 100% 50%)")), "#00FFFF");
  assert.equal(c.toHex(parse("hsl(3.141592653589793rad 100% 50%)")), "#00FFFF");
});
test("Malformed and out-of-range inputs are rejected", () => {
  for (const invalid of [
    "",
    "#12",
    "#ggg",
    "red",
    "var(--red)",
    "rgb(256 0 0)",
    "rgb(-1 0 0)",
    "rgb(0 0 0 / 101%)",
    "rgb(0, 0, 0 / 1)",
    "rgb(0, 0, 0, NaN)",
    "hsl(0 101% 50%)",
    "hsl(0 50 50%)",
    "hsl(Infinity 100% 50%)",
    "hsl(0 50% 50%);background:url(x)",
    "rgb(0 0 0 / .2 / .4)",
  ])
    assert.equal(c.parseColor(invalid).ok, false, invalid);
  assert.equal(c.parseColor("#FFFFFF", "hsl").ok, false);
  assert.equal(c.parseColor("rgb(0 0 0)", "hex").ok, false);
  assert.equal(c.parseColor("rgb(50%, 0, 0)").ok, false);
});
test("HSL primary vectors and gray hue memory", () => {
  for (const [hue, expected] of [
    [0, "#FF0000"],
    [60, "#FFFF00"],
    [120, "#00FF00"],
    [180, "#00FFFF"],
    [240, "#0000FF"],
    [300, "#FF00FF"],
  ]) {
    const color = c.hslToColor({ h: hue, s: 100, l: 50, a: 0.4 });
    assert.equal(c.toHex({ ...color, a: 1 }), expected);
    close(c.colorToHsl(color).h, hue);
  }
  close(c.colorToHsl(parse("#808080"), 234).h, 234);
  close(c.colorToHsl(parse("#FFFFFF")).l, 100);
  close(c.colorToHsl(parse("#000000")).l, 0);
});
test("HSL↔RGB round-trip across 1000 deterministic colors", () => {
  for (let i = 0; i < 1000; i++) {
    const color = {
      r: (i * 37) % 256,
      g: (i * 89) % 256,
      b: (i * 173) % 256,
      a: (i % 101) / 100,
    };
    const restored = c.hslToColor(c.colorToHsl(color));
    for (const channel of ["r", "g", "b", "a"])
      close(restored[channel], color[channel]);
  }
});
test("WCAG luminance and contrast reference vectors", () => {
  close(c.luminance(parse("#000000")), 0);
  close(c.luminance(parse("#FFFFFF")), 1);
  close(c.luminance(parse("#FF0000")), 0.2126);
  close(c.contrastRatio(parse("#000000"), parse("#FFFFFF")), 21);
  close(c.contrastRatio(parse("#777777"), parse("#FFFFFF")), 4.478089453577214);
  assert.equal(
    c.renderedPair(parse("#777777"), parse("#FFFFFF"), parse("#000000"))
      .normalAA,
    false,
  );
  assert.equal(
    c.renderedPair(parse("#767676"), parse("#FFFFFF"), parse("#000000"))
      .normalAA,
    true,
  );
});
test("AA checks use the raw ratio before display rounding", () => {
  const linear = 1.05 / 4.499 - 0.05;
  const gray = (1.055 * linear ** (1 / 2.4) - 0.055) * 255;
  const pair = c.renderedPair(
    { r: gray, g: gray, b: gray, a: 1 },
    parse("#FFFFFF"),
    parse("#000000"),
  );
  close(pair.ratio, 4.499);
  assert.equal(pair.ratio.toFixed(2), "4.50");
  assert.equal(pair.normalAA, false);
});
test("Alpha composes background over opaque canvas then foreground", () => {
  const pair = c.renderedPair(
    parse("rgb(0 0 0 / .5)"),
    parse("#FFFFFF"),
    parse("#000000"),
  );
  close(pair.foreground.r, 127.5);
  close(pair.foreground.a, 1);
  close(pair.ratio, 3.976653024912438);
  const nested = c.renderedPair(
    parse("rgb(0 0 255 / .5)"),
    parse("rgb(255 0 0 / .5)"),
    parse("#FFFFFF"),
  );
  assert.deepEqual(nested.background, { r: 255, g: 127.5, b: 127.5, a: 1 });
  assert.deepEqual(nested.foreground, { r: 127.5, g: 63.75, b: 191.25, a: 1 });
  assert.deepEqual(
    c.composite(parse("rgb(0 0 0 / 0)"), parse("rgb(255 255 255 / 0)")),
    { r: 0, g: 0, b: 0, a: 0 },
  );
});
test("Harmony keeps selected anchor and all locks intact", () => {
  const palette = [
    { id: "a", name: "A", color: parse("#91A0FF"), locked: false },
    { id: "b", name: "B", color: parse("#191F2A"), locked: true },
    { id: "c", name: "C", color: parse("#77D3B4"), locked: false },
    { id: "d", name: "D", color: parse("#FFFFFF"), locked: true },
  ];
  for (const scheme of ["complementary", "analogous", "triadic", "split"]) {
    const generated = c.generateHarmony(palette, "a", scheme);
    assert.equal(generated[0], palette[0]);
    assert.equal(generated[1], palette[1]);
    assert.equal(generated[3], palette[3]);
    assert.notDeepEqual(generated[2].color, palette[2].color);
    assert.ok(generated.every((e) => c.isColor(e.color)));
    const middle = c.generateHarmony(palette, "c", scheme);
    assert.equal(middle[2], palette[2]);
  }
});
test("CSS names are safe and unique; JSON/tokens preserve alpha", () => {
  const palette = [
    {
      id: "a",
      name: "Hi; } bad",
      color: parse("rgb(20 40 60 / .333)"),
      locked: false,
    },
    { id: "b", name: "Hi; } bad", color: parse("#FFFFFF"), locked: true },
    { id: "c", name: "", color: parse("#000000"), locked: false },
  ];
  assert.deepEqual(c.tokenNames(palette, "Brand / A"), [
    "brand-a-hi-bad",
    "brand-a-hi-bad-2",
    "brand-a-color-3",
  ]);
  assert.match(
    c.exportPalette(palette, "Brand / A", "css"),
    /--brand-a-hi-bad: #14283C55;/,
  );
  const json = JSON.parse(c.exportPalette(palette, "brand", "json"));
  assert.equal(json.colors[0].alpha, 0.333);
  assert.equal(json.colors[1].locked, true);
  const tokens = JSON.parse(c.exportPalette(palette, "brand", "tokens"));
  assert.equal(tokens["brand-hi-bad"].$type, "color");
  assert.equal(tokens["brand-hi-bad"].$value.alpha, 0.333);
  assert.equal(tokens["brand-hi-bad"].$value.colorSpace, "srgb");
});
test("Tonal stops stay bounded and preserve hue, saturation, and alpha", () => {
  const base = c.colorToHsl(parse("rgb(50 80 200 / .4)"));
  assert.equal(c.TONE_STOPS.length, 11);
  for (const stop of c.TONE_STOPS) {
    const color = c.hslToColor({ ...base, l: stop.lightness });
    const tone = c.colorToHsl(color);
    assert.ok(c.isColor(color));
    close(tone.h, base.h);
    close(tone.s, base.s);
    close(tone.l, stop.lightness);
    close(tone.a, 0.4);
  }
});
console.log(`${checks} color utility checks passed.`);
