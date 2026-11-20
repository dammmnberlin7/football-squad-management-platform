import { useState, useEffect, type FormEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import PlayerProfile, { type PlayerSummary } from "./PlayerProfile";
type Row = Record<string, string | number>;
const tabs = [
  "Overview",
  "Clubs",
  "Players",
  "Contracts",
  "Transfers",
  "Performances",
];
export default function App() {
  const [auth, setAuth] = useState("");
  const [role, setRole] = useState("");
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState<Row[]>([]);
  const [stats, setStats] = useState<Row>({});
  const [clubs, setClubs] = useState<Row[]>([]);
  const [players, setPlayers] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, refresh] = useState(0);
  const [history, setHistory] = useState<Row[]>([]);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [query, setQuery] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [expiring, setExpiring] = useState<Row[]>([]);
  const [renewing, setRenewing] = useState<Row | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [profile, setProfile] = useState<PlayerSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<{
    title: string;
    description: string;
    run: () => Promise<void>;
  } | null>(null);
  const finance = role === "ADMIN" || role === "FINANCE";
  const admin = role === "ADMIN";
  const visible = (key: string) => !["id", "version"].includes(key);
  const heading = (key: string) =>
    (
      ({
        clubId: "Club",
        playerId: "Player",
        fromClubId: "From club",
        toClubId: "To club",
        salary: "Annual salary (EUR)",
        fee: "Fee (EUR)",
      }) as Record<string, string>
    )[key] ?? key.replace(/([A-Z])/g, " $1");
  const cell = (key: string, value: string | number) => {
    if (key === "playerId")
      return players.find((p) => p.id === value)?.name ?? value;
    if (["clubId", "fromClubId", "toClubId"].includes(key))
      return clubs.find((c) => c.id === value)?.name ?? value;
    return String(value ?? "—");
  };
  const filteredRows = data.filter((row) => {
    if (
      clubFilter &&
      ![
        row.clubId,
        row.fromClubId,
        row.toClubId,
        tab === "Clubs" ? row.id : undefined,
        tab === "Performances"
          ? players.find((p) => p.id === row.playerId)?.clubId
          : undefined,
      ].some((id) => String(id) === clubFilter)
    )
      return false;
    if (statusFilter && row.status !== statusFilter) return false;
    return Object.entries(row)
      .filter(([key]) => visible(key))
      .some(([key, value]) =>
        String(cell(key, value))
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
      );
  });
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const displayedRows = filteredRows.slice(
    currentPage * 10,
    (currentPage + 1) * 10,
  );
  const defaults = editing ?? renewing;
  function navigate(next: string) {
    if (next === tab) refresh((x) => x + 1);
    setTab(next);
    setData([]);
    setEditing(null);
    setRenewing(null);
    setProfileId(null);
    setProfile(null);
    setHistory([]);
    setHistoryId(null);
    setQuery("");
    setClubFilter("");
    setStatusFilter("");
    setPage(0);
    setNotice("");
    setError("");
  }
  function logout() {
    setAuth("");
    setRole("");
    navigate("Overview");
    setClubs([]);
    setPlayers([]);
    setStats({});
    setExpiring([]);
    setPending(null);
    setBusy(false);
  }
  function beginRenewal(row: Row) {
    const starts = new Date(String(row.ends) + "T00:00:00Z");
    starts.setUTCDate(starts.getUTCDate() + 1);
    const ends = new Date(starts);
    ends.setUTCFullYear(ends.getUTCFullYear() + 1);
    ends.setUTCDate(ends.getUTCDate() - 1);
    setEditing(null);
    setRenewing({
      ...row,
      starts: starts.toISOString().slice(0, 10),
      ends: ends.toISOString().slice(0, 10),
    });
    setNotice(
      "Review the new term and salary, then save a separate renewal draft. The signed contract stays unchanged.",
    );
  }
  async function confirm() {
    if (!pending || saving) return;
    setSaving(true);
    setError("");
    try {
      await pending.run();
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!auth || profileId === null) {
      setProfile(null);
      return;
    }
    let active = true;
    setProfile(null);
    api("players/" + profileId + "/summary")
      .then((result) => {
        if (active) setProfile(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [auth, profileId, revision]);
  useEffect(() => {
    if (!auth || historyId === null) {
      setHistory([]);
      return;
    }
    let active = true;
    setHistory([]);
    api("contracts/" + historyId + "/history")
      .then((result) => {
        if (active) setHistory(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [auth, historyId, revision]);
  async function api(
    path: string,
    body?: unknown,
    method = "POST",
    token = auth,
  ) {
    const res = await fetch("/api/" + path, {
      headers: {
        Authorization: "Basic " + token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { method, body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      let message = "Request failed (" + res.status + ")";
      try {
        const e = await res.json();
        message = e.detail || e.error || message;
      } catch {}
      throw new Error(message);
    }
    return res.json();
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const token = btoa(f.get("username") + ":" + f.get("password"));
    try {
      const me = await api("me", undefined, "GET", token);
      navigate("Overview");
      setRole(me.roles[0].replace("ROLE_", ""));
      setAuth(token);
    } catch {
      setError("Sign-in failed. Check your credentials.");
    }
  }
  useEffect(() => {
    if (!auth) return;
    let active = true;
    setBusy(true);
    setError("");
    Promise.all([
      api("dashboard"),
      api("clubs"),
      api("players"),
      tab === "Overview" ? Promise.resolve([]) : api(tab.toLowerCase()),
      finance ? api("contracts/expiring?days=90") : Promise.resolve([]),
    ])
      .then(([s, c, p, d, due]) => {
        if (active) {
          setStats(s);
          setClubs(c);
          setPlayers(p);
          setData(d);
          setExpiring(due);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [auth, tab, revision]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body: Row = {};
    new FormData(form).forEach((v, k) => {
      body[k] = [
        "clubId",
        "playerId",
        "toClubId",
        "minutes",
        "goals",
        "assists",
        "playerVersion",
      ].includes(k)
        ? Number(v)
        : String(v);
    });
    if (tab === "Transfers") {
      body.playerVersion =
        players.find((p) => p.id === body.playerId)?.version ?? -1;
    }
    const save = async () => {
      if (editing) body.version = editing.version;
      await api(
        tab.toLowerCase() + (editing ? "/" + editing.id : ""),
        body,
        editing ? "PUT" : "POST",
      );
      setEditing(null);
      setRenewing(null);
      if (form.isConnected) form.reset();
      refresh((x) => x + 1);
      setNotice(
        renewing
          ? "Renewal draft created. Review and sign it separately."
          : "Record saved.",
      );
      setError("");
    };
    if (tab === "Transfers") {
      setPending({
        title: "Complete transfer?",
        description:
          "This moves the player to the destination club and terminates their signed contracts. The transfer fee and contract history will be recorded.",
        run: save,
      });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await save();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function action(row: Row, operation: string) {
    setPending({
      title: operation === "sign" ? "Sign contract?" : "Terminate contract?",
      description:
        operation === "sign"
          ? "Signing freezes the contract terms. Later changes require a new draft."
          : "This ends the signed contract and records the action in its history. Signed terms remain unchanged.",
      run: async () => {
        await api("contracts/" + row.id + "/" + operation, {
          version: row.version,
        });
        refresh((x) => x + 1);
        setNotice(
          operation === "sign" ? "Contract signed." : "Contract terminated.",
        );
      },
    });
  }
  const select = (name: string, rows: Row[], label: string) => (
    <label htmlFor={name}>
      {label}
      <select
        aria-label={label}
        id={name}
        name={name}
        defaultValue={defaults?.[name] ?? ""}
        required
      >
        <option value="">Select {label.toLowerCase()}</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
  const input = (name: string, label: string, type = "text", extra = {}) => (
    <label htmlFor={name}>
      {label}
      <input
        aria-label={label}
        id={name}
        name={name}
        defaultValue={defaults?.[name] ?? ""}
        type={type}
        required
        {...extra}
      />
    </label>
  );
  if (!auth)
    return (
      <main className="login">
        <div className="brand">◈ TOUCHLINE</div>
        <h1>
          Your club.
          <br />
          One clear view.
        </h1>
        <p>Football operations, from the squad to the boardroom.</p>
        <form onSubmit={login}>
          {input("username", "Username")}
          {input("password", "Password", "password")}
          <button>Sign in →</button>
        </form>
        {error && <p role="alert">{error}</p>}
        <small>
          Development accounts: admin, finance, coach.
          <br />
          Password: dev- followed by the account name.
        </small>
      </main>
    );
  const canCreate =
    admin ||
    (finance && ["Contracts", "Transfers"].includes(tab)) ||
    (["ADMIN", "COACH"].includes(role) && tab === "Performances");
  return (
    <div className="shell">
      <aside>
        <div className="brand">◈ TOUCHLINE</div>
        <p className="caption">FOOTBALL OPERATIONS</p>
        <nav>
          {tabs
            .filter((t) => finance || !["Contracts", "Transfers"].includes(t))
            .map((t) => (
              <button
                aria-current={tab === t ? "page" : undefined}
                className={tab === t ? "active" : ""}
                key={t}
                disabled={saving}
                onClick={() => navigate(t)}
              >
                {t}
                <span>→</span>
              </button>
            ))}
        </nav>
        <div className="account">
          <strong>{role}</strong>
          <br />
          <button disabled={saving} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main>
        <header>
          <span>WORKSPACE / {tab.toUpperCase()}</span>
          <span className="pill">● Operations console</span>
        </header>
        <section className="title">
          <p className="caption">THE BIG PICTURE</p>
          <h1>{tab === "Overview" ? "Club command centre" : tab}</h1>
          <p>Every decision starts with a clear view of your squad.</p>
        </section>
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
        {error && (
          <button
            className="secondary"
            onClick={() => {
              setEditing(null);
              setRenewing(null);
              refresh((x) => x + 1);
            }}
          >
            Reload records
          </button>
        )}
        {busy && <p role="status">Loading…</p>}
        {pending && (
          <ConfirmDialog
            title={pending.title}
            description={pending.description}
            busy={saving}
            onConfirm={() => void confirm()}
            onCancel={() => setPending(null)}
          />
        )}
        {tab === "Overview" ? (
          <>
            <div className="stats">
              {Object.entries(stats).map(([k, v]) => (
                <article key={k}>
                  <span>{k.replace(/([A-Z])/g, " $1")}</span>
                  <strong>
                    {k === "transferSpend"
                      ? new Intl.NumberFormat("en-GB", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0,
                        }).format(Number(v))
                      : v}
                  </strong>
                  <small>Across your workspace</small>
                </article>
              ))}
            </div>
            {finance && (
              <section className="panel">
                <h2>Contracts ending in the next 90 days</h2>
                {expiring.length === 0 ? (
                  <p>No signed contracts are approaching their end date.</p>
                ) : (
                  <ul className="expiry-list">
                    {expiring.map((c) => (
                      <li key={c.id}>
                        <span>
                          <strong>{cell("playerId", c.playerId)}</strong> ·{" "}
                          {cell("clubId", c.clubId)}
                          <small>Ends {c.ends}</small>
                        </span>
                        <button
                          onClick={() => {
                            navigate("Contracts");
                            beginRenewal(c);
                          }}
                        >
                          Prepare renewal
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            <section className="panel">
              <h2>Built around the game</h2>
              <p>
                Manage your clubs and squad, record match performances, and keep
                contract decisions in one place.
              </p>
              <div className="quick">
                {tabs
                  .slice(1)
                  .filter(
                    (t) => finance || !["Contracts", "Transfers"].includes(t),
                  )
                  .map((t) => (
                    <button key={t} onClick={() => navigate(t)}>
                      Open {t.toLowerCase()} →
                    </button>
                  ))}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="panel">
              <h2>
                {tab} register{" "}
                <small>
                  {filteredRows.length} of {data.length} records
                </small>
              </h2>
              <div className="register-tools">
                <label>
                  Search {tab.toLowerCase()}
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Search by name or record details"
                  />
                </label>
                {tab !== "Clubs" && (
                  <label>
                    Filter by club
                    <select
                      aria-label="Filter by club"
                      value={clubFilter}
                      onChange={(e) => {
                        setClubFilter(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">All clubs</option>
                      {clubs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {tab === "Contracts" && (
                  <label>
                    Contract status
                    <select
                      aria-label="Contract status"
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">All statuses</option>
                      {["DRAFT", "SIGNED", "TERMINATED"].map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {filteredRows.length === 0 ? (
                <p>
                  {data.length === 0
                    ? "No records yet."
                    : "No records match your search or filters."}
                </p>
              ) : (
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(data[0])
                          .filter(visible)
                          .map((k) => (
                            <th key={k}>{heading(k)}</th>
                          ))}
                        {(tab === "Players" ||
                          (["Clubs", "Contracts"].includes(tab) &&
                            canCreate)) && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRows.map((row) => (
                        <tr key={row.id}>
                          {Object.entries(row)
                            .filter(([k]) => visible(k))
                            .map(([k, v]) => (
                              <td key={k}>{cell(k, v)}</td>
                            ))}
                          {(tab === "Players" ||
                            (["Clubs", "Contracts"].includes(tab) &&
                              canCreate)) && (
                            <td>
                              {tab === "Players" && (
                                <button
                                  onClick={() => setProfileId(Number(row.id))}
                                >
                                  Profile
                                </button>
                              )}
                              {canCreate &&
                                (tab !== "Contracts" ||
                                  row.status === "DRAFT") && (
                                  <button
                                    disabled={saving || busy}
                                    onClick={() => {
                                      setEditing(row);
                                      setRenewing(null);
                                    }}
                                  >
                                    Edit
                                  </button>
                                )}
                              {tab === "Contracts" && (
                                <>
                                  {row.status === "DRAFT" && (
                                    <button
                                      disabled={saving || busy}
                                      onClick={() => action(row, "sign")}
                                    >
                                      Sign
                                    </button>
                                  )}
                                  {row.status === "SIGNED" && (
                                    <button
                                      disabled={saving || busy}
                                      onClick={() => beginRenewal(row)}
                                    >
                                      Renew
                                    </button>
                                  )}
                                  {row.status === "SIGNED" && (
                                    <button
                                      disabled={saving || busy}
                                      onClick={() => action(row, "terminate")}
                                    >
                                      Terminate
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setHistoryId(Number(row.id))}
                                  >
                                    History
                                  </button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {filteredRows.length > 10 && (
                <div className="pagination">
                  <button
                    className="secondary"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous page
                  </button>
                  <span>
                    Page {currentPage + 1} of {pageCount}
                  </span>
                  <button
                    className="secondary"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next page
                  </button>
                </div>
              )}
              {historyId !== null && (
                <div aria-label="Contract history">
                  <h3>Contract history</h3>
                  {history.length === 0 && <p>No lifecycle events yet.</p>}
                  {history.map((h) => (
                    <p key={h.id}>
                      {h.action} · {h.actor} · {h.occurredAt}
                    </p>
                  ))}
                </div>
              )}
            </section>
            {profile && (
              <PlayerProfile
                summary={profile}
                onClose={() => setProfileId(null)}
              />
            )}
            {canCreate && (
              <section className="panel">
                <h2>
                  {renewing
                    ? "Prepare renewal"
                    : (editing ? "Edit" : "Add") +
                      " " +
                      tab.toLowerCase().slice(0, -1)}
                </h2>
                {(editing || renewing) && (
                  <button
                    onClick={() => {
                      setEditing(null);
                      setRenewing(null);
                    }}
                  >
                    Cancel edit
                  </button>
                )}
                <form
                  key={
                    tab +
                    String(
                      editing?.id ?? (renewing ? "renew" + renewing.id : "new"),
                    )
                  }
                  className="gridform"
                  onSubmit={submit}
                >
                  {tab === "Clubs" &&
                    input("name", "Club name", "text", { maxLength: 120 })}
                  {tab === "Players" && (
                    <>
                      {input("name", "Player name", "text", { maxLength: 120 })}
                      {input("position", "Position", "text", { maxLength: 40 })}
                      {select("clubId", clubs, "Club")}
                    </>
                  )}
                  {tab === "Contracts" && (
                    <>
                      {select("playerId", players, "Player")}
                      {select("clubId", clubs, "Club")}
                      {input("starts", "Starts", "date")}
                      {input("ends", "Ends", "date")}
                      {input("salary", "Annual salary", "number", {
                        min: 0,
                        step: ".01",
                      })}
                    </>
                  )}
                  {tab === "Transfers" && (
                    <>
                      {select("playerId", players, "Player")}
                      {select("toClubId", clubs, "Destination club")}
                      {input("fee", "Transfer fee", "number", {
                        min: 0,
                        step: ".01",
                      })}
                    </>
                  )}
                  {tab === "Performances" && (
                    <>
                      {select("playerId", players, "Player")}
                      {input("matchDate", "Match date", "date")}
                      {input("minutes", "Minutes", "number", {
                        min: 0,
                        max: 130,
                      })}
                      {input("goals", "Goals", "number", { min: 0, max: 50 })}
                      {input("assists", "Assists", "number", {
                        min: 0,
                        max: 50,
                      })}
                    </>
                  )}
                  <button className="submit" disabled={saving || busy}>
                    {saving
                      ? "Saving…"
                      : renewing
                        ? "Save renewal draft"
                        : "Save record →"}
                  </button>
                </form>
              </section>
            )}
          </>
        )}
        <footer>
          TOUCHLINE <span>Squad intelligence. Clear decisions.</span>
        </footer>
      </main>
    </div>
  );
}
