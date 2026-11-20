import { useEffect, useState } from "react";
type Choice = { id: string | number; name: string | number };
export default function LookupSelect({
  name,
  label,
  kind,
  initial,
  defaultValue,
  api,
}: {
  name: string;
  label: string;
  kind: "clubs" | "players";
  initial: Choice[];
  defaultValue?: string | number;
  api: (path: string) => Promise<unknown>;
}) {
  const [query, setQuery] = useState(""),
    [options, setOptions] = useState(initial),
    [selected, setSelected] = useState(String(defaultValue ?? "")),
    [chosen, setChosen] = useState<Choice | undefined>(
      initial.find((c) => String(c.id) === String(defaultValue)),
    ),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("lookups/" + kind + "?size=50&q=" + encodeURIComponent(query))
      .then((r) => {
        if (active) {
          setOptions((r as { content: Choice[] }).content ?? []);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Could not load options. Try another search.");
      });
    return () => {
      active = false;
    };
  }, [kind, query]);
  useEffect(() => {
    if (!defaultValue || chosen) return;
    let active = true;
    api("lookups/" + kind + "?id=" + defaultValue)
      .then((r) => {
        if (active) setChosen((r as { content: Choice[] }).content?.[0]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [defaultValue]);
  const rows =
    chosen && !options.some((c) => String(c.id) === String(chosen.id))
      ? [chosen, ...options]
      : options;
  return (
    <div className="lookup">
      <label htmlFor={"find-" + name}>
        Find {label.toLowerCase()}
        <input
          id={"find-" + name}
          type="search"
          maxLength={120}
          value={query}
          placeholder="Type a name to find more"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label htmlFor={name}>
        {label}
        <select
          id={name}
          name={name}
          aria-label={label}
          required
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setChosen(rows.find((c) => String(c.id) === e.target.value));
          }}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {rows.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
