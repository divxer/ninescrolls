import { describe, expect, it, vi } from 'vitest';
import { generateClient } from 'aws-amplify/data';

vi.mock('aws-amplify/data', () => ({
  generateClient: vi.fn(() => ({
    models: {},
    mutations: {},
    queries: {},
  })),
}));

describe('Amplify data client initialization', () => {
  it('does not create data clients while importing modules', async () => {
    await Promise.all([
      import('./articleQuestionsService'),
      import('./insightsAdminService'),
      import('./insightsImageService'),
      import('./insightsService'),
      import('./orderAdminService'),
      import('./organizationAdminService'),
      import('./tenderAdminService'),
      import('../hooks/useDashboardAnalytics'),
      import('../pages/admin/AdminAnalyticsPage'),
    ]);

    expect(generateClient).not.toHaveBeenCalled();
  });
});
