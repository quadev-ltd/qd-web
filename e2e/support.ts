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
