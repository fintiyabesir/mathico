/**
 * Unit tests for Screen Time Rewards feature.
 *
 * Tests pure calculation functions and validation rules only.
 * No native module, no AsyncStorage — all mocked.
 */

import {
  calculatePointsCost,
  calculateMinutesGranted,
  remainingDailyMinutes,
  remainingSessionSeconds,
  minimumUnits,
  buildConversionPreview,
} from '../screenTimeRewardCalculator';

import { validateRedemption } from '../screenTimeRewardValidationService';

import {
  ScreenTimeRewardSettings,
  DEFAULT_SCREEN_TIME_REWARD_SETTINGS,
  ScreenTimeRewardSession,
  ScreenTimeValidationContext,
} from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_SETTINGS: ScreenTimeRewardSettings = {
  ...DEFAULT_SCREEN_TIME_REWARD_SETTINGS,
  enabled: true,
  pointsPerUnit: 100,
  minutesPerUnit: 15,
  dailyMaxMinutes: 60,
  minimumRedeemablePoints: 100,
  selectedAppsConfigured: true,
};

function makeSession(minutesFromNow: number): ScreenTimeRewardSession {
  const now = new Date();
  const start = new Date(now.getTime() - 60_000); // started 1 min ago
  const expires = new Date(now.getTime() + minutesFromNow * 60_000);
  return {
    isActive: true,
    startedAt: start.toISOString(),
    expiresAt: expires.toISOString(),
    redeemedPoints: 100,
    grantedMinutes: minutesFromNow + 1,
  };
}

function makeExpiredSession(): ScreenTimeRewardSession {
  const past = new Date(Date.now() - 60_000).toISOString();
  return {
    isActive: true,
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    expiresAt: past,
    redeemedPoints: 100,
    grantedMinutes: 0,
  };
}

function baseContext(overrides?: Partial<ScreenTimeValidationContext>): ScreenTimeValidationContext {
  return {
    settings: BASE_SETTINGS,
    balance: 500,
    dailyUsedMinutes: 0,
    authStatus: 'approved',
    requestedUnits: 1,
    activeSession: null,
    isScreenTimeAvailable: true,
    ...overrides,
  };
}

// ─── Calculator tests ─────────────────────────────────────────────────────────

describe('calculatePointsCost', () => {
  it('returns pointsPerUnit for 1 unit', () => {
    expect(calculatePointsCost(1, BASE_SETTINGS)).toBe(100);
  });
  it('scales linearly', () => {
    expect(calculatePointsCost(3, BASE_SETTINGS)).toBe(300);
  });
});

describe('calculateMinutesGranted', () => {
  it('returns minutesPerUnit for 1 unit', () => {
    expect(calculateMinutesGranted(1, BASE_SETTINGS)).toBe(15);
  });
  it('scales linearly', () => {
    expect(calculateMinutesGranted(4, BASE_SETTINGS)).toBe(60);
  });
});

describe('remainingDailyMinutes', () => {
  it('returns full daily max when nothing used', () => {
    expect(remainingDailyMinutes(BASE_SETTINGS, 0)).toBe(60);
  });
  it('returns reduced budget after partial use', () => {
    expect(remainingDailyMinutes(BASE_SETTINGS, 30)).toBe(30);
  });
  it('returns 0 when daily max fully consumed', () => {
    expect(remainingDailyMinutes(BASE_SETTINGS, 60)).toBe(0);
  });
  it('returns 0 (not negative) when over budget', () => {
    expect(remainingDailyMinutes(BASE_SETTINGS, 100)).toBe(0);
  });
});

describe('remainingSessionSeconds', () => {
  it('returns positive seconds for a future session', () => {
    const session = makeSession(5); // expires in 5 minutes
    const remaining = remainingSessionSeconds(session);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(5 * 60);
  });
  it('returns 0 for an expired session', () => {
    const session = makeExpiredSession();
    expect(remainingSessionSeconds(session)).toBe(0);
  });
});

describe('minimumUnits', () => {
  it('returns 1 when minimumRedeemablePoints equals pointsPerUnit', () => {
    expect(minimumUnits(BASE_SETTINGS)).toBe(1);
  });
  it('returns correct ceiling when minimumRedeemablePoints > pointsPerUnit', () => {
    const s: ScreenTimeRewardSettings = { ...BASE_SETTINGS, minimumRedeemablePoints: 250 };
    expect(minimumUnits(s)).toBe(3); // ceil(250/100)
  });
});

describe('buildConversionPreview', () => {
  it('returns correct pointsCost and minutesGranted', () => {
    const preview = buildConversionPreview(2, BASE_SETTINGS);
    expect(preview.pointsCost).toBe(200);
    expect(preview.minutesGranted).toBe(30);
    expect(preview.units).toBe(2);
  });
});

// ─── Validation tests ─────────────────────────────────────────────────────────

describe('validateRedemption', () => {
  it('succeeds when all conditions are met', () => {
    const result = validateRedemption(baseContext());
    expect(result.valid).toBe(true);
    expect(result.errorCode).toBeUndefined();
  });

  it('fails with REWARDS_DISABLED when settings.enabled is false', () => {
    const result = validateRedemption(
      baseContext({ settings: { ...BASE_SETTINGS, enabled: false } }),
    );
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('REWARDS_DISABLED');
  });

  it('fails with IOS_VERSION_UNSUPPORTED when unavailable', () => {
    const result = validateRedemption(baseContext({ isScreenTimeAvailable: false }));
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('IOS_VERSION_UNSUPPORTED');
  });

  it('fails with PERMISSION_MISSING when auth is not approved', () => {
    const result = validateRedemption(baseContext({ authStatus: 'denied' }));
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('PERMISSION_MISSING');
  });

  it('fails with APPS_NOT_CONFIGURED when no apps selected', () => {
    const result = validateRedemption(
      baseContext({ settings: { ...BASE_SETTINGS, selectedAppsConfigured: false } }),
    );
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('APPS_NOT_CONFIGURED');
  });

  it('fails with INSUFFICIENT_POINTS when balance is too low', () => {
    const result = validateRedemption(baseContext({ balance: 50 })); // cost = 100
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_POINTS');
  });

  it('fails with DAILY_MAX_EXCEEDED when daily quota is used up', () => {
    const result = validateRedemption(baseContext({ dailyUsedMinutes: 60 }));
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('DAILY_MAX_EXCEEDED');
  });

  it('fails with ACTIVE_SESSION_EXISTS when a session is ongoing', () => {
    const result = validateRedemption(
      baseContext({ activeSession: makeSession(10) }),
    );
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('ACTIVE_SESSION_EXISTS');
  });
});
