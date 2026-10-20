import { expect, Page } from "@playwright/test";

export const nativeSelect = (page: Page, label: string) =>
  page.locator("select").and(page.getByLabel(label, { exact: true }));

/** Use the visible Select2 control, never native selectOption. */
export async function chooseSelect2(
  page: Page,
  label: string,
  choice: string | { index: number },
) {
  const select = nativeSelect(page, label);
  const text = await select.evaluate((el, wanted) => {
    const options = Array.from((el as HTMLSelectElement).options);
    const option =
      typeof wanted === "string"
        ? options.find((o) => o.value === wanted)
        : options[wanted.index];
    if (!option)
      throw Error("Select2 option missing: " + JSON.stringify(wanted));
    return option.textContent!.replace(/\s+/g, " ").trim();
  }, choice);
  const combo = page.getByRole("combobox", { name: label, exact: true });
  await combo.click();
  await page
    .locator(".select2-container--open .select2-search__field")
    .fill("");
  await page.getByRole("option", { name: text, exact: true }).click();
  await expect(combo).toContainText(text);
}
