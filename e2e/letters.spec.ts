// Cover letters (D98, doc 15 §26, slice 28): the application's "CV and letter" tab, "New cover
// letter" written for the job or from a draft, being written, the letter with its sources and a
// number only the draft gives, a sentence opened, copied, marked as sent and removed, a form's
// box, a failure tried again and the day's limit. The preview's backend writes letters as the
// backend's offline writer does.
import { expect, type Page, test } from '@playwright/test';

import { openApplications, seedApplications } from './support';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** The designs' Northwind job, its "CV and letter" tab open, with the CV tool and cover letters on. */
const openLetters = async (page: Page) => {
  await openApplications(page);
  await page.evaluate(() => {
    window.qdPreview?.setFlag('cvTool', true);
    window.qdPreview?.setFlag('coverLetters', true);
  });
  await seedApplications(page);
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Senior Backend Engineer' })
    .getByRole('link')
    .first()
    .click();
  await page.getByRole('link', { name: 'CV and letter' }).click();
  await expect(
    page.getByRole('heading', { name: 'Cover letter', exact: true }),
  ).toBeVisible();
};

const newLetter = async (page: Page, button: string) => {
  await page.getByRole('button', { name: button }).click();
  return page.getByRole('dialog', { name: 'New cover letter' });
};

const letter = (page: Page) =>
  page.getByRole('article', { name: 'Your cover letter' });

test('a letter written for the job: being written, read with its sources, a sentence opened, copied and marked as sent', async ({
  page,
}) => {
  await openLetters(page);
  await expect(page.getByText('No cover letter yet.')).toBeVisible();

  const panel = await newLetter(page, 'Write a cover letter');
  await expect(panel).toContainText('10 of 10 left today');
  await panel
    .getByLabel('Why this job? (recommended)')
    .fill('Tracking parcels is the same kind of problem as matching payments.');
  await panel.getByRole('button', { name: 'My notice period' }).click();
  await page.keyboard.type('four weeks');
  await panel.getByRole('button', { name: 'Write my letter' }).click();

  // Being written, then ready
  await expect(page).toHaveURL(/\/applications\/[^/]+\/cv\/letters\/[^/]+$/);
  await expect(
    page.getByRole('heading', { name: 'Writing your letter' }),
  ).toBeVisible();
  await expect(letter(page)).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Cover letter · Northwind Logistics',
    }),
  ).toBeVisible();
  await expect(letter(page)).toContainText('Dear Hiring Manager,');
  await expect(letter(page)).toContainText(
    'Tracking parcels is the same kind of problem as matching payments.',
  );
  await expect(letter(page)).toContainText('From why this job, your words');
  await expect(letter(page)).toContainText('From the job posting');

  // What was asked, and what was done with it
  await page.getByRole('button', { name: /What we did and why/ }).click();
  await expect(
    page.getByText('Followed “My notice period: four weeks”.'),
  ).toBeVisible();

  // A sentence opened: the posting's own words
  await letter(page)
    .getByRole('button', { name: /^Paragraph 3:/ })
    .first()
    .click();
  const sentence = page.getByRole('region', { name: 'This sentence' });
  await expect(sentence).toContainText('Where it says this');
  await expect(sentence).toContainText('The job posting');
  if (test.info().project.name === 'phone') {
    await page.getByRole('button', { name: 'Close' }).click();
  }

  // Copied with no mark, and marked as sent
  await page.getByRole('button', { name: 'Copy the text' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Dear Hiring Manager,');
  expect(copied).toContain('Yours sincerely,');
  await page.getByRole('button', { name: 'Mark as sent' }).click();
  await expect(page.getByText('Sent', { exact: true })).toBeVisible();

  // The tab lists it: "CV and letter" at 1280, "Senior Backend Engineer · CV and letter" at 390
  await page.getByRole('link', { name: /CV and letter$/ }).click();
  const row = page
    .getByRole('region', { name: 'Letters for this job' })
    .getByRole('listitem')
    .first();
  await expect(row).toContainText(/^.*Letter of \d{1,2} \w{3} \d{4}/);
  await expect(row).toContainText('Sent');
  await expect(page.getByText('9 of 10 left today')).toBeHidden();
});

test('a letter from a draft: the number only the draft gives marked, what was done with the draft', async ({
  page,
}) => {
  await openLetters(page);

  const panel = await newLetter(page, 'Improve my draft');
  await panel
    .getByLabel('Your draft')
    .fill('saw the senior backend role and it fits me. my notice is 4 weeks');
  await panel.getByRole('button', { name: 'Improve my draft' }).click();

  await expect(letter(page)).toBeVisible({ timeout: 10_000 });
  await expect(letter(page).locator('mark')).toHaveText('4 weeks');
  await expect(letter(page)).toContainText(
    '“4 weeks” is from your draft, not in your profile. Check it before you send.',
  );
  // The mark stays with sources off
  await page
    .getByRole('switch', { name: 'Show where each sentence comes from' })
    .uncheck();
  await expect(letter(page).locator('mark')).toHaveText('4 weeks');
  await expect(
    page.getByRole('region', { name: 'What we did with your draft' }),
  ).toContainText('Kept your points in your order.');
  await expect(page.getByText(/Written from your draft on/)).toBeVisible();
});

test('a letter for a form’s box: plain text, counted, to copy', async ({
  page,
}) => {
  await openLetters(page);

  const panel = await newLetter(page, 'Write a cover letter');
  // The segmented control's radio is hidden: its label is what is pressed.
  await panel.getByText('A form’s box', { exact: true }).click();
  await expect(
    panel.getByRole('radio', { name: 'A form’s box' }),
  ).toBeChecked();
  await expect(panel.getByLabel('Most characters the box takes')).toHaveValue(
    '1500',
  );
  await panel.getByRole('button', { name: 'Write my letter' }).click();

  await expect(letter(page)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/^\d[\d,]* of 1,500 characters$/)).toBeVisible();
  await expect(letter(page)).not.toContainText('Hiring Manager, Northwind');
  await expect(
    page.getByRole('heading', { name: 'For a form’s box' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeHidden();
});

test('a letter that couldn’t be written is tried again; removed; none left today', async ({
  page,
}) => {
  await openLetters(page);

  await page.evaluate(() => window.qdPreviewProfile?.failNextLetter('model'));
  const panel = await newLetter(page, 'Write a cover letter');
  await panel.getByRole('button', { name: 'Write my letter' }).click();
  await expect(
    page.getByRole('heading', { name: 'We couldn’t write this letter' }),
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(letter(page)).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Remove this letter' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this letter?' })
    .getByRole('button', { name: 'Remove the letter' })
    .click();
  await expect(page).toHaveURL(/\/applications\/[^/]+\/cv$/);
  await expect(page.getByText('No cover letter yet.')).toBeVisible();

  await page.evaluate(() => window.qdPreviewProfile?.setCoverLettersToday(10));
  await page.reload();
  const again = await newLetter(page, 'Write a cover letter');
  await expect(again).toContainText(
    'You’ve written 10 letters today, the daily limit.',
  );
  await expect(
    again.getByRole('button', { name: 'Write my letter' }),
  ).toBeDisabled();
});

/** A letter written for the job, ready on its page. */
const writeOne = async (page: Page) => {
  await openLetters(page);
  const panel = await newLetter(page, 'Write a cover letter');
  await panel
    .getByLabel('Why this job? (recommended)')
    .fill('Tracking parcels is the same kind of problem as matching payments.');
  await panel.getByRole('button', { name: 'Write my letter' }).click();
  await expect(letter(page)).toBeVisible({ timeout: 10_000 });
};

const sentencePanel = (page: Page) =>
  page.getByRole('region', { name: 'This sentence' });

test('changing a letter: a sentence edited, removed and restored; a question answered; written again from a quick change', async ({
  page,
}) => {
  await writeOne(page);

  // Removed: out of the text copied; restored as written
  await letter(page)
    .getByRole('button', { name: /^Paragraph 2:/ })
    .first()
    .click();
  await sentencePanel(page)
    .getByRole('button', { name: 'Remove this sentence' })
    .click();
  // At 390 the sentence is a panel over the page: closed to copy, opened again to restore.
  const phone = test.info().project.name === 'phone';
  if (phone) {
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Copy the text' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).not.toContain('Mentored two junior engineers');
  if (phone) {
    await letter(page)
      .getByRole('button', { name: /^Paragraph 2, removed:/ })
      .click();
  }
  await sentencePanel(page)
    .getByRole('button', { name: 'Restore this sentence' })
    .click();

  // Edited in my words
  await sentencePanel(page)
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await sentencePanel(page)
    .getByLabel('This sentence, in your words')
    .fill('I mentored two engineers through their first incident review.');
  await sentencePanel(page)
    .getByRole('button', { name: 'Save', exact: true })
    .click();
  await expect(letter(page)).toContainText(
    'I mentored two engineers through their first incident review.',
  );
  await expect(letter(page)).toContainText('From edited by you');
  if (phone) {
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }

  // A question answered
  const questions = page.getByRole('region', { name: /^Questions/ });
  await questions
    .getByLabel('Your answer')
    .fill('Priya Shah, Engineering Manager');
  await questions.getByRole('button', { name: 'Save the answer' }).click();
  await expect(questions).toContainText('Answered');

  // Written again from a quick change: the answer and the edit come back
  await page.getByRole('button', { name: 'Shorter', exact: true }).click();
  const again = page.getByRole('dialog', { name: 'Write this letter again' });
  await expect(again.getByLabel('What you asked for')).toHaveValue(
    'Make it shorter.',
  );
  await again.getByRole('button', { name: 'Write again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Writing your letter' }),
  ).toBeVisible();
  await expect(letter(page)).toBeVisible({ timeout: 10_000 });
  await expect(letter(page)).toContainText('Priya Shah, Engineering Manager');
  await expect(letter(page)).toContainText(
    'I mentored two engineers through their first incident review.',
  );
  await page.getByRole('button', { name: /What we did and why/ }).click();
  await expect(page.getByText('Followed “Make it shorter.”.')).toBeVisible();
});

test('the whole letter edited: saved as my version, restored; improved into a new letter', async ({
  page,
}) => {
  await writeOne(page);

  await page.getByRole('button', { name: 'Edit the whole letter' }).click();
  await page
    .getByLabel('Your letter')
    .fill(
      'I want to build parcel tracking at Northwind.\n\nI led the ledger move.',
    );
  await page.getByRole('button', { name: 'Save my version' }).click();

  await expect(
    page.getByRole('heading', { name: 'Your version' }),
  ).toBeVisible();
  await expect(page.getByText('Edited by you', { exact: true })).toBeVisible();
  await expect(letter(page)).toContainText(
    'I want to build parcel tracking at Northwind.',
  );
  await expect(
    page.getByRole('switch', { name: 'Show where each sentence comes from' }),
  ).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'Change it quickly' }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Copy the text' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(
    'Dear Hiring Manager,\n\nI want to build parcel tracking',
  );

  // Restored as a whole
  await page
    .getByRole('button', { name: 'Restore the written letter' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Your version' }),
  ).toBeHidden();
  await expect(letter(page)).toContainText('Dear Hiring Manager,');
  await expect(letter(page)).not.toContainText(
    'I want to build parcel tracking',
  );

  // Improved: my words polished into a new letter, from them as a draft
  await page.getByRole('button', { name: 'Edit the whole letter' }).click();
  await page
    .getByLabel('Your letter')
    .fill('i want to build parcel tracking. my notice is 4 weeks');
  await page.getByRole('button', { name: 'Improve my version' }).click();
  await expect(letter(page)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Written from your draft on/)).toBeVisible();
  await expect(letter(page).locator('mark')).toHaveText('4 weeks');
});
