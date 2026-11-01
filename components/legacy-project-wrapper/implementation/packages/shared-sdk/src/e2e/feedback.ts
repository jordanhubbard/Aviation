/** Exercise the shared issue widget without creating a real GitHub issue. */
interface FeedbackRoute {
  request(): { method(): string; postDataJSON(): Record<string, unknown> };
  fulfill(options: { status: number; headers?: Record<string, string>;
    contentType?: string; body?: string }): Promise<void>;
}

interface FeedbackLocator {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  waitFor(): Promise<void>;
  inputValue(): Promise<string>;
}

export interface E2EFeedbackPage {
  route(url: string, handler: (route: FeedbackRoute) => Promise<void>): Promise<void>;
  locator(selector: string): FeedbackLocator;
  url(): string;
  title(): Promise<string>;
}

export async function exerciseE2EFeedback(page: E2EFeedbackPage, appId: string, runId: string): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(appId) || !/^e2e_[0-9a-f]{32}$/.test(runId)) {
    throw new Error('Feedback E2E requires an app and tagged run');
  }
  const endpoint = 'https://meta-app.jordanhubbard.net/api/feedback';
  const issueUrl = 'https://github.com/jordanhubbard/Aviation/issues/1';
  const cors = { 'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  const submitted: Record<string, unknown>[] = [];
  await page.route(endpoint, async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (route.request().method() !== 'POST') throw new Error('Unexpected feedback request');
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, headers: cors, contentType: 'application/json',
      body: JSON.stringify({ number: 1, url: issueUrl }) });
  });
  const expectedPage = new URL(page.url()).pathname;
  const expectedTitle = await page.title();
  const message = `Synthetic E2E feedback ${runId}`;
  await page.locator('#aviation-feedback-button').click();
  await page.locator('#aviation-feedback-dialog textarea').fill(message);
  await page.locator('#aviation-feedback-dialog button[type="submit"]').click();
  await page.locator('#aviation-feedback-status a').waitFor();
  if (submitted.length !== 1 || submitted[0].app !== appId || submitted[0].page !== expectedPage
    || submitted[0].title !== expectedTitle || submitted[0].message !== message
    || await page.locator('#aviation-feedback-dialog textarea').inputValue()) {
    throw new Error(`Feedback widget lost ${appId} test context: ${JSON.stringify({
      submissions: submitted.length, appMatches: submitted[0]?.app === appId,
      pageMatches: submitted[0]?.page === expectedPage, titleMatches: submitted[0]?.title === expectedTitle,
      messageMatches: submitted[0]?.message === message,
      inputCleared: !(await page.locator('#aviation-feedback-dialog textarea').inputValue()),
    })}`);
  }
  await page.locator('#aviation-feedback-cancel').click();
}
