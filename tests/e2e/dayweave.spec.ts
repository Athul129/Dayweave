import { expect, test } from "@playwright/test";

const pad = (value: number) => String(value).padStart(2, "0");
const localDateOnly = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date: Date, amount: number) => { const next = new Date(date.getFullYear(), date.getMonth(), date.getDate()); next.setDate(next.getDate() + amount); return next; };
const monday = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));
const dayLabel = (date: Date) => date.toLocaleDateString("en-US", { weekday: "long" });
const longDate = (date: Date) => date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const weekBreadcrumb = (date: Date) => `${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })} — ${addDays(date, 6).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
});

test.afterEach(async () => {
  expect(consoleErrors, "browser console should remain free of errors").toEqual([]);
});

async function openTaskForm(page: Parameters<typeof test>[0] extends never ? never : any, title = "") {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const fields = dialog.getByRole("textbox");
  await fields.nth(0).fill(title);
  return dialog;
}

async function saveTask(page: any, dialog: any, title: string, options: { time?: string; minutes?: string; energy?: string; section?: string; dateLabel?: string } = {}) {
  await dialog.getByRole("textbox").nth(0).fill(title);
  if (options.time) await dialog.locator('input[type="time"]').fill(options.time);
  if (options.minutes) await dialog.locator('input[type="number"]').fill(options.minutes);
  if (options.energy) await dialog.getByRole("button", { name: options.energy, exact: true }).click();
  if (options.section) await dialog.getByRole("button", { name: options.section, exact: true }).click();
  if (options.dateLabel) await dialog.getByRole("button", { name: options.dateLabel, exact: true }).click();
  await dialog.getByRole("button", { name: "Add to route", exact: true }).click();
}

async function goToWeek(page: any) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("complementary").first().getByRole("button", { name: "This week", exact: true }).click();
  await expect(page.getByText("Seven small horizons", { exact: true })).toBeVisible();
}

async function goToNotes(page: any) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("complementary").first().getByRole("button", { name: /Loose notes/ }).click();
  await expect(page.getByText("Keep a thought", { exact: false })).toBeVisible();
}

test.describe("Today task route", () => {
  test("creates, edits, completes, uncompletes, and deletes a task", async ({ page }) => {
    const today = new Date();
    await expect(page.getByText(longDate(today), { exact: true })).toBeVisible();

    const dialog = await openTaskForm(page, "Write the brief");
    await saveTask(page, dialog, "Write the brief", { time: "09:15", minutes: "45", energy: "Deep", section: "Morning" });
    await expect(page.getByRole("article").filter({ hasText: "Write the brief" }).getByRole("heading", { name: "Write the brief", exact: true })).toBeVisible();

    const taskCard = page.getByRole("article").filter({ hasText: "Write the brief" }).first();
    await taskCard.getByRole("button", { name: "Edit Write the brief" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByRole("textbox").nth(0).fill("Send the brief");
    await editDialog.locator('input[type="time"]').fill("10:30");
    await editDialog.locator('input[type="number"]').fill("60");
    await editDialog.getByRole("button", { name: "Social", exact: true }).click();
    await editDialog.getByRole("button", { name: "Midday", exact: true }).click();
    await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
    const editedTaskCard = page.getByRole("article").filter({ hasText: "Send the brief" }).first();
    await expect(editedTaskCard.getByRole("heading", { name: "Send the brief", exact: true })).toBeVisible();
    await expect(editedTaskCard.getByText("10:30", { exact: true })).toBeVisible();
    await expect(editedTaskCard.getByText("1h", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Mark Send the brief complete" }).click();
    await expect(page.getByText("1 small win", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Mark Send the brief complete" }).click();
    await expect(page.getByText("A clean page", { exact: false })).toBeVisible();

    await page.getByRole("article").filter({ hasText: "Send the brief" }).first().getByRole("button", { name: "Edit Send the brief" }).click();
    const deleteDialog = page.getByRole("dialog");
    await deleteDialog.getByRole("button", { name: "Delete task", exact: true }).click();
    await expect(deleteDialog.getByText("Delete this task?", { exact: true })).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Send the brief", { exact: true })).not.toBeVisible();
  });
});

test.describe("This week planning", () => {
  test("uses the current week, creates on one day, moves it, and persists after reload", async ({ page }) => {
    const today = new Date();
    const weekStart = monday(today);
    const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    await goToWeek(page);
    await expect(page.getByText(weekBreadcrumb(weekStart), { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Today", { exact: true })).toBeVisible();

    const mondayCard = page.getByRole("article").filter({ hasText: /MON/ }).first();
    await mondayCard.getByRole("button", { name: "Add one", exact: true }).click();
    const createDialog = page.getByRole("dialog");
    await saveTask(page, createDialog, "Plan the week", { dateLabel: dayLabel(weekDays[0]) });
    await expect(mondayCard.getByText("Plan the week", { exact: true })).toBeVisible();

    await mondayCard.getByRole("button", { name: "Edit Plan the week" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByRole("button", { name: dayLabel(weekDays[2]), exact: true }).click();
    await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
    const wednesdayCard = page.getByRole("article").filter({ hasText: /WED/ }).first();
    await expect(wednesdayCard.getByText("Plan the week", { exact: true })).toBeVisible();
    await expect(mondayCard.getByText("Plan the week", { exact: true })).not.toBeVisible();

    await page.reload();
    await goToWeek(page);
    await expect(page.getByText(weekBreadcrumb(weekStart), { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "WED" }).first().getByText("Plan the week", { exact: true })).toBeVisible();
  });
});

test.describe("Loose Notes", () => {
  test("creates, reads, edits, searches, and deletes a note", async ({ page }) => {
    await goToNotes(page);
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").nth(0).fill("Field note");
    await dialog.getByRole("textbox").nth(1).fill("A small observation to keep.");
    await dialog.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(page.getByRole("button", { name: /Field note/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Field note/ }).first().click();
    await expect(page.getByRole("heading", { name: "Field note", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Edit note", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").nth(0).fill("Updated field note");
    await dialog.getByRole("textbox").nth(1).fill("The observation has a second sentence.");
    await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Updated field note", exact: true })).toBeVisible();

    await page.getByLabel("Search notes").fill("second sentence");
    await expect(page.getByRole("button", { name: /Updated field note/ }).first()).toBeVisible();
    await page.getByLabel("Search notes").fill("no such thought");
    await expect(page.getByText("No matching notes.", { exact: true })).toBeVisible();
    await page.getByLabel("Clear search").click();

    await page.getByRole("button", { name: "Edit note", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Delete note", exact: true }).click();
    await dialog.getByText("Delete this note?", { exact: true });
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Nothing loose yet.", { exact: true })).toBeVisible();
  });
});

test.describe("Focus Mode", () => {
  test("starts, pauses, resumes, exits safely, and completes the shared task", async ({ page }) => {
    await page.clock.install({ time: new Date(2030, 0, 15, 11, 40, 0) });
    await page.reload();
    const dialog = await openTaskForm(page, "Read the brief");
    await saveTask(page, dialog, "Read the brief", { minutes: "1", time: "11:40" });
    await page.getByRole("button", { name: "Start focus", exact: true }).click();
    let focus = page.getByRole("dialog");
    await expect(focus.getByRole("heading", { name: "Read the brief", exact: true })).toBeVisible();
    const timer = focus.locator('[role="status"]');
    const timerValue = timer.locator("strong");
    const initialTimer = await timerValue.innerText();
    await expect(timerValue).toHaveText("01:00");

    await focus.getByRole("button", { name: "Pause timer", exact: true }).click();
    const pausedTimer = await timerValue.innerText();
    await page.clock.runFor(1_200);
    await expect(timerValue).toHaveText(pausedTimer);
    await focus.getByRole("button", { name: "Resume timer", exact: true }).click();
    await page.clock.runFor(1_100);
    await expect(timerValue).not.toHaveText(initialTimer);

    await focus.getByRole("button", { name: "Exit focus mode", exact: true }).click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation.getByText("Leave focus?", { exact: true })).toBeVisible();
    await confirmation.getByRole("button", { name: "Leave focus", exact: true }).click();
    await expect(page.getByRole("article").filter({ hasText: "Read the brief" }).getByRole("heading", { name: "Read the brief", exact: true })).toBeVisible();
    await expect(page.getByText("A clean page", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Start focus", exact: true }).click();
    focus = page.getByRole("dialog");
    await focus.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(page.getByText("1 small win", { exact: false })).toBeVisible();
  });

  test("derives remaining time from persisted wall-clock timestamps across refresh and pause", async ({ page }) => {
    await page.clock.install({ time: new Date(2030, 0, 15, 17, 2, 0) });
    await page.evaluate(() => {
      localStorage.setItem("dayweave-tasks", JSON.stringify([{ id: 88221, title: "Long scheduled block", note: "Wall-clock validation task.", time: "11:40", minutes: 380, energy: "Deep", done: false, section: "Morning", date: "2030-01-15" }]));
      localStorage.setItem("dayweave-focus-session", JSON.stringify({ taskId: 88221, durationSeconds: 380 * 60, startAt: new Date(2030, 0, 15, 11, 40, 0).getTime(), endAt: new Date(2030, 0, 15, 18, 0, 0).getTime(), pausedAt: null, pausedRemainingSeconds: null, isRunning: true, completed: false, updatedAt: Date.now() }));
    });
    await page.reload();
    let focus = page.getByRole("dialog");
    const timerValue = focus.locator('[role="status"] strong');
    await expect(timerValue).toHaveText("58:00");

    await page.clock.setFixedTime(new Date(2030, 0, 15, 17, 30, 0));
    await page.clock.runFor(1_000);
    await expect(timerValue).toHaveText("30:00");
    await page.clock.setFixedTime(new Date(2030, 0, 15, 17, 59, 0));
    await page.clock.runFor(1_000);
    await expect(timerValue).toHaveText("01:00");
    await page.clock.setFixedTime(new Date(2030, 0, 15, 18, 0, 0));
    await page.clock.runFor(1_000);
    await expect(timerValue).toHaveText("Done");

    await page.evaluate(() => {
      localStorage.setItem("dayweave-focus-session", JSON.stringify({ taskId: 88221, durationSeconds: 380 * 60, startAt: new Date(2030, 0, 15, 11, 40, 0).getTime(), endAt: new Date(2030, 0, 15, 18, 0, 0).getTime(), pausedAt: null, pausedRemainingSeconds: null, isRunning: true, completed: false, updatedAt: Date.now() }));
    });
    await page.clock.setFixedTime(new Date(2030, 0, 15, 17, 2, 0));
    await page.reload();
    focus = page.getByRole("dialog");
    await focus.getByRole("button", { name: "Pause timer", exact: true }).click();
    await expect(focus.locator('[role="status"] strong')).toHaveText("58:00");
    await page.clock.setFixedTime(new Date(2030, 0, 15, 17, 10, 0));
    await page.clock.runFor(1_000);
    await page.reload();
    focus = page.getByRole("dialog");
    await expect(focus.locator('[role="status"] strong')).toHaveText("58:00");
    await focus.getByRole("button", { name: "Resume timer", exact: true }).click();
    await page.clock.setFixedTime(new Date(2030, 0, 15, 17, 11, 0));
    await page.clock.runFor(1_000);
    await expect(focus.locator('[role="status"] strong')).toHaveText("57:00");
  });
});

test.describe("Persistence and edge states", () => {
  test("restores a task, note, completion, and real date after reload", async ({ page }) => {
    const taskDialog = await openTaskForm(page, "Persistent task");
    await saveTask(page, taskDialog, "Persistent task");
    await page.getByRole("button", { name: "Mark Persistent task complete" }).click();
    await goToNotes(page);
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    const noteDialog = page.getByRole("dialog");
    await noteDialog.getByRole("textbox").nth(0).fill("Persistent note");
    await noteDialog.getByRole("textbox").nth(1).fill("Still here after a reload.");
    await noteDialog.getByRole("button", { name: "Save note", exact: true }).click();
    await page.reload();
    await expect(page.getByText(longDate(new Date()), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Today/ }).first()).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "Persistent task" }).getByRole("heading", { name: "Persistent task", exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("complementary").first().getByRole("button", { name: /Loose notes/ }).click();
    await expect(page.getByRole("button", { name: /Persistent note/ }).first()).toBeVisible();
  });

  test("handles empty forms, invalid duration, no search results, and Focus Mode with no tasks", async ({ page }) => {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add to route", exact: true }).click();
    await expect(dialog.getByText("Give this task a short title.", { exact: true })).toBeVisible();
    await dialog.getByRole("textbox").nth(0).fill("Valid title");
    await dialog.locator('input[type="number"]').fill("0");
    await dialog.getByRole("button", { name: "Add to route", exact: true }).click();
    await expect(dialog.getByText(/Choose a duration/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await goToNotes(page);
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(dialog.getByText("Give this note a title before saving.", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").nth(0).fill("Searchable note");
    await dialog.getByRole("textbox").nth(1).fill("A searchable body");
    await dialog.getByRole("button", { name: "Save note", exact: true }).click();
    await page.getByLabel("Search notes").fill("nothing matches");
    await expect(page.getByText("No matching notes.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Focus mode", exact: true }).click();
    const focus = page.getByRole("dialog");
    await expect(focus.getByRole("heading", { name: "Nothing needs your attention yet.", exact: true })).toBeVisible();
    await focus.getByRole("button", { name: "Return to Today", exact: true }).click();
  });
});
