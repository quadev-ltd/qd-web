import { useTranslation } from 'react-i18next';

import { type CvReview, SENT } from './useCvReview';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';

/** "Did you send it?" for a version for a job: marks it as the one sent, or not. */
export const SentCard: React.FC<{ sent: boolean; review: CvReview }> = ({
  sent,
  review,
}) => {
  const { t } = useTranslation();
  const busy = review.busy === SENT;
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="cv-sent"
      className="gap-3 p-5">
      {sent ? (
        <span className="flex">
          <Chip tone="success" icon="check">
            {t('cv.sentChip')}
          </Chip>
        </span>
      ) : (
        <h2
          id="cv-sent"
          className="font-display text-[18px] leading-tight font-semibold">
          {t('cv.sentTitle')}
        </h2>
      )}
      {!sent && (
        <p className="text-[15px] leading-normal text-muted">
          {t('cv.sentText')}
        </p>
      )}
      {review.failed === SENT && (
        <Banner tone="danger" role="alert">
          {t('cv.markFailedMessage')}
        </Banner>
      )}
      <Button
        variant={sent ? 'quiet' : 'secondary'}
        size="small"
        disabled={busy}
        aria-busy={busy}
        onClick={() => {
          review.markSent(!sent);
        }}
        className="gap-2 self-start">
        {busy ? (
          <Spinner size="small" decorative />
        ) : (
          !sent && <Icon name="check" size={18} />
        )}
        {t(sent ? 'cv.unmarkSentButton' : 'cv.markSentButton')}
      </Button>
    </Card>
  );
};

export default SentCard;
