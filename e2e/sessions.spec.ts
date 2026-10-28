// Sessions (R1, D94) and removing kept practice (D99, doc 15 §25): the practice kept, one card
// per job; a practice opened from there leads back there; an application removed with its practice
// kept, then "Remove all"; and removed with it.
import { expect, type Page, test } from '@playwright/test';

import { openApplications, seedApplications } from './support';

const QUESTION = 'Tell me about an incident you led from alert to fix.';

/** One likely question of the designs' technical interview practised, the interview's page open. */
const practiseOne = async (page: Page) => {
  await openApplications(page);
  await page.evaluate(() => window.qdPreview?.setFlag('textPractice', true));
  await seedApplications(page);
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Senior Backend Engineer' })
    .getByRole('link')
    .first()
    .click();
  await page.getByRole('link', { name: 'Interviews' }).click();
  await page.getByRole('link', { name: 'Technical interview' }).click();
  const questions = page.getByRole('region', {
    name: 'Likely questions for this interview',
  });
  await questions
    .getByRole('button', { name: 'Write likely questions' })
    .click();
  await questions
    .getByRole('listitem')
    .first()
    .getByRole('button', { name: 'Practise' })
    .click();
  await expect(page.getByRole('region', { name: 'Key points' })).toBeVisible();
};

const openSessions = async (page: Page) => {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Sessions' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sessions' }),
  ).toBeVisible();
};

/** "Remove this application?" for Senior Backend Engineer, from its Details. */
const askToRemove = async (page: Page) => {
  await page.goto('/applications');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Senior Backend Engineer' })
    .getByRole('link')
    .first()
    .click();
  await page.getByRole('link', { name: 'Details' }).click();
  await expect(
    page.getByText(
      'Its brief and its interviews are removed with it. You choose whether its practice stays.',
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Remove this application' })
    .last()
    .click();
  return page.getByRole('dialog', { name: 'Remove this application?' });
};

test('Sessions: the practice kept for each job, a practice opened from there and back', async ({
  page,
}) => {
  await practiseOne(page);
  await openSessions(page);

  const card = page.getByRole('region', { name: 'Senior Backend Engineer' });
  await expect(card).toContainText('Northwind Logistics · 1 question');
  await expect(card).toContainText(/Technical interview · \d{1,2} \w{3} \d{4}/);
  await card.getByRole('link', { name: QUESTION }).click();

  await expect(page).toHaveURL(/\/sessions\/[^/]+$/);
  await expect(
    page.getByRole('heading', { level: 1, name: QUESTION }),
  ).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Sessions' }).click();
  await expect(card).toBeVisible();
});

test('an application removed with its practice kept: in Sessions as removed, then "Remove all"', async ({
  page,
}) => {
  await practiseOne(page);

  const dialog = await askToRemove(page);
  const box = dialog.getByRole('checkbox', {
    name: 'Also remove its practice (1 question)',
  });
  await expect(box).not.toBeChecked();
  await expect(dialog).toContainText(
    'Otherwise it stays in Sessions under this job’s name',
  );
  await dialog.getByRole('button', { name: 'Remove the application' }).click();
  await expect(page).toHaveURL('/applications');

  await openSessions(page);
  const card = page.getByRole('region', { name: 'Senior Backend Engineer' });
  await expect(card).toContainText('Application removed');
  // Opened from Sessions, the practice of a removed application is still there
  await card.getByRole('link', { name: QUESTION }).click();
  await expect(page.getByRole('region', { name: 'Key points' })).toBeVisible();
  await page.goBack();

  await card.getByRole('button', { name: 'Remove all' }).click();
  const removeAll = page.getByRole('dialog', {
    name: 'Remove all practice for Senior Backend Engineer?',
  });
  await expect(removeAll).toContainText(
    '1 question from Northwind Logistics. You can’t undo this.',
  );
  await removeAll.getByRole('button', { name: 'Remove all' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nothing practised yet' }),
  ).toBeVisible();
});

test('an application removed with its practice: nothing is kept', async ({
  page,
}) => {
  await practiseOne(page);

  const dialog = await askToRemove(page);
  await dialog
    .getByRole('checkbox', { name: 'Also remove its practice (1 question)' })
    .check();
  await dialog.getByRole('button', { name: 'Remove the application' }).click();
  await expect(page).toHaveURL('/applications');

  await openSessions(page);
  await expect(
    page.getByRole('heading', { name: 'Nothing practised yet' }),
  ).toBeVisible();
});
