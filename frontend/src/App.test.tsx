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
