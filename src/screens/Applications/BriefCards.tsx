// The two halves of a brief (A3, A4): what the job asks for, with the profile items that show
// it or the gap it leaves, and the questions an interviewer is likely to ask, with notes.
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import {
  type BriefQuestion,
  type BriefRequirement,
} from '@/core/profile/applications';
import {
  type ProfileResource,
  type SkillMapItem,
  type SkillMapKind,
} from '@/core/profile/contract';

/** Requirements listed before "Show all". */
export const REQUIREMENTS_SHOWN = 6;
/** Questions listed before "Show all". */
export const QUESTIONS_SHOWN = 4;

const ITEM_KIND_KEYS = {
  skill: 'applications.kindSkill',
  experience: 'applications.kindExperience',
  project: 'applications.kindProject',
  achievement: 'applications.kindAchievement',
  story: 'applications.kindStory',
  education: 'applications.kindEducation',
  certification: 'applications.kindCertification',
  language: 'applications.kindLanguage',
} as const satisfies Record<SkillMapKind, string>;

const QUESTION_KIND_KEYS = {
  behavioural: 'applications.questionBehavioural',
  technical: 'applications.questionTechnical',
  role: 'applications.questionRole',
  motivation: 'applications.questionMotivation',
} as const satisfies Record<BriefQuestion['kind'], string>;

/** What the brief knows of the profile: its items, and the resources they came from. */
export interface ProfileLookup {
  /** `null` while the items are being read. */
  items: Map<string, SkillMapItem> | null;
  resources: ProfileResource[];
}

/** An item the brief names, as text with where it came from. One that is gone is left out. */
const ItemRef: React.FC<{
  item: SkillMapItem;
  resources: ProfileResource[];
}> = ({ item, resources }) => {
  const { t } = useTranslation();
  const source = resources.find(({ id }) => id === item.resourceId);
  return (
    <li className="flex flex-col gap-1 border-border-faint py-2.5 not-first:border-t">
      <p className="text-[15px] leading-normal wrap-anywhere">{item.text}</p>
      <p className="flex items-center gap-1.5 text-[13px] leading-normal text-muted">
        <Icon name="file" size={14} />
        {source
          ? t('applications.itemSource', {
              kind: t(ITEM_KIND_KEYS[item.kind]),
              title: source.title,
            })
          : t(ITEM_KIND_KEYS[item.kind])}
      </p>
    </li>
  );
};

/** A row that opens in place on what it holds. */
const Opening: React.FC<{
  header: React.ReactNode;
  children: React.ReactNode;
}> = ({ header, children }) => {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return (
    <li className="border-border-faint not-first:border-t">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-start gap-3 py-3 text-left text-text">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">{header}</span>
        <span className="flex pt-1 text-muted">
          <Icon name={open ? 'up' : 'down'} size={18} />
        </span>
      </button>
      <div id={detailsId} hidden={!open} className="flex flex-col gap-3 pb-4">
        {children}
      </div>
    </li>
  );
};

const Passage: React.FC<{ label: string; text: string }> = ({
  label,
  text,
}) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-[13px] leading-normal font-medium text-muted">{label}</p>
    <blockquote className="rounded-control bg-background px-3.5 py-3 text-[15px] leading-normal wrap-anywhere">
      {text}
    </blockquote>
  </div>
);

const Requirement: React.FC<{
  requirement: BriefRequirement;
  lookup: ProfileLookup;
  onAddStory: () => void;
}> = ({ requirement, lookup, onAddStory }) => {
  const { t } = useTranslation();
  const gap = requirement.itemIds.length === 0;
  const shown = lookup.items
    ? requirement.itemIds.flatMap(id => {
        const item = lookup.items?.get(id);
        return item ? [item] : [];
      })
    : [];
  return (
    <Opening
      header={
        <>
          <span className="flex flex-wrap gap-2">
            {gap && (
              <Chip tone="warning" icon="alert">
                {t('applications.gapChip')}
              </Chip>
            )}
            <Chip
              tone={
                requirement.importance === 'required' ? 'brand' : 'neutral'
              }>
              {t(
                requirement.importance === 'required'
                  ? 'applications.requiredChip'
                  : 'applications.preferredChip',
              )}
            </Chip>
          </span>
          <span className="text-[16px] leading-normal font-medium wrap-anywhere">
            {requirement.text}
          </span>
          <span className="text-sm leading-normal text-muted">
            {gap
              ? t('applications.gapLine')
              : t('applications.shownLine', {
                  count: requirement.itemIds.length,
                })}
          </span>
        </>
      }>
      {requirement.evidence && (
        <Passage
          label={t('applications.fromPosting')}
          text={requirement.evidence}
        />
      )}
      {gap ? (
        <>
          <p className="text-[15px] leading-normal">
            {t('applications.gapHelp')}
          </p>
          <Button
            variant="secondary"
            size="small"
            onClick={onAddStory}
            className="gap-2 self-start">
            <Icon name="plus" size={18} />
            {t('applications.addStoryButton')}
          </Button>
        </>
      ) : (
        shown.length > 0 && (
          <div className="flex flex-col">
            <p className="text-[13px] leading-normal font-medium text-muted">
              {t('applications.profileShows')}
            </p>
            <ul className="flex flex-col">
              {shown.map(item => (
                <ItemRef
                  key={item.id}
                  item={item}
                  resources={lookup.resources}
                />
              ))}
            </ul>
          </div>
        )
      )}
    </Opening>
  );
};

export const RequirementsCard: React.FC<{
  requirements: BriefRequirement[];
  lookup: ProfileLookup;
  onAddStory: () => void;
}> = ({ requirements, lookup, onAddStory }) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const headingId = useId();
  // The gaps first: they are what to prepare.
  const ordered = [
    ...requirements.filter(({ itemIds }) => itemIds.length === 0),
    ...requirements.filter(({ itemIds }) => itemIds.length > 0),
  ];
  const gaps = requirements.filter(
    ({ itemIds }) => itemIds.length === 0,
  ).length;
  const shown = showAll ? ordered : ordered.slice(0, REQUIREMENTS_SHOWN);
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={headingId}
      className="min-w-0 flex-[999_1_480px] gap-1 p-5">
      <div className="flex items-baseline gap-2">
        <h2
          id={headingId}
          className="flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('applications.requirementsTitle')}
        </h2>
        <p className="text-sm leading-normal font-medium text-muted">
          {requirements.length}
          {gaps > 0 && ` · ${t('applications.gapsCount', { count: gaps })}`}
        </p>
      </div>
      <ul className="flex flex-col">
        {shown.map((requirement, index) => (
          <Requirement
            // The brief is replaced as a whole: its order is its identity.
            key={`${index}-${requirement.text}`}
            requirement={requirement}
            lookup={lookup}
            onAddStory={onAddStory}
          />
        ))}
      </ul>
      {ordered.length > REQUIREMENTS_SHOWN && !showAll && (
        <Button
          variant="quiet"
          size="small"
          onClick={() => setShowAll(true)}
          className="self-start text-[15px]">
          {t('applications.showAllCountButton', { count: ordered.length })}
        </Button>
      )}
    </Card>
  );
};

const Question: React.FC<{
  question: BriefQuestion;
  lookup: ProfileLookup;
}> = ({ question, lookup }) => {
  const { t } = useTranslation();
  return (
    <Opening
      header={
        <>
          <span className="flex">
            <Chip tone="info">{t(QUESTION_KIND_KEYS[question.kind])}</Chip>
          </span>
          <span className="text-[16px] leading-normal font-medium wrap-anywhere">
            {question.text}
          </span>
        </>
      }>
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] leading-normal font-medium text-muted">
          {t('applications.answerNotesLabel')}
        </p>
        <ul className="flex list-disc flex-col gap-2.5 pl-5 marker:text-primary">
          {question.bullets.map((bullet, index) => {
            const item = bullet.itemId
              ? lookup.items?.get(bullet.itemId)
              : undefined;
            const source = item
              ? lookup.resources.find(({ id }) => id === item.resourceId)
              : undefined;
            return (
              <li key={`${index}-${bullet.text}`} className="pl-1">
                <p className="text-[15px] leading-normal wrap-anywhere">
                  {bullet.text}
                </p>
                {item ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-normal text-muted">
                    <Icon name="file" size={14} />
                    {source
                      ? t('applications.itemSource', {
                          kind: t(ITEM_KIND_KEYS[item.kind]),
                          title: source.title,
                        })
                      : t(ITEM_KIND_KEYS[item.kind])}
                  </p>
                ) : (
                  !bullet.itemId && (
                    <span className="mt-1 flex">
                      <Chip>{t('applications.adviceChip')}</Chip>
                    </span>
                  )
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Opening>
  );
};

export const QuestionsCard: React.FC<{
  questions: BriefQuestion[];
  lookup: ProfileLookup;
}> = ({ questions, lookup }) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const headingId = useId();
  const shown = showAll ? questions : questions.slice(0, QUESTIONS_SHOWN);
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={headingId}
      className="min-w-0 flex-[1_1_380px] gap-1 p-5">
      <div className="flex items-baseline gap-2">
        <h2
          id={headingId}
          className="flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('applications.questionsTitle')}
        </h2>
        <p className="text-sm leading-normal font-medium text-muted">
          {questions.length}
        </p>
      </div>
      <ul className="flex flex-col">
        {shown.map((question, index) => (
          <Question
            key={`${index}-${question.text}`}
            question={question}
            lookup={lookup}
          />
        ))}
      </ul>
      {questions.length > QUESTIONS_SHOWN && !showAll && (
        <Button
          variant="quiet"
          size="small"
          onClick={() => setShowAll(true)}
          className="self-start text-[15px]">
          {t('applications.showAllCountButton', { count: questions.length })}
        </Button>
      )}
    </Card>
  );
};
