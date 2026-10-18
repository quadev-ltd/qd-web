// What the CV pages say about a version: its title, what it starts from, and which CVs a new
// one can start from.
import { type TFunction } from 'i18next';

import { type JobApplication } from '@/core/profile/applications';
import { type ProfileResource } from '@/core/profile/contract';
import { type CvVersion } from '@/core/profile/cvVersions';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** The CVs of the profile, the newest first. */
export const cvsOf = (resources: ProfileResource[]) =>
  resources.filter(({ type }) => type === 'cv');

/**
 * The CVs a version can start from: read, with their text kept (research doc 17). A CV added
 * before texts were kept has none until it is added again.
 */
export const usableCvsOf = (resources: ProfileResource[]) =>
  cvsOf(resources).filter(
    ({ status, textAt }) =>
      status === 'ready' && textAt !== undefined && textAt !== null,
  );

/** The day a version was asked for, as "14 Oct 2026". */
export const versionDay = (version: Pick<CvVersion, 'createdAt'>) =>
  version.createdAt === null ? '' : formatDay(version.createdAt);

/** The title of the CV a version starts from, or that it was removed since. */
export const startTitle = (
  t: TFunction,
  version: Pick<CvVersion, 'resourceId'>,
  resources: ProfileResource[],
) =>
  resources.find(({ id }) => id === version.resourceId)?.title ??
  t('cv.removedCv');

/** The application a version is for, when it is for one that still exists. */
export const applicationOf = (
  version: Pick<CvVersion, 'target'>,
  applications: JobApplication[],
) =>
  version.target.kind === 'job'
    ? applications.find(
        ({ id }) =>
          version.target.kind === 'job' && id === version.target.applicationId,
      )
    : undefined;

/** A general version's title: its role, "in general". */
export const generalTitle = (
  t: TFunction,
  version: Pick<CvVersion, 'target'>,
) =>
  version.target.kind === 'general' && version.target.role
    ? t('cv.generalVersionTitle', { role: version.target.role })
    : t('cv.generalVersionNoRole');

/** The heading of a version's page: its job and company, or its general title. */
export const versionHeading = (
  t: TFunction,
  version: Pick<CvVersion, 'target'>,
  applications: JobApplication[],
) => {
  if (version.target.kind === 'general') {
    return generalTitle(t, version);
  }
  const application = applicationOf(version, applications);
  if (!application) {
    return t('cv.applicationGone');
  }
  return [application.title, application.company].filter(Boolean).join(' · ');
};
