// The text kept of a resource (D78, research doc 17): a note as it was added, the text of a
// file without its layout ("Download the file" shows it as it looks), or the dated copy of a
// link's page, which can be read again. Read when the page opens, one document, only for a
// resource that has one.
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDay } from './resourceMeta';
import { type ReadLinkAgain } from './useReadLinkAgain';

import ReadAgain from '@/components/ReadAgain';
import Spinner from '@/components/Spinner';
import TextPreview from '@/components/TextPreview';
import Banner, { type BannerProps } from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  isRereading,
  PROFILE_DAILY_EXTRACTIONS,
  type ProfileResource,
  type ProfileResourceText,
  type RereadOutcome,
  rereadOutcomeOf,
} from '@/core/profile/contract';
import { logProfileError } from '@/core/profile/errors';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

const TITLE_KEYS = {
  note: 'resource.noteTextTitle',
  file: 'resource.fileTextTitle',
  page: 'resource.pageTextTitle',
} as const satisfies Record<ProfileResourceText['kind'], string>;

const META_KEYS = {
  text: 'resource.plainTextMeta',
  docx: 'resource.docxTextMeta',
  pdf: 'resource.pdfTextMeta',
  page: 'resource.pageTextMeta',
} as const satisfies Record<ProfileResourceText['format'], string>;

/** What the card says once the page was read again. */
const OUTCOMES = {
  changed: { tone: 'success', key: 'resource.pageChangedMessage' },
  unchanged: { tone: 'info', key: 'resource.pageUnchangedMessage' },
  gone: { tone: 'danger', key: 'resource.pageGoneMessage' },
  quota: { tone: 'danger', key: 'resource.pageRereadQuotaMessage' },
  error: { tone: 'danger', key: 'resource.pageRereadErrorMessage' },
} as const satisfies Record<
  RereadOutcome['kind'],
  { tone: BannerProps['tone']; key: string }
>;

type Loaded =
  | { status: 'loading' }
  | { status: 'loaded'; text: ProfileResourceText | null }
  | { status: 'error' };

export interface ResourceTextCardProps {
  resource: Pick<
    ProfileResource,
    'id' | 'source' | 'status' | 'textAt' | 'refresh'
  >;
  /** A link only: "Read the page again". */
  readAgain?: ReadLinkAgain;
}

export const ResourceTextCard: React.FC<ResourceTextCardProps> = ({
  resource,
  readAgain,
}) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const titleId = useId();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const { id, textAt, refresh } = resource;
  const hasText = textAt !== undefined && textAt !== null;

  const read = useCallback(
    (onDone: (next: Loaded) => void) => {
      if (!uid || textAt === undefined || textAt === null) {
        return;
      }
      gateway.getResourceText(uid, id).then(
        text => onDone({ status: 'loaded', text }),
        error => {
          logProfileError('getResourceText', error, uid);
          onDone({ status: 'error' });
        },
      );
    },
    [gateway, id, textAt, uid],
  );

  useEffect(() => {
    let live = true;
    read(next => live && setLoaded(next));
    return () => {
      live = false;
    };
  }, [read]);

  // From the resource, so the title is right before its text arrives.
  const kind =
    resource.source === 'text'
      ? 'note'
      : resource.source === 'link'
        ? 'page'
        : 'file';
  // A link read before copies were kept has none until its page is read again.
  const awaitingCopy =
    kind === 'page' && !hasText && resource.status === 'ready' && readAgain;

  // No text kept: a scan with no text, a failed resource, or one read before texts were kept.
  if (!hasText && !awaitingCopy) {
    return null;
  }
  if (loaded.status === 'loaded' && loaded.text === null && !awaitingCopy) {
    return null;
  }

  const text = loaded.status === 'loaded' ? loaded.text : null;
  const date = hasText ? formatDay(text?.takenAt ?? textAt) : '';
  const meta = !hasText
    ? 'resource.pageNoCopyMeta'
    : kind === 'note'
      ? 'resource.noteTextMeta'
      : META_KEYS[kind === 'page' ? 'page' : (text?.format ?? 'text')];
  const outcome = kind === 'page' ? rereadOutcomeOf(refresh) : null;
  // Without a copy, a failure has no old copy to keep.
  const outcomeKey =
    outcome && !hasText && OUTCOMES[outcome.kind].tone === 'danger'
      ? 'resource.pageNoCopyFailedMessage'
      : outcome && OUTCOMES[outcome.kind].key;
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={titleId}
      className="gap-3">
      {outcome && outcomeKey && (
        <Banner
          tone={OUTCOMES[outcome.kind].tone}
          role={OUTCOMES[outcome.kind].tone === 'danger' ? 'alert' : 'status'}>
          {t(outcomeKey, {
            date,
            max: PROFILE_DAILY_EXTRACTIONS,
            time: dailyLimitResetTime(),
          })}
        </Banner>
      )}
      <div className="flex flex-col gap-0.5">
        <h2
          id={titleId}
          className="font-display text-[18px] leading-tight font-semibold">
          {t(TITLE_KEYS[kind])}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t(meta, { date })}
          {text?.truncated &&
            ` ${t(kind === 'page' ? 'resource.pageTextTruncated' : 'resource.textTruncated')}`}
        </p>
      </div>
      {hasText && loaded.status === 'loading' && (
        <div className="flex justify-center py-6 text-primary">
          <Spinner size="small" />
        </div>
      )}
      {hasText && loaded.status === 'error' && (
        <Banner
          tone="danger"
          role="alert"
          action={
            <Button
              variant="quiet"
              size="small"
              onClick={() => {
                setLoaded({ status: 'loading' });
                read(setLoaded);
              }}>
              {t('resource.textRetryButton')}
            </Button>
          }>
          {t('resource.textLoadError')}
        </Banner>
      )}
      {text && <TextPreview text={text.text} />}
      {kind === 'page' && readAgain && resource.status === 'ready' && (
        <ReadAgain
          reading={isRereading(refresh)}
          busy={readAgain.busy}
          buttonLabel={t('resource.rereadPageButton')}
          hint={t('resource.rereadPageHint')}
          readingTitle={t('resource.rereadingPageTitle')}
          readingHint={t(
            hasText
              ? 'resource.rereadingPageHint'
              : 'resource.rereadingFirstCopyHint',
            { date },
          )}
          errorMessage={readAgain.errorMessage}
          onRead={() => {
            readAgain.start();
          }}
        />
      )}
    </Card>
  );
};

export default ResourceTextCard;
