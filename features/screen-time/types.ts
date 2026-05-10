/**
 * Screen Time Rewards — TypeScript data models
 *
 * This feature lets parents select apps (e.g. Minecraft) that children can
 * unlock temporarily by spending earned math points.
 *
 * Implementation uses:
 *   - FamilyControls  — guardian authorization + FamilyActivityPicker
 *   - ManagedSettings — shielding / unshielding selected apps
 *   - DeviceActivity  — durable expiry enforcement even when app is killed
 *
 * IMPORTANT: This does NOT modify Apple's built-in Screen Time limits from
 * iOS Settings.  Parents must manage blocking through this app only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Settings (stored per profile via AsyncStorage / SQLite settings row)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreenTimeRewardSettings {
  /** Whether the whole feature is active for this profile. */
  enabled: boolean;

  /**
   * Exchange rate — how many points equal one "unit".
   * Example: pointsPerUnit = 100 means 100 points buys one unit.
   */
  pointsPerUnit: number;

  /**
   * How many minutes one "unit" of reward unlocks.
   * Example: minutesPerUnit = 15 means each unit gives 15 minutes.
   */
  minutesPerUnit: number;

  /**
   * Hard ceiling on bonus screen time the child can earn in a single day.
   * Example: dailyMaxMinutes = 60 means at most 60 extra minutes per day.
   */
  dailyMaxMinutes: number;

  /**
   * The child must spend at least this many points per redemption.
   * Prevents micro-redemptions (e.g. 1 point = 9 seconds).
   */
  minimumRedeemablePoints: number;

  /**
   * Whether the parent has completed FamilyActivityPicker selection.
   * Apps are only shielded/unshielded when this is true.
   */
  selectedAppsConfigured: boolean;

  /**
   * Human-readable label the parent typed for the selected app group.
   * Because FamilyActivitySelection tokens are opaque we cannot read the
   * real app name programmatically; the parent types it themselves.
   * Example: "Minecraft"
   */
  rewardTargetDisplayName?: string;

  /** ISO-8601 timestamp of last settings save. */
  updatedAt: string;
}

export const DEFAULT_SCREEN_TIME_REWARD_SETTINGS: ScreenTimeRewardSettings = {
  enabled: false,
  pointsPerUnit: 100,
  minutesPerUnit: 15,
  dailyMaxMinutes: 60,
  minimumRedeemablePoints: 100,
  selectedAppsConfigured: false,
  rewardTargetDisplayName: undefined,
  updatedAt: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Active reward session
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreenTimeRewardSession {
  isActive: boolean;
  startedAt: string;   // ISO-8601
  expiresAt: string;   // ISO-8601
  redeemedPoints: number;
  grantedMinutes: number;
  targetDisplayName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redemption request / result
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreenTimeRedemptionRequest {
  childId: string;
  requestedUnits: number;
  requestedPoints: number;
  requestedMinutes: number;
}

export interface ScreenTimeRedemptionResult {
  success: boolean;
  remainingPoints: number;
  activeSession?: ScreenTimeRewardSession;
  errorCode?: ScreenTimeErrorCode;
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error codes (used in validation results & UI messaging)
// ─────────────────────────────────────────────────────────────────────────────

export type ScreenTimeErrorCode =
  | 'REWARDS_DISABLED'
  | 'PERMISSION_MISSING'
  | 'APPS_NOT_CONFIGURED'
  | 'INSUFFICIENT_POINTS'
  | 'DAILY_MAX_EXCEEDED'
  | 'ACTIVE_SESSION_EXISTS'
  | 'IOS_VERSION_UNSUPPORTED'
  | 'NATIVE_MODULE_UNAVAILABLE'
  | 'NATIVE_ERROR'
  | 'UNKNOWN';

// ─────────────────────────────────────────────────────────────────────────────
// Authorization status (mirrors native FamilyControls enum)
// ─────────────────────────────────────────────────────────────────────────────

export type ScreenTimeAuthStatus =
  | 'approved'
  | 'denied'
  | 'notDetermined'
  | 'restricted'
  | 'unavailable';   // iOS < 16 or simulator

// ─────────────────────────────────────────────────────────────────────────────
// Validation context (all inputs the validator needs)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreenTimeValidationContext {
  settings: ScreenTimeRewardSettings;
  authStatus: ScreenTimeAuthStatus;
  currentBalance: number;
  requestedPoints: number;
  requestedMinutes: number;
  minutesAlreadyUsedToday: number;
  activeSession: ScreenTimeRewardSession | null;
}

export interface ScreenTimeValidationResult {
  valid: boolean;
  errorCode?: ScreenTimeErrorCode;
  message?: string;
}
