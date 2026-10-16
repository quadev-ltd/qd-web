import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

/** The sample account of the preview auth gateway (src/core/auth/previewGateway.ts). */
export const SAMPLE_USER = {
  email: 'preview@example.com',
  password: 'Preview123!',
  firstName: 'Ada',
  lastName: 'Lovelace',
};

/** Same password as the app's Maestro flows. */
export const PASSWORD = 'Passw0rd!e2e';

/** A new address for each run of a test, so a test never meets its own leftovers. */
export const newEmail = () =>
  `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

export const signIn = async (
  page: Page,
  email = SAMPLE_USER.email,
  password = SAMPLE_USER.password,
) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
};

/** Fills and sends the sign-up form. The new account lands on the verify-email screen. */
export const signUp = async (
  page: Page,
  { firstName = 'Grace', lastName = 'Hopper', email = newEmail() } = {},
) => {
  await page.goto('/sign-up');
  await page.getByLabel('First name').fill(firstName);
  await page.getByLabel('Last name').fill(lastName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page).toHaveURL('/verify-email');
  return email;
};

// What happens outside the site. The preview gateway has no email and no backend, so it
// offers these on `window.qdPreview` (src/core/auth/previewGateway.ts).

/** The user opens the link in the verification email (in another tab, or on the phone). */
export const openVerificationLink = (page: Page) =>
  page.evaluate(() => window.qdPreview?.verifyEmail());

/** The account has no profile document (the write at sign-up failed). */
export const loseProfile = (page: Page) =>
  page.evaluate(() => window.qdPreview?.removeProfile());

// The interview profile. The preview profile gateway offers what a test cannot wait for or
// cause on `window.qdPreviewProfile` (src/core/profile/previewProfileGateway.ts).

/** Signs in as the sample account (it has the interview tools on) and opens its profile. */
export const openProfile = async (page: Page) => {
  await signIn(page);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Profile' })
    .click();
  await expect(page).toHaveURL('/profile');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Profile' }),
  ).toBeVisible();
};

/** The profile of the designs: six resources, one in each state. The page reads it again. */
export const seedProfile = async (page: Page) => {
  await page.evaluate(() => window.qdPreviewProfile?.seed());
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Resources · 6 of 20' }),
  ).toBeVisible();
};

/** A small fictional CV, as the file a visitor would choose. */
export const CV_FILE = {
  name: 'maya-okafor-cv.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(
    '%PDF-1.7\nMaya Okafor. Senior Backend Engineer at Fenwick Pay, 2021 to 2026.',
  ),
};

/** No serious or critical accessibility violation on the page as it is now. */
export const expectNoSeriousAccessibilityViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      nodes: nodes.map(node => node.target.join(' ')),
    }));
  expect(blocking).toEqual([]);
};

/** The page is never wider than the screen. */
export const expectNoHorizontalScroll = async (page: Page) => {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
};

/** An element (a menu, a dialog) is completely inside the screen, not cut off at an edge. */
export const expectInsideViewport = async (page: Page, locator: Locator) => {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
};

// Job applications (delivery 2a), with the same preview gateway.

/** Signs in as the sample account and waits for its home, which lists applications. */
export const openHome = async (page: Page) => {
  await signIn(page);
  await expect(page).toHaveURL('/home');
  await expect(
    page.getByRole('heading', { name: 'What do you want to do?' }),
  ).toBeVisible();
};

/**
 * The profile and the three applications of the designs: a brief with two gaps, one the job
 * changed since, none yet. The home reads them again.
 */
export const seedApplications = async (page: Page) => {
  // The controls come with the home's gateway, which is loaded on demand.
  await page.waitForFunction(() => Boolean(window.qdPreviewProfile));
  await page.evaluate(() => {
    window.qdPreviewProfile?.seed();
    window.qdPreviewProfile?.seedApplications();
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your applications' }),
  ).toBeVisible();
};
