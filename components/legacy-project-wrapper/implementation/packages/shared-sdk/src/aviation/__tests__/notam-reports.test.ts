import { describe, expect, it, vi } from "vitest";
import { NotamReportsClient, validateNotamPage } from "../notam-reports.js";
import { nmsNotice, nmsPage, NOW } from "./notam-reports.fixtures.js";
const response = (v: unknown) => new Response(JSON.stringify(v));

describe("cached NMS report client", () => {
  it("does no startup request and preserves explicit missing/permanent/staging semantics", async () => {
    const row = nmsNotice({
      type: null,
      text: null,
      text_length: 0,
      effective_start_utc: null,
      effective_end_utc: null,
      permanent: true,
      missing_fields: ["type", "text", "effective_start"],
      activity: "source_incomplete",
      severity: null,
    });
    const page = nmsPage([row], {
      status: "partial",
      environment: "staging",
      production_data: false,
      incomplete_records: 1,
      source: {
        provider: "FAA NMS",
        url: null,
        environment: "staging",
        retrieved_at_utc: new Date(NOW).toISOString(),
      },
      warnings: ["Non-production data"],
    });
    const fetchFn = vi.fn(async () => response(page));
    const client = new NotamReportsClient({ fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
    const result = await client.fetch(["ksfo"]);
    expect(result.status).toBe("partial");
    expect(result.notams[0]).toEqual(row);
    expect(result.production_data).toBe(false);
    expect(result.warnings).toContain("Non-production data");
  });
  it("loads complete stable pages and pins the source snapshot on subsequent reads", async () => {
    const seen: string[] = [];
    const pages = [
      nmsPage([nmsNotice({ id: "one" })], {
        total: 2,
        limit: 1,
        next_offset: 1,
      }),
      nmsPage([nmsNotice({ id: "two" })], { total: 2, offset: 1, limit: 1 }),
    ];
    const client = new NotamReportsClient({
      fetchFn: async (url) => {
        seen.push(String(url));
        return response(pages.shift());
      },
    });
    const result = await client.fetch(["KSFO"]);
    expect(result.pages_fetched).toBe(2);
    expect(result.notams.map((n) => n.id)).toEqual(["one", "two"]);
    expect(seen[1]).toContain("snapshot_id=" + "a".repeat(64));
  });
  it.each(["snapshot", "total", "duplicate"] as const)(
    "rejects %s changes across pages rather than returning a mixed briefing",
    async (change) => {
      const pages = [
        nmsPage([nmsNotice({ id: "one" })], {
          total: 2,
          limit: 1,
          next_offset: 1,
        }),
        nmsPage([nmsNotice({ id: change === "duplicate" ? "one" : "two" })], {
          total: change === "total" ? 1 : 2,
          offset: 1,
          limit: 1,
          snapshot_id: (change === "snapshot" ? "b" : "a").repeat(64),
        }),
      ];
      const client = new NotamReportsClient({
        fetchFn: async () => response(pages.shift()),
      });
      await expect(client.fetch(["KSFO"])).rejects.toThrow("inconsistent");
    },
  );
  it("fetches full text using a constructed same-service link pinned to the snapshot", async () => {
    const text = "X".repeat(2500);
    const full = nmsNotice({ text });
    const preview = {
      ...full,
      text: text.slice(0, 2000),
      text_truncated: true,
    };
    const seen: string[] = [];
    const client = new NotamReportsClient({
      baseUrl: "http://127.0.0.1:18494/api/notams",
      fetchFn: async (url) => {
        seen.push(String(url));
        return response(
          seen.length === 1
            ? nmsPage([preview])
            : {
                status: "available",
                environment: "production",
                production_data: true,
                snapshot_id: "a".repeat(64),
                notice: full,
                source: nmsPage().source,
                source_feature: {
                  type: "Feature",
                  properties: { coreNOTAMData: { notam: { id: "A0001/26" } } },
                },
                warnings: [],
              },
        );
      },
    });
    expect((await client.fetch(["KSFO"])).notams[0].text).toBe(text);
    expect(seen[1]).toContain("/api/notams/detail?id=A0001%2F26&snapshot_id=");
  });
  it.each([-1, 240001])(
    "ages a cached response locally instead of accepting stale/future success (%s)",
    async (age) => {
      const client = new NotamReportsClient({
        now: () => NOW + age,
        fetchFn: async () => response(nmsPage()),
      });
      expect((await client.fetch(["KSFO"])).status).toBe("stale");
    },
  );
  it("preserves unavailable as incomplete, never as an empty successful briefing", async () => {
    const page = nmsPage([], {
      status: "unavailable",
      production_data: false,
      complete_snapshot: false,
      snapshot_id: null,
      synchronized_at: null,
      full_load_at: null,
      error: "Source unavailable",
      source: {
        provider: "FAA NMS",
        url: null,
        retrieved_at_utc: null,
        environment: "production",
      },
    });
    const result = await new NotamReportsClient({
      fetchFn: async () => response(page),
    }).fetch(["KSFO"]);
    expect(result.status).toBe("unavailable");
    expect(result.fully_loaded).toBe(false);
  });
  it.each([
    "http://untrusted.example/api/notams",
    "https://user:secret@service.example/api/notams",
    "https://service.example/api/notams?token=secret",
  ])("rejects unsafe service URLs: %s", (url) => {
    expect(() => new NotamReportsClient({ baseUrl: url })).toThrow(
      "URL must use HTTPS",
    );
  });
  it("does not follow arbitrary server detail links", async () => {
    const page = nmsPage([
      nmsNotice({ detail_url: "https://untrusted.example/collect" }),
    ]);
    const fetchFn = vi.fn(async () => response(page));
    await expect(
      new NotamReportsClient({ fetchFn }).fetch(["KSFO"]),
    ).rejects.toThrow("invalid");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it("bounds malformed or excessively large responses without source-body errors", async () => {
    let cancelled = false;
    const client = new NotamReportsClient({
      fetchFn: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
            },
            cancel() {
              cancelled = true;
            },
          }),
        ),
    });
    await expect(client.fetch(["KSFO"])).rejects.toThrow(
      "exceeds the client limit",
    );
    expect(cancelled).toBe(true);
  });
  it("releases fully consumed response readers without cancelling a completed browser fetch", async () => {
    const cancel = vi.spyOn(ReadableStreamDefaultReader.prototype, "cancel");
    const release = vi.spyOn(
      ReadableStreamDefaultReader.prototype,
      "releaseLock",
    );
    try {
      const client = new NotamReportsClient({
        fetchFn: async () => response(nmsPage([])),
      });
      await client.fetch(["KSFO"]);
      expect(cancel).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledTimes(1);
    } finally {
      cancel.mockRestore();
      release.mockRestore();
    }
  });
  it("preserves Unicode split across response chunks and rejects invalid UTF-8", async () => {
    const row = nmsNotice({ text: "RWY fermé — 雨" });
    const bytes = new TextEncoder().encode(JSON.stringify(nmsPage([row])));
    const client = new NotamReportsClient({
      fetchFn: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
              controller.close();
            },
          }),
        ),
    });
    expect((await client.fetch(["KSFO"])).notams[0].text).toBe(row.text);
    const invalid = new NotamReportsClient({
      fetchFn: async () => new Response(Uint8Array.of(0xff)),
    });
    await expect(invalid.fetch(["KSFO"])).rejects.toThrow();
  });
  it("does not present a production success flag for staging", () => {
    expect(() =>
      validateNotamPage(nmsPage([], { environment: "staging" })),
    ).toThrow("invalid");
  });
  it("does not hide missing UTC bounds behind a successful row", () => {
    expect(() =>
      validateNotamPage(nmsPage([nmsNotice({ effective_start_utc: null })])),
    ).toThrow("invalid");
  });
});

it("keeps the browser receiver for the default native fetch function", async () => {
  vi.stubGlobal("fetch", function (this: typeof globalThis) {
    expect(this).toBe(globalThis);
    return Promise.resolve(response(nmsPage()));
  });
  try {
    expect((await new NotamReportsClient().fetch(["KSFO"])).total).toBe(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
