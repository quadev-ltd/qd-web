// The web version of qd-mobile src/components/SignIn/FooterPrompt.tsx.
import { useTranslation } from 'react-i18next';
import { Link, type To } from 'react-router';

import { type ScreenType } from './types';

interface FooterPromptProps {
  /**
   * Where the other path is (sign up from sign in, and the reverse), or what to do instead
   * of going somewhere (sign out, on the verify-email and complete-profile screens).
   */
  changePath: To | (() => void);
  screen: ScreenType;
}

const ACTION = 'font-bold no-underline hover:underline';

export const FooterPrompt: React.FC<FooterPromptProps> = ({
  changePath,
  screen,
}) => {
  const { t } = useTranslation();
  return (
    <p className="text-center text-[15px] leading-natural text-muted">
      {t(`${screen}.changePathDescription`)}{' '}
      {typeof changePath === 'function' ? (
        <button
          type="button"
          onClick={changePath}
          className={`${ACTION} cursor-pointer text-link hover:text-primary-dark`}>
          {t(`${screen}.changePathButton`)}
        </button>
      ) : (
        <Link to={changePath} className={ACTION}>
          {t(`${screen}.changePathButton`)}
        </Link>
      )}
    </p>
  );
};

export default FooterPrompt;
