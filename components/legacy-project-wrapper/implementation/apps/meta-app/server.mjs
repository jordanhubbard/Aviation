import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';

const root = resolve('/app/dist');
const port = Number(process.env.PORT || 8080);
const apps = new Set([
  'aviation-accident-tracker', 'aviation-chat', 'aviation-missions-app', 'flight-planner',
  'flight-track-analyzer', 'flight-tracker', 'flightschool', 'foreflight-dashboard',
  'g1000-simulator', 'meta-app', 'weather-briefing', 'preflight-check',
]);
const hostnames = new Map([...apps].map(app => [app === 'flight-track-analyzer' ? 'kmlab' : app, app]));
const requests = new Map();

function json(res, status, data, origin) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) });
  res.end(JSON.stringify(data));
}

export function allowedOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.port === '' && hostnames.has(url.hostname.replace(/\.jordanhubbard\.net$/, ''))
      && url.hostname.endsWith('.jordanhubbard.net');
  } catch { return false; }
}

export function validateFeedback(data, origin) {
  const app = hostnames.get(new URL(origin).hostname.replace(/\.jordanhubbard\.net$/, ''));
  if (data?.app !== app || typeof data?.message !== 'string' || !data.message.trim() || data.message.length > 4000) return null;
  if (typeof data?.page !== 'string' || data.page.length > 500 || !data.page.startsWith('/')) return null;
  if (typeof data?.title !== 'string' || data.title.length > 120) return null;
  return { app, message: data.message.trim(), page: data.page, title: data.title.trim() };
}

export async function createIssue(feedback, userAgent) {
  const token = process.env.GITHUB_ISSUES_TOKEN;
  if (!token) throw new Error('GitHub issue submission is not configured');
  const summary = feedback.message.split('\n')[0].slice(0, 100);
  const body = [feedback.message, '', '### Application context', `- App: ${feedback.app}`,
    `- Page: https://${feedback.app === 'flight-track-analyzer' ? 'kmlab' : feedback.app}.jordanhubbard.net${feedback.page}`,
    `- Page title: ${feedback.title || '(none)'}`, `- Browser: ${String(userAgent || '').slice(0, 250)}`,
    `- Submitted: ${new Date().toISOString()}`].join('\n');
  const response = await fetch('https://api.github.com/repos/jordanhubbard/Aviation/issues', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json',
      'User-Agent': 'aviation-feedback-service' },
    body: JSON.stringify({ title: `[feedback][${feedback.app}] ${summary}`, body }),
  });
  if (!response.ok) throw new Error(`GitHub issue request failed (${response.status})`);
  const issue = await response.json();
  return { number: issue.number, url: issue.html_url };
}

async function serveStatic(pathname, res) {
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(404); res.end(); return; }
  let target = file;
  try {
    if (!(await stat(target)).isFile()) target = join(root, 'index.html');
  } catch { target = join(root, 'index.html'); }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(target)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
  res.end(await readFile(target));
}

export function handler(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname !== '/api/feedback') {
    void serveStatic(pathname, res).catch(() => { res.writeHead(500); res.end(); });
    return;
  }
  const origin = req.headers.origin;
  if (!allowedOrigin(origin)) { json(res, 403, { error: 'Origin not allowed' }); return; }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }); res.end(); return;
  }
  if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }, origin); return; }
  // Caddy appends the actual client address after any untrusted client-supplied values.
  const ip = req.headers['x-forwarded-for']?.split(',').at(-1)?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter(time => now - time < 3600_000);
  if (recent.length >= 5) { json(res, 429, { error: 'Too many submissions' }, origin); return; }
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 8192) req.destroy(); });
  req.on('end', async () => {
    try {
      const feedback = validateFeedback(JSON.parse(body), origin);
      if (!feedback) { json(res, 400, { error: 'Invalid feedback' }, origin); return; }
      requests.set(ip, [...recent, now]);
      const issue = await createIssue(feedback, req.headers['user-agent']);
      json(res, 201, issue, origin);
    } catch (error) {
      console.error('Feedback submission failed:', error);
      json(res, error.message.includes('not configured') ? 503 : 502, { error: 'Unable to submit feedback' }, origin);
    }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) createServer(handler).listen(port);
