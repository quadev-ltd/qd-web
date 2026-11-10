// The end of a mock interview (Web-X6-End, -End-Other, D100): how it ended, with "See your
// answers and feedback" and "Start a new one", then "How it went" (D101, MockFeedback) and the
// tester's feedback card. Take turns doesn't ask whether the interviewer cut them off (doc 24 §14).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import ChoiceChips from '@/components/ui/ChoiceChips';
import { logProfileError } from '@/core/profile/errors';
import { dailyLimitResetTime } from '@/core/profile/limits';
import {
  MOCK_FEEDBACK_COMMENT_MAX_CHARS,
  MOCK_FEEL,
  MOCK_WAIT,
  type MockEndReason,
  type MockSession,
} from '@/core/profile/mockInterviews';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { MOCK_INTERVIEW_DAILY_LIMIT } from '@/core/profile/usageLimits';
import { useSessionUser } from '@/core/session/hooks';
import { MockPanel, mockCounts, mockMinutes } from '@/screens/Mock/mockParts';

/** How it ended: the backend's reason, or `idle` for one left active for 30 minutes. */
export type MockEnding = MockEndReason | 'idle';

const WAIT_KEYS = {
  ok: 'mock.waitOk',
  'a-bit-long': 'mock.waitBitLong',
  'too-long': 'mock.waitTooLong',
} as const satisfies Record<(typeof MOCK_WAIT)[number], string>;

export const MockEndPanel: React.FC<{
  ending: MockEnding;
  session: MockSession | null;
  transcriptTo: string;
  onNew?: () => void;
}> = ({ ending, session, transcriptTo, onNew }) => {
  const { t } = useTranslation();
  const counts = session
    ? mockCounts(session)
    : { questions: 0, followUps: 0, answered: 0 };
  const answered =
    counts.answered > 0
      ? t('mock.answered', { count: counts.answered })
      : t('mock.answeredNone');
  const actions = (
    <>
      <ButtonLink to={transcriptTo} size="small">
        {t('mock.transcriptButton')}
      </ButtonLink>
      {onNew && (
        <Button
          variant="secondary"
          size="small"
          onClick={onNew}
          className="gap-2">
          <Icon name="refresh" size={18} />
          {t('mock.newButton')}
        </Button>
      )}
    </>
  );

  switch (ending) {
    case 'finished': {
      const asked = [
        t('mock.questionsCount', { count: counts.questions }),
        counts.followUps > 0
          ? t('mock.followUpsCount', { count: counts.followUps })
          : null,
      ]
        .filter(Boolean)
        .join(t('mock.and'));
      return (
        <MockPanel
          tone="success"
          icon="check"
          title={t('mock.endFinishedTitle')}
          actions={actions}>
          <p>
            {t('mock.endFinishedText', {
              asked,
              minutes: session ? mockMinutes(session) : 0,
            })}
          </p>
        </MockPanel>
      );
    }
    case 'timed-out':
      return (
        <MockPanel
          tone="warning"
          icon="pause"
          title={t('mock.endPausedTitle')}
          actions={actions}>
          <p>{t('mock.endPausedText', { answered })}</p>
        </MockPanel>
      );
    case 'failed':
      return (
        <MockPanel
          tone="danger"
          icon="alert"
          title={t('mock.endFailedTitle')}
          actions={actions}>
          <p>{t('mock.endFailedText', { answered })}</p>
        </MockPanel>
      );
    case 'quota':
      return (
        <MockPanel
          tone="warning"
          icon="clock"
          title={t('mock.endQuotaTitle')}
          actions={actions}>
          <p>
            {t('mock.endQuotaText', {
              dollars: MOCK_INTERVIEW_DAILY_LIMIT.maxCostUsdPerDay,
              time: dailyLimitResetTime(),
              answered,
            })}
          </p>
        </MockPanel>
      );
    case 'idle':
      return (
        <MockPanel
          tone="warning"
          icon="clock"
          title={t('mock.endIdleTitle')}
          actions={actions}>
          <p>{t('mock.endIdleText', { answered })}</p>
        </MockPanel>
      );
    case 'ended':
      return (
        <MockPanel
          tone="success"
          icon="check"
          title={t('mock.endEndedTitle')}
          actions={actions}>
          <p>{t('mock.endEndedText', { answered })}</p>
        </MockPanel>
      );
  }
};

/** "How did it go?": how it felt, the wait, and anything else. Sending again replaces it. */
export const MockFeedbackCard: React.FC<{
  sessionId: string;
  /** What was sent before, if anything. */
  sent?: MockSession['feedback'];
}> = ({ sessionId, sent }) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const [feel, setFeel] = useState<number | null>(sent?.feel ?? null);
  const [wait, setWait] = useState<(typeof MOCK_WAIT)[number] | null>(
    sent?.wait ?? null,
  );
  const [comment, setComment] = useState(sent?.comment ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
    'idle',
  );
  const tooLong = comment.trim().length > MOCK_FEEDBACK_COMMENT_MAX_CHARS;

  const send = async () => {
    if (feel === null || wait === null) {
      return;
    }
    setState('sending');
    try {
      await gateway.sendMockFeedback({
        sessionId,
        feel,
        wait,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      setState('sent');
    } catch (error) {
      logProfileError('sendMockFeedback', error, uid);
      setState('failed');
    }
  };

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="mock-feedback"
      className="gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2
          id="mock-feedback"
          className="font-display text-[18px] leading-tight font-semibold">
          {t('mock.feedbackTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t('mock.feedbackText')}
        </p>
      </div>
      {state === 'sent' ? (
        <Banner tone="success">{t('mock.feedbackThanks')}</Banner>
      ) : (
        <>
          <ChoiceChips
            label={t('mock.feelLabel')}
            options={MOCK_FEEL.map(value => ({ value, label: String(value) }))}
            value={feel}
            onChange={setFeel}
            disabled={state === 'sending'}
          />
          <ChoiceChips
            label={t('mock.waitLabel')}
            options={MOCK_WAIT.map(value => ({
              value,
              label: t(WAIT_KEYS[value]),
            }))}
            value={wait}
            onChange={setWait}
            disabled={state === 'sending'}
          />
          <FormTextArea
            name="comment"
            rows={3}
            label={t('mock.commentLabel')}
            hint={t('mock.commentHint')}
            value={comment}
            onChange={event => setComment(event.target.value)}
            readOnly={state === 'sending'}
            counter={{
              length: comment.trim().length,
              max: MOCK_FEEDBACK_COMMENT_MAX_CHARS,
            }}
            error={
              tooLong
                ? { type: 'maxLength', message: t('mock.commentLengthError') }
                : undefined
            }
          />
          {state === 'failed' && (
            <Banner tone="danger" role="alert">
              {t('mock.feedbackFailed')}
            </Banner>
          )}
          <Button
            size="small"
            onClick={() => void send()}
            disabled={
              feel === null || wait === null || tooLong || state === 'sending'
            }
            aria-busy={state === 'sending'}
            className="gap-2 self-start">
            {state === 'sending' && <Spinner size="small" decorative />}
            {state === 'sending'
              ? t('mock.sendingButton')
              : t('mock.sendButton')}
          </Button>
        </>
      )}
    </Card>
  );
};
