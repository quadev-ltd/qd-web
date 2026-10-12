import {
  accountDeleted,
  accountDeletedNoticeCleared,
  exitSlice,
  initialExitState,
  signedOutPathChosen,
} from './exitSlice';
import { authStateChanged } from './sessionSlice';

import { type SessionUser } from '@/core/auth/types';

const reducer = exitSlice.reducer;

const user: SessionUser = {
  uid: 'uid-1',
  email: 'ada@example.com',
  emailVerified: true,
  displayName: null,
  providerIds: ['password'],
};

describe('exit slice', () => {
  it('starts with the default destination and no notice', () => {
    expect(initialExitState).toEqual({
      signedOutPath: null,
      accountDeleted: false,
    });
  });

  it('remembers where to go when the session ends, and forgets it again', () => {
    const chosen = reducer(initialExitState, signedOutPathChosen('/sign-in'));
    expect(chosen.signedOutPath).toBe('/sign-in');

    expect(reducer(chosen, signedOutPathChosen(null)).signedOutPath).toBeNull();
  });

  it('notes that the account was deleted until the notice is cleared', () => {
    const deleted = reducer(initialExitState, accountDeleted());
    expect(deleted.accountDeleted).toBe(true);

    expect(reducer(deleted, accountDeletedNoticeCleared()).accountDeleted).toBe(
      false,
    );
  });

  it('keeps both when the session ends: that is when they are used', () => {
    const state = reducer(
      reducer(initialExitState, signedOutPathChosen('/sign-in')),
      accountDeleted(),
    );

    expect(reducer(state, authStateChanged(null))).toEqual({
      signedOutPath: '/sign-in',
      accountDeleted: true,
    });
  });

  it('starts from a clean slate when a user signs in', () => {
    const state = reducer(
      reducer(initialExitState, signedOutPathChosen('/sign-in')),
      accountDeleted(),
    );

    expect(reducer(state, authStateChanged(user))).toEqual(initialExitState);
  });
});
