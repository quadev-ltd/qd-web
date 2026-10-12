// The web version of qd-mobile src/screens/CompleteProfile/CompleteProfileScreen.tsx: shown
// when a signed-in user has no profile yet (Google or Apple without a name, or a failed
// write). The screen owns the form (useForm + zodResolver) and provides it to
// CompleteProfileForm. Added for the web: the email and "Sign out" in the header.
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { CompleteProfileForm } from './CompleteProfileForm';
import { getPrefilledNames } from './useCompleteProfile';

import { FooterPrompt } from '@/components/SignIn/FooterPrompt';
import { Layout } from '@/components/SignIn/Layout';
import SignedInActions from '@/components/SignIn/SignedInActions';
import { ScreenType } from '@/components/SignIn/types';
import { useSignOut } from '@/core/session/hooks';
import { useAppSelector } from '@/core/state/hooks';
import { selectSession } from '@/core/state/selectors/session';
import {
  CompleteProfileFields,
  completeProfileSchema,
  type CompleteProfileSchemaType,
} from '@/schemas/completeProfileSchema';

export const CompleteProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user, providerNames, profile } = useAppSelector(selectSession);
  const signOut = useSignOut();
  const prefilled = getPrefilledNames(user, providerNames, profile);
  const methods = useForm<CompleteProfileSchemaType>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      [CompleteProfileFields.firstName]: prefilled.firstName ?? '',
      [CompleteProfileFields.lastName]: prefilled.lastName ?? '',
      [CompleteProfileFields.dob]: '',
    },
  });

  return (
    <FormProvider {...methods}>
      <Layout
        width="medium"
        documentTitle={t('completeProfile.documentTitle')}
        title={t('completeProfile.title')}
        subtitle={t('completeProfile.subtitle')}
        headerActions={<SignedInActions />}>
        <CompleteProfileForm />
        <FooterPrompt
          changePath={signOut}
          screen={ScreenType.CompleteProfile}
        />
      </Layout>
    </FormProvider>
  );
};

export default CompleteProfileScreen;
