// Records real interface motion with Playwright:
//   node scripts/record-motion.cjs <base-url> <out-dir> [overview|sections|work|mobile|all]
// The page runs normally; a small dot shows where the pointer is, because recordings don't include the cursor.
const { chromium } = require("playwright-core");
const path = require("path");

const [, , base = "http://127.0.0.1:5188/", outDir = ".", which = "all"] = process.argv;

const cursor = () => {
  window.addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div");
    dot.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 0 0 2px rgba(0,0,0,.35);pointer-events:none;z-index:2147483647;transition:transform .12s ease-out;";
    document.body.appendChild(dot);
    window.addEventListener("pointermove", (e) => (dot.style.translate = `${e.clientX}px ${e.clientY}px`), true);
    window.addEventListener("pointerdown", () => (dot.style.transform = "scale(.7)"), true);
    window.addEventListener("pointerup", () => (dot.style.transform = "none"), true);
  });
};

async function glide(page, locator, steps = 18) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
}

async function click(page, locator, pause = 500) {
  await glide(page, locator);
  await locator.click();
  await page.waitForTimeout(pause);
}

const nav = (page, label) => page.locator(".shell-sidebar .shell-nav__item", { hasText: label });

async function session(browser, name, run, viewport = { width: 1440, height: 900 }, extra = {}) {
  const context = await browser.newContext({ viewport, recordVideo: { dir: outDir, size: viewport }, ...extra });
  await context.addInitScript(() => localStorage.setItem("orbit-locale", "ru"));
  if (!extra.isMobile) await context.addInitScript(cursor);
  const page = await context.newPage();
  await run(page);
  await context.close();
  await page.video().saveAs(path.join(outDir, name));
  await page.video().delete();
}

// Landing, Overview and Orders: charts, detail panel, bulk actions, command menu.
const overview = (browser) =>
  session(browser, "orbit-v5-overview-orders.webm", async (page) => {
    await page.goto(base + "#/", { waitUntil: "domcontentloaded" });
    await page.mouse.move(400, 500);
    await page.waitForTimeout(2600);
    await page.mouse.move(1150, 300, { steps: 30 });
    await page.waitForTimeout(400);
    await click(page, page.locator(".hero__actions .ui-btn--primary"), 2600);
    for (const label of ["7 дн", "90 дн", "30 дн"]) await click(page, page.getByRole("radio", { name: label, exact: true }), 1000);
    await click(page, page.locator(".revenue").getByRole("radio", { name: "Заказы" }), 900);
    await click(page, page.locator(".revenue").getByRole("radio", { name: "Выручка" }), 800);
    const plot = await page.locator(".revenue .chart__hit rect").boundingBox();
    await page.mouse.move(plot.x + 20, plot.y + plot.height / 2, { steps: 10 });
    await page.mouse.move(plot.x + plot.width - 10, plot.y + plot.height / 2, { steps: 50 });
    await page.waitForTimeout(400);
    await click(page, nav(page, "Заказы"), 1300);
    await click(page, page.getByRole("radio", { name: /К упаковке/ }), 1100);
    await click(page, page.getByRole("radio", { name: /^Все/ }), 1100);
    const sort = page.locator('select:has(option[value="highest"])');
    await sort.selectOption("highest");
    await page.waitForTimeout(1200);
    await sort.selectOption("newest");
    await page.waitForTimeout(1100);
    await click(page, page.locator(".orders-table__body .orders-row").first(), 1400);
    await click(page, page.locator(".od-next .ui-btn--primary"), 1400);
    await click(page, page.locator(".ui-toast__undo").first(), 1100);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    await click(page, page.getByRole("radio", { name: /К упаковке/ }), 1100);
    await click(page, page.locator(".orders-row--head .ui-check"), 900);
    await click(page, page.locator(".bulk .ui-btn--primary"), 1700);
    await click(page, page.locator(".ui-toast__undo").first(), 1300);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(600);
    await page.keyboard.type("berlin", { delay: 80 });
    await page.waitForTimeout(600);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
  });

// Customers, Products, Payments and Analytics.
const sections = (browser) =>
  session(browser, "orbit-v5-catalog-money.webm", async (page) => {
    await page.goto(base + "#/customers", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    await click(page, page.getByRole("radio", { name: /^VIP/ }), 1100);
    await click(page, page.locator(".dt-body .dt-row").first(), 1600);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    await click(page, nav(page, "Товары"), 1500);
    await glide(page, page.locator(".pcard").nth(1));
    await page.waitForTimeout(400);
    await click(page, page.locator(".pcard").nth(7), 1600);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    await click(page, page.getByRole("radio", { name: /На исходе/ }), 1200);
    await click(page, nav(page, "Платежи"), 1500);
    await click(page, page.getByRole("radio", { name: /Отклонённые/ }), 1200);
    await click(page, page.locator(".dt-body .dt-row").first(), 1600);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    await click(page, nav(page, "Аналитика"), 2200);
    for (const label of ["90 дн", "12 мес", "30 дн"]) await click(page, page.getByRole("radio", { name: label, exact: true }), 1100);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(1400);
    await glide(page, page.locator(".heat__cell").nth(140));
    await page.waitForTimeout(800);
  });

// Tasks board, Messages and Settings.
const work = (browser) =>
  session(browser, "orbit-v5-team.webm", async (page) => {
    await page.goto(base + "#/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    const cols = page.locator(".board__col");
    const from = await cols.nth(0).locator(".tcard").first().boundingBox();
    const to = await cols.nth(1).boundingBox();
    await page.mouse.move(from.x + 60, from.y + 24, { steps: 16 });
    await page.mouse.down();
    await page.mouse.move(from.x + 90, from.y + 40, { steps: 6 });
    await page.mouse.move(to.x + to.width / 2, to.y + 180, { steps: 40 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(1300);
    await click(page, cols.nth(1).locator(".tcard").first(), 1500);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    await click(page, nav(page, "Сообщения"), 1500);
    await click(page, page.locator(".thread-item").nth(0), 1300);
    await click(page, page.locator(".chip-button").nth(1), 700);
    await page.keyboard.press("Control+Enter");
    await page.waitForTimeout(1500);
    await click(page, page.locator(".thread-item").nth(2), 1200);
    await click(page, nav(page, "Настройки"), 1400);
    await page.getByLabel("Имя и фамилия").click();
    await page.keyboard.type(" Jr", { delay: 90 });
    await page.waitForTimeout(900);
    await click(page, page.getByRole("tab", { name: /Команда и роли/ }), 1300);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(900);
    await click(page, page.locator(".matrix thead th").nth(3).getByRole("button"), 1500);
    await click(page, page.locator(".preview-banner").getByRole("button"), 1200);
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(1500);
  });

// Phone: landing, Overview, the order sheet, the task board and a conversation.
const mobile = (browser) =>
  session(
    browser,
    "orbit-v5-mobile.webm",
    async (page) => {
      await page.goto(base + "#/", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2400);
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 420);
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(900);
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.locator(".hero__actions .ui-btn--primary").tap();
      await page.waitForTimeout(2400);
      await page.getByRole("radio", { name: "7 дн", exact: true }).tap();
      await page.waitForTimeout(1200);
      await page.locator(".shell-topbar__menu").tap();
      await page.waitForTimeout(800);
      await nav(page, "Заказы").tap();
      await page.waitForTimeout(1500);
      await page.locator(".orders-table__body .orders-row").first().tap();
      await page.waitForTimeout(1500);
      const grip = await page.locator(".ui-drawer__grip").boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + 3);
      await page.mouse.down();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + 380, { steps: 14 });
      await page.mouse.up();
      await page.waitForTimeout(1200);
      await page.locator(".shell-topbar__menu").tap();
      await page.waitForTimeout(700);
      await nav(page, "Задачи").tap();
      await page.waitForTimeout(1500);
      await page.locator(".board").evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: "smooth" }));
      await page.waitForTimeout(1100);
      await page.locator(".board").evaluate((el) => el.scrollTo({ left: 0, behavior: "smooth" }));
      await page.waitForTimeout(900);
      await page.locator(".shell-topbar__menu").tap();
      await page.waitForTimeout(700);
      await nav(page, "Сообщения").tap();
      await page.waitForTimeout(1400);
      await page.locator(".thread-item").first().tap();
      await page.waitForTimeout(1400);
      await page.getByRole("button", { name: "Назад" }).tap();
      await page.waitForTimeout(1200);
    },
    { width: 390, height: 844 },
    { deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  );

(async () => {
  const browser = await chromium.launch();
  if (which === "all" || which === "overview") await overview(browser);
  if (which === "all" || which === "sections") await sections(browser);
  if (which === "all" || which === "work") await work(browser);
  if (which === "all" || which === "mobile") await mobile(browser);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
