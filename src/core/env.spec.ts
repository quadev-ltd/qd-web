import { z } from 'zod';

import { envSchema, parseEnv } from './env';

const valid = {
  APPLICATION_NAME: 'web',
  APPLICATION_ENVIRONMENT: 'test',
};

describe('env', () => {
  it('turns off the code generation of zod, which the Content-Security-Policy forbids', () => {
    expect(z.config().jitless).toBe(true);
  });

  it('accepts the three application environments', () => {
    for (const environment of ['test', 'dev', 'prod']) {
      expect(
        parseEnv({ ...valid, APPLICATION_ENVIRONMENT: environment })
          .APPLICATION_ENVIRONMENT,
      ).toBe(environment);
    }
  });

  it('turns the account flag off when it is not set', () => {
    expect(parseEnv(valid).ACCOUNT_ENABLED).toBe(false);
  });

  it('turns the account flag off when it is empty or "false"', () => {
    expect(parseEnv({ ...valid, ACCOUNT_ENABLED: '' }).ACCOUNT_ENABLED).toBe(
      false,
    );
    expect(
      parseEnv({ ...valid, ACCOUNT_ENABLED: 'false' }).ACCOUNT_ENABLED,
    ).toBe(false);
  });

  it('turns the account flag on only when it is "true"', () => {
    expect(
      parseEnv({ ...valid, ACCOUNT_ENABLED: 'true' }).ACCOUNT_ENABLED,
    ).toBe(true);
  });

  it('rejects an account flag that is not "true" or "false"', () => {
    expect(
      envSchema.safeParse({ ...valid, ACCOUNT_ENABLED: 'yes' }).success,
    ).toBe(false);
  });

  it('uses the unavailable auth gateway unless "preview" is asked for', () => {
    expect(parseEnv(valid).AUTH_GATEWAY).toBe('unavailable');
    expect(parseEnv({ ...valid, AUTH_GATEWAY: '' }).AUTH_GATEWAY).toBe(
      'unavailable',
    );
    expect(
      parseEnv({ ...valid, AUTH_GATEWAY: 'unavailable' }).AUTH_GATEWAY,
    ).toBe('unavailable');
    expect(parseEnv({ ...valid, AUTH_GATEWAY: 'preview' }).AUTH_GATEWAY).toBe(
      'preview',
    );
  });

  it('rejects an auth gateway it does not know', () => {
    expect(
      envSchema.safeParse({ ...valid, AUTH_GATEWAY: 'firebase' }).success,
    ).toBe(false);
  });

  it('throws naming the invalid variables', () => {
    expect(() => parseEnv({ APPLICATION_ENVIRONMENT: 'staging' })).toThrow(
      /Invalid config variables:[\s\S]*APPLICATION_NAME[\s\S]*APPLICATION_ENVIRONMENT/,
    );
  });

  it('reads the test configuration from .env.test', async () => {
    const { env } = await import('./env');

    expect(env).toEqual({
      APPLICATION_NAME: 'web',
      APPLICATION_ENVIRONMENT: 'test',
      ACCOUNT_ENABLED: false,
      AUTH_GATEWAY: 'unavailable',
    });
  });
});
