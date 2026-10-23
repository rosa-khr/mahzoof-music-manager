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
test("password eyes preserve values, eight-character creation and reset work, theme remains RTL", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  const loginPassword = page.getByLabel("رمز عبور", { exact: true });
  await loginPassword.fill("Pass1234");
  await page
    .getByRole("button", { name: "نمایش رمز عبور", exact: true })
    .click();
  await expect(loginPassword).toHaveAttribute("type", "text");
  await expect(loginPassword).toHaveValue("Pass1234");
  await page
    .getByRole("button", { name: "پنهان‌کردن رمز عبور", exact: true })
    .click();
  await expect(loginPassword).toHaveAttribute("type", "password");
  await login(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-theme-dashboard.png`,
    fullPage: true,
  });
  await page.goto("/users/new");
  const username = "eight-ui-" + info.project.name;
  await page.getByLabel("نام کاربری *", { exact: true }).fill(username);
  const initial = page.getByLabel("رمز اولیه (حداقل ۸ نویسه) *", {
    exact: true,
  });
  await expect(initial).toHaveAttribute("minlength", "8");
  await initial.fill("Pass1234");
  await page
    .getByRole("button", { name: "نمایش رمز اولیه", exact: true })
    .click();
  await expect(initial).toHaveAttribute("type", "text");
  await expect(initial).toHaveValue("Pass1234");
  await page
    .getByRole("button", { name: "پنهان‌کردن رمز اولیه", exact: true })
    .click();
  await page.getByRole("button", { name: "ایجاد کاربر", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "مدیریت کاربران", exact: true }),
  ).toBeVisible();
  await page.locator(".ag-header [col-id=username] input").fill(username);
  await page
    .getByRole("button", { name: "ریست رمز " + username, exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "ریست رمز عبور",
    exact: true,
  });
  const password = modal.getByLabel("رمز جدید (حداقل ۸ نویسه) *", {
      exact: true,
    }),
    confirm = modal.getByLabel("تکرار رمز جدید *", { exact: true });
  await password.fill("Newp5678");
  await confirm.fill("Newp5678");
  const eye = modal.getByRole("button", {
    name: "نمایش رمز جدید",
    exact: true,
  });
  await eye.focus();
  await page.keyboard.press("Space");
  await expect(password).toHaveAttribute("type", "text");
  await expect(confirm).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("Newp5678");
  await modal
    .getByRole("button", { name: "پنهان‌کردن رمز جدید", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "نمایش تکرار رمز جدید", exact: true })
    .click();
  await expect(confirm).toHaveAttribute("type", "text");
  await modal
    .getByRole("button", { name: "پنهان‌کردن تکرار رمز جدید", exact: true })
    .click();
  const overlap = await password.evaluate((input) => {
    const button = input.parentElement!.querySelector("button")!;
    const b = button.getBoundingClientRect(),
      r = input.getBoundingClientRect();
    return (
      b.left < r.left ||
      b.right > r.right ||
      b.top < r.top ||
      b.bottom > r.bottom
    );
  });
  expect(overlap).toBe(false);
  await page.screenshot({
    path: `test-results/${info.project.name}-password-eye-modal.png`,
    fullPage: true,
  });
  await modal
    .getByRole("button", { name: "ریست رمز و پایان نشست‌ها", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("رمز عبور ریست شد");
  await page.goto("/account");
  await page.getByLabel("رمز فعلی", { exact: true }).fill("Pass1234");
  await page
    .getByRole("button", { name: "نمایش رمز فعلی", exact: true })
    .click();
  await expect(page.getByLabel("رمز فعلی", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await expect(
    page.getByLabel("رمز جدید (حداقل ۸ نویسه)", { exact: true }),
  ).toHaveAttribute("minlength", "8");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
