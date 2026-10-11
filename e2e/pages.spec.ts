// Every page: no serious or critical accessibility violation (axe), and no horizontal
// scroll, at both screen sizes (the two Playwright projects).
import { expect, test } from '@playwright/test';

import {
  expectInsideViewport,
  expectNoHorizontalScroll,
  expectNoSeriousAccessibilityViolations,
  signIn,
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
