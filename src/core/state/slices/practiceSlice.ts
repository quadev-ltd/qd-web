// Text practice (D94) as the pages share it: the questions whose practice is being started, the
// answers being read for feedback, an answer whose feedback failed, and a count of the changes made
// to the turns, so a page that marks practised questions reads them again. The turns themselves
// are read by the page that shows them. Web only.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { authStateChanged } from './sessionSlice';

export interface PracticeState {
  /** Whose practice this is. Another user starts from nothing. */
  uid: string | null;
  /**
   * The practices being started (`practiceStartKey`): writing the key points takes 5 to 15
   * seconds, and the page says so again when the candidate comes back to it meanwhile.
   */
  starting: Record<string, true>;
  /**
   * The answers being read for feedback, by turn (5 to 15 seconds): the page shows the answer
   * and "Getting feedback…" again when the candidate comes back to it meanwhile.
   */
  answering: Record<string, string>;
  /** An answer whose feedback failed, by turn, so what was typed is never lost. */
  drafts: Record<string, string>;
  /** Goes up with every turn started, answered or removed. */
  changes: number;
}

export const initialPracticeState: PracticeState = {
  uid: null,
  starting: {},
  answering: {},
  drafts: {},
  changes: 0,
};

/** New objects for another user, not the initial state's, which are frozen. */
const forUser = (state: PracticeState, uid: string) => {
  if (state.uid !== uid) {
    state.uid = uid;
    state.starting = {};
    state.answering = {};
    state.drafts = {};
  }
};

export const practiceSlice = createSlice({
  name: 'practice',
  initialState: initialPracticeState,
  reducers: {
    practiceStartBegan: (
      state,
      { payload: { uid, key } }: PayloadAction<{ uid: string; key: string }>,
    ) => {
      forUser(state, uid);
      state.starting[key] = true;
    },
    practiceStartEnded: (state, { payload: key }: PayloadAction<string>) => {
      delete state.starting[key];
    },
    practiceAnswerBegan: (
      state,
      {
        payload: { uid, turnId, answer },
      }: PayloadAction<{ uid: string; turnId: string; answer: string }>,
    ) => {
      forUser(state, uid);
      state.answering[turnId] = answer;
    },
    /** Its feedback is stored (`kept` absent), or failed and the answer is kept. */
    practiceAnswerEnded: (
      state,
      {
        payload: { turnId, kept },
      }: PayloadAction<{ turnId: string; kept?: string }>,
    ) => {
      delete state.answering[turnId];
      if (kept === undefined) {
        delete state.drafts[turnId];
      } else {
        state.drafts[turnId] = kept;
      }
    },
    /** A turn was started, answered or removed: the marks are read again. */
    practiceChanged: state => {
      state.changes += 1;
    },
  },
  extraReducers: builder => {
    // The user signed out, or another one signed in: nothing of theirs is kept.
    builder.addCase(authStateChanged, (state, { payload: user }) =>
      state.uid !== null && user?.uid !== state.uid
        ? initialPracticeState
        : state,
    );
  },
});

export const {
  practiceStartBegan,
  practiceStartEnded,
  practiceAnswerBegan,
  practiceAnswerEnded,
  practiceChanged,
} = practiceSlice.actions;

export default practiceSlice.reducer;
