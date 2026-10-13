// Cloud Storage: where the files of the interview profile are uploaded (quadev-backend
// storage.rules). A file of its own, like functions.ts, so the Storage part of the SDK is
// only in the bundle of a page that uploads or downloads a file.
import {
  connectStorageEmulator,
  type FirebaseStorage,
  getStorage,
} from 'firebase/storage';

import { app, EMULATOR_HOST } from './app';

import { env } from '@/core/env';

// Port from quadev-backend/firebase.json.
const STORAGE_EMULATOR_PORT = 9199;

let emulatorConnected = false;

/** The Storage service of the app: the project's default bucket (VITE_FIREBASE_STORAGE_BUCKET). */
export const storage = (): FirebaseStorage => {
  const service = getStorage(app());
  if (env.USE_FIREBASE_EMULATORS && !emulatorConnected) {
    emulatorConnected = true;
    connectStorageEmulator(service, EMULATOR_HOST, STORAGE_EMULATOR_PORT);
  }
  return service;
};

/** Test helper: lets a test start again after changing the environment. */
export const resetStorageForTests = () => {
  emulatorConnected = false;
};
