import { useEffect, useState, useRef } from "react";
type Choice = { id: string | number; name: string | number };
export default function LookupSelect({
  name,
  label,
  kind,
  initial,
  defaultValue,
  api,
  onChange,
  required = true,
  emptyLabel,
  searchLabel,
  onBusyChange,
}: {
  name: string;
  label: string;
  kind: "clubs" | "players";
  initial: Choice[];
  defaultValue?: string | number;
  api: (path: string) => Promise<unknown>;
  onChange?: (id: string) => void;
  required?: boolean;
  emptyLabel?: string;
  searchLabel?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [query, setQuery] = useState(""),
    [options, setOptions] = useState(initial),
    [selected, setSelected] = useState(String(defaultValue ?? "")),
    [chosen, setChosen] = useState<Choice | undefined>(
      initial.find((c) => String(c.id) === String(defaultValue)),
    ),
    [error, setError] = useState(""),
    [selectionError, setSelectionError] = useState(""),
    [loading, setLoading] = useState(true),
    [loadingSelection, setLoadingSelection] = useState(
      Boolean(defaultValue) &&
        !initial.some((c) => String(c.id) === String(defaultValue)),
    );
  const busyHandler = useRef(onBusyChange);
  busyHandler.current = onBusyChange;
  useEffect(() => {
    busyHandler.current?.(loading || loadingSelection);
  }, [loading, loadingSelection]);
  useEffect(() => () => busyHandler.current?.(false), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api("lookups/" + kind + "?size=50&q=" + encodeURIComponent(query))
      .then((r) => {
        if (active) {
          setOptions((r as { content: Choice[] }).content ?? []);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Could not load options. Try another search.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, query]);
  useEffect(() => {
    if (!defaultValue || chosen) {
      setLoadingSelection(false);
      return;
    }
    let active = true;
    setLoadingSelection(true);
    api("lookups/" + kind + "?id=" + defaultValue)
      .then((r) => {
        if (active) setChosen((r as { content: Choice[] }).content?.[0]);
      })
      .catch(() => {
        if (active)
          setSelectionError(
            "The selected record is unavailable. Search for another.",
          );
      })
      .finally(() => {
        if (active) setLoadingSelection(false);
      });
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
        {searchLabel ?? "Find " + label.toLowerCase()}
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
          required={required}
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setSelectionError("");
            onChange?.(e.target.value);
            setChosen(rows.find((c) => String(c.id) === e.target.value));
          }}
        >
          <option value="">
            {emptyLabel ?? "Select " + label.toLowerCase()}
          </option>
          {rows.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {(loading || loadingSelection) && (
        <small role="status">Loading {label.toLowerCase()}…</small>
      )}
      {(selectionError || error) && (
        <p role="alert">{selectionError || error}</p>
      )}
    </div>
  );
}
