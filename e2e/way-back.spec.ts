// The application's menu (D95) and a way back that follows the way in (D96), canvas version 46:
// ⋯ beside the application's title on every tab; a CV opened from an application's CV tab kept
// under it, with the whole way there as a breadcrumb (one link back on a phone); the same CV
// opened from CVs, as before.
import { expect, type Page, test } from '@playwright/test';

import { openApplications, seedApplications } from './support';

const openApplication = async (page: Page, title: string) => {
  await page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('link')
    .first()
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible();
};

test('the application’s menu: on every tab, from the keyboard, editing and removing the application', async ({
  page,
}) => {
  await openApplications(page);
  await seedApplications(page);
  await openApplication(page, 'Engineering Manager');

  const more = page.getByRole('button', { name: 'More for this application' });
  for (const tab of ['Interviews', 'Details', 'Brief']) {
    const link = page
      .getByRole('navigation', { name: 'Application' })
      .getByRole('link', { name: tab });
    await link.click();
    // Each tab is its own page: wait for it, not the one before.
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(more).toBeVisible();
  }

  // The keyboard: Enter opens it on the first item, the arrows move, Escape closes it
  await more.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'Application' });
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(
    menu.getByRole('menuitem', { name: 'Edit the application' }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    menu.getByRole('menuitem', { name: 'Remove this application' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();

  // Edit, from the Brief tab
  await more.click();
  await menu.getByRole('menuitem', { name: 'Edit the application' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the application' });
  await edit.getByLabel('Company (optional)').fill('Harbour Health Group');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByRole('main')).toContainText('Harbour Health Group');

  // Remove, asked first: back to Applications without it
  await more.click();
  await menu.getByRole('menuitem', { name: 'Remove this application' }).click();
  await page
    .getByRole('dialog', { name: 'Remove this application?' })
    .getByRole('button', { name: 'Remove the application' })
    .click();
  await expect(page).toHaveURL('/applications');
  await expect(
    page.getByRole('main').getByRole('listitem').filter({
      hasText: 'Engineering Manager',
    }),
  ).toHaveCount(0);
});

test('a CV from an application’s CV tab stays under it, with the way back there; from CVs, the CV section', async ({
  page,
}, { project }) => {
  await openApplications(page);
  await seedApplications(page);
  await openApplication(page, 'Platform Engineer');
  const application = page.url();
  await page
    .getByRole('navigation', { name: 'Application' })
    .getByRole('link', { name: 'CV' })
    .click();

  // Written from the tab: the new version opens under the application
  await page.getByRole('button', { name: /New version/ }).click();
  await page
    .getByRole('dialog', { name: 'New CV version' })
    .getByRole('button', { name: 'Write my CV' })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`^${application}/cv/versions/[^/]+$`),
  );
  await expect(page.getByRole('article', { name: 'Your CV' })).toBeVisible();
  const version = page.url();
  await expect(
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Applications' }),
  ).toHaveAttribute('aria-current', 'page');

  if (project.name === 'phone') {
    // One link back, to the page before
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toBeHidden();
    await page.getByRole('link', { name: 'Platform Engineer · CV' }).click();
  } else {
    const way = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(way.getByRole('link')).toHaveText([
      'Applications',
      'Platform Engineer',
      'CV',
    ]);
    await way.getByRole('link', { name: 'CV' }).click();
  }
  await expect(page).toHaveURL(`${application}/cv`);

  // Reloaded, the address keeps its place
  await page.goto(version);
  await expect(page.getByRole('article', { name: 'Your CV' })).toBeVisible();

  // Opened from CVs, the same version is in the CV section, with "‹ CVs"
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'CVs', exact: true })
    .click();
  await page
    .getByRole('region', { name: 'For a job' })
    .getByRole('link', { name: /Version of/ })
    .first()
    .click();
  await expect(page).toHaveURL(/^[^?]*\/cv\/versions\/[^/]+$/);
  expect(page.url()).not.toContain('/applications/');
  await expect(
    page.getByRole('navigation', { name: 'Breadcrumb' }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'CVs', exact: true }).nth(1).click();
  await expect(page).toHaveURL('/cv');

  // Removed from under the application: back to its CV tab
  await page.goto(version);
  await page.getByRole('button', { name: 'Remove this version' }).click();
  await page
    .getByRole('dialog', { name: /Remove/ })
    .getByRole('button', { name: /Remove/ })
    .click();
  await expect(page).toHaveURL(`${application}/cv`);
});
