import { test, expect, Page } from "@playwright/test";
import { chooseSelect2 } from "./select2-helper";
async function login(page: Page, role = "admin") {
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill("e2e-" + role);
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
}
async function showStatus(page: Page) {
  await page.locator(".ag-body-horizontal-scroll-viewport").evaluate((el) => {
    el.scrollLeft = -el.scrollWidth;
  });
}
test("unified users: create, edit, reset password, revoke sessions, lock and unlock", async ({
  page,
  playwright,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "باز و بسته کردن منو" }).click();
  const nav = page.getByRole("navigation", { name: "منوی اصلی" });
  await nav.getByRole("button", { name: "تنظیمات", exact: true }).click();
  await expect(
    nav.getByRole("link", { name: "حساب و دسترسی‌ها", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "کاربران و نقش‌ها", exact: true }),
  ).toHaveCount(0);
  await nav
    .getByRole("button", { name: "مدیریت امنیت", exact: true })
    .click();
  await nav.getByRole("link", { name: "کاربران", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "مدیریت کاربران", exact: true }),
  ).toBeVisible();
  const username = "staff-" + info.project.name;
  await page.getByRole("link", { name: "ثبت کاربر", exact: true }).click();
  await page.getByLabel("نام کاربری *", { exact: true }).fill(username);
  await page
    .getByLabel("رمز اولیه (حداقل ۸ نویسه) *", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await chooseSelect2(page, "نقش *", "secretary");
  await page.getByRole("button", { name: "ایجاد کاربر", exact: true }).click();
  const grid = page.locator("app-data-grid");
  await grid.locator(".ag-header [col-id=username] input").fill(username);
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(1);
  await grid
    .getByRole("link", { name: "ویرایش کاربر " + username, exact: true })
    .click();
  await expect(page.getByLabel("نام کاربری *", { exact: true })).toHaveValue(
    username,
  );
  await expect(page.locator('.primary-nav a[href="/users"]')).toHaveClass(
    /selected/,
  );
  await chooseSelect2(page, "نقش *", "accountant");
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await page
    .getByRole("button", { name: "بله، ذخیره شود", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "مدیریت کاربران", exact: true }),
  ).toBeVisible();
  await grid.locator(".ag-header [col-id=username] input").fill(username);
  const staff = await playwright.request.newContext({
    baseURL: "http://localhost:4310",
    extraHTTPHeaders: { Origin: "http://localhost:4310" },
  });
  try {
    expect(
      (
        await staff.post("/api/auth/login", {
          data: { username, password: process.env["E2E_PASSWORD"] },
        })
      ).status(),
    ).toBe(200);
    await grid
      .getByRole("button", { name: "ریست رمز " + username, exact: true })
      .click();
    const replacement = process.env["E2E_PASSWORD"]! + "-reset";
    await page
      .getByLabel("رمز جدید (حداقل ۸ نویسه) *", { exact: true })
      .fill(replacement);
    await page
      .getByLabel("تکرار رمز جدید *", { exact: true })
      .fill("different");
    await page
      .getByRole("button", { name: "ریست رمز و پایان نشست‌ها", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("برابر نیست");
    await page
      .getByLabel("تکرار رمز جدید *", { exact: true })
      .fill(replacement);
    await page.screenshot({
      path: `test-results/${info.project.name}-reset-password-modal.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "ریست رمز و پایان نشست‌ها", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("رمز عبور ریست شد");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/users$/);
    expect((await staff.get("/api/auth/me")).status()).toBe(401);
    expect(
      (
        await staff.post("/api/auth/login", {
          data: { username, password: process.env["E2E_PASSWORD"] },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await staff.post("/api/auth/login", {
          data: { username, password: replacement },
        })
      ).status(),
    ).toBe(200);
    await page.screenshot({
      path: `test-results/${info.project.name}-user-edit.png`,
      fullPage: true,
    });

    await grid.locator(".ag-header [col-id=username] input").fill(username);
    await expect(grid.getByRole("switch")).toHaveCount(0);
    await grid
      .getByRole("link", { name: "ویرایش کاربر " + username, exact: true })
      .click();
    await page
      .getByRole("switch", { name: "فعال بودن حساب", exact: true })
      .uncheck();
    await page
      .getByRole("button", { name: "ذخیره تغییرات", exact: true })
      .click();
    await page
      .getByRole("button", { name: "بله، ذخیره شود", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "مدیریت کاربران", exact: true }),
    ).toBeVisible();
    expect((await staff.get("/api/auth/me")).status()).toBe(401);
    expect(
      (
        await staff.post("/api/auth/login", {
          data: { username, password: replacement },
        })
      ).status(),
    ).toBe(401);
    await page.reload();
    await grid.locator(".ag-header [col-id=username] input").fill(username);
    await expect(grid.locator(".ag-row [col-id=username]")).toHaveCount(1);
    if (info.project.name === "mobile") await showStatus(page);
    await expect(grid.locator(".status")).toHaveText("قفل‌شده");
    await expect(grid.getByRole("switch")).toHaveCount(0);
    await page.screenshot({
      path: `test-results/${info.project.name}-users.png`,
      fullPage: true,
    });
    await grid
      .getByRole("link", { name: "ویرایش کاربر " + username, exact: true })
      .click();
    await page
      .getByRole("switch", { name: "فعال بودن حساب", exact: true })
      .check();
    await page
      .getByRole("button", { name: "ذخیره تغییرات", exact: true })
      .click();
    await page
      .getByRole("button", { name: "بله، ذخیره شود", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "مدیریت کاربران", exact: true }),
    ).toBeVisible();
    expect(
      (
        await staff.post("/api/auth/login", {
          data: { username, password: replacement },
        })
      ).status(),
    ).toBe(200);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await staff.dispose();
  }
});
for (const role of ["secretary", "accountant"])
  test(
    role + " cannot access user administration and keeps personal password",
    async ({ page }) => {
      await login(page, role);
      await expect(page.locator('.primary-nav a[href="/users"]')).toHaveCount(
        0,
      );
      for (const path of ["/users", "/users/new", "/users/1/edit"]) {
        await page.goto(path);
        await expect(page).toHaveURL("http://localhost:4310/");
      }
      await page.getByRole("link", { name: "حساب شخصی", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "حساب شخصی", exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("رمز فعلی", { exact: true })).toBeVisible();
      await expect(page.locator("app-data-grid")).toHaveCount(0);
    },
  );

test("password modal: Escape, focus, cancellation, errors and preserving edit draft", async ({
  page,
}, info) => {
  await login(page);
  const me = await (await page.request.get("/api/auth/me")).json();
  const r = await page.request.post("/api/users", {
    headers: { Origin: "http://localhost:4310", "X-CSRF-Token": me.csrf },
    data: {
      username: "modal-" + info.project.name,
      password: process.env["E2E_PASSWORD"],
      role: "secretary",
    },
  });
  expect(r.status()).toBe(201);
  const user = await r.json();
  await page.goto("/users");
  await page.locator(".ag-header [col-id=username] input").fill(user.username);
  const trigger = page.getByRole("button", {
    name: "ریست رمز " + user.username,
    exact: true,
  });
  await trigger.click();
  const modal = page.getByRole("dialog", {
    name: "ریست رمز عبور",
    exact: true,
  });
  await expect(modal).toBeVisible();
  const first = modal.getByLabel("رمز جدید (حداقل ۸ نویسه) *", {
    exact: true,
  });
  await expect(first).toBeFocused();
  await first.fill("Disposable-Password-2026");
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(first).toHaveValue("");
  await modal.getByRole("button", { name: "انصراف", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.goto(`/users/${user.id}/edit`);
  await expect(page.locator("#password-reset")).toHaveCount(0);
  await expect(
    page.getByLabel("رمز جدید (حداقل ۸ نویسه) *", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("نام کاربری *", { exact: true }).fill("unsaved-name");
  await page
    .getByRole("button", { name: "ریست رمز عبور", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "بستن پنجره ریست رمز", exact: true })
    .click();
  await expect(page.getByLabel("نام کاربری *", { exact: true })).toHaveValue(
    "unsaved-name",
  );
  await page
    .getByRole("button", { name: "ریست رمز عبور", exact: true })
    .click();
  await first.fill("Replacement-Password-2026");
  await modal
    .getByLabel("تکرار رمز جدید *", { exact: true })
    .fill("Replacement-Password-2026");
  await page.route(`**/api/users/${user.id}/reset-password`, (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "اطلاعات کاربر تغییر کرده است" }),
    }),
  );
  await modal
    .getByRole("button", { name: "ریست رمز و پایان نشست‌ها", exact: true })
    .click();
  await expect(modal.getByRole("alert")).toContainText(
    "اطلاعات کاربر تغییر کرده",
  );
  await expect(first).toHaveValue("Replacement-Password-2026");
  await modal.getByRole("button", { name: "انصراف", exact: true }).click();
  await page.unroute(`**/api/users/${user.id}/reset-password`);
  const unchanged = await (
    await page.request.get("/api/users/" + user.id)
  ).json();
  expect(unchanged.version).toBe(user.version);
  await page.goto(`/users/${user.id}/edit?password=1`);
  await expect(modal).toBeVisible();
  await expect(first).toHaveValue("");
  await modal.getByRole("button", { name: "انصراف", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/users/${user.id}/edit$`));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
});
