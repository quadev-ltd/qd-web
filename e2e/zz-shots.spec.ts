import { expect, test } from '@playwright/test';

import { openApplications, seedApplications } from './support';

const SHOTS =
  '/private/tmp/claude-501/-Users-gustavofranco-research-quadev/fc554b6e-1475-4f7a-979e-12684749ef70/scratchpad/w/shots';

test('shots of letters', async ({ page }) => {
  const name = test.info().project.name;
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
  await page.screenshot({
    path: `${SHOTS}/${name}-s28-tab.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Write a cover letter' }).click();
  const panel = page.getByRole('dialog', { name: 'New cover letter' });
  await panel
    .getByLabel('Why this job? (recommended)')
    .fill(
      'Tracking two million parcels a day is the same kind of problem as matching card payments.',
    );
  await panel.screenshot({ path: `${SHOTS}/${name}-s28-panel.png` });
  await panel.getByRole('button', { name: 'Write my letter' }).click();
  await expect(
    page.getByRole('heading', { name: 'Writing your letter' }),
  ).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${name}-s28-writing.png` });
  await expect(
    page.getByRole('article', { name: 'Your cover letter' }),
  ).toBeVisible({ timeout: 10000 });
  await page.screenshot({
    path: `${SHOTS}/${name}-s28-letter.png`,
    fullPage: true,
  });
  await page
    .getByRole('article', { name: 'Your cover letter' })
    .getByRole('button')
    .nth(1)
    .click();
  await page.screenshot({
    path: `${SHOTS}/${name}-s28-sentence.png`,
    fullPage: true,
  });
});
