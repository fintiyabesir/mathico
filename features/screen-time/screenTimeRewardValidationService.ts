/**
 * ScreenTimeRewardValidationService
 *
 * All business-rule validation lives here, not in UI components.
 */

import {
  ScreenTimeValidationContext,
  ScreenTimeValidationResult,
} from './types';

export function validateRedemption(
  ctx: ScreenTimeValidationContext,
): ScreenTimeValidationResult {
  const { settings, authStatus, currentBalance, requestedPoints, requestedMinutes, minutesAlreadyUsedToday, activeSession } = ctx;

  if (!settings.enabled) {
    return { valid: false, errorCode: 'REWARDS_DISABLED', message: 'Ekran süresi ödülleri devre dışı.' };
  }

  if (authStatus === 'unavailable') {
    return { valid: false, errorCode: 'IOS_VERSION_UNSUPPORTED', message: 'Bu özellik yalnızca iOS 16 ve üzerinde kullanılabilir.' };
  }

  if (authStatus !== 'approved') {
    return { valid: false, errorCode: 'PERMISSION_MISSING', message: 'Ebeveyn ekran süresi iznini henüz vermedi.' };
  }

  if (!settings.selectedAppsConfigured) {
    return { valid: false, errorCode: 'APPS_NOT_CONFIGURED', message: 'Ebeveyn henüz uygulama seçmedi.' };
  }

  if (currentBalance < requestedPoints) {
    return { valid: false, errorCode: 'INSUFFICIENT_POINTS', message: `Yeterli puan yok. Gereken: ${requestedPoints}, Mevcut: ${currentBalance}` };
  }

  if (requestedPoints < settings.minimumRedeemablePoints) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_POINTS',
      message: `En az ${settings.minimumRedeemablePoints} puan harcaman gerekiyor.`,
    };
  }

  const usedAfter = minutesAlreadyUsedToday + requestedMinutes;
  if (usedAfter > settings.dailyMaxMinutes) {
    return {
      valid: false,
      errorCode: 'DAILY_MAX_EXCEEDED',
      message: `Bugünkü maksimum ekstra süre doldu (${settings.dailyMaxMinutes} dk).`,
    };
  }

  if (activeSession?.isActive) {
    return { valid: false, errorCode: 'ACTIVE_SESSION_EXISTS', message: 'Zaten aktif bir ödül oturumu var.' };
  }

  return { valid: true };
}
