// "Only in this CV" (D97): a line of what the candidate asked of this CV that a line cites. It isn't
// in the profile, so other CVs and the briefs can't use it, until "Add it to my profile as a note",
// which reads it as any note added (one of the day's readings).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import {
  PROFILE_DAILY_EXTRACTIONS,
  PROFILE_MAX_RESOURCES,
} from '@/core/profile/contract';
import { type CvStatement } from '@/core/profile/cvVersions';
import { useCvVersionsActions } from '@/core/profile/CvVersionsProvider';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { useInterviewProfileActions } from '@/core/profile/InterviewProfileProvider';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { resourcePath } from '@/core/profile/paths';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

export const NoteToProfile: React.FC<{
  versionId: string;
  /** The version's day, for the note's title: "Added from your CV of 15 Oct 2026". */
  versionDay: string;
  statement: CvStatement;
}> = ({ versionId, versionDay, statement }) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { refreshVersion } = useCvVersionsActions();
  const { refreshResource, watchResource } = useInterviewProfileActions();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  // Added here, or found to be there already: until the version is read again.
  const [added, setAdded] = useState<string | true>();
  const resourceId = statement.resourceId ?? added;

  const add = async () => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      const { resourceId: created } = await gateway.addCvNoteToProfile(
        versionId,
        statement.id,
        t('cv.noteTitle', { date: versionDay }),
      );
      setAdded(created);
      // The note is read like any other: the profile follows it.
      await refreshResource(created).catch(() => null);
      watchResource(created);
      await refreshVersion(versionId).catch(() => null);
    } catch (error) {
      logProfileError('addCvNoteToProfile', error, uid);
      switch (getProfileErrorCode(error)) {
        case ProfileErrorCode.AlreadyAdded:
          setAdded(true);
          break;
        case ProfileErrorCode.MaxResources:
          setErrorMessage(
            t('profile.fullMessage', { max: PROFILE_MAX_RESOURCES }),
          );
          break;
        case ProfileErrorCode.DailyLimit:
          setErrorMessage(
            t('profile.dailyLimitMessage', {
              max: PROFILE_DAILY_EXTRACTIONS,
              time: dailyLimitResetTime(),
            }),
          );
          break;
        default:
          setErrorMessage(t('cv.addNoteFailedMessage'));
      }
    } finally {
      setBusy(false);
    }
  };

  if (resourceId) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-normal">
        <span className="flex items-center gap-1.5 font-medium text-success">
          <Icon name="check" size={18} />
          {t('cv.noteAddedText')}
        </span>
        {typeof resourceId === 'string' && (
          <Link to={resourcePath(resourceId)} className="font-medium">
            {t('cv.openNoteLink')}
          </Link>
        )}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium tracking-[0.02em] text-muted">
        {t('cv.onlyInThisCv')}
      </p>
      <p className="text-sm leading-normal text-muted">
        {t('cv.onlyInThisCvText')}
      </p>
      {errorMessage && (
        <Banner tone="danger" role="alert">
          {errorMessage}
        </Banner>
      )}
      <Button
        variant="secondary"
        size="small"
        disabled={busy}
        aria-busy={busy}
        onClick={() => {
          add();
        }}
        className="gap-2 self-start text-[15px]">
        {busy ? (
          <Spinner size="small" decorative />
        ) : (
          <Icon name="plus" size={18} />
        )}
        {busy ? t('cv.addingNoteButton') : t('cv.addNoteButton')}
      </Button>
      <p className="text-sm leading-normal text-muted">
        {t('cv.addNoteReading', { max: PROFILE_DAILY_EXTRACTIONS })}
      </p>
    </div>
  );
};

export default NoteToProfile;
