// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentsPanel from "./DocumentsPanel";
import AccountsPanel from "./AccountsPanel";
import App from "./App";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("rejects oversized documents before sending their contents", async () => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
  vi.stubGlobal("fetch", fetch);
  render(<DocumentsPanel contractId={1} auth="test" onClose={() => {}} />);
  const u = userEvent.setup();
  await u.upload(
    screen.getByLabelText("Contract PDF"),
    new File([new Uint8Array(6 * 1024 * 1024)], "large.pdf", {
      type: "application/pdf",
    }),
  );
  await u.click(screen.getByRole("button", { name: "Attach PDF" }));
  expect(screen.getByRole("alert").textContent).toContain("5 MiB");
  expect(fetch.mock.calls.length).toBe(1);
});
it("creates individual accounts without exposing the password in the register", async () => {
  let users: unknown[] = [];
  const api = vi.fn(async (path: string, body?: unknown) => {
    if (body) {
      const input = body as { username: string; roles: string[] };
      users = [
        {
          id: 1,
          version: 0,
          username: input.username,
          roles: input.roles,
          enabled: true,
        },
      ];
      return users[0];
    }
    return users;
  });
  render(
    <AccountsPanel
      api={api}
      currentUsername="admin"
      onPasswordChanged={() => {}}
    />,
  );
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("New username"), "new-coach");
  await u.type(
    screen.getByLabelText("New password"),
    "a-private-test-password",
  );
  await u.click(screen.getByRole("button", { name: "Save account" }));
  await screen.findByRole("cell", { name: "new-coach" });
  expect(screen.queryByText("a-private-test-password")).toBeNull();
  expect(screen.getByRole("cell", { name: "COACH" })).toBeTruthy();
});
it("hides development credential hints in production mode", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ mode: "production", demoAvailable: false }),
    })),
  );
  render(<App />);
  await screen.findByRole("button", { name: "Sign in →" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByText(/Development accounts/)).toBeNull();
});
it("keeps an existing selected player when lookup results change", async () => {
  const { default: LookupSelect } = await import("./LookupSelect");
  const api = vi.fn(async (path: string) => ({
    content: path.includes("id=101")
      ? [{ id: 101, name: "Selected player" }]
      : [{ id: 1, name: "Other player" }],
  }));
  render(
    <LookupSelect
      name="playerId"
      label="Player"
      kind="players"
      initial={[]}
      defaultValue={101}
      api={api}
    />,
  );
  await screen.findByRole("option", { name: "Selected player" });
  const u = userEvent.setup();
  await u.type(screen.getByRole("searchbox", { name: "Find player" }), "Other");
  await screen.findByRole("option", { name: "Other player" });
  expect(
    (screen.getByRole("combobox", { name: "Player" }) as HTMLSelectElement)
      .value,
  ).toBe("101");
});
it("holds form submission until an existing off-page selection is resolved", async () => {
  const { default: LookupSelect } = await import("./LookupSelect");
  const { useState } = await import("react");
  let resolveSelected: ((value: unknown) => void) | undefined;
  const api = vi.fn(async (path: string) =>
    path.includes("id=101")
      ? new Promise((resolve) => {
          resolveSelected = resolve;
        })
      : { content: [{ id: 1, name: "First club" }] },
  );
  function Form() {
    const [busy, setBusy] = useState(false);
    return (
      <form onSubmit={(e) => e.preventDefault()}>
        <LookupSelect
          name="clubId"
          label="Club"
          kind="clubs"
          initial={[]}
          defaultValue={101}
          api={api}
          onBusyChange={setBusy}
        />
        <button disabled={busy}>Save selection</button>
      </form>
    );
  }
  render(<Form />);
  const { waitFor, act } = await import("@testing-library/react");
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Save selection",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true),
  );
  await act(async () => {
    resolveSelected?.({ content: [{ id: 101, name: "Resolved club" }] });
  });
  await screen.findByRole("option", { name: "Resolved club" });
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Save selection",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(
    (screen.getByRole("combobox", { name: "Club" }) as HTMLSelectElement).value,
  ).toBe("101");
});
