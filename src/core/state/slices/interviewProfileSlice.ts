// The interview profile of the signed-in user, as the pages last read it: the resources and
// the skill map. No screen of the app to mirror yet. The profile pages keep it in step with
// the profile gateway (src/core/profile/hooks.ts); nothing here calls the backend.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { authStateChanged } from './sessionSlice';

import {
  type ProfileResource,
  type SkillMapItem,
} from '@/core/profile/contract';

export type InterviewProfileStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface InterviewProfileState {
  /** Whose profile this is. Another user starts from nothing. */
  uid: string | null;
  status: InterviewProfileStatus;
  /** Newest first. */
  resources: ProfileResource[];
  /** In no particular order: the pages sort them. */
  items: SkillMapItem[];
  /** How many resources the backend read for this user today (UTC). */
  extractionsToday: number;
  /**
   * The backend refused a resource because today's limit was reached. It also has a limit
   * on cost that the count above does not show, so this is remembered separately.
   */
  dailyLimitRefused: boolean;
}

export const initialInterviewProfileState: InterviewProfileState = {
  uid: null,
  status: 'idle',
  resources: [],
  items: [],
  extractionsToday: 0,
  dailyLimitRefused: false,
};

const newestFirst = (a: ProfileResource, b: ProfileResource) =>
  (b.createdAt ?? Number.MAX_SAFE_INTEGER) -
  (a.createdAt ?? Number.MAX_SAFE_INTEGER);

export const interviewProfileSlice = createSlice({
  name: 'interviewProfile',
  initialState: initialInterviewProfileState,
  reducers: {
    /** A read of the whole profile started, for this user. */
    profileLoadStarted: (state, { payload: uid }: PayloadAction<string>) => {
      if (state.uid !== uid) {
        Object.assign(state, initialInterviewProfileState, { uid });
      }
      state.status = 'loading';
    },
    profileLoaded: (
      state,
      {
        payload,
      }: PayloadAction<{
        uid: string;
        resources: ProfileResource[];
        items: SkillMapItem[];
        extractionsToday: number;
      }>,
    ) => {
      // An answer for a user who has gone is dropped.
      if (state.uid !== payload.uid) {
        return;
      }
      state.status = 'loaded';
      state.resources = [...payload.resources].sort(newestFirst);
      state.items = payload.items;
      state.extractionsToday = payload.extractionsToday;
    },
    profileLoadFailed: (state, { payload: uid }: PayloadAction<string>) => {
      if (state.uid === uid) {
        state.status = 'error';
      }
    },
    /** A resource was added, or read again: it takes its place in the list. */
    resourceChanged: (state, { payload }: PayloadAction<ProfileResource>) => {
      const index = state.resources.findIndex(({ id }) => id === payload.id);
      if (index === -1) {
        state.resources.push(payload);
        state.resources.sort(newestFirst);
      } else {
        state.resources[index] = payload;
      }
    },
    resourceRemoved: (state, { payload: id }: PayloadAction<string>) => {
      state.resources = state.resources.filter(resource => resource.id !== id);
      state.items = state.items.filter(item => item.resourceId !== id);
    },
    /** The skill map was read again, after a resource was read or an item changed. */
    itemsLoaded: (state, { payload }: PayloadAction<SkillMapItem[]>) => {
      state.items = payload;
    },
    /** The backend accepted one more resource today. */
    extractionCounted: state => {
      state.extractionsToday += 1;
    },
    dailyLimitRefused: state => {
      state.dailyLimitRefused = true;
    },
  },
  extraReducers: builder => {
    // The user signed out, or another one signed in: nothing of the profile is kept.
    builder.addCase(authStateChanged, (state, { payload: user }) =>
      state.uid !== null && user?.uid !== state.uid
        ? initialInterviewProfileState
        : state,
    );
  },
});

export const {
  profileLoadStarted,
  profileLoaded,
  profileLoadFailed,
  resourceChanged,
  resourceRemoved,
  itemsLoaded,
  extractionCounted,
  dailyLimitRefused,
} = interviewProfileSlice.actions;

export default interviewProfileSlice.reducer;
