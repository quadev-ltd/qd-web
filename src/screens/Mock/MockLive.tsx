// The interview as it runs (Web-X6-Speaking, -Answering, -Answering-Long, -Thinking, -Paused,
// -States, D100): the progress line with Pause and "End interview", the interviewer's card (the
// question spoken, your turn, thinking, held back by the browser), the answer's card (microphone
// off, recording with its time and the warning at 2:30, sending, and what to put right), and the
// paused panel. One column until hints (slice H2) take the side.
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import RecordingLevel from '@/components/RecordingLevel';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { clockTime, useTicking } from '@/core/audio/clock';
import {
  type MockInterviewController,
  type MockView,
} from '@/core/mock/MockInterviewController';
import { MOCK_ANSWER_WARN_MS } from '@/core/profile/mockInterviews';
import { MockPanel } from '@/screens/Mock/mockParts';
import { mockNow } from '@/screens/Mock/useMockController';

/** The phases in which the clock stops: paused, over, or the connection down (real time). */
const CLOCK_STOPPED: ReadonlySet<string> = new Set([
  'paused',
  'ended',
  'reconnecting',
  'disconnected',
  'replaced',
]);

/** What the progress line needs of either way's view. */
export type ProgressView = Pick<MockView, 'timeLeft'> & { phase: string };

/** The time left as the controller last heard it, run down while the interview runs. */
export const timeLeftOf = (view: ProgressView): number | null => {
  if (!view.timeLeft) {
    return null;
  }
  const running = !CLOCK_STOPPED.has(view.phase);
  return Math.max(
    0,
    view.timeLeft.ms - (running ? mockNow() - view.timeLeft.at : 0),
  );
};

export const MockProgress: React.FC<{
  view: ProgressView;
  progress: { number: number; of: number } | null;
  onPause: () => void;
  onEnd: () => void;
}> = ({ view, progress, onPause, onEnd }) => {
  const { t } = useTranslation();
  const left = timeLeftOf(view);
  const minutes = left === null ? null : Math.ceil(left / 60_000);
  const text = [
    progress ? t('mock.progressQuestion', progress) : null,
    minutes === null ? null : t('mock.progressTime', { minutes }),
  ]
    .filter(Boolean)
    .join(' · ');
  const canPause =
    view.phase === 'speaking' ||
    view.phase === 'answering' ||
    view.phase === 'listening';
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Chip tone="brand" icon="wave">
        {t('mock.aiInterviewer')}
      </Chip>
      <p className="min-w-0 flex-[1_1_160px] text-[15px] leading-normal font-medium text-muted">
        {text}
      </p>
      {view.phase === 'paused' ? (
        <Chip tone="neutral" icon="pause">
          {t('mock.pausedChip')}
        </Chip>
      ) : (
        <Button
          variant="secondary"
          size="small"
          onClick={onPause}
          disabled={!canPause}
          className="gap-2">
          <Icon name="pause" size={18} />
          {t('mock.pauseButton')}
        </Button>
      )}
      <Button variant="quiet" size="small" onClick={onEnd}>
        {t('mock.endButton')}
      </Button>
    </div>
  );
};

const STATUS = {
  speaking: { key: 'mock.statusSpeaking', tone: 'brand', icon: 'wave' },
  answering: { key: 'mock.statusYourTurn', tone: 'success', icon: 'mic' },
  paused: { key: 'mock.statusPaused', tone: 'neutral', icon: 'pause' },
  sending: { key: 'mock.statusThinking', tone: 'neutral', icon: undefined },
  tap: { key: 'mock.statusReady', tone: 'brand', icon: 'play' },
} as const;

/** What the interviewer is doing, and the question asked. */
export const InterviewerCard: React.FC<{
  view: MockView;
  controller: MockInterviewController;
}> = ({ view, controller }) => {
  const { t } = useTranslation();
  const line =
    view.phase === 'speaking' || view.phase === 'tap'
      ? (view.speaking ?? view.question)
      : view.question;
  const status =
    view.phase === 'issue'
      ? STATUS.answering
      : STATUS[view.phase as keyof typeof STATUS];
  const followUp =
    line?.kind === 'follow-up' ||
    (line?.kind === 'rephrase' && view.question?.kind === 'follow-up');
  const kindLabel =
    line?.kind === 'opening'
      ? t('mock.kindOpening')
      : line?.kind === 'closing'
        ? t('mock.kindClosing')
        : followUp
          ? t('mock.kindFollowUp')
          : t('mock.kindQuestion');
  const answering = view.phase === 'answering' || view.phase === 'issue';

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="mock-interviewer"
      className="gap-4 p-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 flex-none items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="wave" size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2
            id="mock-interviewer"
            className="text-[16px] leading-tight font-bold">
            {t('mock.aiInterviewer')}
          </h2>
          <p className="text-[13px] leading-normal text-muted">{kindLabel}</p>
        </div>
        {status && (
          <Chip tone={status.tone} icon={status.icon}>
            {t(status.key)}
          </Chip>
        )}
      </div>
      {view.phase === 'sending' ? (
        <div className="flex flex-col gap-2" role="status">
          <p className="flex items-center gap-3 text-[17px] leading-normal font-medium">
            <Spinner decorative />
            {t('mock.thinkingText')}
          </p>
          <p className="text-sm leading-normal text-muted">
            {t('mock.thinkingNote')}
          </p>
        </div>
      ) : (
        line && (
          <>
            {followUp && (
              <span className="flex">
                <Chip tone="info">{t('mock.followUpChip')}</Chip>
              </span>
            )}
            <p
              aria-live="polite"
              className="font-display text-[clamp(19px,3vw,22px)] leading-[1.35] font-semibold wrap-anywhere">
              {line.text}
            </p>
          </>
        )
      )}
      {view.phase === 'tap' && (
        <Banner
          tone="info"
          action={
            <Button
              size="small"
              onClick={() => void controller.tapToHear()}
              className="gap-2">
              <Icon name="play" size={18} />
              {t('mock.tapButton')}
            </Button>
          }>
          {t('mock.heldBackMessage')}
        </Banner>
      )}
      {view.phase === 'speaking' && line?.kind !== 'closing' && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={() => controller.stopAndAnswer()}
            className="gap-2">
            <Icon name="stop" size={18} />
            {t('mock.stopAndAnswerButton')}
          </Button>
        </div>
      )}
      {answering && (
        <div className="flex flex-col gap-0.5">
          <div className="-ml-1.5 flex flex-wrap gap-1">
            <Button
              variant="quiet"
              size="small"
              onClick={() => void controller.repeat()}
              className="gap-2">
              <Icon name="refresh" size={18} />
              {t('mock.repeatButton')}
            </Button>
            <Button
              variant="quiet"
              size="small"
              onClick={() => void controller.sayDifferently()}
              disabled={view.rephrased}
              className="gap-2">
              <Icon name="edit" size={18} />
              {t('mock.sayDifferentlyButton')}
            </Button>
            <Button
              variant="quiet"
              size="small"
              onClick={() => void controller.skip()}
              className="gap-2">
              <Icon name="skip" size={18} />
              {t('mock.skipButton')}
            </Button>
          </div>
          <p className="text-sm leading-normal text-muted">
            {t('mock.repeatNote')}
          </p>
        </div>
      )}
    </Card>
  );
};

const SENDING_KEYS = {
  answer: 'mock.sendingAnswer',
  skip: 'mock.sendingSkip',
  rephrase: 'mock.sendingRephrase',
} as const;

/** "Your answer": the microphone off, recording, sending, or what to put right. */
export const AnswerCard: React.FC<{
  view: MockView;
  controller: MockInterviewController;
}> = ({ view, controller }) => {
  const { t } = useTranslation();
  const recording = view.phase === 'answering';
  useTicking(recording);
  const elapsed = controller.recordedMs();

  let body: React.ReactNode;
  if (view.phase === 'answering') {
    body = (
      <>
        <p className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="size-3 flex-none rounded-full bg-danger"
          />
          <span className="text-[16px] leading-normal font-bold text-danger">
            {t('mock.recording', { time: clockTime(elapsed) })}
          </span>
          <RecordingLevel />
        </p>
        {elapsed >= MOCK_ANSWER_WARN_MS && (
          <Banner tone="warning" role="alert">
            {t('mock.warnMessage')}
          </Banner>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void controller.done()}
            className="flex-[1_1_200px] gap-2">
            <Icon name="check" size={18} />
            {t('mock.doneButton')}
          </Button>
          <Button
            variant="quiet"
            size="small"
            onClick={() => controller.restartAnswer()}
            className="gap-2">
            <Icon name="refresh" size={18} />
            {t('mock.restartAnswerButton')}
          </Button>
        </div>
        <p className="text-sm leading-normal text-muted">{t('mock.maxNote')}</p>
      </>
    );
  } else if (view.phase === 'sending') {
    body = (
      <p
        role="status"
        className="flex items-center gap-2.5 text-[16px] leading-normal font-medium">
        <Spinner size="small" decorative />
        {t(SENDING_KEYS[view.sending ?? 'answer'])}
      </p>
    );
  } else if (view.phase === 'issue' && view.issue === 'nothing-heard') {
    body = (
      <>
        <Banner tone="warning" role="alert">
          {t('mock.nothingHeardMessage')}
        </Banner>
        <Button
          onClick={() => controller.restartAnswer()}
          className="gap-2 self-start">
          <Icon name="mic" size={18} />
          {t('mock.answerAgainButton')}
        </Button>
      </>
    );
  } else if (view.phase === 'issue' && view.issue === 'send-failed') {
    body = (
      <>
        <Banner
          tone="danger"
          role="alert"
          action={
            <Button
              size="small"
              onClick={() => void controller.sendAgain()}
              className="gap-2">
              <Icon name="refresh" size={18} />
              {t('mock.sendAgainButton')}
            </Button>
          }>
          {t('mock.sendFailedMessage')}
        </Banner>
        <p className="text-sm leading-normal text-muted">
          {t('mock.sendFailedNote')}
        </p>
      </>
    );
  } else if (view.phase === 'issue' && view.issue === 'action-failed') {
    body = (
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button
            size="small"
            onClick={() => void controller.sendAgain()}
            className="gap-2">
            <Icon name="refresh" size={18} />
            {t('mock.tryAgainButton')}
          </Button>
        }>
        {t('mock.actionFailedMessage')}
      </Banner>
    );
  } else if (view.phase === 'issue' && view.issue === 'mic-lost') {
    body = (
      <>
        <Banner
          tone="danger"
          role="alert"
          action={
            <Button
              size="small"
              onClick={() => void controller.reconnect()}
              className="gap-2">
              <Icon name="refresh" size={18} />
              {t('mock.tryAgainButton')}
            </Button>
          }>
          {t('mock.micLostMessage')}
        </Banner>
        {controller.holdsAnswer() && (
          <Button
            variant="quiet"
            size="small"
            onClick={() => void controller.sendAgain()}
            className="self-start">
            {t('mock.sendKeptButton')}
          </Button>
        )}
        <p className="text-sm leading-normal text-muted">
          {t('mock.micLostNote')}
        </p>
      </>
    );
  } else if (view.phase === 'paused' && view.pausedDuring === 'answering') {
    body = (
      <p className="flex items-center gap-2.5 text-[16px] leading-normal font-bold text-muted">
        <Icon name="pause" size={20} />
        {t('mock.recordingPaused', { time: clockTime(elapsed) })}
      </p>
    );
  } else {
    body = (
      <p className="flex items-start gap-2.5 text-[15px] leading-normal text-muted">
        <span className="flex pt-0.5">
          <Icon name="micOff" size={20} />
        </span>
        <span className="min-w-0 flex-1">{t('mock.micOffText')}</span>
      </p>
    );
  }

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="mock-answer"
      className="gap-4 p-6">
      <h2
        id="mock-answer"
        className="font-display text-[18px] leading-tight font-semibold">
        {t('mock.answerTitle')}
      </h2>
      {body}
    </Card>
  );
};

/** Paused: by the candidate, or because the tab was left; how to go on. */
export const PausedPanel: React.FC<{
  view: MockView;
  controller: MockInterviewController;
  /** The candidate pressed Pause, rather than leaving the tab. */
  byYou: boolean;
}> = ({ view, controller, byYou }) => {
  const { t } = useTranslation();
  const during = view.pausedDuring;
  const kept =
    during === 'answering'
      ? t('mock.pausedKept', { time: clockTime(controller.recordedMs()) })
      : '';
  return (
    <MockPanel
      icon="pause"
      title={t('mock.pausedTitle')}
      actions={
        during === 'answering' ? (
          <>
            <Button
              size="small"
              onClick={() => void controller.continueAnswering()}
              className="gap-2">
              <Icon name="mic" size={18} />
              {t('mock.continueAnsweringButton')}
            </Button>
            <Button
              variant="quiet"
              size="small"
              onClick={() => void controller.answerAgainFromPause()}
              className="gap-2">
              <Icon name="refresh" size={18} />
              {t('mock.restartAnswerButton')}
            </Button>
          </>
        ) : (
          <Button
            size="small"
            onClick={() => void controller.hearAgain()}
            className="gap-2">
            <Icon name="play" size={18} />
            {t('mock.hearAgainButton')}
          </Button>
        )
      }>
      <p>
        {byYou
          ? t('mock.pausedByYouText', { kept })
          : t('mock.pausedTabText', { kept })}
      </p>
    </MockPanel>
  );
};
