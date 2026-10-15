// Job applications against the real backend code (E4): createJobApplication,
// updateJobApplication and removeJobApplication through App Check and the flag, and the
// documents the site reads back under the Firestore rules. No model call is involved.
import { expect, test } from '@playwright/test';

import { createAccount, signIn } from './support';

test('E4: an application created with its job shows on the home and its page, is edited and removed', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);
  await expect(
    page.getByRole('heading', { name: 'What do you want to do?' }),
  ).toBeVisible();

  // createJobApplication
  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByLabel('Title').fill('Senior Backend Engineer');
  await panel
    .getByLabel('Job description')
    .fill('Go services in production, Kafka, and incident response.');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(page).toHaveURL(/\/applications\/.+/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Senior Backend Engineer' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'The job' })).toContainText(
    'Kafka',
  );

  // updateJobApplication, read back from the backend's document after a reload
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await edit.getByLabel('Company (optional)').fill('Northwind Logistics');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Details' })).toContainText(
    'Northwind Logistics',
  );

  // On the home, with no brief yet
  await page.getByRole('link', { name: 'Home', exact: true }).last().click();
  const card = page
    .getByRole('listitem')
    .filter({ hasText: 'Senior Backend Engineer' });
  await expect(card).toContainText('No brief yet');

  // removeJobApplication: gone from the backend, not only from the page
  await card.getByRole('link').click();
  await page.getByRole('button', { name: 'Remove this application' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this application?' })
    .getByRole('button', { name: 'Remove the application' })
    .click();
  await expect(page).toHaveURL('/home');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'What do you want to do?' }),
  ).toBeVisible();
});
