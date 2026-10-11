// The web version of qd-mobile src/components/SignIn/FooterPrompt.tsx.
import { useTranslation } from 'react-i18next';
import { Link, type To } from 'react-router';

import { type ScreenType } from './types';

interface FooterPromptProps {
  /** Where the other path is (sign up from sign in, and the reverse). */
  changePath: To;
  screen: ScreenType;
}

export const FooterPrompt: React.FC<FooterPromptProps> = ({
  changePath,
  screen,
}) => {
  const { t } = useTranslation();
  return (
    <p className="text-center text-[15px] leading-natural text-muted">
      {t(`${screen}.changePathDescription`)}{' '}
      <Link to={changePath} className="font-bold no-underline hover:underline">
        {t(`${screen}.changePathButton`)}
      </Link>
    </p>
  );
};

export default FooterPrompt;
