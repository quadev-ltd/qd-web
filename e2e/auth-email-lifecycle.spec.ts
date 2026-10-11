// The web version of qd-mobile .maestro/auth-email-lifecycle.yaml, against the preview auth
// gateway: sign up -> signed-in home -> own name -> reload keeps the session -> sign out ->
// public home -> sign in again -> home. (Email verification and account deletion arrive
// with the backend.)
import { expect, test } from '@playwright/test';

import { newEmail, PASSWORD } from './support';

test('email account: sign up, home with the own name, sign out, sign in again', async ({
  page,
}) => {
  const email = newEmail();

  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Building robust software solutions',
    }),
  ).toBeVisible();

  // Sign up (no date of birth: it is optional)
  await page.getByRole('link', { name: 'Create your account' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Create your account' }),
  ).toBeVisible();
  await page.getByLabel('First name').fill('Grace');
  await page.getByLabel('Last name').fill('Hopper');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();

  // Signed-in home: the session moved here by itself
  await expect(page).toHaveURL('/home');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome back, Grace' }),
  ).toBeVisible();
  const account = page.getByRole('region', { name: 'Your account' });
  await expect(account).toContainText('Grace Hopper');
  await expect(account).toContainText(email);
  await expect(account).toContainText('Not set (optional)');
  await expect(account).toContainText('Email and password');
  // The feature flags are off by default: every tool is "Coming soon"
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.getByText('Coming soon')).toHaveCount(3);

  // A reload keeps the session
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome back, Grace' }),
  ).toBeVisible();

  // The account menu shows the name; sign out from it
  const menuButton = page.getByRole('button', {
    name: 'Account menu for Grace Hopper',
  });
  await expect(menuButton).toContainText('Grace');
  await menuButton.click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  // Back on the public home, signed out
  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Building robust software solutions',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Create your account' }),
  ).toBeVisible();

  // The signed-in home is closed again
  await page.goto('/home');
  await expect(page).toHaveURL('/sign-in');

  // Sign in again with the new account
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/home');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome back, Grace' }),
  ).toBeVisible();

  // Sign out from the account card this time
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/');
});
