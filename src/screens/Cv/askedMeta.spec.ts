import { carriedAsked } from './askedMeta';

import {
  cvVersionFixture,
  writtenVersionFixture,
} from '@/testUtil/cvVersionFixtures';

const forJob = (id: string, createdAt: number, asked?: string) =>
  writtenVersionFixture({
    id,
    createdAt,
    target: { kind: 'job', applicationId: 'a1' },
    ...(asked ? { asked } : {}),
  });

describe('carriedAsked (D97)', () => {
  it('is what was asked of the latest version for the same job', () => {
    const latest = forJob('w2', 2, 'Put first: on-call.');
    expect(
      carriedAsked([forJob('w1', 1, 'Leave out: Kestrel.'), latest], {
        kind: 'job',
        applicationId: 'a1',
      }),
    ).toEqual({ from: latest, asked: 'Put first: on-call.' });
  });

  it('keeps an empty box empty: the latest asked nothing, so nothing is carried', () => {
    expect(
      carriedAsked([forJob('w1', 1, 'Leave out: Kestrel.'), forJob('w2', 2)], {
        kind: 'job',
        applicationId: 'a1',
      }),
    ).toBeUndefined();
  });

  it('carries nothing to another job, nor from an edit version', () => {
    expect(
      carriedAsked([forJob('w1', 1, 'Put first: on-call.')], {
        kind: 'job',
        applicationId: 'a2',
      }),
    ).toBeUndefined();
    expect(
      carriedAsked([cvVersionFixture({ createdAt: 3 })], {
        kind: 'job',
        applicationId: 'a1',
      }),
    ).toBeUndefined();
  });

  it('carries a general CV’s to the next general one', () => {
    const general = writtenVersionFixture({
      id: 'g1',
      createdAt: 1,
      target: { kind: 'general', role: 'Engineer' },
      asked: 'Put first: payments.',
    });
    expect(
      carriedAsked([general, forJob('w1', 2, 'Other.')], { kind: 'general' }),
    ).toEqual({ from: general, asked: 'Put first: payments.' });
  });
});
