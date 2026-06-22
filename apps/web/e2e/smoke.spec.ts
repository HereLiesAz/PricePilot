import { expect, test } from "@playwright/test";

/**
 * Core happy path: register → create a list → add an item, end to end through
 * the real API + database. Uses a unique email per run so it's idempotent
 * against a persistent dev database.
 */
test("register, create a list, and add an item", async ({ page }) => {
  const email = `e2e+${Date.now()}@test.local`;

  await page.goto("/");

  // Switch to the register form and create an account.
  await page.getByRole("button", { name: /register/i }).click();
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();

  // Signed in → the lists view.
  await expect(page.getByRole("heading", { name: "Your lists" })).toBeVisible();

  // Create a list.
  await page.getByLabel("List name").fill("Home office upgrades");
  await page.getByRole("button", { name: "Create" }).click();
  const listLink = page.getByRole("link", { name: "Home office upgrades" });
  await expect(listLink).toBeVisible();

  // Open it and add a manual item.
  await listLink.click();
  await expect(page.getByRole("heading", { name: "Home office upgrades" })).toBeVisible();
  await page.getByLabel("Product URL or name").fill("Standing desk");
  await page.getByRole("button", { name: "Add" }).click();

  // The item appears in the list.
  await expect(page.getByText("Standing desk")).toBeVisible();
});
