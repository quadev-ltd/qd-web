// Dictating a practice answer (D102, research doc 25 §4; Web-X7-Dictating, -Dictated and
// -Dictation-States, doc 13 §31): "Dictate" under the answer; "Listening · 0:42" with "Stop and
// add" and "Cancel", the warning at 2:30 and the stop at 3:00; "Turning what you said into text…";
// then "Added n words…" with Undo. The recording is kept until its text comes back, so "Try again"
// sends it again. The microphone's states, nothing heard and today's limit show where the button
// was. The answer's box is read-only, and "Get feedback" off, while it records and while the text
// is on its way.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import RecordingLevel from '@/components/RecordingLevel';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import { clockTime, useTicking } from '@/core/audio/clock';
import { blobToBase64, type Recording } from '@/core/audio/recording';
import { type RecorderPhase, useRecorder } from '@/core/audio/useRecorder';
import {
  DICTATION_MAX_MS,
  DICTATION_WARN_MS,
  type DictationCursor,
  insertDictation,
} from '@/core/profile/dictation';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useDictationLeft } from '@/core/profile/usePractice';
import { useSessionUser } from '@/core/session/hooks';

/** What dictation did last, once the microphone is let go. */
type DictationStep =
  | { step: 'idle' }
  | { step: 'turning' }
  /**
   * `before` is the answer as it was, and `cursor` where the cursor was, for Undo; `range` where the
   * words are now.
   */
  | {
      step: 'added';
      words: number;
      atEnd: boolean;
      before: string;
      cursor: DictationCursor | null;
      range: DictationCursor;
    }
  | { step: 'nothingHeard' }
  | { step: 'failed'; recording: Recording }
  | { step: 'limit' };

/** What shows under the answer: the recorder's phase while it has one, else the step. */
export type DictationView =
  Exclude<RecorderPhase, 'idle'> | DictationStep['step'];

export interface DictationOptions {
  turnId: string;
  /** The answer now. */
  text: string;
  /** Puts the words in the answer, or puts it back as it was (Undo). */
  onText: (text: string) => void;
  /** Where the cursor was last left in the answer; `null` if it never was. */
  cursorRef: React.RefObject<DictationCursor | null>;
  /** The turn was removed meanwhile: the page reads it again. */
  onGone: () => void;
}

/**
 * Dictation for one answer: its view, its actions, and how many dictations are in the answer
 * (Undo takes one back), sent with it for `practice.turn.answered`.
 */
export const useDictation = ({
  turnId,
  text,
  onText,
  cursorRef,
  onGone,
}: DictationOptions) => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { left, counted } = useDictationLeft();
  const [state, setState] = useState<DictationStep>({ step: 'idle' });
  const [kept, setKept] = useState(0);
  // The answer as the text arrives: the box is read-only meanwhile, so it is the one shown.
  const answer = useRef(text);
  useEffect(() => {
    answer.current = text;
  });
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const send = useCallback(
    async (recording: Recording) => {
      setState({ step: 'turning' });
      try {
        const base64 = await blobToBase64(recording.blob);
        const heard = await gateway.dictatePracticeAnswer({
          turnId,
          audio: { mimeType: recording.mimeType, base64 },
          durationMs: recording.durationMs,
        });
        if (!live.current) {
          return;
        }
        counted();
        if (!heard.text.trim()) {
          setState({ step: 'nothingHeard' });
          return;
        }
        const before = answer.current;
        const at = cursorRef.current;
        const inserted = insertDictation(before, heard.text, at);
        onText(inserted.text);
        cursorRef.current = { start: inserted.cursor, end: inserted.cursor };
        setKept(count => count + 1);
        setState({
          step: 'added',
          words: heard.words,
          atEnd: inserted.atEnd,
          before,
          cursor: at,
          range: {
            start: inserted.cursor - heard.text.length,
            end: inserted.cursor,
          },
        });
      } catch (error) {
        logProfileError('dictatePracticeAnswer', error, uid);
        if (!live.current) {
          return;
        }
        counted();
        switch (getProfileErrorCode(error)) {
          case ProfileErrorCode.MockNothingHeard:
            setState({ step: 'nothingHeard' });
            break;
          case ProfileErrorCode.DailyLimit:
            setState({ step: 'limit' });
            break;
          case ProfileErrorCode.NotFound:
            setState({ step: 'idle' });
            onGone();
            break;
          default:
            // The model twice, the network: the same recording can be sent again.
            setState({ step: 'failed', recording });
        }
      }
    },
    [counted, cursorRef, gateway, onGone, onText, turnId, uid],
  );

  const finish = useRef<() => void>(() => undefined);
  const recorder = useRecorder({
    maxMs: DICTATION_MAX_MS,
    onEnd: () => finish.current(),
  });

  /** "Stop and add", and the stop at 3:00 or when the microphone is lost. */
  const stop = useCallback(async () => {
    const recording = await recorder.stop();
    if (!recording) {
      return;
    }
    if (recording.blob.size === 0) {
      setState({ step: 'nothingHeard' });
      return;
    }
    await send(recording);
  }, [recorder, send]);
  useEffect(() => {
    finish.current = () => void stop();
  });

  const limited = state.step === 'limit' || (left !== null && left.left === 0);
  let view: DictationView;
  if (recorder.phase !== 'idle') {
    view = recorder.phase;
  } else if (
    limited &&
    (state.step === 'idle' || state.step === 'nothingHeard')
  ) {
    // The last of the day's dictations still shows what it added, with Undo.
    view = 'limit';
  } else {
    view = state.step;
  }

  return {
    view,
    /** Today's dictations are used: "Dictate" is off. */
    limited,
    /** The words just added, for "Added n words…". */
    added: state.step === 'added' ? state : null,
    /** The answer can't be changed or sent: it is recording, or the text is on its way. */
    busy: view === 'recording' || view === 'turning',
    /** How many dictations are in the answer. */
    kept,
    elapsedMs: recorder.elapsedMs,
    start: () => {
      setState(current =>
        current.step === 'limit' ? current : { step: 'idle' },
      );
      void recorder.start();
    },
    stop: () => void stop(),
    cancel: recorder.cancel,
    tryAgain: () => {
      if (state.step === 'failed') {
        void send(state.recording);
      }
    },
    discard: () => setState({ step: 'idle' }),
    undo: () => {
      if (state.step === 'added') {
        onText(state.before);
        cursorRef.current = state.cursor;
        setKept(count => Math.max(0, count - 1));
        setState({ step: 'idle' });
      }
    },
    /** The candidate typed: "Added n words…" and "nothing heard" go, and Undo with them. */
    typed: () => {
      if (state.step === 'added' || state.step === 'nothingHeard') {
        setState({ step: 'idle' });
      }
    },
  };
};

export type Dictation = ReturnType<typeof useDictation>;

/**
 * Scrolls the answer's box to the words just added, which the line asks the candidate to check: their
 * first line at least, and all of them when they fit. A text box can't say where a character is, so
 * its height up to each end of the words is measured with its text cut there, then put back. The
 * cursor goes after them, for the next dictation.
 */
export const scrollToWords = (
  box: HTMLTextAreaElement,
  { start, end }: DictationCursor,
) => {
  const text = box.value;
  const heightTo = (at: number) => {
    box.value = text.slice(0, at);
    return box.scrollHeight;
  };
  const toStart = heightTo(start);
  const toEnd = heightTo(end);
  box.value = text;
  box.setSelectionRange(end, end);
  const style = getComputedStyle(box);
  const padding =
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0);
  const line = parseFloat(style.lineHeight) || 24;
  // The words' first line at the top, or their end at the bottom, whichever is higher.
  box.scrollTop = Math.max(
    0,
    Math.min(toEnd - box.clientHeight, toStart - padding - line),
  );
};

/** The tinted box of "Listening", "Turning it into text" and "The browser asks". */
const DictationBox: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="flex flex-col gap-2.5 rounded-[14px] bg-tint px-4 py-3.5">
    {children}
  </div>
);

/** "Dictate", with the line beside it. */
const DictateRow: React.FC<{
  onPress?: () => void;
  disabled?: boolean;
  note?: string;
}> = ({ onPress, disabled = false, note }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        size="small"
        onClick={onPress}
        disabled={disabled}
        className="gap-2">
        <Icon name="mic" size={18} />
        {t('practice.dictateButton')}
      </Button>
      {note && (
        <p className="min-w-0 flex-[1_1_240px] text-sm leading-normal text-muted">
          {note}
        </p>
      )}
    </div>
  );
};

/** What sits under the answer's box: "Dictate", or what dictation is doing. */
export const DictationArea: React.FC<{
  dictation: Dictation;
  /** The answer is being read for feedback: "Dictate" is off. */
  disabled: boolean;
}> = ({ dictation, disabled }) => {
  const { t } = useTranslation();
  const { view } = dictation;
  const area = useRef<HTMLDivElement>(null);
  useTicking(view === 'recording');

  // The press's button goes as the view changes, so the focus moves with it: to "Stop and add"
  // while recording, then to the first thing to press once it is over.
  const previous = useRef(view);
  useEffect(() => {
    const was = previous.current;
    previous.current = view;
    if (was === view) {
      return;
    }
    if (view === 'recording' || was === 'recording' || was === 'turning') {
      area.current
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus();
    }
  }, [view]);

  const tryAgainMic = (message: string) => (
    <>
      <Banner tone="danger" role="alert">
        {message}
      </Banner>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="small"
          onClick={dictation.start}
          className="gap-2">
          <Icon name="refresh" size={18} />
          {t('practice.retryButton')}
        </Button>
        <p className="text-sm leading-normal text-muted">
          {t('practice.dictationStillType')}
        </p>
      </div>
    </>
  );

  const limit = (
    <>
      <Banner tone="warning" role="alert">
        {t('practice.dictationLimitMessage', { time: dailyLimitResetTime() })}
      </Banner>
      <DictateRow disabled />
    </>
  );

  let body: React.ReactNode;
  switch (view) {
    case 'asking':
      body = (
        <DictationBox>
          <p
            role="status"
            className="flex items-center gap-2.5 text-[15px] leading-normal">
            <Spinner size="small" decorative />
            <span className="min-w-0 flex-1">{t('mock.micAskingText')}</span>
          </p>
        </DictationBox>
      );
      break;
    case 'refused':
      body = tryAgainMic(t('practice.dictationRefusedMessage'));
      break;
    case 'missing':
      body = tryAgainMic(t('practice.dictationMissingMessage'));
      break;
    case 'unsupported':
      body = (
        <DictateRow disabled note={t('practice.dictationUnsupportedNote')} />
      );
      break;
    case 'recording': {
      const elapsed = dictation.elapsedMs();
      body = (
        <DictationBox>
          <p className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden="true"
              className="size-3 flex-none rounded-full bg-danger"
            />
            <span className="text-[16px] leading-normal font-bold text-danger">
              {t('practice.dictationListening', { time: clockTime(elapsed) })}
            </span>
            <RecordingLevel />
          </p>
          {elapsed >= DICTATION_WARN_MS && (
            <Banner tone="warning" role="alert">
              {t('practice.dictationWarnMessage')}
            </Banner>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="small" onClick={dictation.stop} className="gap-2">
              <Icon name="stop" size={18} />
              {t('practice.dictationStopButton')}
            </Button>
            <Button variant="quiet" size="small" onClick={dictation.cancel}>
              {t('practice.cancelButton')}
            </Button>
          </div>
          <p className="text-sm leading-normal text-muted">
            {t('practice.dictationListeningNote')}
          </p>
        </DictationBox>
      );
      break;
    }
    case 'turning':
      body = (
        <DictationBox>
          <p
            role="status"
            className="flex items-center gap-2.5 text-[16px] leading-normal font-medium">
            <Spinner size="small" decorative />
            {t('practice.dictationTurning')}
          </p>
        </DictationBox>
      );
      break;
    case 'added':
      body = (
        <>
          {dictation.added && (
            <Banner
              tone="success"
              action={
                <Button variant="quiet" size="small" onClick={dictation.undo}>
                  {t('practice.undoButton')}
                </Button>
              }>
              {t(
                dictation.added.atEnd
                  ? 'practice.dictationAddedEnd'
                  : 'practice.dictationAddedCursor',
                { count: dictation.added.words },
              )}
            </Banner>
          )}
          {dictation.limited ? (
            limit
          ) : (
            <DictateRow
              onPress={dictation.start}
              disabled={disabled}
              note={t('practice.dictateNote')}
            />
          )}
        </>
      );
      break;
    case 'nothingHeard':
      body = (
        <>
          <Banner tone="warning" role="alert">
            {t('practice.dictationNothingHeardMessage')}
          </Banner>
          <DictateRow onPress={dictation.start} disabled={disabled} />
        </>
      );
      break;
    case 'failed':
      body = (
        <>
          <Banner tone="danger" role="alert">
            {t('practice.dictationFailedMessage')}
          </Banner>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="small" onClick={dictation.tryAgain} className="gap-2">
              <Icon name="refresh" size={18} />
              {t('practice.retryButton')}
            </Button>
            <Button variant="quiet" size="small" onClick={dictation.discard}>
              {t('practice.discardButton')}
            </Button>
          </div>
        </>
      );
      break;
    case 'limit':
      body = limit;
      break;
    case 'idle':
      body = (
        <DictateRow
          onPress={dictation.start}
          disabled={disabled}
          note={t('practice.dictateNote')}
        />
      );
      break;
  }

  return (
    <div
      ref={area}
      className={`flex flex-col ${view === 'added' ? 'gap-3' : 'gap-2.5'}`}>
      {body}
    </div>
  );
};
