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
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
}
test("redesign: real populated dashboard, RTL shell, compact floating labels and Select2 avoid overlaps", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const me = await (await page.request.get("/api/auth/me")).json();
  const headers = { Origin: "http://localhost:4310", "X-CSRF-Token": me.csrf };
  const firstName = "آوای موسیقی";
  const lastName = "آزمایش طراحی " + info.project.name;
  const created = await page.request.post("/api/students", {
    headers,
    data: { firstName, lastName, phone: "+989121112233", subjectId: 1 },
  });
  expect(created.status()).toBe(201);
  const student = await created.json();
  await page.goto(`/students/${student.id}`);
  await expect(
    page.getByRole("heading", {
      name: firstName + " " + lastName,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".dossier-name")).toHaveText(
    firstName + " " + lastName,
  );
  await expect(
    page.locator(".dossier-avatar.student-avatar-placeholder"),
  ).toBeVisible();
  await expect(page.locator(".dossier-section").first()).toContainText(
    "هنوز ترمی ثبت نشده است.",
  );
  const identity = await page.locator(".dossier-sidebar").boundingBox();
  const content = await page.locator(".dossier-content").boundingBox();
  if (info.project.name === "desktop")
    expect(identity!.x).toBeGreaterThan(content!.x);
  else expect(identity!.y).toBeLessThan(content!.y);
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-student-dossier.png`,
    fullPage: true,
    animations: "disabled",
  });
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const termResponse = await page.request.post(
    `/api/students/${student.id}/terms`,
    {
      headers,
      data: {
        subjectId: 1,
        quota: 1,
        amount: "4800000",
        currency: "TOMAN",
        registeredOn: day,
        mode: "onsite",
        location: "آموزشگاه",
      },
    },
  );
  expect(termResponse.status()).toBe(201);
  const term = await termResponse.json();
  for (const hour of ["08:00"]) {
    const r = await page.request.post(`/api/terms/${term.id}/sessions`, {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data: { startsAt: `${day}T${hour}:00+03:30`, timezone: "Asia/Tehran" },
    });
    expect(r.status()).toBe(201);
  }
  await page.goto("/");
  await expect(page.locator(".schedule-card .ag-row[row-id]")).not.toHaveCount(
    0,
  );
  await expect(page.locator(".renewal-card .ag-row[row-id]")).not.toHaveCount(
    0,
  );
  await expect(page.locator(".debt-card")).toContainText("تومان");
  await expect(page.locator(".dashboard-category")).toHaveCount(3);
  const refreshed = page.waitForResponse(
    (r) => r.url().endsWith("/api/today") && r.request().method() === "GET",
  );
  await page.getByRole("button", { name: "تازه‌سازی", exact: true }).click();
  expect((await refreshed).status()).toBe(200);
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-redesign-dashboard.png`,
    fullPage: true,
    animations: "disabled",
  });
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "جمع کردن سایدبار" }).click();
    await expect(page.locator(".sidebar")).toHaveCSS("width", "84px");
    await page.screenshot({
      path: "test-results/desktop-redesign-collapsed.png",
      fullPage: false,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "جمع کردن سایدبار" }).click();
  } else {
    await page.getByRole("button", { name: "باز و بسته کردن منو" }).click();
    await expect(page.locator(".sidebar")).toHaveClass(/open/);
    await page.screenshot({
      path: "test-results/mobile-redesign-navigation.png",
      fullPage: false,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
  }
  await page.goto("/students");
  await page.locator(".ag-header [col-id=search] input").fill(lastName);
  await expect(page.locator(".ag-row [col-id=search]")).toHaveCount(1);
  await expect(
    page.locator(".ag-row .grid-student-avatar.student-avatar-placeholder"),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-redesign-students.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.goto(`/students/${student.id}/edit`);
  const first = page.getByLabel("نام فارسی *", { exact: true });
  await expect(first).toHaveValue(firstName);
  const fit = async (input: typeof first) =>
    input.evaluate((el) => {
      const label = el.parentElement!.querySelector("label")!,
        box = el.getBoundingClientRect(),
        title = label.getBoundingClientRect();
      return {
        titleTop: title.top - box.top,
        titleBottom: title.bottom - box.top,
        height: box.height,
      };
    });
  expect((await fit(first)).titleTop).toBeLessThan(0);
  expect((await fit(first)).titleBottom).toBeLessThanOrEqual(8);
  const english = page.getByLabel("نام انگلیسی", { exact: true });
  await english.fill("A very long English student name");
  await english.blur();
  await expect
    .poll(async () => (await fit(english)).titleBottom)
    .toBeLessThanOrEqual(8);
  await noOverflow(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${info.project.name}-redesign-student-form.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/students/new");
  await expect(
    page.locator(".student-photo-avatar.student-avatar-placeholder"),
  ).toBeVisible();
  const empty = page.getByLabel("نام فارسی *", { exact: true });
  await expect(empty).toHaveValue("");
  expect((await fit(empty)).titleTop).toBeGreaterThanOrEqual(0);
  await empty.focus();
  await expect.poll(async () => (await fit(empty)).titleTop).toBeLessThan(0);
  await empty.fill("");
  await empty.blur();
  await page
    .getByRole("tab", { name: "اطلاعات ساز و جلسه", exact: true })
    .click();
  const combo = page.getByRole("combobox", {
    name: "واحد آموزشی موردنظر *",
    exact: true,
  });
  await combo.click();
  await page.getByRole("option", { name: "پیانو", exact: true }).click();
  const selectFit = () =>
    combo.evaluate((el) => {
      const field = el.closest(".form-field")!,
        label = field.querySelector("label")!;
      return (
        label.getBoundingClientRect().bottom - el.getBoundingClientRect().top
      );
    });
  await expect.poll(selectFit).toBeLessThanOrEqual(8);
  await page.goto("/users/new");
  const password = page.getByLabel("رمز اولیه (حداقل ۸ نویسه) *", {
    exact: true,
  });
  await password.fill("Abcd1234");
  await page
    .getByRole("button", { name: "نمایش رمز اولیه", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await expect
    .poll(async () => (await fit(password)).titleBottom)
    .toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});
