// What the tests against the emulators share. An account is created for each test through
// the emulators' own HTTP addresses, with what the backend would hold for a real user: a
// verified email, the account profile and, when asked, the feature flag. No test shares an
// account with another, and nothing here can reach a real project.
import { expect, type Page } from '@playwright/test';

/** The project the emulators of quadev-backend run with (its package.json). */
const PROJECT = 'demo-quadev';
// Ports from quadev-backend/firebase.json.
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8080';
const DOCUMENTS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`;
/** The emulators take this in place of an administrator's credentials. */
const OWNER = { Authorization: 'Bearer owner' };

/** Meets the password rules of the sign-in form; the emulator has no account worth guarding. */
const PASSWORD = 'Passw0rd!e2e';

export interface TestAccount {
  uid: string;
  email: string;
  password: string;
  /** Where signing in leads: the applications with the interview tools (D85), else the home. */
  landing: '/applications' | '/home';
}

const send = async (
  method: 'POST' | 'PATCH',
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Record<string, unknown>> => {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `${method} ${new URL(url).pathname} answered ${response.status}. Are the emulators of quadev-backend running (yarn e2e:emulators)?`,
    );
  }
  return (await response.json()) as Record<string, unknown>;
};

/**
 * A new account, ready to sign in.
 * `interviewAssistant`, `cvTool`: the overrides of those flags in `featureFlags/{uid}`; left
 * out, the account has no override, which is what a new account has on the real backend. In
 * the emulators a flag comes only from that document (Remote Config is skipped there).
 */
export const createAccount = async ({
  interviewAssistant,
  cvTool,
}: {
  interviewAssistant?: boolean;
  cvTool?: boolean;
} = {}): Promise<TestAccount> => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const created = await send(
    'POST',
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    { email, password: PASSWORD, returnSecureToken: true },
  );
  const uid = String(created.localId);
  // The link in the verification email, opened.
  await send(
    'POST',
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`,
    { localId: uid, emailVerified: true },
    OWNER,
  );
  // The account profile the sign-up form writes (users/{uid}).
  await send(
    'PATCH',
    `${DOCUMENTS}/users/${uid}`,
    {
      fields: {
        firstName: { stringValue: 'Maya' },
        lastName: { stringValue: 'Okafor' },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    },
    OWNER,
  );
  const flags = Object.fromEntries(
    Object.entries({ interviewAssistant, cvTool })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, { booleanValue: value }]),
  );
  if (Object.keys(flags).length > 0) {
    await send(
      'PATCH',
      `${DOCUMENTS}/featureFlags/${uid}`,
      { fields: flags },
      OWNER,
    );
  }
  return {
    uid,
    email,
    password: PASSWORD,
    landing: interviewAssistant ? '/applications' : '/home',
  };
};

/** A user's override of one service's daily calls, as quadev-backend's set-limit writes it. */
export const setUsageLimit = async (
  uid: string,
  service: string,
  maxCallsPerDay: number,
) => {
  await send(
    'PATCH',
    `${DOCUMENTS}/usageLimits/${uid}`,
    {
      fields: {
        services: {
          mapValue: {
            fields: {
              [service]: {
                mapValue: {
                  fields: {
                    maxCallsPerDay: { integerValue: String(maxCallsPerDay) },
                  },
                },
              },
            },
          },
        },
      },
    },
    OWNER,
  );
};

/** How many calls of one service the user made today (UTC), as the backend's meter counts them. */
export const setUsageToday = async (
  uid: string,
  service: string,
  calls: number,
) => {
  const day = new Date().toISOString().slice(0, 10);
  await send(
    'PATCH',
    `${DOCUMENTS}/usage/${uid}/days/${day}`,
    {
      fields: {
        services: {
          mapValue: {
            fields: {
              [service]: {
                mapValue: {
                  fields: { calls: { integerValue: String(calls) } },
                },
              },
            },
          },
        },
      },
    },
    OWNER,
  );
};

/** Signs in with the form, as a user does, and waits for where the account lands. */
export const signIn = async (
  page: Page,
  { email, password, landing }: TestAccount,
) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(landing);
};

/** Opens the profile from the main navigation. */
export const openProfile = async (page: Page) => {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Profile' })
    .click();
  await expect(page).toHaveURL('/profile');
};
