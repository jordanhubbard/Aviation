/** Cached FAA NMS reports. FAA credentials belong only to the ingestion worker. */
export type NotamStatus =
  "available" | "no_reports" | "partial" | "stale" | "unavailable";
export type NotamEnvironment = "production" | "staging" | "fit";
export interface NotamNotice {
  id: string;
  number: string | null;
  series: string | null;
  year: string | null;
  location: string;
  icao_location: string | null;
  text: string | null;
  text_length: number;
  text_truncated: boolean;
  detail_url: string;
  classification: string;
  type: string | null;
  effective_start_utc: string | null;
  effective_end_utc: string | null;
  cancelled_at_utc: string | null;
  last_updated_utc: string;
  permanent: boolean;
  estimated: boolean;
  schedule: string | null;
  activity:
    | "effective"
    | "scheduled"
    | "expired"
    | "cancelled"
    | "unknown_end"
    | "unknown_type"
    | "source_incomplete"
    | "schedule_requires_review";
  missing_fields: string[];
  severity: "critical" | "high" | "medium" | "low" | null;
}
export interface NotamReportPage {
  status: NotamStatus;
  environment: NotamEnvironment | null;
  production_data: boolean;
  complete_snapshot: boolean;
  snapshot_id: string | null;
  requested_locations: string[];
  matched_locations: string[];
  source: {
    provider: "FAA NMS";
    url: string | null;
    retrieved_at_utc: string | null;
    environment: NotamEnvironment | null;
  };
  synchronized_at: string | null;
  full_load_at: string | null;
  incomplete_records: number;
  total: number;
  offset: number;
  limit: number;
  next_offset: number | null;
  notams: NotamNotice[];
  warnings: string[];
  error: string | null;
}
export interface NotamBriefing extends Omit<
  NotamReportPage,
  "offset" | "limit" | "next_offset"
> {
  fully_loaded: boolean;
  pages_fetched: number;
}
export interface NotamSourceDetail {
  status: NotamStatus;
  environment: NotamEnvironment;
  production_data: boolean;
  snapshot_id: string;
  source: NotamReportPage["source"];
  notice: NotamNotice;
  source_feature: Record<string, unknown>;
  warnings: string[];
}
export interface NotamReportsOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}
const statuses = new Set([
  "available",
  "no_reports",
  "partial",
  "stale",
  "unavailable",
]);
const environments = new Set(["production", "staging", "fit"]);
const activities = new Set([
  "effective",
  "scheduled",
  "expired",
  "cancelled",
  "unknown_end",
  "unknown_type",
  "source_incomplete",
  "schedule_requires_review",
]);
const severities = new Set(["critical", "high", "medium", "low"]);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
const strings = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) &&
  v.length <= max &&
  v.every((s) => typeof s === "string" && s.length <= 4000);
const time = (v: unknown): v is string | null =>
  v === null ||
  (typeof v === "string" && v.endsWith("Z") && Number.isFinite(Date.parse(v)));
const nullableText = (v: unknown): v is string | null =>
  v === null || typeof v === "string";
const snapshot = (v: unknown): v is string | null =>
  v === null || (typeof v === "string" && /^[a-f0-9]{64}$/.test(v));
function fail(): never {
  throw new Error("NOTAM service returned an invalid or inconsistent report");
}

function notice(v: unknown): NotamNotice {
  if (
    !object(v) ||
    typeof v.id !== "string" ||
    !v.id ||
    v.id.length > 128 ||
    typeof v.location !== "string" ||
    !v.location ||
    !nullableText(v.icao_location) ||
    !nullableText(v.number) ||
    !nullableText(v.series) ||
    !nullableText(v.year) ||
    !nullableText(v.text) ||
    !integer(v.text_length) ||
    v.text_length > 1048576 ||
    typeof v.text_truncated !== "boolean" ||
    typeof v.detail_url !== "string" ||
    typeof v.classification !== "string" ||
    !nullableText(v.type) ||
    !time(v.effective_start_utc) ||
    !time(v.effective_end_utc) ||
    !time(v.cancelled_at_utc) ||
    !time(v.last_updated_utc) ||
    v.last_updated_utc === null ||
    typeof v.permanent !== "boolean" ||
    typeof v.estimated !== "boolean" ||
    !nullableText(v.schedule) ||
    !activities.has(String(v.activity)) ||
    !strings(v.missing_fields, 20) ||
    !(v.severity === null || severities.has(String(v.severity)))
  )
    fail();
  const n = v as unknown as NotamNotice;
  const length = Array.from(n.text ?? "").length;
  if (n.text_truncated ? length >= n.text_length : length !== n.text_length)
    fail();
  if (n.text === null && n.text_truncated) fail();
  if (n.permanent && n.effective_end_utc !== null) fail();
  if (!n.text && !n.missing_fields.includes("text")) fail();
  if (!n.effective_start_utc && !n.missing_fields.includes("effective_start"))
    fail();
  if (
    !n.effective_end_utc &&
    !n.permanent &&
    !n.missing_fields.includes("effective_end")
  )
    fail();
  if (!n.type && !n.missing_fields.includes("type")) fail();
  const prefix = "/api/notams/detail?";
  if (!n.detail_url.startsWith(prefix) || n.detail_url.includes("#")) fail();
  const target = new URLSearchParams(n.detail_url.slice(prefix.length));
  if ([...target.keys()].length !== 1 || target.get("id") !== n.id) fail();
  return n;
}

export function validateNotamPage(v: unknown): NotamReportPage {
  if (
    !object(v) ||
    !statuses.has(String(v.status)) ||
    !(v.environment === null || environments.has(String(v.environment))) ||
    typeof v.production_data !== "boolean" ||
    typeof v.complete_snapshot !== "boolean" ||
    !snapshot(v.snapshot_id) ||
    !strings(v.requested_locations, 100) ||
    !strings(v.matched_locations, 400) ||
    !object(v.source) ||
    v.source.provider !== "FAA NMS" ||
    v.source.environment !== v.environment ||
    !nullableText(v.source.url) ||
    !time(v.source.retrieved_at_utc) ||
    !time(v.synchronized_at) ||
    !time(v.full_load_at) ||
    !integer(v.incomplete_records) ||
    !integer(v.total) ||
    !integer(v.offset) ||
    !integer(v.limit) ||
    v.limit < 1 ||
    v.limit > 100 ||
    !(v.next_offset === null || integer(v.next_offset)) ||
    !Array.isArray(v.notams) ||
    v.notams.length > v.limit ||
    !strings(v.warnings, 100) ||
    !nullableText(v.error)
  )
    fail();
  const page = v as unknown as NotamReportPage;
  if (
    page.production_data !==
      (page.environment === "production" && page.complete_snapshot) ||
    page.complete_snapshot !== (page.snapshot_id !== null) ||
    page.incomplete_records > page.total ||
    (page.status === "no_reports" &&
      (page.total !== 0 || !page.complete_snapshot))
  )
    fail();
  if (
    page.next_offset !== null &&
    (page.next_offset !== page.offset + page.notams.length ||
      page.next_offset >= page.total ||
      page.next_offset <= page.offset)
  )
    fail();
  if (
    page.next_offset === null &&
    page.offset + page.notams.length < page.total
  )
    fail();
  page.notams.forEach(notice);
  return page;
}

async function json(response: Response, limit: number): Promise<unknown> {
  if (response.status === 409)
    throw new Error("NOTAM snapshot changed; reload the reports");
  if (!response.ok)
    throw new Error(`NOTAM service unavailable (HTTP ${response.status})`);
  const reader = response.body?.getReader();
  if (!reader) fail();
  const chunks: string[] = [];
  let size = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit)
        throw new Error("NOTAM service response exceeds the client limit");
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join(""));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export class NotamReportsClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  constructor(options: NotamReportsOptions = {}) {
    const configured =
      typeof process !== "undefined"
        ? process.env.AVIATION_NOTAM_API_BASE_URL
        : undefined;
    const url = new URL(
      options.baseUrl ??
        configured ??
        "https://meta-app.jordanhubbard.net/api/v1/planning/api/notams",
    );
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol === "http:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
      throw new Error(
        "NOTAM service URL must use HTTPS or loopback HTTP without credentials or query",
      );
    this.base = url.toString().replace(/\/$/, "");
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
  }
  private async request(
    path: string,
    signal?: AbortSignal,
    limit = 2 * 1024 * 1024,
  ): Promise<unknown> {
    const timeout = AbortSignal.timeout(15000);
    const response = await this.fetchFn(this.base + path, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    return json(response, limit);
  }
  async detail(
    id: string,
    snapshotId: string,
    signal?: AbortSignal,
  ): Promise<NotamSourceDetail> {
    if (!id || id.length > 128 || !/^[a-f0-9]{64}$/.test(snapshotId))
      throw new Error("A source ID and snapshot are required");
    const params = new URLSearchParams({ id, snapshot_id: snapshotId });
    const value = await this.request(
      "/detail?" + params,
      signal,
      16 * 1024 * 1024,
    );
    if (
      !object(value) ||
      value.snapshot_id !== snapshotId ||
      !environments.has(String(value.environment)) ||
      !statuses.has(String(value.status)) ||
      value.production_data !== (value.environment === "production") ||
      !object(value.source) ||
      value.source.provider !== "FAA NMS" ||
      value.source.environment !== value.environment ||
      !object(value.source_feature) ||
      value.source_feature.type !== "Feature" ||
      !strings(value.warnings, 100)
    )
      fail();
    const props = value.source_feature.properties;
    if (
      !object(props) ||
      !object(props.coreNOTAMData) ||
      !object(props.coreNOTAMData.notam) ||
      props.coreNOTAMData.notam.id !== id
    )
      fail();
    const full = notice(value.notice);
    if (full.id !== id || full.text_truncated) fail();
    return value as unknown as NotamSourceDetail;
  }
  async fetch(
    locations: string[],
    options: { signal?: AbortSignal; fullText?: boolean } = {},
  ): Promise<NotamBriefing> {
    if (
      !locations.length ||
      locations.length > 100 ||
      locations.some((v) => !/^[a-z0-9]{2,8}$/i.test(v))
    )
      throw new Error("Provide 1 to 100 source location identifiers");
    const wanted = [...new Set(locations.map((v) => v.toUpperCase()))].sort();
    let first: NotamReportPage | null = null;
    let offset = 0;
    let pages = 0;
    const rows: NotamNotice[] = [];
    const ids = new Set<string>();
    let status: NotamStatus = "available";
    const warnings = new Set<string>();
    let textBytes = 0;
    do {
      const params = new URLSearchParams({
        airport: wanted.join(","),
        offset: String(offset),
        limit: "100",
      });
      if (first?.snapshot_id) params.set("snapshot_id", first.snapshot_id);
      const page = validateNotamPage(
        await this.request("?" + params, options.signal),
      );
      if (
        JSON.stringify([...page.requested_locations].sort()) !==
          JSON.stringify(wanted) ||
        page.offset !== offset ||
        page.total > 5000 ||
        ++pages > 50
      )
        fail();
      if (!first) first = page;
      if (
        page.snapshot_id !== first.snapshot_id ||
        page.total !== first.total ||
        page.environment !== first.environment ||
        page.incomplete_records !== first.incomplete_records
      )
        fail();
      if (page.status === "unavailable") status = "unavailable";
      else if (status !== "unavailable" && page.status === "stale")
        status = "stale";
      else if (status === "available" && page.status === "partial")
        status = "partial";
      page.warnings.forEach((w) => warnings.add(w));
      for (let row of page.notams) {
        if (ids.has(row.id)) fail();
        ids.add(row.id);
        if (row.text_truncated && options.fullText !== false) {
          const detail = await this.detail(
            row.id,
            page.snapshot_id!,
            options.signal,
          );
          const full = detail.notice;
          if (
            detail.environment !== page.environment ||
            full.text_length !== row.text_length ||
            full.last_updated_utc !== row.last_updated_utc ||
            (row.text !== null && !full.text?.startsWith(row.text))
          )
            fail();
          row = full;
        }
        textBytes += new TextEncoder().encode(row.text ?? "").byteLength;
        if (textBytes > 8 * 1024 * 1024)
          throw new Error(
            "NOTAM briefing exceeds the client text bound; narrow the query",
          );
        rows.push(row);
      }
      if (page.next_offset === null) break;
      offset = page.next_offset;
    } while (true);
    if (!first || rows.length !== first.total) fail();
    if (status !== "unavailable" && first.complete_snapshot) {
      const age = this.now() - Date.parse(first.synchronized_at ?? "");
      if (!Number.isFinite(age) || age < 0 || age > 240000) status = "stale";
    }
    if (status === "available" && first.status === "no_reports")
      status = "no_reports";
    return {
      status,
      environment: first.environment,
      production_data: first.production_data,
      complete_snapshot: first.complete_snapshot,
      snapshot_id: first.snapshot_id,
      requested_locations: first.requested_locations,
      matched_locations: first.matched_locations,
      source: first.source,
      synchronized_at: first.synchronized_at,
      full_load_at: first.full_load_at,
      incomplete_records: first.incomplete_records,
      total: first.total,
      notams: rows,
      warnings: [...warnings],
      error: first.error,
      fully_loaded: first.complete_snapshot && status !== "unavailable",
      pages_fetched: pages,
    };
  }
}
