// The cover letters of one application (D98), kept in the `coverLetters` slice: read through the
// profile gateway the first time its "CV and letter" tab, or one of its letters, opens in a session;
// the pages then change them only through the backend's callables, and read again what they changed.
// A letter is written in the background (under a minute): `useFollowLetters` reads it again every 2
// seconds meanwhile, as the CV pages do for a version.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type CoverLetter,
  type CreateCoverLetterRequest,
  type ReviseCoverLetterSentenceRequest,
  type RewriteCoverLetterRequest,
} from './coverLetters';
import { logProfileError } from './errors';
import { RESOURCE_POLL_MS } from './InterviewProfileProvider';
import { useProfileGateway } from './ProfileGatewayProvider';
import {
  COVER_LETTER_DAILY_LIMIT,
  effectiveLimits,
  serviceOverride,
  type StoredUsageLimits,
  USAGE_SERVICES,
} from './usageLimits';

import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch, useAppSelector } from '@/core/state/hooks';
import { selectCoverLetters } from '@/core/state/selectors/coverLetters';
import {
  letterChanged,
  letterRemoved,
  lettersLoaded,
  lettersLoadFailed,
  lettersLoadStarted,
  type CoverLettersStatus,
} from '@/core/state/slices/coverLettersSlice';

/** An application's letters as the store has them, and reading one again; nothing is loaded. */
const useLettersOf = (applicationId: string) => {
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const uid = useSessionUser()?.uid ?? null;
  const state = useAppSelector(selectCoverLetters);
  const known =
    uid !== null && state.uid === uid
      ? state.byApplication[applicationId]
      : undefined;

  /** Reads one letter again into the list, out of it when it is gone. Resolves it. */
  const refresh = useCallback(
    async (letterId: string): Promise<CoverLetter | null> => {
      if (!uid) {
        return null;
      }
      const letter = await gateway.getCoverLetter(uid, letterId);
      dispatch(
        letter
          ? letterChanged(letter)
          : letterRemoved({ applicationId, letterId }),
      );
      return letter;
    },
    [applicationId, dispatch, gateway, uid],
  );

  return { uid, known, refresh };
};

export const useCoverLetters = (applicationId: string) => {
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const { uid, known, refresh } = useLettersOf(applicationId);

  const reload = useCallback(async () => {
    if (!uid) {
      return;
    }
    dispatch(lettersLoadStarted({ uid, applicationId }));
    try {
      const letters = await gateway.getApplicationLetters(uid, applicationId);
      dispatch(lettersLoaded({ uid, applicationId, letters }));
    } catch (error) {
      logProfileError('getApplicationLetters', error, uid);
      dispatch(lettersLoadFailed({ uid, applicationId }));
    }
  }, [applicationId, dispatch, gateway, uid]);

  const loaded = known !== undefined;
  useEffect(() => {
    if (uid && !loaded) {
      reload();
    }
    // Once per application and user: the store keeps them for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, applicationId]);

  /** Asks for a letter, and puts it in the list as the backend stored it. Resolves its id. */
  const create = useCallback(
    async (request: CreateCoverLetterRequest): Promise<string> => {
      const { letterId } = await gateway.createCoverLetter(request);
      await refresh(letterId).catch(() => null);
      return letterId;
    },
    [gateway, refresh],
  );

  const markSent = useCallback(
    async (letterId: string, sent: boolean) => {
      await gateway.markCoverLetterSent(letterId, sent);
      // Marking one clears the others of the application.
      await reload();
    },
    [gateway, reload],
  );

  const remove = useCallback(
    async (letterId: string) => {
      await gateway.removeCoverLetter(letterId);
      dispatch(letterRemoved({ applicationId, letterId }));
    },
    [applicationId, dispatch, gateway],
  );

  /** "Write this letter again", or "Improve my version": a new letter. Resolves its id. */
  const rewrite = useCallback(
    async (letterId: string, request: RewriteCoverLetterRequest) => {
      const { letterId: written } = await gateway.rewriteCoverLetter(
        letterId,
        request,
      );
      await refresh(written).catch(() => null);
      return written;
    },
    [gateway, refresh],
  );

  /** A sentence edited, removed or restored, then the letter read again. */
  const revise = useCallback(
    async (
      letterId: string,
      sentenceId: string,
      request: ReviseCoverLetterSentenceRequest,
    ) => {
      await gateway.reviseCoverLetterSentence(letterId, sentenceId, request);
      await refresh(letterId);
    },
    [gateway, refresh],
  );

  /** A question answered, or skipped without an answer, then the letter read again. */
  const answer = useCallback(
    async (letterId: string, questionId: string, words?: string) => {
      await gateway.answerCoverLetterQuestion(letterId, questionId, words);
      await refresh(letterId);
    },
    [gateway, refresh],
  );

  /** "Save my version", then the letter read again. */
  const saveText = useCallback(
    async (letterId: string, text: string) => {
      await gateway.saveCoverLetterText(letterId, text);
      await refresh(letterId);
    },
    [gateway, refresh],
  );

  /** "Restore the written letter", then the letter read again. */
  const restoreText = useCallback(
    async (letterId: string) => {
      await gateway.restoreCoverLetterText(letterId);
      await refresh(letterId);
    },
    [gateway, refresh],
  );

  const status: CoverLettersStatus = known?.status ?? 'loading';
  return {
    status,
    letters: known?.letters ?? [],
    reload,
    refresh,
    create,
    markSent,
    remove,
    rewrite,
    revise,
    answer,
    saveText,
    restoreText,
  };
};

/**
 * While a letter of the application is being written, reads it again every 2 seconds until it is
 * ready or failed, and calls `onWritten` once one is (today's count changed).
 */
export const useFollowLetters = (
  applicationId: string,
  onWritten?: () => void,
) => {
  const { known, refresh } = useLettersOf(applicationId);
  const creating = (known?.letters ?? [])
    .filter(({ status }) => status === 'creating')
    .map(({ id }) => id)
    .join(',');
  const written = useRef(onWritten);
  useEffect(() => {
    written.current = onWritten;
  });

  useEffect(() => {
    if (!creating) {
      return undefined;
    }
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) {
        return;
      }
      busy = true;
      try {
        const read = await Promise.all(
          creating
            .split(',')
            .map(letterId => refresh(letterId).catch(() => null)),
        );
        if (read.some(letter => !letter || letter.status !== 'creating')) {
          written.current?.();
        }
      } finally {
        busy = false;
      }
    }, RESOURCE_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [creating, refresh]);
};

/** Today's letters and this account's limit, for "9 of 10 left today". */
export const useLettersLeft = () => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const [reads, setReads] = useState(0);
  const [today, setToday] = useState<{
    written: number;
    limits: StoredUsageLimits | null;
  } | null>(null);

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    Promise.all([
      gateway.getCoverLettersToday(uid),
      gateway.getUsageLimits(uid).catch(() => null),
    ]).then(
      ([written, limits]) => live && setToday({ written, limits }),
      () => live && setToday(null),
    );
    return () => {
      live = false;
    };
  }, [gateway, uid, reads]);

  const reread = useCallback(() => setReads(count => count + 1), []);
  if (!today) {
    return { left: null, reread };
  }
  const max = effectiveLimits(
    COVER_LETTER_DAILY_LIMIT,
    serviceOverride(today.limits, USAGE_SERVICES.coverLetter),
  ).maxCallsPerDay;
  return { left: { max, left: Math.max(0, max - today.written) }, reread };
};
