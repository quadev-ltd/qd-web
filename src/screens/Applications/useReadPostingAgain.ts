// Asks the backend to read a job's posting again (D78, research doc 17): "Read the posting
// again" under the job, and "Try again" after a failed first reading. Over a text the candidate
// edited, the page asks first ("Replace your edited text?"). The answer only says the reading
// started; the application says how it goes, and ApplicationsProvider follows it.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApplicationsActions } from '@/core/profile/ApplicationsProvider';
import { PROFILE_DAILY_EXTRACTIONS } from '@/core/profile/contract';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

export interface ReadPostingAgain {
  /** Reads it again, or asks first when the candidate edited the text. */
  start: () => Promise<void>;
  /** "Replace your edited text?" is open. */
  confirming: boolean;
  /** The candidate said yes: read it again over the edited text. */
  confirm: () => Promise<void>;
  cancel: () => void;
  busy: boolean;
  errorMessage?: string;
}

export const useReadPostingAgain = (
  applicationId: string,
  /** The candidate changed the job's text since it was kept. */
  edited: boolean,
): ReadPostingAgain => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const { refreshApplication } = useApplicationsActions();
  const uid = useSessionUser()?.uid;
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const read = async (replaceEdited: boolean) => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      await gateway.readPostingAgain(applicationId, { replaceEdited });
    } catch (error) {
      const code = getProfileErrorCode(error);
      if (code === ProfileErrorCode.JobEdited) {
        // Edited since this page read it: ask now.
        setConfirming(true);
        setBusy(false);
        await refreshApplication(applicationId).catch(() => null);
        return;
      }
      // Already being read, or gone: reading the application again shows which.
      if (
        code !== ProfileErrorCode.Reading &&
        code !== ProfileErrorCode.NotFound
      ) {
        logProfileError('readPostingAgain', error, uid);
        setErrorMessage(
          code === ProfileErrorCode.DailyLimit
            ? t('applications.rereadLimitMessage', {
                max: PROFILE_DAILY_EXTRACTIONS,
                time: dailyLimitResetTime(),
              })
            : t('applications.rereadStartFailedMessage'),
        );
        setBusy(false);
        return;
      }
    }
    setConfirming(false);
    await refreshApplication(applicationId).catch(() => null);
    setBusy(false);
  };

  return {
    start: async () => {
      if (edited) {
        setConfirming(true);
        return;
      }
      await read(false);
    },
    confirming,
    confirm: () => read(true),
    cancel: () => setConfirming(false),
    busy,
    errorMessage,
  };
};

export default useReadPostingAgain;
