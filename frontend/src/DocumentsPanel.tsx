import { useEffect, useState, type FormEvent } from "react";
type Doc = {
  id: number;
  filename: string;
  byteCount: number;
  sha256: string;
  uploadedAt: string;
  uploadedBy: string;
};
export default function DocumentsPanel({
  contractId,
  auth,
  onClose,
}: {
  contractId: number;
  auth: string;
  onClose: () => void;
}) {
  const [documents, setDocuments] = useState<Doc[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, refresh] = useState(0),
    [notice, setNotice] = useState("");
  const path = "/api/contracts/" + contractId + "/documents";
  useEffect(() => {
    let active = true;
    setDocuments([]);
    fetch(path, { headers: { Authorization: "Basic " + auth } })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load documents");
        return r.json();
      })
      .then((r) => {
        if (active) setDocuments(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [contractId, auth, revision]);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form),
      file = data.get("file") as File;
    if (!file || file.size > 5 * 1024 * 1024) {
      setError("Choose a PDF document up to 5 MiB");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: "Basic " + auth,
          "X-Requested-With": "Touchline",
        },
        body: data,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || error.error || "Upload failed");
      }
      refresh((x) => x + 1);
      form.reset();
      setNotice("Document attached. Earlier documents remain unchanged.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(doc: Doc) {
    setError("");
    try {
      const r = await fetch(path + "/" + doc.id, {
        headers: { Authorization: "Basic " + auth },
      });
      if (!r.ok) throw new Error("Download failed");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="panel" aria-label="Contract documents">
      <div className="section-heading">
        <h2>Contract documents</h2>
        <button className="secondary" onClick={onClose}>
          Close documents
        </button>
      </div>
      <p>
        PDF files up to 5 MiB. Attachments are append-only; download files only
        when you trust their source.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <ul className="document-list">
        {documents.map((d) => (
          <li key={d.id}>
            <button onClick={() => void download(d)}>
              Download {d.filename}
            </button>
            <span>
              {Math.ceil(d.byteCount / 1024)} KiB · {d.uploadedBy} ·{" "}
              {new Date(d.uploadedAt).toLocaleDateString()}
            </span>
            <details>
              <summary>Integrity checksum</summary>
              <code>{d.sha256}</code>
            </details>
          </li>
        ))}
      </ul>
      {documents.length === 0 && <p>No documents attached yet.</p>}
      <form className="gridform" onSubmit={upload}>
        <label>
          Contract PDF
          <input
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            onChange={(e) =>
              setError(
                (e.target.files?.[0]?.size ?? 0) > 5 * 1024 * 1024
                  ? "Choose a PDF document up to 5 MiB"
                  : "",
              )
            }
            required
          />
        </label>
        <button disabled={busy} className="submit">
          {busy ? "Uploading…" : "Attach PDF"}
        </button>
      </form>
    </section>
  );
}
