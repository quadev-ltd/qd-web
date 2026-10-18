// CV versions (delivery 2b), with the in-memory profile gateway: the screens working together in
// a browser. The fake makes a version a moment after it is asked for, with an answer that
// quotes the CV, as the backend's offline answer does. The same use case against the backend's
// code is in e2e-emulators/.
import { expect, type Page, test } from '@playwright/test';

import {
  openHome,
  openProfile,
  seedApplications,
  seedProfile,
} from './support';

const openCv = async (page: Page) => {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'CV', exact: true })
    .click();
  await expect(page).toHaveURL('/cv');
  await expect(
    page.getByRole('heading', { level: 1, name: 'CV' }),
  ).toBeVisible();
};

test('a general version: from the first screen, made in the background, its CV, then removed', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  await openCv(page);

  // No version yet: the two ways in
  await expect(
    page.getByRole('heading', { name: 'How we keep it true' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Improve my CV' }).click();
  const panel = page.getByRole('dialog', {
    name: 'Improve your CV in general',
  });
  await expect(
    panel.getByText('Written as a UK CV: British spelling, A4 pages.'),
  ).toBeVisible();
  await panel.getByLabel('Aim it at a role (optional)').fill('Data engineer');
  await panel.getByRole('button', { name: 'Create the version' }).click();

  // Its page while it is made, then the version
  await expect(page).toHaveURL(/\/cv\/versions\/.+/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Data engineer, in general' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Creating your version');
  const text = page.getByRole('region', { name: 'Your CV' });
  await expect(text).toContainText(
    '2 changes to review and 1 question are waiting for you.',
  );

  // In the list under "General", then removed
  await page.getByRole('link', { name: 'CV', exact: true }).first().click();
  await expect(
    page
      .getByRole('region', { name: 'General' })
      .getByText('Data engineer, in general'),
  ).toBeVisible();
  await page.getByRole('link', { name: /Data engineer, in general/ }).click();
  await page.getByRole('button', { name: 'Remove this version' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this version?' });
  await expect(dialog).toContainText(
    'Your CV, your profile and your other versions don’t change.',
  );
  await dialog.getByRole('button', { name: 'Remove the version' }).click();
  await expect(page).toHaveURL('/cv');
  await expect(
    page.getByRole('button', { name: 'Improve my CV' }),
  ).toBeVisible();
});

test('a version for a job: asked in "New version", listed under its application', async ({
  page,
}) => {
  await openHome(page);
  await seedApplications(page);
  await openCv(page);
  await page.getByRole('button', { name: 'Choose a job' }).click();
  const panel = page.getByRole('dialog', { name: 'New CV version' });
  await panel.getByRole('radio', { name: /Platform Engineer/ }).check();
  await panel.getByRole('button', { name: 'Create the version' }).click();
  await expect(page.getByRole('region', { name: 'Your CV' })).toContainText(
    'waiting for you',
  );

  await page.getByRole('link', { name: 'CV', exact: true }).first().click();
  const forJob = page.getByRole('region', { name: 'For a job' });
  await expect(
    forJob.getByRole('heading', { name: 'Platform Engineer' }),
  ).toBeVisible();
  await expect(forJob).toContainText('2 changes to review');
  await expect(forJob).toContainText('1 question');

  // "New version" asks what it is for
  await page.getByRole('button', { name: 'New version' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'New CV version' })
      .getByText('What is it for?'),
  ).toBeVisible();
});

test('a version that could not be made is tried again, and made', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  await openCv(page);
  await page.evaluate(() => window.qdPreviewProfile?.failNextCv('model'));
  await page.getByRole('button', { name: 'Improve my CV' }).click();
  await page
    .getByRole('dialog', { name: 'Improve your CV in general' })
    .getByRole('button', { name: 'Create the version' })
    .click();

  const failed = page.getByRole('alert');
  await expect(failed).toContainText('We couldn’t create this version');
  await failed.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('region', { name: 'Your CV' })).toContainText(
    'waiting for you',
  );

  // The failed one is gone: one version in the list
  await page.getByRole('link', { name: 'CV', exact: true }).first().click();
  await expect(
    page.getByRole('region', { name: 'General' }).getByRole('listitem'),
  ).toHaveCount(1);
});

test('with no CV in the profile, "Add your CV first" leads to it', async ({
  page,
}) => {
  await openProfile(page);
  await openCv(page);

  await page.getByRole('button', { name: 'Add your CV' }).click();
  await expect(page).toHaveURL('/profile');
  await expect(page.getByRole('dialog', { name: 'Add your CV' })).toBeVisible();
});
