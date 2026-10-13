import reducer, {
  dailyLimitRefused,
  extractionCounted,
  initialInterviewProfileState,
  type InterviewProfileState,
  itemsLoaded,
  profileLoaded,
  profileLoadFailed,
  profileLoadStarted,
  resourceChanged,
  resourceRemoved,
} from './interviewProfileSlice';
import { authStateChanged } from './sessionSlice';

import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';

const user = (uid: string) => ({
  uid,
  email: null,
  emailVerified: true,
  displayName: null,
  providerIds: ['password'],
});

const loaded = (
  overrides: Partial<InterviewProfileState> = {},
): InterviewProfileState => ({
  ...initialInterviewProfileState,
  uid: 'uid-1',
  status: 'loaded',
  ...overrides,
});

describe('interviewProfileSlice', () => {
  it('starts with nothing read', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({
      uid: null,
      status: 'idle',
      resources: [],
      items: [],
      extractionsToday: 0,
      dailyLimitRefused: false,
    });
  });

  it('marks the profile as loading for the user it is read for', () => {
    expect(
      reducer(initialInterviewProfileState, profileLoadStarted('uid-1')),
    ).toMatchObject({ uid: 'uid-1', status: 'loading' });
  });

  it('keeps what it has while the same user reads it again', () => {
    const before = loaded({ resources: [resourceFixture()] });

    expect(reducer(before, profileLoadStarted('uid-1'))).toEqual({
      ...before,
      status: 'loading',
    });
  });

  it('starts from nothing for another user', () => {
    const before = loaded({
      resources: [resourceFixture()],
      items: [itemFixture()],
      extractionsToday: 7,
      dailyLimitRefused: true,
    });

    expect(reducer(before, profileLoadStarted('uid-2'))).toEqual({
      ...initialInterviewProfileState,
      uid: 'uid-2',
      status: 'loading',
    });
  });

  it('holds what was read, with the resources newest first', () => {
    const state = reducer(
      reducer(initialInterviewProfileState, profileLoadStarted('uid-1')),
      profileLoaded({
        uid: 'uid-1',
        resources: [
          resourceFixture({ id: 'old', createdAt: 1 }),
          resourceFixture({ id: 'new', createdAt: 3 }),
          resourceFixture({ id: 'middle', createdAt: 2 }),
        ],
        items: [itemFixture()],
        extractionsToday: 4,
      }),
    );

    expect(state.status).toBe('loaded');
    expect(state.resources.map(({ id }) => id)).toEqual([
      'new',
      'middle',
      'old',
    ]);
    expect(state.items).toEqual([itemFixture()]);
    expect(state.extractionsToday).toBe(4);
  });

  it('drops an answer for a user who has gone', () => {
    const before = reducer(
      initialInterviewProfileState,
      profileLoadStarted('uid-2'),
    );

    expect(
      reducer(
        before,
        profileLoaded({
          uid: 'uid-1',
          resources: [resourceFixture()],
          items: [],
          extractionsToday: 0,
        }),
      ),
    ).toEqual(before);
    expect(reducer(before, profileLoadFailed('uid-1'))).toEqual(before);
  });

  it('remembers that the read failed', () => {
    const before = reducer(
      initialInterviewProfileState,
      profileLoadStarted('uid-1'),
    );

    expect(reducer(before, profileLoadFailed('uid-1')).status).toBe('error');
  });

  it('puts a new resource first, and one without a date yet before the others', () => {
    const before = loaded({
      resources: [resourceFixture({ id: 'old', createdAt: 5 })],
    });

    const withNew = reducer(
      before,
      resourceChanged(resourceFixture({ id: 'new', createdAt: 9 })),
    );
    const withUndated = reducer(
      withNew,
      resourceChanged(resourceFixture({ id: 'undated', createdAt: null })),
    );

    expect(withUndated.resources.map(({ id }) => id)).toEqual([
      'undated',
      'new',
      'old',
    ]);
  });

  it('replaces a resource that was read again, in its place', () => {
    const before = loaded({
      resources: [
        resourceFixture({ id: 'a', createdAt: 9, status: 'processing' }),
        resourceFixture({ id: 'b', createdAt: 5 }),
      ],
    });

    const state = reducer(
      before,
      resourceChanged(
        resourceFixture({ id: 'a', createdAt: 9, status: 'ready' }),
      ),
    );

    expect(state.resources.map(({ id, status }) => [id, status])).toEqual([
      ['a', 'ready'],
      ['b', 'ready'],
    ]);
  });

  it('removes a resource with the items that came from it', () => {
    const before = loaded({
      resources: [resourceFixture({ id: 'a' }), resourceFixture({ id: 'b' })],
      items: [
        itemFixture({ id: 'i1', resourceId: 'a' }),
        itemFixture({ id: 'i2', resourceId: 'b' }),
      ],
    });

    const state = reducer(before, resourceRemoved('a'));

    expect(state.resources.map(({ id }) => id)).toEqual(['b']);
    expect(state.items.map(({ id }) => id)).toEqual(['i2']);
  });

  it('takes the skill map as it was read again', () => {
    const items = [itemFixture({ id: 'i9' })];

    expect(reducer(loaded(), itemsLoaded(items)).items).toEqual(items);
  });

  it('counts one more resource read today', () => {
    expect(
      reducer(loaded({ extractionsToday: 19 }), extractionCounted())
        .extractionsToday,
    ).toBe(20);
  });

  it('remembers that the backend refused for today’s limit', () => {
    expect(reducer(loaded(), dailyLimitRefused()).dailyLimitRefused).toBe(true);
  });

  describe('when the session changes', () => {
    const before = loaded({
      resources: [resourceFixture()],
      items: [itemFixture()],
    });

    it('keeps the profile while the same user is signed in', () => {
      expect(reducer(before, authStateChanged(user('uid-1')))).toBe(before);
    });

    it('forgets it when the user signs out', () => {
      expect(reducer(before, authStateChanged(null))).toEqual(
        initialInterviewProfileState,
      );
    });

    it('forgets it when another user signs in', () => {
      expect(reducer(before, authStateChanged(user('uid-2')))).toEqual(
        initialInterviewProfileState,
      );
    });

    it('has nothing to forget before a profile was read', () => {
      expect(
        reducer(initialInterviewProfileState, authStateChanged(user('uid-1'))),
      ).toBe(initialInterviewProfileState);
    });
  });
});
