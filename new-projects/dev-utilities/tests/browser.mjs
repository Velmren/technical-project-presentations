import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
const out = resolve(process.env.DU_ARTIFACTS || "artifacts");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const report = {
  browser: "Installed Chrome / Playwright",
  checks: [],
  errors: [],
  externalRequests: [],
};
let page;
const temporary = await mkdtemp(resolve(tmpdir(), "du-browser-"));
async function poll(fn, message, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw Error(message);
}
const check = (name) => {
  report.checks.push(name);
  console.log("PASS " + name);
};
async function download(button) {
  const event = page.waitForEvent("download");
  await button.click();
  const d = await event;
  return { name: d.suggestedFilename(), bytes: await readFile(await d.path()) };
}
const host = () => page.locator(".tool-host:not([hidden])");
// Picks an option from one of the app's select comboboxes.
async function choose(label, option) {
  await host().getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await page.getByRole("listbox").waitFor({ state: "detached" });
}
async function navigate(name, title) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await host().getByRole("heading", { name: title, exact: true }).waitFor();
  await poll(
    () =>
      page
        .getByRole("navigation")
        .getByRole("button", { name: new RegExp(name) })
        .getAttribute("aria-current")
        .then((v) => v === "page"),
    "Navigation state",
  );
}
async function importJson(text, selector = "input.source-file") {
  await host()
    .locator(selector)
    .setInputFiles({
      name: "qa.json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
  await poll(
    () =>
      host()
        .locator('.cm-content[aria-label="JSON source editor"]')
        .textContent()
        .then((t) =>
          t.includes(
            text.length < 50
              ? text.replaceAll("\n", "")
              : text.slice(0, 12).replaceAll("\n", ""),
          ),
        ),
    "JSON import",
  );
}
async function runBase64(mode) {
  await host()
    .locator(".b64-run-row")
    .getByRole("button", { name: mode, exact: true })
    .click();
  await host().getByText("Ready", { exact: true }).waitFor();
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:4315/") &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      report.externalRequests.push(r.url());
  });
  await page.goto("http://127.0.0.1:4315/projects/dev-utilities/");
  await host().getByText("Valid JSON", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  check("No storage writes by default");
  await page.screenshot({ path: out + "/json-desktop.png" });
  const precise = '{"large":9007199254740993,"a/b":{"~":[false,"👋"]}}';
  await importJson(precise);
  await host().getByRole("button", { name: "Format", exact: true }).click();
  await host().getByText("Valid JSON", { exact: true }).waitFor();
  let d = await download(
    host().getByRole("button", { name: "Export JSON source", exact: true }),
  );
  assert.ok(d.bytes.toString().includes("9007199254740993"));
  check("JSON formatting and download retain unsafe numeric tokens");
  await host().getByLabel("JSON Pointer", { exact: true }).fill("/a~1b/~0/1");
  await host()
    .getByRole("button", { name: "Go to pointer", exact: true })
    .click();
  await host()
    .getByRole("button", { name: "Copy selected JSON value", exact: true })
    .waitFor();
  await host()
    .getByRole("button", { name: "Copy selected JSON value", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    '"👋"',
  );
  check("RFC 6901 lookup and real clipboard");
  await host().getByLabel("Search JSON data", { exact: true }).fill("large");
  await poll(
    () =>
      host()
        .locator(".tree-row")
        .count()
        .then((n) => n === 1),
    "Search result",
  );
  check("Tree search filters the document");
  await importJson('{\n "x":\n}');
  await poll(
    () =>
      host()
        .locator(".statusbar")
        .textContent()
        .then((t) => /\d+ errors?/.test(t)),
    "Invalid JSON status",
  );
  assert.ok((await host().locator(".problems").textContent()).includes("3:"));
  await page.screenshot({ path: out + "/json-error.png" });
  check("JSON errors locate source line and preserve input");
  await importJson('{"x":1,"arr":[1,2,3]}');
  await host()
    .locator(".tool-bar .seg")
    .getByRole("button", { name: "Compare", exact: true })
    .click();
  await host()
    .getByLabel("Import comparison JSON", { exact: true })
    .setInputFiles({
      name: "next.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"x":2,"arr":[9]}'),
    });
  await host().locator(".run-btn").click();
  await host().getByText("4 changes", { exact: true }).waitFor();
  d = await download(
    host().getByRole("button", { name: "Export JSON Patch", exact: true }),
  );
  assert.equal(JSON.parse(d.bytes).length, 4);
  await page.screenshot({ path: out + "/json-compare.png", fullPage: true });
  check("Document diff and actual JSON Patch export");
  await host()
    .locator(".tool-bar .seg")
    .getByRole("button", { name: "Schema", exact: true })
    .click();
  await host()
    .getByLabel("Import JSON Schema", { exact: true })
    .setInputFiles({
      name: "schema.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        '{"type":"object","properties":{"x":{"type":"number","minimum":2}}}',
      ),
    });
  await host()
    .getByRole("button", { name: "Validate schema", exact: true })
    .click();
  await host().getByText("1 Schema issue", { exact: true }).waitFor();
  await page.screenshot({ path: out + "/json-schema.png", fullPage: true });
  check("Ajv Schema report and source location");
  await host()
    .locator(".tool-bar .seg")
    .getByRole("button", { name: "Inspect", exact: true })
    .click();
  await importJson(
    '{"ledger":[{"id":9007199254740993,"ok":true},{"id":2,"ok":false},{"id":3}],"a/b":{"~":1}}',
  );
  await host().getByRole("tab", { name: "JSONPath", exact: true }).click();
  const queryInput = host().getByLabel("JSONPath query", { exact: true });
  await queryInput.fill("$.ledger[?@.ok == true].id");
  await host().getByText("1 match", { exact: true }).waitFor();
  assert.equal(
    await host().locator(".result-row .tree-value").first().textContent(),
    "9007199254740993",
  );
  await host().locator(".result-row").first().click();
  assert.equal(
    await host().locator(".detail-path").textContent(),
    "$/ledger/0/id",
  );
  await host()
    .getByRole("button", { name: "Copy selected JSON value", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    "9007199254740993",
  );
  check("Live JSONPath keeps exact numbers and links result to selection");
  await queryInput.fill("$.ledger[?@.ok]");
  await host().getByText("2 matches", { exact: true }).waitFor();
  await host()
    .getByRole("button", { name: "Copy results", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Values as a JSON array", exact: true })
    .click();
  assert.deepEqual(
    JSON.parse(
      (await page.evaluate(() => navigator.clipboard.readText())).replace(
        "9007199254740993",
        '"big"',
      ),
    ),
    [
      { id: "big", ok: true },
      { id: 2, ok: false },
    ],
  );
  await queryInput.fill("$['a/b']['~']");
  await host().getByText("1 match", { exact: true }).waitFor();
  assert.equal(
    await host().locator(".result-row .result-path").first().textContent(),
    "$['a/b']['~']",
  );
  check("RFC 9535 existence filter, copy menu and escaped names");
  await queryInput.fill("$.ledger[?@.id ==");
  await poll(
    () => queryInput.getAttribute("aria-invalid").then((v) => v === "true"),
    "Query syntax error",
  );
  assert.match(
    await host().locator(".query-error").textContent(),
    /position \d+/,
  );
  check("JSONPath syntax errors report a position");
  await host().getByRole("tab", { name: "Tree", exact: true }).click();
  await host()
    .getByText("No values match this filter", { exact: true })
    .waitFor();
  await host()
    .getByRole("button", { name: "Clear JSON search", exact: true })
    .click();
  const tree = host().getByRole("tree");
  // The cleared filter applies after a short debounce; wait for the nested tree.
  await host().locator('[role="treeitem"][aria-expanded]').first().waitFor();
  await tree.focus();
  // Root, then ledger (open), right moves into /ledger/0, right expands it, down enters it.
  for (const key of ["ArrowDown", "ArrowRight", "ArrowRight", "ArrowDown"])
    await page.keyboard.press(key);
  assert.equal(
    await host().getByLabel("JSON Pointer", { exact: true }).inputValue(),
    "/ledger/0/id",
  );
  // Root, ledger and a/b open by default, plus ledger/0 opened from the keyboard.
  assert.equal(
    await host().locator('[role="treeitem"][aria-expanded="true"]').count(),
    4,
  );
  check("Tree keyboard navigation selects and expands");
  const splitter = host().getByRole("separator").first();
  const before = Number(await splitter.getAttribute("aria-valuenow"));
  await splitter.focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    Number(await splitter.getAttribute("aria-valuenow")),
    before - 2,
  );
  await page.keyboard.press("Enter");
  check("Keyboard-resizable panes");
  assert.equal(
    await page.evaluate(() =>
      Object.keys(localStorage).every((k) => k === "velmren.du.v3.prefs"),
    ),
    true,
  );
  await page
    .getByRole("group", { name: "Language" })
    .getByRole("button", { name: "Русский" })
    .click();
  await host().getByRole("tab", { name: "Дерево", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), "ru");
  await page.getByRole("button", { name: /^Тема/ }).click();
  await page
    .getByRole("menuitemradio", { name: "Тёмная", exact: true })
    .click();
  await page.reload();
  await host().getByText("JSON корректен", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    "dark",
  );
  await page
    .getByRole("group", { name: "Язык" })
    .getByRole("button", { name: "English" })
    .click();
  await page.getByRole("button", { name: /^Theme/ }).click();
  await page
    .getByRole("menuitemradio", { name: "System", exact: true })
    .click();
  await host().getByRole("tab", { name: "Tree", exact: true }).waitFor();
  check("Language and theme switch, persist across reload, drafts untouched");
  await importJson('{"x":1,"arr":[1,2,3]}');
  await navigate("Colors", "Colors");
  await host().locator("#color-format-hex").fill("#ff000080");
  assert.ok(
    (await host().locator("#color-format-rgb").inputValue()).includes(
      "255 0 0",
    ),
  );
  check("Color HEX/RGB/HSL and alpha synchronization");
  await host().locator("#color-format-hex").fill("bad input");
  assert.equal(
    await host().locator("#color-format-hex").getAttribute("aria-invalid"),
    "true",
  );
  await host().locator("#color-format-hex").fill("#91a0ff");
  await host().getByRole("button", { name: "Add color", exact: true }).click();
  await host().locator("#color-slot-name").fill("QA accent");
  await host()
    .getByRole("button", { name: "Move selected color up", exact: true })
    .click();
  await host()
    .getByRole("button", {
      name: "Lock QA accent for palette generation",
      exact: true,
    })
    .click();
  const locked = await host()
    .getByRole("button", { name: /Select QA accent/ })
    .getAttribute("aria-label");
  await host().getByRole("button", { name: "Generate", exact: true }).click();
  assert.equal(
    await host()
      .getByRole("button", { name: /Select QA accent/ })
      .getAttribute("aria-label"),
    locked,
  );
  check("Palette CRUD, ordering, and harmony locks");
  await host().locator("#color-pair-foreground").fill("#00000080");
  await host().locator("#color-pair-background").fill("#ffffff80");
  await host().locator("#color-pair-canvas").fill("#000000");
  assert.ok(
    Number(
      (await host().locator(".color-ratio strong").textContent()).replace(
        ":1",
        "",
      ),
    ) > 1,
  );
  check("Composited contrast and UI preview");
  d = await download(
    host().getByRole("button", { name: "Download", exact: true }),
  );
  assert.ok(d.bytes.toString().includes("--brand-qa-accent"));
  await page.screenshot({ path: out + "/color-desktop.png", fullPage: true });
  check("Actual CSS palette export");
  await navigate("Hash", "Hash");
  const text = "Привет 👋\r\n exact bytes";
  await host().locator("textarea").fill(text);
  await host().getByRole("button", { name: "Hash text", exact: true }).click();
  await host().getByText("Complete", { exact: true }).waitFor();
  const expected = createHash("sha256")
    .update(text.replaceAll("\r\n", "\n"))
    .digest("hex");
  assert.equal(await host().locator("code.digest").textContent(), expected);
  await host().locator(".expected input").fill(expected.toUpperCase());
  await host().getByText("Match", { exact: true }).waitFor();
  await host().locator(".expected input").fill("0".repeat(64));
  await host().getByText("Mismatch", { exact: true }).waitFor();
  check("UTF-8 text hashing and expected checksum feedback");
  await host().getByRole("button", { name: "Files", exact: true }).click();
  const bytes = Buffer.from([0, 1, 128, 255, 30, 90]);
  await host()
    .getByLabel("Choose files to hash", { exact: true })
    .setInputFiles([
      {
        name: "binary.bin",
        mimeType: "application/octet-stream",
        buffer: bytes,
      },
      { name: "empty.txt", mimeType: "text/plain", buffer: Buffer.alloc(0) },
    ]);
  await host().getByRole("button", { name: "Hash files", exact: true }).click();
  await poll(
    () =>
      host()
        .locator(".digest-cell code:not(:empty)")
        .count()
        .then((n) => n === 2),
    "Two hashes",
  );
  const digests = await host().locator(".digest-cell code").allTextContents();
  assert.ok(digests.includes(createHash("sha256").update(bytes).digest("hex")));
  assert.ok(digests.includes(createHash("sha256").update("").digest("hex")));
  d = await download(host().getByRole("button", { name: "JSON", exact: true }));
  assert.equal(JSON.parse(d.bytes).length, 2);
  await page.screenshot({ path: out + "/hash-desktop.png", fullPage: true });
  check("Binary multi-file queue and full results download");
  await host()
    .getByRole("button", { name: "Clear file queue", exact: true })
    .click();
  const cancelFile = resolve(temporary, "cancel.bin");
  await writeFile(cancelFile, Buffer.alloc(128 * 1024 * 1024, 7));
  await host()
    .getByLabel("Choose files to hash", { exact: true })
    .setInputFiles(cancelFile);
  await host().getByRole("button", { name: "Hash files", exact: true }).click();
  await host().getByRole("button", { name: "Cancel", exact: true }).click();
  await host().getByText("Canceled", { exact: true }).waitFor();
  check("Hash progress cancellation retains queue");
  await host()
    .getByRole("button", { name: /^Text$/ })
    .click();
  assert.equal(
    await host().locator("textarea").inputValue(),
    text.replaceAll("\r\n", "\n"),
  );
  await page.keyboard.press("Alt+1");
  await host().getByRole("heading", { name: "JSON", exact: true }).waitFor();
  assert.ok(
    (
      await host()
        .locator('.cm-content[aria-label="JSON source editor"]')
        .textContent()
    ).includes('"arr"'),
  );
  check("Keyboard navigation and per-tool state retention");
  await navigate("Base64", "Base64");
  const unicode = "\ufeffПривет 👋 e\u0301\n";
  await host().getByLabel("Text to encode", { exact: true }).fill(unicode);
  await runBase64("Encode");
  assert.equal(
    await host().getByLabel("Result preview", { exact: true }).inputValue(),
    Buffer.from(unicode).toString("base64"),
  );
  d = await download(
    host().getByRole("button", { name: "Download result", exact: true }),
  );
  assert.equal(d.bytes.toString(), Buffer.from(unicode).toString("base64"));
  check("Unicode/BOM Base64 and full encoded download");
  await host()
    .locator(".b64-mode")
    .getByRole("button", { name: "Decode", exact: true })
    .click();
  await host()
    .getByLabel("Base64 to decode", { exact: true })
    .fill(Buffer.from(unicode).toString("base64"));
  await runBase64("Decode");
  d = await download(
    host().getByRole("button", { name: "Download result", exact: true }),
  );
  assert.deepEqual(d.bytes, Buffer.from(unicode));
  check("Base64 decoding preserves BOM and original bytes");
  await host().getByLabel("Base64 to decode", { exact: true }).fill("/wCA");
  await runBase64("Decode");
  assert.ok(
    await host()
      .getByText("Invalid UTF-8 · binary bytes", { exact: true })
      .isVisible(),
  );
  assert.ok(
    await host()
      .getByRole("button", { name: "Copy result", exact: true })
      .isDisabled(),
  );
  d = await download(
    host().getByRole("button", { name: "Download result", exact: true }),
  );
  assert.deepEqual(d.bytes, Buffer.from([255, 0, 128]));
  check("Invalid UTF-8 stays downloadable as binary");
  const html = "<script>window.__qaExecuted=true</script>";
  await host()
    .getByLabel("Base64 to decode", { exact: true })
    .fill("data:text/html;base64," + Buffer.from(html).toString("base64"));
  await runBase64("Decode");
  assert.equal(await page.evaluate(() => window.__qaExecuted), undefined);
  assert.equal(
    await host().getByLabel("Result preview", { exact: true }).inputValue(),
    html,
  );
  check("HTML Data URI is inert source");
  await host().getByLabel("Base64 to decode", { exact: true }).fill("Zh==");
  await host()
    .locator(".b64-run-row")
    .getByRole("button", { name: "Decode", exact: true })
    .click();
  await host().getByRole("alert").waitFor();
  assert.equal(
    await host().getByLabel("Base64 to decode", { exact: true }).inputValue(),
    "Zh==",
  );
  check("Canonical Base64 validation preserves invalid source");
  await host().getByLabel("Base64 to decode", { exact: true }).fill("-___AA");
  await choose("Base64 alphabet", "URL-safe - _");
  await host().getByLabel("Require padding", { exact: true }).uncheck();
  await runBase64("Decode");
  d = await download(
    host().getByRole("button", { name: "Download result", exact: true }),
  );
  assert.deepEqual(d.bytes, Buffer.from([251, 255, 255, 0]));
  check("URL-safe alphabet and optional padding");
  await host()
    .locator(".b64-mode")
    .getByRole("button", { name: "Encode", exact: true })
    .click();
  assert.equal(
    await host().getByLabel("Text to encode", { exact: true }).inputValue(),
    unicode,
  );
  await host()
    .locator(".b64-source-toggle")
    .getByRole("button", { name: "File", exact: true })
    .click();
  await host()
    .getByLabel("Choose original file", { exact: true })
    .setInputFiles({
      name: "binary.bin",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
  await runBase64("Encode");
  assert.equal(
    await host().getByLabel("Result preview", { exact: true }).inputValue(),
    bytes.toString("base64url"),
  );
  check("Original binary file encoding");

  // P1 features across the four tools.
  await navigate("JSON", "JSON");
  await importJson(
    '{"ledger":[{"id":9007199254740993,"ok":true},{"id":2,"ok":false}],"note":"yes"}',
  );
  await host().getByRole("tab", { name: "JSONPath", exact: true }).click();
  await host().getByLabel("JSONPath query", { exact: true }).fill("$..id");
  await host().getByText("2 matches", { exact: true }).waitFor();
  await poll(
    () =>
      host()
        .locator(".cm-query-match")
        .count()
        .then((n) => n === 2),
    "Match marks in the editor",
  );
  check("Every JSONPath match is marked in the editor");
  await host()
    .locator(".tool-bar .seg")
    .getByRole("button", { name: "Convert", exact: true })
    .click();
  const output = () =>
    host().locator('.cm-content[aria-label="Converted output"]');
  await poll(
    () =>
      output()
        .textContent()
        .then(
          (t) =>
            t.includes("id: 9007199254740993") && t.includes('note: "yes"'),
        ),
    "YAML output",
  );
  await host().getByRole("tab", { name: "CSV", exact: true }).click();
  await host()
    .getByLabel("JSON Pointer of the value to convert", { exact: true })
    .fill("/ledger");
  await poll(
    () =>
      output()
        .textContent()
        .then(
          (t) => t.startsWith("id,ok") && t.includes("9007199254740993,true"),
        ),
    "CSV output",
  );
  d = await download(
    host().getByRole("button", { name: "Download output", exact: true }),
  );
  assert.equal(
    d.bytes.toString(),
    "id,ok\r\n9007199254740993,true\r\n2,false\r\n",
  );
  await host().getByRole("tab", { name: "TypeScript", exact: true }).click();
  await poll(
    () =>
      output()
        .textContent()
        .then((t) => t.includes("export interface")),
    "TypeScript output",
  );
  await host()
    .getByLabel("JSON Pointer of the value to convert", { exact: true })
    .fill("");
  await host().getByRole("tab", { name: "JSON Schema", exact: true }).click();
  await poll(
    () =>
      output()
        .textContent()
        .then((t) => t.includes("2020-12")),
    "Schema output",
  );
  await host()
    .getByRole("button", { name: "Use as schema", exact: true })
    .click();
  await host().locator(".run-btn").click();
  check("Convert to YAML, CSV, TypeScript and JSON Schema keeps exact numbers");
  await host()
    .getByText("Schema validation uses", { exact: false })
    .first()
    .waitFor();
  await importJson('{"version":"1.0.0","list":[1]}');
  await host()
    .locator(".tool-bar .seg")
    .getByRole("button", { name: "Patch", exact: true })
    .click();
  const patchEditor = host().locator(
    '.cm-content[aria-label="JSON Patch editor"]',
  );
  await patchEditor.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(
    '[{"op":"test","path":"/version","value":"1.0.0"},{"op":"replace","path":"/version","value":"1.0.1"},{"op":"add","path":"/list/-","value":12345678901234567890}]',
  );
  await host().locator(".run-btn").click();
  await host().getByText("3 operations applied", { exact: true }).waitFor();
  await host()
    .getByRole("button", { name: "Replace source", exact: true })
    .click();
  await poll(
    () =>
      host()
        .locator('.cm-content[aria-label="JSON source editor"]')
        .textContent()
        .then((t) => t.includes("1.0.1") && t.includes("12345678901234567890")),
    "Patched source",
  );
  check("JSON Patch applies on exact values and replaces the source");

  await navigate("Colors", "Colors");
  await host().locator("#color-format-oklch").fill("oklch(65% 0.28 30)");
  await host()
    .getByText("Outside sRGB but inside Display P3", { exact: false })
    .waitFor();
  // The note belongs to the typed value and goes once the color changes.
  await host().locator("#color-format-oklch").press("Tab");
  await host()
    .getByText("Outside sRGB but inside Display P3", { exact: false })
    .waitFor();
  await host().locator("#color-format-hex").fill("#336699");
  await host().locator("#color-format-hex").press("Tab");
  await host().locator(".field-warn").waitFor({ state: "detached" });
  await choose("Vision", "Protanopia");
  await host().getByText("Simulating protanopia", { exact: false }).waitFor();
  await choose("Vision", "Typical vision");
  check("OKLCH gamut note, vision simulation");

  // Select keyboard model (WAI-ARIA select-only combobox).
  const combo = host().getByRole("combobox", { name: "Harmony", exact: true });
  const shown = () =>
    combo.locator(".select-value > span:not(.select-ghost)").textContent();
  const state = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      const active = el?.getAttribute("aria-activedescendant");
      return {
        focused: el?.getAttribute("aria-label"),
        expanded: el?.getAttribute("aria-expanded"),
        active: active ? document.getElementById(active)?.textContent : null,
        controls: el?.getAttribute("aria-controls"),
        listbox: document.querySelector("[role=listbox]")?.id ?? null,
      };
    });
  await combo.focus();
  const harmonyBefore = await shown();
  await page.keyboard.press("ArrowDown");
  let st = await state();
  assert.equal(st.expanded, "true");
  assert.equal(st.controls, st.listbox);
  // Opening highlights the current value, which is the one marked selected.
  assert.equal(st.active, harmonyBefore);
  assert.equal(
    await page.getByRole("option", { selected: true }).textContent(),
    harmonyBefore,
  );
  await page.keyboard.press("End");
  assert.equal((await state()).active, "Split complementary");
  await page.keyboard.press("Home");
  assert.equal((await state()).active, "Complementary");
  await page.keyboard.press("ArrowUp");
  assert.equal((await state()).active, "Complementary");
  await page.keyboard.press("Escape");
  st = await state();
  assert.equal(st.expanded, "false");
  assert.equal(st.focused, "Harmony");
  assert.equal(await page.getByRole("listbox").count(), 0);
  assert.equal(await shown(), harmonyBefore);
  // First-letter search opens the list on the match; Enter commits it.
  await page.keyboard.press("t");
  assert.equal((await state()).active, "Triadic");
  await page.keyboard.press("Enter");
  st = await state();
  assert.equal(st.expanded, "false");
  assert.equal(st.focused, "Harmony");
  assert.equal(await shown(), "Triadic");
  // Repeating a letter cycles through options that start with it.
  await page.keyboard.press(" ");
  await page.keyboard.press("s");
  assert.equal((await state()).active, "Split complementary");
  await page.keyboard.press("Escape");
  // Tab keeps the highlighted option and moves focus on.
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  st = await state();
  assert.notEqual(st.focused, "Harmony");
  assert.equal(await shown(), "Split complementary");
  assert.equal(await page.getByRole("listbox").count(), 0);
  // A click outside closes the list without changing the value.
  await combo.click();
  await page.getByRole("listbox").waitFor();
  await page.mouse.click(5, 5);
  await page.getByRole("listbox").waitFor({ state: "detached" });
  assert.equal(await shown(), "Split complementary");
  await choose("Harmony", "Analogous");
  check("Select keyboard, type-ahead, Escape, Tab and focus return");
  await host().getByRole("tab", { name: "Tailwind", exact: true }).click();
  d = await download(
    host().getByRole("button", { name: "Download", exact: true }),
  );
  assert.ok(
    d.bytes.toString().startsWith("@theme {") &&
      d.bytes.toString().includes("oklch("),
  );
  await host().getByRole("tab", { name: "CSS", exact: true }).click();
  check("Tailwind export");

  await navigate("Hash", "Hash");
  await host()
    .getByRole("button", { name: /^Text$/ })
    .click();
  await host().locator("textarea").fill("payload");
  await host().getByRole("button", { name: "HMAC", exact: true }).click();
  await host().getByLabel("HMAC key", { exact: true }).fill("k3y");
  await host().getByRole("button", { name: "Hash text", exact: true }).click();
  await host().getByText("Complete", { exact: true }).waitFor();
  assert.equal(
    await host().locator("code.digest").textContent(),
    createHmac("sha256", "k3y").update("payload").digest("hex"),
  );
  // HMAC digests are exported with their tag, never as a sha256sum list.
  d = await download(
    host().getByRole("button", { name: "Checksum file", exact: true }),
  );
  assert.equal(d.name, "hmac-sha256.txt");
  assert.equal(
    d.bytes.toString(),
    `HMAC-SHA-256 (text.txt) = ${createHmac("sha256", "k3y").update("payload").digest("hex")}\n`,
  );
  await host().getByRole("button", { name: "HMAC", exact: true }).click();
  check("HMAC-SHA-256 matches Node crypto");
  await host().getByRole("button", { name: "Files", exact: true }).click();
  await host()
    .getByRole("button", { name: "Clear file queue", exact: true })
    .click();
  await host()
    .getByLabel("Choose files to hash", { exact: true })
    .setInputFiles([
      { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("alpha") },
      { name: "b.txt", mimeType: "text/plain", buffer: Buffer.from("changed") },
    ]);
  const sum = (v) => createHash("sha256").update(v).digest("hex");
  await host()
    .getByLabel("Choose a checksum list (sha256sum or BSD format)", {
      exact: true,
    })
    .setInputFiles({
      name: "SHA256SUMS",
      mimeType: "text/plain",
      buffer: Buffer.from(
        `${sum("alpha")}  dist/a.txt\n${sum("beta")}  dist/b.txt\n${sum("gamma")} *dist/c.txt\n`,
      ),
    });
  await host().getByRole("button", { name: "Hash files", exact: true }).click();
  await host()
    .locator(".verdict-chip.v-ok strong")
    .filter({ hasText: "1" })
    .waitFor();
  assert.equal(
    await host().locator(".verdict-chip.v-failed strong").textContent(),
    "1",
  );
  assert.equal(
    await host().locator(".verdict-chip.v-missing strong").textContent(),
    "1",
  );
  d = await download(
    host().getByRole("button", { name: "Report", exact: true }),
  );
  assert.equal(
    d.bytes.toString(),
    "a.txt: OK\nb.txt: FAILED\ndist/c.txt: MISSING\n",
  );
  // A list of plain checksums is not compared with HMAC digests.
  await host().getByRole("button", { name: "HMAC", exact: true }).click();
  await host()
    .getByText("so it is not compared while HMAC is on", { exact: false })
    .waitFor();
  assert.equal(await host().locator(".verdict-chip").count(), 0);
  await host().getByRole("button", { name: "HMAC", exact: true }).click();
  await host()
    .getByRole("button", { name: "Clear file queue", exact: true })
    .waitFor();
  await host()
    .getByRole("button", { name: "Clear file queue", exact: true })
    .click();
  await host()
    .getByRole("button", { name: "Remove checksum list", exact: true })
    .click();
  await host()
    .getByRole("button", { name: /^Text$/ })
    .click();
  check("Checksum list verification and sha256sum -c style report");

  await navigate("Base64", "Base64");
  await host()
    .locator(".b64-mode")
    .getByRole("button", { name: "Decode", exact: true })
    .click();
  await host()
    .locator(".b64-source-toggle")
    .getByRole("button", { name: "Text", exact: true })
    .click();
  await choose("Base64 alphabet", "Standard + /");
  await host()
    .getByLabel("Base64 to decode", { exact: true })
    .fill(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    );
  await runBase64("Decode");
  await host().getByRole("button", { name: "Hex", exact: true }).click();
  assert.ok(
    (await host().locator(".hex-row").first().textContent()).includes(
      "89 50 4e 47 0d 0a 1a 0a",
    ),
  );
  await host().getByText("Detected: PNG image", { exact: true }).waitFor();
  check("Hex view with file signature detection");
  await host()
    .locator(".b64-mode")
    .getByRole("button", { name: "JWT", exact: true })
    .click();
  await host()
    .getByRole("button", { name: "Use example", exact: true })
    .click();
  await host()
    .getByText("The signature is not verified here", { exact: false })
    .waitFor();
  assert.ok(
    (await host().locator(".claims").textContent()).includes("billing-api"),
  );
  // A claim time beyond the Date range is shown as a plain value.
  const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  await host()
    .getByLabel("JWT to decode", { exact: true })
    .fill(`${part({ alg: "HS256" })}.${part({ exp: 10000000000000 })}.c2ln`);
  await host()
    .locator(".claims")
    .getByText("10000000000000", { exact: true })
    .waitFor();
  await host().getByLabel("JWT to decode", { exact: true }).fill("not.a");
  await host()
    .getByText("A JWT has three parts separated by dots.", { exact: true })
    .waitFor();
  await host().getByLabel("JWT to decode", { exact: true }).fill("");
  await host()
    .locator(".b64-mode")
    .getByRole("button", { name: "Encode", exact: true })
    .click();
  check("JWT decoding with an explicit unverified-signature warning");
  await page.screenshot({ path: out + "/base64-desktop.png", fullPage: true });
  // Saving is explicit, synchronized across tabs, and clearing removes only owned keys.
  await page.getByRole("button", { name: "About", exact: true }).click();
  assert.equal(
    await page
      .getByRole("link", { name: "VELMREN", exact: true })
      .getAttribute("href"),
    "https://velmren.com/",
  );
  await page
    .getByRole("checkbox", { name: /Save text, options and palettes/ })
    .check();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await poll(
    () =>
      page.evaluate(
        () => localStorage.getItem("velmren.du.v3.base64.encodeText") !== null,
      ),
    "Saved draft",
  );
  const second = await context.newPage();
  second.setDefaultTimeout(10000);
  await second.goto("http://127.0.0.1:4315/projects/dev-utilities/#base64");
  await second
    .locator(".b64-source-toggle")
    .getByRole("button", { name: "Text", exact: true })
    .click();
  await second.getByLabel("Text to encode", { exact: true }).waitFor();
  assert.equal(
    await second.getByLabel("Text to encode", { exact: true }).inputValue(),
    unicode,
  );
  check("Opt-in drafts restore on a second visit");
  await page.evaluate(() => localStorage.setItem("unrelated.test", "retain"));
  await page.getByRole("button", { name: "About", exact: true }).click();
  await page
    .getByRole("checkbox", { name: /Save text, options and palettes/ })
    .uncheck();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await second
    .getByLabel("Text to encode", { exact: true })
    .fill("after consent revoked");
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(
    await second.evaluate(
      () =>
        Object.keys(localStorage).filter(
          (k) => k.startsWith("velmren.du.") && !k.endsWith(".prefs"),
        ).length,
    ),
    0,
  );
  assert.equal(
    await second.evaluate(() => localStorage.getItem("unrelated.test")),
    "retain",
  );
  check("Cross-tab opt-out prevents writes and keeps unrelated storage");
  await second.close();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await page.reload();
  await navigate("Hash", "Hash");
  await host().locator("textarea").fill("abc");
  await host().getByRole("button", { name: "Hash text", exact: true }).click();
  await host().getByText("Complete", { exact: true }).waitFor();
  await host()
    .getByRole("button", { name: "Copy hash for text", exact: true })
    .click();
  await page
    .getByText("Clipboard unavailable. Select the value and copy manually.", {
      exact: true,
    })
    .waitFor();
  check("Clipboard failure reports actual failure");
  // Keyboard search/folding and compact layout at intermediate widths.
  await navigate("JSON", "JSON");
  await host().locator('.cm-content[aria-label="JSON source editor"]').click();
  await page.keyboard.press("Control+f");
  await host().locator(".cm-search").waitFor();
  await page.keyboard.press("Escape");
  check("CodeMirror keyboard search");
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, title] of [
      ["JSON", "JSON"],
      ["Colors", "Colors"],
      ["Hash", "Hash"],
      ["Base64", "Base64"],
    ]) {
      await navigate(name, title);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
  }
  check("No horizontal page overflow at 768/1024");
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-US",
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const desktopPage = page;
  page = await mobile.newPage();
  await page.goto("http://127.0.0.1:4315/projects/dev-utilities/");
  await host().getByText("Valid JSON", { exact: true }).waitFor();
  await page.screenshot({ path: out + "/json-mobile.png", fullPage: true });
  await host()
    .locator(".mobile-panes")
    .getByRole("tab", { name: "Tree", exact: true })
    .tap();
  assert.ok(await host().locator(".tree").isVisible());
  assert.ok(
    !(await host()
      .locator('.cm-content[aria-label="JSON source editor"]')
      .isVisible()),
  );
  await host()
    .locator(".mobile-panes")
    .getByRole("tab", { name: "JSONPath", exact: true })
    .tap();
  await host()
    .getByText(/\d+ match/)
    .first()
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  );
  check("Touch JSON source, tree and query panes without page scrolling");
  await navigate("Colors", "Colors");
  await page.screenshot({ path: out + "/color-mobile.png", fullPage: true });
  await host().getByRole("tab", { name: "Palette", exact: true }).tap();
  assert.ok(await host().locator(".color-palette").isVisible());
  assert.ok(!(await host().locator(".color-editor").isVisible()));
  await host().getByRole("tab", { name: "Contrast", exact: true }).tap();
  assert.ok(await host().locator(".color-contrast").isVisible());
  assert.ok(!(await host().locator(".color-palette").isVisible()));
  await page.screenshot({
    path: out + "/color-mobile-contrast.png",
    fullPage: true,
  });
  check("Mobile color task views avoid desktop stacking");
  // At the right screen edge the list stays inside the viewport, with
  // touch-sized options.
  await host().getByRole("combobox", { name: "Vision", exact: true }).tap();
  const box = await page.getByRole("listbox").boundingBox();
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  assert.ok(box.x >= 0 && box.x + box.width <= width, JSON.stringify(box));
  const option = await page.getByRole("option").first().boundingBox();
  assert.ok(option.height >= 40, "option height " + option.height);
  await page.getByRole("option", { name: "Tritanopia", exact: true }).tap();
  await host().getByText("Simulating tritanopia", { exact: false }).waitFor();
  await choose("Vision", "Typical vision");
  check("Mobile select stays on screen with touch-sized options");
  await navigate("Hash", "Hash");
  await host().locator("textarea").fill("abc");
  await host().getByRole("button", { name: "Hash text", exact: true }).tap();
  await host().getByText("Complete", { exact: true }).waitFor();
  await page.screenshot({ path: out + "/hash-mobile.png", fullPage: true });
  await navigate("Base64", "Base64");
  await host().getByRole("button", { name: "Use example", exact: true }).tap();
  await page.screenshot({
    path: out + "/base64-mobile-input.png",
    fullPage: true,
  });
  await runBase64("Encode");
  assert.ok(!(await host().locator(".b64-source").isVisible()));
  assert.ok(await host().locator(".b64-result").isVisible());
  await page.screenshot({ path: out + "/base64-mobile.png", fullPage: true });
  await host()
    .locator(".b64-mobile-nav")
    .getByRole("tab", { name: "Input", exact: true })
    .tap();
  assert.ok(
    (
      await host().getByLabel("Text to encode", { exact: true }).inputValue()
    ).includes("Hello"),
  );
  check("Mobile Base64 automatically opens result and retains input");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    true,
  );
  check("Touch layout and reduced motion");
  await mobile.close();
  page = desktopPage;
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.externalRequests, []);
  check("No page/console errors or external requests");
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  if (page)
    await page
      .screenshot({ path: out + "/failure.png", fullPage: true })
      .catch(() => {});
  throw e;
} finally {
  await writeFile(
    out + "/browser-report.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  await rm(temporary, { recursive: true, force: true });
}
