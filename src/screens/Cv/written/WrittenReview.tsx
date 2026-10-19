// A written CV (C3, doc 13 §20.1): "What we did and why" across the top, the CV with where each
// line comes from, and beside it the download (always there: nothing has to be decided first),
// "Did you send it?" for a job, the writer's questions with "Write again", and the job's words the
// profile doesn't show. A line or role opened shows beside the CV (over it at phone width), and
// "What we did and why" closes meanwhile. At phone width the parts stack.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import CvDetailsPanel from '../details/CvDetailsPanel';
import DownloadButton from '../download/DownloadButton';
import { TermsCard } from '../review/ReviewCards';
import SentCard from '../review/SentCard';
import { useCvReview } from '../review/useCvReview';
import useItems from '../review/useItems';

import LinePanel, { type Opened } from './LinePanel';
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
import { type CvWrittenVersion } from '@/core/profile/cvVersions';
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
  const wide = useMediaQuery('(min-width: 768px)');

  const { document, notes } = version;
  const opened = findOpened(document, openedId);
  const context = {
    items,
    resources,
    statements: version.statements,
    writtenAgainDay,
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
      {!opened && (notes.length > 0 || dropped > 0) && (
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
          <WrittenQuestions version={version} review={review} />
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
    </div>
  );
};

export default WrittenReview;
