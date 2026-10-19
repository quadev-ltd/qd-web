import {
  CV_VERSION_DAILY_LIMIT,
  effectiveLimits,
  USAGE_LIMIT_CEILING,
  UsageLimitsSchema,
} from './usageLimits';

describe('effectiveLimits', () => {
  it('is the default without an override', () => {
    expect(effectiveLimits(CV_VERSION_DAILY_LIMIT)).toEqual({
      maxCallsPerDay: 5,
      maxCostUsdPerDay: 0.5,
    });
  });

  it('puts each field of an override on top of the default', () => {
    expect(
      effectiveLimits(CV_VERSION_DAILY_LIMIT, { maxCallsPerDay: 20 }),
    ).toEqual({ maxCallsPerDay: 20, maxCostUsdPerDay: 0.5 });
    expect(
      effectiveLimits(CV_VERSION_DAILY_LIMIT, { maxCostUsdPerDay: 2 }),
    ).toEqual({ maxCallsPerDay: 5, maxCostUsdPerDay: 2 });
  });

  it('caps an override at the ceiling, and lets 0 block the service', () => {
    expect(
      effectiveLimits(CV_VERSION_DAILY_LIMIT, {
        maxCallsPerDay: 500,
        maxCostUsdPerDay: 80,
      }),
    ).toEqual(USAGE_LIMIT_CEILING);
    expect(
      effectiveLimits(CV_VERSION_DAILY_LIMIT, { maxCallsPerDay: 0 })
        .maxCallsPerDay,
    ).toBe(0);
  });
});

describe('UsageLimitsSchema', () => {
  it('leaves out a malformed service, so its defaults apply', () => {
    expect(
      UsageLimitsSchema.parse({
        services: {
          cvVersion: { maxCallsPerDay: 20, maxCostUsdPerDay: 2 },
          applicationBrief: { maxCallsPerDay: -1 },
          jobReading: 'lots',
        },
        note: 'Tester',
      }),
    ).toEqual({
      services: { cvVersion: { maxCallsPerDay: 20, maxCostUsdPerDay: 2 } },
      note: 'Tester',
    });
  });
});
