// A written CV as a page (doc 13 §20.1): the header from the CV's details as they are now, then
// the sections in their fixed order, a section with nothing in it left out. While "Show where
// each line comes from" is on, a muted line under each line, role heading and skill group says
// where it comes from, and a removed line keeps its place with "Restore"; off, the CV shows as it
// downloads. A line or role's heading opens beside the CV, to read its sources or change it.
import { useTranslation } from 'react-i18next';

import { type Opened } from './LinePanel';
import { type SourceContext, sourceLine } from './writtenMeta';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import { type CvDetails } from '@/core/profile/cvDetails';
import {
  CV_HEADER_SEPARATOR,
  CV_SECTION_HEADINGS,
  CV_SECTION_KEYS,
  type CvDocument,
  type CvEntry,
  cvEntryHeading,
  type CvLine,
  cvLineText,
  cvRightToWorkLine,
  type CvSectionKey,
} from '@/core/profile/cvDocument';

export interface WrittenCvProps {
  document: CvDocument;
  details: CvDetails | null;
  /** "Show where each line comes from": also shows a removed line's place, to restore it. */
  sources: boolean;
  context: SourceContext;
  onEditDetails: () => void;
  /** The line or role open beside the CV. */
  openedId?: string;
  /** Opens a line or a role; without it the CV only reads. */
  onOpen?: (opened: Opened) => void;
  /** Puts back a line or role the candidate removed. */
  onRestore?: (id: string) => void;
  /** The line or role being saved. */
  busy?: string;
}

const shown = (lines: CvLine[]) =>
  lines.filter(({ state }) => state !== 'removed');

export const WrittenCv: React.FC<WrittenCvProps> = ({
  document,
  details,
  sources,
  context,
  onEditDetails,
  openedId,
  onOpen,
  onRestore,
  busy,
}) => {
  const { t } = useTranslation();

  const from = (of: Pick<CvLine, 'sources' | 'state'>) => {
    if (!sources) {
      return null;
    }
    const text = sourceLine(t, of, context);
    return text ? (
      <span className="mt-0.5 block text-[13px] leading-normal font-normal text-muted">
        {text}
      </span>
    ) : null;
  };

  /** A line or heading that opens beside the CV; its source line opens it too. */
  const openable = (
    id: string,
    opened: Opened,
    children: React.ReactNode,
    inline = false,
  ) =>
    onOpen ? (
      <button
        type="button"
        onClick={() => onOpen(opened)}
        className={`cursor-pointer rounded-[6px] text-left ${inline ? 'inline' : 'block w-full'} ${
          openedId === id
            ? 'bg-tint shadow-[0_0_0_2px_var(--color-primary)]'
            : 'hover:bg-tint'
        }`}>
        {children}
      </button>
    ) : (
      children
    );

  /** Where a removed line or role was, while the sources show, with "Restore". */
  const removedPlace = (id: string, text: string, role = false) =>
    sources && onRestore ? (
      <div className="flex flex-wrap items-center gap-x-2 rounded-[8px] border border-dashed border-border px-3 py-1 text-sm text-muted">
        <span className="min-w-0 flex-1">
          {t(role ? 'cv.roleRemovedByYou' : 'cv.lineRemovedByYou')}
        </span>
        <Button
          variant="quiet"
          size="small"
          disabled={busy === id}
          aria-label={t('cv.restoreRemovedLabel', { text })}
          onClick={() => onRestore(id)}>
          {t('cv.restoreLineButton')}
        </Button>
      </div>
    ) : null;

  const contact = [details?.location, details?.email, details?.phone]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(CV_HEADER_SEPARATOR);
  const links = (details?.links ?? []).join(CV_HEADER_SEPARATOR);
  const hasDetails = Boolean(
    details?.name || details?.headline || contact || links,
  );

  const entry = (section: CvSectionKey, item: CvEntry) => {
    if (item.state === 'removed') {
      const place = removedPlace(item.id, cvEntryHeading(item), true);
      return place ? <li key={item.id}>{place}</li> : null;
    }
    const what = [item.title, item.organisation, item.location]
      .map(part => part.trim())
      .filter(Boolean)
      .join(CV_HEADER_SEPARATOR);
    const when = [item.start, item.end]
      .map(part => part.trim())
      .filter(Boolean)
      .join(' – ');
    const bullets = item.bullets.filter(
      line => line.state !== 'removed' || (sources && onRestore),
    );
    return (
      <li key={item.id} className="flex flex-col gap-1.5">
        {openable(
          item.id,
          { kind: 'entry', entry: item, section },
          <>
            <span className="flex flex-wrap items-baseline justify-between gap-x-4 font-semibold">
              <span className="min-w-0">{what}</span>
              {when && (
                <span className="text-[14px] font-medium text-muted">
                  {when}
                </span>
              )}
            </span>
            {from(item)}
          </>,
        )}
        {bullets.length > 0 && (
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {bullets.map(line => (
              <li
                key={line.id}
                className={line.state === 'removed' ? 'list-none' : ''}>
                {line.state === 'removed'
                  ? removedPlace(line.id, line.text)
                  : openable(
                      line.id,
                      { kind: 'line', line, entry: item, section },
                      <>
                        {line.text}
                        {from(line)}
                      </>,
                    )}
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  const section = (key: CvSectionKey) => {
    let body: React.ReactNode = null;
    if (key === 'summary') {
      const lines = shown(document.summary);
      const removed = document.summary.filter(
        ({ state }) => state === 'removed',
      );
      if (lines.length > 0 || (removed.length > 0 && sources && onRestore)) {
        body = (
          <>
            {lines.length > 0 && (
              <p>
                {lines.map((line, index) => (
                  <span key={line.id}>
                    {index > 0 && ' '}
                    {openable(
                      line.id,
                      { kind: 'line', line, section: key },
                      cvLineText(line),
                      true,
                    )}
                  </span>
                ))}
                {from({
                  sources: lines.flatMap(line =>
                    line.state === 'edited' ? [] : line.sources,
                  ),
                  state: lines.every(({ state }) => state === 'edited')
                    ? 'edited'
                    : 'written',
                })}
              </p>
            )}
            {removed.map(line => (
              <div key={line.id}>{removedPlace(line.id, line.text)}</div>
            ))}
          </>
        );
      }
    } else if (key === 'experience' || key === 'projects') {
      const entries = document[key].filter(
        ({ state }) => state !== 'removed' || (sources && onRestore),
      );
      if (entries.length > 0) {
        body = (
          <ul className="flex flex-col gap-4">
            {entries.map(item => entry(key, item))}
          </ul>
        );
      }
    } else {
      const lines = document[key].filter(
        line => line.state !== 'removed' || (sources && onRestore),
      );
      if (lines.length > 0) {
        body = (
          <ul className="flex flex-col gap-1.5">
            {lines.map(line => (
              <li key={line.id}>
                {line.state === 'removed'
                  ? removedPlace(line.id, cvLineText(line))
                  : openable(
                      line.id,
                      { kind: 'line', line, section: key },
                      <>
                        {line.label ? (
                          <>
                            <span className="font-semibold">{line.label}:</span>{' '}
                            {line.text}
                          </>
                        ) : (
                          line.text
                        )}
                        {from(line)}
                      </>,
                    )}
              </li>
            ))}
          </ul>
        );
      }
    }
    return body ? (
      <section
        key={key}
        aria-labelledby={`cv-section-${key}`}
        className="flex flex-col gap-2.5">
        <h3
          id={`cv-section-${key}`}
          className="border-b border-border-subtle pb-1 font-display text-[15px] leading-tight font-semibold tracking-[0.06em] uppercase">
          {CV_SECTION_HEADINGS[key]}
        </h3>
        {body}
      </section>
    ) : null;
  };

  return (
    <article
      aria-label={t('cv.yourCvTitle')}
      className="flex flex-col gap-5 rounded-[6px] border border-border-faint bg-surface p-[clamp(18px,4vw,44px)] text-[15px] leading-relaxed shadow-card wrap-anywhere">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
          {hasDetails ? (
            <>
              {details?.name && (
                <p className="font-display text-[24px] leading-tight font-semibold">
                  {details.name}
                </p>
              )}
              {details?.headline && (
                <p className="text-[16px] font-medium">{details.headline}</p>
              )}
              {contact && <p className="text-[14px] text-muted">{contact}</p>}
              {links && <p className="text-[14px] text-muted">{links}</p>}
              {details?.rightToWork?.trim() && (
                <p className="text-[14px] text-muted">
                  {cvRightToWorkLine(details.rightToWork)}
                </p>
              )}
              {sources && (
                <span className="mt-0.5 block text-[13px] leading-normal text-muted">
                  {t('cv.sourceDetails')}
                </span>
              )}
            </>
          ) : (
            <p className="text-[15px] text-muted">{t('cv.noDetailsInCv')}</p>
          )}
        </div>
        <Button
          variant="quiet"
          size="small"
          onClick={onEditDetails}
          className="gap-2">
          <Icon name="edit" size={18} />
          {hasDetails ? t('cv.detailsEditButton') : t('cv.detailsAddButton')}
        </Button>
      </header>
      {CV_SECTION_KEYS.map(section)}
    </article>
  );
};

export default WrittenCv;
