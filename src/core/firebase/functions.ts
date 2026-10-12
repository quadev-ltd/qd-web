// The backend's callable functions (quadev-backend). A file of its own, so that the
// Functions and App Check parts of the SDK are only in the bundle of a page that calls the
// backend: sign-in and the profile need neither (docs/adr/0006-app-check.md).
import {
  connectFunctionsEmulator,
  type Functions,
  getFunctions,
} from 'firebase/functions';

import { app, EMULATOR_HOST } from './app';
import { startAppCheck } from './appCheck';

import { env } from '@/core/env';

/** Where quadev-backend deploys every function. */
export const FUNCTIONS_REGION = 'europe-west1';
// Port from quadev-backend/firebase.json.
const FUNCTIONS_EMULATOR_PORT = 5001;

let emulatorConnected = false;

/**
 * The Functions service of the app, for `httpsCallable`. App Check is started first, so the
 * SDK attaches its token to every call made through the returned service.
 */
export const functions = (): Functions => {
  const firebaseApp = app();
  startAppCheck(firebaseApp);
  const service = getFunctions(firebaseApp, FUNCTIONS_REGION);
  if (env.USE_FIREBASE_EMULATORS && !emulatorConnected) {
    emulatorConnected = true;
    connectFunctionsEmulator(service, EMULATOR_HOST, FUNCTIONS_EMULATOR_PORT);
  }
  return service;
};

/** Test helper: lets a test start again after changing the environment. */
export const resetFunctionsForTests = () => {
  emulatorConnected = false;
};
