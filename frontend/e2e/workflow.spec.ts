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
  await page.getByRole("searchbox", { name: "Search clubs" }).fill(a);
  await expect(page.getByRole("cell", { name: a, exact: true })).toBeVisible();
  await page.getByLabel("Club name").fill(b);
  await page.getByRole("button", { name: "Save record →" }).click();
  await page.getByRole("searchbox", { name: "Search clubs" }).fill(b);
  await expect(page.getByRole("cell", { name: b, exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Players", exact: false })
    .first()
    .click();
  await page.getByLabel("Player name").fill(p);
  await page.getByLabel("Position", { exact: true }).fill("Forward");
  await page.getByLabel("Club", { exact: true }).selectOption({ label: a });
  await page.getByRole("button", { name: "Save record →" }).click();
  await page.getByRole("searchbox", { name: "Search players" }).fill(p);
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
  await page.getByRole("searchbox", { name: "Search contracts" }).fill(p);
  await page.getByLabel("Starts").fill("2026-01-01");
  await page.getByLabel("Ends").fill("2028-12-31");
  await page.getByLabel("Annual salary").fill("100000");
  await page.getByRole("button", { name: "Save record →" }).click();
  await page.getByRole("button", { name: "Sign", exact: true }).last().click();
  await expect(
    page.getByRole("dialog", { name: "Sign contract?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "DRAFT", exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign", exact: true }).last().click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "SIGNED", exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Search contracts" }).fill(p);
  await page.getByRole("button", { name: "Renew", exact: true }).click();
  await expect(page.getByLabel("Starts", { exact: true })).toHaveValue(
    "2029-01-01",
  );
  await expect(page.getByLabel("Ends", { exact: true })).toHaveValue(
    "2029-12-31",
  );
  await page.getByLabel("Annual salary").fill("110000");
  await page.getByRole("button", { name: "Save renewal draft" }).click();
  await expect(
    page.getByRole("cell", { name: "100000", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "110000", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Contract status", { exact: true })
    .selectOption("DRAFT");
  await expect(
    page.getByRole("cell", { name: "SIGNED", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "DRAFT", exact: true }),
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
    .getByRole("button", { name: /^Players/ })
    .first()
    .click();
  await page.getByRole("searchbox", { name: "Search players" }).fill(p);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Player profile" }),
  ).toContainText("Midfielder");
  await expect(
    page.getByRole("region", { name: "Player profile" }),
  ).toContainText("Goals per 90");
  await page
    .getByRole("button", { name: "Transfers", exact: false })
    .first()
    .click();
  await page.getByLabel("Player", { exact: true }).selectOption({ label: p });
  await page.getByLabel("Destination club").selectOption({ label: b });
  await page.getByRole("searchbox", { name: "Search transfers" }).fill(p);
  await page.getByLabel("Transfer fee").fill("250000");
  await page.getByRole("button", { name: "Save record →" }).click();
  await expect(
    page.getByRole("dialog", { name: "Complete transfer?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "250000", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save record →" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "250000", exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Contracts", exact: false })
    .first()
    .click();
  await page.getByRole("searchbox", { name: "Search contracts" }).fill(p);
  await page
    .getByLabel("Contract status", { exact: true })
    .selectOption("TERMINATED");
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
test("mobile sign-out clears the finance workspace before coach login", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("dev-admin");
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Club command centre" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Contracts/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Contracts", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Username")).toHaveValue("");
  await page.getByLabel("Username").fill("coach");
  await page.getByLabel("Password").fill("dev-coach");
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Club command centre" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Contracts|Transfers/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("finance prepares a renewal from the expiry dashboard", async ({
  page,
  request,
}) => {
  const headers = {
    Authorization: "Basic " + Buffer.from("admin:dev-admin").toString("base64"),
  };
  const name = "Expiry " + Date.now();
  const clubResponse = await request.post("/api/clubs", {
    headers,
    data: { name },
  });
  expect(clubResponse.ok()).toBe(true);
  const club = await clubResponse.json();
  const playerResponse = await request.post("/api/players", {
    headers,
    data: { name, position: "Goalkeeper", clubId: club.id },
  });
  expect(playerResponse.ok()).toBe(true);
  const player = await playerResponse.json();
  const today = new Date();
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 30);
  const next = new Date(end);
  next.setUTCDate(next.getUTCDate() + 1);
  const contractResponse = await request.post("/api/contracts", {
    headers,
    data: {
      playerId: player.id,
      clubId: club.id,
      starts: today.toISOString().slice(0, 10),
      ends: end.toISOString().slice(0, 10),
      salary: 75000,
    },
  });
  expect(contractResponse.ok()).toBe(true);
  const contract = await contractResponse.json();
  const signResponse = await request.post(
    "/api/contracts/" + contract.id + "/sign",
    { headers, data: { version: contract.version } },
  );
  expect(signResponse.ok()).toBe(true);
  await page.goto("/");
  await page.getByLabel("Username").fill("finance");
  await page.getByLabel("Password").fill("dev-finance");
  await page.getByRole("button", { name: "Sign in →" }).click();
  const item = page.getByRole("listitem").filter({ hasText: name });
  await expect(item).toContainText("Ends " + end.toISOString().slice(0, 10));
  await item.getByRole("button", { name: "Prepare renewal" }).click();
  await expect(page.getByLabel("Starts", { exact: true })).toHaveValue(
    next.toISOString().slice(0, 10),
  );
  await expect(page.getByLabel("Annual salary")).toHaveValue("75000");
  await page.getByRole("button", { name: "Save renewal draft" }).click();
  await page.getByRole("searchbox", { name: "Search contracts" }).fill(name);
  await expect(
    page.getByRole("cell", { name: "SIGNED", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "DRAFT", exact: true }),
  ).toBeVisible();
});
