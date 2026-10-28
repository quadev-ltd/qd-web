import { type ReactNode } from 'react';

import AccountMenu from './AccountMenu';
import MainNav from './MainNav';
import PageShell from './PageShell';

import { ACCOUNT_PATH, HOME_PATH } from '@/core/auth/paths';
import { useFlag, useFlagsReady } from '@/core/flags/FlagsProvider';
import {
  APPLICATIONS_PATH,
  CV_PATH,
  PROFILE_PATH,
  SESSIONS_PATH,
} from '@/core/profile/paths';
import { useProfile, useSessionUser, useSignOut } from '@/core/session/hooks';

export interface SignedInShellProps {
  /** The browser tab title. */
  title: string;
  /** Layout classes for the main area. */
  mainClassName?: string;
  children: ReactNode;
}

/**
 * The frame of the signed-in pages: the light page with the dark header, the main navigation
 * and the account menu. The app shows the same things in its drawer. The logo leads to where
 * the user lands: the profile with the interview tools (D91), the home without them.
 */
export const SignedInShell: React.FC<SignedInShellProps> = ({
  title,
  mainClassName,
  children,
}) => {
  const user = useSessionUser();
  const profile = useProfile();
  const signOut = useSignOut();
  // The CV tool is part of the interview tools, with a flag of its own (delivery 2b).
  const interviewTools = useFlag('interviewAssistant');
  const cvTool = useFlag('cvTool');
  // Sessions holds the practice kept (D94), with text practice.
  const textPractice = useFlag('textPractice');
  const flagsReady = useFlagsReady();

  const firstName = profile?.firstName ?? '';
  const lastName = profile?.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <PageShell
      tone="light"
      title={title}
      mainClassName={mainClassName}
      brandPath={interviewTools ? PROFILE_PATH : HOME_PATH}
      headerNav={
        // The sections depend on the flags: until they are read, the bar keeps its place
        // empty rather than show the wrong ones.
        flagsReady ? (
          <MainNav
            homePath={interviewTools ? undefined : HOME_PATH}
            applicationsPath={interviewTools ? APPLICATIONS_PATH : undefined}
            cvPath={interviewTools && cvTool ? CV_PATH : undefined}
            sessionsPath={
              interviewTools && textPractice ? SESSIONS_PATH : undefined
            }
            profilePath={PROFILE_PATH}
          />
        ) : (
          <div aria-hidden="true" className="h-11" />
        )
      }
      headerActions={
        <AccountMenu
          firstName={firstName}
          fullName={fullName}
          initials={initials}
          email={user?.email ?? undefined}
          accountPath={ACCOUNT_PATH}
          onSignOut={signOut}
        />
      }>
      {children}
    </PageShell>
  );
};

export default SignedInShell;
