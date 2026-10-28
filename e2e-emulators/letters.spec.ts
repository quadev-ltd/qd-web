// Cover letters (D98, slice 28) against the real backend code: createCoverLetter through App Check
// and the flags, the letter written in the background by onCoverLetterRequested with the offline
// fake ("fake-…" sentences citing what reached it), read back under the rules with its sources and
// its marks, markCoverLetterSent, removeCoverLetter, and the day's limit.
import { expect, type Page, test } from '@playwright/test';

import { createAccount, openProfile, setUsageToday, signIn } from './support';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** A note in the profile, read by the backend: the letter's one fact comes from it. */
const addNote = async (page: Page) => {
  await openProfile(page);
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page.getByRole('button', { name: /Paste or type text/ }).click();
  const form = page.getByRole('dialog', { name: 'Paste or type text' });
  await form.getByLabel('Title').fill('Launch story');
  await form
    .getByRole('textbox', { name: 'Text', exact: true })
    .fill('Moved the payments ledger to event sourcing in two quarters.');
  await form.getByRole('button', { name: 'Add to profile' }).click();
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: 'Launch story' })
      .getByText('Ready', { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
};

/** A new application, read, its "CV and letter" tab open. */
const openLetters = async (page: Page) => {
  // A new account's profile offers its first application.
  await openProfile(page);
  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel
    .getByLabel('Job description')
    .fill('Northwind Logistics moves two million parcels a day. Go and Kafka.');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^fake-/);
  await page.getByRole('link', { name: 'CV and letter' }).click();
  await expect(
    page.getByRole('heading', { name: 'Cover letter', exact: true }),
  ).toBeVisible();
};

const letter = (page: Page) =>
  page.getByRole('article', { name: 'Your cover letter' });

test('a letter written by the backend’s fake: read back with its sources, copied, marked as sent, removed', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    cvTool: true,
    coverLetters: true,
  });
  await signIn(page, account);
  await addNote(page);
  await openLetters(page);

  await page.getByRole('button', { name: 'Write a cover letter' }).click();
  const panel = page.getByRole('dialog', { name: 'New cover letter' });
  await expect(panel).toContainText('10 of 10 left today');
  await panel
    .getByLabel('Why this job? (recommended)')
    .fill('Parcels are the same problem as payments.');
  await panel.getByRole('button', { name: 'Write my letter' }).click();

  // Written in the background, then read back under the rules
  await expect(letter(page)).toBeVisible({ timeout: 45_000 });
  await expect(letter(page)).toContainText('fake-frame: I would like to apply');
  await expect(letter(page)).toContainText('fake-fact: ');
  await expect(letter(page)).toContainText(
    'fake-why: Parcels are the same problem as payments.',
  );
  await expect(letter(page)).toContainText('From Launch story');
  await expect(letter(page)).toContainText('why this job, your words');
  await page.reload();
  await expect(letter(page)).toContainText('fake-why: ');

  await letter(page)
    .getByRole('button', { name: /fake-why/ })
    .click();
  await expect(
    page.getByRole('region', { name: 'This sentence' }),
  ).toContainText('Parcels are the same problem as payments.');
  if (test.info().project.name === 'phone') {
    await page.getByRole('button', { name: 'Close' }).click();
  }

  await page.getByRole('button', { name: 'Copy the text' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // The heading is the CV details the fake read from the note; "To" started as the posting's
  // contact (job-read 1.2.0), and the reference follows the role.
  expect(copied).toMatch(/\nDear fake-[^\n]+,\n/);
  expect(copied).toMatch(/\(ref\. fake-[^)]+\)/);
  expect(copied).toContain('fake-why: Parcels are the same problem as payments.');

  await page.getByRole('button', { name: 'Mark as sent' }).click();
  await expect(page.getByText('Sent', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Sent', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Remove this letter' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this letter?' })
    .getByRole('button', { name: 'Remove the letter' })
    .click();
  await expect(page.getByText('No cover letter yet.')).toBeVisible();
  await expect(page.getByText('9 of 10 left today')).toBeHidden();
});

test('a letter from a draft, with nothing in the profile: its sentence cites the draft', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    cvTool: true,
    coverLetters: true,
  });
  await signIn(page, account);
  await openLetters(page);

  await page.getByRole('button', { name: 'Improve my draft' }).click();
  const panel = page.getByRole('dialog', { name: 'New cover letter' });
  await panel
    .getByLabel('Your draft')
    .fill('saw the senior backend role and it fits me.');
  await panel.getByRole('button', { name: 'Improve my draft' }).click();

  await expect(letter(page)).toBeVisible({ timeout: 45_000 });
  await expect(letter(page)).toContainText(
    'fake-draft: saw the senior backend role and it fits me.',
  );
  await expect(letter(page)).toContainText('From your draft');
  await expect(
    page.getByRole('region', { name: 'What we did with your draft' }),
  ).toContainText('fake-outcome: polish.');
});

test('the backend refuses over the day’s limit, and the panel says so', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    cvTool: true,
    coverLetters: true,
  });
  await signIn(page, account);
  await openLetters(page);

  await page.getByRole('button', { name: 'Improve my draft' }).click();
  const panel = page.getByRole('dialog', { name: 'New cover letter' });
  await expect(panel).toContainText('10 of 10 left today');
  // Used up since the panel read the count: only the backend knows
  await setUsageToday(account.uid, 'coverLetter', 10);
  await panel.getByLabel('Your draft').fill('hi, saw the role.');
  await panel.getByRole('button', { name: 'Improve my draft' }).click();

  await expect(panel).toContainText(
    'You’ve written 10 letters today, the daily limit.',
  );
});
