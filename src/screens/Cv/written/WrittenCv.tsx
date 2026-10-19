// A written CV as a page (doc 13 §20.1): the header from the CV's details as they are now, then
// the sections in their fixed order, a section with nothing in it left out. While "Show where
// each line comes from" is on, a muted line under each line, role heading and skill group says
// where it comes from; off, the CV shows as it downloads.
import { useTranslation } from 'react-i18next';

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
  type CvLine,
  cvLineText,
  cvRightToWorkLine,
  type CvSectionKey,
} from '@/core/profile/cvDocument';

export interface WrittenCvProps {
  document: CvDocument;
  details: CvDetails | null;
  /** "Show where each line comes from". */
  sources: boolean;
  context: SourceContext;
  onEditDetails: () => void;
}

const shown = (lines: CvLine[]) =>
  lines.filter(({ state }) => state !== 'removed');

export const WrittenCv: React.FC<WrittenCvProps> = ({
  document,
  details,
  sources,
  context,
  onEditDetails,
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

  const contact = [details?.location, details?.email, details?.phone]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(CV_HEADER_SEPARATOR);
  const links = (details?.links ?? []).join(CV_HEADER_SEPARATOR);
  const hasDetails = Boolean(
    details?.name || details?.headline || contact || links,
  );

  const entry = (item: CvEntry) => {
    const what = [item.title, item.organisation, item.location]
      .map(part => part.trim())
      .filter(Boolean)
      .join(CV_HEADER_SEPARATOR);
    const when = [item.start, item.end]
      .map(part => part.trim())
      .filter(Boolean)
      .join(' – ');
    return (
      <li key={item.id} className="flex flex-col gap-1.5">
        <div>
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 font-semibold">
            <span className="min-w-0">{what}</span>
            {when && (
              <span className="text-[14px] font-medium text-muted">{when}</span>
            )}
          </p>
          {from(item)}
        </div>
        {shown(item.bullets).length > 0 && (
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {shown(item.bullets).map(line => (
              <li key={line.id}>
                {line.text}
                {from(line)}
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
      if (lines.length > 0) {
        body = (
          <p>
            {lines.map(cvLineText).join(' ')}
            {from({
              sources: lines.flatMap(line =>
                line.state === 'edited' ? [] : line.sources,
              ),
              state: lines.every(({ state }) => state === 'edited')
                ? 'edited'
                : 'written',
            })}
          </p>
        );
      }
    } else if (key === 'experience' || key === 'projects') {
      const entries = document[key].filter(({ state }) => state !== 'removed');
      if (entries.length > 0) {
        body = <ul className="flex flex-col gap-4">{entries.map(entry)}</ul>;
      }
    } else {
      const lines = shown(document[key]);
      if (lines.length > 0) {
        body = (
          <ul className="flex flex-col gap-1.5">
            {lines.map(line => (
              <li key={line.id}>
                {line.label ? (
                  <>
                    <span className="font-semibold">{line.label}:</span>{' '}
                    {line.text}
                  </>
                ) : (
                  line.text
                )}
                {from(line)}
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
