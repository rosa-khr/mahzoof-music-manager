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
test("floating labels, sm controls and persisted student active/archive switches", async ({
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
  expect(before.gap).toBeLessThan(0);
  expect(before.height).toBe(38);
  await first.fill("سوییچ");
  await first.focus();
  await expect
    .poll(() =>
      first.evaluate(
        (el) => el.nextElementSibling!.getBoundingClientRect().top,
      ),
    )
    .toBeLessThan(before.labelTop);
  await page
    .getByLabel("نام خانوادگی فارسی *", { exact: true })
    .fill(info.project.name);
  await page.getByLabel("تماس هنرجو", { exact: true }).fill("+989121234567");
  const combo = page.getByRole("combobox", {
    name: "واحد آموزشی موردنظر *",
    exact: true,
  });
  await page
    .getByRole("tab", { name: "اطلاعات ساز و جلسه", exact: true })
    .click();
  await combo.click();
  await page.getByRole("option", { name: "پیانو", exact: true }).click();
  expect(await combo.evaluate((el) => el.getBoundingClientRect().height)).toBe(
    38,
  );
  await page.getByRole("tab", { name: "اطلاعات فردی", exact: true }).click();
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
test("user list is readonly; SweetAlert cancellation, lock, reload and last-admin protection", async ({
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
  const user = await response.json();
  const nativeDialogs: string[] = [];
  page.on("dialog", (d) => {
    nativeDialogs.push(d.type());
    void d.dismiss();
  });
  await page.goto("/users");
  await page.locator(".ag-header [col-id=username] input").fill(username);
  await expect(page.locator("app-data-grid").getByRole("switch")).toHaveCount(
    0,
  );
  await page
    .getByRole("link", { name: "ویرایش کاربر " + username, exact: true })
    .click();
  const toggle = page.getByRole("switch", {
    name: "فعال بودن حساب",
    exact: true,
  });
  await toggle.uncheck();
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  const confirm = page.locator(".swal2-popup");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("قفل‌کردن حساب کاربر؟");
  await confirm.evaluate(async (el) => {
    await Promise.all(
      el.getAnimations().map((animation) => animation.finished),
    );
  });
  await page.screenshot({
    path: `test-results/${info.project.name}-sweetalert-confirm.png`,
    fullPage: true,
  });
  await confirm.getByRole("button", { name: "انصراف", exact: true }).click();
  expect(
    (await (await page.request.get("/api/users/" + user.id)).json()).active,
  ).toBe(1);
  await expect(toggle).not.toBeChecked();
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await confirm
    .getByRole("button", { name: "بله، ذخیره شود", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "مدیریت کاربران", exact: true }),
  ).toBeVisible();
  await page.reload();
  expect(
    (await (await page.request.get("/api/users/" + user.id)).json()).active,
  ).toBe(0);
  await page.locator(".ag-header [col-id=username] input").fill(username);
  if (info.project.name === "mobile")
    await page.locator(".ag-body-horizontal-scroll-viewport").evaluate((el) => {
      el.scrollLeft = -el.scrollWidth;
    });
  await expect(
    page.locator("app-data-grid .ag-row [col-id=username]"),
  ).toHaveCount(1);
  await expect(page.locator("app-data-grid .status")).toHaveText("قفل‌شده");
  await expect(page.locator("app-data-grid").getByRole("switch")).toHaveCount(
    0,
  );
  await page.goto("/users/" + me.user.id + "/edit");
  await toggle.uncheck();
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await confirm
    .getByRole("button", { name: "بله، ذخیره شود", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("آخرین مدیر");
  expect(
    (await (await page.request.get("/api/users/" + me.user.id)).json()).active,
  ).toBe(1);
  expect(nativeDialogs).toEqual([]);
});
