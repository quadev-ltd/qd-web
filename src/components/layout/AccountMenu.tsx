import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export interface AccountMenuProps {
  /** Shown on the button. */
  firstName: string;
  /** Read by screen readers: "Account menu for <full name>". */
  fullName: string;
  /** Shown in the round badge on the button. */
  initials: string;
  /** Where the "Home" item leads. */
  homePath: string;
  /** Where the "Account" item leads (the account section of the home). */
  accountPath: string;
  onSignOut: () => void;
}

const itemsOf = (menu: HTMLElement | null) =>
  Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

/** Focuses an item of the menu; the index wraps around (-1 is the last item). */
const focusItem = (menu: HTMLElement | null, index: number) => {
  const items = itemsOf(menu);
  items[(index + items.length) % items.length]?.focus();
};

/** The menu's minimum width (min-w-[200px]) plus a margin to the edge of the screen. */
const SPACE_NEEDED = 216;

const ITEM =
  'flex h-11 w-full cursor-pointer items-center rounded-[10px] px-3 text-left text-[15px] leading-natural font-medium text-text no-underline hover:bg-tint hover:text-text';

/**
 * The account button on the right of the signed-in header, and its menu (Home, Account,
 * Sign out). It follows the menu button pattern: Enter, Space or the arrow keys open it and
 * move the focus into it, the arrow keys, Home and End move between the items, Escape
 * closes it and returns the focus to the button, and a click or a Tab outside closes it.
 */
export const AccountMenu: React.FC<AccountMenuProps> = ({
  firstName,
  fullName,
  initials,
  homePath,
  accountPath,
  onSignOut,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState<'first' | 'last'>('first');
  const [alignment, setAlignment] = useState<'left' | 'right'>('right');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const open = (focus: 'first' | 'last') => {
    // The menu hangs from the right edge of the button. On a narrow screen the header
    // wraps and the button sits on the left: the menu then hangs from its left edge, so
    // it never leaves the screen.
    const buttonRight = buttonRef.current?.getBoundingClientRect().right;
    setAlignment(
      buttonRight !== undefined && buttonRight < SPACE_NEEDED
        ? 'left'
        : 'right',
    );
    setFocusOnOpen(focus);
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  // Opening moves the focus into the menu.
  useEffect(() => {
    if (isOpen) {
      focusItem(menuRef.current, focusOnOpen === 'first' ? 0 : -1);
    }
  }, [isOpen, focusOnOpen]);

  // A click or a tap anywhere else closes the menu.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menu = menuRef.current;
    const index = itemsOf(menu).indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusItem(menu, index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(menu, index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(menu, 0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(menu, -1);
        break;
      case 'Tab':
        // The focus moves on to the next control of the page.
        close();
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={t('header.accountMenuAccessibilityLabel', {
          name: fullName,
        })}
        onClick={() => (isOpen ? close() : open('first'))}
        onKeyDown={onButtonKeyDown}
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
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label={t('header.accountNavAccessibilityLabel')}
          data-surface="light"
          onKeyDown={onMenuKeyDown}
          className={`absolute top-[calc(100%+8px)] z-20 flex min-w-[200px] flex-col rounded-control bg-surface p-1.5 shadow-floating ${
            alignment === 'left' ? 'left-0' : 'right-0'
          }`}>
          <Link
            role="menuitem"
            tabIndex={-1}
            to={homePath}
            onClick={close}
            className={ITEM}>
            {t('drawerMenu.home')}
          </Link>
          <Link
            role="menuitem"
            tabIndex={-1}
            to={accountPath}
            onClick={close}
            className={ITEM}>
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
            {t('drawerMenu.signOut')}
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
