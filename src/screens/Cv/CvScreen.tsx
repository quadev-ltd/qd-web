// The CV section (C1, D69, D75, D83, doc 13 §20.4): with nothing in the profile, "Add to your
// profile first"; with no version yet, the two ways in ("Write a CV for a job", "Write a general
// CV"); then the versions, by application ("For a job") and "General", with one "New version".
// The CV's details ("At the top of every CV") are on both. At /cv/details, where the account
// page leads (D85), "Your CV details" opens over the page once it is read; closed, the address
// is /cv again.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useMatch, useNavigate } from 'react-router';

import { applicationOf, generalTitle, versionDay, versionMeta } from './cvMeta';
import CvDetailsCard from './details/CvDetailsCard';
import CvDetailsPanel from './details/CvDetailsPanel';
import NewCvVersionPanel, { type CvVersionKind } from './NewCvVersionPanel';
import { useCvPaths } from './useCvPaths';

import Icon, { type IconName } from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import {
  type CvVersion,
  isCreating,
  isWrittenVersion,
  openReviews,
} from '@/core/profile/cvVersions';
import {
  useCvVersions,
  useCvVersionsActions,
} from '@/core/profile/CvVersionsProvider';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import {
  applicationPath,
  CV_DETAILS_PATH,
  CV_PATH,
  PROFILE_PATH,
} from '@/core/profile/paths';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

type Panel = { kind?: CvVersionKind; ask: boolean };

/** "How we keep it true" (C1): what every version keeps to (FR-27). */
const TRUST = [
  ['check', 'cv.trustSources'],
  ['help', 'cv.trustQuestions'],
  ['edit', 'cv.trustAccept'],
] as const satisfies readonly (readonly [IconName, string])[];

/** Where a version is, in chips: being made, could not be made, or what is left to review. */
const VersionChips: React.FC<{ version: CvVersion }> = ({ version }) => {
  const { t } = useTranslation();
  if (version.status === 'creating') {
    return isCreating(version) ? (
      <Chip>
        <Spinner size="tiny" decorative />
        {t(isWrittenVersion(version) ? 'cv.writingChip' : 'cv.creatingChip')}
      </Chip>
    ) : (
      <Chip tone="danger" icon="alert">
        {t('cv.failedChip')}
      </Chip>
    );
  }
  if (version.status === 'failed') {
    return (
      <Chip tone="danger" icon="alert">
        {t('cv.failedChip')}
      </Chip>
    );
  }
  if (isWrittenVersion(version)) {
    // A written version holds nothing back: its open questions are worth saying.
    const asked = version.questions.filter(
      ({ status }) => status === 'open',
    ).length;
    return asked > 0 ? (
      <Chip icon="help">{t('cv.questionsChip', { count: asked })}</Chip>
    ) : (
      <Chip tone="success" icon="check">
        {t('cv.readyChip')}
      </Chip>
    );
  }
  const changes = version.changes.filter(
    ({ decision }) => decision === 'open',
  ).length;
  const questions = version.questions.filter(
    ({ status }) => status === 'open',
  ).length;
  if (openReviews(version) === 0) {
    return (
      <Chip tone="success" icon="check">
        {t('cv.readyChip')}
      </Chip>
    );
  }
  return (
    <>
      {changes > 0 && (
        <Chip tone="warning" icon="alert">
          {t('cv.changesToReview', { count: changes })}
        </Chip>
      )}
      {questions > 0 && (
        <Chip icon="help">{t('cv.questionsChip', { count: questions })}</Chip>
      )}
    </>
  );
};

export const VersionRow: React.FC<{
  version: CvVersion;
  title: string;
  meta: string;
  /** In an application's CV tab: the version opens under the application (D96). */
  applicationId?: string;
}> = ({ version, title, meta, applicationId }) => {
  const paths = useCvPaths(applicationId);
  return (
    <li className="border-border-faint not-first:border-t">
      <Link
        to={paths.version(version.id)}
        className="flex items-center gap-3 rounded-control py-3 text-text no-underline hover:text-text">
        <span
          aria-hidden="true"
          className="flex size-10 flex-none items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="file" size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base leading-normal font-medium wrap-anywhere">
            {title}
          </span>
          <span className="text-sm leading-normal text-muted wrap-anywhere">
            {meta}
          </span>
          <span className="mt-1 flex flex-wrap gap-2">
            <VersionChips version={version} />
          </span>
        </span>
        <span className="flex text-muted">
          <Icon name="right" />
        </span>
      </Link>
    </li>
  );
};

const BigOption: React.FC<{
  icon: IconName;
  tag: string;
  title: string;
  text: string;
  action: string;
  onOpen: () => void;
}> = ({ icon, tag, title, text, action, onOpen }) => (
  <Card as="article" elevation="raised" className="gap-3.5 p-7">
    <div className="flex items-center justify-between gap-3">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-tint text-primary">
        <Icon name={icon} size={24} />
      </span>
      <Chip tone="brand">{tag}</Chip>
    </div>
    <h2 className="font-display text-[22px] leading-tight font-semibold">
      {title}
    </h2>
    <p className="flex-1 text-base leading-normal text-muted">{text}</p>
    <Button onClick={onOpen} className="self-start">
      {action}
    </Button>
  </Card>
);

export const CvScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useInterviewProfile();
  const { status, versions, detailsStatus } = useCvVersions();
  const { reload } = useCvVersionsActions();
  const { applications } = useApplications();
  const [panel, setPanel] = useState<Panel>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const atDetails = useMatch(CV_DETAILS_PATH) !== null;
  const detailsCard = <CvDetailsCard onEdit={() => setDetailsOpen(true)} />;

  const empty = profile.resources.length === 0;
  const loading =
    profile.status === 'idle' ||
    profile.status === 'loading' ||
    status === 'idle' ||
    status === 'loading';
  const showNew = !loading && status === 'loaded' && versions.length > 0;

  let body: React.ReactNode;
  if (status === 'error' || profile.status === 'error') {
    body = (
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('cv.retryButton')}
          </Button>
        }>
        {t('cv.loadErrorMessage')}
      </Banner>
    );
  } else if (loading) {
    body = (
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>
    );
  } else if (empty) {
    body = (
      <Card
        elevation="raised"
        className="mx-auto mt-2 w-full max-w-[640px] items-center gap-3 p-8 text-center">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="upload" size={24} />
        </span>
        <h2 className="font-display text-[22px] leading-tight font-semibold">
          {t('cv.emptyTitle')}
        </h2>
        <p className="text-base leading-normal text-muted">
          {t('cv.emptyDescription')}
        </p>
        <Button
          onClick={() => navigate(PROFILE_PATH, { state: { add: 'cv' } })}
          className="gap-2">
          <Icon name="upload" size={18} />
          {t('cv.addCvButton')}
        </Button>
      </Card>
    );
  } else if (versions.length === 0) {
    body = (
      <>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-5">
          <BigOption
            icon="case"
            tag={t('cv.tailorTag')}
            title={t('cv.tailorTitle')}
            text={t('cv.tailorDescription')}
            action={t('cv.tailorButton')}
            onOpen={() => setPanel({ kind: 'job', ask: false })}
          />
          <BigOption
            icon="bulb"
            tag={t('cv.generalTag')}
            title={t('cv.generalTitle')}
            text={t('cv.generalDescription')}
            action={t('cv.generalButton')}
            onOpen={() => setPanel({ kind: 'general', ask: false })}
          />
        </div>
        {detailsCard}
        <Card elevation="raised" className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 flex-none items-center justify-center rounded-full bg-tint text-primary">
              <Icon name="user" size={20} />
            </span>
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
              <span className="text-sm leading-normal text-muted">
                {t('cv.writtenFromLabel')}
              </span>
              <span className="text-base leading-normal font-medium">
                {t('cv.writtenFromResources', {
                  count: profile.resources.length,
                })}
              </span>
              <span className="text-sm leading-normal text-muted">
                {t('cv.writtenFromMore')}
              </span>
            </div>
            <ButtonLink to={PROFILE_PATH} variant="quiet" size="small">
              {t('cv.openProfileButton')}
            </ButtonLink>
          </div>
        </Card>
        <Card
          as="section"
          elevation="raised"
          aria-labelledby="cv-trust"
          className="gap-4 p-6">
          <h2
            id="cv-trust"
            className="font-display text-[18px] leading-tight font-semibold">
            {t('cv.trustTitle')}
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
            {TRUST.map(([icon, key]) => (
              <li key={key} className="flex items-start gap-2.5">
                <span className="flex pt-0.5 text-primary">
                  <Icon name={icon} size={20} />
                </span>
                <span className="min-w-0 flex-1 text-[15px] leading-normal">
                  {t(key)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </>
    );
  } else {
    // For a job: one card per application, in the order of its newest version.
    const byJob = new Map<string, CvVersion[]>();
    for (const version of versions) {
      if (version.target.kind === 'job') {
        const id = version.target.applicationId;
        byJob.set(id, [...(byJob.get(id) ?? []), version]);
      }
    }
    const general = versions.filter(({ target }) => target.kind === 'general');
    body = (
      <>
        {detailsCard}
        {byJob.size > 0 && (
          <section aria-labelledby="cv-for-job" className="flex flex-col gap-4">
            <h2
              id="cv-for-job"
              className="font-display text-[20px] leading-tight font-semibold">
              {t('cv.forJobTitle')}
            </h2>
            {[...byJob].map(([applicationId, group]) => {
              const application = applicationOf(group[0], applications);
              return (
                <Card
                  key={applicationId}
                  as="article"
                  elevation="raised"
                  className="gap-1 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <h3 className="font-display text-[17px] leading-tight font-semibold wrap-anywhere">
                        {application?.title ?? t('cv.applicationGone')}
                      </h3>
                      {application?.company && (
                        <p className="text-sm leading-normal text-muted">
                          {application.company}
                        </p>
                      )}
                    </div>
                    {application && (
                      <ButtonLink
                        to={applicationPath(application.id)}
                        variant="quiet"
                        size="small">
                        {t('cv.openApplicationLink')}
                      </ButtonLink>
                    )}
                  </div>
                  <ul className="flex flex-col">
                    {group.map(version => (
                      <VersionRow
                        key={version.id}
                        version={version}
                        title={t('cv.versionOf', {
                          date: versionDay(version),
                        })}
                        meta={versionMeta(t, version, profile.resources)}
                      />
                    ))}
                  </ul>
                </Card>
              );
            })}
          </section>
        )}
        {general.length > 0 && (
          <section aria-labelledby="cv-general" className="flex flex-col gap-4">
            <h2
              id="cv-general"
              className="font-display text-[20px] leading-tight font-semibold">
              {t('cv.generalSectionTitle')}
            </h2>
            <Card elevation="raised" className="px-5 py-2">
              <ul className="flex flex-col">
                {general.map(version => (
                  <VersionRow
                    key={version.id}
                    version={version}
                    title={generalTitle(t, version)}
                    meta={versionMeta(t, version, profile.resources)}
                  />
                ))}
              </ul>
            </Card>
          </section>
        )}
      </>
    );
  }

  return (
    <SignedInShell title={t('cv.documentTitle')} mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
            <h1 className="font-display text-[28px] leading-tight font-semibold">
              {t('cv.title')}
            </h1>
            <p className="text-[16px] leading-normal text-muted">
              {t('cv.description')}
            </p>
          </div>
          {showNew && !empty && (
            <Button onClick={() => setPanel({ ask: true })} className="gap-2">
              <Icon name="plus" size={18} />
              {t('cv.newVersionButton')}
            </Button>
          )}
        </div>
        {body}
      </div>
      {panel && (
        <NewCvVersionPanel
          kind={panel.kind}
          ask={panel.ask}
          onClose={() => setPanel(undefined)}
        />
      )}
      {/* The form is filled once, from the details and the profile: it waits for both. */}
      {(detailsOpen ||
        (atDetails &&
          profile.status === 'loaded' &&
          detailsStatus === 'loaded')) && (
        <CvDetailsPanel
          onClose={() => {
            setDetailsOpen(false);
            if (atDetails) {
              navigate(CV_PATH, { replace: true });
            }
          }}
        />
      )}
    </SignedInShell>
  );
};

export default CvScreen;
