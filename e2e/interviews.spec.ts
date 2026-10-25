// The interviews of an application (D89, canvas version 43, row A8): the Interviews tab after the
// brief, "Add an interview", an interview's page with "Get ready for it · Coming soon", editing
// and removing one, and the next interview on the list of applications. The preview's backend
// works out when each one starts, as the real one does. The browser is in London time
// (playwright.config.ts).
import { expect, type Page, test } from '@playwright/test';

import { openApplications, seedApplications } from './support';

const openInterviews = async (page: Page, title: string) => {
  await page
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('link')
    .first()
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Interviews' }).click();
  await expect(page).toHaveURL(/\/applications\/[^/]+\/interviews$/);
};

test('the interviews of the designs: the next on the list of applications, coming up and past on the tab, one opened', async ({
  page,
}) => {
  await openApplications(page);
  await seedApplications(page);

  // The next interview under the company, when there is one
  const rows = page.getByRole('main').getByRole('listitem');
  await expect(
    rows.filter({ hasText: 'Senior Backend Engineer' }),
  ).toContainText(/Next interview \w{3} \d{1,2} \w{3}, 14:00/);
  await expect(rows.filter({ hasText: 'Engineering Manager' })).toContainText(
    /Next interview \w{3} \d{1,2} \w{3}, 09:30/,
  );
  await expect(rows.filter({ hasText: 'Platform Engineer' })).not.toContainText(
    'Next interview',
  );

  // The tab after the brief, with what is coming up and what is past
  await openInterviews(page, 'Senior Backend Engineer');
  await expect(
    page.getByRole('navigation', { name: 'Application' }).getByRole('link'),
  ).toHaveText(['Brief', 'Interviews', 'Details', 'CV']);
  const comingUp = page.getByRole('region', { name: 'Coming up · 2' });
  await expect(comingUp.getByRole('heading', { level: 3 })).toHaveText([
    'Technical interview',
    'System design',
  ]);
  await expect(comingUp).toContainText('14:00 to 15:00 · in 3 days');
  await expect(
    page
      .getByRole('region', { name: 'Past · 1' })
      .getByRole('heading', { level: 3 }),
  ).toHaveText(['Recruiter call']);
  await expect(page.getByText(/^Times are in London time/)).toBeVisible();

  // One interview: its details, what will come, and the way back
  await comingUp.getByRole('link', { name: 'Technical interview' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Technical interview' }),
  ).toBeVisible();
  const details = page.getByRole('region', { name: 'Details' });
  await expect(details).toContainText(/14:00 to 15:00, London time \(GMT\)/);
  await expect(details).toContainText('In 3 days');
  await expect(details).toContainText('Technical');
  await expect(details).toContainText('60 minutes');
  await expect(details.locator('blockquote')).toContainText(
    'a design problem about parcel tracking events',
  );
  await expect(
    page.getByRole('region', { name: 'Get ready for it' }),
  ).toContainText('Coming soon');
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Senior Backend Engineer' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Coming up · 2' }),
  ).toBeVisible();
});

test('an interview added, shown on the tab and the list, edited and removed', async ({
  page,
}) => {
  await openApplications(page);
  await seedApplications(page);
  await openInterviews(page, 'Platform Engineer');
  await expect(
    page.getByRole('heading', { name: 'No interviews yet' }),
  ).toBeVisible();

  // Add an interview, a year away
  await page.getByRole('button', { name: 'Add an interview' }).click();
  const add = page.getByRole('dialog', { name: 'Add an interview' });
  await expect(add).toContainText('Platform Engineer · Halvorsen');
  await expect(add).toContainText('In your time zone: London time');
  await add.getByRole('button', { name: 'Add the interview' }).click();
  await expect(add.getByText('Enter the date')).toBeVisible();
  await add.getByLabel('Name (optional)').fill('Final interview');
  await add.getByLabel('Date').fill('2027-03-15');
  await add.getByLabel('Start time').fill('10:00');
  await add.getByRole('button', { name: '45 min' }).click();
  await add.getByRole('button', { name: 'Mixed' }).click();
  await expect(add.getByRole('button', { name: 'Mixed' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await add
    .getByLabel('What you know about it (optional)')
    .fill('With the CTO and the head of platform.');
  await add.getByRole('button', { name: 'Add the interview' }).click();
  await expect(add).toBeHidden();
  const row = page
    .getByRole('region', { name: 'Coming up · 1' })
    .getByRole('listitem');
  await expect(row).toContainText('Monday 15 Mar 2027 · 10:00 to 10:45');
  await expect(row).toContainText('With the CTO');
  await expect(row).toContainText('Mixed');
  await expect(row).toContainText('45 min');

  // On the list of applications, read back after a reload
  await page.goto('/applications');
  await expect(
    page.getByRole('main').getByRole('listitem').filter({
      hasText: 'Platform Engineer',
    }),
  ).toContainText('Next interview Mon 15 Mar 2027, 10:00');

  // Edit: no name and no type, so "Interview"; a new time
  await openInterviews(page, 'Platform Engineer');
  await page.getByRole('link', { name: 'Final interview' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the interview' });
  await expect(edit.getByLabel('Date')).toHaveValue('2027-03-15');
  await edit.getByLabel('Name (optional)').fill('');
  await edit.getByRole('button', { name: 'Mixed' }).click();
  await edit.getByLabel('Start time').fill('11:30');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Interview' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Details' })).toContainText(
    '11:30 to 12:15',
  );

  // Remove, asked first
  await page.getByRole('button', { name: 'Remove this interview' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this interview?' });
  await expect(dialog).toContainText(
    'Interview, Monday 15 Mar 2027 at 11:30. You can add it again later.',
  );
  await dialog.getByRole('button', { name: 'Remove the interview' }).click();
  await expect(
    page.getByRole('heading', { name: 'No interviews yet' }),
  ).toBeVisible();
  await page.goto('/applications');
  await expect(
    page.getByRole('main').getByRole('listitem').filter({
      hasText: 'Platform Engineer',
    }),
  ).not.toContainText('Next interview');
});

test('the length and type chips from the keyboard: chosen, then cleared', async ({
  page,
}) => {
  await openApplications(page);
  await seedApplications(page);
  await openInterviews(page, 'Platform Engineer');
  await page.getByRole('button', { name: 'Add an interview' }).click();
  const add = page.getByRole('dialog', { name: 'Add an interview' });

  const thirty = add.getByRole('button', { name: '30 min' });
  await thirty.focus();
  await page.keyboard.press('Space');
  await expect(thirty).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await expect(add.getByRole('button', { name: '45 min' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(add.getByRole('button', { name: '45 min' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(thirty).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Enter');
  await expect(add.getByRole('button', { name: '45 min' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('an interview that is not there says so, with a way back', async ({
  page,
}) => {
  await openApplications(page);
  await seedApplications(page);
  await openInterviews(page, 'Senior Backend Engineer');

  await page.goto(`${page.url()}/gone`);

  await expect(
    page.getByRole('heading', { name: 'This interview is not in the list' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to the interviews' }).click();
  await expect(
    page.getByRole('region', { name: 'Coming up · 2' }),
  ).toBeVisible();
});

/** The first interview of the designs, with text practice on for the account (D94). */
const openTechnicalInterview = async (page: Page) => {
  await openApplications(page);
  await page.evaluate(() => window.qdPreview?.setFlag('textPractice', true));
  await seedApplications(page);
  await openInterviews(page, 'Senior Backend Engineer');
  await page.getByRole('link', { name: 'Technical interview' }).click();
  return page.getByRole('region', {
    name: 'Likely questions for this interview',
  });
};

test('likely questions (D94): written on request, shown with why each is likely, out of date when the interview changes, written again', async ({
  page,
}) => {
  const questions = await openTechnicalInterview(page);
  await expect(
    page.getByRole('region', { name: 'Get ready for it' }),
  ).toBeHidden();
  await expect(questions).toContainText('10 of 10 lists left today');

  // Written on request, with "Writing your questions" meanwhile
  await questions
    .getByRole('button', { name: 'Write likely questions' })
    .click();
  await expect(questions.getByRole('status')).toContainText(
    'Writing your questions',
  );
  const items = questions.getByRole('listitem');
  await expect(items).toHaveCount(5);
  await expect(items.first()).toContainText('Behavioural');
  await expect(items.first()).toContainText(
    'Tell me about an incident you led from alert to fix.',
  );
  await expect(items.first()).toContainText('they care about on-call');
  await questions.getByRole('button', { name: 'Show all 8' }).click();
  await expect(items).toHaveCount(8);

  // Read back after a reload
  await page.reload();
  await expect(questions).toContainText(/^.*Written on \d{1,2} \w{3} \d{4}/);
  await expect(questions.getByRole('listitem')).toHaveCount(5);

  // What the candidate knows changes: the list stays, out of date
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the interview' });
  await edit
    .getByLabel('What you know about it (optional)')
    .fill('Now a panel of three, with the head of platform.');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await expect(questions).toContainText(
    'What you know about this interview changed since these were written.',
  );
  await expect(questions).toContainText('9 of 10 lists left today');
  await expect(questions.getByRole('listitem')).toHaveCount(5);

  await questions.getByRole('button', { name: 'Write again' }).click();
  await expect(questions).not.toContainText(
    'changed since these were written',
    {
      timeout: 10_000,
    },
  );
  await expect(questions.getByRole('listitem')).toHaveCount(5);
});

test('likely questions: a failed attempt changes nothing and can be tried again; none left today', async ({
  page,
}) => {
  const questions = await openTechnicalInterview(page);

  await page.evaluate(() =>
    window.qdPreviewProfile?.failNextQuestions('model'),
  );
  await questions
    .getByRole('button', { name: 'Write likely questions' })
    .click();
  await expect(questions.getByRole('alert')).toContainText(
    'We couldn’t write the questions this time.',
  );
  await questions.getByRole('button', { name: 'Try again' }).click();
  await expect(questions.getByRole('listitem')).toHaveCount(5);

  // None left today: the button can't be used
  await page.evaluate(() =>
    window.qdPreviewProfile?.setInterviewQuestionsToday(10),
  );
  await page.goto('/applications');
  await openInterviews(page, 'Senior Backend Engineer');
  await page.getByRole('link', { name: 'System design' }).click();
  const other = page.getByRole('region', {
    name: 'Likely questions for this interview',
  });
  await expect(other).toContainText('0 of 10 lists left today');
  await expect(
    other.getByRole('button', { name: 'Write likely questions' }),
  ).toBeDisabled();
});
