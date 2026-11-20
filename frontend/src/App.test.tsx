// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("signs in as coach, displays dashboard, hides financial workflows", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => ({
      ok: true,
      json: async () =>
        input.endsWith("/me")
          ? { roles: ["ROLE_COACH"] }
          : input.endsWith("/dashboard")
            ? { clubs: 2, players: 22, goals: 7 }
            : [],
    })),
  );
  render(<App />);
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Username"), "coach");
  await u.type(screen.getByLabelText("Password"), "dev-coach");
  await u.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByText("Club command centre");
  expect(screen.queryByRole("button", { name: /Contracts/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Transfers/ })).toBeNull();
  await screen.findByText("22");
});
it("reports failed authentication", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
  );
  render(<App />);
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Username"), "wrong");
  await u.type(screen.getByLabelText("Password"), "wrong");
  await u.click(screen.getByRole("button", { name: /Sign in/ }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Sign-in failed"),
  );
});
it("searches names, pages registers and shows an empty search result", async () => {
  const clubs = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    version: 0,
    name: `Club ${String(i + 1).padStart(2, "0")}`,
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => ({
      ok: true,
      json: async () =>
        input.includes("/registers/clubs?")
          ? (() => {
              const url = new URL(input, "http://test");
              const page = Number(url.searchParams.get("page")),
                size = Number(url.searchParams.get("size"));
              const filtered = clubs.filter((c) =>
                c.name
                  .toLowerCase()
                  .includes((url.searchParams.get("q") ?? "").toLowerCase()),
              );
              return {
                content: filtered.slice(page * size, (page + 1) * size),
                totalElements: filtered.length,
                totalPages: Math.ceil(filtered.length / size),
              };
            })()
          : input.endsWith("/me")
            ? { roles: ["ROLE_ADMIN"] }
            : input.endsWith("/dashboard")
              ? { clubs: 12 }
              : input.endsWith("/clubs")
                ? clubs
                : [],
    })),
  );
  render(<App />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), "admin");
  await user.type(screen.getByLabelText("Password"), "dev-admin");
  await user.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByText("Club command centre");
  await user.click(screen.getByRole("button", { name: /^Clubs/ }));
  await screen.findByRole("cell", { name: "Club 01" });
  expect(screen.queryByRole("cell", { name: "Club 12" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByRole("cell", { name: "Club 12" });
  await user.type(
    screen.getByRole("searchbox", { name: "Search clubs" }),
    "CLUB 02",
  );
  await screen.findByRole("cell", { name: "Club 02" });
  expect(screen.queryByRole("cell", { name: "Club 12" })).toBeNull();
  await user.clear(screen.getByRole("searchbox"));
  await user.type(screen.getByRole("searchbox"), "missing");
  await screen.findByText("No records match your search or filters.");
});
it("clears the financial page and edit defaults when changing from admin to coach", async () => {
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      const coach =
        headers?.Authorization === "Basic " + btoa("coach:dev-coach");
      requests.push((coach ? "coach:" : "admin:") + input);
      return {
        ok: true,
        json: async () =>
          input.endsWith("/me")
            ? { roles: [coach ? "ROLE_COACH" : "ROLE_ADMIN"] }
            : input.endsWith("/dashboard")
              ? { players: 1 }
              : input.includes("/registers/contracts?")
                ? {
                    totalElements: 1,
                    totalPages: 1,
                    content: [
                      {
                        id: 1,
                        version: 0,
                        playerId: 1,
                        clubId: 1,
                        starts: "2026-01-01",
                        ends: "2028-01-01",
                        salary: 123456,
                        status: "DRAFT",
                      },
                    ],
                  }
                : [],
      };
    }),
  );
  render(<App />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), "admin");
  await user.type(screen.getByLabelText("Password"), "dev-admin");
  await user.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByText("Club command centre");
  await user.click(screen.getByRole("button", { name: /^Contracts/ }));
  await screen.findByRole("cell", { name: "123456" });
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Sign out" }));
  expect((screen.getByLabelText("Username") as HTMLInputElement).value).toBe(
    "",
  );
  await user.type(screen.getByLabelText("Username"), "coach");
  await user.type(screen.getByLabelText("Password"), "dev-coach");
  await user.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByText("Club command centre");
  await waitFor(() =>
    expect(requests.some((p) => p === "coach:/api/dashboard")).toBe(true),
  );
  expect(requests.some((p) => p.startsWith("coach:/api/contracts"))).toBe(
    false,
  );
  expect(screen.queryByText("123456")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Contracts/ })).toBeNull();
});
it("clears cached financial state when the current session loses access", async () => {
  let denied = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => ({
      ok: !denied,
      status: denied ? 401 : 200,
      json: async () =>
        denied
          ? { error: "Invalid credentials" }
          : input.endsWith("/me")
            ? { roles: ["ROLE_FINANCE"], username: "finance" }
            : input.endsWith("/dashboard")
              ? { transferSpend: 9999 }
              : input.includes("/registers/")
                ? { content: [], totalElements: 0, totalPages: 0 }
                : [],
    })),
  );
  render(<App />);
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Username"), "finance");
  await u.type(screen.getByLabelText("Password"), "dev-finance");
  await u.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByText("€9,999");
  denied = true;
  await u.click(screen.getByRole("button", { name: /^Contracts/ }));
  await screen.findByLabelText("Username");
  expect(screen.getByRole("alert").textContent).toContain("Sign in again");
  expect(screen.queryByText("€9,999")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Contracts/ })).toBeNull();
});
it("ignores a delayed rejection from an earlier login with the same credentials", async () => {
  let finishHistory: ((value: unknown) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input.endsWith("/history"))
        return new Promise((resolve) => {
          finishHistory = resolve;
        });
      return {
        ok: true,
        status: 200,
        json: async () =>
          input.endsWith("/me")
            ? { roles: ["ROLE_ADMIN"], username: "admin" }
            : input.endsWith("/dashboard")
              ? { clubs: 1 }
              : input.includes("/registers/contracts?")
                ? {
                    content: [
                      {
                        id: 1,
                        version: 1,
                        playerId: 1,
                        clubId: 1,
                        starts: "2026-01-01",
                        ends: "2029-01-01",
                        salary: 100,
                        status: "SIGNED",
                      },
                    ],
                    totalElements: 1,
                    totalPages: 1,
                  }
                : [],
      };
    }),
  );
  render(<App />);
  const u = userEvent.setup();
  async function signIn() {
    await u.type(screen.getByLabelText("Username"), "admin");
    await u.type(screen.getByLabelText("Password"), "dev-admin");
    await u.click(screen.getByRole("button", { name: /Sign in/ }));
    await screen.findByText("Club command centre");
  }
  await signIn();
  await u.click(screen.getByRole("button", { name: /^Contracts/ }));
  await u.click(await screen.findByRole("button", { name: "History" }));
  await waitFor(() => expect(finishHistory).toBeTypeOf("function"));
  await u.click(screen.getByRole("button", { name: "Sign out" }));
  await signIn();
  const { act } = await import("@testing-library/react");
  await act(async () => {
    finishHistory?.({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid credentials" }),
    });
  });
  expect(screen.getByText("Club command centre")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});
it("shows a useful message when sign-in is rate limited", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many authentication failures" }),
    })),
  );
  render(<App />);
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Username"), "admin");
  await u.type(screen.getByLabelText("Password"), "wrong");
  await u.click(screen.getByRole("button", { name: /Sign in/ }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Please wait before trying again",
    ),
  );
});
it("does not sign out a new user when a previous account password update finishes late", async () => {
  let finishUpdate: ((value: unknown) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/users/1") && init?.method === "PUT")
        return new Promise((resolve) => {
          finishUpdate = resolve;
        });
      const coach =
        (init?.headers as Record<string, string>)?.Authorization ===
        "Basic " + btoa("coach:dev-coach");
      return {
        ok: true,
        status: 200,
        json: async () =>
          input.endsWith("/me")
            ? {
                username: coach ? "coach" : "admin",
                roles: [coach ? "ROLE_COACH" : "ROLE_ADMIN"],
              }
            : input.endsWith("/dashboard")
              ? { clubs: 1 }
              : input.endsWith("/users")
                ? [
                    {
                      id: 1,
                      version: 0,
                      username: "admin",
                      roles: ["ADMIN"],
                      enabled: true,
                    },
                  ]
                : [],
      };
    }),
  );
  render(<App />);
  const u = userEvent.setup();
  async function signIn(name: string) {
    await u.type(screen.getByLabelText("Username"), name);
    await u.type(screen.getByLabelText("Password"), "dev-" + name);
    await u.click(screen.getByRole("button", { name: /Sign in/ }));
    await screen.findByText("Club command centre");
  }
  await signIn("admin");
  await u.click(screen.getByRole("button", { name: /^Users/ }));
  await u.click(await screen.findByRole("button", { name: "Manage account" }));
  await u.type(
    screen.getByLabelText("New password (optional)"),
    "updated-admin-password",
  );
  await u.click(screen.getByRole("button", { name: "Save account" }));
  await waitFor(() => expect(finishUpdate).toBeTypeOf("function"));
  await u.click(screen.getByRole("button", { name: "Sign out" }));
  await signIn("coach");
  const { act } = await import("@testing-library/react");
  await act(async () => {
    finishUpdate?.({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        version: 1,
        username: "admin",
        roles: ["ADMIN"],
        enabled: true,
      }),
    });
  });
  expect(screen.getByText("Club command centre")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Users/ })).toBeNull();
});
