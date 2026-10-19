// "At the top of every CV" (doc 13 §20.3): the CV's details in two lines on the CV section, with
// "Edit your details". Shown once the details are read, so it never flashes "nothing yet".
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { type CvDetails } from '@/core/profile/cvDetails';
import {
  useCvVersions,
  useCvVersionsActions,
} from '@/core/profile/CvVersionsProvider';

/** The two lines the card shows: the name and headline, then the contact lines. */
export const detailsLines = (
  details: CvDetails | null,
  linksLabel: (count: number) => string,
): [string, string] => [
  [details?.name, details?.headline].filter(Boolean).join(' · '),
  [
    details?.location,
    details?.email,
    details?.phone,
    details?.links?.length ? linksLabel(details.links.length) : '',
  ]
    .filter(Boolean)
    .join(' · '),
];

export const CvDetailsCard: React.FC<{ onEdit: () => void }> = ({ onEdit }) => {
  const { t } = useTranslation();
  const { details, detailsStatus } = useCvVersions();
  const { reloadDetails } = useCvVersionsActions();

  if (detailsStatus === 'idle' || detailsStatus === 'loading') {
    return null;
  }
  const failed = detailsStatus === 'error';
  const [who, contact] = detailsLines(details, count =>
    t('cv.detailsLinksCount', { count }),
  );
  const empty = !who && !contact;

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="cv-details-card"
      className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 flex-none items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="user" size={19} />
        </span>
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
          <h2
            id="cv-details-card"
            className="text-sm leading-normal font-normal text-muted">
            {t('cv.detailsCardTitle')}
          </h2>
          <p className="text-base leading-normal font-medium wrap-anywhere">
            {failed
              ? t('cv.detailsLoadErrorMessage')
              : empty
                ? t('cv.detailsNoneYet')
                : who || contact}
          </p>
          {!failed && who && contact && (
            <p className="text-sm leading-normal text-muted wrap-anywhere">
              {contact}
            </p>
          )}
        </div>
        {failed ? (
          <Button variant="quiet" size="small" onClick={reloadDetails}>
            {t('cv.retryButton')}
          </Button>
        ) : (
          <Button
            variant="quiet"
            size="small"
            onClick={onEdit}
            className="gap-2">
            <Icon name="edit" size={18} />
            {empty ? t('cv.detailsAddButton') : t('cv.detailsEditButton')}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default CvDetailsCard;
