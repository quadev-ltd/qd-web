import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import Icon from '@/components/Icon';
import useMenuButton from '@/components/ui/useMenuButton';

export interface AccountMenuProps {
  /** Shown on the button. */
  firstName: string;
  /** Read by screen readers: "Account menu for <full name>". */
  fullName: string;
  /** Shown in the round badge on the button. */
  initials: string;
  /** Shown under the name at the top of the menu. */
  email?: string;
  /** Where the "Account" item leads: "Your account" (D85). */
  accountPath: string;
  onSignOut: () => void;
}

/** The menu's width (w-[280px]) plus a margin to the edge of the screen. */
const SPACE_NEEDED = 296;

const ITEM =
  'flex h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 text-left text-[15px] leading-natural font-medium text-text no-underline hover:bg-tint hover:text-text';

/**
 * The account button on the right of the signed-in header, and its menu (D85): the name and
 * email at the top, then Account and Sign out. It follows the menu button pattern
 * (useMenuButton). The name and email are outside the menu itself: they are not
 * items.
 */
export const AccountMenu: React.FC<AccountMenuProps> = ({
  firstName,
  fullName,
  initials,
  email,
  accountPath,
  onSignOut,
}) => {
  const { t } = useTranslation();
  const [alignment, setAlignment] = useState<'left' | 'right'>('right');
  const { isOpen, close, containerRef, buttonProps, menuProps } = useMenuButton(
    {
      // The menu hangs from the right edge of the button. On a narrow screen the header
      // wraps and the button sits on the left: the menu then hangs from its left edge, so
      // it never leaves the screen.
      onOpen: button => {
        const buttonRight = button?.getBoundingClientRect().right;
        setAlignment(
          buttonRight !== undefined && buttonRight < SPACE_NEEDED
            ? 'left'
            : 'right',
        );
      },
    },
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        {...buttonProps}
        aria-label={t('header.accountMenuAccessibilityLabel', {
          name: fullName,
        })}
        className="flex h-11 cursor-pointer items-center gap-2.5 rounded-[22px] border border-white/35 pr-3 pl-1.5 text-[15px] leading-natural font-medium text-white hover:bg-white/10">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-sky text-sm leading-natural font-bold text-on-sky">
          {initials}
        </span>
        <span>{firstName}</span>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isOpen ? 'rotate-180' : undefined}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div
          data-surface="light"
          className={`absolute top-[calc(100%+8px)] z-20 flex w-[280px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-control bg-surface text-text shadow-floating ${
            alignment === 'left' ? 'left-0' : 'right-0'
          }`}>
          <div className="flex flex-col gap-0.5 border-b border-border-faint px-4 py-3">
            <span className="text-[15px] leading-normal font-bold wrap-anywhere">
              {fullName}
            </span>
            {email && (
              <span className="text-sm leading-normal text-muted wrap-anywhere">
                {email}
              </span>
            )}
          </div>
          <div
            {...menuProps}
            aria-label={t('header.accountNavAccessibilityLabel')}
            className="flex flex-col p-1.5">
            <Link
              role="menuitem"
              tabIndex={-1}
              to={accountPath}
              onClick={close}
              className={ITEM}>
              <span className="flex text-muted">
                <Icon name="user" size={18} />
              </span>
              {t('home.accountLink')}
            </Link>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close();
                onSignOut();
              }}
              className={ITEM}>
              <span className="flex text-muted">
                <Icon name="logout" size={18} />
              </span>
              {t('drawerMenu.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
