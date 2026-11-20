import { useEffect, useState, type FormEvent } from "react";
type Account = {
  id: number;
  version: number;
  username: string;
  roles: string[];
  enabled: boolean;
};
type Api = (path: string, body?: unknown, method?: string) => Promise<unknown>;
export default function AccountsPanel({
  api,
  currentUsername,
  onPasswordChanged,
}: {
  api: Api;
  currentUsername: string;
  onPasswordChanged: () => void;
}) {
  const [users, setUsers] = useState<Account[]>([]),
    [editing, setEditing] = useState<Account | null>(null),
    [roles, setRoles] = useState(["COACH"]),
    [enabled, setEnabled] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, refresh] = useState(0);
  useEffect(() => {
    let active = true;
    api("users")
      .then((r) => {
        if (active) setUsers(r as Account[]);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form),
      password = String(f.get("password") ?? "");
    setBusy(true);
    setError("");
    try {
      await api(
        "users" + (editing ? "/" + editing.id : ""),
        editing
          ? { version: editing.version, roles, enabled, password }
          : { username: f.get("username"), password, roles },
        editing ? "PUT" : "POST",
      );
      if (editing?.username === currentUsername && password) {
        onPasswordChanged();
        return;
      }
      setEditing(null);
      setRoles(["COACH"]);
      setEnabled(true);
      form.reset();
      refresh((x) => x + 1);
      setNotice(
        "Account saved. Disabled accounts lose access on their next request.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>User accounts</h2>
        <p>
          Create individual accounts, assign roles and revoke access. Passwords
          are never displayed.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="success">
            {notice}
          </p>
        )}
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Roles</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.roles.join(", ")}</td>
                  <td>{u.enabled ? "Enabled" : "Disabled"}</td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditing(u);
                        setRoles(u.roles);
                        setEnabled(u.enabled);
                        setError("");
                        setNotice("");
                      }}
                    >
                      Manage account
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>{editing ? "Manage " + editing.username : "Create account"}</h2>
        {editing && (
          <button
            className="secondary"
            onClick={() => {
              setEditing(null);
              setRoles(["COACH"]);
              setEnabled(true);
            }}
          >
            Cancel account edit
          </button>
        )}
        <form className="gridform" key={editing?.id ?? "new"} onSubmit={submit}>
          {!editing && (
            <label>
              New username
              <input
                name="username"
                required
                pattern="[a-zA-Z0-9._-]{3,80}"
                maxLength={80}
                autoComplete="off"
              />
            </label>
          )}
          <label>
            {editing ? "New password (optional)" : "New password"}
            <input
              name="password"
              type="password"
              required={!editing}
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
            />
          </label>
          <fieldset>
            <legend>Account roles</legend>
            {["ADMIN", "FINANCE", "COACH"].map((role) => (
              <label className="check" key={role}>
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={(e) =>
                    setRoles(
                      e.target.checked
                        ? [...roles, role]
                        : roles.filter((r) => r !== role),
                    )
                  }
                />
                {role}
              </label>
            ))}
          </fieldset>
          {editing && (
            <label className="check">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Account enabled
            </label>
          )}
          <button className="submit" disabled={busy || roles.length === 0}>
            {busy ? "Saving…" : "Save account"}
          </button>
        </form>
        <p>
          Use at least 12 characters. Changing your own password signs you out.
          You cannot remove your own administrator access.
        </p>
      </section>
    </>
  );
}
