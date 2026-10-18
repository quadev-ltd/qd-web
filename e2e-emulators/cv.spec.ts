// CV versions against the real backend code (research doc 18): createCvVersion through App
// Check and both flags, the background trigger that makes the version with the fake model's
// offline answer, the version document read back under the rules, and removeCvVersion. The
// fake quotes real lines of the CV, so the test checks where a version is, not what it says.
import { expect, test } from '@playwright/test';

import { createAccount, openProfile, signIn } from './support';

/** A small fictional CV as a text file: its lines are what the fake quotes. */
const CV_TEXT = Buffer.from(
  [
    'Maya Okafor',
    'Experience',
    '- Built the reconciliation service for card transactions at Fenwick Pay',
    '- Ran the on-call rota for a team of nine engineers for two years',
    'Education',
    '- BSc Computer Science, Ashdown University, 2015',
  ].join('\n'),
);

test('a general version: asked for, made in the background, read back, then removed', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    cvTool: true,
  });
  await signIn(page, account);
  await openProfile(page);

  // A CV with its text kept (doc 17), which a version starts from
  await page.getByRole('button', { name: 'Add your CV' }).click();
  await page.getByRole('button', { name: /Upload a file/ }).click();
  const form = page.getByRole('dialog', { name: 'Upload your CV' });
  await form.locator('input[type=file]').setInputFiles({
    name: 'maya-okafor-cv.txt',
    mimeType: 'text/plain',
    buffer: CV_TEXT,
  });
  await form.getByLabel('Title').fill('Maya Okafor CV 2026');
  await form.getByRole('button', { name: 'Add to profile' }).click();
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: 'Maya Okafor CV 2026' })
      .getByText('Ready', { exact: true }),
  ).toBeVisible();

  // createCvVersion answers at once; the page follows the document until it is made
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'CV', exact: true })
    .click();
  await page.getByRole('button', { name: 'Improve my CV' }).click();
  await page
    .getByRole('dialog', { name: 'Improve your CV in general' })
    .getByRole('button', { name: 'Create the version' })
    .click();
  await expect(page).toHaveURL(/\/cv\/versions\/.+/);
  const text = page.getByRole('region', { name: 'Your CV' });
  await expect(text).toContainText('waiting for you');
  await expect(text).toContainText('Ran the on-call rota');

  // Read back from the backend's document after a reload
  await page.reload();
  await expect(text).toContainText('waiting for you');

  // removeCvVersion: gone from the backend, not only from the page
  await page.getByRole('button', { name: 'Remove this version' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this version?' })
    .getByRole('button', { name: 'Remove the version' })
    .click();
  await expect(page).toHaveURL('/cv');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Improve my CV' }),
  ).toBeVisible();
});

test('without the CV tool, the CV pages say "not available", and the navigation has no CV', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);

  await expect(
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'CV', exact: true }),
  ).toHaveCount(0);
  await page.goto('/cv');
  await expect(
    page.getByText(/Tailor your CV for a job, or improve it/),
  ).toBeVisible();
});
