// Practising a question (X7, D94, doc 15 §25 and §27): "Practise" on an interview's likely
// questions and the brief's, the key points of each from the profile, "Practise again" on a
// practised question, a question of the candidate's own, and removing a practice. Slice 3: the
// typed answer and its feedback, "Try first", answering again and the tries compared, the 5 tries
// used and "Start again with new key points", and a failed answer kept. The preview's backend
// writes the key points and the feedback as the backend's offline fakes do.
import { expect, type Page, test } from '@playwright/test';

import { openApplications, seedApplications } from './support';

const QUESTION = 'Tell me about an incident you led from alert to fix.';

const answerField = (page: Page) =>
  page.getByRole('textbox', { name: 'Your answer' });

const openApplication = async (page: Page, title: string) => {
  await page
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('link')
    .first()
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible();
};

/** The technical interview of the designs, its likely questions written, text practice on. */
const openWrittenList = async (page: Page) => {
  await openApplications(page);
  await page.evaluate(() => window.qdPreview?.setFlag('textPractice', true));
  await seedApplications(page);
  await openApplication(page, 'Senior Backend Engineer');
  await page.getByRole('link', { name: 'Interviews' }).click();
  await page.getByRole('link', { name: 'Technical interview' }).click();
  const questions = page.getByRole('region', {
    name: 'Likely questions for this interview',
  });
  await questions
    .getByRole('button', { name: 'Write likely questions' })
    .click();
  await expect(questions.getByRole('listitem')).toHaveCount(5);
  return questions;
};

test('a likely question practised: its key points, the way back, "Practise again" with no call, then removed', async ({
  page,
}) => {
  const questions = await openWrittenList(page);
  await expect(questions).toContainText('40 of 40 practice calls left today');

  const first = questions.getByRole('listitem').first();
  await first.getByRole('button', { name: 'Practise' }).click();
  await expect(
    first.getByRole('button', { name: 'Writing key points…' }),
  ).toBeDisabled();

  // The practice opens under the interview once its key points are written
  await expect(page).toHaveURL(
    /\/applications\/[^/]+\/interviews\/[^/]+\/practice\/[^/]+$/,
  );
  const practiceUrl = page.url();
  await expect(
    page.getByRole('heading', { level: 1, name: QUESTION }),
  ).toBeVisible();
  await expect(
    page.getByText('From this interview’s likely questions'),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Technical interview · Senior Backend Engineer, Northwind Logistics',
    ),
  ).toBeVisible();
  const keyPoints = page.getByRole('region', { name: 'Key points' });
  await expect(keyPoints.getByRole('listitem')).toHaveCount(3);
  await expect(keyPoints).toContainText('Advice');
  await expect(answerField(page)).toHaveValue('');

  // Back to the interview, the whole way at 1280 and one link at 390: the question is practised
  if (test.info().project.name === 'desktop') {
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link'),
    ).toHaveText([
      'Applications',
      'Senior Backend Engineer',
      'Interviews',
      'Technical interview',
    ]);
  }
  await page
    .getByRole('link', { name: 'Technical interview', exact: true })
    .click();
  await expect(first).toContainText('Practised');
  await expect(questions).toContainText('39 of 40 practice calls left today');

  // "Practise again" opens the same practice, and spends nothing
  await first.getByRole('link', { name: 'Practise again' }).click();
  await expect(page).toHaveURL(practiceUrl);
  await page.goBack();
  await expect(questions).toContainText('39 of 40 practice calls left today');

  // Removed: the question can be practised anew
  await first.getByRole('link', { name: 'Practise again' }).click();
  await page.getByRole('button', { name: 'Remove this practice' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this practice?' });
  await dialog.getByRole('button', { name: 'Remove the practice' }).click();
  await expect(page).toHaveURL(/\/interviews\/[^/]+$/);
  await expect(first.getByRole('button', { name: 'Practise' })).toBeEnabled();
  await expect(first).not.toContainText('Practised');
});

test('a question of your own, practised from its panel', async ({ page }) => {
  const questions = await openWrittenList(page);

  await questions
    .getByRole('button', { name: 'Practise a question of your own' })
    .click();
  const panel = page.getByRole('dialog', {
    name: 'Practise a question of your own',
  });
  await panel
    .getByLabel('Your question')
    .fill('Tell me about a time you disagreed with your manager.');
  await expect(panel).toContainText('53 / 300');
  await panel.getByRole('button', { name: 'Start practising' }).click();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Tell me about a time you disagreed with your manager.',
    }),
  ).toBeVisible();
  await expect(page.getByText('Your own question')).toBeVisible();
});

test('a question of the brief practised, with its way back to the brief', async ({
  page,
}) => {
  await openApplications(page);
  await page.evaluate(() => window.qdPreview?.setFlag('textPractice', true));
  await seedApplications(page);
  await openApplication(page, 'Platform Engineer');
  await page.getByRole('button', { name: 'Prepare the brief' }).click();
  const questions = page.getByRole('region', { name: 'Likely questions' });
  await expect(questions).toContainText('40 of 40 practice calls left today');

  const first = questions.getByRole('listitem').first();
  await first.getByRole('button').first().click();
  await first.getByRole('button', { name: 'Practise this question' }).click();

  await expect(page).toHaveURL(/\/applications\/[^/]+\/practice\/[^/]+$/);
  await expect(page.getByText('From the brief')).toBeVisible();
  // "Brief" at 1280, "Platform Engineer · Brief" at 390
  await page.getByRole('link', { name: /Brief$/ }).click();
  await expect(first).toContainText('Practised');
  await expect(questions).toContainText('39 of 40 practice calls left today');
});

test('a failed practice can be tried again; none left today', async ({
  page,
}) => {
  const questions = await openWrittenList(page);

  await page.evaluate(() => window.qdPreviewProfile?.failNextPractice('model'));
  await questions
    .getByRole('listitem')
    .first()
    .getByRole('button', { name: 'Practise' })
    .click();
  await expect(questions.getByRole('alert')).toContainText(
    'We couldn’t write key points this time.',
  );
  await questions.getByRole('button', { name: 'Try again' }).click();
  await expect(page).toHaveURL(/\/practice\/[^/]+$/);

  await page.evaluate(() => window.qdPreviewProfile?.setPracticeToday(40));
  await page.goBack();
  await page.reload();
  await expect(questions).toContainText('0 of 40 practice calls left today');
  await expect(
    questions.getByRole('listitem').nth(1).getByRole('button', {
      name: 'Practise',
    }),
  ).toBeDisabled();
  await expect(
    questions.getByRole('button', { name: 'Practise a question of your own' }),
  ).toBeDisabled();
});

/** A long answer: it shares words with the advice "Say what you changed afterwards…". */
const ANSWER =
  'Last March card payments started failing for about 8% of our customers. I was on call, so I opened an incident and we rolled back the migration within 40 minutes. Afterwards I said what we changed so it could not happen again.';

/** The first likely question practised, its page open. */
const practiseFirst = async (page: Page) => {
  const questions = await openWrittenList(page);
  await questions
    .getByRole('listitem')
    .first()
    .getByRole('button', { name: 'Practise' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: QUESTION }),
  ).toBeVisible();
};

const feedback = (page: Page) =>
  page.getByRole('region', { name: 'Feedback', exact: true });

/** Types an answer and gets its feedback: the try's number is in the feedback once read. */
const answer = async (page: Page, text: string, number: number) => {
  await answerField(page).fill(text);
  await page.getByRole('button', { name: 'Get feedback' }).click();
  await expect(feedback(page)).toContainText(`Try ${number} of 5`, {
    timeout: 10_000,
  });
};

test('a question answered: the wait, the feedback in its sections, answered again and the tries compared', async ({
  page,
}) => {
  await practiseFirst(page);
  await expect(
    page.getByRole('radio', { name: 'Show key points' }),
  ).toBeChecked();

  await answerField(page).fill(ANSWER);
  await page.getByRole('button', { name: 'Get feedback' }).click();
  await expect(
    page.getByRole('button', { name: 'Getting feedback…' }),
  ).toBeDisabled();
  await expect(page.getByRole('status')).toContainText(
    'This takes up to 15 seconds. You can leave this page.',
  );
  await expect(feedback(page)).toContainText('Try 1 of 5', { timeout: 10_000 });

  // The feedback in its six sections, the answer read-only, no more choice of how to practise
  for (const section of [
    'What you covered',
    'What you left out',
    'Structure',
    'Clarity',
    'Try this next time',
    'An answer built from your profile',
  ]) {
    await expect(
      feedback(page).getByRole('heading', { name: section }),
    ).toBeVisible();
  }
  await expect(feedback(page)).toContainText('Never on tone or confidence.');
  await expect(page.getByRole('region', { name: 'Your answer' })).toContainText(
    ANSWER,
  );
  await expect(
    page.getByRole('radio', { name: 'Show key points' }),
  ).toBeHidden();
  await expect(feedback(page)).toContainText(
    '38 of 40 practice calls left today',
  );

  // Answered again in a new field, with one line: nothing covered, no example
  await feedback(page).getByRole('button', { name: 'Answer again' }).click();
  await expect(answerField(page)).toBeFocused();
  await answer(page, 'I fixed it.', 2);
  await expect(
    feedback(page).getByRole('heading', { name: 'What you covered' }),
  ).toBeHidden();
  await expect(
    feedback(page).getByRole('heading', {
      name: 'An answer built from your profile',
    }),
  ).toBeHidden();

  // The tries compared
  const tries = page.getByRole('group', { name: 'Your tries' });
  await expect(tries.getByRole('button', { name: 'Try 2' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await tries.getByRole('button', { name: 'Try 1' }).click();
  await expect(page.getByRole('region', { name: 'Your answer' })).toContainText(
    ANSWER,
  );
  await expect(feedback(page)).toContainText('Try 1 of 5');

  // The interview's list counts the tries
  await page.goBack();
  await expect(
    page
      .getByRole('region', { name: 'Likely questions for this interview' })
      .getByRole('listitem')
      .first(),
  ).toContainText('Practised · 2 tries');
});

test('“Try first”: the key points hidden until the feedback, or shown on request', async ({
  page,
}) => {
  await practiseFirst(page);
  const keyPoints = page.getByRole('region', { name: 'Key points' });

  await page.getByText('Try first', { exact: true }).click();
  await expect(keyPoints).toContainText(
    'Hidden until you get feedback, so you answer from memory first.',
  );
  await expect(keyPoints.getByRole('listitem')).toHaveCount(0);

  await answer(page, ANSWER, 1);
  await expect(keyPoints.getByRole('listitem')).toHaveCount(3);
});

test('the 5 tries used: no "Answer again", and "Start again with new key points" opens a new practice', async ({
  page,
}) => {
  test.slow();
  await practiseFirst(page);
  const first = page.url();

  await answer(page, ANSWER, 1);
  for (let number = 2; number <= 5; number += 1) {
    await feedback(page).getByRole('button', { name: 'Answer again' }).click();
    await answer(page, `${ANSWER} Try ${number}.`, number);
  }
  await expect(feedback(page)).toContainText(
    'You’ve used the 5 tries for this question.',
  );
  await expect(page.getByRole('button', { name: 'Answer again' })).toBeHidden();

  await page
    .getByRole('button', { name: 'Start again with new key points' })
    .click();
  await expect(page).not.toHaveURL(first, { timeout: 10_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: QUESTION }),
  ).toBeVisible();
  await expect(answerField(page)).toHaveValue('');
  await expect(page.getByRole('radio', { name: 'Try first' })).toBeVisible();
});

test('a failed answer keeps what was typed and can be sent again; none left today', async ({
  page,
}) => {
  await practiseFirst(page);

  await page.evaluate(() => window.qdPreviewProfile?.failNextPractice('model'));
  await answerField(page).fill(ANSWER);
  await page.getByRole('button', { name: 'Get feedback' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t get feedback this time.',
  );
  await expect(answerField(page)).toHaveValue(ANSWER);
  await page.getByRole('button', { name: 'Get feedback' }).click();
  await expect(feedback(page)).toContainText('Try 1 of 5', { timeout: 10_000 });

  await page.evaluate(() => window.qdPreviewProfile?.setPracticeToday(40));
  await page.reload();
  await feedback(page).getByRole('button', { name: 'Answer again' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'You’ve used today’s 40 practice calls',
  );
  await answerField(page).fill('I fixed it.');
  await expect(
    page.getByRole('button', { name: 'Get feedback' }),
  ).toBeDisabled();
});
