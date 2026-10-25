// The interviews of an application (D89) against the real backend code: createApplicationInterview,
// updateApplicationInterview and removeApplicationInterview through App Check and the flag, the
// interview the site reads back under the rules, the start the backend works out from the date,
// the time and the zone, and the application's `interviewTimes` on the list of applications.
import { expect, type Page, test } from '@playwright/test';

import { createAccount, signIn } from './support';

/** An application with its title given, as "Paste the text instead" leaves it. */
const addApplication = async (page: Page) => {
  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel
    .getByLabel('Job description')
    .fill('Go services in production, Kafka, and incident response.');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(page).toHaveURL(/\/applications\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^fake-/);
};

/** A date this many days from today in London, as the date field takes it. */
const inDays = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    Date.now() + days * 86_400_000,
  );

test('an interview is added, shown on its application and the list, edited and removed', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);
  await addApplication(page);
  const applicationUrl = page.url();

  // None yet
  await page.getByRole('link', { name: 'Interviews' }).click();
  await expect(
    page.getByRole('heading', { name: 'No interviews yet' }),
  ).toBeVisible();

  // createApplicationInterview, with the browser's zone
  await page.getByRole('button', { name: 'Add an interview' }).click();
  const add = page.getByRole('dialog', { name: 'Add an interview' });
  await add.getByLabel('Name (optional)').fill('Technical interview');
  await add.getByLabel('Date').fill(inDays(10));
  await add.getByLabel('Start time').fill('14:00');
  await add.getByRole('button', { name: '60 min' }).click();
  await add.getByRole('button', { name: 'Technical' }).click();
  await add
    .getByLabel('What you know about it (optional)')
    .fill('Two engineers, then a design problem about parcel tracking.');
  await add.getByRole('button', { name: 'Add the interview' }).click();
  await expect(add).toBeHidden();

  // Read back from the backend's document after a reload
  await page.reload();
  const comingUp = page.getByRole('region', { name: 'Coming up · 1' });
  await expect(comingUp).toContainText('Technical interview');
  await expect(comingUp).toContainText('14:00 to 15:00 · in 10 days');
  await expect(page.getByText(/^Times are in London time/)).toBeVisible();

  // interviewTimes: the next interview on the list of applications
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Applications', exact: true })
    .click();
  await expect(page.getByText(/^Next interview .+, 14:00$/)).toBeVisible();

  // updateApplicationInterview: a new time, and the type cleared
  await page.goto(applicationUrl);
  await page.getByRole('link', { name: 'Interviews' }).click();
  await page.getByRole('link', { name: 'Technical interview' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Technical interview' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Get ready for it' }),
  ).toContainText('Coming soon');
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the interview' });
  await edit.getByLabel('Name (optional)').fill('');
  await edit.getByLabel('Start time').fill('09:30');
  await edit.getByRole('button', { name: 'Technical' }).click();
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await page.reload();
  // Without a name or a type: "Interview"
  await expect(
    page.getByRole('heading', { level: 1, name: 'Interview' }),
  ).toBeVisible();
  const details = page.getByRole('region', { name: 'Details' });
  await expect(details).toContainText('09:30 to 10:30, London time');
  await expect(details).not.toContainText('Technical');

  // removeApplicationInterview: gone from the backend and from the list's next interview
  await page.getByRole('button', { name: 'Remove this interview' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this interview?' })
    .getByRole('button', { name: 'Remove the interview' })
    .click();
  await expect(page).toHaveURL(/\/interviews$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'No interviews yet' }),
  ).toBeVisible();
  await page.goto('/applications');
  await expect(page.getByText(/^Next interview/)).toBeHidden();
});

test('a past interview is kept under "Past", and is not the next one', async ({
  page,
}) => {
  const account = await createAccount({ interviewAssistant: true });
  await signIn(page, account);
  await addApplication(page);

  await page.getByRole('link', { name: 'Interviews' }).click();
  await page.getByRole('button', { name: 'Add an interview' }).click();
  const add = page.getByRole('dialog', { name: 'Add an interview' });
  await add.getByLabel('Name (optional)').fill('Recruiter call');
  await add.getByLabel('Date').fill(inDays(-5));
  await add.getByLabel('Start time').fill('11:00');
  await add.getByRole('button', { name: 'Add the interview' }).click();
  await expect(add).toBeHidden();

  await page.reload();
  await expect(page.getByRole('region', { name: 'Past · 1' })).toContainText(
    'Recruiter call',
  );
  await expect(page.getByText(/^Nothing coming up/)).toBeVisible();
  await page.goto('/applications');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText(/^Next interview/)).toBeHidden();
});
