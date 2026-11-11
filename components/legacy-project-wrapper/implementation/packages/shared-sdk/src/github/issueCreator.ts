import crypto from "node:crypto";

export type CreateIssueResult = {
  created: boolean;
  issueNumber?: number;
  issueUrl?: string;
  reason?: string;
};
export type GitHubIssueCreatorOptions = {
  repository?: string;
  apiUrl?: string;
  token?: string;
  requireDebug?: boolean;
  debug?: boolean;
};
export type CreateIssueOptions = {
  title: string;
  body: string;
  dedupeTtlMs?: number;
};
const flag = (name: string) =>
  ["1", "true", "yes"].includes(String(process.env[name] ?? "").toLowerCase());

/** Public issue bodies must not contain credentials or URL query parameters. */
export function redactIssueText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s<>"']+/g, (raw) => {
      try {
        const url = new URL(raw);
        url.username = "";
        url.password = "";
        url.search = "";
        url.hash = "";
        return url.toString();
      } catch {
        return "[redacted URL]";
      }
    })
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g,
      "[REDACTED]",
    )
    .replace(
      /\b(token|password|secret|api[_-]?key|authorization|cookie)(["']?\s*[:=]\s*["']?)[^\s,;"']+/gi,
      "$1$2[REDACTED]",
    );
}

/** Opt-in, server-side GitHub reporter. No legacy tracker or credential fallback. */
export class GitHubIssueCreator {
  private recent = new Map<string, number>();
  private inFlight = new Set<string>();
  private attempts: number[] = [];
  private repository: string;
  private apiUrl: string;
  private token?: string;
  private requireDebug: boolean;
  private debug: boolean;

  constructor(options: GitHubIssueCreatorOptions = {}) {
    this.repository =
      options.repository ??
      process.env.GITHUB_ISSUES_REPOSITORY ??
      "jordanhubbard/Aviation";
    if (
      !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(
        this.repository,
      )
    )
      throw new Error("Invalid GitHub issue repository");
    const api = new URL(
      options.apiUrl ?? process.env.GITHUB_API_URL ?? "https://api.github.com",
    );
    if (
      api.username ||
      api.password ||
      api.search ||
      api.hash ||
      (api.protocol !== "https:" &&
        !(
          api.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(api.hostname)
        ))
    )
      throw new Error(
        "GitHub issue API must use HTTPS or explicit loopback HTTP",
      );
    this.apiUrl = api.toString().replace(/\/$/, "");
    this.token = options.token ?? process.env.GITHUB_ISSUES_TOKEN;
    this.requireDebug = options.requireDebug ?? false;
    this.debug = options.debug ?? false;
  }
  enabled(): boolean {
    if (!flag("GITHUB_ISSUES_AUTOREPORT")) return false;
    if (
      !flag("GITHUB_ISSUES_AUTOREPORT_FORCE") &&
      (process.env.CI || process.env.NODE_ENV === "test")
    )
      return false;
    return Boolean(this.token) && (!this.requireDebug || this.debug);
  }
  async createIssue(options: CreateIssueOptions): Promise<CreateIssueResult> {
    if (!this.enabled())
      return { created: false, reason: "GitHub issue reporting disabled" };
    const title = redactIssueText(options.title).slice(0, 180);
    const body = redactIssueText(options.body).slice(0, 60000);
    const signature = crypto
      .createHash("sha256")
      .update(title)
      .update("\0")
      .update(body)
      .digest("hex");
    const now = Date.now();
    if (
      this.inFlight.has(signature) ||
      now - (this.recent.get(signature) ?? 0) < (options.dedupeTtlMs ?? 900000)
    )
      return { created: false, reason: "deduped" };
    this.attempts = this.attempts.filter((time) => now - time < 3600000);
    if (this.attempts.length >= 5)
      return { created: false, reason: "GitHub issue reporting rate limited" };
    this.attempts.push(now);
    this.inFlight.add(signature);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(
        `${this.apiUrl}/repos/${this.repository}/issues`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "aviation-runtime-issue-reporter",
          },
          body: JSON.stringify({
            title,
            body: `${body}\n\n<!-- aviation-autoreport:${signature} -->`,
          }),
        },
      );
      if (!response.ok)
        return {
          created: false,
          reason: `GitHub issue create failed (HTTP ${response.status})`,
        };
      const payload = (await response.json()) as {
        number?: unknown;
        html_url?: unknown;
      };
      if (
        !Number.isInteger(payload.number) ||
        Number(payload.number) <= 0 ||
        typeof payload.html_url !== "string"
      )
        return {
          created: false,
          reason: "GitHub issue create returned an invalid issue",
        };
      this.recent.set(signature, now);
      if (this.recent.size > 1024)
        this.recent.delete(this.recent.keys().next().value!);
      return {
        created: true,
        issueNumber: Number(payload.number),
        issueUrl: payload.html_url,
      };
    } catch {
      return { created: false, reason: "GitHub issue create unavailable" };
    } finally {
      clearTimeout(timeout);
      this.inFlight.delete(signature);
    }
  }
  async createAutoFiledIssue(
    options: CreateIssueOptions & { autoFiledContext: string },
  ): Promise<CreateIssueResult> {
    return this.createIssue({
      ...options,
      body: `${options.body}\n\nAuto-filed context:\n${options.autoFiledContext}`,
    });
  }
}
