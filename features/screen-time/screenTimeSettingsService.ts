/**
 * ScreenTimeSettingsService
 *
 * Persists ScreenTimeRewardSettings and today's used-minutes counter.
 * Uses AsyncStorage (already in the project via React Native).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ScreenTimeRewardSettings,
  DEFAULT_SCREEN_TIME_REWARD_SETTINGS,
} from './types';

const SETTINGS_KEY_PREFIX = 'mathico_screen_time_settings_';
const DAILY_USED_KEY_PREFIX = 'mathico_screen_time_daily_used_';

function settingsKey(profileId: string) {
  return `${SETTINGS_KEY_PREFIX}${profileId}`;
}

function dailyUsedKey(profileId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${DAILY_USED_KEY_PREFIX}${profileId}_${today}`;
}

export async function loadSettings(
  profileId: string,
): Promise<ScreenTimeRewardSettings> {
  try {
    const raw = await AsyncStorage.getItem(settingsKey(profileId));
    if (!raw) return { ...DEFAULT_SCREEN_TIME_REWARD_SETTINGS };
    return JSON.parse(raw) as ScreenTimeRewardSettings;
  } catch {
    return { ...DEFAULT_SCREEN_TIME_REWARD_SETTINGS };
  }
}

export async function saveSettings(
  profileId: string,
  settings: ScreenTimeRewardSettings,
): Promise<void> {
  const data: ScreenTimeRewardSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(settingsKey(profileId), JSON.stringify(data));
}

export async function getDailyUsedMinutes(profileId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(dailyUsedKey(profileId));
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function incrementDailyUsedMinutes(
  profileId: string,
  minutes: number,
): Promise<void> {
  const current = await getDailyUsedMinutes(profileId);
  await AsyncStorage.setItem(
    dailyUsedKey(profileId),
    String(current + minutes),
  );
}
