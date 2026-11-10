// The hints column of a mock interview (Web-X6-Hints, FR-22, slice H2): 3 to 5 key points for the
// question on screen, from the profile, written by the backend in the background (H1). The setup's
// choice says when they show: with each question, when asked for ("Show hints"), or once
// answered ("Show them now" before), the answered question's under "For the question you just
// answered" until the next answer starts. A question's hints still being written are "on their
// way", and the session is read again every 3 seconds until they are in; failed, or still not in
// after a minute, the question goes on without them.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { type MockView } from '@/core/mock/MockInterviewController';
import { type ProfileResource } from '@/core/profile/contract';
import {
  type MockHintsShown,
  mockHintsOf,
  type MockSession,
} from '@/core/profile/mockInterviews';
import { type PracticeKeyPoint } from '@/core/profile/practice';
import KeyPointList from '@/screens/Practice/KeyPointList';

/** How often the session is read again while the hints shown are on their way. */
export const MOCK_HINTS_POLL_MS = 3_000;
/** A minute of reads, then the question goes on without them. */
export const MOCK_HINTS_MAX_READS = 20;

export type HintsCardState =
  /** "When I ask", not asked yet. */
  | { kind: 'hidden' }
  /** "After I answer", while answering. */
  | { kind: 'after' }
  | { kind: 'coming'; of: 'question' | 'follow-up' }
  | { kind: 'none' }
  | { kind: 'points'; keyPoints: PracticeKeyPoint[]; justAnswered: boolean };

export interface MockHintsShownNow {
  state: HintsCardState;
  /** The turn whose hints these are. */
  turnId: string;
}

/**
 * What the column shows for the question on screen, from the session as last read; null before
 * the first question. A turn the read doesn't have yet is on its way.
 */
export const mockHintsShownOf = ({
  session,
  view,
  shown,
  revealed,
  gaveUp,
}: {
  session: Pick<MockSession, 'turns' | 'hints'>;
  view: Pick<MockView, 'question' | 'answered'>;
  shown: MockHintsShown;
  /** Turns whose hints were asked for: "Show hints", "Show them now". */
  revealed: ReadonlySet<string>;
  /** Turns whose hints never came. */
  gaveUp: ReadonlySet<string>;
}): MockHintsShownNow | null => {
  const turnId = view.question?.turnId;
  if (!turnId) {
    return null;
  }
  const justAnswered = shown === 'after-answer' && view.answered !== undefined;
  const target = (justAnswered && view.answered) || turnId;
  if (!justAnswered && !revealed.has(target)) {
    if (shown === 'on-request') {
      return { turnId: target, state: { kind: 'hidden' } };
    }
    if (shown === 'after-answer') {
      return { turnId: target, state: { kind: 'after' } };
    }
  }
  const hints = mockHintsOf(session, target);
  if (hints.status === 'ready') {
    return {
      turnId: target,
      state: { kind: 'points', keyPoints: hints.keyPoints, justAnswered },
    };
  }
  if (hints.status === 'none' || gaveUp.has(target)) {
    return { turnId: target, state: { kind: 'none' } };
  }
  const turn = session.turns.find(({ id }) => id === target);
  const followUp = turn
    ? turn.kind === 'follow-up'
    : target === turnId && view.question?.kind === 'follow-up';
  return {
    turnId: target,
    state: { kind: 'coming', of: followUp ? 'follow-up' : 'question' },
  };
};

/**
 * The column's state, asking again for the session while the hints shown are on their way.
 * `reload` reads the session again.
 */
export const useMockHints = ({
  session,
  view,
  shown,
  reload,
}: {
  session: MockSession | null;
  view: MockView;
  shown: MockHintsShown;
  reload: () => void;
}) => {
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [gaveUp, setGaveUp] = useState<ReadonlySet<string>>(new Set());
  const now = session
    ? mockHintsShownOf({ session, view, shown, revealed, gaveUp })
    : null;
  const waitingFor = now?.state.kind === 'coming' ? now.turnId : undefined;

  useEffect(() => {
    if (!waitingFor) {
      return undefined;
    }
    let reads = 0;
    const timer = setInterval(() => {
      reads += 1;
      if (reads > MOCK_HINTS_MAX_READS) {
        clearInterval(timer);
        setGaveUp(known => new Set(known).add(waitingFor));
        return;
      }
      reload();
    }, MOCK_HINTS_POLL_MS);
    return () => clearInterval(timer);
  }, [waitingFor, reload]);

  return {
    now,
    reveal: (turnId: string) =>
      setRevealed(known => new Set(known).add(turnId)),
  };
};

export const MockHintsCard: React.FC<{
  state: HintsCardState;
  resources: ProfileResource[];
  onReveal: () => void;
}> = ({ state, resources, onReveal }) => {
  const { t } = useTranslation();
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="mock-hints"
      className="items-stretch gap-3 p-5">
      <div className="flex items-baseline gap-2">
        <h2
          id="mock-hints"
          className="min-w-0 flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('mock.hintsTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t('mock.hintsFrom')}
        </p>
      </div>
      {state.kind === 'hidden' && (
        <>
          <p className="text-[15px] leading-normal text-muted">
            {t('mock.hintsHidden')}
          </p>
          <Button
            variant="secondary"
            size="small"
            onClick={onReveal}
            className="gap-2 self-start">
            <Icon name="bulb" size={18} />
            {t('mock.showHintsButton')}
          </Button>
        </>
      )}
      {state.kind === 'after' && (
        <>
          <p className="text-[15px] leading-normal text-muted">
            {t('mock.hintsAfter')}
          </p>
          <Button
            variant="quiet"
            size="small"
            onClick={onReveal}
            className="self-start">
            {t('mock.showHintsNowButton')}
          </Button>
        </>
      )}
      {state.kind === 'coming' && (
        <p className="flex items-start gap-2.5 text-[15px] leading-normal text-muted">
          <span className="flex pt-0.5 text-primary">
            <Spinner size="small" decorative />
          </span>
          <span className="min-w-0 flex-1">
            {state.of === 'follow-up'
              ? t('mock.hintsComingFollowUp')
              : t('mock.hintsComingQuestion')}
          </span>
        </p>
      )}
      {state.kind === 'none' && (
        <p className="text-[15px] leading-normal text-muted">
          {t('mock.hintsNone')}
        </p>
      )}
      {state.kind === 'points' && (
        <>
          {state.justAnswered && (
            <span className="flex">
              <Chip tone="neutral">{t('mock.hintsJustAnsweredChip')}</Chip>
            </span>
          )}
          <KeyPointList keyPoints={state.keyPoints} resources={resources} />
        </>
      )}
    </Card>
  );
};
