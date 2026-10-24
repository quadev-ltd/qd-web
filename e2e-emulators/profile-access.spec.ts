// Who gets the profile. The flag is read from the backend's own document, through the
// Firestore rules, by the Firebase gateway: nothing is faked on the website's side.
import { expect, test } from '@playwright/test';

import { createAccount, openProfile, signIn } from './support';

test('an account without the flag sees "Not available for your account yet"', async ({
  page,
}) => {
  const account = await createAccount();

  await signIn(page, account);
  await openProfile(page);

  await expect(
    page.getByText('Not available for your account yet'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Profile' }),
  ).toBeVisible();
  await expect(
    page.getByText('What you have done, read once and reused for every job.'),
  ).toBeHidden();
});

test('an account with the flag turned off for it sees the same', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: false });

  await signIn(page, account);
  await openProfile(page);

  await expect(
    page.getByText('Not available for your account yet'),
  ).toBeVisible();
});

test('an account with the flag on gets the profile', async ({ page }) => {
  const account = await createAccount({ interviewAssistant: true });

  // It lands on its profile, which welcomes a new account (D91)
  await signIn(page, account);
  await openProfile(page);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome, Maya' }),
  ).toBeVisible();
  await expect(
    page.getByText('Your profile is what every brief and CV is built from.'),
  ).toBeVisible();
  await expect(
    page.getByText('Not available for your account yet'),
  ).toBeHidden();

  // Opened by its address, with the session restored: the same answer.
  await page.reload();
  await expect(
    page.getByText('Your profile is what every brief and CV is built from.'),
  ).toBeVisible();
});
