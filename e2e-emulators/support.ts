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
  /** Where signing in leads: the profile with the interview tools (D91), else the home. */
  landing: '/profile' | '/home';
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
 * `interviewAssistant`, `cvTool`, `textPractice`, `coverLetters`, `mockInterview`: the overrides of those flags in `featureFlags/{uid}`; left
 * out, the account has no override, which is what a new account has on the real backend. In
 * the emulators a flag comes only from that document (Remote Config is skipped there).
 */
export const createAccount = async ({
  interviewAssistant,
  cvTool,
  textPractice,
  coverLetters,
  mockInterview,
}: {
  interviewAssistant?: boolean;
  cvTool?: boolean;
  textPractice?: boolean;
  coverLetters?: boolean;
  mockInterview?: boolean;
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
    Object.entries({
      interviewAssistant,
      cvTool,
      textPractice,
      coverLetters,
      mockInterview,
    })
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
    landing: interviewAssistant ? '/profile' : '/home',
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

/**
 * Moves one time of a mock interview back, as quadev-backend's own tests do to try its clock:
 * `startedAt` 9 minutes back leaves a 10-minute interview less than 90 seconds, so the next
 * answer gets the closing.
 */
export const moveMockSessionBack = async (
  uid: string,
  sessionId: string,
  field: 'startedAt' | 'updatedAt',
  minutes: number,
) => {
  await send(
    'PATCH',
    `${DOCUMENTS}/users/${uid}/mockSessions/${sessionId}?updateMask.fieldPaths=${field}`,
    {
      fields: {
        [field]: {
          timestampValue: new Date(Date.now() - minutes * 60_000).toISOString(),
        },
      },
    },
    OWNER,
  );
};

/**
 * Marks one answer's feedback (D101) as failed after its two tries, as the trigger leaves it when
 * the model fails, so the page offers "Try again".
 */
export const failMockAnswerFeedback = async (
  uid: string,
  sessionId: string,
  turnId: string,
) => {
  await send(
    'PATCH',
    `${DOCUMENTS}/users/${uid}/mockSessions/${sessionId}?updateMask.fieldPaths=answerFeedback.${turnId}`,
    {
      fields: {
        answerFeedback: {
          mapValue: {
            fields: {
              [turnId]: {
                mapValue: {
                  fields: {
                    status: { stringValue: 'failed' },
                    tries: { integerValue: '2' },
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

/**
 * A microphone for the browser: a tone played into a real audio stream, which the page records
 * as it would a microphone (Chromium's fake devices wait on the Mac's own permission).
 * `window.qdMicrophone.gain` silences it, so a short answer is "nothing heard".
 */
export const microphone = (page: Page) =>
  page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const tone = context.createOscillator();
      const gain = context.createGain();
      const known = window as unknown as {
        qdMicrophone: GainNode;
        qdMicrophoneVolume?: number;
      };
      gain.gain.value = known.qdMicrophoneVolume ?? 1;
      const destination = context.createMediaStreamDestination();
      tone.connect(gain).connect(destination);
      tone.start();
      known.qdMicrophone = gain;
      return destination.stream;
    };
  });

export const setMicrophone = (page: Page, volume: number) =>
  page.evaluate(level => {
    (window as unknown as { qdMicrophone: GainNode }).qdMicrophone.gain.value =
      level;
  }, volume);
