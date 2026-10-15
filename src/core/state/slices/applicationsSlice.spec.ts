import reducer, {
  applicationChanged,
  applicationRemoved,
  applicationsLoaded,
  applicationsLoadFailed,
  applicationsLoadStarted,
  type ApplicationsState,
  initialApplicationsState,
} from './applicationsSlice';
import { authStateChanged } from './sessionSlice';

import { applicationFixture } from '@/testUtil/applicationFixtures';

const loaded = (
  overrides: Partial<ApplicationsState> = {},
): ApplicationsState => ({
  ...initialApplicationsState,
  uid: 'uid-1',
  status: 'loaded',
  ...overrides,
});

describe('applicationsSlice', () => {
  it('starts with nothing read', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({
      uid: null,
      status: 'idle',
      applications: [],
      profileRevision: null,
    });
  });

  it('holds what was read, the most recently changed first, with the profile’s revision', () => {
    const state = reducer(
      reducer(initialApplicationsState, applicationsLoadStarted('uid-1')),
      applicationsLoaded({
        uid: 'uid-1',
        applications: [
          applicationFixture({ id: 'old', updatedAt: 1 }),
          applicationFixture({ id: 'new', updatedAt: 3 }),
        ],
        profileRevision: 7,
      }),
    );

    expect(state.status).toBe('loaded');
    expect(state.applications.map(({ id }) => id)).toEqual(['new', 'old']);
    expect(state.profileRevision).toBe(7);
  });

  it('drops an answer for a user who has gone, and starts from nothing for another', () => {
    const before = reducer(
      loaded({ applications: [applicationFixture()] }),
      applicationsLoadStarted('uid-2'),
    );
    expect(before.applications).toEqual([]);

    expect(
      reducer(
        before,
        applicationsLoaded({
          uid: 'uid-1',
          applications: [applicationFixture()],
          profileRevision: 1,
        }),
      ),
    ).toEqual(before);
    expect(reducer(before, applicationsLoadFailed('uid-1'))).toEqual(before);
    expect(reducer(before, applicationsLoadFailed('uid-2')).status).toBe(
      'error',
    );
  });

  it('puts a changed application first, in place of its old copy', () => {
    const state = reducer(
      loaded({
        applications: [
          applicationFixture({ id: 'b', updatedAt: 5 }),
          applicationFixture({ id: 'a', updatedAt: 4, title: 'Old' }),
        ],
      }),
      applicationChanged(
        applicationFixture({ id: 'a', updatedAt: 9, title: 'New' }),
      ),
    );

    expect(state.applications.map(({ id, title }) => [id, title])).toEqual([
      ['a', 'New'],
      ['b', 'Senior Backend Engineer'],
    ]);
  });

  it('removes an application', () => {
    const state = reducer(
      loaded({
        applications: [
          applicationFixture({ id: 'a' }),
          applicationFixture({ id: 'b' }),
        ],
      }),
      applicationRemoved('a'),
    );

    expect(state.applications.map(({ id }) => id)).toEqual(['b']);
  });

  it('forgets everything when the user signs out', () => {
    expect(
      reducer(
        loaded({ applications: [applicationFixture()] }),
        authStateChanged(null),
      ),
    ).toEqual(initialApplicationsState);
  });
});
