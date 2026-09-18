import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function resetApp(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

async function audit(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(violations, `axe-core violations in ${state}: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
}

async function goToWeek(page: Page) {
  await page.getByRole("complementary").first().getByRole("button", { name: "This week", exact: true }).click();
  await expect(page.getByText("Seven small horizons", { exact: true })).toBeVisible();
}

async function goToNotes(page: Page) {
  await page.getByRole("complementary").first().getByRole("button", { name: /Loose notes/ }).click();
  await expect(page.getByText("Keep a thought", { exact: false })).toBeVisible();
}

async function createTask(page: Page, title = "Accessibility task") {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").nth(0).fill(title);
  await dialog.getByRole("button", { name: "Add to route", exact: true }).click();
}

test.describe("Dayweave accessibility audit", () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test("audits Today and the empty task state", async ({ page }) => {
    await audit(page, "Today page / empty task state");
  });

  test("audits This week", async ({ page }) => {
    await goToWeek(page);
    await audit(page, "This week page");
  });

  test("audits Loose Notes and the empty notes state", async ({ page }) => {
    await goToNotes(page);
    await audit(page, "Loose Notes page / empty notes state");
  });

  test("audits the task create and edit dialogs", async ({ page }) => {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await audit(page, "task create dialog");
    await dialog.getByRole("textbox").nth(0).fill("Audit task");
    await dialog.getByRole("button", { name: "Add to route", exact: true }).click();
    await page.getByRole("article").filter({ hasText: "Audit task" }).getByRole("button", { name: "Edit Audit task" }).click();
    dialog = page.getByRole("dialog");
    await audit(page, "task edit dialog");
  });

  test("audits the note create and edit dialogs", async ({ page }) => {
    await goToNotes(page);
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    let dialog = page.getByRole("dialog");
    await audit(page, "note create dialog");
    await dialog.getByRole("textbox").nth(0).fill("Audit note");
    await dialog.getByRole("textbox").nth(1).fill("A note for accessibility review.");
    await dialog.getByRole("button", { name: "Save note", exact: true }).click();
    await page.getByRole("button", { name: /Audit note/ }).first().click();
    await page.getByRole("button", { name: "Edit note", exact: true }).click();
    dialog = page.getByRole("dialog");
    await audit(page, "note edit dialog");
  });

  test("audits Focus Mode and its exit confirmation", async ({ page }) => {
    await createTask(page, "Focus audit");
    await page.getByRole("button", { name: "Start focus", exact: true }).click();
    const focus = page.getByRole("dialog");
    await audit(page, "Focus Mode");
    await focus.getByRole("button", { name: "Exit focus mode", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await audit(page, "Focus Mode exit confirmation");
  });

  test("audits the no-task Focus Mode state", async ({ page }) => {
    await page.getByRole("button", { name: "Focus mode", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nothing needs your attention yet.", exact: true })).toBeVisible();
    await audit(page, "Focus Mode no-task state");
  });

  test("audits key mobile states without changing the desktop suite", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await audit(page, "mobile Today / empty task state");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("button", { name: /Loose notes/ }).click();
    await expect(page.getByText("Keep a thought", { exact: false })).toBeVisible();
    await audit(page, "mobile Loose Notes / empty notes state");
    await page.getByRole("button", { name: "Focus mode", exact: true }).click();
    await audit(page, "mobile Focus Mode no-task state");
  });
});
