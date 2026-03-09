import { ApiKey } from '../middleware/auth';

// Mock database query function
export async function getApiKeyFromDatabase(apiKey: string): Promise<ApiKey | null> {
  // Simulate a database lookup
  const mockDatabase: ApiKey[] = [
    {
      id: 1,
      key: 'avt_1234567890abcdef1234567890abcdef',
      name: 'Test Key',
      created_at: '2026-01-01T00:00:00Z',
      last_used_at: null,
      is_active: true,
      rate_limit: 1000,
      requests_count: 0,
    },
  ];

  return mockDatabase.find((record) => record.key === apiKey) || null;
}
