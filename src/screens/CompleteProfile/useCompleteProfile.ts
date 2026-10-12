// Mirrors qd-mobile src/screens/CompleteProfile/useCompleteProfile.ts.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import { getErrorMessageKey, logAuthError } from '@/core/auth/errors';
import { displayDateToIso, normaliseName } from '@/core/auth/profile';
import {
  type ProviderNames,
  type SessionUser,
  type UserProfile,
} from '@/core/auth/types';
import {
  CompleteProfileFields,
  type CompleteProfileSchemaType,
} from '@/schemas/completeProfileSchema';

/** Names to prefill: what Google/Apple sent at sign-in, else the account's display name. */
export const getPrefilledNames = (
  user: SessionUser | null,
  providerNames: ProviderNames | null,
  profile: UserProfile | null,
): ProviderNames => {
  const [displayFirst, ...displayRest] = (user?.displayName ?? '')
    .trim()
    .split(/\s+/);
  return {
    firstName:
      normaliseName(profile?.firstName) ??
      normaliseName(providerNames?.firstName) ??
      normaliseName(displayFirst),
    lastName:
      normaliseName(profile?.lastName) ??
      normaliseName(providerNames?.lastName) ??
      normaliseName(displayRest.join(' ')),
  };
};

/** Saves the profile; the session watcher then moves the user on to the signed-in home. */
export const useCompleteProfile = (uid: string | undefined) => {
  const { t } = useTranslation();
  const gateway = useAuthGateway();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const save = async (formData: CompleteProfileSchemaType) => {
    if (!uid) {
      return;
    }
    setIsSaving(true);
    setErrorMessage(undefined);
    const dateOfBirth = formData[CompleteProfileFields.dob]?.trim();
    try {
      await gateway.saveProfile(uid, {
        firstName: formData[CompleteProfileFields.firstName].trim(),
        lastName: formData[CompleteProfileFields.lastName].trim(),
        ...(dateOfBirth ? { dateOfBirth: displayDateToIso(dateOfBirth) } : {}),
      });
    } catch (error) {
      logAuthError('saveProfile', error, uid);
      setErrorMessage(t(getErrorMessageKey(error)));
      setIsSaving(false);
    }
  };

  return { save, isSaving, errorMessage };
};
