import { APPLE_SIGN_IN_ENABLED } from './providers';

describe('sign-in providers', () => {
  it('keeps Apple off on the web until it is set up in the Apple Developer account', () => {
    expect(APPLE_SIGN_IN_ENABLED).toBe(false);
  });
});
