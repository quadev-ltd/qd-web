// The web version of qd-mobile src/screens/SignUp/SignUpScreen.tsx: the screen owns the form
// (useForm + zodResolver) and provides it to SignUpForm.
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { SignUpForm } from './SignUpForm';

import { SSOForm } from '@/components/SignIn/SSOForm';
import { ScreenType } from '@/components/SignIn/types';
import ButtonLink from '@/components/ui/ButtonLink';
import { signUpSchema, type SignUpSchemaType } from '@/schemas/signUpSchema';

export const SignUpScreen: React.FC = () => {
  const { t } = useTranslation();
  const methods = useForm<SignUpSchemaType>({
    resolver: zodResolver(signUpSchema),
  });

  return (
    <FormProvider {...methods}>
      <SSOForm
        screen={ScreenType.SignUp}
        changePath="/sign-in"
        documentTitle={t('signUp.documentTitle')}
        title={t('signUp.title')}
        subtitle={t('signUp.subtitle')}
        headerActions={
          <div className="flex items-center gap-3 text-[15px] leading-natural">
            <span className="max-[720px]:hidden">
              {t('signUp.changePathDescription')}
            </span>
            <ButtonLink to="/sign-in" variant="outline" size="small">
              {t('signUp.changePathButton')}
            </ButtonLink>
          </div>
        }>
        <SignUpForm />
      </SSOForm>
    </FormProvider>
  );
};

export default SignUpScreen;
