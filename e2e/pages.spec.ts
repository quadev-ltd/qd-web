// Every page: no serious or critical accessibility violation (axe), and no horizontal
// scroll, at both screen sizes (the two Playwright projects).
import { expect, type Page, test } from '@playwright/test';

import {
  CV_FILE,
  expectInsideViewport,
  expectNoHorizontalScroll,
  expectNoSeriousAccessibilityViolations,
  loseProfile,
  openProfile,
  openVerificationLink,
  PASSWORD,
  seedProfile,
  signIn,
  signUp,
} from './support';

const expectAccessibleAndNotTooWide = async (page: Page) => {
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);
};

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

test('profile, empty and with resources in every state: accessible and no horizontal scroll', async ({
  page,
}) => {
  // The sample account has the interview tools on.
  await openProfile(page);
  await expect(
    page.getByText('What you have done, read once and reused for every job.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);

  // Ready, being read, waiting for the upload, failed.
  await seedProfile(page);
  await expect(page.getByText('Could not read this page')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Resources · 6 of 20' }),
  ).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);
});

test('a resource, ready, being read and failed, a link that was read, and the remove dialog: accessible and no horizontal scroll', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  const open = async (title: string) => {
    await page.goto('/profile');
    await page.getByRole('link', { name: new RegExp(title) }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: title }),
    ).toBeVisible();
  };

  // Ready
  await open('Maya Okafor CV 2026');
  await expect(
    page.getByRole('link', { name: 'Download the file' }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // The confirmation
  await page.getByRole('button', { name: 'Remove this resource' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this resource?' });
  await expect(dialog).toBeVisible();
  await expectInsideViewport(page, dialog);
  await expectAccessibleAndNotTooWide(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  // Being read
  await open('Stories for interviews');
  await expect(page.getByRole('status')).toContainText(
    /Reading this|taking longer/,
  );
  await expectAccessibleAndNotTooWide(page);

  // Failed
  await open('Conference talk: Ledgers without tears');
  await expect(page.getByRole('status')).toContainText(
    'We couldn’t read this page',
  );
  await expectAccessibleAndNotTooWide(page);

  // A link that was read: its address beside it
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Add a resource' }).click();
  await page.getByRole('button', { name: /Add a link/ }).click();
  const form = page.getByRole('dialog', { name: 'Add a link' });
  await form
    .getByLabel('Title')
    .fill('Blog post: Moving a ledger to event sourcing');
  await form
    .getByLabel('Address')
    .fill('https://engineering.fenwickpay.example/blog/ledger-event-sourcing');
  await form.getByRole('button', { name: 'Add to profile' }).click();
  await expect(form).toBeHidden();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Blog post' }),
  ).toContainText('Ready');
  await open('Blog post: Moving a ledger to event sourcing');
  await expect(
    page.getByRole('link', {
      name: 'engineering.fenwickpay.example/blog/ledger-event-sourcing',
    }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
});

test('add a resource, in its three forms and with their messages: accessible and no horizontal scroll', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  const open = async (option: RegExp) => {
    await page.getByRole('button', { name: 'Add a resource' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Add to your profile' }),
    ).toBeVisible();
    if (option.source !== 'none') {
      await page.getByRole('button', { name: option }).click();
    }
  };
  const close = () => page.getByRole('button', { name: 'Close' }).click();
  const check = async () => {
    await expectInsideViewport(page, page.getByRole('dialog'));
    await expectNoSeriousAccessibilityViolations(page);
    await expectNoHorizontalScroll(page);
  };

  // How to add
  await open(/none/);
  await check();
  await close();

  // A file: chosen, then one over the limit
  await open(/Upload a file/);
  const file = page.locator('input[type=file]');
  await file.setInputFiles(CV_FILE);
  await expect(page.getByText('maya-okafor-cv.pdf')).toBeVisible();
  await check();
  await file.setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a document'),
  });
  await expect(page.getByText(/This file can’t be read/)).toBeVisible();
  await check();
  await close();

  // Pasted text, too long
  await open(/Paste or type text/);
  await page.getByLabel('Title').fill('a'.repeat(101));
  await page
    .getByRole('textbox', { name: 'Text', exact: true })
    .fill('a'.repeat(50_001));
  await expect(
    page.getByText('Shorten the title to 100 characters'),
  ).toBeVisible();
  await expect(page.getByText('50,001 / 50,000')).toBeVisible();
  await check();
  await close();

  // A link, with an address that is not accepted
  await open(/Add a link/);
  await page.getByLabel('Address').fill('http://wiki.fenwickpay.internal/maya');
  await expect(page.getByText(/Pages on a private network/)).toBeVisible();
  await check();
});

test('profile, not available for the account yet: accessible and no horizontal scroll', async ({
  page,
}) => {
  // A new account has no feature flag set, as on the backend.
  await signUp(page);
  await openVerificationLink(page);
  await page.getByRole('button', { name: "I've verified my email" }).click();
  await expect(page).toHaveURL('/home');

  await page.goto('/profile');
  await expect(
    page.getByText('Not available for your account yet'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Profile' }),
  ).toBeVisible();
  await expect(
    page.getByText('What you have done, read once and reused for every job.'),
  ).toBeHidden();

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
