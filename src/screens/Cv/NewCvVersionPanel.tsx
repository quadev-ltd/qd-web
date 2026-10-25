// "New CV version" (C3, D69, D80, D83, D86, doc 13 §20.2): one panel for a CV written for a job
// or in general, from everything in the profile. Opened from "New version" it asks what the CV is
// for; the first screen's two cards open it with that chosen. It asks the length (1 or 2 pages, 2
// by default) and the convention ("Written as": UK CV, US resume or international, suggested from
// the job's country and back to the suggestion when the target changes), and shows the CV's
// details that go at the top ("Edit" opens them over it).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import ChoiceGroup from './ChoiceGroup';
import {
  CONVENTION_MEANING_KEYS,
  CONVENTION_OPTION_KEYS,
  countryName,
} from './conventions';
import { detailsLines } from './details/CvDetailsCard';
import CvDetailsPanel from './details/CvDetailsPanel';
import { useCvPaths } from './useCvPaths';

import FormTextInput from '@/components/FormTextInput';
import Icon from '@/components/Icon';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import SegmentedControl from '@/components/ui/SegmentedControl';
import SidePanel from '@/components/ui/SidePanel';
import { type JobApplication, jobStatusOf } from '@/core/profile/applications';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import { CV_PAGE_COUNTS, type CvPageCount } from '@/core/profile/cvDocument';
import {
  CV_ROLE_MAX_CHARS,
  CV_VERSION_CONVENTIONS,
  CV_VERSIONS_MAX,
  type CvVersionConvention,
  defaultCvConvention,
} from '@/core/profile/cvVersions';
import {
  useCvDailyLimit,
  useCvVersions,
  useCvVersionsActions,
} from '@/core/profile/CvVersionsProvider';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import SubmitFooter from '@/screens/Applications/SubmitFooter';

export type CvVersionKind = 'job' | 'general';

/** A job a CV can be written for: read, with its text. */
const tailorable = (application: JobApplication) =>
  jobStatusOf(application) === 'ready' && Boolean(application.jobDescription);

export interface NewCvVersionPanelProps {
  /** What the CV is for, when it was chosen before the panel opened. */
  kind?: CvVersionKind;
  /** Asks "What is it for?" (opened from "New version"). */
  ask: boolean;
  /** The job chosen to start with (an application's "New version for this job"). */
  applicationId?: string;
  onClose: () => void;
}

export const NewCvVersionPanel: React.FC<NewCvVersionPanelProps> = ({
  kind: initialKind = 'job',
  ask,
  applicationId: initialApplicationId,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // From an application's CV tab, the new version opens under the application (D96).
  const paths = useCvPaths();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { resources } = useInterviewProfile();
  const { applications } = useApplications();
  const { versions, madeToday, details } = useCvVersions();
  const { refreshVersion, refreshToday } = useCvVersionsActions();
  const max = useCvDailyLimit();
  const jobs = applications.filter(tailorable);

  const [kind, setKind] = useState<CvVersionKind>(initialKind);
  const [applicationId, setApplicationId] = useState(
    jobs.find(({ id }) => id === initialApplicationId)?.id ?? jobs[0]?.id,
  );
  const [role, setRole] = useState('');
  const [pages, setPages] = useState<CvPageCount>(2);
  // The convention the candidate picked instead of the suggestion, until the target changes.
  const [chosen, setChosen] = useState<CvVersionConvention>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [limitRefused, setLimitRefused] = useState(false);

  const left = madeToday === null ? null : Math.max(0, max - madeToday);
  const limitReached = left === 0 || limitRefused;
  const full = versions.length >= CV_VERSIONS_MAX;
  const trimmedRole = role.trim();
  const roleTooLong = trimmedRole.length > CV_ROLE_MAX_CHARS;
  const blocked =
    limitReached || full || (kind === 'job' ? !applicationId : roleTooLong);
  const application =
    kind === 'job' ? jobs.find(({ id }) => id === applicationId) : undefined;
  const suggested = defaultCvConvention({ kind }, application);
  const convention = chosen ?? suggested;
  const why =
    kind === 'general'
      ? t('cv.conventionSuggestedGeneral')
      : application?.country
        ? t('cv.conventionSuggestedFor', {
            country: countryName(application.country),
          })
        : t('cv.conventionSuggestedUnknown');
  const [who, contact] = detailsLines(details, count =>
    t('cv.detailsLinksCount', { count }),
  );

  const messageFor = (error: unknown) => {
    switch (getProfileErrorCode(error)) {
      case ProfileErrorCode.DailyLimit:
        setLimitRefused(true);
        return undefined;
      case ProfileErrorCode.MaxCvVersions:
        return t('cv.maxMessage', { max: CV_VERSIONS_MAX });
      case ProfileErrorCode.NoItems:
        return t('cv.noItemsMessage');
      case ProfileErrorCode.FlagOff:
        return t('cv.notAvailableMessage');
      default:
        return t('cv.createFailedMessage');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (blocked) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      const { versionId } = await gateway.createCvVersion({
        mode: 'write',
        target:
          kind === 'job' && applicationId
            ? { kind: 'job', applicationId }
            : {
                kind: 'general',
                ...(trimmedRole ? { role: trimmedRole } : {}),
              },
        pages,
        // Always the one shown, so the CV is what the panel said.
        convention,
      });
      // Into the list before its page opens; the page follows it while it is written.
      await refreshVersion(versionId).catch(() => null);
      navigate(paths.version(versionId));
    } catch (error) {
      logProfileError('createCvVersion', error, uid);
      setErrorMessage(messageFor(error));
      refreshToday();
      setIsBusy(false);
    }
  };

  const title =
    !ask && initialKind === 'general'
      ? t('cv.newGeneralTitle')
      : t('cv.newTitle');
  return (
    <SidePanel
      title={title}
      description={t('cv.newDescription')}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
        {limitReached && (
          <Banner>
            {max === 0
              ? t('cv.limitNoneMessage')
              : t('cv.limitMessage', { max, time: dailyLimitResetTime() })}
          </Banner>
        )}
        {full && (
          <Banner>{t('cv.maxMessage', { max: CV_VERSIONS_MAX })}</Banner>
        )}
        {ask && (
          <ChoiceGroup
            label={t('cv.forLabel')}
            value={kind}
            onChange={value => {
              setKind(value);
              setChosen(undefined);
            }}
            disabled={isBusy}
            choices={[
              { value: 'job', title: t('cv.forJob'), meta: t('cv.forJobMeta') },
              {
                value: 'general',
                title: t('cv.forGeneral'),
                meta: t('cv.forGeneralMeta'),
              },
            ]}
          />
        )}
        {kind === 'job' &&
          (jobs.length > 0 ? (
            <ChoiceGroup
              label={t('cv.jobLabel')}
              value={applicationId}
              onChange={value => {
                setApplicationId(value);
                setChosen(undefined);
              }}
              disabled={isBusy}
              choices={jobs.map(job => ({
                value: job.id,
                title: job.title,
                meta: job.company,
              }))}
            />
          ) : (
            <Banner tone="info">{t('cv.noJobsMessage')}</Banner>
          ))}
        {kind === 'general' && (
          <FormTextInput
            name="role"
            label={t('cv.roleLabel')}
            value={role}
            onChange={event => setRole(event.target.value)}
            placeholder={t('cv.rolePlaceholder')}
            hint={t('cv.roleHint')}
            error={
              roleTooLong
                ? { type: 'custom', message: t('cv.roleLengthError') }
                : undefined
            }
            disabled={isBusy}
            counter={{ length: trimmedRole.length, max: CV_ROLE_MAX_CHARS }}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <SegmentedControl
            label={t('cv.lengthLabel')}
            options={CV_PAGE_COUNTS.map(count => ({
              value: String(count) as `${CvPageCount}`,
              label: t('cv.pagesOption', { count }),
            }))}
            value={`${pages}`}
            onChange={value => setPages(Number(value) as CvPageCount)}
            disabled={isBusy}
          />
          <p className="text-sm leading-normal text-muted">
            {t('cv.pagesHint')}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <SegmentedControl
            label={t('cv.conventionLabel')}
            options={CV_VERSION_CONVENTIONS.map(value => ({
              value,
              label: t(CONVENTION_OPTION_KEYS[value]),
            }))}
            value={convention}
            onChange={setChosen}
            disabled={isBusy}
          />
          <p className="text-sm leading-normal text-muted">
            {t(CONVENTION_MEANING_KEYS[convention])}
            {convention === suggested && ` ${why}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-border-subtle px-3.5 py-3">
          <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
            <span className="text-sm leading-normal font-medium">
              {t('cv.atTheTop')}
            </span>
            <span className="text-[15px] leading-normal wrap-anywhere">
              {who || contact || t('cv.atTheTopNone')}
            </span>
            {who && contact && (
              <span className="text-sm leading-normal text-muted wrap-anywhere">
                {contact}
              </span>
            )}
          </div>
          <Button
            variant="quiet"
            size="small"
            disabled={isBusy}
            aria-label={t('cv.atTheTopEditLabel')}
            onClick={() => setDetailsOpen(true)}
            className="gap-2">
            <Icon name="edit" size={18} />
            {t('cv.atTheTopEdit')}
          </Button>
        </div>
        <p className="flex items-start gap-2 text-sm leading-normal text-muted">
          <span className="flex pt-0.5 text-primary">
            <Icon name="user" size={18} />
          </span>
          {t('cv.writtenFromProfile', { count: resources.length })}
        </p>
        <SubmitFooter
          errorMessage={errorMessage}
          isBusy={isBusy}
          blocked={blocked}
          label={t('cv.createButton')}
          busyLabel={t('cv.creatingButton')}
        />
        <p className="-mt-2 text-center text-sm leading-normal text-muted">
          {left === null
            ? t('cv.takesMinuteOnly')
            : left === 0
              ? t('cv.takesMinuteNone')
              : t('cv.takesMinute', { left, max })}
        </p>
      </form>
      {detailsOpen && <CvDetailsPanel onClose={() => setDetailsOpen(false)} />}
    </SidePanel>
  );
};

export default NewCvVersionPanel;
