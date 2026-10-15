import { briefStateOf, JobApplicationSchema } from './applications';

import { applicationFixture } from '@/testUtil/applicationFixtures';

const brief = (overrides: Record<string, unknown> = {}) => ({
  requirements: [
    { text: 'Go', importance: 'required' as const, itemIds: ['i1'] },
    { text: 'Kafka', importance: 'required' as const, itemIds: [] },
    { text: 'Mentoring', importance: 'preferred' as const, itemIds: [] },
  ],
  questions: [],
  applicationRevision: 1,
  profileRevision: 5,
  builtAt: 1,
  ...overrides,
});

describe('briefStateOf', () => {
  it('says there is no brief yet', () => {
    expect(briefStateOf(applicationFixture(), 5)).toEqual({ kind: 'none' });
  });

  it('counts the gaps of a brief that is up to date', () => {
    expect(briefStateOf(applicationFixture({ brief: brief() }), 5)).toEqual({
      kind: 'ready',
      gaps: 2,
    });
  });

  it('says the job changed since the brief, before anything about the profile', () => {
    expect(
      briefStateOf(applicationFixture({ revision: 2, brief: brief() }), 9),
    ).toEqual({ kind: 'outOfDate', because: 'job' });
  });

  it('says the profile changed since the brief', () => {
    expect(briefStateOf(applicationFixture({ brief: brief() }), 6)).toEqual({
      kind: 'outOfDate',
      because: 'profile',
    });
  });

  it('says nothing about the profile when its revision could not be read', () => {
    expect(briefStateOf(applicationFixture({ brief: brief() }), null)).toEqual({
      kind: 'ready',
      gaps: 2,
    });
  });
});

describe('JobApplicationSchema', () => {
  it('reads an application of today’s backend: no `job`, a pasted job', () => {
    const parsed = JobApplicationSchema.parse({
      id: 'a1',
      title: 'Platform Engineer',
      jobDescription: 'Kubernetes and Terraform.',
      revision: 3,
      createdAt: 1,
      updatedAt: 2,
    });

    expect(parsed).toMatchObject({ id: 'a1', revision: 3 });
    expect(parsed.job).toBeUndefined();
  });

  it('reads the `job` of research doc 17 when it arrives, and anything unknown as safe defaults', () => {
    const parsed = JobApplicationSchema.parse({
      id: 'a2',
      job: { source: 'link', status: 'reading', edited: false },
      brief: { requirements: [{ text: 'Go', importance: 'odd' }] },
      revision: 'x',
      createdAt: null,
      updatedAt: null,
    });

    expect(parsed.title).toBe('');
    expect(parsed.revision).toBe(0);
    expect(parsed.job).toMatchObject({ source: 'link', status: 'reading' });
    expect(parsed.brief?.requirements[0]).toEqual({
      text: 'Go',
      importance: 'required',
      itemIds: [],
    });
  });
});
