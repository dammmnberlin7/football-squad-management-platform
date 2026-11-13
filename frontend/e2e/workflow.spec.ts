import { test, expect } from "@playwright/test";
test("admin completes club, player, contract, performance and transfer workflows", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("dev-admin");
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Club command centre" }),
  ).toBeVisible();
  const suffix = Date.now();
  const a = "Berlin " + suffix,
    b = "London " + suffix,
    p = "Alex " + suffix;
  await page
    .getByRole("button", { name: "Clubs", exact: false })
    .first()
    .click();
  await page.getByLabel("Club name").fill(a);
  await page.getByRole("button", { name: "Save record →" }).click();
  await expect(page.getByRole("cell", { name: a, exact: true })).toBeVisible();
  await page.getByLabel("Club name").fill(b);
  await page.getByRole("button", { name: "Save record →" }).click();
  await expect(page.getByRole("cell", { name: b, exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Players", exact: false })
    .first()
    .click();
  await page.getByLabel("Player name").fill(p);
  await page.getByLabel("Position", { exact: true }).fill("Forward");
  await page.getByLabel("Club", { exact: true }).selectOption({ label: a });
  await page.getByRole("button", { name: "Save record →" }).click();
  await expect(page.getByRole("cell", { name: p, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).last().click();
  await page.getByLabel("Position", { exact: true }).fill("Midfielder");
  await page.getByRole("button", { name: "Save record →" }).click();
  await expect(
    page.getByRole("cell", { name: "Midfielder", exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Contracts", exact: false })
    .first()
    .click();
  await page.getByLabel("Player", { exact: true }).selectOption({ label: p });
  await page.getByLabel("Club", { exact: true }).selectOption({ label: a });
  await page.getByLabel("Starts").fill("2026-01-01");
  await page.getByLabel("Ends").fill("2028-12-31");
  await page.getByLabel("Annual salary").fill("100000");
  await page.getByRole("button", { name: "Save record →" }).click();
  await page.getByRole("button", { name: "Sign", exact: true }).last().click();
  await expect(
    page.getByRole("cell", { name: "SIGNED", exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Performances", exact: false })
    .first()
    .click();
  await page.getByLabel("Player", { exact: true }).selectOption({ label: p });
  await page.getByLabel("Match date").fill("2026-01-01");
  await page.getByLabel("Minutes", { exact: true }).fill("90");
  await page.getByLabel("Goals", { exact: true }).fill("2");
  await page.getByLabel("Assists", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save record →" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page
    .getByRole("button", { name: "Transfers", exact: false })
    .first()
    .click();
  await page.getByLabel("Player", { exact: true }).selectOption({ label: p });
  await page.getByLabel("Destination club").selectOption({ label: b });
  await page.getByLabel("Transfer fee").fill("250000");
  await page.getByRole("button", { name: "Save record →" }).click();
  await expect(
    page.getByRole("cell", { name: "250000", exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Contracts", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("cell", { name: "TERMINATED", exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "History", exact: true })
    .last()
    .click();
  await expect(page.getByLabel("Contract history")).toContainText(
    "TRANSFER_TERMINATED",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("coach sees no finances", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("coach");
  await page.getByLabel("Password").fill("dev-coach");
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Club command centre" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Contracts|Transfers/ }),
  ).toHaveCount(0);
  await expect(page.getByText("transfer Spend", { exact: true })).toHaveCount(
    0,
  );
});
