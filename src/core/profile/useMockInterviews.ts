// Mock interviews (D100) for the pages: the sessions left today ("2 of 3 mock interviews left
// today"), whether the account has had one yet (the notice before the first), and one session
// read for its page. Each is read when its page opens; nothing listens.
import { useCallback, useEffect, useState } from 'react';

import { logProfileError } from './errors';
import { type MockSession } from './mockInterviews';
import { useProfileGateway } from './ProfileGatewayProvider';
import {
  effectiveLimits,
  MOCK_INTERVIEW_DAILY_LIMIT,
  serviceOverride,
  USAGE_SERVICES,
} from './usageLimits';

import { useSessionUser } from '@/core/session/hooks';

/** Today's mock interviews and this account's limit; `null` until read, or when it can't be. */
export const useMockLeft = () => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid ?? null;
  const [reads, setReads] = useState(0);
  const [left, setLeft] = useState<{ left: number; max: number } | null>(null);

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    Promise.all([
      gateway.getMockInterviewsToday(uid),
      gateway.getUsageLimits(uid).catch(() => null),
    ]).then(
      ([made, limits]) => {
        const max = effectiveLimits(
          MOCK_INTERVIEW_DAILY_LIMIT,
          serviceOverride(limits, USAGE_SERVICES.mockInterview),
        ).maxCallsPerDay;
        if (live) {
          setLeft({ max, left: Math.max(0, max - made) });
        }
      },
      () => live && setLeft(null),
    );
    return () => {
      live = false;
    };
  }, [gateway, uid, reads]);

  const reread = useCallback(() => setReads(count => count + 1), []);
  return { left, reread };
};

/** Whether the account has a mock interview yet; `null` until read. A failed count says none. */
export const useHasMockSessions = (): boolean | null => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid ?? null;
  const [has, setHas] = useState<boolean | null>(null);

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    gateway.countMockSessions(uid).then(
      count => live && setHas(count > 0),
      () => live && setHas(false),
    );
    return () => {
      live = false;
    };
  }, [gateway, uid]);

  return has;
};

export type MockSessionRead =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; session: MockSession | null };

/**
 * One mock interview, read when its page opens and on `reload`. Read again, the session shown
 * stays until the new read is in.
 */
export const useMockSession = (sessionId: string | undefined) => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid ?? null;
  const [reads, setReads] = useState(0);
  const [read, setRead] = useState<{
    sessionId: string;
    state: MockSessionRead;
  } | null>(null);

  useEffect(() => {
    if (!uid || !sessionId) {
      return undefined;
    }
    let live = true;
    gateway.getMockSession(uid, sessionId).then(
      session =>
        live && setRead({ sessionId, state: { status: 'loaded', session } }),
      error => {
        logProfileError('getMockSession', error, uid);
        if (live) {
          setRead(known =>
            known?.sessionId === sessionId && known.state.status === 'loaded'
              ? known
              : { sessionId, state: { status: 'error' } },
          );
        }
      },
    );
    return () => {
      live = false;
    };
  }, [gateway, uid, sessionId, reads]);

  const reload = useCallback(() => setReads(count => count + 1), []);
  const state: MockSessionRead =
    read && read.sessionId === sessionId ? read.state : { status: 'loading' };
  return { state, reload };
};
