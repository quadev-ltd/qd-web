// Practising a question (X7, D94 slice 2, doc 15 §25): "Practise" on an interview's likely
// questions and the brief's, the key points of each from the profile, "Practise again" on a
// practised question, a question of the candidate's own, and removing a practice. Answering and
// feedback wait for the backend's slice 3. The preview's backend writes the key points as the
// backend's offline fake does.
import { expect, type Page, test } from '@playwright/test';

import { openApplications, seedApplications } from './support';

const QUESTION = 'Tell me about an incident you led from alert to fix.';

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
  await expect(
    page.getByRole('region', { name: 'Answer it and get feedback' }),
  ).toContainText('Coming soon');

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
