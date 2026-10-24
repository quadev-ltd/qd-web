// Job applications (delivery 2a), with the in-memory profile gateway: the screens working
// together in a browser. The same use case against the backend's code is in e2e-emulators/.
import { expect, test } from '@playwright/test';

import { openApplications, seedApplications, signIn } from './support';

// The in-memory reading takes the title and the company from the first two lines.
const JOB =
  'Senior Backend Engineer\nNorthwind Logistics\nNorthwind Logistics moves two million parcels a day across Europe. We are looking for a Senior Backend Engineer to own the services behind parcel tracking.';

test('an application: added from the profile’s "Prepare for a job", its page, edited, removed', async ({
  page,
}) => {
  await signIn(page);
  await expect(page).toHaveURL('/profile');

  // "Prepare for a job" opens Applications with "New application" open (D91)
  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  await expect(page).toHaveURL('/applications');
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(
    panel.getByText('Paste the job description', { exact: true }),
  ).toBeVisible();
  await panel.getByLabel('Job description').fill(JOB);
  await expect(panel.getByText(`${JOB.length} / 20,000`)).toBeVisible();
  await panel.getByRole('button', { name: 'Add the job' }).click();

  // Its page opens on the job being read, then names it and offers the brief
  await expect(page).toHaveURL(/\/applications\/.+/);
  await expect(page.getByRole('status')).toContainText('Reading the job');
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
  await edit.getByLabel('Company (optional)').fill('Northwind Logistics Ltd');
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
  await expect(details).toContainText('Northwind Logistics Ltd');
  await expect(details).toContainText('Two technical rounds.');
  await expect(
    details.getByRole('link', {
      name: 'northwind-logistics.example/careers/1482',
    }),
  ).toHaveAttribute('target', '_blank');

  // Still there after a reload, and listed in Applications: the back link says so (D85)
  await page.reload();
  await expect(details).toContainText('Northwind Logistics Ltd');
  await expect(
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Applications' }),
  ).toHaveAttribute('aria-current', 'page');
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Applications', exact: true })
    .click();
  await expect(page).toHaveURL('/applications');
  const card = page
    .getByRole('listitem')
    .filter({ hasText: 'Senior Backend Engineer' });
  await expect(card).toContainText('No brief yet');
  await card.getByRole('link').click();
  await page.getByRole('link', { name: 'Details' }).click();

  // Removed after asking: back in Applications, which has none again
  await page.getByRole('button', { name: 'Remove this application' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Remove this application?',
  });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Remove this application' }).click();
  await dialog.getByRole('button', { name: 'Remove the application' }).click();
  await expect(page).toHaveURL('/applications');
  await expect(
    page.getByText(
      'Paste a job you are applying for, or its link, and get a brief: what it asks for, what your profile shows and what is missing.',
    ),
  ).toBeVisible();
});

test('Applications lists them one per row, with where their brief is', async ({
  page,
}, testInfo) => {
  await openApplications(page);
  await seedApplications(page);

  const cards = page.getByRole('main').getByRole('listitem');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('Senior Backend Engineer');
  await expect(cards.nth(0)).toContainText('Brief ready');
  await expect(cards.nth(0)).toContainText('2 gaps');
  await expect(cards.nth(1)).toContainText('Brief out of date');
  await expect(cards.nth(2)).toContainText('No brief yet');
  // Nothing beside the list: the profile is in the bar (D91)
  await expect(page.getByRole('region', { name: 'Your profile' })).toHaveCount(
    0,
  );

  // One column at the profile's width; the chips beside the names on a wide screen, under
  // them on a phone
  const boxes = await Promise.all(
    [0, 1, 2].map(index => cards.nth(index).boundingBox()),
  );
  expect(new Set(boxes.map(box => Math.round(box?.x ?? -1))).size).toBe(1);
  for (const box of boxes) {
    expect(box?.width).toBeLessThanOrEqual(760);
  }
  const title = await cards
    .nth(0)
    .getByRole('heading', { name: 'Senior Backend Engineer' })
    .boundingBox();
  const chip = await cards.nth(0).getByText('Brief ready').boundingBox();
  if (testInfo.project.name === 'phone') {
    expect(chip!.y).toBeGreaterThan(title!.y + title!.height);
  } else {
    expect(chip!.x).toBeGreaterThan(title!.x + title!.width);
  }

  // A card opens its application
  await cards.nth(1).getByRole('link').click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Engineering Manager' }),
  ).toBeVisible();
});

test('the brief: prepared, opened on a gap and a question, out of date when the job changes, refreshed', async ({
  page,
}) => {
  await openApplications(page);
  await page.evaluate(() => window.qdPreviewProfile?.seed());
  await page.reload();

  // A new application opens on its brief, not prepared yet
  await page.getByRole('button', { name: 'New application' }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
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

test('a posting that cannot be read: "Paste the text instead", named in the same form, then the brief', async ({
  page,
}) => {
  await openApplications(page);
  await page.getByRole('button', { name: 'New application' }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByText('Link', { exact: true }).click();
  await panel
    .getByLabel('Address of the posting')
    .fill('https://jobs.invalid/senior-backend-engineer');
  await panel.getByRole('button', { name: 'Add the job' }).click();

  // Named "New application", with the posting's site, until it is read
  await expect(
    page.getByRole('heading', { level: 1, name: 'New application' }),
  ).toBeVisible();
  await expect(page.getByText('jobs.invalid', { exact: true })).toBeVisible();
  const status = page.getByRole('status');
  await expect(status).toContainText('We couldn’t read this page');
  await expect(
    status.getByRole('link', { name: 'Open the posting' }),
  ).toHaveAttribute('href', 'https://jobs.invalid/senior-backend-engineer');

  await status.getByRole('button', { name: 'Paste the text instead' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await edit.getByLabel('Title').fill('Senior Backend Engineer');
  await edit
    .getByLabel('Job description')
    .fill('You will run Go services in production.');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Senior Backend Engineer' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Prepare the brief' }),
  ).toBeVisible();
});

test('a posting read again: the same posting, a changed one that dates the brief, and an edited text replaced only once asked', async ({
  page,
}) => {
  await openApplications(page);
  await page.getByRole('button', { name: 'New application' }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByText('Link', { exact: true }).click();
  await panel
    .getByLabel('Address of the posting')
    .fill('https://careers.northwind.example/senior-backend-engineer');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await page.getByRole('button', { name: 'Prepare the brief' }).click();
  await expect(
    page.getByRole('region', { name: 'What the job asks for' }),
  ).toBeVisible();

  // The same posting: only the copy's date moves
  await page.getByRole('link', { name: 'Details' }).click();
  const job = page.getByRole('region', { name: 'The job' });
  const readAgain = job.getByRole('button', {
    name: 'Read the posting again',
  });
  await expect(job).toContainText(
    'If the posting has changed. The new copy replaces this one, and your brief will show as out of date.',
  );
  await readAgain.click();
  await expect(job).toContainText(
    'The posting hasn’t changed, so your copy stays as it is.',
  );

  // A changed posting: a new copy, and the brief is out of date
  await page.evaluate(() => window.qdPreviewProfile?.nextReread('changed'));
  await readAgain.click();
  await expect(job).toContainText(
    'The posting had changed, so this copy is new. Your brief shows as out of date.',
  );
  await page.getByRole('link', { name: 'Brief' }).click();
  await expect(
    page.getByText('The job details changed since this brief was prepared.'),
  ).toBeVisible();

  // An edited text is replaced only once the candidate says so
  await page.getByRole('link', { name: 'Details' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await expect(
    edit.getByText(
      'Your copy of the posting. Reading the posting again replaces it.',
    ),
  ).toBeVisible();
  await edit.getByLabel('Job description').fill('My own notes on the job.');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await expect(job).toContainText('You changed this text.');
  await readAgain.click();
  const replace = page.getByRole('dialog', {
    name: 'Replace your edited text?',
  });
  await replace.getByRole('button', { name: 'Cancel' }).click();
  await expect(job).toContainText('My own notes on the job.');
  await readAgain.click();
  await replace.getByRole('button', { name: 'Replace my text' }).click();
  await expect(replace).toBeHidden();
  await expect(job).not.toContainText('My own notes on the job.');
  await expect(job).not.toContainText('You changed this text.');
});

test('a posting that could not be read is tried again, and read', async ({
  page,
}) => {
  await openApplications(page);
  await page.evaluate(() =>
    window.qdPreviewProfile?.failNextJob('link-unreadable'),
  );
  await page.getByRole('button', { name: 'New application' }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByText('Link', { exact: true }).click();
  await panel
    .getByLabel('Address of the posting')
    .fill('https://careers.northwind.example/platform-engineer');
  await panel.getByRole('button', { name: 'Add the job' }).click();

  const status = page.getByRole('status');
  await expect(status).toContainText('We couldn’t read this page');
  await status.getByRole('button', { name: 'Try again' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Platform engineer' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Prepare the brief' }),
  ).toBeVisible();
});

test('a job as a file: uploaded, read, named from the file, its source on Details', async ({
  page,
}) => {
  await openApplications(page);
  await page.getByRole('button', { name: 'New application' }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel.getByText('File', { exact: true }).click();
  await panel.locator('input[type=file]').setInputFiles({
    name: 'platform-engineer.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 Platform Engineer at Halvorsen.'),
  });
  await expect(panel.getByText('platform-engineer.pdf')).toBeVisible();
  await panel.getByRole('button', { name: 'Add the job' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'platform engineer' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Details' }).click();
  await expect(page.getByRole('region', { name: 'The job' })).toContainText(
    /Read from platform-engineer\.pdf on/,
  );
});
