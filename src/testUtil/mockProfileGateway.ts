import { type Mocked } from 'vitest';

import { type ProfileGateway } from '@/core/profile/gateway';

/**
 * A profile gateway made of mock functions, for specs: an empty profile, and every change
 * resolves. A spec sets what it needs (`gateway.getResources.mockResolvedValue([...])`).
 */
export const createMockProfileGateway = (): Mocked<ProfileGateway> => ({
  getResources: vi.fn(() => Promise.resolve([])),
  getResource: vi.fn(() => Promise.resolve(null)),
  getItems: vi.fn(() => Promise.resolve([])),
  getExtractionsToday: vi.fn(() => Promise.resolve(0)),
  createResource: vi.fn(() => Promise.resolve({ resourceId: 'resource-1' })),
  uploadFile: vi.fn(() => Promise.resolve()),
  updateItem: vi.fn(() => Promise.resolve()),
  removeItem: vi.fn(() => Promise.resolve()),
  removeResource: vi.fn(() => Promise.resolve({ itemsRemoved: 0 })),
  getFileUrl: vi.fn(() => Promise.resolve('https://files.example/document')),
});

export default createMockProfileGateway;
