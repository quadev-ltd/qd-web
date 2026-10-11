import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import FeatureCard from './FeatureCard';
import { AccountAddIcon, DeleteIcon, ProfileCardIcon } from './icons';

import logo from '@/assets/images/QuaDevIconAlpha.png';
import PageShell from '@/components/layout/PageShell';
import ButtonLink from '@/components/ui/ButtonLink';
import { env } from '@/core/env';
import { useSessionStatus } from '@/core/session/hooks';
import { SessionStatus } from '@/core/state/slices/sessionSlice';

export const PublicHomeScreen: React.FC = () => {
  const { t } = useTranslation();
  // Off in production until the account backend is connected: no account entry points.
  const accountEnabled = env.ACCOUNT_ENABLED;
  // A signed-in user gets the way back to their home instead of the sign-in buttons.
  const isSignedIn = useSessionStatus() === SessionStatus.Ready;

  return (
    <PageShell
      tone="brand"
      title={t('publicHome.documentTitle')}
      headerActions={
        accountEnabled && (
          <nav
            aria-label={t('header.accountNavAccessibilityLabel')}
            className="flex items-center gap-2">
            {isSignedIn ? (
              <ButtonLink to="/home" variant="inverse" size="small">
                {t('drawerMenu.home')}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/sign-in" variant="text" size="small">
                  {t('landing.changePathButton')}
                </ButtonLink>
                <ButtonLink to="/sign-up" variant="inverse" size="small">
                  {t('landing.signUpButton')}
                </ButtonLink>
              </>
            )}
          </nav>
        )
      }
      mainClassName="flex flex-col items-center gap-14 px-gutter pt-[clamp(24px,5vw,48px)] pb-16">
      <div className="flex max-w-[760px] flex-col items-center gap-5 text-center">
        <img
          src={logo}
          alt={t('brand.logoAlt')}
          width={720}
          height={888}
          className="h-[clamp(120px,20vw,168px)] w-auto"
        />
        <h1 className="mt-2 font-display text-[clamp(32px,5.4vw,52px)] leading-[1.1] font-semibold text-balance">
          {t('publicHome.title')}
        </h1>
        <p className="max-w-[600px] text-[18px] leading-[1.55]">
          {accountEnabled && !isSignedIn
            ? t('publicHome.descriptionWithAccount')
            : t('publicHome.description')}
        </p>
        {accountEnabled && (
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {isSignedIn ? (
              <ButtonLink to="/home" variant="inverse" size="large">
                {t('publicHome.goToHomeButton')}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/sign-up" variant="inverse" size="large">
                  {t('publicHome.createAccountButton')}
                </ButtonLink>
                <ButtonLink to="/sign-in" variant="outline" size="large">
                  {t('landing.changePathButton')}
                </ButtonLink>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid w-full max-w-[1040px] grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] gap-5">
        <FeatureCard
          icon={<AccountAddIcon />}
          title={t('publicHome.signUpCardTitle')}
          description={t('publicHome.signUpCardDescription')}
        />
        <FeatureCard
          icon={<ProfileCardIcon />}
          title={t('publicHome.dataCardTitle')}
          description={t('publicHome.dataCardDescription')}
        />
        <FeatureCard
          icon={<DeleteIcon />}
          title={t('publicHome.deleteCardTitle')}
          description={t('publicHome.deleteCardDescription')}>
          <Link
            to="/delete-account"
            className="text-[15px] leading-natural font-bold text-white underline">
            {t('publicHome.deleteCardLink')}
          </Link>
        </FeatureCard>
      </div>
    </PageShell>
  );
};

export default PublicHomeScreen;
