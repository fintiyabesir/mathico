import { getDatabase } from '../../shared/storage/database';
import { UserProfile, AgeGroup, DifficultyPreference, ThemeType } from '../../shared/types';
import { AGE_GROUP_DEFAULT_THEME } from '../../shared/lib/constants';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function createProfile(
  displayName: string,
  avatar: string,
  ageGroup: AgeGroup,
  preference: DifficultyPreference
): Promise<UserProfile> {
  const db = await getDatabase();
  const id = generateId();
  const theme = AGE_GROUP_DEFAULT_THEME[ageGroup];
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO user_profile (id, displayName, avatar, ageGroup, startDifficultyPreference, selectedTheme, createdAt, settingsJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, displayName, avatar, ageGroup, preference, theme, now, '{}']
  );

  return { id, displayName, avatar, ageGroup, startDifficultyPreference: preference, selectedTheme: theme, createdAt: now, settingsJson: '{}' };
}

export async function getAllProfiles(): Promise<UserProfile[]> {
  const db = await getDatabase();
  return await db.getAllAsync<UserProfile>('SELECT * FROM user_profile ORDER BY createdAt ASC');
}

export async function getProfile(id: string): Promise<UserProfile | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<UserProfile>('SELECT * FROM user_profile WHERE id = ?', [id]);
}

export async function updateProfileTheme(id: string, theme: ThemeType): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE user_profile SET selectedTheme = ? WHERE id = ?', [theme, id]);
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_profile WHERE id = ?', [id]);
}
