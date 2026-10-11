// Mirrors qd-mobile src/core/firebase/errors.spec.ts, plus the web's "not available yet" code.
import {
  ACCOUNT_UNAVAILABLE,
  AppAuthError,
  getErrorCode,
  getErrorMessageKey,
  logAuthError,
} from './errors';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const withCode = (code: string) =>
  Object.assign(new Error('native message with user@example.com'), { code });

describe('getErrorMessageKey', () => {
  it.each([
    ['auth/email-already-in-use', 'fieldError.emailAlreadyUsedError'],
    ['auth/invalid-credential', 'fieldError.invalidEmailOrPasswordError'],
    ['auth/wrong-password', 'fieldError.invalidEmailOrPasswordError'],
    ['auth/user-not-found', 'fieldError.invalidEmailOrPasswordError'],
    ['auth/invalid-email', 'fieldError.emailFormatError'],
    ['auth/too-many-requests', 'error.tooManyRequestsError'],
    ['auth/network-request-failed', 'error.networkError'],
    [
      'auth/password-does-not-meet-requirements',
      'fieldError.passwordNotComplexError',
    ],
    ['auth/weak-password', 'fieldError.passwordNotComplexError'],
    ['auth/requires-recent-login', 'error.requiresRecentLogin'],
    ['auth/user-disabled', 'error.userDisabled'],
    [
      'auth/account-exists-with-different-credential',
      'error.accountExistsWithDifferentCredential',
    ],
    ['auth/user-mismatch', 'error.reauthUserMismatch'],
    ['firestore/unavailable', 'error.networkError'],
    ['firestore/permission-denied', 'error.serverSideError'],
    ['functions/permission-denied', 'error.serverSideError'],
    ['permission-denied', 'error.serverSideError'],
    ['deadline-exceeded', 'error.networkError'],
    ['auth/internal-error', 'error.unexpectedErrorRetry'],
    [ACCOUNT_UNAVAILABLE, 'error.accountUnavailable'],
  ])('maps %s to %s', (code, key) => {
    expect(getErrorMessageKey(withCode(code))).toBe(key);
  });

  it('maps errors without a code to the generic message', () => {
    expect(getErrorMessageKey(new Error('boom'))).toBe(
      'error.unexpectedErrorRetry',
    );
    expect(getErrorMessageKey(undefined)).toBe('error.unexpectedErrorRetry');
  });
});

describe('getErrorCode', () => {
  it('reads string codes only', () => {
    expect(getErrorCode(withCode('auth/x'))).toBe('auth/x');
    expect(getErrorCode({ code: 42 })).toBeUndefined();
    expect(getErrorCode('auth/x')).toBeUndefined();
  });

  it('reads the code of an AppAuthError', () => {
    const error = new AppAuthError(ACCOUNT_UNAVAILABLE);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppAuthError');
    expect(getErrorCode(error)).toBe('app/account-unavailable');
  });
});

describe('logAuthError', () => {
  beforeEach(() => {
    mockLogger.logError.mockReset();
    mockLogger.logMessage.mockReset();
  });

  it('logs only the operation, the code and the uid, never the native message', () => {
    logAuthError('signIn', withCode('auth/internal-error'), 'uid-1');
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('signIn failed: code=auth/internal-error uid=uid-1'),
    );
    expect(JSON.stringify(mockLogger.logError.mock.calls)).not.toContain(
      'example.com',
    );
  });

  it('does not report expected user errors as errors', () => {
    logAuthError('signIn', withCode('auth/invalid-credential'));
    expect(mockLogger.logError).not.toHaveBeenCalled();
    expect(mockLogger.logMessage).toHaveBeenCalledWith(
      'signIn failed: code=auth/invalid-credential',
    );
  });

  it('logs "not available yet" as a message, not as an error', () => {
    logAuthError('signIn', new AppAuthError(ACCOUNT_UNAVAILABLE));
    expect(mockLogger.logError).not.toHaveBeenCalled();
    expect(mockLogger.logMessage).toHaveBeenCalledWith(
      'signIn failed: code=app/account-unavailable',
    );
  });
});
