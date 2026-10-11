// The web version of qd-mobile src/screens/SignIn/SignInScreen.tsx: the screen owns the form
// (useForm + zodResolver) and provides it to SignInForm.
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { SignInForm } from './SignInForm';

import LegalNav from '@/components/SignIn/LegalNav';
import { SSOForm } from '@/components/SignIn/SSOForm';
import { ScreenType } from '@/components/SignIn/types';
import { type SignInSchemaType, signInSchema } from '@/schemas/signInSchema';

export const SignInScreen: React.FC = () => {
  const { t } = useTranslation();
  const methods = useForm<SignInSchemaType>({
    resolver: zodResolver(signInSchema),
  });

  return (
    <FormProvider {...methods}>
      <SSOForm
        screen={ScreenType.SignIn}
        changePath="/sign-up"
        documentTitle={t('signIn.documentTitle')}
        title={t('signIn.title')}
        subtitle={t('signIn.subtitle')}
        headerActions={<LegalNav />}>
        <SignInForm />
      </SSOForm>
    </FormProvider>
  );
};

export default SignInScreen;
