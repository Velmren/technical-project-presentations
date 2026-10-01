import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const out = resolve(process.env.DU_ARTIFACTS || "artifacts");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const report = { checks: [] };
const pass = (name) => {
  report.checks.push(name);
  console.log("PASS " + name);
};
try {
  const context = await browser.newContext({ locale: "en-US" });
  await context.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, options) {
        if (message.action === "compare")
          setTimeout(() => super.postMessage(message, options), 700);
        else super.postMessage(message, options);
      }
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const host = () => page.locator(".tool-host:not([hidden])");
  let workerRequests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/json-worker.js")) workerRequests++;
  });
  await page.goto("http://127.0.0.1:4315/projects/dev-utilities/");
  await host().getByText("Valid JSON", { exact: true }).waitFor();
  await host()
    .locator("input.source-file")
    .setInputFiles({
      name: "changed.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"changed":true}'),
    });
  await host()
    .locator(".tool-bar .seg")
    .getByRole("button", { name: "Compare", exact: true })
    .click();
  await host().locator(".run-btn").click();
  await host().locator("table.diff").waitFor();
  await host().getByText("Valid JSON", { exact: true }).waitFor();
  const previousRequests = workerRequests;
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(workerRequests, previousRequests);
  pass("Deferred source analysis resumes after an explicit job and settles");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Base64/ })
    .click();
  await host().getByRole("heading", { name: "Base64", exact: true }).waitFor();
  await host()
    .locator(".b64-source-toggle")
    .getByRole("button", { name: "File", exact: true })
    .click();
  await host()
    .getByLabel("Choose original file", { exact: true })
    .setInputFiles({
      name: "long.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(24 * 1024 * 1024, 91),
    });
  await host()
    .locator(".b64-run-row")
    .getByRole("button", { name: "Encode", exact: true })
    .click();
  await host().getByRole("button", { name: "Cancel", exact: true }).click();
  await host()
    .getByText("Canceled. Your input is untouched.", {
      exact: true,
    })
    .waitFor();
  assert.ok(await host().getByText("long.bin", { exact: true }).isVisible());
  pass("Base64 long file cancellation preserves source");
  await host()
    .getByLabel("Choose original file", { exact: true })
    .setInputFiles({
      name: "small.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([127]),
    });
  await host()
    .locator(".b64-run-row")
    .getByRole("button", { name: "Encode", exact: true })
    .click();
  await host().getByText("Ready", { exact: true }).waitFor();
  assert.equal(
    await host().getByLabel("Result preview", { exact: true }).inputValue(),
    "fw==",
  );
  pass("Base64 restarts cleanly after cancellation");
  await host()
    .getByLabel("Choose original file", { exact: true })
    .setInputFiles({
      name: "oversized.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(33 * 1024 * 1024),
    });
  await host().getByRole("alert").waitFor();
  const capText = await host().getByRole("alert").textContent();
  assert.ok(capText.includes("32 MB"), capText);
  pass("Base64 file cap rejects excess bytes");
  await host()
    .locator(".b64-mode")
    .getByRole("button", { name: "Decode", exact: true })
    .click();
  await host()
    .locator(".b64-source-toggle")
    .getByRole("button", { name: "Text", exact: true })
    .click();
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSm0AAAAASUVORK5CYII=";
  await host()
    .getByLabel("Base64 to decode", { exact: true })
    .fill("data:image/png;base64," + png);
  await host()
    .locator(".b64-run-row")
    .getByRole("button", { name: "Decode", exact: true })
    .click();
  await host()
    .getByRole("img", { name: "Decoded raster image preview", exact: true })
    .waitFor();
  await host()
    .getByRole("img")
    .evaluate((img) => img.decode());
  assert.equal(
    await host()
      .getByRole("img")
      .evaluate((img) => img.naturalWidth),
    1,
  );
  pass("Recognized PNG bytes use a real blob raster preview");
  const malformed = await browser.newContext({ locale: "en-US" });
  await malformed.addInitScript(() => {
    // v2 leftovers (consent carries over, drafts are ignored) and broken v3 values.
    localStorage.setItem("velmren.du.v2.enabled", "true");
    localStorage.setItem("velmren.du.v2.json", "null");
    localStorage.setItem("velmren.du.v3.json", "null");
    localStorage.setItem("velmren.du.v3.json.query", "42");
    localStorage.setItem("velmren.du.v3.prefs", "{broken");
    localStorage.setItem("velmren.du.v3.base64.options", "[]");
    localStorage.setItem("velmren.du.v3.color-studio", '{"palette":[]}');
  });
  const restored = await malformed.newPage();
  const errors = [];
  restored.on("pageerror", (e) => errors.push(e.message));
  await restored.goto("http://127.0.0.1:4315/projects/dev-utilities/");
  await restored.getByText("Valid JSON", { exact: true }).waitFor();
  await restored
    .getByRole("navigation")
    .getByRole("button", { name: /Colors/ })
    .click();
  await restored
    .getByRole("button", { name: "Add color", exact: true })
    .click();
  assert.deepEqual(errors, []);
  assert.equal(
    await restored.evaluate(() =>
      localStorage.getItem("velmren.du.v3.enabled"),
    ),
    "true",
  );
  pass(
    "Malformed or v2 saved state falls back to defaults; consent carries over",
  );
  const russian = await browser.newContext({ locale: "ru-RU" });
  const ru = await russian.newPage();
  await ru.goto("http://127.0.0.1:4315/projects/dev-utilities/");
  await ru.getByText("JSON корректен", { exact: true }).waitFor();
  assert.equal(await ru.evaluate(() => document.documentElement.lang), "ru");
  assert.equal(await ru.evaluate(() => localStorage.length), 0);
  pass(
    "Russian browser locale opens the Russian interface without writing storage",
  );
  await russian.close();
  await malformed.close();
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = e.stack;
  throw e;
} finally {
  await writeFile(out + "/edge-report.json", JSON.stringify(report, null, 2));
  await browser.close();
}
