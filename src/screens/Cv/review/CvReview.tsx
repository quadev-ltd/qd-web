// A version to review (C3, doc 13 §16.4, §17.3, §19): how far the review is, "What we found",
// the CV with each change marked beside the list of changes and questions ("To review",
// "Questions", "Done"), and once nothing is left, "Your version is ready" with "Did you send
// it?". At phone width a switch moves between the changes and the CV.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import DownloadButton from '../download/DownloadButton';

import CvDocument from './CvDocument';
import {
  ChangeCard,
  FindingsCard,
  QuestionCard,
  TermsCard,
} from './ReviewCards';
import SentCard from './SentCard';
import { useCvReview } from './useCvReview';
import useItems from './useItems';

import Icon from '@/components/Icon';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { type CvEditVersion, openReviews } from '@/core/profile/cvVersions';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';

type Tab = 'review' | 'questions' | 'done';

export interface CvReviewProps {
  version: CvEditVersion;
  /** The title of the CV it starts from. */
  cvTitle: string;
  /** What the downloaded file is called, without its extension. */
  fileTitle: string;
}

export const CvReview: React.FC<CvReviewProps> = ({
  version,
  cvTitle,
  fileTitle,
}) => {
  const { t } = useTranslation();
  const { resources } = useInterviewProfile();
  const review = useCvReview(version.id);
  const { changes, questions } = version;
  const open = openReviews(version);
  const total = changes.length + questions.length;
  const items = useItems(
    changes.some(({ sources }) => sources.some(({ kind }) => kind === 'item')),
  );
  const [tab, setTab] = useState<Tab>(open > 0 ? 'review' : 'done');
  const [view, setView] = useState<'changes' | 'cv'>('changes');
  const [marks, setMarks] = useState(true);
  const [opened, setOpened] = useState<string | undefined>(
    () => changes.find(({ decision }) => decision === 'open')?.id,
  );

  const toReview = changes.filter(({ decision }) => decision === 'open');
  const questionsOpen = questions.filter(({ status }) => status === 'open');
  const done = [
    ...changes.filter(({ decision }) => decision !== 'open'),
    ...questions.filter(({ status }) => status !== 'open'),
  ];
  const count = (decision: CvEditVersion['changes'][number]['decision']) =>
    changes.filter(change => change.decision === decision).length;

  const toggle = (id: string) =>
    setOpened(current => (current === id ? undefined : id));
  const changeCard = (change: CvEditVersion['changes'][number]) => (
    <ChangeCard
      key={change.id}
      change={change}
      number={changes.indexOf(change) + 1}
      open={opened === change.id}
      onToggle={() => toggle(change.id)}
      review={review}
      cvTitle={cvTitle}
      items={items}
      resources={resources}
    />
  );
  const questionCard = (question: CvEditVersion['questions'][number]) => (
    <QuestionCard
      key={question.id}
      question={question}
      number={questions.indexOf(question) + 1}
      open={opened === question.id}
      onToggle={() => toggle(question.id)}
      review={review}
    />
  );
  const list =
    tab === 'review'
      ? toReview.map(changeCard)
      : tab === 'questions'
        ? questionsOpen.map(questionCard)
        : done.map(entry =>
            'action' in entry ? changeCard(entry) : questionCard(entry),
          );
  const empty = (
    {
      review: 'cv.noneToReview',
      questions: 'cv.noQuestions',
      done: 'cv.noneDone',
    } as const
  )[tab];

  const sent = version.sentAt !== undefined && version.sentAt !== null;

  return (
    <div className="flex flex-col gap-5">
      {open > 0 ? (
        <Card elevation="raised" className="gap-2.5 p-4">
          <p className="text-[15px] leading-normal font-medium">
            {t('cv.reviewedProgress', { done: total - open, total })}
          </p>
          <ProgressBar
            label={t('cv.reviewedLabel')}
            value={total === 0 ? 1 : (total - open) / total}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-5">
          <Card
            as="section"
            elevation="raised"
            aria-labelledby="cv-ready"
            className="gap-3 p-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-full bg-success-tint text-success">
                <Icon name="check" size={20} />
              </span>
              <h2
                id="cv-ready"
                className="font-display text-[20px] leading-tight font-semibold">
                {t('cv.readyTitle')}
              </h2>
            </div>
            <p className="text-[15px] leading-normal text-muted">
              {t('cv.readySummary', {
                accepted: count('accepted'),
                edited: count('edited'),
                kept: count('kept'),
                answered: questions.filter(
                  ({ status }) => status === 'answered',
                ).length,
                skipped: questions.filter(({ status }) => status === 'skipped')
                  .length,
              })}
            </p>
            <DownloadButton version={version} fileTitle={fileTitle} />
          </Card>
          {version.target.kind === 'job' && (
            <SentCard sent={sent} review={review} />
          )}
        </div>
      )}
      <FindingsCard findings={version.findings} />
      <div className="md:hidden">
        <SegmentedControl
          label={t('cv.viewLabel')}
          options={[
            { value: 'changes', label: t('cv.viewChanges') },
            { value: 'cv', label: t('cv.viewCv') },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div
          className={`min-w-0 flex-[999_1_560px] flex-col gap-2.5 ${view === 'cv' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-sm leading-normal font-medium text-muted">
              {t(marks ? 'cv.docTitleMarked' : 'cv.yourCvTitle')}
            </span>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-medium">
              <input
                type="checkbox"
                role="switch"
                checked={marks}
                onChange={event => setMarks(event.target.checked)}
                className="size-[18px] accent-primary"
              />
              {t('cv.showChanges')}
            </label>
          </div>
          <CvDocument version={version} marks={marks} />
        </div>
        <aside
          aria-label={t('cv.changesAside')}
          className={`min-w-0 flex-[1_1_360px] flex-col gap-3.5 ${view === 'changes' ? 'flex' : 'hidden md:flex'}`}>
          <TermsCard terms={version.unsupportedJobTerms} />
          {total > 0 && (
            <>
              <SegmentedControl
                label={t('cv.tabsLabel')}
                options={[
                  {
                    value: 'review',
                    label: t('cv.tabToReview', { count: toReview.length }),
                  },
                  {
                    value: 'questions',
                    label: t('cv.tabQuestions', {
                      count: questionsOpen.length,
                    }),
                  },
                  {
                    value: 'done',
                    label: t('cv.tabDone', { count: done.length }),
                  },
                ]}
                value={tab}
                onChange={value => setTab(value as Tab)}
              />
              {list.length > 0 ? (
                list
              ) : (
                <p className="text-[15px] leading-normal text-muted">
                  {t(empty)}
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default CvReview;
