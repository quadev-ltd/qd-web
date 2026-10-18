// The interview profile, with the in-memory profile gateway: the screens working together
// in a browser. The same use case against the real backend code is in e2e-emulators/.
import { expect, test } from '@playwright/test';

import { CV_FILE, openProfile, seedProfile, signIn } from './support';

test('add a CV as a file: it is uploaded, read, and its page shows it, with nothing read from it', async ({
  page,
}) => {
  await openProfile(page);
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();

  // Add your CV → Upload a file
  await page.getByRole('button', { name: 'Add your CV' }).click();
  const panel = page.getByRole('dialog', { name: 'Add your CV' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: /Add a link/ })).toHaveCount(
    0,
  );
  await panel.getByRole('button', { name: /Upload a file/ }).click();

  const form = page.getByRole('dialog', { name: 'Upload your CV' });
  await form.locator('input[type=file]').setInputFiles(CV_FILE);
  await expect(form.getByText('maya-okafor-cv.pdf')).toBeVisible();
  await expect(form.getByLabel('Title')).toHaveValue('maya-okafor-cv');
  await expect(
    form.getByText('Taken from the file name. Change it if you like.'),
  ).toBeVisible();
  await form.getByLabel('Title').fill('Maya Okafor CV 2026');
  await form.getByRole('button', { name: 'Add to profile' }).click();

  // The upload is shown as it goes; then the panel closes by itself.
  await expect(form.getByRole('progressbar', { name: 'Upload' })).toBeVisible();
  await expect(form).toBeHidden();

  // The list: being read, then ready, without reloading.
  const row = page
    .getByRole('listitem')
    .filter({ hasText: 'Maya Okafor CV 2026' });
  await expect(row).toContainText('CV');
  await expect(row).toContainText('Being read…');
  await expect(row.getByText('Ready', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Resources · 1 of 20' }),
  ).toBeVisible();
  // The profile shows the resources only (D70).
  await expect(page.getByText(/What we found|items/)).toHaveCount(0);

  // Still there after a reload.
  await page.reload();
  await expect(row.getByText('Ready', { exact: true })).toBeVisible();

  // Its own page: what it is, and nothing read from it.
  await row.getByRole('link').click();
  await expect(page).toHaveURL(/\/profile\/resources\/.+/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Maya Okafor CV 2026' }),
  ).toBeVisible();
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await expect(page.getByText(/Go and PostgreSQL in production/)).toHaveCount(
    0,
  );
  await expect(page.getByText(/What we read|items/)).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Download the file' }),
  ).toHaveAttribute('target', '_blank');

  // And the way back.
  await page.getByRole('link', { name: 'Profile', exact: true }).last().click();
  await expect(page).toHaveURL('/profile');
});

test('paste a text that is too long: the message, then shorten it and add it', async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page
    .getByRole('dialog', { name: 'Add to your profile' })
    .getByRole('button', { name: /Paste or type text/ })
    .click();

  const form = page.getByRole('dialog', { name: 'Paste or type text' });
  const text = form.getByRole('textbox', { name: 'Text', exact: true });
  const add = form.getByRole('button', { name: 'Add to profile' });
  await form.getByLabel('Title').fill('Stories for interviews');
  await expect(form.getByRole('radio', { name: 'Note' })).toBeChecked();

  await text.fill('a'.repeat(50_001));
  await expect(
    form.getByText(
      'This is longer than 50,000 characters. Shorten it or split it into two resources.',
    ),
  ).toBeVisible();
  await expect(form.getByText('50,001 / 50,000')).toBeVisible();
  await expect(add).toBeDisabled();

  await text.fill(
    'Two weeks before the wallet launch our load test failed. I asked for a two-week slip and we shipped without an incident.',
  );
  await expect(form.getByText(/longer than 50,000/)).toBeHidden();
  await expect(add).toBeEnabled();
  await add.click();

  await expect(form).toBeHidden();
  const row = page
    .getByRole('listitem')
    .filter({ hasText: 'Stories for interviews' });
  await expect(row).toContainText('Note');
  await expect(row.getByText('Ready', { exact: true })).toBeVisible();
});

test('a link that cannot be read fails, and the list says why', async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page.getByRole('button', { name: /Add a link/ }).click();

  const form = page.getByRole('dialog', { name: 'Add a link' });
  const address = form.getByLabel('Address');
  await form.getByLabel('Title').fill('Team wiki page');
  await address.fill('http://wiki.fenwickpay.internal/maya');
  await expect(
    form.getByText(
      'Enter the https address of a public page. Pages on a private network can’t be read.',
    ),
  ).toBeVisible();
  await expect(
    form.getByRole('button', { name: 'Add to profile' }),
  ).toBeDisabled();

  // An address that is accepted, on a host the fake backend cannot read.
  await address.fill('https://portfolio.invalid/maya');
  await form.getByRole('button', { name: 'Add to profile' }).click();

  await expect(form).toBeHidden();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Team wiki page' }),
  ).toContainText('Could not read this page');
});

test('a link that is read: its address to open, the copy of its page, and "Remove this link"', async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page.getByRole('button', { name: /Add a link/ }).click();
  const form = page.getByRole('dialog', { name: 'Add a link' });
  await form.getByLabel('Title').fill('Conference talk');
  await form
    .getByLabel('Address')
    .fill('https://talks.example/ledgers-without-tears#video');
  await form.getByRole('button', { name: 'Add to profile' }).click();
  await expect(form).toBeHidden();

  const row = page.getByRole('listitem').filter({ hasText: 'Conference talk' });
  await expect(row.getByText('Ready', { exact: true })).toBeVisible();
  await row.getByRole('link').click();

  const details = page.getByRole('region', { name: 'This resource' });
  await expect(
    details.getByRole('link', {
      name: 'talks.example/ledgers-without-tears',
    }),
  ).toHaveAttribute('target', '_blank');
  await expect(page.getByText(/What we read|items/)).toHaveCount(0);
  const copy = page.getByRole('region', { name: 'Copy of the page' });
  await expect(copy).toContainText(/Taken on /);
  await expect(copy).toContainText(
    'https://talks.example/ledgers-without-tears',
  );

  await details.getByRole('button', { name: 'Remove this link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this resource?' });
  await expect(dialog).toContainText(
    'Briefs that used it will show as out of date.',
  );
  await dialog.getByRole('button', { name: 'Remove the resource' }).click();
  await expect(page).toHaveURL('/profile');
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();
});

test('a link’s page read again: the copy stays meanwhile, then the same page, a changed one, one taken down', async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page.getByRole('button', { name: /Add a link/ }).click();
  const form = page.getByRole('dialog', { name: 'Add a link' });
  await expect(
    form.getByText(/We keep a copy of it, which you can update later\./),
  ).toBeVisible();
  await form.getByLabel('Title').fill('Conference talk');
  await form
    .getByLabel('Address')
    .fill('https://talks.example/ledgers-without-tears');
  await form.getByRole('button', { name: 'Add to profile' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'Conference talk' });
  await expect(row.getByText('Ready', { exact: true })).toBeVisible();
  await row.getByRole('link').click();
  const copy = page.getByRole('region', { name: 'Copy of the page' });
  const readAgain = copy.getByRole('button', { name: 'Read the page again' });
  await expect(copy).toContainText(
    'If the page has changed. The new copy replaces this one, and briefs that used it will show as out of date.',
  );

  // The same page: the copy stays, and only its date moves
  await readAgain.click();
  await expect(copy).toContainText('Reading the page again…');
  await expect(copy).toContainText(/The copy from .* stays until the new one/);
  await expect(copy).toContainText(
    'The page hasn’t changed, so your copy stays as it is.',
  );

  // A page that changed: a new copy
  await page.evaluate(() => window.qdPreviewProfile?.nextReread('changed'));
  await readAgain.click();
  await expect(copy).toContainText(
    'The page had changed, so this copy is new. Briefs that used it will show as out of date.',
  );
  await expect(copy).toContainText('Read again: the page had changed.');

  // A page taken down: the copy is kept
  await page.evaluate(() =>
    window.qdPreviewProfile?.nextReread('link-unreadable'),
  );
  await readAgain.click();
  await expect(copy.getByRole('alert')).toContainText(
    /We couldn’t read the page again: it may have been taken down or made private\. Your copy from .* is kept\./,
  );
  await expect(copy).toContainText('Read again: the page had changed.');
});

test('a link that could not be read is tried again once it is public, and read', async ({
  page,
}) => {
  await openProfile(page);
  await page.evaluate(() =>
    window.qdPreviewProfile?.failNext('link-unreadable'),
  );
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page.getByRole('button', { name: /Add a link/ }).click();
  const form = page.getByRole('dialog', { name: 'Add a link' });
  await form.getByLabel('Title').fill('Portfolio');
  await form.getByLabel('Address').fill('https://maya.example/portfolio');
  await form.getByRole('button', { name: 'Add to profile' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'Portfolio' });
  await expect(row).toContainText('Could not read this page');
  await row.getByRole('link').click();

  const panel = page
    .getByRole('status')
    .filter({ hasText: 'We couldn’t read this page' });
  await expect(panel).toContainText('If you have made it public, try again.');
  await panel.getByRole('button', { name: 'Try again' }).click();

  await expect(
    page.getByRole('region', { name: 'Copy of the page' }),
  ).toContainText(/Taken on /);
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
});

test('open a failed resource, read why, and remove it in the dialog: it is gone from the list', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);

  await page
    .getByRole('link', { name: /Conference talk: Ledgers without tears/ })
    .click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Conference talk: Ledgers without tears',
    }),
  ).toBeVisible();
  await expect(page.getByText('Failed', { exact: true })).toBeVisible();
  const address = page.url();
  const reason = page.getByRole('status');
  await expect(reason).toContainText('We couldn’t read this page');
  await expect(reason).toContainText(
    'It may be private or need a sign-in. If you have made it public, try again. For LinkedIn, save your profile as a PDF and add the file.',
  );

  // Asked first; Cancel changes nothing.
  await reason.getByRole('button', { name: 'Remove' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this resource?' });
  await expect(dialog).toContainText(
    'Briefs that used it will show as out of date.',
  );
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(reason).toBeVisible();

  // Removed: back on the profile, without it.
  await page.getByRole('button', { name: 'Remove this link' }).click();
  await dialog.getByRole('button', { name: 'Remove the resource' }).click();
  await expect(page).toHaveURL('/profile');
  await expect(
    page.getByRole('heading', { name: 'Resources · 5 of 20' }),
  ).toBeVisible();
  await expect(
    page.getByText('Conference talk: Ledgers without tears'),
  ).toHaveCount(0);

  // "Back" does not return to the page of what was removed, and its address leads nowhere.
  await page.goBack();
  await expect(page).not.toHaveURL(address);
  await page.goto(address);
  await expect(
    page.getByRole('heading', { name: 'This resource is not in your profile' }),
  ).toBeVisible();
});

test('the home starts with "Add your CV", and leads to it once it is in the profile', async ({
  page,
}) => {
  // The sample account has the interview tools on.
  await signIn(page);
  await expect(page).toHaveURL('/home');
  await expect(page.getByText('Start here')).toBeVisible();
  await expect(
    page.getByText(
      'Everything else builds on it. We read it once and use it for every job you apply for.',
    ),
  ).toBeVisible();
  // Of the three paths, practice is not built yet and says so; the CV tool is on.
  await expect(page.getByText('Coming soon')).toHaveCount(1);
  await expect(page.getByText('Available', { exact: true })).toHaveCount(0);

  // "Add your CV" leads to the profile, with its panel open
  await page.getByRole('link', { name: 'Add your CV' }).click();
  await expect(page).toHaveURL('/profile');
  const panel = page.getByRole('dialog', { name: 'Add your CV' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /Upload a file/ }).click();
  const form = page.getByRole('dialog', { name: 'Upload your CV' });
  await form.locator('input[type=file]').setInputFiles(CV_FILE);
  await form.getByRole('button', { name: 'Add to profile' }).click();
  await expect(form).toBeHidden();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'maya-okafor-cv' }),
  ).toContainText('Ready');

  // A reload of the profile does not open the panel again
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Resources · 1 of 20' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Back on the home: the invitation became one line that leads to the CV's page
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Home' })
    .click();
  await expect(page).toHaveURL('/home');
  const done = page.getByRole('link', { name: /Your CV is in your profile/ });
  await expect(done).toContainText('maya-okafor-cv');
  await expect(page.getByText('Start here')).toHaveCount(0);
  await done.click();
  await expect(page).toHaveURL(/\/profile\/resources\/.+/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'maya-okafor-cv' }),
  ).toBeVisible();
});

test('an account without the interview tools has the home as before: no starting card', async ({
  page,
}) => {
  await signIn(page);
  await page.evaluate(() =>
    window.qdPreview?.setFlag('interviewAssistant', false),
  );
  await page.reload();

  await expect(
    page.getByRole('heading', { level: 1, name: /Welcome back/ }),
  ).toBeVisible();
  await expect(page.getByText('Coming soon')).toHaveCount(3);
  await expect(page.getByText('Start here')).toHaveCount(0);
});

test('the text kept of a resource: a note as added, a file’s text without its layout, "Show all"', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);

  // A file: its text, where it came from, and the file itself to download
  await page.getByRole('link', { name: /Maya Okafor CV 2026/ }).click();
  const fileText = page.getByRole('region', { name: 'The text of the file' });
  await expect(fileText).toContainText(
    /Read from the PDF on .*, without its layout/,
  );
  await expect(fileText).toContainText('Maya Okafor CV 2026');
  await expect(
    page.getByRole('link', { name: 'Download the file' }),
  ).toBeVisible();

  // A note, pasted long enough to open with "Show all"
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Add a resource' }).click();
  await page.getByRole('button', { name: /Paste or type text/ }).click();
  const form = page.getByRole('dialog', { name: 'Paste or type text' });
  const story = `${'Two weeks before the wallet launch our load test failed. '.repeat(14)}We shipped without an incident.`;
  await form.getByLabel('Title').fill('Launch story');
  await form.getByRole('textbox', { name: 'Text', exact: true }).fill(story);
  await form.getByRole('button', { name: 'Add to profile' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'Launch story' });
  await expect(row.getByText('Ready', { exact: true })).toBeVisible();
  await row.getByRole('link').click();
  const noteText = page.getByRole('region', { name: 'The text' });
  await expect(noteText).toContainText(/As you added it on/);
  const showAll = noteText.getByRole('button', { name: 'Show all' });
  await expect(showAll).toHaveAttribute('aria-expanded', 'false');
  await showAll.click();
  await expect(
    noteText.getByText(/We shipped without an incident\./),
  ).toBeVisible();
  await expect(
    noteText.getByRole('button', { name: 'Show less' }),
  ).toBeVisible();
});
