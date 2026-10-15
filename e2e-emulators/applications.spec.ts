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
  await page.getByRole('link', { name: 'Details' }).click();
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
  await page.getByRole('link', { name: 'Details' }).click();
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

test('E5 and E6: a brief is prepared, goes out of date when the job changes, is refreshed, and says when the profile changed', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);

  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByLabel('Title').fill('Platform Engineer');
  await panel
    .getByLabel('Job description')
    .fill('Kubernetes and Terraform for 40 engineers.');
  await panel.getByRole('button', { name: 'Add the job' }).click();

  // prepareApplicationBrief, with the backend's fake model
  await page.getByRole('button', { name: 'Prepare the brief' }).click();
  const requirements = page.getByRole('region', {
    name: 'What the job asks for',
  });
  await expect(requirements).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole('region', { name: 'Likely questions' }),
  ).toBeVisible();
  await expect(page.getByText(/1 of 10|9 of 10 left today/)).toBeVisible();

  // E5: the job changes (updateJobApplication moves the revision), then "Refresh"
  await page.getByRole('link', { name: 'Details' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await edit
    .getByLabel('Job description')
    .fill('Kubernetes, Terraform and an internal developer portal.');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await page.getByRole('link', { name: 'Brief' }).click();
  const changed = page.getByText(
    'The job details changed since this brief was prepared.',
  );
  await expect(changed).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(changed).toBeHidden({ timeout: 30_000 });
  const application = page.url();

  // E6: a resource added to the profile moves the profile's revision
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Profile' })
    .click();
  await page.getByRole('button', { name: 'Add your CV' }).click();
  await page.getByRole('button', { name: /Paste or type text/ }).click();
  const text = page.getByRole('dialog', { name: 'Paste or type text' });
  await text.getByLabel('Title').fill('CV as text');
  await text
    .getByRole('textbox', { name: 'Text', exact: true })
    .fill('Platform engineer, five years of Kubernetes.');
  await text.getByRole('button', { name: 'Add to profile' }).click();
  await expect(text).toBeHidden();
  await page.goto(application);
  await expect(
    page.getByText(/Your profile changed since this brief\./),
  ).toBeVisible();
});
