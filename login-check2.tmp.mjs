import { spawn } from "node:child_process";
import { chromium, devices, webkit } from "@playwright/test";
const out = process.argv[2];
const port = 3000;
const server = spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], { shell: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const base = `http://localhost:${port}`;
try {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(`${base}/login`);
      break;
    } catch {
      await wait(500);
    }
  }
  for (const [name, engine, device] of [
    ["webkit", webkit, devices["iPhone 13"]],
    ["chromium", chromium, devices["Pixel 7"]],
  ]) {
    const browser = await engine.launch();
    const ctx = await browser.newContext({ ...device });
    // Slow the sign-in response so the "submitting" label can be captured.
    await ctx.route("**/api/auth/sign-in/username", async (route) => {
      await wait(1500);
      await route.continue();
    });
    const page = await ctx.newPage();
    await page.goto(`${base}/login`);
    await page.getByLabel("اسم المستخدم").fill("demo");
    await page.getByLabel("كلمة المرور", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "دخول" }).click();
    await wait(400);
    await page.screenshot({ path: `${out}/${name}-submitting.png` });
    const error = page.getByText("اسم المستخدم أو كلمة المرور غير صحيحة");
    await error.waitFor({ timeout: 30000 });
    console.log(name, "error shown:", await error.isVisible());
    await page.screenshot({ path: `${out}/${name}-wrong.png` });
    await browser.close();
  }
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { shell: true });
}
