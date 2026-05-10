/**
 * ScreenTimeRewardRedemptionService
 *
 * Orchestrates validation → point deduction → native session start.
 */

import { spendPoints, getBalance } from '../rewards-wallet/rewardsWallet';
import { validateRedemption } from './screenTimeRewardValidationService';
import {
  getDailyUsedMinutes,
  incrementDailyUsedMinutes,
} from './screenTimeSettingsService';
import {
  startRewardSession,
  getAuthorizationStatus,
  getRewardSessionStatus,
} from './screenTimeNativeService';
import {
  ScreenTimeRewardSettings,
  ScreenTimeRedemptionRequest,
  ScreenTimeRedemptionResult,
} from './types';
import { logRedemption } from './screenTimeActivityLogService';

export async function redeemScreenTime(
  request: ScreenTimeRedemptionRequest,
  settings: ScreenTimeRewardSettings,
): Promise<ScreenTimeRedemptionResult> {
  const { childId, requestedPoints, requestedMinutes } = request;

  const [authStatus, currentBalance, minutesAlreadyUsedToday, activeSession] =
    await Promise.all([
      getAuthorizationStatus(),
      getBalance(childId),
      getDailyUsedMinutes(childId),
      getRewardSessionStatus(),
    ]);

  const validation = validateRedemption({
    settings,
    authStatus,
    currentBalance,
    requestedPoints,
    requestedMinutes,
    minutesAlreadyUsedToday,
    activeSession,
  });

  if (!validation.valid) {
    return {
      success: false,
      remainingPoints: currentBalance,
      errorCode: validation.errorCode,
      message: validation.message,
    };
  }

  // Deduct points
  await spendPoints(
    childId,
    requestedPoints,
    `Ekran süresi: ${requestedMinutes} dk (${settings.rewardTargetDisplayName ?? 'Uygulama'})`,
  );

  // Track daily usage
  await incrementDailyUsedMinutes(childId, requestedMinutes);

  // Start native session (unshields the app, DeviceActivity handles re-block)
  const session = await startRewardSession(requestedMinutes);

  // Log the redemption event so the parent report can display it
  const now = new Date();
  const expiresAt = new Date(now.getTime() + requestedMinutes * 60 * 1000);
  await logRedemption(childId, {
    id: `${childId}_${now.getTime()}`,
    redeemedAt: now.toISOString(),
    pointsSpent: requestedPoints,
    minutesGranted: requestedMinutes,
    targetDisplayName: settings.rewardTargetDisplayName ?? 'Uygulama',
    expiresAt: expiresAt.toISOString(),
  });

  const newBalance = await getBalance(childId);

  return {
    success: true,
    remainingPoints: newBalance,
    activeSession: session ?? undefined,
  };
}
