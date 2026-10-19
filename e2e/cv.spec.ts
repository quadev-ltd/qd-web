// CV versions, with the in-memory profile gateway: the screens working together in a browser. A
// new version is a CV written from the profile (D83): the fake writes it a moment after it is
// asked for, from the profile's items, each line citing its item, as the backend's offline answer
// does. A version made before D83 (edits to a CV) is made with a preview control, since the
// pages no longer ask for one. The same use cases against the backend's code are in
// e2e-emulators/.
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

/** Writes a CV from the open panel and waits for it to be written. */
const writeCv = async (page: Page, panelName: string) => {
  await page
    .getByRole('dialog', { name: panelName })
    .getByRole('button', { name: 'Write my CV' })
    .click();
  await expect(page).toHaveURL(/\/cv\/versions\/.+/);
  await expect(page.getByRole('article', { name: 'Your CV' })).toBeVisible();
};

test('a general CV: written from the profile, read with its sources, downloaded, then removed', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  await openCv(page);

  // No version yet: the two ways in, and the CV details at the top
  await expect(
    page.getByRole('heading', { name: 'How we keep it true' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Write a general CV' }).click();
  const panel = page.getByRole('dialog', { name: 'Write a general CV' });
  await expect(
    panel.getByText('Written as a UK CV: British spelling, A4 pages.'),
  ).toBeVisible();
  await expect(panel).toContainText('Maya Okafor · Senior Backend Engineer');
  await panel.getByLabel('Aim it at a role (optional)').fill('Data engineer');
  await panel.getByText('1 page', { exact: true }).click();
  await panel.getByRole('button', { name: 'Write my CV' }).click();

  // Its page while it is written, then the CV
  await expect(page).toHaveURL(/\/cv\/versions\/.+/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Data engineer, in general' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Writing your CV');
  const cv = page.getByRole('article', { name: 'Your CV' });
  await expect(cv).toContainText('Maya Okafor');
  await expect(cv).toContainText('Senior Backend Engineer · Fenwick Pay');
  await expect(cv).toContainText('From Maya Okafor CV 2026');
  await expect(
    page.getByRole('region', { name: 'What we did and why' }),
  ).toContainText('1 line left out: not backed by your profile.');

  // Off, the CV shows as it downloads
  await page
    .getByRole('switch', { name: 'Show where each line comes from' })
    .uncheck();
  await expect(cv).not.toContainText('From Maya Okafor CV 2026');

  // The download, from the structure: a PDF, and Word under the arrow
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
  const general = page.getByRole('region', { name: 'General' });
  await expect(general.getByText('Data engineer, in general')).toBeVisible();
  await expect(general).toContainText('written from your profile');
  await page.getByRole('link', { name: /Data engineer, in general/ }).click();
  await page.getByRole('button', { name: 'Remove this version' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this version?' });
  await dialog.getByRole('button', { name: 'Remove the version' }).click();
  await expect(page).toHaveURL('/cv');
  await expect(
    page.getByRole('button', { name: 'Write a general CV' }),
  ).toBeVisible();
});

test('a CV for a job: asked in "New version", listed under its application, marked as sent', async ({
  page,
}) => {
  await openHome(page);
  await seedApplications(page);
  await openCv(page);
  await page.getByRole('button', { name: 'Choose a job' }).click();
  const panel = page.getByRole('dialog', { name: 'New CV version' });
  await panel.getByRole('radio', { name: /Platform Engineer/ }).check();
  await writeCv(page, 'New CV version');
  // For a job: what it asks for that the profile doesn't show, and "Did you send it?"
  await expect(
    page.getByRole('region', { name: 'Not in your CV or profile' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mark as sent' }).click();
  await expect(page.getByText('Sent with your application')).toBeVisible();

  await page.getByRole('link', { name: 'CV', exact: true }).first().click();
  const forJob = page.getByRole('region', { name: 'For a job' });
  await expect(
    forJob.getByRole('heading', { name: 'Platform Engineer' }),
  ).toBeVisible();
  await expect(forJob).toContainText('Written for this job');
  await expect(forJob).toContainText('1 question');

  // "New version" asks what it is for
  await page.getByRole('button', { name: 'New version' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'New CV version' })
      .getByText('What is it for?'),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'New CV version' })
    .getByRole('button', { name: 'Close' })
    .click();

  // The application's CV tab: the version sent, and a new one for it
  await forJob.getByRole('link', { name: 'Open the application' }).click();
  await page
    .getByRole('navigation', { name: 'Application' })
    .getByRole('link', { name: 'CV' })
    .click();
  await expect(page.getByText('Sent with your application')).toBeVisible();
  await page.getByRole('button', { name: 'New version for this job' }).click();
  await expect(
    page.getByRole('dialog', { name: 'New CV version' }),
  ).toBeVisible();
});

test('a CV that could not be written is tried again, and written', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  await openCv(page);
  await page.evaluate(() => window.qdPreviewProfile?.failNextCv('model'));
  await page.getByRole('button', { name: 'Write a general CV' }).click();
  await page
    .getByRole('dialog', { name: 'Write a general CV' })
    .getByRole('button', { name: 'Write my CV' })
    .click();

  const failed = page.getByRole('alert');
  await expect(failed).toContainText('We couldn’t write this CV');
  await failed.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('article', { name: 'Your CV' })).toBeVisible();

  // The failed one is gone: one version in the list
  await page.getByRole('link', { name: 'CV', exact: true }).first().click();
  await expect(
    page.getByRole('region', { name: 'General' }).getByRole('listitem'),
  ).toHaveCount(1);
});

test('with nothing in the profile, "Add to your profile first" leads to it', async ({
  page,
}) => {
  await openProfile(page);
  await openCv(page);

  await expect(
    page.getByRole('heading', { name: 'Add to your profile first' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add your CV' }).click();
  await expect(page).toHaveURL('/profile');
  await expect(page.getByRole('dialog', { name: 'Add your CV' })).toBeVisible();
});

test('a version made before D83 is still reviewed to the end, compared with a written one, and restored', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  // Made before the CV pages read the versions, so the list has it
  await page.evaluate(() => window.qdPreviewProfile?.createEditVersion());
  await openCv(page);
  const general = page.getByRole('region', { name: 'General' });
  await expect(general).toContainText('edits to Maya Okafor CV 2026');
  await general.getByRole('link', { name: /Your CV, in general/ }).click();

  // Its review, as before: each change decided, the question answered
  await expect(page.getByText('0 of 3 reviewed')).toBeVisible();
  const aside = page.getByRole('complementary', { name: 'Changes' });
  await aside.getByRole('button', { name: 'Accept' }).click();
  await aside.getByRole('button', { name: /Added from your profile/ }).click();
  await aside.getByRole('button', { name: 'Keep mine' }).click();
  await aside.getByText(/^Questions · /).click();
  await aside.getByRole('button', { name: /How many people/ }).click();
  await aside.getByLabel('Your answer').fill('Nine engineers, for two years.');
  await aside.getByRole('button', { name: 'Use my answer' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your version is ready' }),
  ).toBeVisible();

  // A written one for the same purpose, then the two compared
  await page.getByRole('link', { name: 'CV', exact: true }).first().click();
  await page.getByRole('button', { name: 'New version' }).click();
  await page
    .getByRole('dialog', { name: 'New CV version' })
    .getByText('No job in particular')
    .click();
  await writeCv(page, 'New CV version');
  await page.getByRole('link', { name: 'Compare' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Compare two versions' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: /\d+ differences/ }),
  ).toContainText('PROFILE');

  // The earlier one restored: a copy, the newest, with its decisions
  await page.getByRole('button', { name: /Restore the version of/ }).click();
  await expect(page.getByText(/A copy of the version of/)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Your version is ready' }),
  ).toBeVisible();
});

test('the CV details at the top of every CV: filled from the CV, corrected, and kept', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  await openCv(page);

  const card = page.getByRole('region', { name: 'At the top of every CV' });
  await expect(card).toContainText('Maya Okafor · Senior Backend Engineer');
  await expect(card).toContainText(
    'London, UK · maya.okafor@example.com · 07700 900123 · 2 links',
  );
  await card.getByRole('button', { name: 'Edit your details' }).click();

  const panel = page.getByRole('dialog', { name: 'Your CV details' });
  await expect(panel).toContainText(
    `We filled these from Maya Okafor CV 2026 on`,
  );
  await panel.getByLabel('Phone (optional)').fill('07700 900999');
  await panel.getByRole('button', { name: 'Remove link 1' }).click();
  await panel.getByRole('button', { name: 'Add a link' }).click();
  await panel
    .getByRole('textbox', { name: 'Link 2' })
    .fill('maya-okafor.example');
  await panel.getByLabel('Right to work (optional)').fill('');
  await panel.getByRole('button', { name: 'Save my details' }).click();

  await expect(panel).toBeHidden();
  await expect(card).toContainText(
    'London, UK · maya.okafor@example.com · 07700 900999 · 2 links',
  );
  // Opened again: what was saved, and the right to work left out
  await card.getByRole('button', { name: 'Edit your details' }).click();
  await expect(panel.getByRole('textbox', { name: 'Link 1' })).toHaveValue(
    'github.com/maya-okafor-example',
  );
  await expect(panel.getByRole('textbox', { name: 'Link 2' })).toHaveValue(
    'maya-okafor.example',
  );
  await expect(panel.getByLabel('Right to work (optional)')).toHaveValue('');
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(panel).toBeHidden();
});
