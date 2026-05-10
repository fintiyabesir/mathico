/**
 * ScreenTimeRewardCalculator
 *
 * Pure functions — no side effects, easily unit-tested.
 */

import { ScreenTimeRewardSettings } from './types';

export interface ConversionPreview {
  units: number;
  pointsCost: number;
  minutesGranted: number;
}

/**
 * Calculate how many points a given number of units costs.
 */
export function calculatePointsCost(
  units: number,
  settings: ScreenTimeRewardSettings,
): number {
  return Math.round(units * settings.pointsPerUnit);
}

/**
 * Calculate how many minutes a given number of units grants.
 */
export function calculateMinutesGranted(
  units: number,
  settings: ScreenTimeRewardSettings,
): number {
  return Math.round(units * settings.minutesPerUnit);
}

/**
 * Maximum units the child can redeem given remaining daily budget.
 */
export function maxRedeemableUnits(
  settings: ScreenTimeRewardSettings,
  minutesAlreadyUsedToday: number,
): number {
  const remainingMinutes = Math.max(
    0,
    settings.dailyMaxMinutes - minutesAlreadyUsedToday,
  );
  if (settings.minutesPerUnit <= 0) return 0;
  return Math.floor(remainingMinutes / settings.minutesPerUnit);
}

/**
 * Maximum units the child can redeem given their current balance.
 */
export function maxAffordableUnits(
  currentBalance: number,
  settings: ScreenTimeRewardSettings,
): number {
  if (settings.pointsPerUnit <= 0) return 0;
  return Math.floor(currentBalance / settings.pointsPerUnit);
}

/**
 * Remaining screen time minutes the child can still earn today.
 */
export function remainingDailyMinutes(
  settings: ScreenTimeRewardSettings,
  minutesAlreadyUsedToday: number,
): number {
  return Math.max(0, settings.dailyMaxMinutes - minutesAlreadyUsedToday);
}

/**
 * How many minutes remain in an active session (clamped to 0).
 */
export function remainingSessionSeconds(
  session: { expiresAt: string } | null,
): number {
  if (!session) return 0;
  const diff = new Date(session.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

/**
 * Full preview for the UI to show all numbers at once.
 */
export function buildConversionPreview(
  units: number,
  settings: ScreenTimeRewardSettings,
): ConversionPreview {
  return {
    units,
    pointsCost: calculatePointsCost(units, settings),
    minutesGranted: calculateMinutesGranted(units, settings),
  };
}

/**
 * Minimum units required so the redemption meets minimumRedeemablePoints.
 */
export function minimumUnits(settings: ScreenTimeRewardSettings): number {
  if (settings.pointsPerUnit <= 0) return 1;
  return Math.ceil(settings.minimumRedeemablePoints / settings.pointsPerUnit);
}
