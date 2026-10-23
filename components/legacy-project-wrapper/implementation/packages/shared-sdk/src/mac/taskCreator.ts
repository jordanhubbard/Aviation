import crypto from "crypto";

export type CreateTaskResult = {
  created: boolean;
  taskId?: string;
  reason?: string;
};

export type MacTaskCreatorOptions = {
  hubUrl?: string;
  token?: string;
  project?: string;
  requireDebug?: boolean;
  debug?: boolean;
  actor?: string;
};

export type CreateTaskOptions = {
  title: string;
  description: string;
  taskType?: string;
  priority?: number;
  dependsOn?: string;
  dedupeTtlMs?: number;
};

const envFlag = (name: string): string =>
  String(process.env[name] ?? "").toLowerCase();

export class MacTaskCreator {
  private recent = new Map<string, number>();
  private hubUrl: string;
  private token?: string;
  private project: string;
  private requireDebug: boolean;
  private debug: boolean;
  private actor: string;

  constructor(options: MacTaskCreatorOptions = {}) {
    this.hubUrl = String(
      options.hubUrl ??
        process.env.MAC_API_URL ??
        process.env.MAC_URL ??
        process.env.MAC_HUB_URL ??
        "",
    ).replace(/\/$/, "");
    this.token = options.token ?? process.env.MAC_API_TOKEN;
    this.project =
      options.project ?? process.env.MAC_AUTOREPORT_PROJECT ?? "Aviation";
    this.requireDebug = options.requireDebug ?? false;
    this.debug = options.debug ?? false;
    this.actor = options.actor ?? "aviation-runtime-autoreport";
  }

  enabled(): boolean {
    const configured = envFlag("MAC_AUTOREPORT");
    if (configured === "0" || configured === "false" || configured === "no")
      return false;

    const force = ["1", "true", "yes"].includes(
      envFlag("MAC_AUTOREPORT_FORCE"),
    );
    if (!force && (process.env.CI || process.env.NODE_ENV === "test"))
      return false;
    if (this.requireDebug && !this.debug) return false;
    return Boolean(this.hubUrl);
  }

  private signature(title: string, description: string): string {
    const hash = crypto.createHash("sha256");
    hash.update(title, "utf8");
    hash.update("\0", "utf8");
    hash.update(description, "utf8");
    return hash.digest("hex");
  }

  async createTask(options: CreateTaskOptions): Promise<CreateTaskResult> {
    if (!this.enabled()) {
      return { created: false, reason: "MAC autoreport disabled" };
    }

    const signature = this.signature(options.title, options.description);
    const dedupeTtlMs = options.dedupeTtlMs ?? 15 * 60 * 1000;
    const now = Date.now();
    const last = this.recent.get(signature);
    if (last && now - last < dedupeTtlMs) {
      return { created: false, reason: "deduped" };
    }
    this.recent.set(signature, now);

    const dependsOn = options.dependsOn ?? process.env.MAC_AUTOREPORT_PARENT;
    const body = {
      title: options.title,
      description: options.description,
      project: this.project,
      priority: options.priority ?? 1,
      dependencies: dependsOn ? [dependsOn] : [],
      metadata: {
        source: "aviation-runtime-autoreport",
        task_type: options.taskType ?? "bug",
        signature,
        auto_filed: true,
      },
      actor: this.actor,
      idempotency_key: `aviation-autoreport:${signature}`,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${this.hubUrl}/tasks`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          created: false,
          reason: `MAC task create failed (HTTP ${response.status})`,
        };
      }
      const payload = (await response.json()) as { id?: unknown };
      const taskId = payload.id ? String(payload.id) : undefined;
      if (!taskId) {
        return {
          created: false,
          reason: "MAC task create returned no task id",
        };
      }
      return { created: true, taskId };
    } catch (error) {
      return {
        created: false,
        reason: `MAC task create failed: ${String(error)}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async createAutoFiledTask(
    options: CreateTaskOptions & { autoFiledContext: string },
  ): Promise<CreateTaskResult> {
    return this.createTask({
      ...options,
      description: `${options.description}\n\nAuto-filed context:\n${options.autoFiledContext}`,
    });
  }
}
