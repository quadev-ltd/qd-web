import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

import { resetFirebaseForTests } from './app';
import { startAppCheck } from './appCheck';
import {
  functions,
  FUNCTIONS_REGION,
  resetFunctionsForTests,
} from './functions';

const testEnv = vi.hoisted(() => ({
  FIREBASE_API_KEY: 'key',
  FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'demo',
  FIREBASE_APP_ID: '1:1:web:1',
  USE_FIREBASE_EMULATORS: false,
}));
const calls = vi.hoisted(() => [] as string[]);

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
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => {
    calls.push('getFunctions');
    return { name: 'functions' };
  }),
  connectFunctionsEmulator: vi.fn(),
}));
vi.mock('./appCheck', () => ({
  startAppCheck: vi.fn(() => {
    calls.push('startAppCheck');
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  resetFirebaseForTests();
  resetFunctionsForTests();
  testEnv.USE_FIREBASE_EMULATORS = false;
});

describe('firebase functions', () => {
  it('uses the region of the backend', () => {
    expect(FUNCTIONS_REGION).toBe('europe-west1');
    expect(functions()).toEqual({ name: 'functions' });
    expect(getFunctions).toHaveBeenCalledWith({ name: 'app' }, 'europe-west1');
  });

  it('starts App Check before the Functions service exists, so every call carries its token', () => {
    functions();

    expect(startAppCheck).toHaveBeenCalledWith({ name: 'app' });
    expect(calls).toEqual(['startAppCheck', 'getFunctions']);
  });

  it('talks to the real project by default', () => {
    functions();

    expect(connectFunctionsEmulator).not.toHaveBeenCalled();
  });

  it('connects to the Functions emulator of quadev-backend, once', () => {
    testEnv.USE_FIREBASE_EMULATORS = true;

    functions();
    functions();

    expect(connectFunctionsEmulator).toHaveBeenCalledTimes(1);
    expect(connectFunctionsEmulator).toHaveBeenCalledWith(
      { name: 'functions' },
      '127.0.0.1',
      5001,
    );
  });
});
