// Text practice (D94) for the pages: starting a practice (the key points take 5 to 15 seconds),
// answering it (the feedback takes as long), removing one, the marks of practised questions, and
// the practice calls left today. What is being started or answered, and a count of changes, are in
// the `practice` slice, so the marks are read again on every page after a change, and a page
// opened meanwhile says a practice is being started or an answer read.
import { useCallback, useEffect, useState } from 'react';

import {
  PRACTICE_DICTATIONS_MAX,
  type PracticeMark,
  practiceMarksOf,
  practiceStartKey,
  type PracticeTurn,
  type StartPracticeTurnRequest,
} from './practice';
import { useProfileGateway } from './ProfileGatewayProvider';
import {
  DICTATION_DAILY_LIMIT,
  effectiveLimits,
  PRACTICE_DAILY_LIMIT,
  serviceOverride,
  type StoredUsageLimits,
  USAGE_SERVICES,
} from './usageLimits';

import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch, useAppSelector } from '@/core/state/hooks';
import { selectPractice } from '@/core/state/selectors/practice';
import {
  practiceAnswerBegan,
  practiceAnswerEnded,
  practiceChanged,
  practiceStartBegan,
  practiceStartEnded,
} from '@/core/state/slices/practiceSlice';

export const usePractice = () => {
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const uid = useSessionUser()?.uid ?? null;
  const state = useAppSelector(selectPractice);
  const starting = uid !== null && state.uid === uid ? state.starting : {};

  /**
   * Starts practising a question, and resolves the turn's id once it is stored. Rejects with the
   * backend's refusal; the question is marked as being started meanwhile.
   */
  const start = useCallback(
    async (request: StartPracticeTurnRequest): Promise<string> => {
      if (!uid) {
        throw new Error('Not signed in');
      }
      const key = practiceStartKey(request);
      dispatch(practiceStartBegan({ uid, key }));
      try {
        const { turnId } = await gateway.startPracticeTurn(request);
        dispatch(practiceChanged());
        return turnId;
      } finally {
        dispatch(practiceStartEnded(key));
      }
    },
    [dispatch, gateway, uid],
  );

  const remove = useCallback(
    async (turnId: string) => {
      await gateway.removePracticeTurn(turnId);
      dispatch(practiceChanged());
    },
    [dispatch, gateway],
  );

  return {
    starting,
    isStarting: (request: StartPracticeTurnRequest) =>
      Boolean(starting[practiceStartKey(request)]),
    /** Something is being started: one practice at a time. */
    anyStarting: Object.keys(starting).length > 0,
    changes: state.changes,
    start,
    remove,
  };
};

/**
 * Feedback on an answer to one turn, typed or dictated: the answer being read, if it is, and an
 * answer whose feedback failed, kept to be sent again.
 */
export const usePracticeAnswer = (turnId: string) => {
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const uid = useSessionUser()?.uid ?? null;
  const state = useAppSelector(selectPractice);
  const mine = uid !== null && state.uid === uid;

  /**
   * Resolves the turn's number of tries once the feedback is stored; rejects with the backend's
   * refusal, keeping the answer.
   */
  const answer = useCallback(
    async (text: string, dictations = 0): Promise<{ attempts: number }> => {
      if (!uid) {
        throw new Error('Not signed in');
      }
      dispatch(practiceAnswerBegan({ uid, turnId, answer: text }));
      let result: { attempts: number };
      try {
        result = await gateway.answerPracticeTurn({
          turnId,
          answer: text,
          dictations: Math.min(dictations, PRACTICE_DICTATIONS_MAX),
        });
      } catch (error) {
        dispatch(practiceAnswerEnded({ turnId, kept: text }));
        throw error;
      }
      dispatch(practiceAnswerEnded({ turnId }));
      dispatch(practiceChanged());
      return result;
    },
    [dispatch, gateway, turnId, uid],
  );

  return {
    /** The answer being read, while it is. */
    answering: mine ? state.answering[turnId] : undefined,
    /** The answer whose feedback failed last. */
    draft: mine ? state.drafts[turnId] : undefined,
    answer,
  };
};

/**
 * The newest turn of each question a page lists, read when it opens and after every change; `null`
 * until read, or when there is nothing to read (`read` is `null`). A failed read marks nothing.
 */
export const usePracticeMarks = (
  read: ((uid: string) => Promise<PracticeTurn[]>) | null,
  keyOf: (turn: PracticeTurn) => string | undefined,
  /** What the read depends on, besides the changes: the page's ids. */
  readKey: string,
): Map<string, PracticeMark> | null => {
  const uid = useSessionUser()?.uid ?? null;
  const { changes } = useAppSelector(selectPractice);
  const [marks, setMarks] = useState<{
    readKey: string;
    marks: Map<string, PracticeMark>;
  } | null>(null);

  useEffect(() => {
    if (!uid || !read) {
      return undefined;
    }
    let live = true;
    read(uid).then(
      turns =>
        live && setMarks({ readKey, marks: practiceMarksOf(turns, keyOf) }),
      () => live && setMarks({ readKey, marks: new Map() }),
    );
    return () => {
      live = false;
    };
    // `read` and `keyOf` follow `readKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, readKey, changes]);

  return read && marks?.readKey === readKey ? marks.marks : null;
};

/** Today's practice calls and this account's limit, for "38 of 40 practice calls left today". */
export const usePracticeLeft = () => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid ?? null;
  const { changes } = useAppSelector(selectPractice);
  const [today, setToday] = useState<{
    made: number;
    limits: StoredUsageLimits | null;
  } | null>(null);

  // Read again after each practice started or answered: the backend counted it, or refused it.
  const [failures, setFailures] = useState(0);
  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    Promise.all([
      gateway.getPracticeToday(uid),
      gateway.getUsageLimits(uid).catch(() => null),
    ]).then(
      ([made, limits]) => live && setToday({ made, limits }),
      () => live && setToday(null),
    );
    return () => {
      live = false;
    };
  }, [gateway, uid, changes, failures]);

  const counted = useCallback(() => setFailures(count => count + 1), []);

  if (!today) {
    return { left: null, counted };
  }
  const max = effectiveLimits(
    PRACTICE_DAILY_LIMIT,
    serviceOverride(today.limits, USAGE_SERVICES.practice),
  ).maxCallsPerDay;
  return { left: { max, left: Math.max(0, max - today.made) }, counted };
};

/**
 * Today's dictations and this account's limit (D102), apart from the practice calls: read when the
 * page opens and after each dictation, so "Dictate" is off once they are used.
 */
export const useDictationLeft = () => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid ?? null;
  const [today, setToday] = useState<{
    made: number;
    limits: StoredUsageLimits | null;
  } | null>(null);
  const [reads, setReads] = useState(0);
  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    Promise.all([
      gateway.getDictationsToday(uid),
      gateway.getUsageLimits(uid).catch(() => null),
    ]).then(
      ([made, limits]) => live && setToday({ made, limits }),
      () => live && setToday(null),
    );
    return () => {
      live = false;
    };
  }, [gateway, uid, reads]);

  const counted = useCallback(() => setReads(count => count + 1), []);

  if (!today) {
    return { left: null, counted };
  }
  const max = effectiveLimits(
    DICTATION_DAILY_LIMIT,
    serviceOverride(today.limits, USAGE_SERVICES.dictation),
  ).maxCallsPerDay;
  return { left: { max, left: Math.max(0, max - today.made) }, counted };
};
