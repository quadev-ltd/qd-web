import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

const LINK =
  'flex h-11 items-center rounded-[10px] px-3.5 text-white no-underline hover:bg-white/14 hover:text-white';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${LINK} bg-white/14` : LINK;

export interface MainNavProps {
  /** The home, for an account without the interview tools. */
  homePath?: string;
  /**
   * The applications, for an account with the interview tools (D85). An application's pages
   * are under it and keep it marked.
   */
  applicationsPath?: string;
  /** The CV section, for an account with the CV tool; its versions keep it marked. */
  cvPath?: string;
  /** The interview profile. Its pages (a resource) keep it marked. */
  profilePath: string;
}

/**
 * The main navigation of the signed-in pages, next to the brand in the header: the sections
 * named after what is in them (D85), Profile first (D91): Profile · Applications · CVs, or
 * Home · Profile for an account without the interview tools. The account is behind the name
 * (AccountMenu).
 */
export const MainNav: React.FC<MainNavProps> = ({
  homePath,
  applicationsPath,
  cvPath,
  profilePath,
}) => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('header.mainNavAccessibilityLabel')}
      className="flex flex-wrap gap-1.5 text-[15px] leading-natural font-medium">
      {homePath && (
        <NavLink to={homePath} end className={linkClass}>
          {t('drawerMenu.home')}
        </NavLink>
      )}
      <NavLink to={profilePath} className={linkClass}>
        {t('profile.title')}
      </NavLink>
      {applicationsPath && (
        <NavLink to={applicationsPath} className={linkClass}>
          {t('applications.title')}
        </NavLink>
      )}
      {cvPath && (
        <NavLink to={cvPath} className={linkClass}>
          {t('cv.title')}
        </NavLink>
      )}
    </nav>
  );
};

export default MainNav;
