// "Write this letter again" (Web-L2-Again, D98): what the candidate asks of the letter, filled in
// with what was asked before and the quick change chosen, to change before writing; the quick
// changes as chips that add or take out their line; then "Write again", a new letter that keeps
// the answers and the edited sentences, and leaves out what was removed. Or, from the draft card,
// the candidate's draft changed and written again ("Change it and write again").
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Banner from '@/components/ui/Banner';
import SidePanel from '@/components/ui/SidePanel';
import {
  COVER_LETTER_ASKED_MAX_CHARS,
  COVER_LETTER_DRAFT_MAX_CHARS,
  COVER_LETTERS_MAX,
  type CoverLetter,
} from '@/core/profile/coverLetters';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { applicationLetterPath } from '@/core/profile/paths';
import {
  useCoverLetters,
  useLettersLeft,
} from '@/core/profile/useCoverLetters';
import { useSessionUser } from '@/core/session/hooks';
import SubmitFooter from '@/screens/Applications/SubmitFooter';

/** A quick change: its chip, and the line it adds to what is asked. */
export interface QuickChange {
  label: string;
  line: string;
}

/** The quick changes of a letter: shorter, more formal, warmer, and leading with the job's first need. */
export const useQuickChanges = (letter: CoverLetter): QuickChange[] => {
  const { t } = useTranslation();
  const first = letter.plan?.requirements[0];
  return [
    { label: t('letters.quickShorter'), line: t('letters.quickShorterLine') },
    { label: t('letters.quickFormal'), line: t('letters.quickFormalLine') },
    { label: t('letters.quickWarmer'), line: t('letters.quickWarmerLine') },
    ...(first
      ? [
          {
            label: t('letters.quickLeadWith', { requirement: first }),
            line: t('letters.quickLeadWithLine', { requirement: first }),
          },
        ]
      : []),
  ];
};

/** What is asked with a line added, on a line of its own. */
export const withLine = (asked: string, line: string) => {
  const kept = asked.replace(/\s+$/, '');
  return kept ? `${kept}\n${line}` : line;
};

/** What is asked with a line taken out. */
const withoutLine = (asked: string, line: string) =>
  asked
    .split('\n')
    .filter(own => own.trim() !== line)
    .join('\n');

export interface RewriteLetterPanelProps {
  letter: CoverLetter;
  /** The quick change chosen, already in the box. */
  chosen?: QuickChange;
  /** From the draft card: the draft is what changes. */
  draft?: boolean;
  onClose: () => void;
}

export const RewriteLetterPanel: React.FC<RewriteLetterPanelProps> = ({
  letter,
  chosen,
  draft = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uid = useSessionUser()?.uid;
  const { rewrite } = useCoverLetters(letter.applicationId);
  const { left, reread } = useLettersLeft();
  const changes = useQuickChanges(letter);
  const [text, setText] = useState(() =>
    draft
      ? (letter.draft?.text ?? '')
      : chosen
        ? withLine(letter.asked ?? '', chosen.line)
        : (letter.asked ?? ''),
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [limitRefused, setLimitRefused] = useState(false);
  const length = text.trim().length;
  const max = draft
    ? COVER_LETTER_DRAFT_MAX_CHARS
    : COVER_LETTER_ASKED_MAX_CHARS;
  const limitReached = left?.left === 0 || limitRefused;
  const blocked = limitReached || length > max || (draft && length === 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (blocked) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      const written = await rewrite(
        letter.id,
        draft ? { draft: text.trim() } : { asked: text.trim() },
      );
      navigate(applicationLetterPath(letter.applicationId, written));
    } catch (error) {
      logProfileError('rewriteCoverLetter', error, uid);
      switch (getProfileErrorCode(error)) {
        case ProfileErrorCode.DailyLimit:
          setLimitRefused(true);
          break;
        case ProfileErrorCode.MaxLetters:
          setErrorMessage(t('letters.maxMessage', { max: COVER_LETTERS_MAX }));
          break;
        default:
          setErrorMessage(t('letters.rewriteFailedMessage'));
      }
      reread();
      setIsBusy(false);
    }
  };

  return (
    <SidePanel
      title={draft ? t('letters.draftAgainTitle') : t('letters.againTitle')}
      description={[letter.job.role, letter.job.company]
        .filter(Boolean)
        .join(' · ')}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
        {limitReached && (
          <Banner>
            {t('letters.limitMessage', {
              max: left?.max ?? 10,
              time: dailyLimitResetTime(),
            })}
          </Banner>
        )}
        <FormTextArea
          name={draft ? 'draft' : 'asked'}
          rows={draft ? 10 : 4}
          label={draft ? t('letters.draftField') : t('letters.askedTitle')}
          hint={
            draft
              ? t('letters.draftAgainHint')
              : chosen
                ? t('letters.againChosenHint', { change: chosen.label })
                : t('letters.againHint')
          }
          value={text}
          onChange={event => setText(event.target.value)}
          disabled={isBusy}
          counter={{ length, max }}
        />
        {!draft && (
          <div className="flex flex-wrap gap-2">
            {changes.map(change => {
              const on = text
                .split('\n')
                .some(line => line.trim() === change.line);
              return (
                <button
                  key={change.label}
                  type="button"
                  aria-pressed={on}
                  disabled={isBusy}
                  onClick={() =>
                    setText(
                      on
                        ? withoutLine(text, change.line)
                        : withLine(text, change.line),
                    )
                  }
                  className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 text-[15px] leading-natural font-medium text-text hover:bg-tint disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-primary aria-pressed:bg-tint aria-pressed:text-primary">
                  {on && <Icon name="check" size={16} />}
                  {change.label}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-sm leading-normal text-muted">
          {draft ? t('letters.draftAgainText') : t('letters.againText')}
        </p>
        <SubmitFooter
          errorMessage={errorMessage}
          isBusy={isBusy}
          blocked={blocked}
          label={t('letters.writeAgainButton')}
          busyLabel={t('letters.startingButton')}
        />
        <p className="-mt-2 text-center text-sm leading-normal text-muted">
          {left === null
            ? t('letters.takesMinuteOnly')
            : left.left === 0
              ? t('letters.takesMinuteNone')
              : t('letters.takesMinute', left)}
        </p>
      </form>
    </SidePanel>
  );
};

export default RewriteLetterPanel;
