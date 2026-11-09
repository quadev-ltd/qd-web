// Answering a question practised and its feedback (X7, D94 slice 3, research doc 13 §30): the
// typed answer with "Get feedback" (a model call, 5 to 15 seconds), the tries to pick from, the
// answer of the try chosen with its feedback in six parts, never on tone or confidence (FR-14),
// and "Answer again" up to 5 tries, then "Start again with new key points".
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import FormTextArea from '@/components/FormTextArea';
import Icon, { type IconName } from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { getProfileErrorCode, ProfileErrorCode } from '@/core/profile/errors';
import {
  PRACTICE_ANSWER_MAX_CHARS,
  PRACTICE_ATTEMPTS_MAX,
  type PracticeAttempt,
} from '@/core/profile/practice';
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
  /** What the field starts with: the answer being read, or one whose feedback failed. */
  initial: string;
  /** The answer is being read: the field is read-only and the button says so. */
  busy: boolean;
  left: { left: number; max: number } | null;
  failure: PracticeFailure | null;
  onSubmit: (answer: string) => void;
  /** "Answer again" can be closed; the first answer can't. */
  onCancel?: () => void;
}

/** "Your answer" with "Get feedback", the calls left and what the feedback is on. */
export const AnswerCard: React.FC<AnswerCardProps> = ({
  initial,
  busy,
  left,
  failure,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const field = useRef<HTMLDivElement>(null);
  const trimmed = text.trim();
  const tooLong = trimmed.length > PRACTICE_ANSWER_MAX_CHARS;
  const noneLeft = left?.left === 0;

  // "Answer again" opens on the field.
  useEffect(() => {
    if (onCancel) {
      field.current?.querySelector('textarea')?.focus();
    }
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card elevation="raised" className="gap-4 p-5">
      <div ref={field}>
        <FormTextArea
          name="answer"
          rows={9}
          label={t('practice.answerField')}
          hint={t('practice.answerHint')}
          value={text}
          onChange={event => setText(event.target.value)}
          readOnly={busy}
          counter={{ length: trimmed.length, max: PRACTICE_ANSWER_MAX_CHARS }}
          error={
            tooLong
              ? { type: 'maxLength', message: t('practice.answerLengthError') }
              : undefined
          }
        />
      </div>
      {failure && (
        <PracticeFailureBanner failure={failure} max={left?.max} of="answer" />
      )}
      {noneLeft && !busy && failure !== 'limit' && (
        <PracticeFailureBanner failure="limit" max={left.max} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="small"
          onClick={() => onSubmit(trimmed)}
          disabled={busy || !trimmed || tooLong || noneLeft}
          aria-busy={busy}
          className="gap-2">
          {busy && <Spinner size="small" decorative />}
          {busy
            ? t('practice.gettingFeedbackButton')
            : t('practice.feedbackButton')}
        </Button>
        {onCancel && !busy && (
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

const TONES = {
  covered: { icon: 'check', className: 'text-success' },
  missing: { icon: 'alert', className: 'text-warning' },
  tip: { icon: 'bulb', className: 'text-primary' },
} as const satisfies Record<string, { icon: IconName; className: string }>;

const FeedbackList: React.FC<{
  items: string[];
  tone: keyof typeof TONES;
}> = ({ items, tone }) => (
  <ul className="flex flex-col gap-2.5">
    {items.map((item, index) => (
      <li key={`${index}-${item}`} className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`flex pt-0.5 ${TONES[tone].className}`}>
          <Icon name={TONES[tone].icon} size={18} />
        </span>
        <span className="min-w-0 flex-1 text-[15px] leading-normal wrap-anywhere">
          {item}
        </span>
      </li>
    ))}
  </ul>
);

const FeedbackSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="flex flex-col gap-2 border-t border-border-faint pt-3.5">
    <h3 className="text-sm leading-normal font-bold tracking-[0.04em] text-muted uppercase">
      {title}
    </h3>
    {children}
  </section>
);

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
      {feedback.covered.length > 0 && (
        <FeedbackSection title={t('practice.coveredTitle')}>
          <FeedbackList items={feedback.covered} tone="covered" />
        </FeedbackSection>
      )}
      {feedback.missing.length > 0 && (
        <FeedbackSection title={t('practice.missingTitle')}>
          <FeedbackList items={feedback.missing} tone="missing" />
        </FeedbackSection>
      )}
      {feedback.structure && (
        <FeedbackSection title={t('practice.structureTitle')}>
          <p className="text-[15px] leading-normal wrap-anywhere">
            {feedback.structure}
          </p>
        </FeedbackSection>
      )}
      {feedback.clarity && (
        <FeedbackSection title={t('practice.clarityTitle')}>
          <p className="text-[15px] leading-normal wrap-anywhere">
            {feedback.clarity}
          </p>
        </FeedbackSection>
      )}
      {feedback.suggestions.length > 0 && (
        <FeedbackSection title={t('practice.suggestionsTitle')}>
          <FeedbackList items={feedback.suggestions} tone="tip" />
        </FeedbackSection>
      )}
      {feedback.example && (
        <FeedbackSection title={t('practice.exampleTitle')}>
          <p className="text-[15px] leading-normal whitespace-pre-line wrap-anywhere">
            {feedback.example}
          </p>
          <p className="text-sm leading-normal text-muted">
            {t('practice.exampleNote')}
          </p>
        </FeedbackSection>
      )}
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
