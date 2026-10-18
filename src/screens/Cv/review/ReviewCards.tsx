// The cards of the review (C3, doc 13 §16.4, §17.3, §19): "What we found", "Not in your CV or
// profile", each change with "Accept", "Edit" and "Keep mine", and each question with "Use my
// answer" and "Skip". The same words on every change (D75).
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from './CvDocument';
import { type CvReview } from './useCvReview';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip, { type ChipProps } from '@/components/ui/Chip';
import {
  type ProfileResource,
  type SkillMapItem,
} from '@/core/profile/contract';
import {
  CV_FINDING_SEVERITIES,
  CV_LINE_MAX_CHARS,
  type CvChange,
  type CvFinding,
  type CvQuestion,
} from '@/core/profile/cvVersions';

/** The findings shown before "Show all". */
const FINDINGS_SHOWN = 3;

const SEVERITY_CHIPS = {
  high: { tone: 'danger', icon: 'alert' },
  medium: { tone: 'warning', icon: undefined },
  low: { tone: 'neutral', icon: undefined },
} as const satisfies Record<
  CvFinding['severity'],
  { tone: ChipProps['tone']; icon: ChipProps['icon'] }
>;

const ACTION_CHIPS = {
  rewrite: 'brand',
  add: 'info',
  remove: 'danger',
} as const satisfies Record<CvChange['action'], ChipProps['tone']>;

/** "What we found": the analysis, the most serious first, three shown, then "Show all". */
export const FindingsCard: React.FC<{ findings: CvFinding[] }> = ({
  findings,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const [all, setAll] = useState(false);
  if (findings.length === 0) {
    return null;
  }
  const ordered = [...findings].sort(
    (a, b) =>
      CV_FINDING_SEVERITIES.indexOf(a.severity) -
      CV_FINDING_SEVERITIES.indexOf(b.severity),
  );
  const tally = CV_FINDING_SEVERITIES.flatMap(severity => {
    const count = findings.filter(f => f.severity === severity).length;
    return count ? [t(`cv.severityCount_${severity}`, { count })] : [];
  }).join(' · ');
  const shown = all ? ordered : ordered.slice(0, FINDINGS_SHOWN);
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={titleId}
      className="gap-1 p-5">
      <h2
        id={titleId}
        className="font-display text-[18px] leading-tight font-semibold">
        {t('cv.findingsTitle')}
      </h2>
      <p className="text-sm leading-normal text-muted">
        {findings.length === 1
          ? t('cv.findingsSummaryOne', { tally })
          : t('cv.findingsSummary', { count: findings.length, tally })}
      </p>
      <ul className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-x-5">
        {shown.map((finding, index) => (
          <li
            key={index}
            className="flex flex-col gap-2 border-t border-border-faint py-3.5">
            <span className="flex flex-wrap items-center gap-2">
              <Chip {...SEVERITY_CHIPS[finding.severity]}>
                {t(`cv.severity_${finding.severity}`)}
              </Chip>
              <span className="text-[13px] leading-normal font-medium text-muted">
                {t(`cv.findingKind_${finding.kind}`)}
              </span>
            </span>
            <p className="text-[15px] leading-normal">{finding.text}</p>
            {finding.passage && (
              <blockquote className="rounded-[12px] bg-background px-3 py-2.5 text-sm leading-normal">
                {finding.passage}
              </blockquote>
            )}
          </li>
        ))}
      </ul>
      {findings.length > FINDINGS_SHOWN && (
        <Button
          variant="quiet"
          size="small"
          aria-expanded={all}
          onClick={() => setAll(open => !open)}
          className="self-start">
          {all
            ? t('cv.showFewerFindings')
            : t('cv.showAllFindings', { count: findings.length })}
        </Button>
      )}
    </Card>
  );
};

/** "Not in your CV or profile": the job's words the CV and the profile don't show. */
export const TermsCard: React.FC<{ terms: string[] }> = ({ terms }) => {
  const { t } = useTranslation();
  const titleId = useId();
  if (terms.length === 0) {
    return null;
  }
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={titleId}
      className="gap-2.5 p-5">
      <h2
        id={titleId}
        className="font-display text-[18px] leading-tight font-semibold">
        {t('cv.termsTitle')}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {terms.map(term => (
          <li key={term}>
            <Chip tone="warning" icon="alert">
              {term}
            </Chip>
          </li>
        ))}
      </ul>
      <p className="text-sm leading-normal text-muted">{t('cv.termsText')}</p>
    </Card>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[13px] leading-normal font-medium tracking-[0.02em] text-muted">
    {children}
  </span>
);

/** "Based on": the CV itself, or an item of the profile with where it says it. */
const Source: React.FC<{
  source: CvChange['sources'][number];
  cvTitle: string;
  items: Map<string, SkillMapItem> | null;
  resources: ProfileResource[];
}> = ({ source, cvTitle, items, resources }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (source.kind === 'cv') {
    return (
      <p className="flex items-center gap-2.5 rounded-[12px] border border-border-faint bg-background px-3 py-2.5 text-sm leading-normal">
        <span className="flex text-primary">
          <Icon name="file" size={16} />
        </span>
        {t('cv.sourceCv', { title: cvTitle })}
      </p>
    );
  }
  const item = items?.get(source.itemId);
  if (!item) {
    return (
      <p className="rounded-[12px] border border-border-faint bg-background px-3 py-2.5 text-sm leading-normal text-muted">
        {items ? t('cv.sourceItemGone') : <Spinner size="tiny" />}
      </p>
    );
  }
  const from =
    resources.find(({ id }) => id === item.resourceId)?.title ??
    t('cv.removedCv');
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[12px] border border-border-faint bg-background px-3 py-2 text-left text-sm leading-normal text-text">
        <span className="flex text-primary">
          <Icon name="file" size={16} />
        </span>
        <span className="min-w-0 flex-1">
          {t('cv.sourceItem', {
            kind: t(`cv.itemKind_${item.kind}`),
            title: from,
          })}
        </span>
        <Icon name={open ? 'up' : 'down'} size={16} />
      </button>
      {open && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] leading-normal font-medium text-muted">
            {t('cv.whereItSays')}
          </span>
          <blockquote className="border-l-[3px] border-primary pl-3 text-sm leading-normal">
            {item.evidence}
          </blockquote>
        </div>
      )}
    </div>
  );
};

export interface ChangeCardProps {
  change: CvChange;
  number: number;
  /** Its details and actions are shown. */
  open: boolean;
  onToggle: () => void;
  review: CvReview;
  cvTitle: string;
  items: Map<string, SkillMapItem> | null;
  resources: ProfileResource[];
}

/** One change: closed, a line to open; open, what it changes, why, its sources and the actions. */
export const ChangeCard: React.FC<ChangeCardProps> = ({
  change,
  number,
  open,
  onToggle,
  review,
  cvTitle,
  items,
  resources,
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [wording, setWording] = useState(change.text ?? change.proposed);
  const busy = review.busy === change.id;
  const trimmed = wording.trim();
  const tone = change.action === 'remove' ? 'danger' : 'brand';
  const head = (
    <span className="flex flex-wrap items-center gap-2">
      <Badge label={String(number)} tone={tone} />
      <Chip tone={ACTION_CHIPS[change.action]}>
        {t(`cv.action_${change.action}`)}
      </Chip>
      {change.decision !== 'open' && (
        <span className="text-[13px] leading-normal text-muted">
          {t(`cv.decision_${change.decision}`)}
        </span>
      )}
    </span>
  );
  const summary =
    change.action === 'remove'
      ? change.original
      : change.decision === 'edited'
        ? (change.text ?? change.proposed)
        : change.proposed;

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-2.5 rounded-[16px] border border-border-faint bg-surface px-4 py-3.5 text-left text-text">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          {head}
          <span
            className={`line-clamp-2 text-[15px] leading-normal ${change.action === 'remove' ? 'text-muted line-through' : ''}`}>
            {summary}
          </span>
        </span>
        <span className="flex pt-0.5 text-muted">
          <Icon name="down" size={18} />
        </span>
      </button>
    );
  }

  const act = async (
    decision: 'accept' | 'edit' | 'keep' | 'reopen',
    text?: string,
  ) => {
    if (await review.decide(change.id, decision, text)) {
      setEditing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 rounded-[16px] border-2 border-primary bg-surface p-4 shadow-card">
      <button
        type="button"
        aria-expanded
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-2.5 text-left text-text">
        <span className="min-w-0 flex-1">{head}</span>
        <Icon name="up" size={18} />
      </button>
      {change.action !== 'add' && (
        <div className="flex flex-col gap-1">
          <Label>{t('cv.yourLine')}</Label>
          <p className="text-[15px] leading-normal text-muted line-through">
            {change.original}
          </p>
        </div>
      )}
      {change.action !== 'remove' && !editing && (
        <div className="flex flex-col gap-1">
          <Label>
            {t(change.action === 'add' ? 'cv.newLine' : 'cv.suggested')}
          </Label>
          <p className="text-base leading-normal font-medium">{summary}</p>
        </div>
      )}
      {editing && (
        <FormTextArea
          name={`wording-${change.id}`}
          label={t('cv.yourWording')}
          hint={t('cv.wordingHint')}
          value={wording}
          onChange={event => setWording(event.target.value)}
          disabled={busy}
          counter={{ length: trimmed.length, max: CV_LINE_MAX_CHARS }}
        />
      )}
      {change.reason && (
        <div className="flex flex-col gap-1">
          <Label>{t('cv.why')}</Label>
          <p className="text-[15px] leading-normal">{change.reason}</p>
        </div>
      )}
      {change.sources.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>{t('cv.basedOn')}</Label>
          {change.sources.map((source, index) => (
            <Source
              key={index}
              source={source}
              cvTitle={cvTitle}
              items={items}
              resources={resources}
            />
          ))}
        </div>
      )}
      {review.failed === change.id && (
        <Banner tone="danger" role="alert">
          {t('cv.decideFailedMessage')}
        </Banner>
      )}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              size="small"
              disabled={busy || !trimmed || trimmed.length > CV_LINE_MAX_CHARS}
              aria-busy={busy}
              onClick={() => act('edit', trimmed)}
              className="gap-2">
              {busy ? (
                <Spinner size="small" decorative />
              ) : (
                <Icon name="check" size={18} />
              )}
              {t('cv.saveWordingButton')}
            </Button>
            <Button
              variant="quiet"
              size="small"
              disabled={busy}
              onClick={() => setEditing(false)}>
              {t('cv.cancelEditButton')}
            </Button>
          </>
        ) : change.decision === 'open' ? (
          <>
            <Button
              size="small"
              disabled={busy}
              aria-busy={busy}
              onClick={() => act('accept')}
              className="gap-2">
              {busy ? (
                <Spinner size="small" decorative />
              ) : (
                <Icon name="check" size={18} />
              )}
              {t('cv.acceptButton')}
            </Button>
            {change.action !== 'remove' && (
              <Button
                variant="secondary"
                size="small"
                disabled={busy}
                onClick={() => setEditing(true)}
                className="gap-2">
                <Icon name="edit" size={18} />
                {t('cv.editButton')}
              </Button>
            )}
            <Button
              variant="quiet"
              size="small"
              disabled={busy}
              onClick={() => act('keep')}>
              {t('cv.keepButton')}
            </Button>
          </>
        ) : (
          <Button
            variant="quiet"
            size="small"
            disabled={busy}
            aria-busy={busy}
            onClick={() => act('reopen')}>
            {t('cv.changeDecisionButton')}
          </Button>
        )}
      </div>
    </div>
  );
};

export interface QuestionCardProps {
  question: CvQuestion;
  number: number;
  open: boolean;
  onToggle: () => void;
  review: CvReview;
}

/** One question: what we need to know, about which line, and the candidate's answer. */
export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  number,
  open,
  onToggle,
  review,
}) => {
  const { t } = useTranslation();
  const [answering, setAnswering] = useState(question.status === 'open');
  const [answer, setAnswer] = useState(question.answer ?? '');
  const busy = review.busy === question.id;
  const trimmed = answer.trim();
  const head = (
    <span className="flex flex-wrap items-center gap-2">
      <Badge label={`?${number}`} tone="info" />
      <Chip icon="help">{t('cv.questionChip')}</Chip>
      {question.status !== 'open' && (
        <span className="text-[13px] leading-normal text-muted">
          {t(`cv.questionStatus_${question.status}`)}
        </span>
      )}
    </span>
  );

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-2.5 rounded-[16px] border border-border-faint bg-surface px-4 py-3.5 text-left text-text">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          {head}
          <span className="text-[15px] leading-normal font-medium">
            {question.text}
          </span>
        </span>
        <span className="flex pt-0.5 text-muted">
          <Icon name="down" size={18} />
        </span>
      </button>
    );
  }

  const send = async (words?: string) => {
    if (await review.answer(question.id, words)) {
      setAnswering(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 rounded-[16px] border-2 border-chip-text bg-surface p-4 shadow-card">
      <button
        type="button"
        aria-expanded
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-2.5 text-left text-text">
        <span className="min-w-0 flex-1">{head}</span>
        <Icon name="up" size={18} />
      </button>
      <h3 className="font-display text-[18px] leading-tight font-semibold">
        {question.text}
      </h3>
      {question.passage && (
        <div className="flex flex-col gap-1">
          <Label>{t('cv.aboutLine')}</Label>
          <blockquote className="rounded-[12px] bg-background px-3 py-2.5 text-sm leading-normal">
            {question.passage}
          </blockquote>
        </div>
      )}
      {answering ? (
        <FormTextArea
          name={`answer-${question.id}`}
          label={t('cv.yourAnswer')}
          placeholder={t('cv.answerPlaceholder')}
          hint={t('cv.answerHint')}
          value={answer}
          onChange={event => setAnswer(event.target.value)}
          disabled={busy}
          counter={{ length: trimmed.length, max: CV_LINE_MAX_CHARS }}
        />
      ) : (
        question.answer && (
          <div className="flex flex-col gap-1">
            <Label>{t('cv.yourAnswer')}</Label>
            <p className="text-[15px] leading-normal">{question.answer}</p>
          </div>
        )
      )}
      {review.failed === question.id && (
        <Banner tone="danger" role="alert">
          {t('cv.decideFailedMessage')}
        </Banner>
      )}
      <div className="flex flex-wrap gap-2">
        {answering ? (
          <>
            <Button
              size="small"
              disabled={busy || !trimmed || trimmed.length > CV_LINE_MAX_CHARS}
              aria-busy={busy}
              onClick={() => send(trimmed)}
              className="gap-2">
              {busy && <Spinner size="small" decorative />}
              {t('cv.useAnswerButton')}
            </Button>
            <Button
              variant="quiet"
              size="small"
              disabled={busy}
              onClick={() => send()}>
              {t('cv.skipButton')}
            </Button>
          </>
        ) : (
          <Button
            variant="quiet"
            size="small"
            onClick={() => setAnswering(true)}>
            {t('cv.changeAnswerButton')}
          </Button>
        )}
      </div>
    </div>
  );
};
