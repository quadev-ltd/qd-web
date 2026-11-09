import reducer, {
  initialPracticeState,
  practiceAnswerBegan,
  practiceAnswerEnded,
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
    expect(state).toEqual({
      uid: 'u1',
      starting: {},
      answering: {},
      drafts: {},
      changes: 0,
    });
  });

  it('holds an answer while its feedback is written, and keeps it if that fails', () => {
    let state = reducer(
      initialPracticeState,
      practiceAnswerBegan({ uid: 'u1', turnId: 't1', answer: 'I led it.' }),
    );
    expect(state.answering).toEqual({ t1: 'I led it.' });

    state = reducer(
      state,
      practiceAnswerEnded({ turnId: 't1', kept: 'I led it.' }),
    );
    expect(state.answering).toEqual({});
    expect(state.drafts).toEqual({ t1: 'I led it.' });

    // Its feedback stored at last: nothing is kept
    state = reducer(state, practiceAnswerEnded({ turnId: 't1' }));
    expect(state.drafts).toEqual({});
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
    const answered = reducer(
      reducer(
        state,
        practiceAnswerBegan({ uid: 'u1', turnId: 't1', answer: 'Mine.' }),
      ),
      practiceAnswerEnded({ turnId: 't1', kept: 'Mine.' }),
    );
    expect(
      reducer(
        answered,
        practiceAnswerBegan({ uid: 'u2', turnId: 't2', answer: 'Theirs.' }),
      ).drafts,
    ).toEqual({});
    expect(reducer(state, authStateChanged(null))).toEqual(
      initialPracticeState,
    );
  });
});
