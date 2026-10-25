// The way back from a CV version or a comparison (D96): opened from an application's CV tab, the
// whole way there ("Applications › Senior Backend Engineer › CV"); opened from CVs, "‹ CVs".
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { type CvPaths } from './useCvPaths';

import Icon from '@/components/Icon';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import { applicationPath, APPLICATIONS_PATH } from '@/core/profile/paths';

export const CvWayBack: React.FC<{
  paths: CvPaths;
  /** Where "‹ CVs" leads in the CV section; the CV section itself unless said otherwise. */
  to?: string;
}> = ({ paths, to }) => {
  const { t } = useTranslation();
  const { applications } = useApplications();
  const { applicationId } = paths;
  if (!applicationId) {
    return (
      <Link
        to={to ?? paths.list}
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
      ]}
      backLabel={t('breadcrumb.pageOfApplication', {
        title,
        page: t('applications.cvTab'),
      })}
    />
  );
};

export default CvWayBack;
