import * as fs from 'fs';
import * as path from 'path';

const CONTEXT_FILES = ['CLAUDE.md', 'AI_CONTEXT.md'];

/**
 * Resolve app root directory from appId.
 * When running from monorepo root, apps live in apps/<appId>.
 * APPS_ROOT can override (e.g. in Docker: /app/apps).
 */
function getAppRoot(appId: string): string {
  if (!/^[a-z0-9-]+$/.test(appId)) {
    return '';
  }
  const appsRoot = process.env.APPS_ROOT ?? path.join(process.cwd(), 'apps');
  return path.join(appsRoot, appId);
}

/**
 * Load app context (CLAUDE.md or AI_CONTEXT.md) for the given appId.
 * Returns empty string if file not found or not readable.
 */
export function loadAppContext(appId: string): string {
  const appRoot = getAppRoot(appId);
  if (!appRoot) return '';
  for (const name of CONTEXT_FILES) {
    const filePath = path.join(appRoot, name);
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch {
      // ignore
    }
  }
  return '';
}
