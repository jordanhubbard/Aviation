import { describe, expect, it, vi } from "vitest";
import { AircraftLibraryOCRClient } from "../aircraft-library.js";

describe("private OCR transport", () => {
  it("has no implicit reads and forwards selected IDs with source identities", async () => {
    const transport = vi.fn(async () => ({ id: "job_owned" }));
    const client = new AircraftLibraryOCRClient(transport);
    expect(transport).not.toHaveBeenCalled();
    const value = {
      expected_sha256: "a".repeat(64),
      expected_index_identity: "b".repeat(64),
      preview_id: "ocr_preview_test",
      preview_integrity_sha256: "c".repeat(64),
      selections: [{ page: 10, fragment_id: "fragment_11" }],
      reviewer: "Named reviewer",
      attest_matches_image: true as const,
    };
    await client.apply("doc_test", value);
    const [path, options] = transport.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(path).toBe("/documents/doc_test/ocr-reviews");
    expect(JSON.parse(options.body as string)).toEqual(value);
    expect(options).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
    });
  });
  it("retains binary image requests and inspects only the requested job", async () => {
    const transport = vi.fn(async () => ({}));
    const client = new AircraftLibraryOCRClient(transport);
    await client.image("doc_test", "ocr_preview_test", 10);
    expect(transport).toHaveBeenCalledWith(
      "/documents/doc_test/ocr-previews/ocr_preview_test/pages/10.png",
      expect.objectContaining({ cache: "no-store", redirect: "error" }),
      true,
    );
    await client.job("job_owned");
    expect(transport).toHaveBeenLastCalledWith(
      "/jobs/job_owned",
      expect.any(Object),
    );
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("rejects path injection and out of range image/history selection before transport", async () => {
    const transport = vi.fn();
    const client = new AircraftLibraryOCRClient(transport);
    expect(() => client.context("../private")).toThrow();
    await expect(
      client.image("doc_test", "ocr_preview_test", 0),
    ).rejects.toThrow();
    expect(() => client.history("doc_test", "ocr-reviews", -1)).toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("explicit table preview", () => {
  it("preserves selected mode, private transport and preprocessing provenance", async () => {
    const value = {
      mode: "table" as const,
      pages: [7],
      expected_sha256: "a".repeat(64),
      expected_index_identity: "b".repeat(64),
    };
    const preview = {
      mode: "table",
      pages: [
        {
          page: 7,
          image_sha256: "c".repeat(64),
          ocr_input_sha256: "d".repeat(64),
          ocr_preprocessing: {
            method: "straight-rules-v1",
            dark_threshold: 100,
            horizontal_min_run: 120,
            vertical_min_run: 80,
          },
        },
      ],
    };
    const transport = vi.fn(async () => preview);
    const client = new AircraftLibraryOCRClient(transport);
    await client.queuePreview("doc_test", value);
    expect(transport).toHaveBeenCalledWith(
      "/documents/doc_test/ocr-previews",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        redirect: "error",
        body: JSON.stringify(value),
      }),
    );
    expect(await client.preview("doc_test", "ocr_preview_test")).toEqual(
      preview,
    );
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
