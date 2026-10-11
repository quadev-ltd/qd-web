// The web version of qd-mobile src/components/SignIn/SSOAnimatedForm.tsx, without the
// animation: the Google and Apple buttons, the "or" divider, the email form (children) and
// the prompt that leads to the other screen.
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type To } from 'react-router';

import { Divider } from './Divider';
import ErrorMessage from './ErrorMessage';
import { FooterPrompt } from './FooterPrompt';
import { Layout, type LayoutProps } from './Layout';
import { ScreenType, type SSOScreenType } from './types';

import AppleSSOCTA from '@/core/sso/AppleSSOCTA';
import GoogleSSOCTA from '@/core/sso/GoogleSSOCTA';

export interface SSOFormProps extends Pick<
  LayoutProps,
  'documentTitle' | 'title' | 'subtitle'
> {
  screen: SSOScreenType;
  /** Where the prompt under the form leads. */
  changePath: To;
  headerActions?: ReactNode;
  children?: ReactNode;
}

export const SSOForm: React.FC<SSOFormProps> = ({
  screen,
  changePath,
  children,
  ...layoutProps
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const isSignUp = screen === ScreenType.SignUp;

  return (
    <Layout
      showLogo={!isSignUp}
      width={isSignUp ? 'wide' : 'narrow'}
      {...layoutProps}>
      <div
        aria-busy={isLoading}
        className={
          isSignUp
            ? 'grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3'
            : 'flex flex-col gap-3'
        }>
        <GoogleSSOCTA
          screen={screen}
          disabled={isLoading}
          setIsLoading={setIsLoading}
          setErrorMessage={setErrorMessage}
        />
        <AppleSSOCTA
          screen={screen}
          disabled={isLoading}
          setIsLoading={setIsLoading}
          setErrorMessage={setErrorMessage}
        />
      </div>
      {errorMessage && <ErrorMessage text={errorMessage} />}
      <Divider label={t(`${screen}.withSSO`)} />
      {children}
      <FooterPrompt changePath={changePath} screen={screen} />
    </Layout>
  );
};

export default SSOForm;
