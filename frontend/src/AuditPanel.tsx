import { useEffect, useState } from "react";
type Entry = {
  id: number;
  actor: string;
  action: string;
  resource: string;
  resourceId: number;
  occurredAt: string;
};
export default function AuditPanel({
  api,
}: {
  api: (path: string) => Promise<unknown>;
}) {
  const [rows, setRows] = useState<Entry[]>([]),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(1),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setBusy(true);
    api("audit?page=" + page + "&size=20&q=" + encodeURIComponent(query))
      .then((result) => {
        if (active) {
          const p = result as { content: Entry[]; totalPages: number };
          setRows(p.content);
          setPages(Math.max(1, p.totalPages));
          setError("");
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
  }, [page, query]);
  return (
    <section className="panel">
      <h2>Audit trail</h2>
      <p>
        Financial roles see financial events only. Passwords and document
        contents are excluded.
      </p>
      <label>
        Search audit
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading audit…</p>}
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.occurredAt).toLocaleString()}</td>
                <td>{e.actor}</td>
                <td>{e.action.replaceAll("_", " ")}</td>
                <td>{e.resource}</td>
                <td>{e.resourceId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!busy && rows.length === 0 && <p>No audit events match this search.</p>}
      <div className="pagination">
        <button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>
          Previous audit page
        </button>
        <span>
          Page {page + 1} of {pages}
        </span>
        <button
          disabled={busy || page >= pages - 1}
          onClick={() => setPage(page + 1)}
        >
          Next audit page
        </button>
      </div>
    </section>
  );
}
