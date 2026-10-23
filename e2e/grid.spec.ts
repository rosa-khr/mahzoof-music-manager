import { test, expect } from "@playwright/test";

test("AG Grid product-list layout, real server pagination, sorting, column filter and URL restoration", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill("e2e-admin");
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
  const me = await (await page.request.get("/api/auth/me")).json();
  const codes: string[] = [];
  for (let i = 0; i < 28; i++) {
    const response = await page.request.post("/api/students", {
      headers: { Origin: "http://localhost:4310", "X-CSRF-Token": me.csrf },
      data: {
        firstName: "آزمایش",
        lastName: `grid-${info.project.name}-${String(i).padStart(2, "0")}`,
        phone: "+989123450000",
        subjectId: 1,
        history: "unknown",
      },
    });
    expect(response.status()).toBe(201);
    codes.push((await response.json()).code);
  }
  await page.goto("/students");
  const grid = page.locator(".resource-data-grid");
  await expect(
    page.locator(".search-row, .grid-search-row, #status, #q"),
  ).toHaveCount(0);
  await grid
    .locator(".ag-header [col-id=search] input")
    .fill(`grid-${info.project.name}`);
  await expect(page.locator(".resource-grid-heading")).toContainText(
    "۲۸ رکورد",
  );
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(10);
  expect(
    await grid
      .locator(".ag-row")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(60);
  expect(
    await grid
      .locator(".ag-header-cell")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(52);
  await expect(
    grid.locator(".ag-header-cell[col-id=actions]").first(),
  ).toBeVisible();
  await grid.getByRole("button", { name: "صفحه بعد", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  const first = await grid
    .locator(".ag-row[row-id]")
    .first()
    .getAttribute("row-id");
  await page.reload();
  await expect(page.locator(".resource-grid-heading")).toContainText(
    "۲۸ رکورد",
  );
  await expect(grid.locator(".ag-row[row-id]").first()).toHaveAttribute(
    "row-id",
    first!,
  );
  if (info.project.name === "desktop") {
    await grid
      .locator(".ag-header-cell[col-id=code] .ag-header-cell-text")
      .click();
    await expect(grid.locator(".ag-row [col-id=code]").first()).toHaveText(
      codes[0],
    );
    await grid
      .locator(
        ".ag-floating-filter[col-id=code] .ag-floating-filter-button-button",
      )
      .click();
    const filter = page.locator(".ag-filter-body input").first();
    await filter.fill(codes[27]);
    await expect(page.locator(".resource-grid-heading")).toContainText(
      "۱ رکورد",
    );
    await page.keyboard.press("Escape");
    await expect(grid.locator(".ag-row [col-id=code]").first()).toHaveText(
      codes[27],
    );
    await page.reload();
    await expect(page.locator(".resource-grid-heading")).toContainText(
      "۱ رکورد",
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  await page.screenshot({
    path: `test-results/${info.project.name}-ag-grid.png`,
    fullPage: true,
    animations: "disabled",
  });
  const theme = await grid
    .locator(".ag-root-wrapper")
    .evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--ag-background-color").trim(),
    );
  expect(theme).toBe("#ffffff");
  expect(errors).toEqual([]);
});
