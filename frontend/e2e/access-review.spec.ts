import { test, expect, type Page } from "@playwright/test";
const headers = {
  Authorization: "Basic " + Buffer.from("admin:dev-admin").toString("base64"),
};
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
async function login(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Club command centre" }),
  ).toBeVisible();
}
test("revoked access clears the signed-in screen on the next request", async ({
  page,
  request,
}) => {
  const username = "revoked-" + Date.now(),
    password = "test-revoked-password";
  const created = await request.post("/api/users", {
    headers,
    data: { username, password, roles: ["COACH"] },
  });
  expect(created.ok()).toBe(true);
  const user = await created.json();
  await login(page, username, password);
  const disabled = await request.put("/api/users/" + user.id, {
    headers,
    data: { version: user.version, roles: ["COACH"], enabled: false },
  });
  expect(disabled.ok()).toBe(true);
  await page
    .getByRole("button", { name: /^Players/ })
    .first()
    .click();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Sign in again");
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Club command centre" }),
  ).toHaveCount(0);
});
test("combined finance and coach roles can record performance and access financial pages", async ({
  page,
  request,
}) => {
  const suffix = Date.now(),
    username = "combined-" + suffix,
    password = "test-combined-password";
  const clubResponse = await request.post("/api/clubs", {
    headers,
    data: { name: "Combined FC " + suffix },
  });
  expect(clubResponse.ok()).toBe(true);
  const club = await clubResponse.json();
  const playerResponse = await request.post("/api/players", {
    headers,
    data: {
      name: "Combined player " + suffix,
      position: "Forward",
      clubId: club.id,
    },
  });
  expect(playerResponse.ok()).toBe(true);
  const player = await playerResponse.json();
  const created = await request.post("/api/users", {
    headers,
    data: { username, password, roles: ["FINANCE", "COACH"] },
  });
  expect(created.ok()).toBe(true);
  await login(page, username, password);
  await page
    .getByRole("button", { name: /^Performances/ })
    .first()
    .click();
  await page
    .getByRole("searchbox", { name: "Find player", exact: true })
    .fill(player.name);
  await page
    .getByLabel("Player", { exact: true })
    .selectOption({ label: player.name });
  await page.getByLabel("Match date", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Minutes", { exact: true }).fill("90");
  await page.getByLabel("Goals", { exact: true }).fill("1");
  await page.getByLabel("Assists", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save record →" }).click();
  await page
    .getByRole("searchbox", { name: "Search performances" })
    .fill(player.name);
  await expect(
    page.getByRole("cell", { name: player.name, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Contracts/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Contracts", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Users/ })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("club filters find clubs beyond the first lookup page", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const suffix = Date.now(),
    created = [];
  for (let start = 0; start < 55; start += 5) {
    const responses = await Promise.all(
      Array.from({ length: Math.min(5, 55 - start) }, (_, offset) =>
        request.post("/api/clubs", {
          headers,
          data: {
            name:
              "Capacity " +
              suffix +
              " " +
              String(start + offset).padStart(2, "0"),
          },
        }),
      ),
    );
    for (const response of responses) {
      expect(response.ok()).toBe(true);
      created.push(await response.json());
    }
  }
  const target = created[created.length - 1];
  const firstPage = await request.get("/api/lookups/clubs?size=50", {
    headers,
  });
  expect(
    (await firstPage.json()).content.some(
      (c: { id: number }) => c.id === target.id,
    ),
  ).toBe(false);
  const playerName = "Capacity player " + suffix;
  const p = await request.post("/api/players", {
    headers,
    data: { name: playerName, position: "Goalkeeper", clubId: target.id },
  });
  expect(p.ok()).toBe(true);
  await login(page, "coach", "dev-coach");
  await page
    .getByRole("button", { name: /^Players/ })
    .first()
    .click();
  await page
    .getByRole("searchbox", { name: "Find a club", exact: true })
    .fill(target.name);
  await page
    .getByLabel("Filter by club", { exact: true })
    .selectOption({ label: target.name });
  await expect(
    page.getByRole("cell", { name: playerName, exact: true }),
  ).toBeVisible();
  const cleared = page.waitForResponse(
    (r) =>
      r.url().includes("/api/registers/players?") &&
      !r.url().includes("clubId="),
  );
  await page.getByLabel("Filter by club", { exact: true }).selectOption("");
  expect((await cleared).ok()).toBe(true);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("changing your own password signs out only that session", async ({
  page,
  request,
}) => {
  const username = "self-admin-" + Date.now(),
    password = "test-self-admin-password",
    nextPassword = "test-self-admin-updated";
  const created = await request.post("/api/users", {
    headers,
    data: { username, password, roles: ["ADMIN"] },
  });
  expect(created.ok()).toBe(true);
  await login(page, username, password);
  await page
    .getByRole("button", { name: /^Users/ })
    .first()
    .click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: username, exact: true }) });
  await row.getByRole("button", { name: "Manage account" }).click();
  await page.getByLabel("New password (optional)").fill(nextPassword);
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(page.getByRole("alert")).toContainText("Sign-in failed");
  await page.getByLabel("Password", { exact: true }).fill(nextPassword);
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Club command centre" }),
  ).toBeVisible();
});
