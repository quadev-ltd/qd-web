// "What do you want to do?" (D58, D91): the three paths of an account with no application yet,
// under the profile. No order and no numbers. "Prepare for a job" opens Applications with "New
// application" open; practice is not built yet; the CV tool has its own flag.
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import Icon, { type IconName } from '@/components/Icon';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useFlag } from '@/core/flags/FlagsProvider';
import { APPLICATIONS_PATH, CV_PATH } from '@/core/profile/paths';

/** What a link to the applications can ask for: "Prepare for a job" opens "New application". */
export const NEW_APPLICATION_STATE = { add: 'application' } as const;

export const asksForNewApplication = (state: unknown): boolean =>
  (state as { add?: unknown } | null)?.add === NEW_APPLICATION_STATE.add;

interface PathCardProps {
  icon: IconName;
  title: string;
  description: string;
  /** Opens the path; without it the path is not built yet and says "Coming soon". */
  onOpen?: () => void;
}

const PathCard: React.FC<PathCardProps> = ({
  icon,
  title,
  description,
  onOpen,
}) => {
  const { t } = useTranslation();
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex size-11 flex-none items-center justify-center rounded-full bg-tint text-primary">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="text-base leading-normal font-bold">{title}</span>
        <span className="text-sm leading-normal text-muted">{description}</span>
        {/* Under the words, so a narrow card keeps its width for them. */}
        {!onOpen && (
          <span className="mt-1.5 flex">
            <Chip>{t('home.comingSoonChip')}</Chip>
          </span>
        )}
      </span>
    </>
  );
  return (
    <Card as="article" elevation="raised" className="p-4">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full cursor-pointer items-center gap-3 rounded-control text-text">
          {body}
          <span className="flex text-muted">
            <Icon name="right" />
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3">{body}</div>
      )}
    </Card>
  );
};

export const StartPaths: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cvTool = useFlag('cvTool');
  return (
    <section aria-labelledby="start-paths" className="flex flex-col gap-4">
      <h2
        id="start-paths"
        className="font-display text-[20px] leading-natural font-semibold">
        {t('home.pathsTitle')}
      </h2>
      <div className="flex flex-col gap-3">
        <PathCard
          icon="case"
          title={t('home.prepareTitle')}
          description={t('home.prepareDescription')}
          onOpen={() =>
            navigate(APPLICATIONS_PATH, { state: NEW_APPLICATION_STATE })
          }
        />
        <PathCard
          icon="mic"
          title={t('home.practiseTitle')}
          description={t('home.practiseDescription')}
        />
        <PathCard
          icon="file"
          title={t('home.improveCvTitle')}
          description={t('home.improveCvDescription')}
          onOpen={cvTool ? () => navigate(CV_PATH) : undefined}
        />
      </div>
    </section>
  );
};

export default StartPaths;
