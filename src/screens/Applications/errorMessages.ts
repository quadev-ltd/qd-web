import { type TFunction } from 'i18next';

import { APPLICATIONS_MAX } from '@/core/profile/applications';
import { getProfileErrorCode, ProfileErrorCode } from '@/core/profile/errors';

/** What the page says when a change to an application fails. */
export const applicationErrorMessage = (
  t: TFunction,
  error: unknown,
  /** What to say otherwise, already translated. */
  fallback: string,
): string => {
  switch (getProfileErrorCode(error)) {
    case ProfileErrorCode.MaxApplications:
      return t('applications.maxMessage', { max: APPLICATIONS_MAX });
    case ProfileErrorCode.FlagOff:
      return t('applications.notAvailableMessage');
    default:
      return fallback;
  }
};
