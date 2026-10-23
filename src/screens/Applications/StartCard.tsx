// The starting point of the applications page while it has none (D58, D85): "Add your CV",
// which everything else builds on; once a CV is in the profile, one line that says so and
// leads to it.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import Icon from '@/components/Icon';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import {
  InterviewProfileProvider,
  useInterviewProfile,
} from '@/core/profile/InterviewProfileProvider';
import { PROFILE_PATH, resourcePath } from '@/core/profile/paths';
import { ProfileGatewayProvider } from '@/core/profile/ProfileGatewayProvider';

/** The card itself, for a page that already provides the gateway and the profile. */
export const StartCardContent: React.FC = () => {
  const { t } = useTranslation();
  const { status, resources } = useInterviewProfile();

  // Nothing until the profile is known: neither card is shown by mistake for a moment, and
  // a profile that cannot be read leaves the home as it was.
  if (status !== 'loaded') {
    return null;
  }
  // A CV that could not be read is not in the profile: the invitation stays. With more than
  // one, the line is about the newest.
  const cv = resources
    .filter(resource => resource.type === 'cv' && resource.status !== 'failed')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
  if (cv) {
    return (
      <Card elevation="raised" className="p-4">
        <Link
          to={resourcePath(cv.id)}
          className="flex items-center gap-3 text-text no-underline hover:text-text">
          <span
            aria-hidden="true"
            className="flex size-10 flex-none items-center justify-center rounded-full bg-success-tint text-success">
            <Icon name="check" size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base leading-normal font-bold">
              {t('home.startDoneTitle')}
            </span>
            <span className="text-sm leading-normal text-muted">
              {cv.title}
            </span>
          </span>
          <span className="flex text-muted">
            <Icon name="right" />
          </span>
        </Link>
      </Card>
    );
  }
  return (
    <Card as="section" elevation="raised" className="items-start gap-3 p-5">
      <Chip tone="brand">{t('home.startChip')}</Chip>
      <h2 className="font-display text-[20px] leading-tight font-semibold">
        {t('home.startTitle')}
      </h2>
      <p className="text-[15px] leading-normal text-muted">
        {t('home.startDescription')}
      </p>
      {/* The profile opens "Add your CV" when a link asks for it. */}
      <ButtonLink to={PROFILE_PATH} state={{ add: 'cv' }} className="gap-2">
        <Icon name="upload" size={18} />
        {t('profile.addCvButton')}
      </ButtonLink>
    </Card>
  );
};

/**
 * Render it only for an account with the interview tools on: it reads the profile, which
 * loads the profile gateway. The profile it reads stays in the store, so opening the
 * profile afterwards reads nothing again.
 */
export const StartCard: React.FC = () => (
  <ProfileGatewayProvider>
    <InterviewProfileProvider>
      <StartCardContent />
    </InterviewProfileProvider>
  </ProfileGatewayProvider>
);

export default StartCard;
