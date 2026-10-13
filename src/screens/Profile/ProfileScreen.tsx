// The interview profile: what the candidate added (a CV and other resources) and the way
// into the skill map. No screen of the app to mirror yet: the website has it first.
import { useTranslation } from 'react-i18next';

import { PROFILE_MAIN } from './ProfileRoutes';

import SignedInShell from '@/components/layout/SignedInShell';

export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SignedInShell
      title={t('profile.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[28px] leading-tight font-semibold">
            {t('profile.title')}
          </h1>
          <p className="text-[16px] leading-normal text-muted">
            {t('profile.description')}
          </p>
        </div>
      </div>
    </SignedInShell>
  );
};

export default ProfileScreen;
