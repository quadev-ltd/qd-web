import { type ReactNode } from 'react';

import AccountMenu from './AccountMenu';
import MainNav from './MainNav';
import PageShell from './PageShell';

import { HOME_PATH } from '@/core/auth/paths';
import { useProfile, useSignOut } from '@/core/session/hooks';

/** The id of the account section of the signed-in home. */
export const ACCOUNT_SECTION_ID = 'account';
const ACCOUNT_PATH = `${HOME_PATH}#${ACCOUNT_SECTION_ID}`;

export interface SignedInShellProps {
  /** The browser tab title. */
  title: string;
  /** Layout classes for the main area. */
  mainClassName?: string;
  children: ReactNode;
}

/**
 * The frame of the signed-in pages: the light page with the dark header, the main navigation
 * and the account menu. The app shows the same things in its drawer.
 */
export const SignedInShell: React.FC<SignedInShellProps> = ({
  title,
  mainClassName,
  children,
}) => {
  const profile = useProfile();
  const signOut = useSignOut();

  const firstName = profile?.firstName ?? '';
  const lastName = profile?.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <PageShell
      tone="light"
      title={title}
      mainClassName={mainClassName}
      headerNav={<MainNav homePath={HOME_PATH} accountPath={ACCOUNT_PATH} />}
      headerActions={
        <AccountMenu
          firstName={firstName}
          fullName={fullName}
          initials={initials}
          homePath={HOME_PATH}
          accountPath={ACCOUNT_PATH}
          onSignOut={signOut}
        />
      }>
      {children}
    </PageShell>
  );
};

export default SignedInShell;
