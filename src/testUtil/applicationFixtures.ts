// Fictional applications for specs (the companies of the designs).
import { type JobApplication } from '@/core/profile/applications';

export const applicationFixture = (
  overrides: Partial<JobApplication> = {},
): JobApplication => ({
  id: 'a1',
  title: 'Senior Backend Engineer',
  company: 'Northwind Logistics',
  jobDescription:
    'Northwind Logistics is looking for a Senior Backend Engineer to own parcel tracking.',
  revision: 1,
  createdAt: Date.parse('2026-10-10T09:30:00Z'),
  updatedAt: Date.parse('2026-10-10T09:30:00Z'),
  ...overrides,
});
