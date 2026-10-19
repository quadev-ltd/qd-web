// The backend's fixtures (quadev-backend packages/shared/src/usage.test.ts, as of 00b79c0),
// copied as they are.
import {
  CV_VERSION_DAILY_LIMIT,
  USAGE_LIMIT_CEILING,
  UsageLimitsSchema,
  effectiveLimits,
  isUsageService,
  serviceOverride,
  usageLimitsPath,
} from './usageLimits';

describe('per-user limits', () => {
  it('names the document and the services', () => {
    expect(usageLimitsPath('u1')).toBe('usageLimits/u1');
    expect(isUsageService('cvVersion')).toBe(true);
    expect(isUsageService('toString')).toBe(false);
  });

  it('puts each field of an override on top of the defaults, capped at the ceiling', () => {
    expect(effectiveLimits(CV_VERSION_DAILY_LIMIT)).toEqual({
      maxCallsPerDay: 5,
      maxCostUsdPerDay: 0.5,
    });
    expect(
      effectiveLimits(CV_VERSION_DAILY_LIMIT, { maxCallsPerDay: 20 }),
    ).toEqual({
      maxCallsPerDay: 20,
      maxCostUsdPerDay: 0.5,
    });
    expect(
      effectiveLimits(CV_VERSION_DAILY_LIMIT, { maxCallsPerDay: 0 })
        .maxCallsPerDay,
    ).toBe(0);
    expect(
      effectiveLimits(CV_VERSION_DAILY_LIMIT, {
        maxCallsPerDay: 99,
        maxCostUsdPerDay: 99,
      }),
    ).toEqual(USAGE_LIMIT_CEILING);
    expect(
      effectiveLimits(CV_VERSION_DAILY_LIMIT, { maxCallsPerDay: 2.5 }),
    ).toEqual(CV_VERSION_DAILY_LIMIT);
    expect(effectiveLimits(CV_VERSION_DAILY_LIMIT, 'many')).toEqual(
      CV_VERSION_DAILY_LIMIT,
    );
  });

  it('reads one service of a document, whatever else it holds', () => {
    const document = {
      services: { cvVersion: { maxCallsPerDay: 20 } },
      note: 'tester',
      updatedBy: 'x',
    };
    expect(serviceOverride(document, 'cvVersion')).toEqual({
      maxCallsPerDay: 20,
    });
    expect(serviceOverride(document, 'jobReading')).toBeUndefined();
    expect(serviceOverride(undefined, 'cvVersion')).toBeUndefined();
    expect(UsageLimitsSchema.parse(document).services.cvVersion).toEqual({
      maxCallsPerDay: 20,
    });
  });
});
