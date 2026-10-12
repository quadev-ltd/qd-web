// Keyboard use: the account menu, and the focus ring colour on light and dark surfaces.
import { expect, type Locator, test } from '@playwright/test';

import { signIn } from './support';

// src/styles/theme.css: --color-focus (light surfaces) and --color-sky (dark surfaces).
const FOCUS_ON_LIGHT = 'rgb(27, 143, 216)';
const FOCUS_ON_DARK = 'rgb(108, 198, 247)';

const outlineOf = (locator: Locator) =>
  locator.evaluate(element => {
    const style = getComputedStyle(element);
    return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} offset ${style.outlineOffset}`;
  });

// Buttons fade their colours in (transition-colors), the outline colour included, so the
// ring is read until it has settled.
const expectFocusRing = (locator: Locator, color: string) =>
  expect.poll(() => outlineOf(locator)).toBe(`solid 3px ${color} offset 2px`);

test('the focus ring is dark blue on light surfaces and sky blue on dark ones', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sign in' }),
  ).toBeVisible();

  // Dark: the first link of the header, on the brand background
  const brand = page.getByRole('link', { name: 'QUADEV', exact: true });
  await page.keyboard.press('Tab');
  await expect(brand).toBeFocused();
  await expectFocusRing(brand, FOCUS_ON_DARK);

  // Light: a field and a button in the white card
  const email = page.getByLabel('Email');
  await page.keyboard.press('Tab'); // Privacy Policy
  await page.keyboard.press('Tab'); // Terms and Conditions
  await page.keyboard.press('Tab'); // Sign in with Google
  const google = page.getByRole('button', { name: 'Sign in with Google' });
  await expect(google).toBeFocused();
  await expectFocusRing(google, FOCUS_ON_LIGHT);
  await page.keyboard.press('Tab'); // Email
  await expect(email).toBeFocused();
  await expectFocusRing(email, FOCUS_ON_LIGHT);

  // Dark again: the last link of the page, in the footer
  const support = page.getByRole('link', { name: 'support@quadev.net' });
  await page.getByRole('link', { name: 'Delete your account' }).focus();
  await page.keyboard.press('Tab');
  await expect(support).toBeFocused();
  await expectFocusRing(support, FOCUS_ON_DARK);
});

test('the sign-in form can be filled and sent with the keyboard only', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').focus();
  await page.keyboard.type('preview@example.com');
  await page.keyboard.press('Tab'); // Forgot password?
  await page.keyboard.press('Tab'); // Password
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  await page.keyboard.type('Preview123!');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/home');
});

test('the account menu works with the keyboard', async ({ page }) => {
  await signIn(page);
  const menuButton = page.getByRole('button', { name: /Account menu for/ });
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

  // Enter opens the menu and moves the focus to the first item
  await menuButton.focus();
  await page.keyboard.press('Enter');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menuitem', { name: 'Home' })).toBeFocused();

  // The arrow keys move between the items
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Account' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();

  // Escape closes it and returns the focus to the button
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

  // "Account" leads to the account section
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/home#account');
  await expect(page.getByRole('menu')).toBeHidden();

  // Sign out with the keyboard (ArrowUp opens the menu at its last item)
  await menuButton.focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/');
});
