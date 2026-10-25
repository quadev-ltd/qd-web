// Fictional applications for specs (the companies of the designs).
import { type JobApplication } from '@/core/profile/applications';
import { type ApplicationInterview } from '@/core/profile/interviews';

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

/** An interview of the designs (D89): the technical interview on Wednesday 28 Oct at 14:00. */
export const interviewFixture = (
  overrides: Partial<ApplicationInterview> = {},
): ApplicationInterview => ({
  id: 'i1',
  name: 'Technical interview',
  date: '2026-10-28',
  startTime: '14:00',
  timeZone: 'Europe/London',
  startsAt: Date.parse('2026-10-28T14:00:00Z'),
  lengthMinutes: 60,
  type: 'technical',
  description:
    'Two engineers from the tracking team, on a video call. Then a design problem about parcel tracking events.',
  revision: 1,
  createdAt: Date.parse('2026-10-20T09:00:00Z'),
  updatedAt: Date.parse('2026-10-20T09:00:00Z'),
  ...overrides,
});
