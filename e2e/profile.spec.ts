// The interview profile, with the in-memory profile gateway: the screens working together
// in a browser. The same use case against the real backend code is in e2e-emulators/.
import { expect, test } from '@playwright/test';

import { CV_FILE, openProfile } from './support';

test('add a CV as a file: it is uploaded, read, and its items reach the skill map', async ({
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

  // The skill map has what was read.
  const skillMap = page
    .getByRole('heading', { name: 'Skill map' })
    .locator('xpath=ancestor::section');
  await expect(skillMap).toContainText('6 items');
  await expect(skillMap.getByText('Achievements').locator('..')).toContainText(
    '2',
  );

  // Still there after a reload.
  await page.reload();
  await expect(row).toContainText('Ready · 6 items');
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
