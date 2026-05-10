/**
 * ScreenTimeNativeService
 *
 * Thin wrapper around the native ScreenTimeRewardsModule.
 * Gracefully degrades on Android or when the module is not available.
 */

import { Platform, NativeModules } from 'react-native';
import { ScreenTimeAuthStatus, ScreenTimeRewardSession } from './types';

const { ScreenTimeRewardsModule } = NativeModules;

function isAvailable(): boolean {
  return Platform.OS === 'ios' && !!ScreenTimeRewardsModule;
}

export async function requestAuthorization(): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    return await ScreenTimeRewardsModule.requestAuthorization();
  } catch {
    return false;
  }
}

export async function getAuthorizationStatus(): Promise<ScreenTimeAuthStatus> {
  if (!isAvailable()) return 'unavailable';
  try {
    return await ScreenTimeRewardsModule.getAuthorizationStatus();
  } catch {
    return 'unavailable';
  }
}

export async function presentFamilyActivityPicker(): Promise<void> {
  if (!isAvailable()) return;
  await ScreenTimeRewardsModule.presentFamilyActivityPicker();
}

export async function hasSelectedActivities(): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    return await ScreenTimeRewardsModule.hasSelectedActivities();
  } catch {
    return false;
  }
}

export async function applyRestrictions(): Promise<void> {
  if (!isAvailable()) return;
  await ScreenTimeRewardsModule.applyRestrictions();
}

export async function clearRestrictions(): Promise<void> {
  if (!isAvailable()) return;
  await ScreenTimeRewardsModule.stopRewardSession();
}

export async function startRewardSession(
  minutes: number,
): Promise<ScreenTimeRewardSession | null> {
  if (!isAvailable()) return null;
  try {
    const raw = await ScreenTimeRewardsModule.startRewardSession(minutes);
    return raw as ScreenTimeRewardSession;
  } catch {
    return null;
  }
}

export async function stopRewardSession(): Promise<void> {
  if (!isAvailable()) return;
  try {
    await ScreenTimeRewardsModule.stopRewardSession();
  } catch {
    // ignore
  }
}

export async function getRewardSessionStatus(): Promise<ScreenTimeRewardSession | null> {
  if (!isAvailable()) return null;
  try {
    const raw = await ScreenTimeRewardsModule.getRewardSessionStatus();
    if (!raw || !raw.isActive) return null;
    return raw as ScreenTimeRewardSession;
  } catch {
    return null;
  }
}

export { isAvailable as isScreenTimeAvailable };
