import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
test.beforeAll(async ({ request }) => {
  await expect
    .poll(
      async () => {
        try {
          return (await request.get("/actuator/health")).status();
        } catch {
          return 0;
        }
      },
      { timeout: 60000 },
    )
    .toBe(200);
});

const adminHeaders = {
  Authorization: "Basic " + Buffer.from("admin:dev-admin").toString("base64"),
};
async function login(page: Page, username = "admin", password = "dev-admin") {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in →" }).click();
}
async function player(request: APIRequestContext, label: string) {
  const name = label + " " + Date.now();
  const c = await request.post("/api/clubs", {
    headers: adminHeaders,
    data: { name },
  });
  expect(c.ok()).toBe(true);
  const club = await c.json();
  const p = await request.post("/api/players", {
    headers: adminHeaders,
    data: { name, position: "Forward", clubId: club.id },
  });
  expect(p.ok()).toBe(true);
  return { club, player: await p.json(), name };
}
test("coach edits performance and sees updated player totals", async ({
  page,
  request,
}) => {
  const fixture = await player(request, "Edit performance");
  const p = await request.post("/api/performances", {
    headers: adminHeaders,
    data: {
      playerId: fixture.player.id,
      matchDate: "2026-01-01",
      minutes: 90,
      goals: 1,
      assists: 0,
    },
  });
  expect(p.ok()).toBe(true);
  await login(page, "coach", "dev-coach");
  await page
    .getByRole("button", { name: /^Performances/ })
    .first()
    .click();
  await page
    .getByRole("searchbox", { name: "Search performances" })
    .fill(fixture.name);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Goals", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save record →" }).click();
  await expect(
    page.getByRole("cell", { name: "4", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Players/ })
    .first()
    .click();
  await page
    .getByRole("searchbox", { name: "Search players" })
    .fill(fixture.name);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  const profile = page.getByRole("region", { name: "Player profile" });
  await expect(
    profile
      .locator("dl > div")
      .filter({ has: page.getByText("Goals", { exact: true }) })
      .locator("dd"),
  ).toHaveText("4");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("finance attaches and downloads an immutable PDF and sees financial audit", async ({
  page,
  request,
}) => {
  const f = await player(request, "Document");
  const c = await request.post("/api/contracts", {
    headers: adminHeaders,
    data: {
      playerId: f.player.id,
      clubId: f.club.id,
      starts: "2026-01-01",
      ends: "2029-12-31",
      salary: 90000,
    },
  });
  expect(c.ok()).toBe(true);
  const contract = await c.json();
  const signed = await request.post("/api/contracts/" + contract.id + "/sign", {
    headers: adminHeaders,
    data: { version: contract.version },
  });
  expect(signed.ok()).toBe(true);
  await login(page, "finance", "dev-finance");
  await page
    .getByRole("button", { name: /^Contracts/ })
    .first()
    .click();
  await page.getByRole("searchbox", { name: "Search contracts" }).fill(f.name);
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  const bytes = Buffer.from("%PDF-1.7\nReview contract\n%%EOF");
  await page.getByLabel("Contract PDF").setInputFiles({
    name: "signed-contract.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await page.getByRole("button", { name: "Attach PDF", exact: true }).click();
  await expect(
    page.getByText("Document attached. Earlier documents remain unchanged."),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download signed-contract.pdf" })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("signed-contract.pdf");
  const { readFile } = await import("node:fs/promises");
  expect(await readFile((await download.path())!)).toEqual(bytes);
  await page
    .getByRole("button", { name: /^Audit/ })
    .first()
    .click();
  await page.getByRole("searchbox", { name: "Search audit" }).fill("DOCUMENT");
  await expect(
    page.getByRole("cell", { name: "ATTACHED", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "USER", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Users/ })).toHaveCount(0);
});
test("administrator creates disables and resets an individual account", async ({
  page,
}) => {
  const username = "review-coach-" + Date.now();
  await login(page);
  await page
    .getByRole("button", { name: /^Users/ })
    .first()
    .click();
  await page.getByLabel("New username").fill(username);
  await page
    .getByLabel("New password", { exact: true })
    .fill("review-password-initial");
  await page.getByRole("button", { name: "Save account" }).click();
  let row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: username, exact: true }) });
  await row.getByRole("button", { name: "Manage account" }).click();
  await page.getByLabel("Account enabled").uncheck();
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(
    row.getByRole("cell", { name: "Disabled", exact: true }),
  ).toBeVisible();
  await row.getByRole("button", { name: "Manage account" }).click();
  await page.getByLabel("Account enabled").check();
  await page
    .getByLabel("New password (optional)")
    .fill("review-password-reset");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(
    row.getByRole("cell", { name: "Enabled", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Username").fill(username);
  await page
    .getByLabel("Password", { exact: true })
    .fill("review-password-initial");
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(page.getByRole("alert")).toContainText("Sign-in failed");
  await page
    .getByLabel("Password", { exact: true })
    .fill("review-password-reset");
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Club command centre" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Contracts|Transfers|Users|Audit/ }),
  ).toHaveCount(0);
});
test("demo data is loaded once and registers paginate on the server", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Load demo data", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Demo data loaded|already loaded/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load demo data", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Demo data is already loaded.")).toBeVisible();
  await page
    .getByRole("button", { name: /^Players/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
  const next = page.waitForResponse(
    (r) =>
      r.url().includes("/api/registers/players?") && r.url().includes("page=1"),
  );
  await page.getByRole("button", { name: "Next page" }).click();
  const response = await next;
  const data = await response.json();
  expect(data.number).toBe(1);
  expect(data.content.length).toBeGreaterThan(0);
  expect(data.content.length).toBeLessThanOrEqual(10);
  await page
    .getByRole("searchbox", { name: "Search players" })
    .fill("Alex Morgan");
  await expect(page.getByRole("cell", { name: /^Alex Morgan/ })).toHaveCount(3);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
