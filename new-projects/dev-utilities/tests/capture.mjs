// Screenshots of real states for review. Needs `npm run dev` running.
// Each scene sets width, theme and language, then drives the interface.
import { chromium } from "playwright";
import { createHash } from "node:crypto";

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const out = resolve(process.env.DU_ARTIFACTS || "artifacts");
const only = process.argv[2];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });

const tool = (page) => page.locator(".tool-host:not([hidden])");
async function ready(page, lang) {
  await tool(page)
    .getByText(lang === "ru" ? "JSON корректен" : "Valid JSON", { exact: true })
    .waitFor();
}
async function tab(page, name) {
  await tool(page).getByRole("tab", { name, exact: true }).click();
}
// Opens one of the app's select comboboxes; picks an option when given.
async function choose(page, label, option) {
  await tool(page).getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("listbox").waitFor();
  if (!option) return;
  await page.getByRole("option", { name: option, exact: true }).click();
  await page.getByRole("listbox").waitFor({ state: "detached" });
}
async function mode(page, name) {
  // Narrow JSON layouts switch modes with a select instead of buttons.
  const select = tool(page).locator(".tool-bar .view-select");
  if (await select.count()) {
    await select.click();
    await page.getByRole("option", { name, exact: true }).click();
    return;
  }
  await tool(page)
    .locator(".tool-bar .seg")
    .getByRole("button", { name, exact: true })
    .click();
}
async function treeRow(page, text) {
  await tool(page)
    .locator(".tree-row")
    .filter({ hasText: text })
    .first()
    .click();
}
async function query(page, text, matches) {
  await tool(page).locator("#jsonpath-input").fill(text);
  await tool(page).getByText(matches, { exact: true }).waitFor();
}

async function open(page, id) {
  await page.evaluate((hash) => (location.hash = hash), id);
  await page.locator(".tool-host:not([hidden]) .tool-bar").first().waitFor();
}
async function hashExample(page, lang) {
  await open(page, "hash");
  await tool(page)
    .getByRole("button", {
      name: lang === "ru" ? "Пример" : "Example",
      exact: true,
    })
    .click();
  await tool(page).locator(".tool-bar .btn.primary").click();
  await tool(page)
    .locator(".all-digests tr:nth-child(4) code:not(:empty)")
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".all-digests")?.textContent.includes("..."),
  );
}
async function hashFiles(page) {
  await open(page, "hash");
  await tool(page).locator(".tool-bar .seg button").nth(1).click();
  await tool(page)
    .locator("input[type=file]")
    .last()
    .setInputFiles([
      {
        name: "release-2026.09.tar.gz",
        mimeType: "application/gzip",
        buffer: Buffer.alloc(48213, 7),
      },
      {
        name: "checksums-notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Release notes, synthetic example."),
      },
      { name: "empty.log", mimeType: "text/plain", buffer: Buffer.alloc(0) },
    ]);
  await tool(page).locator(".tool-bar .btn.primary").click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".digest-cell code:not(:empty)").length === 3,
  );
  const first = await tool(page)
    .locator(".digest-cell code")
    .first()
    .textContent();
  await tool(page).locator(".file-verify input").first().fill(first);
  await tool(page).locator(".file-verify input").nth(1).fill("0".repeat(64));
}
const sha = (text) => createHash("sha256").update(text).digest("hex");
async function hashList(page) {
  await open(page, "hash");
  await tool(page).locator(".tool-bar .seg button").nth(1).click();
  await tool(page)
    .locator("input[type=file]")
    .last()
    .setInputFiles([
      {
        name: "app-4.13.0.tar.gz",
        mimeType: "application/gzip",
        buffer: Buffer.alloc(9120, 3),
      },
      {
        name: "install.sh",
        mimeType: "text/plain",
        buffer: Buffer.from("#!/bin/sh\necho install\n"),
      },
      {
        name: "notes.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Notes, edited\n"),
      },
      {
        name: "local.env.example",
        mimeType: "text/plain",
        buffer: Buffer.from("PORT=8080\n"),
      },
    ]);
  const list = [
    `${sha(Buffer.alloc(9120, 3))}  release/app-4.13.0.tar.gz`,
    `${sha("#!/bin/sh\necho install\n")}  release/install.sh`,
    `${sha("# Notes\n")}  release/notes.md`,
    `${sha("checksums")}  release/app-4.13.0.sig`,
  ].join("\n");
  await tool(page)
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "SHA256SUMS",
      mimeType: "text/plain",
      buffer: Buffer.from(list + "\n"),
    });
  await tool(page).locator(".tool-bar .btn.primary").click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".digest-cell code:not(:empty)").length === 4,
  );
}
async function hashHmac(page, lang) {
  await open(page, "hash");
  await tool(page)
    .getByRole("button", {
      name: lang === "ru" ? "Пример" : "Example",
      exact: true,
    })
    .click();
  await tool(page).locator(".hmac-toggle").click();
  await tool(page).locator(".key-field input").fill("webhook-secret");
  await tool(page).locator(".tool-bar .btn.primary").click();
  await tool(page)
    .locator(".all-digests tr:nth-child(3) code:not(:empty)")
    .waitFor();
}
async function base64Example(page, lang) {
  await open(page, "base64");
  await tool(page)
    .getByRole("button", {
      name: lang === "ru" ? "Пример" : "Use example",
      exact: true,
    })
    .click();
  await tool(page).locator(".b64-run-row .btn").click();
  await tool(page).locator(".b64-status.status-ready").waitFor();
}

const scenes = {
  "json-1440-light-en": [
    1440,
    900,
    "light",
    "en",
    async (p) => {
      await treeRow(p, /^3\{/);
    },
  ],
  "json-1440-dark-en": [
    1440,
    900,
    "dark",
    "en",
    async (p) => {
      await treeRow(p, /^endpoints\[/);
    },
  ],
  "json-query-1440-light-ru": [
    1440,
    900,
    "light",
    "ru",
    async (p) => {
      await tab(p, "JSONPath");
      await tool(p).getByText("2 совпадения", { exact: true }).waitFor();
      await tool(p).locator(".result-row").nth(1).click();
    },
  ],
  "json-query-1440-dark-ru": [
    1440,
    900,
    "dark",
    "ru",
    async (p) => {
      await tab(p, "JSONPath");
      await query(p, "$..email", "2 совпадения");
      await tool(p).locator(".result-row").first().click();
    },
  ],
  "json-compare-1440-dark-en": [
    1440,
    900,
    "dark",
    "en",
    async (p) => {
      await mode(p, "Compare");
      await tool(p).locator(".run-btn").click();
      await tool(p).getByText("6 changes", { exact: true }).waitFor();
    },
  ],
  "json-schema-1440-light-ru": [
    1440,
    900,
    "light",
    "ru",
    async (p) => {
      await mode(p, "Схема");
      await tool(p).locator(".run-btn").click();
      await tool(p).getByText("1 нарушение схемы", { exact: true }).waitFor();
    },
  ],
  "json-error-1024-light-en": [
    1024,
    768,
    "light",
    "en",
    async (p) => {
      await tool(p).locator(".cm-content").click();
      await p.keyboard.press("Control+End");
      await p.keyboard.press("Backspace");
      await p.keyboard.press("Backspace");
      await tool(p).locator(".problems").waitFor();
    },
    false,
  ],
  "json-1024-dark-ru": [
    1024,
    768,
    "dark",
    "ru",
    async (p) => {
      await tab(p, "JSONPath");
      await tool(p).getByText("2 совпадения", { exact: true }).waitFor();
    },
  ],
  "about-1440-light-ru": [
    1440,
    900,
    "light",
    "ru",
    async (p) => {
      await p
        .getByRole("button", { name: "О приложении", exact: true })
        .click();
    },
  ],
  "about-1920-dark-en": [
    1920,
    1080,
    "dark",
    "en",
    (p) => p.getByRole("button", { name: "About", exact: true }).click(),
  ],
  "about-1920-light-ru": [
    1920,
    1080,
    "light",
    "ru",
    (p) => p.getByRole("button", { name: "О приложении", exact: true }).click(),
  ],
  "about-390-dark-ru": [
    390,
    844,
    "dark",
    "ru",
    (p) => p.getByRole("button", { name: "О приложении", exact: true }).click(),
  ],
  "about-390-light-en": [
    390,
    844,
    "light",
    "en",
    (p) => p.getByRole("button", { name: "About", exact: true }).click(),
  ],
  "json-390-light-en": [390, 844, "light", "en", async () => {}],
  "json-390-dark-ru-tree": [
    390,
    844,
    "dark",
    "ru",
    async (p) => {
      await tab(p, "Дерево");
      await treeRow(p, /^owners\[/);
    },
  ],
  "json-390-light-ru-query": [
    390,
    844,
    "light",
    "ru",
    async (p) => {
      await tab(p, "JSONPath");
      await tool(p).getByText("2 совпадения", { exact: true }).waitFor();
      await tool(p).locator(".result-row").first().click();
    },
  ],
  "json-390-dark-en-compare": [
    390,
    844,
    "dark",
    "en",
    async (p) => {
      await mode(p, "Compare");
      await tool(p).locator(".run-btn").click();
      await tool(p).getByText("6 changes", { exact: true }).waitFor();
    },
  ],
  "colors-1440-light-en": [1440, 900, "light", "en", (p) => open(p, "color")],
  "colors-1440-dark-ru": [1440, 900, "dark", "ru", (p) => open(p, "color")],
  "colors-390-light-ru": [390, 844, "light", "ru", (p) => open(p, "color")],
  "colors-390-dark-en-contrast": [
    390,
    844,
    "dark",
    "en",
    async (p) => {
      await open(p, "color");
      await tab(p, "Contrast");
    },
  ],
  "hash-1440-light-en": [1440, 900, "light", "en", (p) => hashExample(p, "en")],
  "hash-1440-dark-ru-files": [1440, 900, "dark", "ru", (p) => hashFiles(p)],
  "hash-390-light-ru": [390, 844, "light", "ru", (p) => hashExample(p, "ru")],
  "hash-390-dark-en-files": [390, 844, "dark", "en", (p) => hashFiles(p)],
  "base64-1440-light-ru": [
    1440,
    900,
    "light",
    "ru",
    (p) => base64Example(p, "ru"),
  ],
  "base64-1440-dark-en": [
    1440,
    900,
    "dark",
    "en",
    async (p) => {
      await open(p, "base64");
      await tool(p).locator(".b64-mode button").nth(1).click();
      await tool(p)
        .getByLabel("Base64 to decode", { exact: true })
        .fill(
          "data:text/html;base64,PGgxPkludm9pY2UgIzEwNDI8L2gxPjxwPkR1ZSAxNCBPY3RvYmVyPC9wPg==",
        );
      await tool(p).locator(".b64-run-row .btn").click();
      await tool(p).locator(".b64-status.status-ready").waitFor();
    },
  ],
  "base64-390-light-en": [
    390,
    844,
    "light",
    "en",
    (p) => base64Example(p, "en"),
  ],
  "base64-390-dark-ru": [390, 844, "dark", "ru", (p) => open(p, "base64")],
  "hash-1440-light-en-list": [1440, 900, "light", "en", (p) => hashList(p)],
  "hash-1440-dark-ru-hmac": [1440, 900, "dark", "ru", (p) => hashHmac(p, "ru")],
  "hash-390-light-ru-list": [390, 844, "light", "ru", (p) => hashList(p)],
  "json-convert-1440-dark-en": [
    1440,
    900,
    "dark",
    "en",
    async (p) => {
      await mode(p, "Convert");
      await tool(p)
        .locator('.cm-content[aria-label="Converted output"] .cm-line')
        .nth(5)
        .waitFor();
    },
  ],
  "json-convert-1440-light-ru-ts": [
    1440,
    900,
    "light",
    "ru",
    async (p) => {
      await mode(p, "Конвертация");
      await tool(p)
        .getByRole("tab", { name: "TypeScript", exact: true })
        .click();
      await tool(p)
        .getByText("export interface Service", { exact: false })
        .waitFor();
    },
  ],
  "json-patch-1440-light-ru": [
    1440,
    900,
    "light",
    "ru",
    async (p) => {
      await mode(p, "Патч");
      await tool(p).locator(".run-btn").click();
      await tool(p)
        .getByText("Применено 5 операций", { exact: true })
        .waitFor();
    },
  ],
  "json-390-dark-ru-convert": [
    390,
    844,
    "dark",
    "ru",
    async (p) => {
      await mode(p, "Конвертация");
      await tab(p, "Результат");
      await tool(p)
        .locator('.cm-content[aria-label="Результат конвертации"] .cm-line')
        .nth(5)
        .waitFor();
    },
  ],
  "colors-1440-dark-en-vision": [
    1440,
    900,
    "dark",
    "en",
    async (p) => {
      await open(p, "color");
      await choose(p, "Vision", "Deuteranopia");
    },
  ],
  "colors-1440-light-ru-oklch": [
    1440,
    900,
    "light",
    "ru",
    async (p) => {
      await open(p, "color");
      await tool(p).locator("#color-format-oklch").fill("oklch(65% 0.28 30)");
      await tool(p).locator(".field-warn").waitFor();
    },
  ],
  "base64-1440-light-en-jwt": [
    1440,
    900,
    "light",
    "en",
    async (p) => {
      await open(p, "base64");
      await tool(p).locator(".b64-mode button").nth(2).click();
      await tool(p)
        .getByRole("button", { name: "Use example", exact: true })
        .click();
      await tool(p).locator(".claims").waitFor();
    },
  ],
  "base64-1440-dark-ru-hex": [
    1440,
    900,
    "dark",
    "ru",
    async (p) => {
      await open(p, "base64");
      await tool(p).locator(".b64-mode button").nth(1).click();
      await tool(p)
        .getByLabel("Base64 для декодирования", { exact: true })
        .fill(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        );
      await tool(p).locator(".b64-run-row .btn").click();
      await tool(p).getByRole("button", { name: "Hex", exact: true }).click();
      await tool(p).locator(".hex-row").first().waitFor();
    },
  ],
  "base64-390-dark-en-jwt": [
    390,
    844,
    "dark",
    "en",
    async (p) => {
      await open(p, "base64");
      await tool(p).locator(".b64-mode button").nth(2).click();
      await tool(p)
        .getByRole("button", { name: "Use example", exact: true })
        .click();
      await tool(p).locator(".claims").waitFor();
    },
  ],
  // Open select lists in both themes, both languages, desktop and phone.
  "select-colors-1440-light-ru-harmony": [
    1440,
    900,
    "light",
    "ru",
    async (p) => {
      await open(p, "color");
      await choose(p, "Гармония");
    },
  ],
  "select-colors-1440-dark-en-vision": [
    1440,
    900,
    "dark",
    "en",
    async (p) => {
      await open(p, "color");
      await choose(p, "Vision");
      await p.keyboard.press("ArrowDown");
    },
  ],
  "select-hash-1440-dark-ru-algorithm": [
    1440,
    900,
    "dark",
    "ru",
    async (p) => {
      await hashExample(p, "ru");
      await choose(p, "Алгоритм");
    },
  ],
  "select-json-1440-light-en-indent": [
    1440,
    900,
    "light",
    "en",
    (p) => choose(p, "Indent"),
  ],
  "select-json-390-dark-ru-mode": [
    390,
    844,
    "dark",
    "ru",
    (p) => choose(p, "Режим JSON"),
  ],
  "select-colors-390-light-en-vision": [
    390,
    844,
    "light",
    "en",
    async (p) => {
      await open(p, "color");
      await choose(p, "Vision");
    },
  ],
  "select-base64-390-dark-ru-alphabet": [
    390,
    844,
    "dark",
    "ru",
    async (p) => {
      await open(p, "base64");
      await choose(p, "Алфавит Base64");
    },
  ],
  thumbnail: [
    1440,
    900,
    "light",
    "ru",
    async (p) => {
      await tab(p, "JSONPath");
      await tool(p).getByText("2 совпадения", { exact: true }).waitFor();
      await tool(p).locator(".result-row").nth(1).click();
    },
  ],
};

try {
  for (const [
    name,
    [width, height, theme, lang, act, wait = true],
  ] of Object.entries(scenes)) {
    if (only && !name.includes(only)) continue;
    const narrow = width < 768;
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      locale: lang === "ru" ? "ru-RU" : "en-US",
      isMobile: narrow,
      hasTouch: narrow,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4315/projects/dev-utilities/");
    if (wait) await ready(page, lang);
    await act(page);
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth > innerWidth + 1 ||
        [
          ...document.querySelectorAll(
            ".app, .topbar, .tool-bar, .statusbar, .detail-head",
          ),
        ].some((el) => el.getBoundingClientRect().right > innerWidth + 1) ||
        [...document.querySelectorAll(".select-list")].some((el) => {
          const r = el.getBoundingClientRect();
          return r.left < 0 || r.right > innerWidth || r.bottom > innerHeight;
        }),
    );
    if (overflow) throw Error("Horizontal overflow in " + name);
    if (errors.length) throw Error(name + ": " + errors.join(" | "));
    await page.screenshot({
      path: `${out}/${name}.png`,
      animations: "disabled",
    });
    console.log("saved " + name);
    await context.close();
  }
} finally {
  await browser.close();
}
