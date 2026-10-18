// CV versions (delivery 2b), with the in-memory profile gateway: the screens working together in
// a browser. The fake makes a version a moment after it is asked for, with an answer that
// quotes the CV, as the backend's offline answer does. The same use case against the backend's
// code is in e2e-emulators/.
import { readFileSync } from 'node:fs';

import { expect, type Page, test } from '@playwright/test';

import {
  openHome,
  openProfile,
  seedApplications,
  seedProfile,
} from './support';

/** Today as the pages write it, "18 Oct 2026". */
const today = () =>
  new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

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

test('a general version: from the first screen, made in the background, reviewed to the end, then removed', async ({
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
  await expect(page.getByText('0 of 3 reviewed')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'What we found' }),
  ).toContainText('2 things to improve · 1 medium · 1 low');

  // The review: the first change is open, beside the CV with it marked
  const aside = page.getByRole('complementary', { name: 'Changes' });
  await expect(aside).toContainText('Your line');
  await aside.getByRole('button', { name: 'Edit' }).click();
  await aside
    .getByLabel('Your wording')
    .fill('Built the reconciliation service and ran it.');
  await aside.getByRole('button', { name: 'Save my wording' }).click();
  await expect(page.getByText('1 of 3 reviewed')).toBeVisible();
  await aside.getByRole('button', { name: /Added from your profile/ }).click();
  await aside.getByRole('button', { name: 'Keep mine' }).click();
  await aside.getByText(/^Questions · /).click();
  await aside.getByRole('button', { name: /How many people/ }).click();
  await aside.getByLabel('Your answer').fill('Nine engineers, for two years.');
  await aside.getByRole('button', { name: 'Use my answer' }).click();

  // Nothing left: ready, and the CV as it would be downloaded
  await expect(
    page.getByRole('heading', { name: 'Your version is ready' }),
  ).toBeVisible();
  // At phone width the CV is behind the "Your CV" switch
  const showCv = page.getByText('Your CV', { exact: true });
  if (await showCv.isVisible()) {
    await showCv.click();
  }
  await page.getByRole('switch', { name: 'Show changes' }).uncheck();
  const cv = page.getByRole('article', { name: 'Your CV' });
  await expect(cv).toContainText(
    'Built the reconciliation service and ran it.',
  );
  await expect(cv).toContainText('Nine engineers, for two years.');

  // The download, made in the browser: a PDF, and Word under the arrow
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const pdfFile = await pdf;
  expect(pdfFile.suggestedFilename()).toBe(
    `Data engineer, in general - CV - ${today()}.pdf`,
  );
  expect(
    readFileSync(await pdfFile.path())
      .subarray(0, 5)
      .toString(),
  ).toBe('%PDF-');
  const word = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Other formats: Word (.docx)' })
    .click();
  await page.getByRole('menuitem', { name: 'Word (.docx)' }).click();
  const wordFile = await word;
  expect(wordFile.suggestedFilename()).toMatch(/\.docx$/);
  expect(
    readFileSync(await wordFile.path())
      .subarray(0, 2)
      .toString(),
  ).toBe('PK');

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
  await expect(page.getByText('0 of 3 reviewed')).toBeVisible();
  // For a job: what it asks for that neither the CV nor the profile shows
  await expect(
    page.getByRole('region', { name: 'Not in your CV or profile' }),
  ).toBeVisible();

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
  await expect(page.getByText('0 of 3 reviewed')).toBeVisible();

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

test('a version for a job, reviewed, is marked as the one sent', async ({
  page,
}) => {
  await openHome(page);
  await seedApplications(page);
  await openCv(page);
  await page.getByRole('button', { name: 'Choose a job' }).click();
  await page
    .getByRole('dialog', { name: 'New CV version' })
    .getByRole('button', { name: 'Create the version' })
    .click();
  const aside = page.getByRole('complementary', { name: 'Changes' });
  await expect(aside).toContainText('Your line');
  await aside.getByRole('button', { name: 'Accept' }).click();
  await aside.getByRole('button', { name: /Added from your profile/ }).click();
  await aside.getByRole('button', { name: 'Accept' }).click();
  await aside.getByText(/^Questions · /).click();
  await aside.getByRole('button', { name: /How many people/ }).click();
  await aside.getByRole('button', { name: 'Skip' }).click();

  await page.getByRole('button', { name: 'Mark as sent' }).click();
  await expect(page.getByText('Sent with your application')).toBeVisible();
});

test('two versions for a job compared, the earlier one restored as a copy, and the application’s CV tab', async ({
  page,
}) => {
  await openHome(page);
  await seedApplications(page);
  await openCv(page);

  // A first version, its rewrite accepted
  await page.getByRole('button', { name: 'Choose a job' }).click();
  await page
    .getByRole('dialog', { name: 'New CV version' })
    .getByRole('button', { name: 'Create the version' })
    .click();
  const aside = page.getByRole('complementary', { name: 'Changes' });
  await aside.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('1 of 3 reviewed')).toBeVisible();

  // A second one for the same job, nothing decided yet
  await page.getByRole('link', { name: 'CV', exact: true }).first().click();
  await page.getByRole('button', { name: 'New version' }).click();
  await page
    .getByRole('dialog', { name: 'New CV version' })
    .getByRole('button', { name: 'Create the version' })
    .click();
  await expect(page.getByText('0 of 3 reviewed')).toBeVisible();

  // Compared: the line the first one rewrote
  await page.getByRole('link', { name: 'Compare' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Compare two versions' }),
  ).toBeVisible();
  const differences = page.getByRole('region', { name: '1 difference' });
  await expect(differences).toContainText('Changed');
  await expect(differences).toContainText(
    'which cut the time it took by half.',
  );

  // Restored: a copy, the newest, with its decision
  await page.getByRole('button', { name: /Restore the version of/ }).click();
  await expect(page.getByText(/A copy of the version of/)).toBeVisible();
  await expect(page.getByText('1 of 3 reviewed')).toBeVisible();

  // The application's CV tab: its versions, and a new one for it
  await page.getByRole('link', { name: 'CV', exact: true }).first().click();
  await page
    .getByRole('link', { name: 'Open the application' })
    .first()
    .click();
  await page
    .getByRole('navigation', { name: 'Application' })
    .getByRole('link', { name: 'CV' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Other versions' }).getByRole('listitem'),
  ).toHaveCount(3);
  await page.getByRole('button', { name: 'New version for this job' }).click();
  await expect(
    page.getByRole('dialog', { name: 'New CV version' }),
  ).toBeVisible();
});
