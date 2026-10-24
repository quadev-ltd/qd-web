// The sections named after what is in them (D85, doc 15 §19), Profile first (D91, doc 15 §20):
// the bar, where signing in lands, the account behind the name on its own page, and the logo
// back.
import { expect, test } from '@playwright/test';

import { SAMPLE_USER, signIn } from './support';

test('sign in to Profile, open the account from the name, see the CV details from it, and come back with the logo', async ({
  page,
}) => {
  await signIn(page);
  await expect(page).toHaveURL('/profile');
  await expect(page).toHaveTitle('Profile | QuaDev');
  const bar = page.getByRole('navigation', { name: 'Main' });
  await expect(bar.getByRole('link')).toHaveText([
    'Profile',
    'Applications',
    'CVs',
  ]);
  await expect(bar.getByRole('link', { name: 'Profile' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // The old address of the home leads here too
  await page.goto('/home');
  await expect(page).toHaveURL('/profile');

  // The menu behind the name: the name and email, then Account and Sign out
  await page.getByRole('button', { name: /Account menu for/ }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['Account', 'Sign out']);
  await expect(page.getByText(SAMPLE_USER.email)).toBeVisible();
  await page.getByRole('menuitem', { name: 'Account' }).click();

  // "Your account", its own page, with no section of the bar marked
  await expect(page).toHaveURL('/account');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Your account' }),
  ).toBeVisible();
  await expect(
    page.getByText('How you sign in and your details.'),
  ).toBeVisible();
  const personal = page.getByRole('region', { name: 'Personal details' });
  await expect(personal).toContainText(
    `${SAMPLE_USER.firstName} ${SAMPLE_USER.lastName}`,
  );
  await expect(personal).toContainText(
    'For your account only. The name and contact details at the top of your CVs are separate.',
  );
  await expect(
    page.getByRole('region', { name: 'Sign-in and security' }),
  ).toBeVisible();
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(0);

  // "Open your CV details": CVs with the panel open; closed, CVs stays, and Back returns here
  await personal.getByRole('link', { name: 'Open your CV details' }).click();
  await expect(page).toHaveURL('/cv/details');
  const details = page.getByRole('dialog', { name: 'Your CV details' });
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Close' }).click();
  await expect(details).toBeHidden();
  await expect(page).toHaveURL('/cv');
  await expect(
    page.getByRole('heading', { level: 1, name: 'CVs' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/account');

  // The logo leads back to the profile
  await page.getByRole('link', { name: 'QUADEV', exact: true }).click();
  await expect(page).toHaveURL('/profile');
});

test('an application keeps Applications marked, and its back link says so', async ({
  page,
}) => {
  await signIn(page);
  await expect(page).toHaveURL('/profile');
  await page.goto('/applications/not-there');

  await expect(
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Applications' }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Back to your applications' }).click();
  await expect(page).toHaveURL('/applications');
});
