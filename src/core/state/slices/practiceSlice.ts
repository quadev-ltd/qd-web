// Text practice (D94) as the pages share it: the questions whose practice is being started, and
// a count of the changes made to the turns, so a page that marks practised questions reads them
// again. The turns themselves are read by the page that shows them. Web only.
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
  /** Goes up with every turn started or removed. */
  changes: number;
}

export const initialPracticeState: PracticeState = {
  uid: null,
  starting: {},
  changes: 0,
};

export const practiceSlice = createSlice({
  name: 'practice',
  initialState: initialPracticeState,
  reducers: {
    practiceStartBegan: (
      state,
      { payload: { uid, key } }: PayloadAction<{ uid: string; key: string }>,
    ) => {
      // New objects, not the initial state's, which is frozen.
      if (state.uid !== uid) {
        state.uid = uid;
        state.starting = {};
      }
      state.starting[key] = true;
    },
    practiceStartEnded: (state, { payload: key }: PayloadAction<string>) => {
      delete state.starting[key];
    },
    /** A turn was started or removed: the marks are read again. */
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

export const { practiceStartBegan, practiceStartEnded, practiceChanged } =
  practiceSlice.actions;

export default practiceSlice.reducer;
