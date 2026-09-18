import { expect, test } from "@playwright/test";

test.describe("Supabase Auth UI", () => {
  test("exposes labeled login and signup flows when Supabase Auth is configured", async ({ page }) => {
    await page.goto("/");
    const authHeading = page.getByRole("heading", { name: /A quieter place/i });
    if (!(await authHeading.count())) test.skip(true, "Supabase environment variables are not configured in this validation environment.");

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Create an account", exact: true }).click();
    await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeVisible();
    await expect(page.getByText("Make an account to keep your daily route close.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  });
});
