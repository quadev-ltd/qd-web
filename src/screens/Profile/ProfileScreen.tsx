// The interview profile: what the candidate added (a CV and other resources) and the way
// into the skill map. No screen of the app to mirror yet: the website has it first.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import AddResourcePanel from './AddResource/AddResourcePanel';
import { PROFILE_MAIN } from './ProfileRoutes';
import ResourceList from './ResourceList';
import SkillMapSummary from './SkillMapSummary';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  PROFILE_DAILY_EXTRACTIONS,
  PROFILE_MAX_RESOURCES,
} from '@/core/profile/contract';
import {
  useInterviewProfile,
  useInterviewProfileActions,
} from '@/core/profile/InterviewProfileProvider';
import {
  dailyLimitResetTime,
  isDailyLimitReached,
  isProfileFull,
} from '@/core/profile/limits';

/** What a link to the profile can ask for: "Add your CV" elsewhere opens that panel here. */
const panelFromState = (state: unknown): 'cv' | undefined =>
  (state as { add?: unknown } | null)?.add === 'cv' ? 'cv' : undefined;

export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useInterviewProfile();
  const { reload } = useInterviewProfileActions();
  // Which "Add a resource" panel is open: every kind of resource, or a CV only.
  const [adding, setAdding] = useState<'any' | 'cv' | undefined>(() =>
    panelFromState(location.state),
  );

  const { status, resources, items } = profile;
  const isLoaded = status === 'loaded';
  const isEmpty = isLoaded && resources.length === 0;
  const full = isLoaded && isProfileFull(resources.length);
  const limitReached =
    isLoaded &&
    (profile.dailyLimitRefused ||
      isDailyLimitReached(profile.extractionsToday));

  return (
    <SignedInShell
      title={t('profile.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
            <h1 className="font-display text-[28px] leading-tight font-semibold">
              {t('profile.title')}
            </h1>
            <p className="text-[16px] leading-normal text-muted">
              {t('profile.description')}
            </p>
          </div>
          {isLoaded && !isEmpty && (
            <Button
              disabled={full || limitReached}
              onClick={() => setAdding('any')}
              className="gap-2">
              <Icon name="plus" size={18} />
              {t('profile.addResourceButton')}
            </Button>
          )}
        </div>

        {full && (
          <Banner>
            {t('profile.fullMessage', { max: PROFILE_MAX_RESOURCES })}
          </Banner>
        )}
        {limitReached && !full && (
          <Banner>
            {t('profile.dailyLimitMessage', {
              max: PROFILE_DAILY_EXTRACTIONS,
              time: dailyLimitResetTime(),
            })}
          </Banner>
        )}

        {(status === 'idle' || status === 'loading') && (
          <div className="flex justify-center py-16 text-primary">
            <Spinner />
          </div>
        )}
        {status === 'error' && (
          <Banner
            tone="danger"
            role="alert"
            action={
              <Button variant="quiet" size="small" onClick={reload}>
                {t('profile.retryButton')}
              </Button>
            }>
            {t('profile.loadErrorMessage')}
          </Banner>
        )}

        {isEmpty && (
          <Card
            elevation="raised"
            className="mx-auto w-full max-w-[560px] items-center gap-3 px-6 py-10 text-center">
            <span
              aria-hidden="true"
              className="flex size-16 flex-none items-center justify-center rounded-full bg-tint text-primary">
              <Icon name="upload" size={28} />
            </span>
            <h2 className="font-display text-[20px] leading-tight font-semibold">
              {t('profile.emptyTitle')}
            </h2>
            <p className="max-w-[420px] text-[15px] leading-normal text-muted">
              {t('profile.emptyDescription')}
            </p>
            <div className="mt-1 flex w-full max-w-[320px] flex-col gap-2.5">
              <Button
                disabled={limitReached}
                onClick={() => setAdding('cv')}
                className="gap-2">
                <Icon name="upload" size={18} />
                {t('profile.addCvButton')}
              </Button>
              <Button
                variant="secondary"
                disabled={limitReached}
                onClick={() => setAdding('any')}>
                {t('profile.addSomethingElseButton')}
              </Button>
            </div>
          </Card>
        )}

        {isLoaded && !isEmpty && (
          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[999_1_520px]">
              <ResourceList resources={resources} />
            </div>
            <div className="min-w-0 flex-[1_1_320px]">
              <SkillMapSummary items={items} />
            </div>
          </div>
        )}
      </div>

      {adding && (
        <AddResourcePanel
          kind={adding}
          onClose={() => {
            setAdding(undefined);
            // Asked for by the link that led here: once is enough, also after a reload.
            if (panelFromState(location.state)) {
              navigate(location.pathname, { replace: true, state: null });
            }
          }}
        />
      )}
    </SignedInShell>
  );
};

export default ProfileScreen;
