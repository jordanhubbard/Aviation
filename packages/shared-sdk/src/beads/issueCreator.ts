import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import crypto from 'crypto';

export type CreateIssueResult = {
  created: boolean;
  issueId?: string;
  reason?: string;
};

export type BeadsIssueCreatorOptions = {
  repoRoot?: string;
  defaultParent?: string;
  requireDebug?: boolean;
  debug?: boolean;
  bdPath?: string;
};

export type CreateIssueOptions = {
  title: string;
  description: string;
  issueType?: string;
  priority?: number;
  discoveredFrom?: string;
  dedupeTtlMs?: number;
};

export class BeadsIssueCreator {
  private recent = new Map<string, number>();
  private repoRoot: string | null;
  private bdPath: string;

  private defaultParent?: string;
  private requireDebug: boolean;
  private debug: boolean;

  constructor(options: BeadsIssueCreatorOptions = {}) {
    this.repoRoot = options.repoRoot ?? findRepoRoot(process.cwd());
    this.bdPath = options.bdPath ?? 'bd';
    this.defaultParent = options.defaultParent;
    this.requireDebug = options.requireDebug ?? false;
    this.debug = options.debug ?? false;
  }

  enabled(): boolean {
    const v = String(process.env.BEADS_AUTOREPORT ?? '').toLowerCase();
    if (v === '0' || v === 'false' || v === 'no') return false;

    if (process.env.CI) return false;
    if (process.env.NODE_ENV === 'test') return false;

    if (this.requireDebug && !this.debug) return false;

    if (!this.repoRoot) return false;
    if (!fs.existsSync(path.join(this.repoRoot, '.beads'))) return false;

    try {
      const probe = spawnSync(this.bdPath, ['--help'], {
        cwd: this.repoRoot,
        stdio: 'ignore',
      });
      if (probe.error) return false;
      return probe.status === 0;
    } catch {
      return false;
    }
  }

  private signature(title: string, description: string): string {
    const h = crypto.createHash('sha256');
    h.update(title, 'utf8');
    h.update('\0', 'utf8');
    h.update(description, 'utf8');
    return h.digest('hex');
  }

  createIssue(options: CreateIssueOptions): CreateIssueResult {
    if (!this.enabled()) {
      return { created: false, reason: 'beads autoreport disabled' };
    }

    const repoRoot = this.repoRoot;
    if (!repoRoot) return { created: false, reason: 'missing repo root' };

    const issueType = options.issueType ?? 'bug';
    const priority = options.priority ?? 1;
    const dedupeTtlMs = options.dedupeTtlMs ?? 15 * 60 * 1000;

    const signature = this.signature(options.title, options.description);
    const now = Date.now();
    const last = this.recent.get(signature);
    if (last && now - last < dedupeTtlMs) {
      return { created: false, reason: 'deduped' };
    }
    this.recent.set(signature, now);

    const args = [
      'create',
      options.title,
      '--description',
      options.description,
      '-t',
      issueType,
      '-p',
      String(priority),
      '--json',
    ];

    const parent = options.discoveredFrom ?? process.env.BEADS_AUTOREPORT_PARENT ?? this.defaultParent;
    if (parent) {
      args.push('--deps', `discovered-from:${parent}`);
    }

    let proc;
    try {
      proc = spawnSync(this.bdPath, args, {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
      });
    } catch (error) {
      return { created: false, reason: `bd exec failed: ${String(error)}` };
    }

    if (proc.error) {
      return { created: false, reason: `bd exec failed: ${String(proc.error)}` };
    }

    if (proc.status !== 0) {
      return { created: false, reason: 'bd create failed' };
    }

    try {
      const payload = JSON.parse(String(proc.stdout ?? '')) as unknown;
      const issueId =
        payload && typeof payload === 'object' && 'id' in payload ? String((payload as any).id) : undefined;
      return { created: true, issueId };
    } catch {
      return { created: false, reason: 'bd create returned invalid json' };
    }
  }

  addComment(issueId: string, comment: string): boolean {
    if (!this.enabled()) return false;
    const repoRoot = this.repoRoot;
    if (!repoRoot) return false;

    try {
      const proc = spawnSync(this.bdPath, ['comments', 'add', issueId, comment, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
      });

      if (proc.error) return false;
      return proc.status === 0;
    } catch {
      return false;
    }
  }

  createAutoFiledIssue(options: CreateIssueOptions & { autoFiledComment: string }): CreateIssueResult {
    const res = this.createIssue(options);
    if (!res.created || !res.issueId) return res;

    this.addComment(res.issueId, `[auto-filed] ${options.autoFiledComment}`.trim());
    return res;
  }
}

export function findRepoRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, '.beads'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
