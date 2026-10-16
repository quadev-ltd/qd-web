// The text kept of a resource (D78, research doc 17): a note as it was added, or the text of a
// file without its layout ("Download the file" shows it as it looks). Read when the page opens,
// one document, only for a resource that has one.
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDay } from './resourceMeta';

import Spinner from '@/components/Spinner';
import TextPreview from '@/components/TextPreview';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  type ProfileResource,
  type ProfileResourceText,
} from '@/core/profile/contract';
import { logProfileError } from '@/core/profile/errors';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

const META_KEYS = {
  text: 'resource.plainTextMeta',
  docx: 'resource.docxTextMeta',
  pdf: 'resource.pdfTextMeta',
  page: 'resource.plainTextMeta',
} as const satisfies Record<ProfileResourceText['format'], string>;

type Loaded =
  | { status: 'loading' }
  | { status: 'loaded'; text: ProfileResourceText | null }
  | { status: 'error' };

export const ResourceTextCard: React.FC<{
  resource: Pick<ProfileResource, 'id' | 'source' | 'textAt'>;
}> = ({ resource }) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const titleId = useId();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const { id, textAt } = resource;

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

  // No text kept: a link (its copy comes later), a scan with no text, or a resource read before.
  if (textAt === undefined || textAt === null) {
    return null;
  }
  if (loaded.status === 'loaded' && loaded.text === null) {
    return null;
  }

  const note = resource.source === 'text';
  const text = loaded.status === 'loaded' ? loaded.text : null;
  const date = formatDay(text?.takenAt ?? textAt);
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={titleId}
      className="gap-3">
      <div className="flex flex-col gap-0.5">
        <h2
          id={titleId}
          className="font-display text-[18px] leading-tight font-semibold">
          {t(note ? 'resource.noteTextTitle' : 'resource.fileTextTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {note
            ? t('resource.noteTextMeta', { date })
            : t(META_KEYS[text?.format ?? 'text'], { date })}
          {text?.truncated && ` ${t('resource.textTruncated')}`}
        </p>
      </div>
      {loaded.status === 'loading' && (
        <div className="flex justify-center py-6 text-primary">
          <Spinner size="small" />
        </div>
      )}
      {loaded.status === 'error' && (
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
    </Card>
  );
};

export default ResourceTextCard;
