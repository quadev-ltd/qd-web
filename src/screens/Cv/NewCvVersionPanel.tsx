// "New CV version" (C3, D69, D75, D80, D81): one panel for a version for a job or in general.
// Opened from "New version" it asks what the version is for; the first screen's two cards open
// it with that chosen. "Start from" shows only with two or more CVs; the length is under "More
// options"; every version is a UK CV, which the panel says instead of asking.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import ChoiceGroup from './ChoiceGroup';
import { usableCvsOf } from './cvMeta';

import FormTextInput from '@/components/FormTextInput';
import Icon from '@/components/Icon';
import Banner from '@/components/ui/Banner';
import SegmentedControl from '@/components/ui/SegmentedControl';
import SidePanel from '@/components/ui/SidePanel';
import { type JobApplication, jobStatusOf } from '@/core/profile/applications';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import {
  CV_DAILY_VERSIONS,
  CV_ROLE_MAX_CHARS,
  CV_VERSION_LENGTHS,
  CV_VERSIONS_MAX,
  type CvVersionLength,
} from '@/core/profile/cvVersions';
import {
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
import { cvVersionPath } from '@/core/profile/paths';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import SubmitFooter from '@/screens/Applications/SubmitFooter';
import { contentOf, formatDay } from '@/screens/Profile/Resource/resourceMeta';

export type CvVersionKind = 'job' | 'general';

/** A job a version can be tailored to: read, with its text. */
const tailorable = (application: JobApplication) =>
  jobStatusOf(application) === 'ready' && Boolean(application.jobDescription);

export interface NewCvVersionPanelProps {
  /** What the version is for, when it was chosen before the panel opened. */
  kind?: CvVersionKind;
  /** Asks "What is it for?" (opened from "New version"). */
  ask: boolean;
  onClose: () => void;
}

export const NewCvVersionPanel: React.FC<NewCvVersionPanelProps> = ({
  kind: initialKind = 'job',
  ask,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { resources } = useInterviewProfile();
  const { applications } = useApplications();
  const { versions, madeToday } = useCvVersions();
  const { refreshVersion, refreshToday } = useCvVersionsActions();
  const jobs = applications.filter(tailorable);
  const cvs = usableCvsOf(resources);

  const [kind, setKind] = useState<CvVersionKind>(initialKind);
  const [applicationId, setApplicationId] = useState(jobs[0]?.id);
  const [role, setRole] = useState('');
  const [resourceId, setResourceId] = useState(cvs[0]?.id);
  const [length, setLength] = useState<CvVersionLength>('same');
  const [moreOpen, setMoreOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [limitRefused, setLimitRefused] = useState(false);

  const left =
    madeToday === null ? null : Math.max(0, CV_DAILY_VERSIONS - madeToday);
  const limitReached = left === 0 || limitRefused;
  const full = versions.length >= CV_VERSIONS_MAX;
  const trimmedRole = role.trim();
  const roleTooLong = trimmedRole.length > CV_ROLE_MAX_CHARS;
  const others = resources.length - 1;
  const blocked =
    limitReached ||
    full ||
    !resourceId ||
    (kind === 'job' ? !applicationId : roleTooLong);

  const messageFor = (error: unknown) => {
    switch (getProfileErrorCode(error)) {
      case ProfileErrorCode.DailyLimit:
        setLimitRefused(true);
        return undefined;
      case ProfileErrorCode.MaxCvVersions:
        return t('cv.maxMessage', { max: CV_VERSIONS_MAX });
      case ProfileErrorCode.NoCvText:
        return t('cv.noCvTextMessage');
      case ProfileErrorCode.FlagOff:
        return t('cv.notAvailableMessage');
      default:
        return t('cv.createFailedMessage');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (blocked || !resourceId) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      const { versionId } = await gateway.createCvVersion({
        resourceId,
        target:
          kind === 'job' && applicationId
            ? { kind: 'job', applicationId }
            : {
                kind: 'general',
                ...(trimmedRole ? { role: trimmedRole } : {}),
              },
        ...(length === 'same' ? {} : { length }),
      });
      // Into the list before its page opens; the page follows it while it is made.
      await refreshVersion(versionId).catch(() => null);
      navigate(cvVersionPath(versionId));
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
            {t('cv.limitMessage', {
              max: CV_DAILY_VERSIONS,
              time: dailyLimitResetTime(),
            })}
          </Banner>
        )}
        {full && (
          <Banner>{t('cv.maxMessage', { max: CV_VERSIONS_MAX })}</Banner>
        )}
        {ask && (
          <ChoiceGroup
            label={t('cv.forLabel')}
            value={kind}
            onChange={setKind}
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
              onChange={setApplicationId}
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
        {cvs.length === 0 && (
          <Banner tone="info">{t('cv.noCvTextMessage')}</Banner>
        )}
        {cvs.length > 1 && (
          <ChoiceGroup
            label={t('cv.startFromLabel')}
            value={resourceId}
            onChange={setResourceId}
            disabled={isBusy}
            choices={cvs.map(cv => {
              const content = contentOf(cv);
              return {
                value: cv.id,
                title: cv.title,
                meta: t('cv.cvOptionMeta', {
                  content: 'host' in content ? content.host : t(content.key),
                  date: cv.createdAt === null ? '' : formatDay(cv.createdAt),
                }),
              };
            })}
          />
        )}
        <div className="flex flex-col gap-4 border-t border-border-subtle">
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(open => !open)}
            className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 pt-2 text-left text-text">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base leading-normal font-medium">
                {t('cv.moreOptions')}
              </span>
              {!moreOpen && (
                <span className="text-sm leading-normal text-muted">
                  {t(`cv.lengthSummary_${length}`)}
                </span>
              )}
            </span>
            <Icon name={moreOpen ? 'up' : 'down'} size={18} />
          </button>
          {moreOpen && (
            <SegmentedControl
              label={t('cv.lengthLabel')}
              options={CV_VERSION_LENGTHS.map(value => ({
                value,
                label: t(`cv.length_${value}`),
              }))}
              value={length}
              onChange={setLength}
              disabled={isBusy}
            />
          )}
        </div>
        <p className="flex items-start gap-2 text-sm leading-normal text-muted">
          <span className="flex pt-0.5 text-primary">
            <Icon name="file" size={18} />
          </span>
          {t('cv.ukLine')}
        </p>
        {others > 0 && (
          <p className="flex items-start gap-2 text-sm leading-normal text-muted">
            <span className="flex pt-0.5 text-primary">
              <Icon name="user" size={18} />
            </span>
            {t('cv.usesProfile', { count: others })}
          </p>
        )}
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
              : t('cv.takesMinute', { left, max: CV_DAILY_VERSIONS })}
        </p>
      </form>
    </SidePanel>
  );
};

export default NewCvVersionPanel;
