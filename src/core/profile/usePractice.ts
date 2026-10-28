// Text practice (D94) for the pages: starting a practice (the key points take 5 to 15 seconds),
// removing one, the marks of practised questions, and the practice calls left today. What is
// being started, and a count of changes, are in the `practice` slice, so the marks are read again
// on every page after a change, and a page opened meanwhile says a practice is being started.
import { useCallback, useEffect, useState } from 'react';

import {
  type PracticeMark,
  practiceMarksOf,
  practiceStartKey,
  type PracticeTurn,
  type StartPracticeTurnRequest,
} from './practice';
import { useProfileGateway } from './ProfileGatewayProvider';
import {
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

  // Read again after each practice started: the backend counted it, or refused it.
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
