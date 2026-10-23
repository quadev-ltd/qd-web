// The signed-in home of an account without the interview tools: the welcome and the three
// tools, "Coming soon". An account with them has Applications instead (D85), and this address,
// where signing in leads, sends it there. The account has its own page (/account); an old
// link to its section here (#account) leads to it.
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';

import { DocumentIcon, MicrophoneIcon, SoundWaveIcon } from './icons';
import ToolCard from './ToolCard';

import Arcs from '@/components/layout/Arcs';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import { ACCOUNT_PATH } from '@/core/auth/paths';
import { useFlag, useFlagsReady } from '@/core/flags/FlagsProvider';
import { APPLICATIONS_PATH } from '@/core/profile/paths';
import { useProfile } from '@/core/session/hooks';

export const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const profile = useProfile();
  const interviewAssistant = useFlag('interviewAssistant');
  const flagsReady = useFlagsReady();

  if (hash === '#account') {
    return <Navigate to={ACCOUNT_PATH} replace />;
  }
  if (!flagsReady) {
    return (
      <SignedInShell title={t('home.documentTitle')}>
        <div className="flex justify-center py-16 text-primary">
          <Spinner />
        </div>
      </SignedInShell>
    );
  }
  if (interviewAssistant) {
    return <Navigate to={APPLICATIONS_PATH} replace />;
  }

  return (
    <SignedInShell title={t('home.documentTitle')}>
      <div
        data-surface="dark"
        className="relative overflow-hidden bg-primary px-gutter pt-[clamp(36px,7vw,56px)] pb-28 text-white">
        <Arcs variant="welcome" />
        <div className="relative mx-auto flex max-w-[1120px] flex-col gap-3">
          <h1 className="font-display text-[clamp(30px,5vw,40px)] leading-[1.15] font-semibold text-balance">
            {t('home.welcomeTitle', { firstName: profile?.firstName ?? '' })}
          </h1>
          <p className="max-w-[560px] text-[18px] leading-normal">
            {t('home.welcomeDescription')}
          </p>
        </div>
      </div>

      <div className="px-gutter pb-16">
        <div className="relative mx-auto -mt-16 grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-5">
          <ToolCard
            icon={<MicrophoneIcon />}
            title={t('home.mockInterviewTitle')}
            description={t('home.mockInterviewDescription')}
            available={false}
          />
          <ToolCard
            icon={<SoundWaveIcon />}
            title={t('home.liveInterviewTitle')}
            description={t('home.liveInterviewDescription')}
            available={false}
          />
          <ToolCard
            icon={<DocumentIcon />}
            title={t('home.cvToolTitle')}
            description={t('home.cvToolDescription')}
            available={false}
          />
        </div>
      </div>
    </SignedInShell>
  );
};

export default HomeScreen;
