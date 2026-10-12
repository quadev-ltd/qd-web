// Every page: no serious or critical accessibility violation (axe), and no horizontal
// scroll, at both screen sizes (the two Playwright projects).
import { expect, type Page, test } from '@playwright/test';

import {
  expectInsideViewport,
  expectNoHorizontalScroll,
  expectNoSeriousAccessibilityViolations,
  loseProfile,
  openVerificationLink,
  PASSWORD,
  signIn,
  signUp,
} from './support';

const PUBLIC_PAGES = [
  {
    name: 'public home',
    path: '/',
    heading: 'Building robust software solutions',
  },
  { name: 'sign in', path: '/sign-in', heading: 'Sign in' },
  { name: 'sign up', path: '/sign-up', heading: 'Create your account' },
  {
    name: 'forgot password',
    path: '/forgot-password',
    heading: 'Reset password',
  },
  {
    name: 'delete account',
    path: '/delete-account',
    heading: 'Delete your account',
  },
  {
    name: 'privacy policy',
    path: '/privacy-policy',
    heading: 'Privacy Policy',
  },
  {
    name: 'terms and conditions',
    path: '/terms-and-conditions',
    heading: 'Terms and Conditions',
  },
  {
    name: 'not found',
    path: '/this-page-does-not-exist',
    heading: 'Page not found',
  },
];

for (const { name, path, heading } of PUBLIC_PAGES) {
  test(`${name}: accessible and no horizontal scroll`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();

    await expectNoSeriousAccessibilityViolations(page);
    await expectNoHorizontalScroll(page);
  });
}

test('signed-in home: accessible and no horizontal scroll, also with the account menu open', async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByRole('heading', { level: 1, name: /Welcome back/ }),
  ).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole('button', { name: /Account menu for/ }).click();
  await expect(page.getByRole('menu')).toBeVisible();

  await expectInsideViewport(page, page.getByRole('menu'));
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);
});

test('sign up with validation errors: accessible and no horizontal scroll', async ({
  page,
}) => {
  await page.goto('/sign-up');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(
    page.getByText('Please agree to the terms and conditions'),
  ).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);
});

test('sign in with a wrong password: accessible and no horizontal scroll', async ({
  page,
}) => {
  await signIn(page, 'preview@example.com', 'Wr0ngPassword!');
  await expect(page.getByText('Invalid email or password')).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);
});

test('forgot password after sending: accessible and no horizontal scroll', async ({
  page,
}) => {
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('preview@example.com');
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(
    page.getByText(/If an account exists for that email/),
  ).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);
});

const expectAccessibleAndNotTooWide = async (page: Page) => {
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);
};

test('verify email, in each of its states: accessible and no horizontal scroll', async ({
  page,
}) => {
  await signUp(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome to QuaDev Grace!' }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // Not verified yet
  await page.getByRole('button', { name: "I've verified my email" }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // Link resent, with the wait on the button
  await page.getByRole('button', { name: 'Resend verification link' }).click();
  await expect(
    page.getByRole('button', { name: /^Resend link in \d+s$/ }),
  ).toBeDisabled();
  await expectAccessibleAndNotTooWide(page);
});

test('complete profile, empty and with validation errors: accessible and no horizontal scroll', async ({
  page,
}) => {
  await signUp(page);
  await loseProfile(page);
  await openVerificationLink(page);
  await page.getByRole('button', { name: "I've verified my email" }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Complete your profile' }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  await page.getByLabel(/Date of birth/).fill('31022020');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Date of birth format is invalid')).toBeVisible();
  await expect(page.getByText('Required')).toHaveCount(2);
  await expectAccessibleAndNotTooWide(page);
});

test('delete account, in each of its states: accessible and no horizontal scroll', async ({
  page,
}) => {
  await signUp(page);
  await openVerificationLink(page);
  await page.getByRole('button', { name: "I've verified my email" }).click();
  await expect(page).toHaveURL('/home');

  // Are you sure?
  await page.goto('/account/delete');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Are you sure?' }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // The password step, empty (the button is disabled)
  const deleteButton = page.getByRole('button', { name: 'Delete account' });
  await deleteButton.click();
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // A wrong password
  await password.fill('Wr0ngPassword!');
  await deleteButton.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // Deleted: the public home with the confirmation
  await password.fill(PASSWORD);
  await deleteButton.click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Account successfully deleted')).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
});
