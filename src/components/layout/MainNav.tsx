import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';

const LINK =
  'flex h-11 items-center rounded-[10px] px-3.5 text-white no-underline hover:bg-white/14 hover:text-white';

export interface MainNavProps {
  /** The signed-in home. */
  homePath: string;
  /** The interview profile. Its pages (a resource) keep it marked. */
  profilePath: string;
  /** The account section of the home. */
  accountPath: string;
}

/** The main navigation of the signed-in pages, next to the brand in the header. */
export const MainNav: React.FC<MainNavProps> = ({
  homePath,
  profilePath,
  accountPath,
}) => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('header.mainNavAccessibilityLabel')}
      className="flex flex-wrap gap-1.5 text-[15px] leading-natural font-medium">
      <NavLink
        to={homePath}
        end
        className={({ isActive }) => (isActive ? `${LINK} bg-white/14` : LINK)}>
        {t('drawerMenu.home')}
      </NavLink>
      <NavLink
        to={profilePath}
        className={({ isActive }) => (isActive ? `${LINK} bg-white/14` : LINK)}>
        {t('profile.title')}
      </NavLink>
      <Link to={accountPath} className={LINK}>
        {t('home.accountLink')}
      </Link>
    </nav>
  );
};

export default MainNav;
