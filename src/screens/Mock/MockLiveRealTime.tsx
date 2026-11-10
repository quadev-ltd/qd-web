// A mock interview in real time as it runs (Web-X6-RT-Speaking, -RT-Listening, -RT-States; D100,
// doc 24 §16): the interviewer's card (speaking, with "Stop and answer now"; your turn, with "Say
// it differently" and Skip; thinking), the answer's card (the microphone on while it speaks;
// "Listening" with its level, the last words heard and "I'm done"; how long the answer was), the
// connection's panels (reconnecting, couldn't reconnect, open in another tab) and the paused panel.
// The progress line, the hints and the end are way 1's.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import {
  type LiveInterviewController,
  type LiveView,
} from '@/core/mock/LiveInterviewController';
import { clockTime, Level, useTicking } from '@/screens/Mock/MockLive';
import { MockPanel } from '@/screens/Mock/mockParts';

const STATUS = {
  speaking: { key: 'mock.statusSpeaking', tone: 'brand', icon: 'wave' },
  listening: { key: 'mock.statusYourTurn', tone: 'success', icon: 'mic' },
  thinking: { key: 'mock.statusThinking', tone: 'neutral', icon: undefined },
  paused: { key: 'mock.statusPaused', tone: 'neutral', icon: 'pause' },
} as const;

/** What the interviewer is doing, and the question asked. */
export const RealTimeInterviewerCard: React.FC<{
  view: LiveView;
  controller: LiveInterviewController;
}> = ({ view, controller }) => {
  const { t } = useTranslation();
  const line =
    view.phase === 'speaking'
      ? (view.speaking ?? view.question)
      : view.question;
  const status = STATUS[view.phase as keyof typeof STATUS];
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
      {view.phase === 'thinking' ? (
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
        line &&
        (line.text ? (
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
        ) : view.cutOffLine === line.lineId ? (
          // The voice model cut off within its first word: no words came.
          <p className="text-[15px] leading-normal text-muted">
            {t('mock.liveCutOffText')}
          </p>
        ) : (
          // The voice model writes its words once it has said them.
          <div className="flex flex-col gap-2">
            <Level />
            <p className="text-[15px] leading-normal text-muted">
              {t('mock.liveWordsComeText')}
            </p>
          </div>
        ))
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
      {view.phase === 'listening' && (
        <div className="flex flex-col gap-0.5">
          <div className="-ml-1.5 flex flex-wrap gap-1">
            <Button
              variant="quiet"
              size="small"
              onClick={() => controller.sayDifferently()}
              disabled={view.rephrased}
              className="gap-2">
              <Icon name="edit" size={18} />
              {t('mock.sayDifferentlyButton')}
            </Button>
            <Button
              variant="quiet"
              size="small"
              onClick={() => controller.skip()}
              className="gap-2">
              <Icon name="skip" size={18} />
              {t('mock.skipButton')}
            </Button>
          </div>
          <p className="text-sm leading-normal text-muted">
            {t('mock.liveRephraseNote')}
          </p>
        </div>
      )}
    </Card>
  );
};

const BARS = [8, 14, 22, 12, 26, 18, 10, 20, 28, 16, 9, 18];

/** The microphone's level as it is heard, drawn every frame without re-rendering the page. */
const LiveLevel: React.FC<{ level: () => number }> = ({ level }) => {
  const meter = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      // Speech is quiet as RMS goes: a tenth is loud.
      meter.current?.style.setProperty(
        '--level',
        String(Math.min(1, level() * 10)),
      );
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [level]);
  return (
    <span
      ref={meter}
      aria-hidden="true"
      className="flex h-8 items-center gap-1">
      {BARS.map((height, index) => (
        <span
          key={index}
          className="w-1 rounded-[2px] bg-primary"
          style={{
            height: `calc(4px + ${height - 4}px * var(--level, 0))`,
          }}
        />
      ))}
    </span>
  );
};

/** "Your answer": the microphone on, listening, or how long the answer was. */
export const RealTimeAnswerCard: React.FC<{
  view: LiveView;
  controller: LiveInterviewController;
}> = ({ view, controller }) => {
  const { t } = useTranslation();
  const listening = view.phase === 'listening';
  useTicking(listening);

  let body: React.ReactNode;
  if (listening) {
    body = (
      <>
        <p className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="size-3 flex-none rounded-full bg-danger"
          />
          <span className="text-[16px] leading-normal font-bold text-danger">
            {t('mock.listening', { time: clockTime(controller.listeningMs()) })}
          </span>
          <LiveLevel level={controller.level} />
        </p>
        {view.nothingHeard && !view.heard ? (
          <Banner tone="warning" role="alert">
            {t('mock.liveNothingHeardMessage')}
          </Banner>
        ) : (
          view.heard && (
            // What was heard, in one line from the label: a line too long loses its start, not its
            // end ("…" on the left, as the right-to-left box clips). Not read out while it changes.
            <p className="flex items-baseline gap-2.5 rounded-xl bg-tint px-3 py-2.5">
              <span className="flex-none text-[13px] leading-normal font-bold tracking-[0.04em] text-muted uppercase">
                {t('mock.heardLabel')}
              </span>
              <span
                dir="rtl"
                className="min-w-0 flex-1 overflow-hidden text-left text-[15px] leading-normal text-ellipsis whitespace-nowrap">
                <span dir="ltr">{view.heard}</span>
              </span>
            </p>
          )
        )}
        {view.answerTimeWarn && (
          <Banner tone="warning" role="alert">
            {t('mock.liveWarnMessage')}
          </Banner>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => controller.done()}
            className="flex-[1_1_200px] gap-2">
            <Icon name="check" size={18} />
            {t('mock.doneButton')}
          </Button>
        </div>
        <p className="text-sm leading-normal text-muted">
          {/* The voice model may take a long pause as the end (doc 24 §16). */}
          {view.way === 'voice-model'
            ? t('mock.liveVoiceModelDoneNote')
            : t('mock.liveDoneNote')}
        </p>
      </>
    );
  } else if (view.phase === 'thinking' && view.answerEndedMs !== undefined) {
    body = (
      <p className="text-[15px] leading-normal text-muted">
        {t('mock.liveAnswerEnded', { time: clockTime(view.answerEndedMs) })}
      </p>
    );
  } else {
    body = (
      <p className="flex items-start gap-2.5 text-[15px] leading-normal text-muted">
        <span className="flex pt-0.5 text-primary">
          <Icon name="mic" size={20} />
        </span>
        <span className="min-w-0 flex-1">{t('mock.liveMicOnText')}</span>
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

/** The connection: reconnecting, couldn't reconnect, or taken over in another tab. */
export const RealTimeConnectionPanel: React.FC<{
  view: LiveView;
  controller: LiveInterviewController;
  /** "End the interview": asks first when an answer is being given. */
  onEnd: () => void;
}> = ({ view, controller, onEnd }) => {
  const { t } = useTranslation();
  const end = (
    <Button variant="quiet" size="small" onClick={onEnd}>
      {t('mock.endConfirmButton')}
    </Button>
  );
  switch (view.phase) {
    case 'reconnecting':
      return (
        <MockPanel
          tone="warning"
          lead={<Spinner decorative />}
          title={t('mock.reconnectingTitle')}>
          <p>{t('mock.reconnectingText')}</p>
        </MockPanel>
      );
    case 'disconnected':
      return (
        <MockPanel
          tone="danger"
          icon="alert"
          role="alert"
          title={t('mock.disconnectedTitle')}
          actions={
            <>
              <Button
                size="small"
                onClick={() => void controller.reconnect()}
                className="gap-2">
                <Icon name="refresh" size={18} />
                {t('mock.tryAgainButton')}
              </Button>
              {end}
            </>
          }>
          <p>{t('mock.disconnectedText')}</p>
        </MockPanel>
      );
    case 'replaced':
      return (
        <MockPanel
          tone="warning"
          icon="alert"
          role="alert"
          title={t('mock.replacedTitle')}
          actions={
            <>
              <Button size="small" onClick={() => void controller.reconnect()}>
                {t('mock.continueHereButton')}
              </Button>
              {end}
            </>
          }>
          <p>{t('mock.replacedText')}</p>
        </MockPanel>
      );
    default:
      return null;
  }
};

/** Paused (Web-X6-RT-States): back, the interviewer asks the question again and the answer starts over. */
export const RealTimePausedPanel: React.FC<{
  controller: LiveInterviewController;
  /** The candidate pressed Pause, rather than leaving the tab. */
  byYou: boolean;
}> = ({ controller, byYou }) => {
  const { t } = useTranslation();
  return (
    <MockPanel
      icon="pause"
      title={t('mock.pausedTitle')}
      actions={
        <Button
          size="small"
          onClick={() => controller.hearAgain()}
          className="gap-2">
          <Icon name="play" size={18} />
          {t('mock.hearAgainButton')}
        </Button>
      }>
      <p>
        {byYou ? t('mock.livePausedByYouText') : t('mock.livePausedTabText')}
      </p>
    </MockPanel>
  );
};
