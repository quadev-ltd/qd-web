// The profile's use case against the real backend code: the callables, the upload under the
// Storage rules, the trigger that reads the file, and the documents the site reads back.
// The model is the backend's fake: one item per document, with random text. The website shows
// the resources only (D70), so the tests assert on their states.
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

test('add a CV as a file: created, uploaded, read by the backend, ready on its page, then removed', async ({
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
  await expect(row.getByText('Ready', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Resources · 1 of 20' }),
  ).toBeVisible();

  // Read again from the backend's documents after a reload
  await page.reload();
  await expect(row.getByText('Ready', { exact: true })).toBeVisible();

  // The page of the resource; removeProfileResource takes it and its items away
  await row.getByRole('link').click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Maya Okafor CV 2026' }),
  ).toBeVisible();
  // The address that downloads the stored file comes from the file store, for a normal link
  await expect(
    page.getByRole('link', { name: 'Download the file' }),
  ).toHaveAttribute('href', /document\.pdf/);
  await page.getByRole('button', { name: 'Remove this resource' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this resource?' })
    .getByRole('button', { name: 'Remove the resource' })
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
  await expect(note.getByText('Ready', { exact: true })).toBeVisible();

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
  await expect(note.getByText('Ready', { exact: true })).toBeVisible();
});

test('the text kept of a resource: a note as added, and the text of a text file, read back under the rules', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);
  await openProfile(page);

  // A note: its text is kept when the backend reads it
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page.getByRole('button', { name: /Paste or type text/ }).click();
  const form = page.getByRole('dialog', { name: 'Paste or type text' });
  await form.getByLabel('Title').fill('Launch story');
  await form
    .getByRole('textbox', { name: 'Text', exact: true })
    .fill(
      'The load test failed a week before launch; we shipped without an incident.',
    );
  await form.getByRole('button', { name: 'Add to profile' }).click();
  const note = page.getByRole('listitem').filter({ hasText: 'Launch story' });
  await expect(note.getByText('Ready', { exact: true })).toBeVisible();
  await note.getByRole('link').click();
  const noteText = page.getByRole('region', { name: 'The text' });
  await expect(noteText).toContainText(/As you added it on/);
  await expect(noteText).toContainText('we shipped without an incident.');

  // A text file: its text, read by the trigger
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Add a resource' }).click();
  await page.getByRole('button', { name: /Upload a file/ }).click();
  const upload = page.getByRole('dialog', { name: 'Upload a file' });
  await upload.locator('input[type=file]').setInputFiles({
    name: 'performance-review.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Performance review 2025. Led the on-call redesign.'),
  });
  await upload.getByRole('button', { name: 'Add to profile' }).click();
  const file = page
    .getByRole('listitem')
    .filter({ hasText: 'performance-review' });
  await expect(file.getByText('Ready', { exact: true })).toBeVisible();
  await file.getByRole('link').click();
  const fileText = page.getByRole('region', { name: 'The text of the file' });
  await expect(fileText).toContainText(/Read from the text file on/);
  await expect(fileText).toContainText('Led the on-call redesign.');
});
