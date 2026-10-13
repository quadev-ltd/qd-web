import { connectStorageEmulator, getStorage } from 'firebase/storage';

import { resetFirebaseForTests } from './app';
import { resetStorageForTests, storage } from './storage';

const testEnv = vi.hoisted(() => ({
  FIREBASE_API_KEY: 'key',
  FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'demo',
  FIREBASE_APP_ID: '1:1:web:1',
  FIREBASE_STORAGE_BUCKET: 'demo.firebasestorage.app',
  USE_FIREBASE_EMULATORS: false,
}));

vi.mock('@/core/env', () => ({ env: testEnv }));
vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));
vi.mock('firebase/firestore/lite', () => ({
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({ name: 'storage' })),
  connectStorageEmulator: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetFirebaseForTests();
  resetStorageForTests();
  testEnv.USE_FIREBASE_EMULATORS = false;
});

describe('firebase storage', () => {
  it('gives the Storage service of the app: its default bucket', () => {
    expect(storage()).toEqual({ name: 'storage' });
    expect(getStorage).toHaveBeenCalledWith({ name: 'app' });
  });

  it('talks to the real project by default', () => {
    storage();

    expect(connectStorageEmulator).not.toHaveBeenCalled();
  });

  it('connects to the Storage emulator of quadev-backend, once', () => {
    testEnv.USE_FIREBASE_EMULATORS = true;

    storage();
    storage();

    expect(connectStorageEmulator).toHaveBeenCalledTimes(1);
    expect(connectStorageEmulator).toHaveBeenCalledWith(
      { name: 'storage' },
      '127.0.0.1',
      9199,
    );
  });
});
