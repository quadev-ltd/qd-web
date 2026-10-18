// Job applications against the real backend code: createJobApplication with a job as text, a
// file or a link (research doc 17), the reading that names it, updateJobApplication,
// removeJobApplication and prepareApplicationBrief, through App Check and the flag, and the
// documents the site reads back under the rules. The backend's fake model names a job
// "fake-…": the tests check that a name appears, not what it says.
import { expect, type Page, test } from '@playwright/test';

import { createAccount, signIn } from './support';

/** A name the fake model gave: "fake-<digest>", the role alone for a title. */
const FAKE_NAME = /^fake-/;

const newApplication = async (page: Page) => {
  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  return page.getByRole('dialog', { name: 'New application' });
};

test('E4: a pasted job is read and named, shown on its page and the home, edited and removed', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);

  // createJobApplication with the job's text; the backend reads it and names it
  const panel = await newApplication(page);
  await panel
    .getByLabel('Job description')
    .fill('Go services in production, Kafka, and incident response.');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(page).toHaveURL(/\/applications\/.+/);
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveText(FAKE_NAME);
  await expect(
    page.getByRole('button', { name: 'Prepare the brief' }),
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
  const card = page.getByRole('listitem').filter({ hasText: FAKE_NAME });
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

test('a job as a file: uploaded under the Storage rules, read by the trigger, named', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);

  const panel = await newApplication(page);
  await panel.getByText('File', { exact: true }).click();
  await panel.locator('input[type=file]').setInputFiles({
    name: 'platform-engineer.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Platform Engineer at Halvorsen. Kubernetes and Terraform.',
    ),
  });
  await panel.getByRole('button', { name: 'Add the job' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(FAKE_NAME);
  await page.getByRole('link', { name: 'Details' }).click();
  await expect(page.getByRole('region', { name: 'The job' })).toContainText(
    /Read from platform-engineer\.txt on/,
  );
});

test('a posting that cannot be read: said, then its text pasted instead, named by hand', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);

  // A host under .invalid fails in the emulators (link-unreadable)
  const panel = await newApplication(page);
  await panel.getByText('Link', { exact: true }).click();
  await panel
    .getByLabel('Address of the posting')
    .fill('https://jobs.invalid/platform-engineer');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  const status = page.getByRole('status');
  await expect(status).toContainText('We couldn’t read this page');

  // updateJobApplication with the text makes the job ready; the names are given by hand
  await status.getByRole('button', { name: 'Paste the text instead' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await edit.getByLabel('Title').fill('Platform Engineer');
  await edit
    .getByLabel('Job description')
    .fill('Kubernetes and Terraform for 40 engineers.');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Platform Engineer' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Prepare the brief' }),
  ).toBeVisible();
});

test('E5 and E6: a brief is prepared, goes out of date when the job changes, is refreshed, and says when the profile changed', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);

  const panel = await newApplication(page);
  await panel
    .getByLabel('Job description')
    .fill('Kubernetes and Terraform for 40 engineers.');
  await panel.getByRole('button', { name: 'Add the job' }).click();

  // prepareApplicationBrief, with the backend's fake model, once the job is read
  await page
    .getByRole('button', { name: 'Prepare the brief' })
    .click({ timeout: 30_000 });
  const requirements = page.getByRole('region', {
    name: 'What the job asks for',
  });
  await expect(requirements).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Likely questions' }),
  ).toBeVisible();
  await expect(page.getByText(/9 of 10 left today/)).toBeVisible();

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
  await expect(changed).toBeHidden();
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

test('a posting read again (readJobPostingAgain): the same posting says so; over an edited text, asked first, then replaced', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);

  const panel = await newApplication(page);
  await panel.getByText('Link', { exact: true }).click();
  await panel
    .getByLabel('Address of the posting')
    .fill('https://careers.northwind.example/platform-engineer');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(FAKE_NAME);
  await page.getByRole('link', { name: 'Details' }).click();
  const job = page.getByRole('region', { name: 'The job' });
  const readAgain = job.getByRole('button', {
    name: 'Read the posting again',
  });

  // The same posting: the fake model gives the same copy for the same address
  await readAgain.click();
  await expect(job).toContainText(
    'The posting hasn’t changed, so your copy stays as it is.',
  );

  // An edited text: the backend refuses without replaceEdited, so the page asks first
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await edit.getByLabel('Job description').fill('My own notes on the job.');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await readAgain.click();
  await page
    .getByRole('dialog', { name: 'Replace your edited text?' })
    .getByRole('button', { name: 'Replace my text' })
    .click();
  await expect(job).toContainText(
    'The posting had changed, so this copy is new.',
  );
  await expect(job).not.toContainText('My own notes on the job.');
});
