// CV versions against the real backend code (research docs 18 and 19): createCvVersion with
// `mode: 'write'` through App Check and both flags, the background trigger that writes the CV with
// the fake model's offline answer, the written version read back under the rules, copyCvVersion,
// and removeCvVersion. The fake writes from the profile's items (a reading in the emulator gives
// skills only), so the tests check where a version is, not what it says.
import { expect, type Page, test } from '@playwright/test';

import { createAccount, openProfile, signIn } from './support';

/** A small fictional CV as a text file: its lines are what the fake quotes. */
const CV_TEXT = Buffer.from(
  [
    'Maya Okafor',
    'Experience',
    '- Built the reconciliation service for card transactions at Fenwick Pay',
    '- Ran the on-call rota for a team of nine engineers for two years',
    'Education',
    '- BSc Computer Science, Ashdown University, 2015',
  ].join('\n'),
);

/** Adds the CV as a text file on the profile page, and waits until it is read. */
const addCv = async (page: Page) => {
  await page.getByRole('button', { name: 'Add your CV' }).click();
  await page.getByRole('button', { name: /Upload a file/ }).click();
  const form = page.getByRole('dialog', { name: 'Upload your CV' });
  await form.locator('input[type=file]').setInputFiles({
    name: 'maya-okafor-cv.txt',
    mimeType: 'text/plain',
    buffer: CV_TEXT,
  });
  await form.getByLabel('Title').fill('Maya Okafor CV 2026');
  await form.getByRole('button', { name: 'Add to profile' }).click();
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: 'Maya Okafor CV 2026' })
      .getByText('Ready', { exact: true }),
  ).toBeVisible();
};

test('a general CV: written in the background from the profile, read back, then removed', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    cvTool: true,
  });
  await signIn(page, account);
  await openProfile(page);
  // A CV in the profile: its reading gives the items and the CV details
  await addCv(page);

  // createCvVersion answers at once; the page follows the document until it is written
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'CV', exact: true })
    .click();
  await page.getByRole('button', { name: 'Write a general CV' }).click();
  await page
    .getByRole('dialog', { name: 'Write a general CV' })
    .getByRole('button', { name: 'Write my CV' })
    .click();
  await expect(page).toHaveURL(/\/cv\/versions\/.+/);
  const cv = page.getByRole('article', { name: 'Your CV' });
  await expect(cv).toContainText('fake-profile:');
  await expect(cv).toContainText('fake-skills:');
  await expect(
    page.getByRole('region', { name: 'What we did and why' }),
  ).toContainText('fake-note:');
  await expect(
    page.getByRole('region', { name: /^Questions · / }),
  ).toContainText('fake-question:');

  // Read back from the backend's document after a reload, with its header from the details
  await page.reload();
  await expect(cv).toContainText('fake-profile:');
  await expect(cv).toContainText(/fake-.*·.*fake-/);

  // removeCvVersion: gone from the backend, not only from the page
  await page.getByRole('button', { name: 'Remove this version' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this version?' })
    .getByRole('button', { name: 'Remove the version' })
    .click();
  await expect(page).toHaveURL('/cv');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Write a general CV' }),
  ).toBeVisible();
});

test('without the CV tool, the CV pages say "not available", and the navigation has no CV', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);

  await expect(
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'CV', exact: true }),
  ).toHaveCount(0);
  await page.goto('/cv');
  await expect(
    page.getByText(/CVs written for your jobs, or in general/),
  ).toBeVisible();
});

test('a written CV restored (copyCvVersion): compared with a later one, copied, the newest', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    cvTool: true,
  });
  await signIn(page, account);
  await openProfile(page);
  await addCv(page);
  const cv = () =>
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'CV', exact: true })
      .click();
  const written = page.getByRole('article', { name: 'Your CV' });

  // Two general CVs, written from the same profile
  await cv();
  await page.getByRole('button', { name: 'Write a general CV' }).click();
  await page
    .getByRole('dialog', { name: 'Write a general CV' })
    .getByRole('button', { name: 'Write my CV' })
    .click();
  await expect(written).toContainText('fake-profile:');
  await cv();
  await page.getByRole('button', { name: 'New version' }).click();
  const panel = page.getByRole('dialog', { name: 'New CV version' });
  await panel.getByText('No job in particular').click();
  await panel.getByRole('button', { name: 'Write my CV' }).click();
  await expect(written).toContainText('fake-profile:');

  // Compared, then the first restored: a copy, the newest, read back
  await page.getByRole('link', { name: 'Compare' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Compare two versions' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Restore the version of/ }).click();
  await expect(page.getByText(/A copy of the version of/)).toBeVisible();
  await page.reload();
  await expect(written).toContainText('fake-profile:');
  await cv();
  await expect(
    page.getByRole('region', { name: 'General' }).getByRole('listitem'),
  ).toHaveCount(3);
});

test('the CV details: filled by reading the CV, corrected with updateCvDetails, read back', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    cvTool: true,
  });
  await signIn(page, account);
  await openProfile(page);
  await addCv(page);

  // profile-extract 1.3.0 filled details/cv: the fake writes every field as fake-<digest>
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'CV', exact: true })
    .click();
  const card = page.getByRole('region', { name: 'At the top of every CV' });
  await expect(card).toContainText(/fake-.* · fake-/);
  await expect(card).toContainText('1 link');
  await card.getByRole('button', { name: 'Edit your details' }).click();
  const panel = page.getByRole('dialog', { name: 'Your CV details' });
  await expect(panel).toContainText(
    'We filled these from Maya Okafor CV 2026 on',
  );

  // Only the fields changed are sent; the backend keeps them as the candidate's
  await panel.getByLabel('Phone (optional)').fill('07700 900999');
  await panel.getByLabel('Right to work (optional)').fill('');
  await panel.getByRole('button', { name: 'Save my details' }).click();
  await expect(panel).toBeHidden();
  await expect(card).toContainText('07700 900999');

  // Read back from the backend's document after a reload
  await page.reload();
  await expect(card).toContainText('07700 900999');
  await card.getByRole('button', { name: 'Edit your details' }).click();
  await expect(panel.getByLabel('Right to work (optional)')).toHaveValue('');
  await expect(panel.getByLabel('Full name')).toHaveValue(/^fake-/);
});

test('a written CV revised (reviseCvLine), a question answered, then written again (rewriteCvVersion)', async ({
  page,
}) => {
  const account = await createAccount({
    interviewAssistant: true,
    cvTool: true,
  });
  await signIn(page, account);
  await openProfile(page);
  await addCv(page);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'CV', exact: true })
    .click();
  await page.getByRole('button', { name: 'Write a general CV' }).click();
  await page
    .getByRole('dialog', { name: 'Write a general CV' })
    .getByRole('button', { name: 'Write my CV' })
    .click();
  const cv = page.getByRole('article', { name: 'Your CV' });
  const line = page.getByRole('region', { name: 'This line' });
  await expect(cv).toContainText('fake-profile:');

  // The skills edited, the profile line removed: both kept by the backend
  await cv.getByRole('button', { name: /fake-skills:/ }).click();
  await line.getByRole('button', { name: 'Edit' }).click();
  await line.getByLabel('Your wording').fill('Go, TypeScript and Kotlin.');
  await line.getByRole('button', { name: 'Save my wording' }).click();
  await expect(line).toContainText('Edited by you');
  await cv.getByRole('button', { name: /fake-profile:/ }).click();
  await line.getByRole('button', { name: 'Remove this line' }).click();
  await expect(cv).toContainText('Line removed by you');
  await page.reload();
  await expect(cv).toContainText('Go, TypeScript and Kotlin.');
  await expect(cv).toContainText('Edited by you · Your words');
  await expect(cv).toContainText('Line removed by you');

  // answerCvQuestion on a written version, then rewriteCvVersion: a new version, made in the background
  const questions = page.getByRole('region', { name: /^Questions · / });
  await questions.getByLabel('Your answer').fill('Nine engineers.');
  await questions.getByRole('button', { name: 'Save the answer' }).click();
  await expect(questions).toContainText('Answered: Nine engineers.');
  await page
    .getByRole('button', { name: 'Write again with my answers (1)' })
    .click();
  await expect(
    page.getByText(
      /^Written again from the version of .+, with 1 of your answers/,
    ),
  ).toBeVisible();
  // cv-write 1.1.0's fake writes again as the writer does: the answer used, what was removed left out
  await expect(cv).toContainText('fake-answer: Nine engineers.');
  await expect(cv).not.toContainText('fake-profile:');
  await page.reload();
  await expect(cv).toContainText('fake-answer: Nine engineers.');
  await expect(
    page.getByRole('link', { name: /^Open the version of/ }),
  ).toBeVisible();
});
