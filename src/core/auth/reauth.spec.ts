import { getReauthMethod } from './reauth';
import { type SessionUser } from './types';

const user = (providerIds: string[]): SessionUser => ({
  uid: 'uid-1',
  email: 'ada@example.com',
  emailVerified: true,
  displayName: null,
  providerIds,
});

describe('getReauthMethod', () => {
  it.each([
    [['password'], 'password'],
    [['google.com'], 'google'],
    [['password', 'google.com'], 'google'],
    [['apple.com', 'google.com'], 'google'],
    [['apple.com', 'password'], 'password'],
  ] as const)('%j confirms with %s', (providerIds, method) => {
    expect(getReauthMethod(user([...providerIds]))).toBe(method);
  });

  it('has no way to confirm an account with Apple alone, or with no provider', () => {
    expect(getReauthMethod(user(['apple.com']))).toBeNull();
    expect(getReauthMethod(user([]))).toBeNull();
  });
});
