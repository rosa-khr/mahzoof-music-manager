import { test, expect, Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill("e2e-admin");
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
}
test("fixed labels, sm controls and persisted student active/archive switches", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto("/students/new");
  const first = page.getByLabel("نام فارسی *", { exact: true });
  const before = await first.evaluate((el) => {
    const input = el.getBoundingClientRect(),
      label = el.nextElementSibling!.getBoundingClientRect();
    return {
      gap: input.top - label.bottom,
      labelTop: label.top,
      height: input.height,
    };
  });
  expect(before.gap).toBeGreaterThanOrEqual(0);
  expect(before.height).toBe(38);
  await first.fill("سوییچ");
  await first.focus();
  expect(
    await first.evaluate(
      (el) => el.nextElementSibling!.getBoundingClientRect().top,
    ),
  ).toBe(before.labelTop);
  await page
    .getByLabel("نام خانوادگی فارسی *", { exact: true })
    .fill(info.project.name);
  await page.getByLabel("تماس هنرجو", { exact: true }).fill("+989121234567");
  const combo = page.getByRole("combobox", {
    name: "واحد آموزشی موردنظر *",
    exact: true,
  });
  await combo.click();
  await page.getByRole("option", { name: "پیانو", exact: true }).click();
  expect(await combo.evaluate((el) => el.getBoundingClientRect().height)).toBe(
    38,
  );
  const active = page.getByRole("switch", {
    name: "فعال بودن هنرجو",
    exact: true,
  });
  await active.focus();
  await active.press("Space");
  await expect(active).not.toBeChecked();
  await page
    .getByRole("switch", { name: "بایگانی پرونده", exact: true })
    .check();
  await expect(active).toHaveCount(0);
  await page.screenshot({
    path: `test-results/${info.project.name}-compact-switches.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "ثبت و باز کردن پرونده" }).click();
  await expect(
    page.getByRole("heading", {
      name: "سوییچ " + info.project.name,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("app-badge")).toContainText("بایگانی");
  await page.getByRole("link", { name: "ویرایش هنرجو", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "بایگانی پرونده", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("switch", { name: "بایگانی پرونده", exact: true })
    .uncheck();
  await expect(active).not.toBeChecked();
  await active.check();
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "سوییچ " + info.project.name,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("app-badge")).toContainText("فعال");
  expect(errors).toEqual([]);
});
test("staff switch persists, cancellation restores state and last-admin protection remains", async ({
  page,
}, info) => {
  await login(page);
  const me = await (await page.request.get("/api/auth/me")).json();
  const username = "switch-" + info.project.name;
  const response = await page.request.post("/api/users", {
    headers: { Origin: "http://localhost:4310", "X-CSRF-Token": me.csrf },
    data: {
      username,
      password: process.env["E2E_PASSWORD"],
      role: "secretary",
    },
  });
  expect(response.status()).toBe(201);
  await page.goto("/account");
  const toggle = page.getByRole("switch", {
    name: "فعال بودن " + username,
    exact: true,
  });
  await expect(toggle).toBeChecked();
  page.once("dialog", (d) => d.dismiss());
  await toggle.click();
  await expect(toggle).toBeChecked();
  page.once("dialog", (d) => d.accept());
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  const admin = page.getByRole("switch", {
    name: "فعال بودن e2e-admin",
    exact: true,
  });
  page.once("dialog", (d) => d.accept());
  await admin.click();
  await expect(page.getByRole("alert")).toContainText("آخرین مدیر");
  await expect(admin).toBeChecked();
});
