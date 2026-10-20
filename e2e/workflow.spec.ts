import { chooseSelect2, nativeSelect } from "./select2-helper";
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
async function openStudents(page: Page) {
  await page
    .getByRole("link", { name: "پرونده هنرجویان", exact: true })
    .last()
    .click();
}
test("real first delivery workflow, lost payment response retry, Persian RTL compact labeled fields and renewal", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      msg.text().includes("Content Security Policy")
    )
      errors.push(msg.text());
  });
  await login(page);
  await openStudents(page);
  await page.getByRole("link", { name: "ثبت هنرجو", exact: true }).click();
  await page.getByLabel("نام فارسی *", { exact: true }).fill("هنرجوی");
  await page
    .getByLabel("نام خانوادگی فارسی *", { exact: true })
    .fill("آزمایشی " + testInfo.project.name);
  await page.getByLabel("تماس هنرجو", { exact: true }).fill("+989123450000");
  await chooseSelect2(page, "واحد آموزشی موردنظر *", "1");
  await page.getByRole("button", { name: "ثبت و باز کردن پرونده" }).click();
  await expect(
    page.getByRole("heading", {
      name: "هنرجوی آزمایشی " + testInfo.project.name,
      exact: true,
    }),
  ).toBeVisible();
  const profileUrl = page.url();
  await page.getByRole("button", { name: "ترم جدید", exact: true }).click();
  await chooseSelect2(page, "واحد آموزشی *", "1");
  await page
    .getByLabel("مبلغ پایه (ارز انتخاب‌شده) *", { exact: true })
    .fill("8000000");
  await page.getByRole("button", { name: "ثبت ترم", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /پیانو • ترم 1/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "ثبت پرداخت", exact: true })
    .first()
    .click();
  await chooseSelect2(page, "ترم و صورتحساب مقصد *", { index: 1 });
  await chooseSelect2(page, "روش دریافت", "bank");
  await expect(
    page.getByRole("combobox", { name: "حساب مقصد *", exact: true }),
  ).toBeVisible();
  await chooseSelect2(page, "روش دریافت", "cash");
  await expect(
    page.getByRole("combobox", { name: "حساب مقصد *", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("مبلغ دریافت در ارز ترم *", { exact: true })
    .fill("5000000");
  let lost = false;
  await page.route("**/api/payments", async (route) => {
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "تأیید و ثبت دریافت" }).click();
  await expect(page.getByRole("alert")).toContainText("ارتباط با سرور");
  await expect(
    page.getByLabel("مبلغ دریافت در ارز ترم *", { exact: true }),
  ).toHaveValue("5000000");
  await page.getByRole("button", { name: "تأیید و ثبت دریافت" }).click();
  await expect(page.locator(".alert-success")).toContainText("موفقیت");
  await page.unroute("**/api/payments");
  await expect(page.locator(".invoice-summary")).toContainText("۳٬۰۰۰٬۰۰۰");
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "ثبت جلسه", exact: true }).click();
    await chooseSelect2(page, "ترم مقصد *", { index: 1 });
    await page
      .getByLabel("تاریخ شمسی جلسه *", { exact: true })
      .fill("۱۴۰۴/۱۰/۱۱");
    await page.getByLabel("ساعت تهران *", { exact: true }).fill("10:00");
    await page.getByRole("button", { name: "ثبت رزرو", exact: true }).click();
    await expect(page.locator(".action-panel")).toHaveCount(0);
    if (i === 3) {
      await page.goto("/");
      await expect(
        page.locator(".followup-card .ag-row[row-id]"),
      ).not.toHaveCount(0);
      await expect(
        page.locator(".renewal-card .ag-row[row-id]"),
      ).not.toHaveCount(0);
      await page.screenshot({
        path: `test-results/${testInfo.project.name}-followups.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.goto(profileUrl);
    }
    const row = page.locator(".term-card .ag-row[row-id]").last();
    await row.getByRole("button", { name: "ثبت / اصلاح وضعیت" }).click();
    if (i === 0) {
      await chooseSelect2(page, "وضعیت جلسه", "absent");
      await expect(
        page.getByRole("switch", { name: "اثر غیبت بر سهم *", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "تأیید بدون کسر سهم", exact: true })
        .click();
      await chooseSelect2(page, "وضعیت جلسه", "cancelled");
      await expect(
        page.getByRole("switch", { name: "اثر غیبت بر سهم *", exact: true }),
      ).toHaveCount(0);
      await chooseSelect2(page, "لغوکننده *", "teacher");
    }
    await chooseSelect2(page, "وضعیت جلسه", "present");
    await page
      .getByRole("button", { name: "تأیید وضعیت", exact: true })
      .click();
    await expect(page.locator(".action-panel")).toHaveCount(0);
  }
  await expect(page.locator(".term-heading")).toContainText("تکمیل‌شده");
  await expect(page.locator(".invoice-summary")).toContainText("پرداخت جزئی");
  await page.getByRole("button", { name: "تمدید با مشخصات همین ترم" }).click();
  await expect(nativeSelect(page, "واحد آموزشی *")).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "واحد آموزشی *", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByLabel("مبلغ پایه (ارز انتخاب‌شده) *", { exact: true }),
  ).toHaveValue("8000000");
  await page
    .getByLabel("مبلغ پایه (ارز انتخاب‌شده) *", { exact: true })
    .fill("9000000");
  await page.getByRole("button", { name: "ثبت ترم", exact: true }).click();
  await expect(page.locator(".term-card")).toHaveCount(2);
  await expect(page.locator(".term-card").first()).toContainText("ترم 2");
  await expect(page.locator(".term-card").first()).toContainText(
    "رکوردی برای نمایش وجود ندارد",
  );
  await page.getByRole("button", { name: "مالی", exact: true }).click();
  const invoices = page.locator('app-data-grid[title="صورتحساب‌ها"]');
  const payments = page.locator('app-data-grid[title="دریافت‌ها"]');
  await expect(invoices.locator(".ag-row[row-id]")).toHaveCount(2);
  await expect(payments.locator(".ag-row[row-id]")).toHaveCount(1);
  await expect(payments.locator(".ag-row[row-id]")).toContainText("۵٬۰۰۰٬۰۰۰");
  if (testInfo.project.name === "desktop") {
    const statusFilter = invoices.getByRole("textbox", {
      name: "وضعیت مقدار فیلتر",
      exact: true,
    });
    await statusFilter.fill("پرداخت جزئی");
    await expect(invoices.locator(".ag-row[row-id]")).toHaveCount(1);
    await statusFilter.fill("");
    await page.keyboard.press("Escape");
    await expect(invoices.locator(".ag-row[row-id]")).toHaveCount(2);
  }

  await invoices
    .getByRole("button", { name: "ثبت پرداخت", exact: true })
    .first()
    .click();
  await expect(page.locator(".action-panel")).toBeVisible();
  await expect(nativeSelect(page, "ترم و صورتحساب مقصد *")).not.toHaveValue("");
  await page.getByRole("button", { name: "انصراف", exact: true }).click();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-finance.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.goto(profileUrl + "?tab=attendance");
  const attendance = page.locator('app-data-grid[title="جلسات و حضور و غیاب"]');
  await expect(page.locator("#term-filter,.filter-row")).toHaveCount(0);
  await expect(attendance.locator(".ag-row[row-id]")).toHaveCount(4);
  const termFilter = attendance.locator(".ag-header [col-id=term] input");
  await termFilter.fill("ترم 2");
  await expect(attendance.locator(".ag-row[row-id]")).toHaveCount(0);
  await termFilter.fill("");
  await expect(attendance.locator(".ag-row[row-id]")).toHaveCount(4);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-attendance-filters.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.goto(profileUrl);
  await expect(page.locator(".term-card")).toHaveCount(2);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-profile.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "ترم جدید", exact: true }).click();
  const field = page.getByLabel("مبلغ پایه (ارز انتخاب‌شده) *", {
    exact: true,
  });
  await field.fill("0");
  await field.blur();
  await expect
    .poll(async () =>
      field.evaluate((el) => {
        const label = el.nextElementSibling!.getBoundingClientRect();
        return label.bottom - el.getBoundingClientRect().top;
      }),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-compact-labels.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "انصراف", exact: true }).click();
  // Populate today's operational view through the real reservation form.
  await page.getByRole("button", { name: "ثبت جلسه", exact: true }).click();
  await chooseSelect2(page, "ترم مقصد *", { index: 1 });
  await page.getByLabel("ساعت تهران *", { exact: true }).fill("16:30");
  await page.getByRole("button", { name: "ثبت رزرو", exact: true }).click();
  await expect(page.locator(".action-panel")).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator(".schedule-card .ag-row[row-id]")).not.toHaveCount(
    0,
  );
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-dashboard.png`,
    fullPage: true,
    animations: "disabled",
  });
  if (testInfo.project.name === "mobile") {
    const toggle = page.getByRole("button", { name: "باز و بسته کردن منو" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".sidebar")).toHaveClass(/open/);
    await page.screenshot({
      path: "test-results/mobile-navigation.png",
      fullPage: false,
      animations: "disabled",
    });
    expect(
      await page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    ).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  } else {
    const collapse = page.getByRole("button", { name: "جمع کردن سایدبار" });
    await collapse.click();
    await expect(collapse).toHaveAttribute("aria-expanded", "false");
    await page.screenshot({
      path: "test-results/desktop-collapsed.png",
      fullPage: true,
      animations: "disabled",
    });
    await collapse.click();
  }
  await openStudents(page);
  await expect(page.locator("app-data-grid .ag-row[row-id]")).not.toHaveCount(
    0,
  );
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-students.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "ثبت هنرجو", exact: true }).click();
  await page.getByLabel("نام فارسی *", { exact: true }).fill("نام آزمایشی");
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-registration.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "حساب و دسترسی‌ها", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-account.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
test("invalid Persian date stays editable without creating a term", async ({
  page,
}) => {
  await login(page);
  await openStudents(page);
  await page.getByRole("link", { name: "باز کردن پرونده" }).first().click();
  await page.getByRole("button", { name: "ترم جدید", exact: true }).click();
  await chooseSelect2(page, "واحد آموزشی *", "1");
  await page
    .getByLabel("مبلغ پایه (ارز انتخاب‌شده) *", { exact: true })
    .fill("1");
  await page
    .getByLabel("تاریخ ثبت‌نام شمسی *", { exact: true })
    .fill("۱۴۰۴/۱۲/۳۰");
  await page.getByRole("button", { name: "ثبت ترم", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("تاریخ شمسی نامعتبر");
  await expect(
    page.getByLabel("مبلغ پایه (ارز انتخاب‌شده) *", { exact: true }),
  ).toHaveValue("1");
});
