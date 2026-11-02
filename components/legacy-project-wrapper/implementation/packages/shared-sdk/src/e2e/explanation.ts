/** Shared real-browser explanation flow. The private broker owns the provider fixture. */
import { assertTestDataForRun, type E2ERun } from './index.js';
import { seedRemoteFixture, type FixtureApi } from './client.js';

interface ExplanationLocator {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  waitFor(): Promise<void>;
  innerText(): Promise<string>;
  isVisible(): Promise<boolean>;
  locator(selector: string): ExplanationLocator;
  getByRole(role: string, options: { name: string; exact?: boolean }): ExplanationLocator;
  getByLabel(text: string): ExplanationLocator;
  getByText(text: string, options?: { exact?: boolean }): ExplanationLocator;
}
export interface E2EExplanationPage {
  getByRole(role: string, options: { name: string; exact?: boolean }): ExplanationLocator;
}

/** Register before browser interactions so both success and failure clear the actor ledger. */
export async function seedE2EExplanation(run: E2ERun, api: FixtureApi): Promise<void> {
  const state = await seedRemoteFixture(run, api, 'explanation',
    run.tag({ app_id: api.appId }), '/api/explain');
  assertTestDataForRun(state, run.id);
}

export async function exerciseE2EExplanation(page: E2EExplanationPage, run: E2ERun,
  api: FixtureApi, expectedFact: string, inspect?: () => Promise<void>): Promise<void> {
  if (!expectedFact.trim()) throw new Error('Explanation E2E requires an application decision fact');
  const ownedState = async () => {
    const response = await api.fetch(new URL('/api/explain/__e2e/status', api.baseUrl),
      { headers: run.headersFor(api.appId) });
    if (!response.ok) throw new Error('Explanation ownership check failed');
    const state = await response.json() as { records: number; run_records: number;
      fixture_requests: number; app_id: string; entries: unknown[] };
    assertTestDataForRun(state, run.id);
    if (state.app_id !== api.appId || state.run_records !== 1
      || !Number.isSafeInteger(state.fixture_requests) || state.fixture_requests < 0) {
      throw new Error('Explanation fixture ownership differs');
    }
    for (const entry of state.entries) assertTestDataForRun(entry, run.id);
    return state;
  };
  const before = await ownedState();
  if (before.records !== 0) throw new Error('Previous explanation requests remain before the next decision');
  const expectedRequests = before.fixture_requests + 2;
  await page.getByRole('button', { name: 'Explain this decision', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Decision explanation', exact: true });
  await dialog.waitFor();
  // Context is a decision captured from the app, never substituted by a test response route.
  const facts = dialog.locator('details pre');
  if (!await facts.isVisible()) await dialog.getByText('Decision facts', { exact: true }).click();
  if (!(await facts.innerText()).includes(expectedFact)) {
    throw new Error('Explanation lost the selected application decision');
  }
  await dialog.getByText('SDK fixture explanation.', { exact: false }).waitFor();
  const followUp = 'Which supplied facts support that decision? ' + run.id;
  await dialog.getByLabel('Ask a question or follow-up').fill(followUp);
  await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
  await dialog.getByText('Follow-up history: 2 messages.', { exact: false }).waitFor();
  if (inspect) await inspect();
  await dialog.getByRole('button', { name: 'Close explanation', exact: true }).click();
  if (await dialog.isVisible()) throw new Error('Explanation dialog did not close');
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = await ownedState();
    if (state.fixture_requests !== expectedRequests) {
      throw new Error('Explanation follow-up count differs');
    }
    if (state.records === 0) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Explanation requests remain after closing the dialog');
}
