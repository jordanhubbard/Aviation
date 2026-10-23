// apps/aviation-accident-tracker/backend/tests/integration/database.test.ts

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { EventRepository } from '../../src/db/repository.js';
import { seedDatabase } from '../../seed/seed.js';


describe('Database Integration Tests', () => {
  let repository: EventRepository;

  beforeAll(async () => {
    repository = new EventRepository();
    await repository.initialize();
    await seedDatabase();
  });

  afterAll(async () => {
    await repository.close();
  });

  test('retrieves events from the database', async () => {
    const events = await repository.getEvents({ limit: 10 });
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  test('inserts and retrieves a new event', async () => {
    const newEvent = {
      external_id: 'test-event',
      source: 'TestSource',
      date_time: new Date().toISOString(),
      aircraft_type: 'TestAircraft',
      location: 'TestLocation',
      category: 'TestCategory'
    };

    await repository.insertEvent(newEvent);
    const event = await repository.getEventByExternalId('test-event');

    expect(event).toHaveProperty('external_id', 'test-event');
    expect(event).toHaveProperty('source', 'TestSource');
  });

  test('updates an existing event', async () => {
    const updateData = { location: 'UpdatedLocation' };
    await repository.updateEvent('test-event', updateData);
    const updatedEvent = await repository.getEventByExternalId('test-event');

    expect(updatedEvent).toHaveProperty('location', 'UpdatedLocation');
  });

  test('deletes an event', async () => {
    await repository.deleteEvent('test-event');
    const deletedEvent = await repository.getEventByExternalId('test-event');

    expect(deletedEvent).toBeNull();
  });
});
