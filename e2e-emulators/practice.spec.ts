// Practising a question (D94 slice 2) against the real backend code: startPracticeTurn through
// App Check and the flags, the turn the site reads back under the rules, its key points from the
// backend's offline `answer-guide` fake ("fake-advice: …" with an empty profile), the marks read
// by the interview's list and by the brief, the day's count from `usage`, and removePracticeTurn.
import { expect, type Page, test } from '@playwright/test';

import { createAccount, setUsageToday, signIn } from './support';

/** A date this many days from today in London, as the date field takes it. */
const inDays = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    Date.now() + days * 86_400_000,
  );

/** A new application with an interview and its likely questions, the interview's page open. */
const openWrittenList = async (page: Page) => {
  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel
    .getByLabel('Job description')
    .fill('Go services in production, Kafka, and incident response.');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(page).toHaveURL(/\/applications\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^fake-/);
  await page.getByRole('link', { name: 'Interviews' }).click();
  await page.getByRole('button', { name: 'Add an interview' }).click();
  const add = page.getByRole('dialog', { name: 'Add an interview' });
  await add.getByLabel('Name (optional)').fill('Technical interview');
  await add.getByLabel('Date').fill(inDays(7));
  await add.getByLabel('Start time').fill('14:00');
  await add.getByRole('button', { name: 'Add the interview' }).click();
  await expect(add).toBeHidden();
  await page.getByRole('link', { name: 'Technical interview' }).click();
  const questions = page.getByRole('region', {
    name: 'Likely questions for this interview',
  });
  await questions
    .getByRole('button', { name: 'Write likely questions' })
    .click();
  await expect(questions.getByRole('listitem')).toHaveCount(1, {
    timeout: 30_000,
  });
  return questions;
};

test('practice (D94 slice 2): a list’s question practised by startPracticeTurn, read back, marked, opened again with no call, removed', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    textPractice: true,
  });
  await signIn(page, account);
  const questions = await openWrittenList(page);
  await expect(questions).toContainText('40 of 40 practice calls left today');

  await questions
    .getByRole('button', { name: 'Practise', exact: true })
    .click();
  await expect(page).toHaveURL(/\/interviews\/[^/]+\/practice\/[^/]+$/, {
    timeout: 30_000,
  });
  const practiceUrl = page.url();
  // The fake's key points: with nothing in the profile, three pieces of advice
  const keyPoints = page.getByRole('region', { name: 'Key points' });
  await expect(keyPoints.getByRole('listitem')).toHaveCount(3);
  await expect(keyPoints).toContainText(/fake-advice/);
  await expect(
    page.getByText('From this interview’s likely questions'),
  ).toBeVisible();

  // Read back after a reload, under the rules
  await page.reload();
  await expect(keyPoints.getByRole('listitem')).toHaveCount(3);

  // The interview's list reads its turns by the list's id: practised, one call counted
  await page
    .getByRole('link', { name: 'Technical interview', exact: true })
    .click();
  await expect(questions.getByRole('listitem')).toContainText('Practised');
  await expect(questions).toContainText('39 of 40 practice calls left today');
  await questions.getByRole('link', { name: 'Practise again' }).click();
  await expect(page).toHaveURL(practiceUrl);

  // removePracticeTurn
  await page.getByRole('button', { name: 'Remove this practice' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this practice?' })
    .getByRole('button', { name: 'Remove the practice' })
    .click();
  await expect(page).toHaveURL(/\/interviews\/[^/]+$/);
  await expect(
    questions.getByRole('button', { name: 'Practise', exact: true }),
  ).toBeEnabled();
  await expect(questions.getByRole('listitem')).not.toContainText('Practised');
  await page.goto(practiceUrl);
  await expect(
    page.getByRole('heading', { name: 'This practice isn’t here any more' }),
  ).toBeVisible();
});

test('practice: a question of your own, and a question of the brief', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    textPractice: true,
  });
  await signIn(page, account);
  const questions = await openWrittenList(page);

  // Typed, from the interview's page: the model reads its kind
  await questions
    .getByRole('button', { name: 'Practise a question of your own' })
    .click();
  const panel = page.getByRole('dialog', {
    name: 'Practise a question of your own',
  });
  await panel
    .getByLabel('Your question')
    .fill('Why logistics, after payments?');
  await panel.getByRole('button', { name: 'Start practising' }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Why logistics, after payments?',
    }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Your own question')).toBeVisible();

  // The brief's question: matched by its text, marked on the brief
  await page
    .getByRole('link', { name: /^fake-/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Prepare the brief' })
    .click({ timeout: 30_000 });
  const brief = page.getByRole('region', { name: 'Likely questions' });
  const first = brief.getByRole('listitem').first();
  await first.getByRole('button').first().click();
  await first.getByRole('button', { name: 'Practise this question' }).click();
  await expect(page).toHaveURL(/\/applications\/[^/]+\/practice\/[^/]+$/, {
    timeout: 30_000,
  });
  await expect(page.getByText('From the brief')).toBeVisible();
  await page.getByRole('link', { name: /Brief$/ }).click();
  await expect(first).toContainText('Practised');
  await expect(brief).toContainText('38 of 40 practice calls left today');
});

test('practice: the backend refuses over the day’s limit, and the page says so', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    textPractice: true,
  });
  await signIn(page, account);
  const questions = await openWrittenList(page);
  await expect(questions).toContainText('40 of 40 practice calls left today');

  // Used up since the page read the count: only the backend knows
  await setUsageToday(account.uid, 'practice', 40);
  await questions
    .getByRole('button', { name: 'Practise', exact: true })
    .click();

  await expect(questions.getByRole('alert')).toContainText(
    'You’ve used today’s 40 practice calls, the daily limit.',
  );
  await expect(
    questions.getByRole('button', { name: 'Practise', exact: true }),
  ).toBeDisabled();
});
