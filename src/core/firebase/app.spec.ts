import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore/lite';

import { auth, db, resetFirebaseForTests } from './app';

const testEnv = vi.hoisted(() => ({
  FIREBASE_API_KEY: 'key' as string | undefined,
  FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'demo',
  FIREBASE_APP_ID: '1:1:web:1',
  FIREBASE_STORAGE_BUCKET: undefined as string | undefined,
  USE_FIREBASE_EMULATORS: false,
}));
const logMessage = vi.hoisted(() => vi.fn());

vi.mock('@/core/env', () => ({ env: testEnv }));
vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage })),
}));
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ name: 'auth' })),
  connectAuthEmulator: vi.fn(),
}));
vi.mock('firebase/firestore/lite', () => ({
  getFirestore: vi.fn(() => ({ name: 'db' })),
  connectFirestoreEmulator: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetFirebaseForTests();
  testEnv.FIREBASE_API_KEY = 'key';
  testEnv.FIREBASE_STORAGE_BUCKET = undefined;
  testEnv.USE_FIREBASE_EMULATORS = false;
});

describe('firebase app', () => {
  it('starts one Firebase app with the settings of the environment', () => {
    auth();
    db();
    auth();

    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: 'key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      appId: '1:1:web:1',
    });
    expect(getAuth).toHaveBeenCalledWith({ name: 'app' });
    expect(getFirestore).toHaveBeenCalledWith({ name: 'app' });
  });

  it('names the storage bucket when the environment has one', () => {
    testEnv.FIREBASE_STORAGE_BUCKET = 'demo.firebasestorage.app';

    auth();

    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: 'key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      appId: '1:1:web:1',
      storageBucket: 'demo.firebasestorage.app',
    });
  });

  it('does nothing until it is first used', () => {
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('says what is wrong when a setting is missing', () => {
    testEnv.FIREBASE_API_KEY = undefined;

    expect(() => auth()).toThrow('Firebase is not configured');
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('talks to the real project by default', () => {
    auth();
    db();

    expect(connectAuthEmulator).not.toHaveBeenCalled();
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('connects Auth and Firestore to the emulators of quadev-backend, once, before the first call', () => {
    testEnv.USE_FIREBASE_EMULATORS = true;

    db();
    auth();
    db();

    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(connectAuthEmulator).toHaveBeenCalledWith(
      { name: 'auth' },
      'http://127.0.0.1:9099',
      { disableWarnings: true },
    );
    expect(connectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(connectFirestoreEmulator).toHaveBeenCalledWith(
      { name: 'db' },
      '127.0.0.1',
      8080,
    );
    expect(logMessage).toHaveBeenCalledWith(
      'Using the local Firebase emulators.',
    );
  });
});
