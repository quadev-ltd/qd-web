import {
  getProfileErrorCode,
  logProfileError,
  ProfileError,
  ProfileErrorCode,
} from './errors';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('profile errors', () => {
  it('carries its code', () => {
    const error = new ProfileError(ProfileErrorCode.DailyLimit);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ProfileError');
    expect(error.code).toBe('profile/daily-limit');
    expect(getProfileErrorCode(error)).toBe(ProfileErrorCode.DailyLimit);
  });

  it.each([
    ['another error', new Error('boom')],
    ['a Firebase error', { code: 'functions/not-found' }],
    ['nothing', undefined],
  ])('reads %s as unknown', (_name, error) => {
    expect(getProfileErrorCode(error)).toBe(ProfileErrorCode.Unknown);
  });

  it.each([
    ProfileErrorCode.FlagOff,
    ProfileErrorCode.DailyLimit,
    ProfileErrorCode.MaxResources,
    ProfileErrorCode.NotFound,
    ProfileErrorCode.Network,
    ProfileErrorCode.UploadCancelled,
    ProfileErrorCode.Unavailable,
  ])('logs %s as a message: a refusal is not a fault', code => {
    logProfileError('createResource', new ProfileError(code), 'uid-1');

    expect(mockLogger.logMessage).toHaveBeenCalledWith(
      `createResource failed: code=${code} uid=uid-1`,
    );
    expect(mockLogger.logError).not.toHaveBeenCalled();
  });

  it.each([
    ProfileErrorCode.Unknown,
    ProfileErrorCode.Invalid,
    ProfileErrorCode.SignedOut,
    ProfileErrorCode.UploadRefused,
  ])('logs %s as an error', code => {
    logProfileError('uploadFile', new ProfileError(code));

    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error(`uploadFile failed: code=${code}`),
    );
    expect(mockLogger.logMessage).not.toHaveBeenCalled();
  });

  it('never logs what the error says: it could quote the candidate', () => {
    logProfileError(
      'createResource',
      new Error('Title "Maya Okafor CV 2026" is not valid'),
      'uid-1',
    );

    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('createResource failed: code=profile/unknown uid=uid-1'),
    );
    expect(JSON.stringify(mockLogger.logError.mock.calls)).not.toContain(
      'Maya',
    );
  });
});
