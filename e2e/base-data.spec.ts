import { test, expect, Page } from "@playwright/test";
import { BASE_RESOURCES } from "../src/app/core/base-data";

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
for (const resource of BASE_RESOURCES.filter(
  (r) => r.key !== "session-statuses" && r.key !== "instructors",
)) {
  test(`${resource.key}: base menu, AG Grid, separate create/edit, persistence and filter return`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page);
    if (info.project.name === "mobile")
      await page.getByRole("button", { name: "باز و بسته کردن منو" }).click();
    const nav = page.getByRole("navigation", { name: "منوی اصلی" });
    await nav
      .getByRole("button", { name: "اطلاعات پایه", exact: true })
      .click();
    await nav.getByRole("link", { name: resource.title, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: resource.title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "ثبت " + resource.singular, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/base-data/${resource.key}/new`));
    await page
      .getByRole("button", { name: "ثبت و بازگشت", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("عنوان الزامی");
    const name = `آزمون ${resource.key} ${info.project.name}`;
    await page
      .getByLabel(resource.nameLabel + " *", { exact: true })
      .fill(name);
    if (resource.key === "instruments") {
      await page.getByLabel("نام انگلیسی ساز", { exact: true }).fill("Violin");
    }
    if (resource.phone)
      await page
        .getByLabel("شماره تماس", { exact: true })
        .fill("+989121234567");
    await page
      .getByLabel("توضیحات", { exact: true })
      .fill("توضیحات فارسی برای اطلاعات پایه");
    await page
      .getByRole("button", { name: "ثبت و بازگشت", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: resource.title, exact: true }),
    ).toBeVisible();
    const grid = page.locator("app-data-grid");
    await grid.locator(".ag-header [col-id=name] input").fill(name);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("filters"))
      .toContain(name);
    await expect(grid.locator(".ag-row[row-id]")).toHaveCount(1);
    await expect(grid.locator(".ag-row[row-id]")).toContainText(name);
    await page.screenshot({
      path: `test-results/${info.project.name}-${resource.key}-list.png`,
      fullPage: true,
      animations: "disabled",
    });
    await grid
      .getByRole("link", { name: "ویرایش " + resource.singular, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/base-data/${resource.key}/\\d+/edit`),
    );
    await expect(
      page.getByLabel(resource.nameLabel + " *", { exact: true }),
    ).toHaveValue(name);
    if (resource.key === "instruments") {
      await expect(
        page.getByLabel("نام انگلیسی ساز", { exact: true }),
      ).toHaveValue("Violin");
      await page.getByLabel("نام انگلیسی ساز", { exact: true }).fill("Piano");
    }
    await expect(
      page.locator('.nav-group-toggle[aria-label="اطلاعات پایه"]'),
    ).toHaveAttribute("aria-expanded", "true");
    await page
      .getByLabel(resource.nameLabel + " *", { exact: true })
      .fill(name + " ویرایش");
    await page.getByRole("switch", { name: "وضعیت", exact: true }).uncheck();
    await page.screenshot({
      path: `test-results/${info.project.name}-${resource.key}-edit.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    ).toBe(false);
    await page
      .getByRole("button", { name: "ذخیره تغییرات", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: resource.title, exact: true }),
    ).toBeVisible();
    if (info.project.name === "desktop")
      await expect(grid.locator(".ag-row[row-id]")).toContainText("غیرفعال");
    expect(new URL(page.url()).searchParams.get("filters")).toContain(name);
    await page.reload();
    await expect(grid.locator(".ag-row[row-id]")).toHaveCount(1);
    await grid
      .getByRole("link", { name: "ویرایش " + resource.singular, exact: true })
      .click();
    await expect(
      page.getByLabel(resource.nameLabel + " *", { exact: true }),
    ).toHaveValue(name + " ویرایش");
    if (resource.key === "instruments")
      await expect(
        page.getByLabel("نام انگلیسی ساز", { exact: true }),
      ).toHaveValue("Piano");
    await expect(
      page.getByRole("switch", { name: "وضعیت", exact: true }),
    ).not.toBeChecked();
    if (resource.phone)
      await expect(page.getByLabel("شماره تماس", { exact: true })).toHaveValue(
        "+989121234567",
      );
    await page.getByRole("link", { name: "انصراف", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: resource.title, exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test("base grid restores page two after reload and editing", async ({
  page,
}, info) => {
  await login(page);
  const me = await (await page.request.get("/api/auth/me")).json();
  const name = "صفحه " + info.project.name;
  for (let i = 0; i < 27; i++) {
    const r = await page.request.post("/api/base-data/instruments", {
      headers: { Origin: "http://localhost:4310", "X-CSRF-Token": me.csrf },
      data: { name: name + " " + String(i).padStart(2, "0") },
    });
    expect(r.status()).toBe(201);
  }
  const query = new URLSearchParams({
    page: "2",
    size: "10",
    filters: JSON.stringify({
      name: { filterType: "text", type: "startsWith", filter: name },
    }),
  });
  await page.goto("/base-data/instruments?" + query);
  const grid = page.locator("app-data-grid");
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(10);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("page"))
    .toBe("2");
  const id = await grid
    .locator(".ag-row[row-id]")
    .first()
    .getAttribute("row-id");
  await page.reload();
  await expect(grid.locator(".ag-row[row-id]").first()).toHaveAttribute(
    "row-id",
    id!,
  );
  await grid
    .getByRole("link", { name: "ویرایش ساز", exact: true })
    .first()
    .click();
  await page.getByLabel("توضیحات", { exact: true }).fill("ویرایش از صفحه دوم");
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "سازها", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("page"))
    .toBe("2");
  await expect(grid.locator(".ag-row[row-id]").first()).toHaveAttribute(
    "row-id",
    id!,
  );
});
test("accountant cannot open base lists, create or edit routes", async ({
  page,
}) => {
  await login(page, "accountant");
  await expect(
    page.locator('.nav-group-toggle[aria-label="اطلاعات پایه"]'),
  ).toHaveCount(0);
  for (const r of BASE_RESOURCES)
    for (const suffix of ["", "/new", "/1/edit"]) {
      await page.goto("/base-data/" + r.key + suffix);
      await expect(page).toHaveURL("http://localhost:4310/");
    }
  await page.goto("/base-data/instructors/1");
  await expect(page).toHaveURL("http://localhost:4310/");
});

test("session statuses: four real rows, fixed codes, separate editing and reload", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/base-data/session-statuses");
  const grid = page.locator("app-data-grid");
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(4);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "ثبت وضعیت جلسه", exact: true }),
  ).toHaveCount(0);
  if (info.project.name === "desktop") {
    for (const name of ["حاضر", "غایب", "رزرو", "کنسل"])
      await expect(grid).toContainText(name);
    await expect(grid).not.toContainText("undefined");
  }
  await page.screenshot({
    path: `test-results/${info.project.name}-session-statuses.png`,
    fullPage: true,
  });
  await grid
    .getByRole("link", { name: "ویرایش وضعیت جلسه", exact: true })
    .first()
    .click();
  await expect(
    page.getByLabel("عنوان وضعیت *", { exact: true }),
  ).not.toHaveValue("");
  await expect(page.getByRole("switch")).toHaveCount(0);
  await page
    .getByLabel("توضیحات", { exact: true })
    .fill("بررسی ذخیره وضعیت " + info.project.name);
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(4);
  await page.reload();
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(4);
  await grid
    .getByRole("link", { name: "ویرایش وضعیت جلسه", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("توضیحات", { exact: true })).toHaveValue(
    "بررسی ذخیره وضعیت " + info.project.name,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
});
