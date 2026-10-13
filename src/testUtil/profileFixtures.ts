// Fictional resources and items for specs (Maya Okafor, the candidate of the designs).
import {
  type ProfileResource,
  type SkillMapItem,
} from '@/core/profile/contract';

export const resourceFixture = (
  overrides: Partial<ProfileResource> = {},
): ProfileResource => ({
  id: 'r1',
  type: 'cv',
  title: 'Maya Okafor CV 2026',
  source: 'file',
  contentType: 'application/pdf',
  storagePath: 'users/uid-1/interview-docs/r1/document.pdf',
  status: 'ready',
  itemCount: 31,
  createdAt: 1_000,
  updatedAt: 2_000,
  ...overrides,
});

export const itemFixture = (
  overrides: Partial<SkillMapItem> = {},
): SkillMapItem => ({
  id: 'i1',
  kind: 'achievement',
  text: 'Cut payment incidents by 40% in two quarters.',
  evidence: 'Reduced Sev-1 and Sev-2 payment incidents 40%.',
  resourceId: 'r1',
  starred: false,
  hidden: false,
  edited: false,
  createdAt: 1_000,
  updatedAt: 1_000,
  ...overrides,
});
