// The profile's use case against the real backend code: the callables, the upload under the
// Storage rules, the trigger that reads the file, and the documents the site reads back.
// The model is the backend's fake: one item per document, with random text. So the tests
// assert on states and counts, never on what an item says.
import { expect, test } from '@playwright/test';

import { createAccount, openProfile, signIn } from './support';

/** A small fictional CV. The backend checks that a PDF starts like one. */
const CV_FILE = {
  name: 'maya-okafor-cv.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(
    '%PDF-1.7\nMaya Okafor. Senior Backend Engineer at Fenwick Pay, 2021 to 2026.',
  ),
};

test('add a CV as a file: created, uploaded, read by the backend, and what was read is on its page', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);
  await openProfile(page);
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();

  // createProfileResource, then the upload to the path it answers
  await page.getByRole('button', { name: 'Add your CV' }).click();
  await page.getByRole('button', { name: /Upload a file/ }).click();
  const form = page.getByRole('dialog', { name: 'Upload your CV' });
  await form.locator('input[type=file]').setInputFiles(CV_FILE);
  await form.getByLabel('Title').fill('Maya Okafor CV 2026');
  await form.getByRole('button', { name: 'Add to profile' }).click();
  await expect(form).toBeHidden();

  // The Storage trigger reads the file; the page follows the resource until it is ready
  const row = page
    .getByRole('listitem')
    .filter({ hasText: 'Maya Okafor CV 2026' });
  await expect(row).toContainText('CV');
  await expect(row).toContainText('Ready · 1 item');
  await expect(
    page.getByRole('heading', { name: 'Resources · 1 of 20' }),
  ).toBeVisible();

  // The item the backend wrote is read, and counted on the profile
  const found = page.getByRole('region', { name: 'What we found' });
  await expect(found).toContainText('1 item');

  // Read again from the backend's documents after a reload
  await page.reload();
  await expect(row).toContainText('Ready · 1 item');
  await expect(found).toContainText('1 item');

  // The page of the resource shows the item; removeProfileResource takes both away
  await row.getByRole('link').click();
  await expect(
    page.getByRole('region', { name: 'What we read' }),
  ).toContainText('1 item');
  // The address that downloads the stored file comes from the file store, for a normal link
  await expect(
    page.getByRole('link', { name: 'Download the file' }),
  ).toHaveAttribute('href', /document\.pdf/);
  await page.getByRole('button', { name: 'Remove this resource' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this resource?' })
    .getByRole('button', { name: 'Remove the resource and 1 item' })
    .click();
  await expect(page).toHaveURL('/profile');
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();

  // Gone from the backend, not only from the page
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();
});

test('pasted text is read; a link that cannot be read fails, says why, and is removed', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);
  await openProfile(page);

  // Pasted text: stored and read by the backend itself
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page.getByRole('button', { name: /Paste or type text/ }).click();
  const textForm = page.getByRole('dialog', { name: 'Paste or type text' });
  await textForm.getByLabel('Title').fill('Stories for interviews');
  await textForm
    .getByRole('textbox', { name: 'Text', exact: true })
    .fill(
      'Two weeks before the launch our load test failed. I asked for a two-week slip.',
    );
  await textForm.getByRole('button', { name: 'Add to profile' }).click();
  await expect(textForm).toBeHidden();
  const note = page
    .getByRole('listitem')
    .filter({ hasText: 'Stories for interviews' });
  await expect(note).toContainText('Note');
  await expect(note).toContainText('Ready · 1 item');

  // A link the backend's fake model cannot read (a host ending in .invalid)
  await page.getByRole('button', { name: 'Add a resource' }).click();
  await page.getByRole('button', { name: /Add a link/ }).click();
  const linkForm = page.getByRole('dialog', { name: 'Add a link' });
  await linkForm.getByLabel('Title').fill('Portfolio');
  await linkForm.getByLabel('Address').fill('https://portfolio.invalid/maya');
  await linkForm.getByRole('button', { name: 'Add to profile' }).click();
  await expect(linkForm).toBeHidden();
  const link = page.getByRole('listitem').filter({ hasText: 'Portfolio' });
  await expect(link).toContainText('Could not read this page');
  await expect(
    page.getByRole('heading', { name: 'Resources · 2 of 20' }),
  ).toBeVisible();

  // The reason reaches the page of the resource; it is removed from there
  await link.getByRole('link').click();
  const reason = page.getByRole('status');
  await expect(reason).toContainText('We couldn’t read this page');
  await reason.getByRole('button', { name: 'Remove' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this resource?' })
    .getByRole('button', { name: 'Remove the resource', exact: true })
    .click();
  await expect(page).toHaveURL('/profile');
  await expect(
    page.getByRole('heading', { name: 'Resources · 1 of 20' }),
  ).toBeVisible();
  await expect(note).toContainText('Ready · 1 item');
});
