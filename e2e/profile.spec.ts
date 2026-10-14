// The interview profile, with the in-memory profile gateway: the screens working together
// in a browser. The same use case against the real backend code is in e2e-emulators/.
import { expect, test } from '@playwright/test';

import { CV_FILE, openProfile, seedProfile, signIn } from './support';

test('add a CV as a file: it is uploaded, read, and what was read is on its page', async ({
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
  await expect(row).toContainText('Ready · 6 items');
  await expect(
    page.getByRole('heading', { name: 'Resources · 1 of 20' }),
  ).toBeVisible();

  // The profile counts what was found, by kind.
  const found = page.getByRole('region', { name: 'What we found' });
  await expect(found).toContainText('6 items');
  await expect(found.getByText('Achievements').locator('..')).toContainText(
    '2',
  );
  await expect(found.getByRole('link')).toHaveCount(0);

  // Still there after a reload.
  await page.reload();
  await expect(row).toContainText('Ready · 6 items');

  // Its own page shows what was read, by kind, read only.
  await row.getByRole('link').click();
  await expect(page).toHaveURL(/\/profile\/resources\/.+/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Maya Okafor CV 2026' }),
  ).toBeVisible();
  await expect(page.getByText('Ready · 6 items')).toBeVisible();
  const read = page.getByRole('region', { name: 'What we read' });
  await expect(read).toContainText('6 items');
  await expect(
    read
      .getByRole('region', { name: 'Skills' })
      .getByRole('listitem')
      .filter({ hasText: 'Go and PostgreSQL in production for six years.' }),
  ).toBeVisible();
  await expect(read.getByRole('link')).toHaveCount(0);

  // An item opens to show where the resource says it.
  const passage = read.getByText(
    'Reduced Sev-1 and Sev-2 payment incidents 40% across Q3 and Q4',
    { exact: false },
  );
  await expect(passage).toBeHidden();
  const item = read.getByRole('button', {
    name: /Cut payment incidents by 40%/,
  });
  await item.click();
  await expect(item).toHaveAttribute('aria-expanded', 'true');
  // Only the opened item shows its passage.
  await expect(
    read.getByText('Where it says this').filter({ visible: true }),
  ).toHaveCount(1);
  await expect(passage).toBeVisible();

  // How to correct it, until items can be changed one by one.
  await expect(
    page.getByRole('region', { name: 'Something not right?' }),
  ).toContainText(
    'Items can’t be changed one by one. Remove this resource first, then add the corrected document.',
  );
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
  await expect(row).toContainText('Ready · 2 items');
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

test('a link that is read: its page, what was found on it, and how to correct it', async ({
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
  await expect(row).toContainText('Ready · 2 items');
  await row.getByRole('link').click();

  const card = page.getByRole('region', { name: 'The page' });
  await expect(card).toContainText('talks.example');
  await expect(card).toContainText('/ledgers-without-tears');
  await expect(card).toContainText(
    'We keep the address and what we found on the page, not the page itself.',
  );
  await expect(
    card.getByRole('link', { name: 'Open the page' }),
  ).toHaveAttribute('href', 'https://talks.example/ledgers-without-tears');
  await expect(
    page.getByRole('region', { name: 'What we read' }),
  ).toContainText('Conference talk on running a payments ledger');
  await expect(
    page.getByRole('region', { name: 'Something not right?' }),
  ).toContainText(
    'Remove this link first, then add a corrected page or a note.',
  );

  await page.getByRole('button', { name: 'Remove this link' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this resource?' })
    .getByRole('button', { name: 'Remove the resource and 2 items' })
    .click();
  await expect(page).toHaveURL('/profile');
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();
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
    'It may be private or need a sign-in. For LinkedIn, save your profile as a PDF and add the file.',
  );

  // Asked first; Cancel changes nothing.
  await reason.getByRole('button', { name: 'Remove' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this resource?' });
  await expect(dialog).toContainText('No items were read from it.');
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

test('removing a resource takes its items out of what was found', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  const found = page.getByRole('region', { name: 'What we found' });
  await expect(found).toContainText('9 items');

  await page.getByRole('link', { name: /Performance review 2025/ }).click();
  await page.getByRole('button', { name: 'Remove this resource' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this resource?' });
  await expect(dialog).toContainText(
    'This also removes the 3 items read from it. Briefs that used them will show as out of date.',
  );
  await dialog
    .getByRole('button', { name: 'Remove the resource and 3 items' })
    .click();

  await expect(page).toHaveURL('/profile');
  await expect(found).toContainText('6 items');
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
      'Everything else builds on it. We read it once and pick out your skills, experience, projects and achievements.',
    ),
  ).toBeVisible();
  // The tools that are not built yet do not claim to be available.
  await expect(page.getByText('Coming soon')).toHaveCount(3);
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
  ).toContainText('Ready · 6 items');

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
  await expect(done).toContainText('6 items read from it');
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
