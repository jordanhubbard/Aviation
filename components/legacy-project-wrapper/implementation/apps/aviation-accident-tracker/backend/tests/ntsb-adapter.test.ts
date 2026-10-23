import { describe, expect, it } from 'vitest';
import { listRecentUpdates } from '../src/ingest/adapters/ntsbAdapter.js';

function row(name: string, date: string, size = 500000): string {
  return `<tr><td id="fileName">${name}</td><td id="fileDate">${date}</td><td id="fileSize">${size}</td></tr>`;
}

describe('NTSB update selection', () => {
  it('selects recent public weekly archives by modification date', () => {
    const html = row('up22OCT.zip', '10/22/2026 3:01:13 AM')
      + row('up15OCT.zip', '10/15/2026 3:01:13 AM')
      + row('up22NOV.zip', '11/22/2025 3:01:13 AM')
      + row('avall.zip', '10/23/2026 3:01:13 AM')
      + row('up01OCT.zip', '10/01/2026 3:01:13 AM', 20000000);
    expect(listRecentUpdates(html, new Date('2026-10-23T12:00:00Z')).map((file) => file.name))
      .toEqual(['up22OCT.zip', 'up15OCT.zip']);
  });
});
