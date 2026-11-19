/** Private manual-library image review operations. Supply the authenticated transport.
 * Credentials belong to the caller's private transport, never PDF metadata or jobs.
 * Poll only a job explicitly requested by the operator. Images require HTTP for >4 MiB.
 */
export type AircraftOCRMode = "normal" | "sparse" | "table" | "words";

export interface AircraftOCRPreprocessing {
  method: "straight-rules-v1";
  dark_threshold: 100;
  horizontal_min_run: number;
  vertical_min_run: number;
}

export interface AircraftOCRIdentity {
  expected_sha256: string;
  expected_index_identity: string;
}
export interface AircraftOCRSelection {
  page: number;
  fragment_id: string;
}
export interface AircraftOCRApply extends AircraftOCRIdentity {
  preview_id: string;
  preview_integrity_sha256: string;
  selections: AircraftOCRSelection[];
  reviewer: string;
  attest_matches_image: true;
}
/** Offsets count Unicode code points, not JavaScript UTF-16 code units. */
export interface AircraftTranscriptionBoldSpan {
  start: number;
  end: number;
  text: string;
}
export interface AircraftTranscriptionPresentation {
  bold_spans: AircraftTranscriptionBoldSpan[];
  attest_matches_image: true;
}
/** Operator-authored literal page text, separate from unchanged machine OCR. */
export interface AircraftTranscriptionApply extends AircraftOCRIdentity {
  preview_id: string;
  preview_integrity_sha256: string;
  page: number;
  image_sha256: string;
  text: string;
  presentation?: AircraftTranscriptionPresentation;
  reviewer: string;
  attest_matches_image: true;
}
export type AircraftSourceUseReview = Omit<
  AircraftTranscriptionApply,
  "text" | "presentation"
> &
  (
    | {
        action: "restrict";
        reason: "layout_relationships_unavailable" | "native_text_inaccurate";
      }
    | { action: "release"; reason: "original_text_reviewed" }
  );
export interface AircraftSourceLimitRecord {
  id: string;
  document_id: string;
  page: number;
  preview_id: string;
  preview_integrity_sha256: string;
  image_sha256: string;
  image_url: string;
  source_sha256: string;
  source_metadata: Record<string, unknown>;
  action: "restrict" | "release";
  reason:
    | "layout_relationships_unavailable"
    | "native_text_inaccurate"
    | "original_text_reviewed";
  reviewer: string;
  attest_matches_image: true;
  job_id: string;
  created_at: string;
  integrity_sha256: string;
  previous_review_id: string | null;
  before_index_identity: string;
  after_index_identity: string;
  current: boolean;
  active: boolean;
}
export interface AircraftSourceLimitHistory {
  items: AircraftSourceLimitRecord[];
  total: number;
  offset: number;
  limit: number;
  next_offset: number | null;
}
export interface AircraftTranscriptionProvenance {
  id: string;
  preview_id: string;
  page: number;
  image_sha256: string;
  source_sha256: string;
  source_metadata: Record<string, unknown>;
  reviewer: string;
  created_at: string;
  integrity_sha256: string;
  image_url: string;
  presentation?: AircraftTranscriptionPresentation | null;
}
export interface AircraftPageTranscription extends AircraftTranscriptionProvenance {
  document_id: string;
  preview_integrity_sha256: string;
  label: string;
  offset: number;
  passage_id: number;
  job_id: string;
  text: string;
  attest_matches_image: true;
  method: "operator_transcription";
  before_index_identity: string;
  after_index_identity: string;
  active: boolean;
  source_current: boolean;
}
export interface AircraftOCRContext {
  document_id: string;
  source_sha256: string;
  index_identity: string;
  source_metadata: Record<string, unknown>;
  page_count: number;
  modes: AircraftOCRMode[];
  max_pages: number;
}
export interface AircraftOCRFragment {
  id: string;
  text: string;
  offset: number;
  bbox: number[];
  confidence: number;
}
export interface AircraftOCRPage {
  page: number;
  label: string;
  width: number;
  height: number;
  fragments: AircraftOCRFragment[];
  error: string | null;
  image_sha256: string;
  ocr_input_sha256?: string | null;
  ocr_preprocessing?: AircraftOCRPreprocessing | null;
}
export interface AircraftOCRPreview extends Omit<
  AircraftOCRContext,
  "modes" | "max_pages"
> {
  id: string;
  job_id: string;
  integrity_sha256: string;
  source_current: boolean;
  mode: AircraftOCRMode;
  engine: string;
  engine_version: string;
  renderer: string;
  status: "preview" | "partial";
  approved: false;
  pages: AircraftOCRPage[];
}
export interface AircraftOCRReview {
  id: string;
  preview_id: string;
  document_id: string;
  reviewer: string;
  source_sha256: string;
  source_metadata: Record<string, unknown>;
  created_at: string;
  integrity_sha256: string;
  before_index_identity: string;
  after_index_identity: string;
  active: boolean;
  source_current: boolean;
  fragments: (AircraftOCRFragment & {
    page: number;
    label: string;
    passage_id: number;
  })[];
}
export interface AircraftLibraryJob {
  id: string;
  state: "queued" | "running" | "completed" | "failed";
  error: string | null;
  result: {
    preview_id?: string;
    review_id?: string;
    transcription_id?: string;
    embeddings?: string;
  } | null;
}
export interface AircraftOCRHistory {
  items: { id: string; created_at: string; integrity_sha256: string }[];
  next_offset: number | null;
}
export type AircraftLibraryTransport = (
  path: string,
  options?: RequestInit,
  binary?: boolean,
) => Promise<unknown>;
const id = (value: string): string => {
  if (!/^[a-zA-Z0-9_]{1,100}$/.test(value))
    throw new Error("Invalid library identifier");
  return encodeURIComponent(value);
};

/** Transport paths are relative to /api/aircraft-library. No implicit provider calls. */
export class AircraftLibraryOCRClient {
  constructor(private readonly request: AircraftLibraryTransport) {}
  private document(document: string): string {
    return `/documents/${id(document)}`;
  }
  private async get<T>(path: string): Promise<T> {
    return (await this.request(path, {
      cache: "no-store",
      redirect: "error",
    })) as T;
  }
  private async post<T>(path: string, value: unknown): Promise<T> {
    return (await this.request(path, {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    })) as T;
  }
  context(document: string): Promise<AircraftOCRContext> {
    return this.get(this.document(document) + "/ocr");
  }
  queuePreview(
    document: string,
    value: AircraftOCRIdentity & { pages: number[]; mode: AircraftOCRMode },
  ): Promise<AircraftLibraryJob> {
    return this.post(this.document(document) + "/ocr-previews", value);
  }
  preview(document: string, preview: string): Promise<AircraftOCRPreview> {
    return this.get(this.document(document) + `/ocr-previews/${id(preview)}`);
  }
  async image(document: string, preview: string, page: number): Promise<Blob> {
    if (!Number.isInteger(page) || page < 1 || page > 1500)
      throw new Error("Invalid physical page");
    return (await this.request(
      this.document(document) +
        `/ocr-previews/${id(preview)}/pages/${page}.png`,
      {
        cache: "no-store",
        redirect: "error",
        headers: { Accept: "image/png" },
      },
      true,
    )) as Blob;
  }
  apply(
    document: string,
    value: AircraftOCRApply,
  ): Promise<AircraftLibraryJob> {
    return this.post(this.document(document) + "/ocr-reviews", value);
  }
  review(document: string, review: string): Promise<AircraftOCRReview> {
    return this.get(this.document(document) + `/ocr-reviews/${id(review)}`);
  }
  embed(
    document: string,
    review: string,
    value: AircraftOCRIdentity,
  ): Promise<AircraftLibraryJob> {
    return this.post(
      this.document(document) + `/ocr-reviews/${id(review)}/embeddings`,
      value,
    );
  }
  history(
    document: string,
    kind: "ocr-previews" | "ocr-reviews",
    offset = 0,
  ): Promise<AircraftOCRHistory> {
    if (
      !["ocr-previews", "ocr-reviews"].includes(kind) ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 1_000_000
    )
      throw new Error("Invalid OCR history page");
    return this.get(
      this.document(document) + `/${kind}?limit=20&offset=${offset}`,
    );
  }
  job(job: string): Promise<AircraftLibraryJob> {
    return this.get(`/jobs/${id(job)}`);
  }
  transcribe(
    document: string,
    value: AircraftTranscriptionApply,
  ): Promise<AircraftLibraryJob> {
    return this.post(this.document(document) + "/transcriptions", value);
  }
  transcription(
    document: string,
    review: string,
  ): Promise<AircraftPageTranscription> {
    return this.get(this.document(document) + `/transcriptions/${id(review)}`);
  }
  transcriptions(document: string, offset = 0): Promise<AircraftOCRHistory> {
    if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000)
      throw new Error("Invalid transcription history page");
    return this.get(
      this.document(document) + `/transcriptions?limit=20&offset=${offset}`,
    );
  }
  embedTranscription(
    document: string,
    review: string,
    value: AircraftOCRIdentity,
  ): Promise<AircraftLibraryJob> {
    return this.post(
      this.document(document) + `/transcriptions/${id(review)}/embeddings`,
      value,
    );
  }
  reviewSourceUse(
    document: string,
    value: AircraftSourceUseReview,
  ): Promise<AircraftLibraryJob> {
    return this.post(this.document(document) + "/source-limits", value);
  }
  sourceLimit(
    document: string,
    review: string,
  ): Promise<AircraftSourceLimitRecord> {
    return this.get(this.document(document) + `/source-limits/${id(review)}`);
  }
  sourceLimits(
    document: string,
    offset = 0,
  ): Promise<AircraftSourceLimitHistory> {
    if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000)
      throw new Error("Invalid source-limit history page");
    return this.get(
      this.document(document) + `/source-limits?limit=20&offset=${offset}`,
    );
  }
}
