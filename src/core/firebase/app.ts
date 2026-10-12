// The web version of qd-mobile src/core/firebase/app.ts. The app reads its Firebase settings
// from native config files; the website gets them from the environment (src/core/env.ts).
import { type FirebaseApp, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
// Firestore Lite: plain reads and writes, about a third of the size of the full SDK
// (docs/adr/0004-firebase-gateway.md). It has no live listeners and no offline cache.
import {
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
} from 'firebase/firestore/lite';

import { env } from '@/core/env';
import logger from '@/core/logger';

// Ports from quadev-backend/firebase.json. The address is the one the emulators listen on
// (a browser may resolve "localhost" to IPv6 first, where nothing answers).
export const EMULATOR_HOST = '127.0.0.1';
const AUTH_EMULATOR_PORT = 9099;
const FIRESTORE_EMULATOR_PORT = 8080;

let firebaseApp: FirebaseApp | undefined;
let emulatorsConnected = false;

const createApp = (): FirebaseApp => {
  const {
    FIREBASE_API_KEY: apiKey,
    FIREBASE_AUTH_DOMAIN: authDomain,
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_APP_ID: appId,
  } = env;
  // src/core/env.ts already refuses the Firebase gateway without them; this narrows the types.
  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error('Firebase is not configured (VITE_FIREBASE_*).');
  }
  return initializeApp({ apiKey, authDomain, projectId, appId });
};

/** The one Firebase app of the page. For this folder only (functions.ts). */
export const app = (): FirebaseApp => {
  firebaseApp ??= createApp();
  return firebaseApp;
};

// Must run before the first Auth or Firestore call, so every getter goes through it.
const connectEmulatorsOnce = () => {
  if (emulatorsConnected || !env.USE_FIREBASE_EMULATORS) {
    return;
  }
  emulatorsConnected = true;
  // `disableWarnings`: no banner is added to the page (it would cover the footer in the
  // end-to-end tests); the message below says it instead.
  connectAuthEmulator(
    getAuth(app()),
    `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`,
    { disableWarnings: true },
  );
  connectFirestoreEmulator(
    getFirestore(app()),
    EMULATOR_HOST,
    FIRESTORE_EMULATOR_PORT,
  );
  logger().logMessage('Using the local Firebase emulators.');
};

export const auth = (): Auth => {
  connectEmulatorsOnce();
  return getAuth(app());
};

export const db = (): Firestore => {
  connectEmulatorsOnce();
  return getFirestore(app());
};

/** Test helper: lets a test start again after changing the environment. */
export const resetFirebaseForTests = () => {
  firebaseApp = undefined;
  emulatorsConnected = false;
};
