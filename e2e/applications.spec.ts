// Job applications (delivery 2a), with the in-memory profile gateway: the screens working
// together in a browser. The same use case against the backend's code is in e2e-emulators/.
import { expect, test } from '@playwright/test';

import { openHome, seedApplications } from './support';

const JOB =
  'Northwind Logistics moves two million parcels a day across Europe. We are looking for a Senior Backend Engineer to own the services behind parcel tracking.';

test('an application: added from the home, its page, edited, removed', async ({
  page,
}) => {
  await openHome(page);

  // "Prepare for a job" opens "New application"
  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(panel.getByText('Enter a title')).toBeVisible();
  await expect(
    panel.getByText('Paste the job description', { exact: true }),
  ).toBeVisible();
  await panel.getByLabel('Title').fill('Senior Backend Engineer');
  await panel.getByLabel('Job description').fill(JOB);
  await expect(panel.getByText(`${JOB.length} / 20,000`)).toBeVisible();
  await panel.getByRole('button', { name: 'Add the job' }).click();

  // Its page opens on the brief; the details are a tab
  await expect(page).toHaveURL(/\/applications\/.+/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Senior Backend Engineer' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Prepare your brief' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Details' }).click();
  await expect(page).toHaveURL(/\/applications\/.+\/details$/);
  const job = page.getByRole('region', { name: 'The job' });
  await expect(job).toContainText(/Pasted on/);
  await expect(job).toContainText('two million parcels');

  // Edited: the company, a notes line and the posting
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await edit.getByLabel('Company (optional)').fill('Northwind Logistics');
  await edit
    .getByLabel('Link to the posting (optional)')
    .fill('http://intranet.local/job');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    edit.getByText('Enter the https address of a public page.'),
  ).toBeVisible();
  await edit
    .getByLabel('Link to the posting (optional)')
    .fill('https://northwind-logistics.example/careers/1482');
  await edit.getByLabel('Notes (optional)').fill('Two technical rounds.');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  const details = page.getByRole('region', { name: 'Details' });
  await expect(details).toContainText('Northwind Logistics');
  await expect(details).toContainText('Two technical rounds.');
  await expect(
    details.getByRole('link', {
      name: 'northwind-logistics.example/careers/1482',
    }),
  ).toHaveAttribute('target', '_blank');

  // Still there after a reload, and listed on the home
  await page.reload();
  await expect(details).toContainText('Northwind Logistics');
  await page.getByRole('link', { name: 'Home', exact: true }).last().click();
  await expect(page).toHaveURL('/home');
  const card = page
    .getByRole('listitem')
    .filter({ hasText: 'Senior Backend Engineer' });
  await expect(card).toContainText('No brief yet');
  await card.getByRole('link').click();
  await page.getByRole('link', { name: 'Details' }).click();

  // Removed after asking: back on the home, which has no application again
  await page.getByRole('button', { name: 'Remove this application' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Remove this application?',
  });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Remove this application' }).click();
  await dialog.getByRole('button', { name: 'Remove the application' }).click();
  await expect(page).toHaveURL('/home');
  await expect(
    page.getByRole('heading', { name: 'What do you want to do?' }),
  ).toBeVisible();
});

test('the home lists the applications with where their brief is', async ({
  page,
}) => {
  await openHome(page);
  await seedApplications(page);

  const cards = page.getByRole('listitem');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('Senior Backend Engineer');
  await expect(cards.nth(0)).toContainText('Brief ready');
  await expect(cards.nth(0)).toContainText('2 gaps');
  await expect(cards.nth(1)).toContainText('Brief out of date');
  await expect(cards.nth(2)).toContainText('No brief yet');
  await expect(
    page.getByRole('region', { name: 'Your profile' }),
  ).toContainText('6 resources');

  // A card opens its application
  await cards.nth(1).getByRole('link').click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Engineering Manager' }),
  ).toBeVisible();
});

test('the brief: prepared, opened on a gap and a question, out of date when the job changes, refreshed', async ({
  page,
}) => {
  await openHome(page);
  await page.evaluate(() => window.qdPreviewProfile?.seed());
  await page.reload();

  // A new application opens on its brief, not prepared yet
  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByLabel('Title').fill('Senior Backend Engineer');
  await panel
    .getByLabel('Job description')
    .fill(
      'You will run Go services in production. You will lead incident response. You will mentor engineers. You know Kafka at scale.',
    );
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(
    page.getByRole('heading', { name: 'Prepare your brief' }),
  ).toBeVisible();

  // The first attempt fails; the second works
  await page.evaluate(() => window.qdPreviewProfile?.failNextBrief('model'));
  await page.getByRole('button', { name: 'Prepare the brief' }).click();
  await expect(page.getByRole('status')).toContainText('Preparing your brief');
  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t prepare the brief this time.',
  );
  await page
    .getByRole('alert')
    .getByRole('button', { name: 'Try again' })
    .click();
  const requirements = page.getByRole('region', {
    name: 'What the job asks for',
  });
  await expect(requirements).toContainText('4 · 2 gaps');
  await expect(
    page.getByText(/Prepared .* · 8 of 10 left today/),
  ).toBeVisible();

  // A gap: the job's words, and "Add a story" as a note
  await requirements
    .getByRole('button', { name: /You know Kafka at scale/ })
    .click();
  await expect(
    requirements.getByText('You know Kafka at scale.'),
  ).toBeVisible();
  await requirements.getByRole('button', { name: 'Add a story' }).click();
  const story = page.getByRole('dialog', { name: 'Paste or type text' });
  await expect(story.getByRole('radio', { name: 'Note' })).toBeChecked();
  await story.getByRole('button', { name: 'Close' }).click();

  // A requirement the profile shows: the item, with where it came from
  await requirements
    .getByRole('button', { name: /You will run Go services in production/ })
    .click();
  await expect(
    requirements
      .getByText(/^(Skill|Experience|Project|Achievement|Story) · /)
      .first(),
  ).toBeVisible();

  // A likely question, with notes
  const questions = page.getByRole('region', { name: 'Likely questions' });
  await questions.getByRole('button', { name: /an incident you led/ }).click();
  await expect(
    questions.getByText('Notes for your answer').filter({ visible: true }),
  ).toHaveCount(1);

  // The job changes in Details: the brief says so, and "Refresh" prepares it again
  await page.getByRole('link', { name: 'Details' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await edit
    .getByLabel('Job description')
    .fill('You will run Go services in production. You know Terraform.');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await page.getByRole('link', { name: 'Brief' }).click();
  const changed = page.getByText(
    'The job details changed since this brief was prepared.',
  );
  await expect(changed).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(changed).toBeHidden();
  await expect(requirements).toContainText('2 · 2 gaps');
});
