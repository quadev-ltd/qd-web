// "What we did and why" (D98, doc 22 §4.3): above the letter, what the candidate asked for in their
// words with what was done with each request (D97), then the writer's notes; and for a letter
// written from a draft, "What we did with your draft" across the top, one line per change that
// matters (doc 22 §4.5): kept, changed and why, or not done and why.
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  type CoverLetter,
  type CoverLetterOutcome,
} from '@/core/profile/coverLetters';

/** Lines shown before "Show all". */
const SHOWN = 5;

const OUTCOME_MARKS = {
  done: { icon: 'check', className: 'text-success' },
  changed: { icon: 'alert', className: 'text-warning' },
  'not-done': { icon: 'x', className: 'text-danger' },
} as const;

const Outcomes: React.FC<{ outcomes: CoverLetterOutcome[] }> = ({
  outcomes,
}) => {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col gap-2.5">
      {outcomes.map(({ outcome, text }, index) => (
        <li key={`${index}-${text}`} className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className={`flex pt-0.5 ${OUTCOME_MARKS[outcome].className}`}>
            <Icon name={OUTCOME_MARKS[outcome].icon} size={18} />
          </span>
          <span className="min-w-0 flex-1 text-[15px] leading-normal">
            <span className="sr-only">{t(`cv.askedOutcome_${outcome}`)}: </span>
            {text}
          </span>
        </li>
      ))}
    </ul>
  );
};

/** "What we did with your draft": shown for a letter improved from the candidate's draft. */
export const DraftOutcomes: React.FC<{ letter: CoverLetter }> = ({
  letter,
}) => {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const headingId = useId();
  const outcomes = letter.outcomes.filter(({ about }) => about === 'draft');
  if (!letter.draft || outcomes.length === 0) {
    return null;
  }
  const shown = all ? outcomes : outcomes.slice(0, SHOWN);
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
          {t('letters.draftOutcomesTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t('letters.draftOutcomesCount', { count: outcomes.length })}
        </p>
      </div>
      <Outcomes outcomes={shown} />
      {!all && outcomes.length > SHOWN && (
        <Button
          variant="quiet"
          size="small"
          onClick={() => setAll(true)}
          className="self-start text-[15px]">
          {t('letters.showAll', { count: outcomes.length })}
        </Button>
      )}
    </Card>
  );
};

/** "What we did and why", closed at first, with what was asked first. */
export const LetterNotes: React.FC<{ letter: CoverLetter }> = ({ letter }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const asked = letter.outcomes.filter(({ about }) => about === 'asked');
  const count = letter.notes.length + asked.length;
  if (count === 0 && !letter.asked) {
    return null;
  }
  return (
    <Card as="section" elevation="raised" className="gap-0 p-0">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen(!open)}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-card px-5 py-4 text-left text-text">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-display text-[18px] leading-tight font-semibold">
              {t('letters.notesTitle')}
            </span>
            <span className="text-sm leading-normal font-normal text-muted">
              {asked.length > 0
                ? t('letters.notesCountAsked', {
                    count,
                    asked: asked.length,
                  })
                : t('letters.notesCount', { count })}
            </span>
          </span>
          <span className="flex text-muted">
            <Icon name={open ? 'up' : 'down'} size={18} />
          </span>
        </button>
      </h2>
      <div
        id={detailsId}
        hidden={!open}
        className="flex flex-wrap gap-x-8 gap-y-5 px-5 pb-5">
        {letter.asked && (
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h3 className="min-w-0 flex-1 text-sm leading-normal font-bold">
                {t('letters.askedTitle')}
              </h3>
              <span className="text-[13px] text-muted">
                {t('letters.yourWords')}
              </span>
            </div>
            <blockquote className="rounded-[12px] bg-tint px-3.5 py-3 text-[15px] leading-normal whitespace-pre-wrap shadow-[inset_3px_0_0_var(--color-primary)] wrap-anywhere">
              {letter.asked}
            </blockquote>
            {asked.length > 0 && <Outcomes outcomes={asked} />}
          </div>
        )}
        {letter.notes.length > 0 && (
          <ul className="flex min-w-0 flex-[1_1_360px] list-disc flex-col gap-2.5 pl-5 marker:text-primary">
            {letter.notes.map((note, index) => (
              <li
                key={`${index}-${note}`}
                className="pl-1 text-[15px] leading-normal">
                {note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default LetterNotes;
