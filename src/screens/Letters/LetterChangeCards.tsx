// Beside a ready letter, the ways to change it (D98, doc 22 §4.4, §4.5, §11.5):
// - "Change it quickly": each chip opens "Write this letter again" with its line in what is asked;
// - the questions: answered or skipped, then "Write again" with the answers;
// - "Your draft", for a letter improved from one, with "Change it and write again";
// - "Your version", for a letter the candidate saved as they wrote it: "Improve my version", and
//   "Restore the written letter", which replaces their version.
import { type TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { type QuickChange, useQuickChanges } from './RewriteLetterPanel';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import {
  COVER_LETTER_SENTENCE_MAX_CHARS,
  type CoverLetter,
  coverLetterBody,
  type CoverLetterQuestion,
} from '@/core/profile/coverLetters';
import { logProfileError } from '@/core/profile/errors';
import { applicationLetterPath } from '@/core/profile/paths';
import {
  useCoverLetters,
  useLettersLeft,
} from '@/core/profile/useCoverLetters';
import { useSessionUser } from '@/core/session/hooks';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** "Uses 1 of today's 10": what writing again spends. */
const usesOne = (t: TFunction, max?: number) =>
  t('letters.usesOneOf', { max: max ?? 10 });

export const QuickChangesCard: React.FC<{
  letter: CoverLetter;
  onChoose: (change: QuickChange) => void;
}> = ({ letter, onChoose }) => {
  const { t } = useTranslation();
  const changes = useQuickChanges(letter);
  const { left } = useLettersLeft();
  const headingId = useId();
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={headingId}
      className="gap-3 p-5">
      <div className="flex flex-col gap-0.5">
        <h2
          id={headingId}
          className="font-display text-[18px] leading-tight font-semibold">
          {t('letters.quickTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t('letters.quickText')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {changes.map(change => (
          <button
            key={change.label}
            type="button"
            disabled={left?.left === 0}
            onClick={() => onChoose(change)}
            className="flex h-11 cursor-pointer items-center rounded-full border border-border-strong bg-surface px-3.5 text-[15px] leading-natural font-medium text-text hover:bg-tint disabled:cursor-not-allowed disabled:opacity-60">
            {change.label}
          </button>
        ))}
      </div>
      <p className="text-[13px] leading-normal text-muted">
        {t('letters.quickNote', { usesOne: usesOne(t, left?.max) })}
      </p>
    </Card>
  );
};

const Question: React.FC<{
  number: number;
  question: CoverLetterQuestion;
  onAnswer: (answer?: string) => Promise<void>;
}> = ({ number, question, onAnswer }) => {
  const { t } = useTranslation();
  const uid = useSessionUser()?.uid;
  const [editing, setEditing] = useState(question.status === 'open');
  const [text, setText] = useState(question.answer ?? '');
  const [busy, setBusy] = useState<'save' | 'skip'>();
  const [failed, setFailed] = useState(false);
  const length = text.trim().length;

  const answer = async (words?: string) => {
    setBusy(words ? 'save' : 'skip');
    setFailed(false);
    try {
      await onAnswer(words);
      setEditing(false);
    } catch (error) {
      logProfileError('answerCoverLetterQuestion', error, uid);
      setFailed(true);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <li className="flex flex-col gap-2.5 border-t border-border-faint pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={question.status === 'open' ? 'info' : 'neutral'}>
          {t('letters.questionNumber', { number })}
        </Chip>
        {question.status === 'answered' && (
          <Chip tone="success" icon="check">
            {t('letters.answeredChip')}
          </Chip>
        )}
        {question.status === 'skipped' && (
          <Chip tone="neutral">{t('letters.skippedChip')}</Chip>
        )}
      </div>
      <h3 className="text-[16px] leading-normal font-semibold wrap-anywhere">
        {question.text}
      </h3>
      {editing ? (
        <form
          noValidate
          onSubmit={event => {
            event.preventDefault();
            if (length > 0 && length <= COVER_LETTER_SENTENCE_MAX_CHARS) {
              answer(text.trim());
            }
          }}
          className="flex flex-col gap-2.5">
          <FormTextArea
            name={`answer-${question.id}`}
            rows={3}
            label={t('letters.answerField')}
            hint={t('letters.answerHint')}
            value={text}
            onChange={event => setText(event.target.value)}
            disabled={busy !== undefined}
            counter={{ length, max: COVER_LETTER_SENTENCE_MAX_CHARS }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="secondary"
              size="small"
              disabled={
                busy !== undefined ||
                length === 0 ||
                length > COVER_LETTER_SENTENCE_MAX_CHARS
              }
              aria-busy={busy === 'save'}
              className="gap-2">
              {busy === 'save' && <Spinner size="small" decorative />}
              {t('letters.saveAnswerButton')}
            </Button>
            {question.status === 'open' && (
              <Button
                variant="quiet"
                size="small"
                disabled={busy !== undefined}
                onClick={() => answer()}>
                {t('letters.skipButton')}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <>
          {question.answer && (
            <blockquote className="rounded-[12px] bg-tint px-3.5 py-3 text-[15px] leading-normal shadow-[inset_3px_0_0_var(--color-primary)] wrap-anywhere">
              {question.answer}
            </blockquote>
          )}
          <Button
            variant="quiet"
            size="small"
            onClick={() => setEditing(true)}
            className="-ml-1.5 gap-2 self-start text-[15px]">
            <Icon name="edit" size={18} />
            {question.answer
              ? t('letters.changeAnswerButton')
              : t('letters.answerItButton')}
          </Button>
        </>
      )}
      {failed && (
        <Banner tone="danger" role="alert">
          {t('letters.answerFailedMessage')}
        </Banner>
      )}
    </li>
  );
};

export const LetterQuestionsCard: React.FC<{ letter: CoverLetter }> = ({
  letter,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uid = useSessionUser()?.uid;
  const { answer, rewrite } = useCoverLetters(letter.applicationId);
  const { left, reread } = useLettersLeft();
  const [writing, setWriting] = useState(false);
  const [failed, setFailed] = useState(false);
  const headingId = useId();
  if (letter.questions.length === 0) {
    return null;
  }

  const writeAgain = async () => {
    setWriting(true);
    setFailed(false);
    try {
      const written = await rewrite(letter.id, {
        ...(letter.asked ? { asked: letter.asked } : {}),
      });
      navigate(applicationLetterPath(letter.applicationId, written));
    } catch (error) {
      logProfileError('rewriteCoverLetter', error, uid);
      setFailed(true);
      setWriting(false);
      reread();
    }
  };

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={headingId}
      className="gap-3 p-5">
      <div className="flex flex-col gap-0.5">
        <h2
          id={headingId}
          className="font-display text-[18px] leading-tight font-semibold">
          {t('letters.questionsTitle', { count: letter.questions.length })}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t('letters.questionsText')}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {letter.questions.map((question, index) => (
          <Question
            key={question.id}
            number={index + 1}
            question={question}
            onAnswer={words => answer(letter.id, question.id, words)}
          />
        ))}
      </ul>
      <div className="h-px bg-border-faint" />
      <Button
        variant="secondary"
        disabled={writing || left?.left === 0}
        aria-busy={writing}
        onClick={writeAgain}
        className="gap-2 self-start">
        {writing ? (
          <Spinner size="small" decorative />
        ) : (
          <Icon name="refresh" size={18} />
        )}
        {writing ? t('letters.startingButton') : t('letters.writeAgainButton')}
      </Button>
      <p className="text-sm leading-normal text-muted">
        {t('letters.questionsAgainText', { usesOne: usesOne(t, left?.max) })}
      </p>
      {failed && (
        <Banner tone="danger" role="alert">
          {t('letters.rewriteFailedMessage')}
        </Banner>
      )}
    </Card>
  );
};

export const DraftCard: React.FC<{
  letter: CoverLetter;
  onChange: () => void;
}> = ({ letter, onChange }) => {
  const { t } = useTranslation();
  const headingId = useId();
  if (!letter.draft) {
    return null;
  }
  const polished = letter.draft.mode === 'polish';
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={headingId}
      className="gap-2.5 p-5">
      <div className="flex items-center gap-2">
        <h2
          id={headingId}
          className="min-w-0 flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('letters.draftTitle')}
        </h2>
        <Chip tone="brand">
          {polished ? t('letters.polishedChip') : t('letters.rewrittenChip')}
        </Chip>
      </div>
      <blockquote className="rounded-[12px] bg-tint px-3.5 py-3 text-[15px] leading-normal whitespace-pre-wrap shadow-[inset_3px_0_0_var(--color-primary)] wrap-anywhere">
        {letter.draft.text}
      </blockquote>
      <p className="text-sm leading-normal text-muted">
        {polished ? t('letters.polishedText') : t('letters.rewrittenText')}
      </p>
      <Button
        variant="quiet"
        size="small"
        onClick={onChange}
        className="-ml-1.5 gap-2 self-start text-[15px]">
        <Icon name="edit" size={18} />
        {t('letters.changeDraftButton')}
      </Button>
    </Card>
  );
};

export const YourVersionCard: React.FC<{ letter: CoverLetter }> = ({
  letter,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uid = useSessionUser()?.uid;
  const { rewrite, restoreText } = useCoverLetters(letter.applicationId);
  const { left, reread } = useLettersLeft();
  const [busy, setBusy] = useState<'improve' | 'restore'>();
  const [failed, setFailed] = useState<'improve' | 'restore'>();
  const headingId = useId();

  const improve = async () => {
    setBusy('improve');
    setFailed(undefined);
    try {
      const written = await rewrite(letter.id, {
        draft: coverLetterBody(letter.paragraphs ?? []),
      });
      navigate(applicationLetterPath(letter.applicationId, written));
    } catch (error) {
      logProfileError('rewriteCoverLetter', error, uid);
      setFailed('improve');
      setBusy(undefined);
      reread();
    }
  };

  const restore = async () => {
    setBusy('restore');
    setFailed(undefined);
    try {
      await restoreText(letter.id);
    } catch (error) {
      logProfileError('restoreCoverLetterText', error, uid);
      setFailed('restore');
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={headingId}
      className="gap-2.5 p-5">
      <h2
        id={headingId}
        className="font-display text-[18px] leading-tight font-semibold">
        {t('letters.yourVersionTitle')}
      </h2>
      <p className="text-sm leading-normal text-muted">
        {t('letters.yourVersionText', {
          date: letter.savedAt ? formatDay(letter.savedAt) : '',
        })}
      </p>
      <Button
        variant="secondary"
        size="small"
        disabled={busy !== undefined || left?.left === 0}
        aria-busy={busy === 'improve'}
        onClick={improve}
        className="gap-2 self-start">
        {busy === 'improve' ? (
          <Spinner size="small" decorative />
        ) : (
          <Icon name="refresh" size={18} />
        )}
        {t('letters.improveVersionButton')}
      </Button>
      <p className="text-[13px] leading-normal text-muted">
        {t('letters.improveVersionText', { usesOne: usesOne(t, left?.max) })}
      </p>
      <div className="my-1 h-px bg-border-faint" />
      <Button
        variant="quiet"
        size="small"
        disabled={busy !== undefined}
        aria-busy={busy === 'restore'}
        onClick={restore}
        className="-ml-1.5 gap-2 self-start text-[15px]">
        {busy === 'restore' ? (
          <Spinner size="small" decorative />
        ) : (
          <Icon name="refresh" size={18} />
        )}
        {t('letters.restoreWrittenLetterButton')}
      </Button>
      <p className="text-[13px] leading-normal text-muted">
        {t('letters.restoreWrittenLetterText')}
      </p>
      {failed && (
        <Banner tone="danger" role="alert">
          {failed === 'improve'
            ? t('letters.rewriteFailedMessage')
            : t('letters.restoreFailedMessage')}
        </Banner>
      )}
    </Card>
  );
};
