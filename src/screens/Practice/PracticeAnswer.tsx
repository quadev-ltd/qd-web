// Answering a question practised and its feedback (X7, D94 slice 3, research doc 13 §30): the
// answer, typed or dictated (D102, doc 13 §31), with "Get feedback" (a model call, 5 to 15
// seconds), the tries to pick from, the answer of the try chosen with its feedback in six parts,
// never on tone or confidence (FR-14), and "Answer again" up to 5 tries, then "Start again with new
// key points".
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Dialog from '@/components/ui/Dialog';
import { type DictationCursor } from '@/core/profile/dictation';
import { getProfileErrorCode, ProfileErrorCode } from '@/core/profile/errors';
import {
  PRACTICE_ANSWER_MAX_CHARS,
  PRACTICE_ATTEMPTS_MAX,
  type PracticeAttempt,
} from '@/core/profile/practice';
import {
  DictationArea,
  scrollToWords,
  useDictation,
} from '@/screens/Practice/Dictation';
import FeedbackSections from '@/screens/Practice/FeedbackSections';
import {
  type PracticeFailure,
  PracticeFailureBanner,
  practiceFailureOf,
} from '@/screens/Practice/practiceFailure';

/** Why an answer was refused: the start's failures, or the turn's 5 tries used. */
export const answerFailureOf = (error: unknown): PracticeFailure | 'tries' =>
  getProfileErrorCode(error) === ProfileErrorCode.MaxPracticeAttempts
    ? 'tries'
    : practiceFailureOf(error);

/** "25 Oct, 10:42", in the browser's time zone. */
const TRY_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "38 of 40 practice calls left today", once read. */
const CallsLeft: React.FC<{ left: { left: number; max: number } | null }> = ({
  left,
}) => {
  const { t } = useTranslation();
  return left ? (
    <p className="text-sm leading-normal text-muted">
      {t('practice.callsLeft', left)}
    </p>
  ) : null;
};

const NotTone: React.FC = () => {
  const { t } = useTranslation();
  return (
    <p className="text-sm leading-normal text-muted">
      {t('practice.notToneNote')}
    </p>
  );
};

export interface AnswerCardProps {
  turnId: string;
  /** What the field starts with: the answer being read, or one whose feedback failed. */
  initial: string;
  /** The answer is being read: the field is read-only and the button says so. */
  busy: boolean;
  left: { left: number; max: number } | null;
  failure: PracticeFailure | null;
  /** The answer, with how many dictations went into it. */
  onSubmit: (answer: string, dictations: number) => void;
  /** "Answer again" can be closed; the first answer can't. */
  onCancel?: () => void;
  /** The turn was removed while dictating: the page reads it again. */
  onGone: () => void;
}

/** "Leave while dictating?": what was said so far isn't added. */
const LeaveDictatingDialog: React.FC<{
  onStay: () => void;
  onLeave: () => void;
}> = ({ onStay, onLeave }) => {
  const { t } = useTranslation();
  return (
    <Dialog
      title={t('practice.dictationLeaveTitle')}
      icon="alert"
      onClose={onStay}>
      <p className="text-[16px] leading-normal text-muted">
        {t('practice.dictationLeaveText')}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onStay} className="flex-[1_1_140px]">
          {t('mock.stayButton')}
        </Button>
        <Button
          variant="secondary"
          onClick={onLeave}
          className="flex-[1_1_140px]">
          {t('mock.leaveButton')}
        </Button>
      </div>
    </Dialog>
  );
};

/**
 * "Your answer", typed or dictated, with "Get feedback", the calls left and what the feedback is
 * on.
 */
export const AnswerCard: React.FC<AnswerCardProps> = ({
  turnId,
  initial,
  busy,
  left,
  failure,
  onSubmit,
  onCancel,
  onGone,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const field = useRef<HTMLDivElement>(null);
  // Where the cursor was last left in the answer: dictated words go there.
  const cursor = useRef<DictationCursor | null>(null);
  const dictation = useDictation({
    turnId,
    text,
    onText: setText,
    cursorRef: cursor,
    onGone,
  });
  const locked = busy || dictation.busy;
  const trimmed = text.trim();
  const tooLong = trimmed.length > PRACTICE_ANSWER_MAX_CHARS;
  const noneLeft = left?.left === 0;

  // "Answer again" opens on the field, at the end of what it holds.
  useEffect(() => {
    if (onCancel) {
      const box = field.current?.querySelector('textarea');
      box?.focus();
      box?.setSelectionRange(box.value.length, box.value.length);
    }
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The words just added are scrolled into view, at any width.
  const added = dictation.added;
  useEffect(() => {
    const box = field.current?.querySelector('textarea');
    if (added && box) {
      scrollToWords(box, added.range);
    }
  }, [added]);

  // Leaving while it records asks first, and then adds nothing.
  const recording = dictation.view === 'recording';
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      recording && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!recording) {
      return undefined;
    }
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [recording]);

  return (
    <Card elevation="raised" className="gap-4 p-5">
      <div ref={field}>
        <FormTextArea
          name="answer"
          rows={9}
          label={t('practice.answerField')}
          hint={t('practice.answerHint')}
          placeholder={
            dictation.view === 'unsupported'
              ? t('practice.answerHint')
              : t('practice.answerPlaceholder')
          }
          value={text}
          onChange={event => {
            setText(event.target.value);
            dictation.typed();
          }}
          onSelect={event => {
            cursor.current = {
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            };
          }}
          readOnly={locked}
          counter={{ length: trimmed.length, max: PRACTICE_ANSWER_MAX_CHARS }}
          error={
            tooLong
              ? { type: 'maxLength', message: t('practice.answerLengthError') }
              : undefined
          }
        />
      </div>
      <DictationArea dictation={dictation} disabled={busy} />
      {failure && (
        <PracticeFailureBanner failure={failure} max={left?.max} of="answer" />
      )}
      {noneLeft && !busy && failure !== 'limit' && (
        <PracticeFailureBanner failure="limit" max={left.max} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="small"
          onClick={() => onSubmit(trimmed, dictation.kept)}
          disabled={locked || !trimmed || tooLong || noneLeft}
          aria-busy={busy}
          className="gap-2">
          {busy && <Spinner size="small" decorative />}
          {busy
            ? t('practice.gettingFeedbackButton')
            : t('practice.feedbackButton')}
        </Button>
        {onCancel && !locked && (
          <Button variant="secondary" size="small" onClick={onCancel}>
            {t('practice.cancelButton')}
          </Button>
        )}
        {!busy && <CallsLeft left={left} />}
      </div>
      {busy ? (
        <p role="status" className="text-sm leading-normal text-muted">
          {t('practice.gettingFeedbackNote')}
        </p>
      ) : (
        <NotTone />
      )}
      {blocker.state === 'blocked' && (
        <LeaveDictatingDialog
          onStay={() => blocker.reset()}
          onLeave={() => {
            dictation.cancel();
            blocker.proceed();
          }}
        />
      )}
    </Card>
  );
};

/** From 2 tries: "Try 1 · Try 2 · …", the one shown chosen. */
export const TriesPicker: React.FC<{
  count: number;
  /** 0-based. */
  shown: number;
  onShow: (index: number) => void;
}> = ({ count, shown, onShow }) => {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('practice.triesLabel')}
      className="flex flex-wrap gap-2">
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          aria-pressed={index === shown}
          onClick={() => onShow(index)}
          className="flex min-h-11 cursor-pointer items-center rounded-full border border-border-strong bg-surface px-3.5 text-[15px] leading-natural font-medium text-text hover:bg-tint aria-pressed:border-primary aria-pressed:bg-tint aria-pressed:text-primary">
          {t('practice.tryButton', { number: index + 1 })}
        </button>
      ))}
    </div>
  );
};

/** The answer of one try, read-only, with its number and time. */
export const YourAnswerCard: React.FC<{
  attempt: PracticeAttempt;
  number: number;
}> = ({ attempt, number }) => {
  const { t } = useTranslation();
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="practice-your-answer"
      className="gap-3 p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2
          id="practice-your-answer"
          className="min-w-0 flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('practice.yourAnswerTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {attempt.at === null
            ? t('practice.tryNumber', { number })
            : t('practice.tryMeta', {
                number,
                time: TRY_TIME.format(attempt.at),
              })}
        </p>
      </div>
      <p className="text-[15px] leading-normal whitespace-pre-line wrap-anywhere">
        {attempt.answer}
      </p>
    </Card>
  );
};

export interface FeedbackCardProps {
  attempt: PracticeAttempt;
  number: number;
  /** All the turn's tries: "Answer again" until PRACTICE_ATTEMPTS_MAX. */
  tries: number;
  left: { left: number; max: number } | null;
  /** "Answer again", unless the field is open already. */
  onAnswerAgain?: () => void;
  /** Once the tries are used: "Start again with new key points", when it can. */
  restart?: {
    starting: boolean;
    disabled: boolean;
    failure: PracticeFailure | null;
    onRestart: () => void;
  };
}

/** The feedback on one try, in the sections it has: an empty one is left out. */
export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  attempt,
  number,
  tries,
  left,
  onAnswerAgain,
  restart,
}) => {
  const { t } = useTranslation();
  const { feedback } = attempt;
  const used = tries >= PRACTICE_ATTEMPTS_MAX;
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="practice-feedback"
      className="gap-3.5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="practice-feedback"
          className="min-w-0 flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('practice.feedbackTitle')}
        </h2>
        <Chip tone="neutral">
          {t('practice.tryOfChip', { number, max: PRACTICE_ATTEMPTS_MAX })}
        </Chip>
      </div>
      <FeedbackSections feedback={feedback} />
      {used ? (
        <div className="flex flex-col gap-3 border-t border-border-faint pt-3.5">
          <p className="text-[15px] leading-normal">
            {t('practice.triesUsedMessage', { max: PRACTICE_ATTEMPTS_MAX })}
          </p>
          {restart?.failure && (
            <PracticeFailureBanner failure={restart.failure} max={left?.max} />
          )}
          {restart && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="small"
                onClick={restart.onRestart}
                disabled={restart.starting || restart.disabled}
                aria-busy={restart.starting}
                className="gap-2">
                {restart.starting ? (
                  <Spinner size="small" decorative />
                ) : (
                  <Icon name="refresh" size={18} />
                )}
                {restart.starting
                  ? t('practice.startingButton')
                  : t('practice.restartButton')}
              </Button>
              {!restart.starting && <CallsLeft left={left} />}
            </div>
          )}
        </div>
      ) : (
        onAnswerAgain && (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="small" onClick={onAnswerAgain} className="gap-2">
              <Icon name="refresh" size={18} />
              {t('practice.answerAgainButton')}
            </Button>
            <CallsLeft left={left} />
          </div>
        )
      )}
      <NotTone />
    </Card>
  );
};
