/** Synthetic cache envelopes; these are not live FAA evidence. */
import type { NotamNotice, NotamReportPage } from "../notam-reports.js";
export const NOW = Date.now();
export function nmsNotice(changes: Partial<NotamNotice> = {}): NotamNotice {
  const id = changes.id ?? "A0001/26";
  const text = changes.text === undefined ? "RWY 28R CLSD" : changes.text;
  return {
    id,
    number: "04/123",
    series: null,
    year: "2026",
    location: "SFO",
    icao_location: "KSFO",
    text,
    text_length: Array.from(text ?? "").length,
    text_truncated: false,
    detail_url: "/api/notams/detail?" + new URLSearchParams({ id }),
    classification: "DOM",
    type: "N",
    effective_start_utc: new Date(NOW - 3600000).toISOString(),
    effective_end_utc: new Date(NOW + 86400000).toISOString(),
    cancelled_at_utc: null,
    last_updated_utc: new Date(NOW - 1000).toISOString(),
    permanent: false,
    estimated: false,
    schedule: null,
    activity: "effective",
    missing_fields: [],
    severity: "critical",
    ...changes,
  };
}
export function nmsPage(
  rows: NotamNotice[] = [nmsNotice()],
  changes: Partial<NotamReportPage> = {},
): NotamReportPage {
  return {
    status: rows.length ? "available" : "no_reports",
    environment: "production",
    production_data: true,
    complete_snapshot: true,
    snapshot_id: "a".repeat(64),
    requested_locations: ["KSFO"],
    matched_locations: ["KSFO", "SFO"],
    source: {
      provider: "FAA NMS",
      url: "https://api-nms.aim.faa.gov/nmsapi/v1/notams",
      retrieved_at_utc: new Date(NOW).toISOString(),
      environment: "production",
    },
    synchronized_at: new Date(NOW).toISOString(),
    full_load_at: new Date(NOW - 3600000).toISOString(),
    incomplete_records: 0,
    total: rows.length,
    offset: 0,
    limit: 100,
    next_offset: null,
    notams: rows,
    warnings: ["Not a complete NOTAM briefing"],
    error: null,
    ...changes,
  };
}
