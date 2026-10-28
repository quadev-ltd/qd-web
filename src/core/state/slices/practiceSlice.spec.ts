import reducer, {
  initialPracticeState,
  practiceChanged,
  practiceStartBegan,
  practiceStartEnded,
} from './practiceSlice';
import { authStateChanged } from './sessionSlice';

describe('practiceSlice', () => {
  it('marks a practice as being started until it ends, for its user', () => {
    let state = reducer(
      initialPracticeState,
      practiceStartBegan({ uid: 'u1', key: 'interview/i1/q1' }),
    );
    expect(state.starting).toEqual({ 'interview/i1/q1': true });

    state = reducer(state, practiceStartEnded('interview/i1/q1'));
    expect(state).toEqual({ uid: 'u1', starting: {}, changes: 0 });
  });

  it('counts each change, so the marks are read again', () => {
    const state = reducer(
      reducer(initialPracticeState, practiceChanged()),
      practiceChanged(),
    );
    expect(state.changes).toBe(2);
  });

  it('keeps nothing of another user', () => {
    const state = reducer(
      initialPracticeState,
      practiceStartBegan({ uid: 'u1', key: 'k' }),
    );

    expect(
      reducer(state, practiceStartBegan({ uid: 'u2', key: 'other' })).starting,
    ).toEqual({ other: true });
    expect(reducer(state, authStateChanged(null))).toEqual(
      initialPracticeState,
    );
  });
});
