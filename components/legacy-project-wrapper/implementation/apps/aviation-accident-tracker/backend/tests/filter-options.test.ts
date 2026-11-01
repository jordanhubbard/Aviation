import { expect, it } from 'vitest';
import { EventRepository } from '../src/db/repository.js';

it('derives sorted, distinct country and region options from persisted events', async () => {
  const repository = new EventRepository(':memory:');
  try {
    await repository.initialize();
    for (const [registration, country, region] of [
      ['N1', 'United States', 'California'],
      ['C2', 'Canada', 'Ontario'],
      ['N3', 'United States', 'California'],
      ['N4', '', ''],
    ]) {
      await repository.upsertEvent({
        registration, country, region, dateZ: '2026-01-01T00:00:00Z', category: 'general',
      });
    }
    expect(await repository.getDistinctValues('country')).toEqual(['Canada', 'United States']);
    expect(await repository.getDistinctValues('region')).toEqual(['California', 'Ontario']);
    await repository.upsertEvent({ registration: 'D5', country: 'Germany', region: 'Bavaria',
      dateZ: '2026-01-02T00:00:00Z', category: 'general' });
    expect(await repository.getDistinctValues('country')).toEqual(['Canada', 'Germany', 'United States']);
    expect(await repository.getDistinctValues('country; DROP TABLE events')).toEqual([]);
    expect((await repository.listEvents({})).total).toBe(5);
  } finally {
    await repository.close();
  }
});
