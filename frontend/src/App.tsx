import { useState, useEffect, useRef, type FormEvent } from "react";
import LookupSelect from "./LookupSelect";
import AccountsPanel from "./AccountsPanel";
import AuditPanel from "./AuditPanel";
import DocumentsPanel from "./DocumentsPanel";
import ConfirmDialog from "./ConfirmDialog";
import PlayerProfile, { type PlayerSummary } from "./PlayerProfile";
class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type Row = Record<string, string | number>;
const tabs = [
  "Overview",
  "Clubs",
  "Players",
  "Contracts",
  "Transfers",
  "Performances",
  "Audit",
  "Users",
];
export default function App() {
  const [auth, setAuth] = useState("");
  const session = useRef({ token: "", generation: 0 });
  const generation = session.current.generation;
  const [username, setUsername] = useState("");
  const [config, setConfig] = useState({
    mode: "development",
    demoAvailable: false,
  });
  const [total, setTotal] = useState(0);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [role, setRole] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
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
  const [lookupBusy, setLookupBusy] = useState<Record<string, boolean>>({});
  const waitingForOptions = Object.values(lookupBusy).some(Boolean);
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
  const filteredRows = data;
  const pageCount = Math.max(1, Math.ceil(total / 10));
  const currentPage = page;
  const displayedRows = data;
  const allowed = (t: string) =>
    t === "Users"
      ? admin
      : t === "Audit"
        ? finance
        : finance || !["Contracts", "Transfers"].includes(t);
  const defaults = editing ?? renewing;
  function navigate(next: string) {
    if (next === tab) refresh((x) => x + 1);
    setBusy(false);
    setTab(next);
    setData([]);
    setTotal(0);
    setDocumentId(null);
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
    session.current = { token: "", generation: session.current.generation + 1 };
    setAuth("");
    setRole("");
    setRoles([]);
    setUsername("");
    navigate("Overview");
    setClubs([]);
    setPlayers([]);
    setStats({});
    setExpiring([]);
    setPending(null);
    setBusy(false);
  }
  function expireSession(token: string, requestGeneration: number) {
    if (
      !token ||
      session.current.token !== token ||
      session.current.generation !== requestGeneration
    )
      return false;
    logout();
    setError("Your access changed. Sign in again.");
    return true;
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
  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((c) => {
        if (c.mode) setConfig(c);
      })
      .catch(() => {});
  }, []);
  async function api(
    path: string,
    body?: unknown,
    method = "POST",
    token = auth,
  ) {
    const requestSession = session.current;
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
      if (
        [401, 403].includes(res.status) &&
        token &&
        requestSession.token === token
      ) {
        expireSession(token, requestSession.generation);
        message = "Your access changed. Sign in again.";
      }
      if (res.status === 429)
        message = "Too many sign-in attempts. Please wait before trying again.";
      throw new RequestError(res.status, message);
    }
    return res.json();
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const token = btoa(
      String.fromCharCode(
        ...new TextEncoder().encode(
          f.get("username") + ":" + f.get("password"),
        ),
      ),
    );
    try {
      const me = await api("me", undefined, "GET", token);
      navigate("Overview");
      setRoles(me.roles.map((r: string) => r.replace("ROLE_", "")));
      setUsername(me.username ?? String(f.get("username")));
      setRole(
        me.roles.some((r: string) => r === "ROLE_ADMIN")
          ? "ADMIN"
          : me.roles.some((r: string) => r === "ROLE_FINANCE")
            ? "FINANCE"
            : "COACH",
      );
      session.current = { token, generation: session.current.generation + 1 };
      setAuth(token);
    } catch (error) {
      setError(
        error instanceof RequestError && error.status === 429
          ? error.message
          : "Sign-in failed. Check your credentials.",
      );
    }
  }
  useEffect(() => {
    if (!auth) return;
    let active = true;
    Promise.all([
      api("dashboard"),
      api("lookups/clubs?size=100"),
      api("lookups/players?size=100"),
      finance ? api("contracts/expiring?days=90") : Promise.resolve([]),
    ])
      .then(([s, c, p, due]) => {
        if (active) {
          setStats(s);
          setClubs((previous) =>
            Array.from(
              new Map(
                [...previous, ...(c.content ?? [])].map((row) => [row.id, row]),
              ).values(),
            ),
          );
          setPlayers((previous) =>
            Array.from(
              new Map(
                [...previous, ...(p.content ?? [])].map((row) => [row.id, row]),
              ).values(),
            ),
          );
          setExpiring(due);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [auth, revision]);
  useEffect(() => {
    if (!auth || ["Overview", "Users", "Audit"].includes(tab)) return;
    let active = true;
    setBusy(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      size: "10",
      q: query,
    });
    if (clubFilter) params.set("clubId", clubFilter);
    if (statusFilter) params.set("status", statusFilter);
    api("registers/" + tab.toLowerCase() + "?" + params)
      .then((result) => {
        if (active) {
          setPlayers((previous) =>
            Array.from(
              new Map(
                [...previous, ...(result.players ?? [])].map((row) => [
                  row.id,
                  row,
                ]),
              ).values(),
            ),
          );
          setClubs((previous) =>
            Array.from(
              new Map(
                [...previous, ...(result.clubs ?? [])].map((row) => [
                  row.id,
                  row,
                ]),
              ).values(),
            ),
          );
          setData(result.content);
          setTotal(result.totalElements);
          if (page > 0 && page >= result.totalPages)
            setPage(Math.max(0, result.totalPages - 1));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [auth, tab, page, query, clubFilter, statusFilter, revision]);
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
    <LookupSelect
      name={name}
      label={label}
      kind={name === "playerId" ? "players" : "clubs"}
      initial={rows as { id: number; name: string }[]}
      defaultValue={defaults?.[name]}
      api={api}
      onBusyChange={(value) =>
        setLookupBusy((previous) =>
          previous[name] === value ? previous : { ...previous, [name]: value },
        )
      }
    />
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
        {config.mode !== "production" && (
          <small>
            Development accounts: admin, finance, coach.
            <br />
            Password: dev- followed by the account name.
          </small>
        )}
      </main>
    );
  const canCreate =
    (admin && !["Audit", "Users"].includes(tab)) ||
    (finance && ["Contracts", "Transfers"].includes(tab)) ||
    ((admin || roles.includes("COACH")) && tab === "Performances");
  return (
    <div className="shell">
      <aside>
        <div className="brand">◈ TOUCHLINE</div>
        <p className="caption">FOOTBALL OPERATIONS</p>
        <nav>
          {tabs.filter(allowed).map((t) => (
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
        {tab === "Users" ? (
          <AccountsPanel
            api={api}
            currentUsername={username}
            onPasswordChanged={() => {
              if (
                session.current.token === auth &&
                session.current.generation === generation
              )
                logout();
            }}
          />
        ) : tab === "Audit" ? (
          <AuditPanel api={api} />
        ) : tab === "Overview" ? (
          <>
            {admin && config.demoAvailable && (
              <section className="panel">
                <h2>Explore the platform</h2>
                <p>
                  Load three sample clubs, eighteen players and performance
                  records. Existing records are preserved.
                </p>
                <button
                  onClick={() =>
                    setPending({
                      title: "Load demo data?",
                      description:
                        "This adds fictional records once to the disposable development database. It does not reset existing work.",
                      run: async () => {
                        const result = await api("dev/demo", {});
                        refresh((x) => x + 1);
                        setNotice(
                          result.alreadyLoaded
                            ? "Demo data is already loaded."
                            : "Demo data loaded. Explore the registers and dashboard.",
                        );
                      },
                    })
                  }
                >
                  Load demo data
                </button>
              </section>
            )}
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
                  .filter(allowed)
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
                {tab} register <small>{total} records</small>
              </h2>
              <div className="register-tools">
                <label>
                  Search {tab.toLowerCase()}
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setData([]);
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Search names, clubs or status"
                  />
                </label>
                {tab !== "Clubs" && (
                  <LookupSelect
                    key={tab}
                    name="club-filter"
                    label="Filter by club"
                    searchLabel="Find a club"
                    kind="clubs"
                    initial={clubs as { id: number; name: string }[]}
                    defaultValue={clubFilter}
                    api={api}
                    required={false}
                    emptyLabel="All clubs"
                    onChange={(value) => {
                      setData([]);
                      setClubFilter(value);
                      setPage(0);
                    }}
                  />
                )}
                {tab === "Contracts" && (
                  <label>
                    Contract status
                    <select
                      aria-label="Contract status"
                      value={statusFilter}
                      onChange={(e) => {
                        setData([]);
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
                  {query || clubFilter || statusFilter
                    ? "No records match your search or filters."
                    : "No records yet."}
                </p>
              ) : (
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(data[0] ?? {})
                          .filter(visible)
                          .map((k) => (
                            <th key={k}>{heading(k)}</th>
                          ))}
                        {(tab === "Players" ||
                          (["Clubs", "Contracts", "Performances"].includes(
                            tab,
                          ) &&
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
                            (["Clubs", "Contracts", "Performances"].includes(
                              tab,
                            ) &&
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
                                    onClick={() =>
                                      setDocumentId(Number(row.id))
                                    }
                                  >
                                    Documents
                                  </button>
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
              {total > 10 && (
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
            {documentId !== null && finance && (
              <DocumentsPanel
                contractId={documentId}
                auth={auth}
                onClose={() => setDocumentId(null)}
                onAccessDenied={() => expireSession(auth, generation)}
              />
            )}
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
                    ) +
                    ":" +
                    revision
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
                  <button
                    className="submit"
                    disabled={saving || busy || waitingForOptions}
                  >
                    {saving
                      ? "Saving…"
                      : waitingForOptions
                        ? "Loading options…"
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
