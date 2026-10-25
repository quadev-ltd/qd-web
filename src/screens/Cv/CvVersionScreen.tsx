// One CV version (C3): being made (one line, D80), taking longer than it ever does, could not be
// made ("Try again"), or made: a written CV (WrittenReview, D83) or the review of an edit version
// (CvReview). "Remove this version" is always there.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import { startTitle, versionDay, versionHeading } from './cvMeta';
import CvWayBack from './CvWayBack';
import RemoveCvVersionDialog from './RemoveCvVersionDialog';
import CvReview from './review/CvReview';
import { useCvPaths } from './useCvPaths';
import { aboutPages } from './written/writtenMeta';
import WrittenReview from './written/WrittenReview';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import {
  type CvVersion,
  isCreating,
  isWrittenVersion,
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
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

/** How often the page looks at the clock, for "taking longer than usual". */
const CLOCK_MS = 15_000;

const FAILURES = {
  model: 'cv.failedModel',
  blocked: 'cv.failedBlocked',
  quota: 'cv.failedQuota',
  internal: 'cv.failedInternal',
} as const satisfies Record<NonNullable<CvVersion['failure']>, string>;

/**
 * "Try again" after a failure: a CV written for the same target, and the failed one removed. A
 * version made before D83 is written again too, at 2 pages: no new edit version is made.
 */
const useTryAgain = (version: CvVersion | undefined) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const paths = useCvPaths();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { refreshVersion, refreshToday } = useCvVersionsActions();
  const max = useCvDailyLimit();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const start = async () => {
    if (!version) {
      return;
    }
    setBusy(true);
    setErrorMessage(undefined);
    try {
      const { versionId } = await gateway.createCvVersion({
        mode: 'write',
        target: version.target,
        // A written version tried again keeps its length and convention; an old edit version
        // is written in the one its job suggests.
        ...(isWrittenVersion(version)
          ? { pages: version.pages, convention: version.convention }
          : { pages: 2 as const }),
      });
      // The failed one keeps nothing: it goes, so the list has the new one only.
      await gateway.removeCvVersion(version.id).catch(() => undefined);
      await Promise.all([
        refreshVersion(version.id).catch(() => null),
        refreshVersion(versionId).catch(() => null),
      ]);
      navigate(paths.version(versionId), { replace: true });
    } catch (error) {
      logProfileError('createCvVersion', error, uid);
      setErrorMessage(
        getProfileErrorCode(error) === ProfileErrorCode.DailyLimit
          ? t('cv.limitMessage', { max, time: dailyLimitResetTime() })
          : t('cv.createFailedMessage'),
      );
      refreshToday();
    } finally {
      setBusy(false);
    }
  };
  return { start, busy, errorMessage };
};

export const CvVersionScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { versionId = '' } = useParams();
  const paths = useCvPaths();
  const { status, versions } = useCvVersions();
  const { reload } = useCvVersionsActions();
  const max = useCvDailyLimit();
  const { applications } = useApplications();
  const { resources } = useInterviewProfile();
  const [removing, setRemoving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const version = versions.find(({ id }) => id === versionId);
  const tryAgain = useTryAgain(version);
  const creating = version?.status === 'creating';
  // Only a version being made changes with the clock.
  useEffect(() => {
    if (!creating) {
      return undefined;
    }
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, [creating]);

  const frame = (children: React.ReactNode) => (
    <SignedInShell
      title={t('cv.versionDocumentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <CvWayBack paths={paths} />
        {children}
      </div>
    </SignedInShell>
  );

  if (status === 'idle' || status === 'loading') {
    return frame(
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>,
    );
  }
  if (status === 'error') {
    return frame(
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('cv.retryButton')}
          </Button>
        }>
        {t('cv.loadErrorMessage')}
      </Banner>,
    );
  }
  if (!version) {
    return frame(
      <Card
        elevation="raised"
        className="mx-auto w-full max-w-[560px] items-start gap-3 p-8">
        <h1 className="font-display text-[22px] leading-tight font-semibold">
          {t('cv.notFoundTitle')}
        </h1>
        <p className="text-[16px] leading-normal text-muted">
          {t('cv.notFoundDescription')}
        </p>
        <ButtonLink to={paths.list} variant="secondary" size="small">
          {t(
            paths.applicationId
              ? 'cv.backToApplicationCvButton'
              : 'cv.backToCvsButton',
          )}
        </ButtonLink>
      </Card>,
    );
  }

  const date = versionDay(version);
  const written = isWrittenVersion(version);
  let sub: string;
  if (written) {
    const pages = version.document
      ? aboutPages(t, version.document).toLowerCase()
      : t('cv.pagesAsked', { count: version.pages });
    sub = t(
      version.target.kind === 'job' ? 'cv.writtenJobSub' : 'cv.writtenSub',
      { date, pages },
    );
  } else {
    sub = t(
      version.target.kind === 'job' ? 'cv.tailoredSub' : 'cv.generalSub',
      { date, title: startTitle(t, version, resources) },
    );
  }
  const rewrittenFrom =
    written && version.rewrittenFrom
      ? versions.find(({ id }) => id === version.rewrittenFrom)
      : undefined;
  const lost = creating && !isCreating(version, now);
  // Another version made for the same job (or general) to compare it with.
  const comparable =
    version.status === 'ready' &&
    versions.some(
      other =>
        other.id !== version.id &&
        other.status === 'ready' &&
        (other.target.kind === 'job'
          ? version.target.kind === 'job' &&
            other.target.applicationId === version.target.applicationId
          : version.target.kind === 'general'),
    );
  const original = version.copiedFrom
    ? versions.find(({ id }) => id === version.copiedFrom)
    : undefined;

  let body: React.ReactNode;
  if (creating && !lost) {
    body = (
      <Card
        role="status"
        elevation="raised"
        className="mx-auto mt-4 w-full max-w-[620px] gap-4 p-8">
        <div className="flex items-center gap-4">
          <span className="flex text-primary">
            <Spinner decorative />
          </span>
          <h2 className="font-display text-[22px] leading-tight font-semibold">
            {t(written ? 'cv.writingTitle' : 'cv.creatingTitle')}
          </h2>
        </div>
        <p className="text-base leading-normal text-muted">
          {t(written ? 'cv.writingDescription' : 'cv.creatingDescription')}
        </p>
        {written && (
          <>
            <div className="h-px bg-border-faint" />
            <p className="flex items-start gap-2 text-[15px] leading-normal text-muted">
              <span className="flex pt-0.5 text-primary">
                <Icon name="check" size={18} />
              </span>
              {t('cv.writingChecks')}
            </p>
          </>
        )}
      </Card>
    );
  } else if (lost) {
    body = (
      <div
        role="status"
        className="mx-auto mt-4 flex w-full max-w-[620px] flex-col gap-3 rounded-card bg-warning-tint p-6">
        <h2 className="font-display text-[20px] leading-tight font-semibold">
          {t('cv.stuckTitle')}
        </h2>
        <p className="text-base leading-normal">{t('cv.stuckDescription')}</p>
        <Button
          variant="danger"
          size="small"
          onClick={() => setRemoving(true)}
          className="gap-2 self-start">
          <Icon name="trash" size={18} />
          {t('cv.removeVersionButton')}
        </Button>
      </div>
    );
  } else if (version.status === 'failed') {
    body = (
      <Card
        role="alert"
        elevation="raised"
        className="mx-auto mt-4 w-full max-w-[620px] gap-3.5 p-8">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-danger-tint text-danger">
          <Icon name="alert" size={24} />
        </span>
        <h2 className="font-display text-[22px] leading-tight font-semibold">
          {t(written ? 'cv.writeFailedTitle' : 'cv.failedTitle')}
        </h2>
        <p className="text-base leading-normal text-muted">
          {t(FAILURES[version.failure ?? 'internal'], {
            max,
            time: dailyLimitResetTime(),
          })}
        </p>
        {tryAgain.errorMessage && (
          <Banner tone="danger">{tryAgain.errorMessage}</Banner>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={tryAgain.busy}
            aria-busy={tryAgain.busy}
            onClick={() => {
              tryAgain.start();
            }}
            className="gap-2">
            {tryAgain.busy ? (
              <Spinner size="small" decorative />
            ) : (
              <Icon name="refresh" size={18} />
            )}
            {t('cv.tryAgainButton')}
          </Button>
          <ButtonLink to={paths.list} variant="secondary">
            {t(
              paths.applicationId
                ? 'cv.backToApplicationCvButton'
                : 'cv.backToCvsButton',
            )}
          </ButtonLink>
        </div>
      </Card>
    );
  } else if (written) {
    body = version.document ? (
      <WrittenReview
        version={{ ...version, document: version.document }}
        fileTitle={t('cv.fileTitle', {
          heading: versionHeading(t, version, applications),
          date,
        })}
        writtenAgainDay={rewrittenFrom ? versionDay(rewrittenFrom) : undefined}
      />
    ) : (
      <Banner tone="danger" role="alert">
        {t('cv.loadErrorMessage')}
      </Banner>
    );
  } else {
    body = (
      <CvReview
        version={version}
        cvTitle={startTitle(t, version, resources)}
        fileTitle={t('cv.fileTitle', {
          heading: versionHeading(t, version, applications),
          date,
        })}
      />
    );
  }

  return frame(
    <>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <h1 className="font-display text-[28px] leading-tight font-semibold wrap-anywhere">
            {versionHeading(t, version, applications)}
          </h1>
          <p className="text-[16px] leading-normal text-muted">{sub}</p>
          {original && (
            <p className="text-sm leading-normal text-muted">
              {t('cv.copiedFrom', { date: versionDay(original) })}
            </p>
          )}
          {written && rewrittenFrom && (
            <p className="text-sm leading-normal text-muted">
              {(() => {
                const answers = version.statements.filter(
                  ({ kind }) => kind === 'answer',
                ).length;
                const day = versionDay(rewrittenFrom);
                return answers > 0
                  ? t('cv.writtenAgainFromAnswers', {
                      date: day,
                      count: answers,
                    })
                  : t('cv.writtenAgainFrom', { date: day });
              })()}{' '}
              <Link
                to={paths.version(rewrittenFrom.id)}
                className="font-medium whitespace-nowrap">
                {t('cv.openVersionOf', { date: versionDay(rewrittenFrom) })}
              </Link>
            </p>
          )}
        </div>
        {comparable && (
          <ButtonLink
            to={paths.compare(version.id)}
            variant="secondary"
            size="small">
            {t('cv.compareButton')}
          </ButtonLink>
        )}
        {!lost && (
          <Button
            variant="quietDanger"
            size="small"
            onClick={() => setRemoving(true)}
            className="gap-2">
            <Icon name="trash" size={18} />
            {t('cv.removeVersionButton')}
          </Button>
        )}
      </div>
      {body}
      {removing && (
        <RemoveCvVersionDialog
          versionId={version.id}
          date={date}
          onCancel={() => setRemoving(false)}
          onRemoved={() => navigate(paths.list, { replace: true })}
        />
      )}
    </>,
  );
};

export default CvVersionScreen;
