/** Confirm settings writes before a UI reports a field configured. */
export async function saveServiceSecret(apiBase: string, service: string, key: string,
  value: string, options: { fetcher?: typeof fetch; headers?: Record<string, string> } = {}): Promise<void> {
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(`${apiBase}/api/settings/secrets`, {
      method: 'POST', headers: { ...options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, key, value }), signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('Unable to save settings');
  }
  if (response.status === 401 || response.status === 403) throw new Error('Settings access was not authorized');
  if (response.status === 503) throw new Error('Settings changes are unavailable');
  if (!response.ok) throw new Error(`Save failed (HTTP ${response.status})`);
  let result: unknown;
  try { result = await response.json(); }
  catch { throw new Error('Secret save was not confirmed'); }
  const body = result as { success?: unknown; service?: unknown; key?: unknown } | null;
  if (!body || Array.isArray(body) || body.success !== true
    || (body.service !== undefined && body.service !== null && body.service !== service)
    || (body.key !== undefined && body.key !== null && body.key !== key)) {
    throw new Error('Secret save was not confirmed');
  }
}
