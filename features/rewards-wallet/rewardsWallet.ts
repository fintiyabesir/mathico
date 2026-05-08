import { getDatabase } from '../../shared/storage/database';
import { RewardTransaction } from '../../shared/types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function addPoints(
  userProfileId: string,
  amount: number,
  description: string,
  createdByType: 'system' | 'parent' = 'system'
): Promise<void> {
  if (amount <= 0) return;
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO reward_transaction (id, userProfileId, type, amount, description, createdByType, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [generateId(), userProfileId, 'earned', amount, description, createdByType, new Date().toISOString()]
  );
}

export async function spendPoints(
  userProfileId: string,
  amount: number,
  description: string
): Promise<boolean> {
  if (amount <= 0) return false;
  if (!description.trim()) return false;
  const balance = await getBalance(userProfileId);
  if (balance < amount) return false;
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO reward_transaction (id, userProfileId, type, amount, description, createdByType, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [generateId(), userProfileId, 'spent', amount, description, 'parent', new Date().toISOString()]
  );
  return true;
}

export async function getBalance(userProfileId: string): Promise<number> {
  const db = await getDatabase();
  const earned = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM reward_transaction WHERE userProfileId = ? AND type = 'earned'",
    [userProfileId]
  );
  const spent = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM reward_transaction WHERE userProfileId = ? AND type = 'spent'",
    [userProfileId]
  );
  return (earned?.total ?? 0) - (spent?.total ?? 0);
}

export async function getTransactions(userProfileId: string, limit = 50): Promise<RewardTransaction[]> {
  const db = await getDatabase();
  return await db.getAllAsync<RewardTransaction>(
    'SELECT * FROM reward_transaction WHERE userProfileId = ? ORDER BY createdAt DESC LIMIT ?',
    [userProfileId, limit]
  );
}
