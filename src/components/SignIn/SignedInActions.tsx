import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import { useSessionUser, useSignOut } from '@/core/session/hooks';

/**
 * The right side of the header on the verify-email and complete-profile screens: the email
 * of the account (hidden on a narrow screen, where the card shows it) and "Sign out".
 */
export const SignedInActions: React.FC = () => {
  const { t } = useTranslation();
  const user = useSessionUser();
  const signOut = useSignOut();
  return (
    <div className="flex min-w-0 items-center gap-4">
      {user?.email && (
        <span className="min-w-0 text-[15px] leading-natural wrap-anywhere max-[720px]:hidden">
          {user.email}
        </span>
      )}
      <Button variant="outline" size="small" onClick={signOut}>
        {t('drawerMenu.signOut')}
      </Button>
    </div>
  );
};

export default SignedInActions;
