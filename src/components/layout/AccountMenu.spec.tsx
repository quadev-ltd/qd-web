import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AccountMenu } from './AccountMenu';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

const renderMenu = () => {
  const onSignOut = vi.fn();
  const utils = renderWithProviders(
    <>
      <AccountMenu
        firstName="Ada"
        fullName="Ada Lovelace"
        initials="AL"
        homePath="/home"
        accountPath="/home#account"
        onSignOut={onSignOut}
      />
      <button type="button">next control</button>
      <Routes>
        <Route path="/" element={<p>start page</p>} />
        <Route path="/home" element={<p>home page</p>} />
      </Routes>
    </>,
  );
  return { onSignOut, ...utils };
};

const menuButton = () =>
  screen.getByRole('button', { name: 'header.accountMenuAccessibilityLabel' });
const menu = () => screen.queryByRole('menu');
const item = (name: string) => screen.getByRole('menuitem', { name });

describe('AccountMenu', () => {
  it('shows a closed menu button with the first name and the initials', () => {
    renderMenu();

    expect(menuButton()).toHaveTextContent('Ada');
    expect(menuButton()).toHaveTextContent('AL');
    expect(menuButton()).toHaveAttribute('aria-haspopup', 'menu');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).not.toHaveAttribute('aria-controls');
    expect(menu()).not.toBeInTheDocument();
  });

  it('opens on click, with Home, Account and Sign out, and focuses the first item', async () => {
    renderMenu();

    await userEvent.click(menuButton());

    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(menuButton()).toHaveAttribute('aria-controls', menu()?.id);
    expect(
      screen.getAllByRole('menuitem').map(element => element.textContent),
    ).toEqual(['drawerMenu.home', 'home.accountLink', 'drawerMenu.signOut']);
    expect(item('drawerMenu.home')).toHaveAttribute('href', '/home');
    expect(item('home.accountLink')).toHaveAttribute('href', '/home#account');
    expect(item('drawerMenu.home')).toHaveFocus();
  });

  it('closes on a second click of the button', async () => {
    renderMenu();

    await userEvent.click(menuButton());
    await userEvent.click(menuButton());

    expect(menu()).not.toBeInTheDocument();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['{Enter}', ' '])(
    'opens with the keyboard (%j) and focuses the first item',
    async key => {
      renderMenu();
      menuButton().focus();

      await userEvent.keyboard(key);

      expect(item('drawerMenu.home')).toHaveFocus();
    },
  );

  it('opens on ArrowDown at the first item and on ArrowUp at the last', async () => {
    renderMenu();
    menuButton().focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(item('drawerMenu.home')).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{ArrowUp}');
    expect(item('drawerMenu.signOut')).toHaveFocus();
  });

  it('moves between the items with the arrow keys, Home and End, wrapping around', async () => {
    renderMenu();
    await userEvent.click(menuButton());

    await userEvent.keyboard('{ArrowDown}');
    expect(item('home.accountLink')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(item('drawerMenu.signOut')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(item('drawerMenu.home')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(item('drawerMenu.signOut')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(item('drawerMenu.home')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(item('drawerMenu.signOut')).toHaveFocus();
  });

  it('closes on Escape and returns the focus to the button', async () => {
    renderMenu();
    await userEvent.click(menuButton());

    await userEvent.keyboard('{Escape}');

    expect(menu()).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });

  it('closes when the focus leaves with Tab', async () => {
    renderMenu();
    await userEvent.click(menuButton());

    await userEvent.tab();

    expect(menu()).not.toBeInTheDocument();
  });

  it('closes on a click outside', async () => {
    renderMenu();
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByText('start page'));

    expect(menu()).not.toBeInTheDocument();
  });

  it('signs out from the menu and closes it', async () => {
    const { onSignOut } = renderMenu();
    await userEvent.click(menuButton());

    await userEvent.click(item('drawerMenu.signOut'));

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(menu()).not.toBeInTheDocument();
  });

  it('signs out with the keyboard', async () => {
    const { onSignOut } = renderMenu();
    menuButton().focus();

    await userEvent.keyboard('{ArrowUp}{Enter}');

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('goes to the home from the menu and closes it', async () => {
    renderMenu();
    await userEvent.click(menuButton());

    await userEvent.click(item('drawerMenu.home'));

    expect(screen.getByText('home page')).toBeInTheDocument();
    expect(menu()).not.toBeInTheDocument();
  });

  describe('placement', () => {
    const placeButton = (right: number) =>
      vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({ right } as DOMRect);

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('hangs from the right edge of the button when there is room on its left', async () => {
      placeButton(1240);
      renderMenu();

      await userEvent.click(menuButton());

      expect(menu()).toHaveClass('right-0');
      expect(menu()).not.toHaveClass('left-0');
    });

    it('hangs from the left edge of the button when the button is near the left of the screen', async () => {
      placeButton(132);
      renderMenu();

      await userEvent.click(menuButton());

      expect(menu()).toHaveClass('left-0');
      expect(menu()).not.toHaveClass('right-0');
    });
  });
});
