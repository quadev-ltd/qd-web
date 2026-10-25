import { applicationRemoved } from './applicationsSlice';
import {
  initialInterviewsState,
  interviewChanged,
  interviewRemoved,
  interviewsLoaded,
  interviewsLoadFailed,
  interviewsLoadStarted,
  interviewsSlice,
} from './interviewsSlice';
import { authStateChanged } from './sessionSlice';

import { type ApplicationInterview } from '@/core/profile/interviews';

const reduce = interviewsSlice.reducer;

const interview = (
  id: string,
  startsAt: number,
  more: Partial<ApplicationInterview> = {},
): ApplicationInterview => ({
  id,
  date: '2026-10-28',
  startTime: '14:00',
  timeZone: 'Europe/London',
  startsAt,
  description: '',
  revision: 1,
  createdAt: null,
  updatedAt: null,
  ...more,
});

const loaded = (interviews: ApplicationInterview[]) =>
  reduce(
    reduce(
      initialInterviewsState,
      interviewsLoadStarted({ uid: 'uid-1', applicationId: 'a1' }),
    ),
    interviewsLoaded({ uid: 'uid-1', applicationId: 'a1', interviews }),
  );

describe('interviewsSlice', () => {
  it('keeps each application’s interviews, the earliest first', () => {
    const state = loaded([interview('later', 2), interview('sooner', 1)]);

    expect(state.uid).toBe('uid-1');
    expect(state.byApplication.a1.status).toBe('loaded');
    expect(state.byApplication.a1.interviews.map(({ id }) => id)).toEqual([
      'sooner',
      'later',
    ]);
  });

  it('says loading, then failed, keeping what it had', () => {
    const before = loaded([interview('i1', 1)]);
    const started = reduce(
      before,
      interviewsLoadStarted({ uid: 'uid-1', applicationId: 'a1' }),
    );
    expect(started.byApplication.a1).toMatchObject({
      status: 'loading',
      interviews: [{ id: 'i1' }],
    });

    const failed = reduce(
      started,
      interviewsLoadFailed({ uid: 'uid-1', applicationId: 'a1' }),
    );
    expect(failed.byApplication.a1.status).toBe('error');
  });

  it('drops an answer for a user who has gone', () => {
    const state = reduce(
      reduce(
        initialInterviewsState,
        interviewsLoadStarted({ uid: 'uid-2', applicationId: 'a1' }),
      ),
      interviewsLoaded({
        uid: 'uid-1',
        applicationId: 'a1',
        interviews: [interview('i1', 1)],
      }),
    );
    expect(state.byApplication.a1.status).toBe('loading');
  });

  it('puts a changed interview in its place, and takes a removed one out', () => {
    const state = loaded([interview('i1', 1), interview('i2', 2)]);
    const changed = reduce(
      state,
      interviewChanged({
        applicationId: 'a1',
        interview: interview('i1', 3, { name: 'Final' }),
      }),
    );
    expect(changed.byApplication.a1.interviews).toMatchObject([
      { id: 'i2' },
      { id: 'i1', name: 'Final' },
    ]);

    const removed = reduce(
      changed,
      interviewRemoved({ applicationId: 'a1', interviewId: 'i2' }),
    );
    expect(removed.byApplication.a1.interviews.map(({ id }) => id)).toEqual([
      'i1',
    ]);
  });

  it('forgets an application’s interviews when the application is removed', () => {
    const state = reduce(
      loaded([interview('i1', 1)]),
      applicationRemoved('a1'),
    );
    expect(state.byApplication.a1).toBeUndefined();
  });

  it('keeps nothing once the user signs out', () => {
    const state = reduce(loaded([interview('i1', 1)]), authStateChanged(null));
    expect(state).toEqual(initialInterviewsState);
  });
});
