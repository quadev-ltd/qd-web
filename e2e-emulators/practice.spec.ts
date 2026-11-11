// Practising a question (D94 slices 2 and 3) against the real backend code: startPracticeTurn
// through App Check and the flags, the turn the site reads back under the rules, its key points
// from the backend's offline `answer-guide` fake ("fake-advice: …" with an empty profile), the
// marks read by the interview's list and by the brief, the day's count from `usage`,
// removePracticeTurn, and answerPracticeTurn with the offline `answer-feedback` fake's feedback as
// stored after the backend's checks. Dictation (D102): dictatePracticeAnswer with a real recording,
// heard by the offline `answer-transcript` fake ("fake-transcript: N bytes of audio/webm.", nothing
// under 1,000 bytes), and the answer sent with its count of dictations.
import { expect, type Page, test } from '@playwright/test';

import {
  createAccount,
  microphone,
  setMicrophone,
  setUsageToday,
  signIn,
} from './support';

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

/** "Remove this application?" from the application's Details, the list's practice counted. */
const askToRemove = async (page: Page) => {
  await page
    .getByRole('link', { name: /^fake-/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'Details' }).click();
  await page
    .getByRole('button', { name: 'Remove this application' })
    .last()
    .click();
  return page.getByRole('dialog', { name: 'Remove this application?' });
};

const practiseFirst = async (page: Page) => {
  const questions = await openWrittenList(page);
  await questions
    .getByRole('button', { name: 'Practise', exact: true })
    .click();
  await expect(page.getByRole('region', { name: 'Key points' })).toBeVisible({
    timeout: 30_000,
  });
};

test('Sessions (D99): an application removed with its practice kept, by the count query and removeJobApplication, then removeApplicationPractice', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    textPractice: true,
  });
  await signIn(page, account);
  await practiseFirst(page);

  const dialog = await askToRemove(page);
  const box = dialog.getByRole('checkbox', {
    name: 'Also remove its practice (1 question)',
  });
  await expect(box).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Remove the application' }).click();
  await expect(page).toHaveURL('/applications');

  // Kept, marked applicationRemoved, named from the turn's snapshot
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Sessions' })
    .click();
  const card = page.getByRole('region', { name: /^fake-/ });
  await expect(card).toContainText('Application removed');
  await expect(card.getByRole('listitem')).toHaveCount(1);

  await card.getByRole('button', { name: 'Remove all' }).click();
  await page
    .getByRole('dialog', { name: /^Remove all practice for/ })
    .getByRole('button', { name: 'Remove all' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Nothing practised yet' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Nothing practised yet' }),
  ).toBeVisible();
});

test('Sessions (D99): an application removed with its practice, by removeJobApplication with removePractice', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    textPractice: true,
  });
  await signIn(page, account);
  await practiseFirst(page);

  const dialog = await askToRemove(page);
  await dialog
    .getByRole('checkbox', { name: 'Also remove its practice (1 question)' })
    .check();
  await dialog.getByRole('button', { name: 'Remove the application' }).click();
  await expect(page).toHaveURL('/applications');

  await page.goto('/sessions');
  await expect(
    page.getByRole('heading', { name: 'Nothing practised yet' }),
  ).toBeVisible();
});

test('feedback (D94 slice 3): an answer sent by answerPracticeTurn, its feedback read back after the backend’s checks, the try counted', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    textPractice: true,
  });
  await signIn(page, account);
  const questions = await openWrittenList(page);
  await questions
    .getByRole('button', { name: 'Practise', exact: true })
    .click();
  await expect(page).toHaveURL(/\/interviews\/[^/]+\/practice\/[^/]+$/, {
    timeout: 30_000,
  });

  await page.getByRole('textbox', { name: 'Your answer' }).fill('I did it.');
  await page.getByRole('button', { name: 'Get feedback' }).click();
  const feedback = page.getByRole('region', { name: 'Feedback', exact: true });
  await expect(feedback).toContainText('Try 1 of 5', { timeout: 30_000 });

  // The fake quotes the first and last key points, so they reached the model
  await expect(feedback).toContainText('fake-covered: fake-advice');
  await expect(feedback).toContainText('fake-missing: fake-advice');
  await expect(feedback).toContainText(
    'fake-structure: situation, task, action, result.',
  );
  await expect(feedback).toContainText('fake-clarity: 3 words.');
  await expect(feedback).toContainText('fake-suggestion: say what came of it.');
  // Dropped by the backend's checks: a line on manner, a number from nowhere
  await expect(feedback).not.toContainText('sound more confident');
  await expect(feedback).not.toContainText('999 hours');
  await expect(page.getByRole('region', { name: 'Your answer' })).toContainText(
    'I did it.',
  );
  // The start and the answer, both counted under `practice`
  await expect(feedback).toContainText('38 of 40 practice calls left today');

  // Read back from the turn after a reload, under the rules
  await page.reload();
  await expect(feedback).toContainText(
    'fake-structure: situation, task, action, result.',
  );

  await page
    .getByRole('link', { name: 'Technical interview', exact: true })
    .click();
  await expect(questions.getByRole('listitem')).toContainText(
    'Practised · 1 try',
  );
});

test('dictation (D102): a recording turned into text by dictatePracticeAnswer and added with Undo, sent with its count; silence heard as nothing; the day’s limit', async ({
  page,
}) => {
  await microphone(page);
  const account = await createAccount({
    interviewAssistant: true,
    textPractice: true,
  });
  await signIn(page, account);
  await practiseFirst(page);
  const field = page.getByRole('textbox', { name: 'Your answer' });
  const dictate = page.getByRole('button', { name: 'Dictate' });
  const stop = page.getByRole('button', { name: 'Stop and add' });
  const heard = /^I did it\. fake-transcript: \d+ bytes of audio\/webm\.$/;
  await field.fill('I did it.');

  // Recorded long enough to be heard (well over 1,000 bytes): the fake's 5 words at the end
  await dictate.click();
  await expect(page.getByText(/^Listening · 0:0\d$/)).toBeVisible();
  await page.waitForTimeout(1_500);
  await stop.click();
  await expect(field).toHaveValue(heard, { timeout: 30_000 });
  await expect(
    page.getByText('Added 5 words at the end.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(field).toHaveValue('I did it.');

  // Dictated again and kept: answerPracticeTurn takes the answer with `dictations: 1`
  await dictate.click();
  await page.waitForTimeout(1_500);
  await stop.click();
  await expect(field).toHaveValue(heard, { timeout: 30_000 });
  const answered = page.waitForRequest(request =>
    request.url().endsWith('/answerPracticeTurn'),
  );
  await page.getByRole('button', { name: 'Get feedback' }).click();
  expect((await answered).postDataJSON()).toMatchObject({
    data: { dictations: 1 },
  });
  const feedback = page.getByRole('region', { name: 'Feedback', exact: true });
  await expect(feedback).toContainText('Try 1 of 5', { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Your answer' })).toContainText(
    'fake-transcript:',
  );

  // Silence, stopped at once: under 1,000 bytes (about 3 a millisecond after the file's start), and
  // the backend hears nothing
  await page.getByRole('button', { name: 'Answer again' }).click();
  await setMicrophone(page, 0);
  await dictate.click();
  await expect(stop).toBeVisible();
  await page.waitForTimeout(100);
  const refused = page.waitForResponse(response =>
    response.url().endsWith('/dictatePracticeAnswer'),
  );
  await stop.click();
  expect((await refused).status()).toBe(400);
  await expect(page.getByRole('alert')).toContainText(
    'We didn’t hear anything, so nothing was added.',
  );

  // Used up since the page read the count: only the backend knows, and it refuses
  await setMicrophone(page, 1);
  await setUsageToday(account.uid, 'dictation', 30);
  await dictate.click();
  await page.waitForTimeout(1_500);
  await stop.click();
  await expect(page.getByRole('alert')).toContainText(
    'You’ve reached today’s limit for dictation.',
    { timeout: 30_000 },
  );
  await expect(dictate).toBeDisabled();
});
