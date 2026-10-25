// The menu button pattern, shared by the account menu and an application's menu (D95): Enter,
// Space or the arrow keys open the menu and move the focus into it; the arrow keys, Home and
// End move between its items; Escape closes it and returns the focus to the button; a click or
// a Tab outside closes it.
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

const itemsOf = (menu: HTMLElement | null) =>
  Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

/** Focuses an item of the menu; the index wraps around (-1 is the last item). */
const focusItem = (menu: HTMLElement | null, index: number) => {
  const items = itemsOf(menu);
  items[(index + items.length) % items.length]?.focus();
};

export const useMenuButton = ({
  onOpen,
}: {
  /** Before the menu opens: where it hangs, for example. */
  onOpen?: (button: HTMLButtonElement | null) => void;
} = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState<'first' | 'last'>('first');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const open = (focus: 'first' | 'last') => {
    onOpen?.(buttonRef.current);
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

  return {
    isOpen,
    close,
    containerRef,
    /** Spread on the menu's button. */
    buttonProps: {
      ref: buttonRef,
      type: 'button' as const,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': isOpen,
      'aria-controls': isOpen ? menuId : undefined,
      onClick: () => (isOpen ? close() : open('first')),
      onKeyDown: onButtonKeyDown,
    },
    /** Spread on the element with role="menu". */
    menuProps: {
      ref: menuRef,
      id: menuId,
      role: 'menu' as const,
      tabIndex: -1,
      onKeyDown: onMenuKeyDown,
    },
  };
};

export default useMenuButton;
