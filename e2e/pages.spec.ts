// Every page: no serious or critical accessibility violation (axe), and no horizontal
// scroll, at both screen sizes (the two Playwright projects).
import { expect, type Page, test } from '@playwright/test';

import {
  CV_FILE,
  expectInsideViewport,
  expectNoHorizontalScroll,
  expectNoSeriousAccessibilityViolations,
  loseProfile,
  openApplications,
  openProfile,
  openVerificationLink,
  PASSWORD,
  seedApplications,
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

test('Profile for a new account, the account menu open, and "Your account": accessible and no horizontal scroll', async ({
  page,
}) => {
  // The sample account has the interview and CV tools: it lands on its profile, with the
  // welcome and the paths (D91)
  await signIn(page);
  await expect(page).toHaveURL('/profile');
  await expect(
    page.getByRole('heading', { level: 1, name: /Welcome, / }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'What do you want to do?' }),
  ).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole('button', { name: /Account menu for/ }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expectInsideViewport(page, page.getByRole('menu'));
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole('menuitem', { name: 'Account' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Your account' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open your CV details' }),
  ).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);
});

test('the home of an account without the interview tools: accessible and no horizontal scroll', async ({
  page,
}) => {
  await signIn(page);
  await page.evaluate(() =>
    window.qdPreview?.setFlag('interviewAssistant', false),
  );
  await page.goto('/home');
  await expect(
    page.getByRole('heading', { level: 1, name: /Welcome back/ }),
  ).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
  await expectNoHorizontalScroll(page);
});

test('applications: the list without and with them, a new one, an application, its edit panel and remove dialog: accessible and no horizontal scroll', async ({
  page,
}) => {
  // No application yet: the heading, "New application" and the line that says what one gives
  await openApplications(page);
  await expectAccessibleAndNotTooWide(page);

  // "New application", with its messages
  await page.getByRole('button', { name: 'New application' }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(
    panel.getByText('Paste the job description', { exact: true }),
  ).toBeVisible();
  await expectInsideViewport(page, panel);
  await expectAccessibleAndNotTooWide(page);
  await panel.getByText('File', { exact: true }).click();
  await expectAccessibleAndNotTooWide(page);
  await panel.getByText('Link', { exact: true }).click();
  await panel
    .getByLabel('Address of the posting')
    .fill('https://jobs.invalid/1');
  await expectAccessibleAndNotTooWide(page);

  // A posting being read, then not readable
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(page.getByRole('status')).toContainText('Reading the job');
  await expectAccessibleAndNotTooWide(page);
  await expect(page.getByRole('status')).toContainText(
    'We couldn’t read this page',
  );
  await expectAccessibleAndNotTooWide(page);
  await page.goto('/applications');

  // The list, with every state of a brief
  await seedApplications(page);
  await expectAccessibleAndNotTooWide(page);

  // An application, its edit panel and its remove dialog
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Senior Backend Engineer' })
    .getByRole('link')
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Senior Backend Engineer' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Details' }).click();
  await expect(page.getByRole('region', { name: 'The job' })).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await expect(edit).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
  await edit.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Remove this application' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Remove this application?',
  });
  await expect(dialog).toBeVisible();
  await expectInsideViewport(page, dialog);
  await expectAccessibleAndNotTooWide(page);
});

test('the brief, not prepared, ready with a requirement and a question open, out of date and failed: accessible and no horizontal scroll', async ({
  page,
}) => {
  await openApplications(page);
  await seedApplications(page);
  const open = async (title: string) => {
    await page.goto('/applications');
    await page
      .getByRole('listitem')
      .filter({ hasText: title })
      .getByRole('link')
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: title }),
    ).toBeVisible();
  };

  // Not prepared yet
  await open('Platform Engineer');
  await expect(
    page.getByRole('heading', { name: 'Prepare your brief' }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // Failed
  await page.evaluate(() => window.qdPreviewProfile?.failNextBrief('model'));
  await page.getByRole('button', { name: 'Prepare the brief' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // Ready, a requirement and a question open
  await page
    .getByRole('alert')
    .getByRole('button', { name: 'Try again' })
    .click();
  const requirements = page.getByRole('region', {
    name: 'What the job asks for',
  });
  await expect(requirements).toBeVisible();
  await requirements.getByRole('button').first().click();
  await page
    .getByRole('region', { name: 'Likely questions' })
    .getByRole('button')
    .first()
    .click();
  await expectAccessibleAndNotTooWide(page);

  // Out of date: the job changed
  await open('Engineering Manager');
  await expect(
    page.getByText('The job details changed since this brief was prepared.'),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
});

test('profile, empty and with resources in every state: accessible and no horizontal scroll', async ({
  page,
}) => {
  // The sample account has the interview tools on: a new account is welcomed (D91)
  await openProfile(page);
  await expect(
    page.getByText('Your profile is what every brief and CV is built from.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'What do you want to do?' }),
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

  // Ready, with the text kept of it
  await open('Maya Okafor CV 2026');
  await expect(
    page.getByRole('link', { name: 'Download the file' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'The text of the file' }),
  ).toContainText('Maya Okafor CV 2026');
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

  // A link that was read: its address beside it, and the copy of its page
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
  const copy = page.getByRole('region', { name: 'Copy of the page' });
  await expect(copy).toContainText(/Taken on /);
  await expectAccessibleAndNotTooWide(page);

  // Read again, and the page could not be read: the copy is kept
  await page.evaluate(() =>
    window.qdPreviewProfile?.nextReread('link-unreadable'),
  );
  await copy.getByRole('button', { name: 'Read the page again' }).click();
  await expect(copy).toContainText('Reading the page again…');
  await expectAccessibleAndNotTooWide(page);
  await expect(copy.getByRole('alert')).toContainText(
    'We couldn’t read the page again',
  );
  await expectAccessibleAndNotTooWide(page);
});

test('a posting read again, its outcome and "Replace your edited text?": accessible and no horizontal scroll', async ({
  page,
}) => {
  await openApplications(page);
  await page.getByRole('button', { name: 'New application' }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByText('Link', { exact: true }).click();
  await panel
    .getByLabel('Address of the posting')
    .fill('https://careers.northwind.example/senior-backend-engineer');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(
    page.getByRole('button', { name: 'Prepare the brief' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Details' }).click();
  const job = page.getByRole('region', { name: 'The job' });
  await expect(job).toContainText('Read the posting again');
  await expectAccessibleAndNotTooWide(page);

  // Read again, and the posting is no longer online
  await page.evaluate(() =>
    window.qdPreviewProfile?.nextReread('link-unreadable'),
  );
  await job.getByRole('button', { name: 'Read the posting again' }).click();
  await expect(job).toContainText('The posting is no longer online');
  await expectAccessibleAndNotTooWide(page);

  // Over an edited text, the question first
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await edit.getByLabel('Job description').fill('My own notes on the job.');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await job.getByRole('button', { name: 'Read the posting again' }).click();
  const replace = page.getByRole('dialog', {
    name: 'Replace your edited text?',
  });
  await expect(replace).toBeVisible();
  await expectInsideViewport(page, replace);
  await expectAccessibleAndNotTooWide(page);
});

test('CV versions: nothing in the profile, no version yet, the panel, the details, being written, written, the list and the remove dialog: accessible and no horizontal scroll', async ({
  page,
}) => {
  await openProfile(page);
  const cv = () =>
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'CVs', exact: true })
      .click();

  // Nothing in the profile
  await cv();
  await expect(
    page.getByRole('heading', { name: 'Add to your profile first' }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // No version yet, and the panel
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Profile' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();
  await seedProfile(page);
  // A version made before D83, for its review below
  await page.evaluate(() => window.qdPreviewProfile?.createEditVersion());
  await cv();
  await expect(
    page.getByRole('region', { name: 'At the top of every CV' }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
  await page.getByRole('button', { name: 'New version' }).click();
  const panel = page.getByRole('dialog', { name: 'New CV version' });
  await expect(panel.getByText('Length')).toBeVisible();
  await expectInsideViewport(page, panel);
  await expectAccessibleAndNotTooWide(page);

  // The CV details, opened over the panel
  await panel.getByRole('button', { name: 'Edit your CV details' }).click();
  const details = page.getByRole('dialog', { name: 'Your CV details' });
  await details.getByRole('button', { name: 'Add a link' }).click();
  await expectInsideViewport(page, details);
  await expectAccessibleAndNotTooWide(page);
  await details.getByRole('button', { name: 'Cancel' }).click();

  // Being written, then written
  await panel.getByText('No job in particular').click();
  await panel.getByRole('button', { name: 'Write my CV' }).click();
  await expect(page.getByRole('status')).toContainText('Writing your CV');
  await expectAccessibleAndNotTooWide(page);
  await expect(page.getByRole('article', { name: 'Your CV' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'What we did and why' }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // A line opened and edited, a role's heading, beside the CV or over it on a phone
  const written = page.getByRole('article', { name: 'Your CV' });
  const opened = page
    .getByRole('region', { name: /^This (line|role)$/ })
    .or(page.getByRole('dialog', { name: /^This (line|role)$/ }));
  const closeOpened = async () => {
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) {
      await dialog.getByRole('button', { name: 'Close' }).click();
    }
  };
  await written
    .getByRole('button', { name: /Led the on-call redesign/ })
    .click();
  await expect(opened).toContainText('Where it says this');
  await expectAccessibleAndNotTooWide(page);
  await opened.getByRole('button', { name: 'Edit' }).click();
  await expect(opened.getByLabel('Your wording')).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
  await opened.getByRole('button', { name: 'Cancel' }).click();
  await opened.getByRole('button', { name: 'Remove this line' }).click();
  await closeOpened();
  await expect(written).toContainText('Line removed by you');
  await expectAccessibleAndNotTooWide(page);
  await written
    .getByRole('button', { name: /Senior Backend Engineer · Fenwick Pay/ })
    .click();
  await opened.getByRole('button', { name: 'Edit' }).click();
  await expect(opened.getByLabel('To')).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
  await opened.getByRole('button', { name: 'Cancel' }).click();
  await closeOpened();

  // Written again: from the version before, with what was removed left out
  await page.getByRole('button', { name: 'Write again' }).click();
  await expect(
    page.getByText(/^Written again from the version of/),
  ).toBeVisible();
  await expect(written).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // The remove dialog, then the list
  await page.getByRole('button', { name: 'Remove this version' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this version?' });
  await expectInsideViewport(page, dialog);
  await expectAccessibleAndNotTooWide(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await cv();
  await expect(page.getByRole('region', { name: 'General' })).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  // A version made before D83: its review, a change being edited, and a question
  await page
    .getByRole('region', { name: 'General' })
    .getByRole('link', { name: /edits to Maya Okafor CV 2026/ })
    .click();
  await expect(page.getByText('0 of 3 reviewed')).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
  const aside = page.getByRole('complementary', { name: 'Changes' });
  await aside.getByRole('button', { name: 'Edit' }).click();
  await expectAccessibleAndNotTooWide(page);
  await aside.getByRole('button', { name: 'Cancel' }).click();
  await aside.getByText(/^Questions · /).click();
  await aside.getByRole('button', { name: /How many people/ }).click();
  await expectAccessibleAndNotTooWide(page);
  // The CV with its marks; at phone width it is behind the "Your CV" switch
  const showCv = page.getByText('Your CV', { exact: true });
  if (await showCv.isVisible()) {
    await showCv.click();
  }
  await expect(page.getByRole('article', { name: 'Your CV' })).toBeVisible();
  await expectAccessibleAndNotTooWide(page);
});

test('CV versions compared, and the application’s CV tab: accessible and no horizontal scroll', async ({
  page,
}) => {
  await openApplications(page);
  await seedApplications(page);
  const cv = () =>
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'CVs', exact: true })
      .click();
  const write = async () => {
    await page
      .getByRole('dialog', { name: 'New CV version' })
      .getByRole('button', { name: 'Write my CV' })
      .click();
    await expect(page.getByRole('article', { name: 'Your CV' })).toBeVisible();
  };
  await cv();
  await page.getByRole('button', { name: 'Choose a job' }).click();
  await write();
  await cv();
  await page.getByRole('button', { name: 'New version' }).click();
  await write();

  await page.getByRole('link', { name: 'Compare' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Compare two versions' }),
  ).toBeVisible();
  await expectAccessibleAndNotTooWide(page);

  await cv();
  await page
    .getByRole('link', { name: 'Open the application' })
    .first()
    .click();
  await page
    .getByRole('navigation', { name: 'Application' })
    .getByRole('link', { name: 'CV' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Other versions' }),
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
