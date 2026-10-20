import { test, expect, Page } from "@playwright/test";

async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill(`e2e-${role}`);
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
}
test("student row actions open the matching student form and fit desktop/mobile", async ({
  page,
}, info) => {
  await login(page, "admin");
  const me = await (await page.request.get("/api/auth/me")).json();
  const response = await page.request.post("/api/students", {
    headers: { Origin: "http://localhost:4310", "X-CSRF-Token": me.csrf },
    data: {
      firstName: "عملیات",
      lastName: info.project.name,
      phone: "+989121234567",
      subjectId: 1,
      history: "new",
    },
  });
  expect(response.status()).toBe(201);
  const s = await response.json();
  const list = "/students?q=" + s.code;
  await page.goto(list);
  const cell = page.locator('.ag-row [col-id="actions"]').first();
  await expect(cell.getByRole("link")).toHaveCount(5);
  for (const label of [
    "باز کردن پرونده",
    "ویرایش هنرجو",
    "ترم جدید",
    "ثبت جلسه",
    "ثبت پرداخت",
  ]) {
    const link = cell.getByRole("link", { name: label, exact: true });
    await expect(link).toBeVisible();
    const rect = await link.boundingBox(),
      bounds = await cell.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(
      bounds!.x + bounds!.width,
    );
  }
  await page.screenshot({
    path: `test-results/${info.project.name}-student-row-actions.png`,
    fullPage: true,
  });
  for (const [label, heading] of [
    ["ترم جدید", "ترم خصوصی جدید"],
    ["ثبت جلسه", "رزرو جلسه"],
    ["ثبت پرداخت", "ثبت دریافت دستی شهریه"],
  ]) {
    await page.goto(list);
    await cell.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/students/${s.id}$`));
    await expect(
      page.getByRole("heading", {
        name: `عملیات ${info.project.name}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".action-panel")).toContainText(heading);
    await page.getByRole("button", { name: "انصراف", exact: true }).click();
    await page.reload();
    await expect(page.locator(".action-panel")).toHaveCount(0);
  }
  await page.goto(list);
  await cell.getByRole("link", { name: "ویرایش هنرجو", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/students/${s.id}/edit$`));
  await expect(page.getByLabel("نام فارسی *", { exact: true })).toHaveValue(
    "عملیات",
  );
});
for (const role of ["secretary", "accountant"]) {
  test(`${role} row actions and direct action links respect permissions`, async ({
    page,
  }) => {
    await login(page, role);
    await page.goto("/students");
    const cell = page.locator('.ag-row [col-id="actions"]').first();
    await expect(cell.getByRole("link")).toHaveCount(
      role === "secretary" ? 4 : 2,
    );
    const forbidden =
      role === "secretary"
        ? ["ثبت پرداخت"]
        : ["ویرایش هنرجو", "ترم جدید", "ثبت جلسه"];
    for (const name of forbidden)
      await expect(cell.getByRole("link", { name, exact: true })).toHaveCount(
        0,
      );
    const href = await cell
      .getByRole("link", { name: "باز کردن پرونده", exact: true })
      .getAttribute("href");
    await page.goto(
      href + "?action=" + (role === "secretary" ? "payment" : "term"),
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".action-panel")).toHaveCount(0);
  });
}
