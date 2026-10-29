import { applicationRemoved } from './applicationsSlice';
import reducer, {
  initialCoverLettersState,
  letterChanged,
  letterRemoved,
  lettersLoaded,
  lettersLoadStarted,
} from './coverLettersSlice';
import { authStateChanged } from './sessionSlice';

import { type CoverLetter } from '@/core/profile/coverLetters';
import { coverLetterFixture } from '@/testUtil/coverLetterFixtures';

const letter = (id: string, createdAt: number): CoverLetter =>
  coverLetterFixture({ id, createdAt });

describe('coverLettersSlice', () => {
  it('keeps each application’s letters, the newest first, and changes one', () => {
    let state = reducer(
      initialCoverLettersState,
      lettersLoadStarted({ uid: 'u1', applicationId: 'a1' }),
    );
    expect(state.byApplication.a1.status).toBe('loading');

    state = reducer(
      state,
      lettersLoaded({
        uid: 'u1',
        applicationId: 'a1',
        letters: [letter('l1', 1), letter('l2', 2)],
      }),
    );
    expect(state.byApplication.a1.letters.map(({ id }) => id)).toEqual([
      'l2',
      'l1',
    ]);

    state = reducer(state, letterChanged(letter('l3', 3)));
    state = reducer(
      state,
      letterRemoved({ applicationId: 'a1', letterId: 'l1' }),
    );
    expect(state.byApplication.a1.letters.map(({ id }) => id)).toEqual([
      'l3',
      'l2',
    ]);
  });

  it('drops an answer for another user, and keeps nothing of a user who leaves or an application removed', () => {
    let state = reducer(
      initialCoverLettersState,
      lettersLoadStarted({ uid: 'u1', applicationId: 'a1' }),
    );
    expect(
      reducer(
        state,
        lettersLoaded({ uid: 'u2', applicationId: 'a1', letters: [] }),
      ).byApplication.a1.status,
    ).toBe('loading');
    // Another user starting a read starts from nothing.
    state = reducer(
      state,
      lettersLoadStarted({ uid: 'u2', applicationId: 'a2' }),
    );
    expect(Object.keys(state.byApplication)).toEqual(['a2']);

    expect(reducer(state, applicationRemoved('a2')).byApplication).toEqual({});
    expect(reducer(state, authStateChanged(null))).toEqual(
      initialCoverLettersState,
    );
  });
});
