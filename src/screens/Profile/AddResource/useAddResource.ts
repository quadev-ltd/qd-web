import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CreateProfileResourceRequest,
  PROFILE_DAILY_EXTRACTIONS,
  PROFILE_MAX_RESOURCES,
} from '@/core/profile/contract';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { type UploadTarget } from '@/core/profile/gateway';
import { useInterviewProfileActions } from '@/core/profile/InterviewProfileProvider';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch } from '@/core/state/hooks';
import {
  dailyLimitRefused,
  extractionCounted,
} from '@/core/state/slices/interviewProfileSlice';

/** starting: the backend is creating the resource. uploading: its file is on its way. */
export type AddResourceStatus = 'idle' | 'starting' | 'uploading';

interface UnfinishedUpload {
  resourceId: string;
  target: UploadTarget;
  file: Blob;
}

/**
 * Adds a resource to the profile: asks the backend to create it and, for a file, uploads
 * the file to the place it answers. The new resource is in the list as soon as it exists,
 * and the profile follows it while the backend reads it. `onAdded` is called when there is
 * nothing left to do here.
 *
 * A file whose upload fails leaves its resource waiting. The upload can be tried again for
 * that same resource; creating it again would leave the first one behind.
 */
export const useAddResource = (onAdded: () => void) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const uid = useSessionUser()?.uid;
  const { refreshResource, watchResource } = useInterviewProfileActions();
  const [status, setStatus] = useState<AddResourceStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [unfinished, setUnfinished] = useState<UnfinishedUpload>();

  /** Shows the resource in the list as the backend has it now. A failed read can wait. */
  const show = async (resourceId: string) => {
    watchResource(resourceId);
    await refreshResource(resourceId).catch(() => null);
  };

  const upload = async ({ resourceId, target, file }: UnfinishedUpload) => {
    setStatus('uploading');
    setProgress(0);
    setErrorMessage(undefined);
    try {
      await gateway.uploadFile(target, file, { onProgress: setProgress });
    } catch (error) {
      logProfileError('uploadFile', error, uid);
      // The file store refused it for good: trying the same file again cannot work.
      const refused =
        getProfileErrorCode(error) === ProfileErrorCode.UploadRefused;
      setUnfinished(refused ? undefined : { resourceId, target, file });
      setErrorMessage(
        t(
          refused
            ? 'addResource.uploadRefusedMessage'
            : 'addResource.uploadFailedMessage',
        ),
      );
      setStatus('idle');
      return;
    }
    setUnfinished(undefined);
    await show(resourceId);
    setStatus('idle');
    onAdded();
  };

  const messageFor = (code: ProfileErrorCode) => {
    switch (code) {
      case ProfileErrorCode.DailyLimit:
        return t('profile.dailyLimitMessage', {
          max: PROFILE_DAILY_EXTRACTIONS,
          time: dailyLimitResetTime(),
        });
      case ProfileErrorCode.MaxResources:
        return t('profile.fullMessage', { max: PROFILE_MAX_RESOURCES });
      case ProfileErrorCode.FlagOff:
        return t('addResource.notAvailableMessage');
      default:
        return t('addResource.failedMessage');
    }
  };

  /** `file`: what to upload, for a request whose source is a file. */
  const add = async (request: CreateProfileResourceRequest, file?: Blob) => {
    setStatus('starting');
    setErrorMessage(undefined);
    let created;
    try {
      created = await gateway.createResource(request);
    } catch (error) {
      logProfileError('createResource', error, uid);
      const code = getProfileErrorCode(error);
      if (code === ProfileErrorCode.DailyLimit) {
        dispatch(dailyLimitRefused());
      }
      setErrorMessage(messageFor(code));
      setStatus('idle');
      return;
    }
    dispatch(extractionCounted());
    await show(created.resourceId);
    if (created.upload && file) {
      await upload({
        resourceId: created.resourceId,
        target: created.upload,
        file,
      });
      return;
    }
    setStatus('idle');
    onAdded();
  };

  return {
    add,
    /** Uploads again the file whose upload failed; nothing when there is none. */
    retryUpload: () => (unfinished ? upload(unfinished) : Promise.resolve()),
    /** A resource was created and is still waiting for its file. */
    hasUnfinishedUpload: Boolean(unfinished),
    status,
    /** The part of the file sent so far, from 0 to 1, while `status` is "uploading". */
    progress,
    errorMessage,
    isBusy: status !== 'idle',
  };
};

export type AddResource = ReturnType<typeof useAddResource>;
