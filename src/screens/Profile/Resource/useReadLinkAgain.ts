// Asks the backend to read a link's page again (D78, research doc 17) and follows the resource
// until it is done: "Read the page again" under its copy, and "Try again" after a failed first
// reading. The answer only says the reading started; the resource says how it goes.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFILE_DAILY_EXTRACTIONS } from '@/core/profile/contract';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { useInterviewProfileActions } from '@/core/profile/InterviewProfileProvider';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

export interface ReadLinkAgain {
  start: () => Promise<void>;
  busy: boolean;
  errorMessage?: string;
}

export const useReadLinkAgain = (resourceId: string): ReadLinkAgain => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const { refreshResource, watchResource } = useInterviewProfileActions();
  const uid = useSessionUser()?.uid;
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const start = async () => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      await gateway.readLinkAgain(resourceId);
    } catch (error) {
      const code = getProfileErrorCode(error);
      // Already being read, or gone: reading the resource again shows which.
      if (
        code !== ProfileErrorCode.Reading &&
        code !== ProfileErrorCode.NotFound
      ) {
        logProfileError('readLinkAgain', error, uid);
        setErrorMessage(
          code === ProfileErrorCode.DailyLimit
            ? t('resource.rereadLimitMessage', {
                max: PROFILE_DAILY_EXTRACTIONS,
                time: dailyLimitResetTime(),
              })
            : t('resource.rereadStartFailedMessage'),
        );
        setBusy(false);
        return;
      }
    }
    watchResource(resourceId);
    await refreshResource(resourceId).catch(() => null);
    setBusy(false);
  };

  return { start, busy, errorMessage };
};

export default useReadLinkAgain;
