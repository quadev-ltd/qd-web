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

test('add a CV as a file: created, uploaded, read by the backend, and in the skill map', async ({
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

  // The item the backend wrote is read into the skill map
  const skillMap = page
    .getByRole('heading', { name: 'Skill map' })
    .locator('xpath=ancestor::section');
  await expect(skillMap).toContainText('1 item');

  // Read again from the backend's documents after a reload
  await page.reload();
  await expect(row).toContainText('Ready · 1 item');
  await expect(skillMap).toContainText('1 item');
});
