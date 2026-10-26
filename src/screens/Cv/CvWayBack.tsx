// The way back from a CV version or a comparison (D96): opened from an application's CV tab, the
// whole way there ("Applications › Senior Backend Engineer › CV"); opened from CVs, "‹ CVs". A
// comparison is opened from a version, so its way ends with that version.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { type CvPaths } from './useCvPaths';

import Icon from '@/components/Icon';
import Breadcrumb, {
  type BreadcrumbStep,
} from '@/components/layout/Breadcrumb';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import { applicationPath, APPLICATIONS_PATH } from '@/core/profile/paths';

export const CvWayBack: React.FC<{
  paths: CvPaths;
  /**
   * A page opened from a version (a comparison): the way ends with that version, "Version of
   * 14 Oct 2026", two steps into CVs, or four into Applications.
   */
  from?: BreadcrumbStep;
}> = ({ paths, from }) => {
  const { t } = useTranslation();
  const { applications } = useApplications();
  const { applicationId } = paths;
  if (!applicationId) {
    if (from) {
      return (
        <Breadcrumb steps={[{ label: t('cv.title'), to: paths.list }, from]} />
      );
    }
    return (
      <Link
        to={paths.list}
        className="flex min-h-11 items-center gap-1 self-start text-[15px] leading-natural font-medium no-underline hover:underline">
        <Icon name="left" size={18} />
        {t('cv.title')}
      </Link>
    );
  }
  const application = applications.find(({ id }) => id === applicationId);
  const title = application?.title || t('applications.untitled');
  return (
    <Breadcrumb
      steps={[
        { label: t('applications.title'), to: APPLICATIONS_PATH },
        { label: title, to: applicationPath(applicationId) },
        { label: t('applications.cvTab'), to: paths.list },
        ...(from ? [from] : []),
      ]}
      backLabel={
        from
          ? undefined
          : t('breadcrumb.pageOfApplication', {
              title,
              page: t('applications.cvTab'),
            })
      }
    />
  );
};

export default CvWayBack;
