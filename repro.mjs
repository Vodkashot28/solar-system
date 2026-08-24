import { chromium } from "/root/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";

const errors = [];
const consoleMsgs = [];

async function probe(url, label) {
  console.log(`\n===== ${label} :: ${url} =====`);
  const browser = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome", args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  const errs = [];
  const msgs = [];
  page.on("pageerror", (e) => errs.push(`PAGEERROR: ${e.message}\n${e.stack || ""}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") msgs.push(`[${m.type()}] ${m.text()}`);
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);
  console.log("PAGE ERRORS:");
  console.log(errs.length ? errs.join("\n\n") : "(none)");
  console.log("CONSOLE (error/warning):");
  console.log(msgs.length ? msgs.slice(0, 40).join("\n") : "(none)");
  await browser.close();
}

await probe("http://localhost:5000/", "MAIN SCENE");
await probe("http://localhost:5000/#/ar/orrery", "AR ORRERY");
