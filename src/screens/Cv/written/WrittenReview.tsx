// A written CV (C3, doc 13 §20.1): "What we did and why" across the top, the CV with where each
// line comes from, and beside it the download (always there: nothing has to be decided first),
// "Did you send it?" for a job, the writer's questions with "Write again", and the job's words the
// profile doesn't show. A line or role opened shows beside the CV (over it at phone width), and
// "What we did and why" closes meanwhile. At phone width the parts stack.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CONVENTION_TAG_KEYS } from '../conventions';
import { versionDay } from '../cvMeta';
import CvDetailsPanel from '../details/CvDetailsPanel';
import DownloadButton from '../download/DownloadButton';
import { TermsCard } from '../review/ReviewCards';
import SentCard from '../review/SentCard';
import { useCvReview } from '../review/useCvReview';
import useItems from '../review/useItems';

import LinePanel, { type Opened } from './LinePanel';
import RewritePanel from './RewritePanel';
import WrittenCv from './WrittenCv';
import { aboutPages, isLongerThanAsked } from './writtenMeta';
import WrittenQuestions from './WrittenQuestions';

import Icon from '@/components/Icon';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SidePanel from '@/components/ui/SidePanel';
import useMediaQuery from '@/components/useMediaQuery';
import {
  CV_SECTION_KEYS,
  type CvDocument,
  type CvLine,
} from '@/core/profile/cvDocument';
import {
  type CvAskedOutcome,
  type CvWrittenVersion,
} from '@/core/profile/cvVersions';
import { useCvVersions } from '@/core/profile/CvVersionsProvider';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';

/** Notes shown before "Show all". */
const NOTES_SHOWN = 3;

/** The line or role with this id, as the version now has it, with where it is. */
const findOpened = (
  document: CvDocument,
  id: string | undefined,
): Opened | undefined => {
  if (!id) {
    return undefined;
  }
  for (const section of CV_SECTION_KEYS) {
    if (section === 'experience' || section === 'projects') {
      for (const entry of document[section]) {
        if (entry.id === id) {
          return { kind: 'entry', entry, section };
        }
        const line = entry.bullets.find(bullet => bullet.id === id);
        if (line) {
          return { kind: 'line', line, entry, section };
        }
      }
    } else {
      const line: CvLine | undefined = document[section].find(
        candidate => candidate.id === id,
      );
      if (line) {
        return { kind: 'line', line, section };
      }
    }
  }
  return undefined;
};

const OUTCOME_MARKS = {
  done: { icon: 'check', className: 'text-success' },
  changed: { icon: 'alert', className: 'text-warning' },
  'not-done': { icon: 'x', className: 'text-danger' },
} as const;

/**
 * "What you asked for" (D97): the candidate's words, used every time this CV is written, with
 * "Change it and write again"; beside it, what was done with each request.
 */
const AskedBlock: React.FC<{
  asked: string;
  outcomes: CvAskedOutcome[];
  onWriteAgain: () => void;
}> = ({ asked, outcomes, onWriteAgain }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-4">
      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-1.5">
        <p className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 text-sm leading-normal font-bold">
            {t('cv.askedTitle')}
          </span>
          <span className="text-[13px] leading-normal text-muted">
            {t('cv.askedYourWords')}
          </span>
        </p>
        <blockquote className="rounded-xl bg-tint px-3.5 py-3 text-[15px] leading-normal whitespace-pre-wrap shadow-[inset_3px_0_0_var(--color-primary)] wrap-anywhere">
          {asked}
        </blockquote>
        <p className="text-[13px] leading-normal text-muted">
          {t('cv.askedUsedEveryTime')}
        </p>
        <Button
          variant="quiet"
          size="small"
          onClick={onWriteAgain}
          className="-ml-1.5 gap-2 self-start text-[15px]">
          <Icon name="edit" size={18} />
          {t('cv.askedChangeButton')}
        </Button>
      </div>
      {outcomes.length > 0 && (
        <ul
          aria-label={t('cv.askedOutcomesLabel')}
          className="flex min-w-0 flex-[1_1_380px] flex-col gap-2.5">
          {outcomes.map(({ outcome, text }, index) => (
            // The outcomes have no ids; their order is the order asked.
            <li key={index} className="flex items-start gap-2.5">
              <span
                className={`flex pt-0.5 ${OUTCOME_MARKS[outcome].className}`}>
                <Icon name={OUTCOME_MARKS[outcome].icon} size={18} />
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-normal">
                <span className="sr-only">
                  {t(`cv.askedOutcome_${outcome}`)}:{' '}
                </span>
                {text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

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
  const [openedId, setOpenedId] = useState<string>();
  // "Write this CV again" (D97), from "Change it and write again" or the questions.
  const [rewriting, setRewriting] = useState(false);
  const wide = useMediaQuery('(min-width: 768px)');

  const { document, notes, asked } = version;
  const outcomes = version.askedOutcomes ?? [];
  const opened = findOpened(document, openedId);
  const context = {
    items,
    resources,
    statements: version.statements,
    writtenAgainDay,
    version: { id: version.id, day: versionDay(version) },
  };
  const panel = opened && (
    <LinePanel
      // A new line opened starts afresh.
      key={openedId}
      opened={opened}
      context={context}
      review={review}
    />
  );
  const dropped = version.dropped
    ? version.dropped.lines + version.dropped.numbers + version.dropped.names
    : 0;
  const sent = version.sentAt !== undefined && version.sentAt !== null;
  const longer = isLongerThanAsked(document, version.pages);

  return (
    <div className="flex flex-col gap-5">
      {!opened && (notes.length > 0 || dropped > 0 || asked) && (
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
            {notes.length + outcomes.length > 0 && (
              <p className="text-sm leading-normal text-muted">
                {outcomes.length > 0
                  ? t('cv.notesCountAsked', {
                      count: notes.length + outcomes.length,
                      asked: outcomes.length,
                    })
                  : t('cv.notesCount', { count: notes.length })}
              </p>
            )}
          </div>
          {asked && (
            <AskedBlock
              asked={asked}
              outcomes={outcomes}
              onWriteAgain={() => setRewriting(true)}
            />
          )}
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
            convention={version.convention}
            sources={sources}
            context={context}
            onEditDetails={() => setDetailsOpen(true)}
            openedId={openedId}
            onOpen={next =>
              setOpenedId(next.kind === 'line' ? next.line.id : next.entry.id)
            }
            onRestore={id => {
              review.revise({ lineId: id, action: 'restore' });
            }}
            busy={review.busy}
          />
        </div>
        <aside
          aria-label={t('cv.writtenAside')}
          className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
          {wide && panel && (
            <Card
              as="section"
              elevation="raised"
              aria-label={
                opened.kind === 'line' ? t('cv.thisLine') : t('cv.thisRole')
              }
              className="gap-3 border-2 border-primary p-4">
              <div className="flex justify-end">
                <Button
                  variant="quiet"
                  size="small"
                  aria-label={t('cv.closeLineLabel')}
                  onClick={() => setOpenedId(undefined)}>
                  <Icon name="x" size={18} />
                </Button>
              </div>
              {panel}
            </Card>
          )}
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
            <p className="text-sm leading-normal text-muted">
              {t(CONVENTION_TAG_KEYS[version.convention])}
            </p>
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
          <WrittenQuestions
            version={version}
            review={review}
            onWriteAgain={() => setRewriting(true)}
          />
          <TermsCard terms={version.unsupportedJobTerms} />
        </aside>
      </div>
      {!wide && panel && (
        <SidePanel
          title={opened.kind === 'line' ? t('cv.thisLine') : t('cv.thisRole')}
          onClose={() => setOpenedId(undefined)}>
          {panel}
        </SidePanel>
      )}
      {detailsOpen && <CvDetailsPanel onClose={() => setDetailsOpen(false)} />}
      {rewriting && (
        <RewritePanel version={version} onClose={() => setRewriting(false)} />
      )}
    </div>
  );
};

export default WrittenReview;
