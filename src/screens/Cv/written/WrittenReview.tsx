// A written CV (C3, doc 13 §20.1): "What we did and why" across the top, the CV with where each
// line comes from, and beside it the download (always there: nothing has to be decided first),
// "Did you send it?" for a job, the writer's questions and the job's words the profile doesn't
// show. At phone width the parts stack.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import CvDetailsPanel from '../details/CvDetailsPanel';
import DownloadButton from '../download/DownloadButton';
import { TermsCard } from '../review/ReviewCards';
import SentCard from '../review/SentCard';
import { useCvReview } from '../review/useCvReview';
import useItems from '../review/useItems';

import WrittenCv from './WrittenCv';
import { aboutPages, isLongerThanAsked } from './writtenMeta';

import Icon from '@/components/Icon';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { type CvDocument } from '@/core/profile/cvDocument';
import { type CvWrittenVersion } from '@/core/profile/cvVersions';
import { useCvVersions } from '@/core/profile/CvVersionsProvider';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';

/** Notes shown before "Show all". */
const NOTES_SHOWN = 3;

export interface WrittenReviewProps {
  version: CvWrittenVersion & { document: CvDocument };
  /** What the downloaded file is called, without its extension. */
  fileTitle: string;
  /** The day of the version it was written again from, for "your answer of 15 Oct". */
  writtenAgainDay?: string;
}

export const WrittenReview: React.FC<WrittenReviewProps> = ({
  version,
  fileTitle,
  writtenAgainDay,
}) => {
  const { t } = useTranslation();
  const { resources } = useInterviewProfile();
  const { details } = useCvVersions();
  const review = useCvReview(version.id);
  const items = useItems(true);
  const [sources, setSources] = useState(true);
  const [allNotes, setAllNotes] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { document, notes, questions } = version;
  const dropped = version.dropped
    ? version.dropped.lines + version.dropped.numbers + version.dropped.names
    : 0;
  const sent = version.sentAt !== undefined && version.sentAt !== null;
  const longer = isLongerThanAsked(document, version.pages);
  const open = questions.filter(({ status }) => status === 'open');

  return (
    <div className="flex flex-col gap-5">
      {(notes.length > 0 || dropped > 0) && (
        <Card
          as="section"
          elevation="raised"
          aria-labelledby="cv-notes"
          className="gap-3 p-5">
          <div className="flex flex-col gap-0.5">
            <h2
              id="cv-notes"
              className="font-display text-[18px] leading-tight font-semibold">
              {t('cv.notesTitle')}
            </h2>
            {notes.length > 0 && (
              <p className="text-sm leading-normal text-muted">
                {t('cv.notesCount', { count: notes.length })}
              </p>
            )}
          </div>
          {notes.length > 0 && (
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3">
              {(allNotes ? notes : notes.slice(0, NOTES_SHOWN)).map(
                (note, index) => (
                  <li
                    // The notes have no ids; their order is the writer's.
                    key={index}
                    className="rounded-[12px] bg-background px-3.5 py-3 text-[15px] leading-normal">
                    {note}
                  </li>
                ),
              )}
            </ul>
          )}
          {notes.length > NOTES_SHOWN && (
            <Button
              variant="quiet"
              size="small"
              aria-expanded={allNotes}
              onClick={() => setAllNotes(all => !all)}
              className="gap-2 self-start">
              <Icon name={allNotes ? 'up' : 'down'} size={18} />
              {allNotes
                ? t('cv.notesShowFewer')
                : t('cv.notesShowAll', { count: notes.length })}
            </Button>
          )}
          {dropped > 0 && (
            <p className="flex items-start gap-2 text-sm leading-normal text-muted">
              <span className="flex pt-0.5 text-primary">
                <Icon name="check" size={16} />
              </span>
              {t('cv.droppedLines', { count: dropped })}
            </p>
          )}
        </Card>
      )}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-sm leading-normal font-medium text-muted">
              {t('cv.yourCvTitle')}
            </span>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-medium">
              <input
                type="checkbox"
                role="switch"
                checked={sources}
                onChange={event => setSources(event.target.checked)}
                className="size-[18px] accent-primary"
              />
              {t('cv.showSources')}
            </label>
          </div>
          <WrittenCv
            document={document}
            details={details}
            sources={sources}
            context={{
              items,
              resources,
              statements: version.statements,
              writtenAgainDay,
            }}
            onEditDetails={() => setDetailsOpen(true)}
          />
        </div>
        <aside
          aria-label={t('cv.writtenAside')}
          className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
          <Card
            as="section"
            elevation="raised"
            aria-labelledby="cv-download"
            className="gap-2.5 p-5">
            <h2
              id="cv-download"
              className="font-display text-[20px] leading-tight font-semibold">
              {aboutPages(t, document)}
            </h2>
            <p className="text-sm leading-normal text-muted">{t('cv.ukA4')}</p>
            {longer ? (
              <Banner tone="info">
                {t('cv.longerThanAsked', { count: version.pages })}
              </Banner>
            ) : (
              <p className="text-[15px] leading-normal text-muted">
                {t('cv.downloadsAsShown')}
              </p>
            )}
            <DownloadButton version={version} fileTitle={fileTitle} />
          </Card>
          {version.target.kind === 'job' && (
            <SentCard sent={sent} review={review} />
          )}
          {questions.length > 0 && (
            <Card
              as="section"
              elevation="raised"
              aria-labelledby="cv-questions"
              className="gap-3 p-5">
              <h2
                id="cv-questions"
                className="font-display text-[18px] leading-tight font-semibold">
                {t('cv.writtenQuestionsTitle', { count: questions.length })}
              </h2>
              <p className="text-[15px] leading-normal text-muted">
                {t('cv.writtenQuestionsText')}
              </p>
              <ol className="flex flex-col">
                {questions.map((question, index) => (
                  <li
                    key={question.id}
                    className="flex flex-col gap-1.5 border-border-faint py-3 not-first:border-t">
                    <p className="text-[15px] leading-normal font-medium">
                      <span className="sr-only">
                        {t('cv.questionNumber', { number: index + 1 })}{' '}
                      </span>
                      {question.text}
                    </p>
                    {question.status === 'answered' && question.answer ? (
                      <p className="text-sm leading-normal text-muted">
                        {t('cv.yourAnswerWas', { answer: question.answer })}
                      </p>
                    ) : (
                      <span className="flex">
                        <Chip
                          tone={
                            question.status === 'skipped' ? 'neutral' : 'info'
                          }>
                          {t(
                            question.status === 'skipped'
                              ? 'cv.questionSkipped'
                              : 'cv.questionNotAnswered',
                          )}
                        </Chip>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              {open.length > 0 && (
                <p className="sr-only">
                  {t('cv.questionsOpen', { count: open.length })}
                </p>
              )}
            </Card>
          )}
          <TermsCard terms={version.unsupportedJobTerms} />
        </aside>
      </div>
      {detailsOpen && <CvDetailsPanel onClose={() => setDetailsOpen(false)} />}
    </div>
  );
};

export default WrittenReview;
