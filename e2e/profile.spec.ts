// The interview profile, with the in-memory profile gateway: the screens working together
// in a browser. The same use case against the real backend code is in e2e-emulators/.
import { expect, test } from '@playwright/test';

import { CV_FILE, openProfile, seedProfile } from './support';

test('add a CV as a file: it is uploaded, read, and its items reach the skill map', async ({
  page,
}) => {
  await openProfile(page);
  await expect(
    page.getByRole('heading', { name: 'Start with your CV' }),
  ).toBeVisible();

  // Add your CV → Upload a file
  await page.getByRole('button', { name: 'Add your CV' }).click();
  const panel = page.getByRole('dialog', { name: 'Add your CV' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: /Add a link/ })).toHaveCount(
    0,
  );
  await panel.getByRole('button', { name: /Upload a file/ }).click();

  const form = page.getByRole('dialog', { name: 'Upload your CV' });
  await form.locator('input[type=file]').setInputFiles(CV_FILE);
  await expect(form.getByText('maya-okafor-cv.pdf')).toBeVisible();
  await expect(form.getByLabel('Title')).toHaveValue('maya-okafor-cv');
  await expect(
    form.getByText('Taken from the file name. Change it if you like.'),
  ).toBeVisible();
  await form.getByLabel('Title').fill('Maya Okafor CV 2026');
  await form.getByRole('button', { name: 'Add to profile' }).click();

  // The upload is shown as it goes; then the panel closes by itself.
  await expect(form.getByRole('progressbar', { name: 'Upload' })).toBeVisible();
  await expect(form).toBeHidden();

  // The list: being read, then ready, without reloading.
  const row = page
    .getByRole('listitem')
    .filter({ hasText: 'Maya Okafor CV 2026' });
  await expect(row).toContainText('CV');
  await expect(row).toContainText('Being read…');
  await expect(row).toContainText('Ready · 6 items');
  await expect(
    page.getByRole('heading', { name: 'Resources · 1 of 20' }),
  ).toBeVisible();

  // The skill map has what was read.
  const skillMap = page
    .getByRole('heading', { name: 'Skill map' })
    .locator('xpath=ancestor::section');
  await expect(skillMap).toContainText('6 items');
  await expect(skillMap.getByText('Achievements').locator('..')).toContainText(
    '2',
  );

  // Still there after a reload.
  await page.reload();
  await expect(row).toContainText('Ready · 6 items');

  // Its own page lists what it added.
  await row.getByRole('link').click();
  await expect(page).toHaveURL(/\/profile\/resources\/.+/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Maya Okafor CV 2026' }),
  ).toBeVisible();
  await expect(page.getByText('Ready · 6 items')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Items from this resource · 6' }),
  ).toBeVisible();
  await expect(page.getByText(/Go and PostgreSQL in production/)).toBeVisible();
  await page.getByRole('button', { name: 'Show all 6' }).click();
  await expect(page.getByText(/From: Maya Okafor CV 2026/)).toHaveCount(6);

  // And the way back.
  await page.getByRole('link', { name: 'Profile', exact: true }).last().click();
  await expect(page).toHaveURL('/profile');
});

test('paste a text that is too long: the message, then shorten it and add it', async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page
    .getByRole('dialog', { name: 'Add to your profile' })
    .getByRole('button', { name: /Paste or type text/ })
    .click();

  const form = page.getByRole('dialog', { name: 'Paste or type text' });
  const text = form.getByRole('textbox', { name: 'Text', exact: true });
  const add = form.getByRole('button', { name: 'Add to profile' });
  await form.getByLabel('Title').fill('Stories for interviews');
  await expect(form.getByRole('radio', { name: 'Note' })).toBeChecked();

  await text.fill('a'.repeat(50_001));
  await expect(
    form.getByText(
      'This is longer than 50,000 characters. Shorten it or split it into two resources.',
    ),
  ).toBeVisible();
  await expect(form.getByText('50,001 / 50,000')).toBeVisible();
  await expect(add).toBeDisabled();

  await text.fill(
    'Two weeks before the wallet launch our load test failed. I asked for a two-week slip and we shipped without an incident.',
  );
  await expect(form.getByText(/longer than 50,000/)).toBeHidden();
  await expect(add).toBeEnabled();
  await add.click();

  await expect(form).toBeHidden();
  const row = page
    .getByRole('listitem')
    .filter({ hasText: 'Stories for interviews' });
  await expect(row).toContainText('Note');
  await expect(row).toContainText('Ready · 2 items');
});

test('a link that cannot be read fails, and the list says why', async ({
  page,
}) => {
  await openProfile(page);
  await page.getByRole('button', { name: 'Add something else' }).click();
  await page.getByRole('button', { name: /Add a link/ }).click();

  const form = page.getByRole('dialog', { name: 'Add a link' });
  const address = form.getByLabel('Address');
  await form.getByLabel('Title').fill('Team wiki page');
  await address.fill('http://wiki.fenwickpay.internal/maya');
  await expect(
    form.getByText(
      'Enter the https address of a public page. Pages on a private network can’t be read.',
    ),
  ).toBeVisible();
  await expect(
    form.getByRole('button', { name: 'Add to profile' }),
  ).toBeDisabled();

  // An address that is accepted, on a host the fake backend cannot read.
  await address.fill('https://portfolio.invalid/maya');
  await form.getByRole('button', { name: 'Add to profile' }).click();

  await expect(form).toBeHidden();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Team wiki page' }),
  ).toContainText('Could not read this page');
});

test('open a failed resource, read why, and remove it in the dialog: it is gone from the list', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);

  await page
    .getByRole('link', { name: /Conference talk: Ledgers without tears/ })
    .click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Conference talk: Ledgers without tears',
    }),
  ).toBeVisible();
  await expect(page.getByText('Failed', { exact: true })).toBeVisible();
  const address = page.url();
  const reason = page.getByRole('status');
  await expect(reason).toContainText('We couldn’t read this page');
  await expect(reason).toContainText(
    'It may be private or need a sign-in. For LinkedIn, save your profile as a PDF and add the file.',
  );

  // Asked first; Cancel changes nothing.
  await reason.getByRole('button', { name: 'Remove' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this resource?' });
  await expect(dialog).toContainText('It has no items in your skill map.');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(reason).toBeVisible();

  // Removed: back on the profile, without it.
  await page.getByRole('button', { name: 'Remove this resource' }).click();
  await dialog.getByRole('button', { name: 'Remove the resource' }).click();
  await expect(page).toHaveURL('/profile');
  await expect(
    page.getByRole('heading', { name: 'Resources · 5 of 20' }),
  ).toBeVisible();
  await expect(
    page.getByText('Conference talk: Ledgers without tears'),
  ).toHaveCount(0);

  // "Back" does not return to the page of what was removed, and its address leads nowhere.
  await page.goBack();
  await expect(page).not.toHaveURL(address);
  await page.goto(address);
  await expect(
    page.getByRole('heading', { name: 'This resource is not in your profile' }),
  ).toBeVisible();
});

test('removing a resource takes its items out of the skill map', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  const skillMap = page
    .getByRole('heading', { name: 'Skill map' })
    .locator('xpath=ancestor::section');
  await expect(skillMap).toContainText('9 items');

  await page.getByRole('link', { name: /Performance review 2025/ }).click();
  await page.getByRole('button', { name: 'Remove this resource' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this resource?' });
  await expect(dialog).toContainText(
    'This also removes the 3 items that came from it. Briefs that used them will show as out of date.',
  );
  await dialog
    .getByRole('button', { name: 'Remove the resource and 3 items' })
    .click();

  await expect(page).toHaveURL('/profile');
  await expect(skillMap).toContainText('6 items');
});

test('the skill map: filter, open an item, edit it, star it, hide it', async ({
  page,
}, testInfo) => {
  const narrow = testInfo.project.name === 'phone';
  await openProfile(page);
  await seedProfile(page);
  await page.getByRole('link', { name: 'Open the skill map' }).click();
  await expect(page).toHaveURL('/profile/skill-map');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Skill map' }),
  ).toBeVisible();
  await expect(page.getByText('9 items from 6 resources')).toBeVisible();
  const kinds = page.getByRole('group', { name: 'Kind' });
  const rows = page.getByRole('listitem');

  // Filter by kind, then search inside it
  await kinds.getByRole('button', { name: /Achievements/ }).click();
  await expect(page.getByText('3 items', { exact: true })).toBeVisible();
  await expect(rows).toHaveCount(3);
  await page
    .getByRole('searchbox', { name: 'Search your skill map' })
    .fill('on-call');
  await expect(rows).toHaveCount(1);
  await page.getByRole('searchbox').fill('kubernetes');
  await expect(
    page.getByRole('heading', { name: 'No items match' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Nothing in your skill map matches “kubernetes” with these filters.',
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear the search and filters' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Skills', exact: true }),
  ).toBeVisible();

  // Open an item: beside the list on a wide screen, in its place on a narrow one
  await page
    .getByRole('link', { name: /Go and PostgreSQL in production/ })
    .click();
  await expect(page).toHaveURL(/\/profile\/skill-map\/.+/);
  const item = page.getByRole('complementary', { name: 'Selected item' });
  await expect(item).toContainText(
    'Go and PostgreSQL in production for six years.',
  );
  await expect(
    item.getByText('Go, PostgreSQL (six years in production).'),
  ).toBeVisible();
  if (narrow) {
    await expect(page.getByRole('searchbox')).toBeHidden();
    await expect(
      page.getByRole('link', { name: 'Skill map', exact: true }),
    ).toBeVisible();
  } else {
    await expect(page.getByRole('searchbox')).toBeVisible();
  }

  // Edit it
  await item.getByRole('button', { name: 'Edit', exact: true }).click();
  const text = item.getByLabel('Text');
  await text.fill('a'.repeat(601));
  await expect(
    item.getByText('Shorten the text to 600 characters'),
  ).toBeVisible();
  await expect(item.getByRole('button', { name: 'Save' })).toBeDisabled();
  await text.fill('Go and PostgreSQL in production for seven years.');
  await item.getByRole('button', { name: 'Save' }).click();
  await expect(
    item.getByRole('button', { name: 'Edit', exact: true }),
  ).toBeVisible();
  await expect(item).toContainText(
    'Go and PostgreSQL in production for seven years.',
  );
  await expect(item.getByText('Edited', { exact: true })).toBeVisible();

  // Star it
  const star = item.getByRole('switch', { name: 'Use this first' });
  await star.click();
  await expect(star).toHaveAttribute('aria-checked', 'true');

  // Hide it: out of the map, and found again under "Hidden"
  const hide = item.getByRole('switch', { name: 'Never use this' });
  await hide.click();
  await expect(hide).toHaveAttribute('aria-checked', 'true');
  if (narrow) {
    await page.getByRole('link', { name: 'Skill map', exact: true }).click();
  }
  await expect(
    page.getByRole('listitem').filter({ hasText: 'seven years' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Hidden' }).click();
  await expect(
    page.getByText('1 hidden item · never used in briefs, key points or CVs'),
  ).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'seven years' }),
  ).toContainText('Edited');

  // The changes are kept: still there after a reload
  await page.reload();
  await page.getByRole('button', { name: 'Hidden' }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'seven years' }),
  ).toHaveCount(1);
});

test('remove an item from the skill map: asked first, then gone, and its resource counts one less', async ({
  page,
}) => {
  await openProfile(page);
  await seedProfile(page);
  await page.getByRole('link', { name: 'Open the skill map' }).click();
  await page
    .getByRole('link', { name: /Mentored two junior engineers/ })
    .click();
  const item = page.getByRole('complementary', { name: 'Selected item' });

  await item.getByRole('button', { name: 'Remove this item' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove this item?' });
  await expect(dialog).toContainText(
    'The resource it came from stays in your profile.',
  );
  await dialog.getByRole('button', { name: 'Remove the item' }).click();

  await expect(page).toHaveURL('/profile/skill-map');
  await expect(page.getByText('8 items from 6 resources')).toBeVisible();
  await expect(page.getByText(/Mentored two junior engineers/)).toHaveCount(0);

  await page.getByRole('link', { name: 'Profile', exact: true }).last().click();
  await expect(page).toHaveURL('/profile');
  await expect(
    page.getByRole('heading', { name: 'Resources · 6 of 20' }),
  ).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Performance review 2025' }),
  ).toContainText('Ready · 2 items');
});
