import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedOrigin, validateFeedback, createIssue } from './server.mjs';

const appSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'src/App.tsx'),
  'utf8',
);

test('pane default selection delegates to the common Aviation UI capability', () => {
  assert.match(appSource, /getDefaultActiveId\(aviationPanes\)/);
  assert.doesNotMatch(appSource, /useState<string>\(resolvedApps\[0\]/);
});

test('feedback is tied to the actual Aviation app origin', () => {
  assert.equal(allowedOrigin('https://kmlab.jordanhubbard.net'), true);
  assert.equal(allowedOrigin('https://evil.jordanhubbard.net'), false);
  assert.equal(allowedOrigin('https://meta-app.jordanhubbard.net.evil.test'), false);
  assert.equal(validateFeedback({ app: 'flight-track-analyzer', page: '/flight/42', title: 'Flight', message: 'Map is blank' },
    'https://kmlab.jordanhubbard.net')?.app, 'flight-track-analyzer');
  assert.equal(validateFeedback({ app: 'meta-app', page: '/', title: '', message: 'Wrong app' },
    'https://kmlab.jordanhubbard.net'), null);
  assert.equal(validateFeedback({ app: 'meta-app', page: '/', title: '', message: ' ' },
    'https://meta-app.jordanhubbard.net'), null);
});

test('issue includes page context while keeping the credential server side', async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.GITHUB_ISSUES_TOKEN;
  process.env.GITHUB_ISSUES_TOKEN = 'test-token';
  let payload;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return { ok: true, json: async () => ({ number: 123, html_url: 'https://github.com/jordanhubbard/Aviation/issues/123' }) };
  };
  try {
    const issue = await createIssue({ app: 'flight-planner', page: '/plans', title: 'VFR Planner', message: 'Map is blank' }, 'Test browser');
    assert.equal(issue.number, 123);
    assert.match(payload.body, /flight-planner\.jordanhubbard\.net\/plans/);
    assert.match(payload.body, /Test browser/);
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_ISSUES_TOKEN;
    else process.env.GITHUB_ISSUES_TOKEN = originalToken;
  }
});
