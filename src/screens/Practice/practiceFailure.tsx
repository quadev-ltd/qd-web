// What a refused or failed start of a practice says (D94, doc 15 §25.4), wherever a question can
// be practised: an interview's list, its own question, the brief.
import { useTranslation } from 'react-i18next';

import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import { getProfileErrorCode, ProfileErrorCode } from '@/core/profile/errors';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { PRACTICE_TURNS_MAX } from '@/core/profile/practice';
import { PRACTICE_DAILY_LIMIT } from '@/core/profile/usageLimits';

export type PracticeFailure =
  'limit' | 'turnLimit' | 'changed' | 'reading' | 'gone' | 'flagOff' | 'model';

export const practiceFailureOf = (error: unknown): PracticeFailure => {
  switch (getProfileErrorCode(error)) {
    case ProfileErrorCode.DailyLimit:
      return 'limit';
    case ProfileErrorCode.MaxPracticeTurns:
      return 'turnLimit';
    case ProfileErrorCode.QuestionChanged:
      return 'changed';
    case ProfileErrorCode.Reading:
      return 'reading';
    case ProfileErrorCode.NotFound:
      return 'gone';
    case ProfileErrorCode.FlagOff:
      return 'flagOff';
    default:
      // The model, a timeout or the network: worth trying again.
      return 'model';
  }
};

export const PracticeFailureBanner: React.FC<{
  failure: PracticeFailure;
  /** Today's limit of practice calls, when known. */
  max?: number;
  onRetry?: () => void;
  retryDisabled?: boolean;
}> = ({ failure, max, onRetry, retryDisabled }) => {
  const { t } = useTranslation();
  switch (failure) {
    case 'limit':
      return (
        <Banner tone="warning" role="alert">
          {t('practice.limitMessage', {
            max: max ?? PRACTICE_DAILY_LIMIT.maxCallsPerDay,
            time: dailyLimitResetTime(),
          })}
        </Banner>
      );
    case 'turnLimit':
      return (
        <Banner tone="warning" role="alert">
          {t('practice.turnLimitMessage', { max: PRACTICE_TURNS_MAX })}
        </Banner>
      );
    case 'changed':
      return (
        <Banner tone="info" role="status">
          {t('practice.changedMessage')}
        </Banner>
      );
    case 'reading':
      return (
        <Banner tone="warning" role="alert">
          {t('practice.jobReadingMessage')}
        </Banner>
      );
    case 'gone':
      return (
        <Banner tone="danger" role="alert">
          {t('practice.goneMessage')}
        </Banner>
      );
    case 'flagOff':
      return (
        <Banner tone="danger" role="alert">
          {t('applications.notAvailableMessage')}
        </Banner>
      );
    case 'model':
      return (
        <Banner
          tone="danger"
          role="alert"
          action={
            onRetry && (
              <Button
                variant="quiet"
                size="small"
                onClick={onRetry}
                disabled={retryDisabled}>
                {t('practice.retryButton')}
              </Button>
            )
          }>
          {t('practice.failedMessage')}
        </Banner>
      );
  }
};
