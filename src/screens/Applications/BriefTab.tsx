// The brief of an application (A2): prepared on request with one model call (up to a minute),
// then what the job asks for and the likely questions. Out of date when the job or the profile
// changed since; a failed attempt keeps the brief there was.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ProfileLookup,
  QuestionsCard,
  RequirementsCard,
} from './BriefCards';
import EditApplicationPanel from './EditApplicationPanel';
import JobStatusPanel from './JobStatusPanel';
import { useReadPostingAgain } from './useReadPostingAgain';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  BRIEF_DAILY_LIMIT,
  briefStateOf,
  type JobApplication,
  jobStatusOf,
} from '@/core/profile/applications';
import {
  useApplications,
  useApplicationsActions,
} from '@/core/profile/ApplicationsProvider';
import { type SkillMapItem } from '@/core/profile/contract';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import useBriefPractice from '@/screens/Practice/useBriefPractice';
import AddResourcePanel from '@/screens/Profile/AddResource/AddResourcePanel';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/**
 * The profile's items, read when there is a brief to show them in, and again when the brief
 * is prepared again. Each item is a billed read, so nothing else reads them.
 */
const useProfileItems = (
  briefBuiltAt: number | null | undefined,
): Map<string, SkillMapItem> | null => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const [items, setItems] = useState<Map<string, SkillMapItem> | null>(null);
  useEffect(() => {
    if (!uid || briefBuiltAt === undefined) {
      return undefined;
    }
    let live = true;
    gateway.getItems(uid).then(
      list => {
        if (live) {
          setItems(new Map(list.map(item => [item.id, item])));
        }
      },
      error => {
        logProfileError('getItems', error, uid);
        // The brief still shows what each requirement is, without the items.
        if (live) {
          setItems(new Map());
        }
      },
    );
    return () => {
      live = false;
    };
  }, [briefBuiltAt, gateway, uid]);
  return items;
};

export const BriefTab: React.FC<{ application: JobApplication }> = ({
  application,
}) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { profileRevision } = useApplications();
  const { refreshApplication, refreshProfileRevision } =
    useApplicationsActions();
  const { status: profileStatus, resources } = useInterviewProfile();
  const [preparing, setPreparing] = useState(false);
  const [failure, setFailure] = useState<'model' | 'limit' | null>(null);
  const [briefsToday, setBriefsToday] = useState<number | null>(null);
  const [adding, setAdding] = useState<'cv' | 'note'>();
  const [pasting, setPasting] = useState(false);
  const { brief } = application;
  const items = useProfileItems(brief?.builtAt);
  // D94: each likely question can be practised.
  const practice = useBriefPractice(application);
  // After a failed first reading, a posting can be tried again; its text was never edited.
  const tryAgain = useReadPostingAgain(application.id, false);

  // Today's count, for "3 of 10 left today": read again after each brief.
  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    gateway.getBriefsToday(uid).then(
      count => live && setBriefsToday(count),
      () => live && setBriefsToday(null),
    );
    return () => {
      live = false;
    };
  }, [gateway, uid, brief?.builtAt]);

  const limitReached =
    failure === 'limit' ||
    (briefsToday !== null && briefsToday >= BRIEF_DAILY_LIMIT);
  const emptyProfile =
    profileStatus === 'loaded' &&
    !resources.some(({ status }) => status === 'ready');
  const state = briefStateOf(application, profileRevision);
  const lookup: ProfileLookup = { items, resources };

  const prepare = async () => {
    setPreparing(true);
    setFailure(null);
    try {
      await gateway.prepareBrief(application.id);
      await refreshApplication(application.id).catch(() => null);
    } catch (error) {
      logProfileError('prepareBrief', error, uid);
      setFailure(
        getProfileErrorCode(error) === ProfileErrorCode.DailyLimit
          ? 'limit'
          : 'model',
      );
    } finally {
      setPreparing(false);
    }
  };

  const refreshButton = (variant: 'primary' | 'quiet') => (
    <Button
      variant={variant}
      size="small"
      onClick={prepare}
      disabled={preparing || limitReached}
      className="gap-2">
      <Icon name="refresh" size={18} />
      {t('applications.refreshButton')}
    </Button>
  );

  const banners = (
    <>
      {failure === 'limit' && (
        <Banner tone="warning" role="alert">
          {t('applications.briefLimitMessage', {
            max: BRIEF_DAILY_LIMIT,
            time: dailyLimitResetTime(),
          })}
        </Banner>
      )}
      {failure === 'model' && (
        <Banner
          tone="danger"
          role="alert"
          action={
            <Button
              variant="quiet"
              size="small"
              onClick={prepare}
              disabled={preparing || limitReached}>
              {t('applications.tryAgainButton')}
            </Button>
          }>
          {t(
            brief
              ? 'applications.briefFailedKeptMessage'
              : 'applications.briefFailedMessage',
          )}
        </Banner>
      )}
      {emptyProfile && (
        <Banner
          tone="info"
          action={
            <Button
              variant="quiet"
              size="small"
              onClick={() => setAdding('cv')}>
              {t('applications.addCvButton')}
            </Button>
          }>
          {t(
            brief
              ? 'applications.emptyProfileMessage'
              : 'applications.emptyProfileBeforeMessage',
          )}
        </Banner>
      )}
    </>
  );

  const preparingStatus = (
    <Card
      elevation="raised"
      role="status"
      className="items-center gap-3 px-6 py-12 text-center">
      <span className="flex text-primary">
        <Spinner decorative />
      </span>
      <h2 className="font-display text-[20px] leading-tight font-semibold">
        {t('applications.preparingTitle')}
      </h2>
      <p className="max-w-[360px] text-[15px] leading-normal text-muted">
        {t('applications.preparingDescription')}
      </p>
    </Card>
  );

  const panel = adding && (
    <AddResourcePanel
      kind={adding}
      onClose={() => {
        setAdding(undefined);
        // A note or a CV changes the profile: the brief may now be out of date.
        refreshProfileRevision();
      }}
    />
  );

  // The job is read first: until it is ready, there is nothing to prepare a brief from.
  if (jobStatusOf(application) !== 'ready') {
    return (
      <div className="flex flex-col gap-5">
        <JobStatusPanel
          application={application}
          onPaste={() => setPasting(true)}
          tryAgain={{
            start: () => {
              tryAgain.start();
            },
            busy: tryAgain.busy,
            errorMessage: tryAgain.errorMessage,
          }}
        />
        {pasting && (
          <EditApplicationPanel
            application={application}
            onClose={() => setPasting(false)}
          />
        )}
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="flex flex-col gap-5">
        {banners}
        {preparing ? (
          preparingStatus
        ) : (
          <Card
            elevation="raised"
            className="items-center gap-3 px-6 py-10 text-center">
            <span
              aria-hidden="true"
              className="flex size-16 flex-none items-center justify-center rounded-full bg-tint text-primary">
              <Icon name="case" size={28} />
            </span>
            <h2 className="font-display text-[20px] leading-tight font-semibold">
              {t('applications.prepareTitle')}
            </h2>
            <p className="max-w-[480px] text-[15px] leading-normal text-muted">
              {t('applications.prepareDescription')}
            </p>
            <Button onClick={prepare} disabled={limitReached} className="mt-1">
              {t('applications.prepareButton')}
            </Button>
          </Card>
        )}
        {panel}
      </div>
    );
  }

  const meta = [
    brief.builtAt !== null &&
      t('applications.preparedOn', { date: formatDay(brief.builtAt) }),
    briefsToday !== null &&
      t('applications.briefsLeft', {
        left: Math.max(0, BRIEF_DAILY_LIMIT - briefsToday),
        max: BRIEF_DAILY_LIMIT,
      }),
    state.kind === 'outOfDate' &&
      state.because === 'profile' &&
      t('applications.profileChanged'),
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      {banners}
      {state.kind === 'outOfDate' && state.because === 'job' && (
        <Banner tone="warning" action={refreshButton('primary')}>
          {t('applications.jobChanged')}
        </Banner>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm leading-normal text-muted">
          {meta.join(' · ')}
        </p>
        {!(state.kind === 'outOfDate' && state.because === 'job') &&
          refreshButton('quiet')}
      </div>
      {preparing && preparingStatus}
      <div className="flex flex-wrap items-start gap-5">
        <RequirementsCard
          requirements={brief.requirements}
          lookup={lookup}
          onAddStory={() => setAdding('note')}
        />
        <QuestionsCard
          questions={brief.questions}
          lookup={lookup}
          practice={practice}
        />
      </div>
      {panel}
    </div>
  );
};

export default BriefTab;
