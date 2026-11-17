import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

type Leg = {
  fix: string;
  path_type: string | null;
  altitude_constraint: string | null;
  speed_constraint: string | null;
  altitude_ft: number | null;
  course_deg: number | null;
};
type Procedure = {
  record: {
    identifier: string;
    procedure_type: string;
    runway: string | null;
    transitions: string[];
    legs: Leg[];
  };
  provider: {
    id: string;
    route_type: string;
    omitted_from_common_legs: number;
    usage: string;
    records: {
      raw: string;
      fields: Record<string, string>;
      primary: boolean;
    }[];
  };
};
type Navigation = {
  airport: string;
  procedures: Procedure[];
  total: number;
  page: number;
  limit: number;
  source: {
    cycle: string;
    url: string;
    effective_from: string;
    effective_to: string;
    retrieved_at: string;
    source_checked_at: string;
    freshness: string;
    verification_state: string;
    records_sha256: string;
  };
  limitations: string;
  parse_receipt: { rejected: unknown[] };
};
const api = import.meta.env.VITE_API_BASE_URL ?? "";
const planning = "https://flight-planner.jordanhubbard.net/charts";
const display = (value: string | number | null) =>
  value === null ? "Unknown" : value;
const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const nullableText = (value: unknown) =>
  value === null || typeof value === "string";
const nullableNumber = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value));
function validNavigation(value: unknown): value is Navigation {
  const result = object(value),
    source = object(result?.source),
    receipt = object(result?.parse_receipt);
  if (
    !result ||
    !source ||
    !receipt ||
    !Array.isArray(receipt.rejected) ||
    typeof result.airport !== "string" ||
    typeof result.limitations !== "string" ||
    !Array.isArray(result.procedures) ||
    !Number.isInteger(result.total) ||
    !Number.isInteger(result.page) ||
    !Number.isInteger(result.limit)
  )
    return false;
  if (
    ![
      "cycle",
      "url",
      "effective_from",
      "effective_to",
      "retrieved_at",
      "source_checked_at",
      "records_sha256",
    ].every((key) => typeof source[key] === "string") ||
    source.freshness !== "current" ||
    source.verification_state !== "verified"
  )
    return false;
  for (const entry of result.procedures) {
    const item = object(entry),
      record = object(item?.record),
      provider = object(item?.provider);
    if (
      !record ||
      !provider ||
      typeof record.identifier !== "string" ||
      !["SID", "STAR", "APPROACH"].includes(String(record.procedure_type)) ||
      !nullableText(record.runway) ||
      !Array.isArray(record.transitions) ||
      !record.transitions.every((x) => typeof x === "string") ||
      !Array.isArray(record.legs)
    )
      return false;
    if (
      typeof provider.id !== "string" ||
      typeof provider.route_type !== "string" ||
      typeof provider.usage !== "string" ||
      !Number.isInteger(provider.omitted_from_common_legs) ||
      !Array.isArray(provider.records)
    )
      return false;
    for (const entry of record.legs) {
      const leg = object(entry);
      if (
        !leg ||
        typeof leg.fix !== "string" ||
        !["path_type", "altitude_constraint", "speed_constraint"].every((key) =>
          nullableText(leg[key]),
        ) ||
        !["altitude_ft", "course_deg"].every((key) => nullableNumber(leg[key]))
      )
        return false;
    }
    for (const entry of provider.records) {
      const raw = object(entry),
        fields = object(raw?.fields);
      if (
        !raw ||
        !fields ||
        typeof raw.raw !== "string" ||
        !Object.values(fields).every((x) => typeof x === "string")
      )
        return false;
    }
  }
  return true;
}

export function ProceduresPage() {
  const [airport, setAirport] = useState(() => {
    const supplied =
      new URLSearchParams(window.location.search).get("airport") ?? "";
    return /^[A-Za-z0-9]{3,4}$/.test(supplied) ? supplied.toUpperCase() : "";
  });
  const [kind, setKind] = useState("");
  const [runway, setRunway] = useState("");
  const [result, setResult] = useState<Navigation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const invalidate = useCallback(() => {
    generation.current++;
    request.current?.abort();
  }, []);
  useEffect(() => {
    invalidate();
    setResult(null);
    setError("");
    setBusy(false);
    return invalidate;
  }, [airport, kind, runway, invalidate]);

  async function load(page = 1) {
    invalidate();
    setResult(null);
    setError("");
    const code = airport.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(code)) {
      setError(
        "Enter a published three- or four-character airport identifier.",
      );
      setBusy(false);
      return;
    }
    const owner = generation.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(kind ? { procedure_type: kind } : {}),
        ...(runway.trim() ? { runway: runway.trim().toUpperCase() } : {}),
      });
      const response = await fetch(
        `${api}/api/navigation/${encodeURIComponent(code)}?${params}`,
        { signal: controller.signal },
      );
      const value = await response.json();
      if (controller.signal.aborted || owner !== generation.current) return;
      if (!response.ok)
        throw new Error(
          typeof value.detail === "string"
            ? value.detail
            : "Navigation service unavailable; procedure coverage is unverified.",
        );
      if (
        !validNavigation(value) ||
        value.airport !== code ||
        value.page !== page ||
        value.limit !== 20 ||
        value.total < value.procedures.length ||
        value.procedures.length !==
          Math.max(
            0,
            Math.min(value.limit, value.total - (page - 1) * value.limit),
          ) ||
        value.procedures.length > 20
      )
        throw new Error(
          "Navigation response is invalid or the cycle is not verified current.",
        );
      setResult(value);
    } catch (failure) {
      if (owner === generation.current && !controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Navigation service unavailable; procedure coverage is unverified.",
        );
    } finally {
      if (request.current === controller) request.current = null;
      if (owner === generation.current) setBusy(false);
    }
  }

  const sourceUrl = result?.source.url.startsWith("https://")
    ? result.source.url
    : null;
  return (
    <main className="procedure-browser">
      <nav aria-label="Simulator navigation">
        <Link to="/">Simulator dashboard</Link>{" "}
        <Link to="/settings">Settings</Link>
      </nav>
      <h1>FAA procedures and navigation cycles</h1>
      <p>
        Browse sourced departure, arrival and approach records. This reference
        does not activate a flight plan or provide complete avionics guidance.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label>
          Published airport identifier
          <input
            value={airport}
            onChange={(event) => setAirport(event.target.value.toUpperCase())}
            maxLength={4}
            autoComplete="off"
            placeholder="KSFO"
          />
        </label>
        <label>
          Procedure type
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="">All types</option>
            <option value="SID">Departures (SID)</option>
            <option value="STAR">Arrivals (STAR)</option>
            <option value="APPROACH">Approaches</option>
          </select>
        </label>
        <label>
          Runway (optional)
          <input
            value={runway}
            onChange={(event) => setRunway(event.target.value.toUpperCase())}
            maxLength={5}
          />
        </label>
        <button disabled={busy} type="submit">
          {busy ? "Loading procedures…" : "Load procedures"}
        </button>
      </form>
      <p>
        <a
          href={`${planning}${airport.trim() ? "?airport=" + encodeURIComponent(airport.trim().toUpperCase()) : ""}`}
        >
          Open FAA charts and airport diagrams
        </a>
      </p>
      {error && <p role="alert">{error}</p>}
      {!result && !error && !busy && (
        <p>
          Enter an airport and load its current records. No source request runs
          automatically.
        </p>
      )}
      {busy && <p role="status">Reading the shared navigation service…</p>}
      {result && (
        <section aria-label="Sourced procedure results">
          <h2>
            {result.airport} · FAA cycle {result.source.cycle}
          </h2>
          <p>
            Edition: {result.source.effective_from} through{" "}
            {result.source.effective_to} (end exclusive).
          </p>
          <p>
            Catalog verification: {result.source.verification_state} · checked{" "}
            {result.source.source_checked_at}. Source retrieved{" "}
            {result.source.retrieved_at}.
          </p>
          {sourceUrl && (
            <p>
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                Original FAA CIFP distribution
              </a>
            </p>
          )}
          <details>
            <summary>Source identity</summary>
            <p>Records SHA-256: {result.source.records_sha256}</p>
          </details>
          <p className="procedure-notice">{result.limitations}</p>
          {!!result.parse_receipt.rejected.length && (
            <p role="status">
              Some source records could not be translated. Coverage is
              incomplete; original records are retained by the shared service.
            </p>
          )}
          <p>
            {result.total} procedure/transition groups · page {result.page}
          </p>
          {result.total === 0 && (
            <p>
              No matching published procedure groups in this verified cycle.
              This does not establish complete airport or flight coverage.
            </p>
          )}
          {result.procedures.map((procedure) => (
            <article key={procedure.provider.id}>
              <h3>
                {procedure.record.identifier} ·{" "}
                {procedure.record.procedure_type} ·{" "}
                {procedure.record.transitions.join(", ") || "Common route"}
              </h3>
              <p>
                Runway: {display(procedure.record.runway)} · source route type:{" "}
                {procedure.provider.route_type}
              </p>
              <p>{procedure.provider.usage}</p>
              {procedure.provider.omitted_from_common_legs > 0 && (
                <p className="procedure-notice">
                  {procedure.provider.omitted_from_common_legs} source legs are
                  not represented in the common leg list; inspect the raw
                  records below.
                </p>
              )}
              <p className="procedure-table-hint">
                Scroll the table horizontally to read all constraints.
              </p>
              <div
                className="procedure-table"
                tabIndex={0}
                aria-label={`Leg table for ${procedure.record.identifier}`}
              >
                <table>
                  <caption>Common legs; unknown values remain unknown</caption>
                  <thead>
                    <tr>
                      <th>Fix</th>
                      <th>Path</th>
                      <th>Altitude (ft)</th>
                      <th>Altitude constraint</th>
                      <th>Course (deg)</th>
                      <th>Speed constraint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procedure.record.legs.map((leg, index) => (
                      <tr key={index}>
                        <td>{leg.fix}</td>
                        <td>{display(leg.path_type)}</td>
                        <td>{display(leg.altitude_ft)}</td>
                        <td>{display(leg.altitude_constraint)}</td>
                        <td>{display(leg.course_deg)}</td>
                        <td>{display(leg.speed_constraint)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>Original ARINC records and fields</summary>
                {procedure.provider.records.map((record, index) => (
                  <div key={index}>
                    <pre>{record.raw}</pre>
                    <dl>
                      {Object.entries(record.fields).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value || "Unspecified in source"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </details>
            </article>
          ))}
          <nav aria-label="Procedure pages">
            <button
              type="button"
              disabled={busy || result.page <= 1}
              onClick={() => void load(result.page - 1)}
            >
              Previous procedure page
            </button>
            <button
              type="button"
              disabled={busy || result.page * result.limit >= result.total}
              onClick={() => void load(result.page + 1)}
            >
              Next procedure page
            </button>
          </nav>
        </section>
      )}
    </main>
  );
}
