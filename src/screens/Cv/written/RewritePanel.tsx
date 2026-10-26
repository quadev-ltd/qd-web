// "Write this CV again" (D97, Web-C3-Write-Notes-Again): opened by "Change it and write again" and
// by the questions' "Write again". What was asked of this CV is filled in, to change or clear first;
// the new version is written from the profile, the answers and what the box shows (empty: nothing).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import AskedField from '../AskedField';
import { versionHeading } from '../cvMeta';
import { useCvPaths } from '../useCvPaths';

import SidePanel from '@/components/ui/SidePanel';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import {
  CV_ASKED_MAX_CHARS,
  CV_VERSIONS_MAX,
  type CvWrittenVersion,
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
import { dailyLimitResetTime } from '@/core/profile/limits';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import SubmitFooter from '@/screens/Applications/SubmitFooter';

export const RewritePanel: React.FC<{
  version: CvWrittenVersion;
  onClose: () => void;
}> = ({ version, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const paths = useCvPaths();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { applications } = useApplications();
  const { madeToday } = useCvVersions();
  const { refreshVersion, refreshToday } = useCvVersionsActions();
  const max = useCvDailyLimit();
  const [asked, setAsked] = useState(version.asked ?? '');
  const [cleared, setCleared] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const left = madeToday === null ? null : Math.max(0, max - madeToday);
  const tooLong = asked.trim().length > CV_ASKED_MAX_CHARS;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (tooLong) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      // What the box shows: empty, the CV is written without anything asked.
      const { versionId } = await gateway.rewriteCvVersion(
        version.id,
        asked.trim() || undefined,
      );
      await refreshVersion(versionId).catch(() => null);
      navigate(paths.version(versionId));
    } catch (error) {
      logProfileError('rewriteCvVersion', error, uid);
      switch (getProfileErrorCode(error)) {
        case ProfileErrorCode.DailyLimit:
          setErrorMessage(
            t('cv.limitMessage', { max, time: dailyLimitResetTime() }),
          );
          break;
        case ProfileErrorCode.MaxCvVersions:
          setErrorMessage(t('cv.maxMessage', { max: CV_VERSIONS_MAX }));
          break;
        default:
          setErrorMessage(t('cv.rewriteFailedMessage'));
      }
      refreshToday();
      setIsBusy(false);
    }
  };

  return (
    <SidePanel
      title={t('cv.rewriteTitle')}
      description={versionHeading(t, version, applications)}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
        <AskedField
          value={asked}
          onChange={setAsked}
          carried={
            version.asked && !cleared ? t('cv.askedCarriedRewrite') : undefined
          }
          onClear={() => {
            setAsked('');
            setCleared(true);
          }}
          disabled={isBusy}
        />
        <p className="text-sm leading-normal text-muted">
          {t('cv.rewriteText')}
        </p>
        <SubmitFooter
          errorMessage={errorMessage}
          isBusy={isBusy}
          blocked={tooLong || left === 0}
          label={t('cv.writeAgainButton')}
          busyLabel={t('cv.writingAgainButton')}
        />
        <p className="-mt-2 text-center text-sm leading-normal text-muted">
          {left === null
            ? t('cv.takesMinuteOnly')
            : left === 0
              ? t('cv.takesMinuteNone')
              : t('cv.takesMinute', { left, max })}
        </p>
      </form>
    </SidePanel>
  );
};

export default RewritePanel;
