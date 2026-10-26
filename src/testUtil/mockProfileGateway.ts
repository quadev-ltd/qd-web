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
  readLinkAgain: vi.fn(() => Promise.resolve()),
  getFileUrl: vi.fn(() => Promise.resolve('https://files.example/document')),
  getResourceText: vi.fn(() => Promise.resolve(null)),
  getApplications: vi.fn(() => Promise.resolve([])),
  getApplication: vi.fn(() => Promise.resolve(null)),
  getProfileRevision: vi.fn(() => Promise.resolve(0)),
  createApplication: vi.fn(() =>
    Promise.resolve({ applicationId: 'application-1' }),
  ),
  updateApplication: vi.fn(() => Promise.resolve({ revision: 2 })),
  removeApplication: vi.fn(() => Promise.resolve()),
  prepareBrief: vi.fn(() => Promise.resolve()),
  readPostingAgain: vi.fn(() => Promise.resolve()),
  getBriefsToday: vi.fn(() => Promise.resolve(0)),
  getInterviews: vi.fn(() => Promise.resolve([])),
  getInterview: vi.fn(() => Promise.resolve(null)),
  createInterview: vi.fn(() => Promise.resolve({ interviewId: 'interview-1' })),
  updateInterview: vi.fn(() => Promise.resolve({ revision: 2 })),
  removeInterview: vi.fn(() => Promise.resolve()),
  writeInterviewQuestions: vi.fn(() => Promise.resolve({ questions: 8 })),
  getInterviewQuestionsToday: vi.fn(() => Promise.resolve(0)),
  getCvVersions: vi.fn(() => Promise.resolve([])),
  getCvVersion: vi.fn(() => Promise.resolve(null)),
  createCvVersion: vi.fn(() =>
    Promise.resolve({ versionId: 'version-1', status: 'creating' as const }),
  ),
  removeCvVersion: vi.fn(() => Promise.resolve()),
  getCvVersionsToday: vi.fn(() => Promise.resolve(0)),
  decideCvChange: vi.fn(() => Promise.resolve({ open: 0 })),
  answerCvQuestion: vi.fn(() => Promise.resolve({ open: 0 })),
  markCvVersionSent: vi.fn(() => Promise.resolve()),
  copyCvVersion: vi.fn(() => Promise.resolve({ versionId: 'version-2' })),
  reviseCvLine: vi.fn(() => Promise.resolve()),
  rewriteCvVersion: vi.fn(() => Promise.resolve({ versionId: 'version-3' })),
  addCvNoteToProfile: vi.fn(() =>
    Promise.resolve({ resourceId: 'resource-9' }),
  ),
  getUsageLimits: vi.fn(() => Promise.resolve(null)),
  getCvDetails: vi.fn(() => Promise.resolve(null)),
  updateCvDetails: vi.fn(() => Promise.resolve({ changed: [] })),
});

export default createMockProfileGateway;
