import { getDatabase } from '../../shared/storage/database';
import { DailyGoal, BadgeAward, Badge } from '../../shared/types';
import { DAILY_GOAL_QUESTION_COUNT } from '../../shared/lib/constants';
import { AgeGroup } from '../../shared/types';
import { addPoints } from '../rewards-wallet/rewardsWallet';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getOrCreateDailyGoal(userProfileId: string, ageGroup: AgeGroup): Promise<DailyGoal> {
  const db = await getDatabase();
  const today = todayStr();
  const existing = await db.getFirstAsync<DailyGoal>(
    "SELECT * FROM daily_goal WHERE userProfileId = ? AND date = ? AND goalType = 'questions'",
    [userProfileId, today]
  );
  if (existing) return existing;

  const id = generateId();
  const target = DAILY_GOAL_QUESTION_COUNT[ageGroup];
  await db.runAsync(
    "INSERT INTO daily_goal (id, userProfileId, date, goalType, targetValue, currentValue, completed) VALUES (?, ?, ?, 'questions', ?, 0, 0)",
    [id, userProfileId, today, target]
  );
  return { id, userProfileId, date: today, goalType: 'questions', targetValue: target, currentValue: 0, completed: 0 };
}

export async function incrementDailyGoal(userProfileId: string, questionsAnswered: number): Promise<DailyGoal | null> {
  const db = await getDatabase();
  const today = todayStr();
  const goal = await db.getFirstAsync<DailyGoal>(
    "SELECT * FROM daily_goal WHERE userProfileId = ? AND date = ? AND goalType = 'questions'",
    [userProfileId, today]
  );
  if (!goal) return null;

  const wasCompleted = goal.completed === 1;
  const newValue = Math.min(goal.currentValue + questionsAnswered, goal.targetValue);
  const completed = newValue >= goal.targetValue ? 1 : 0;
  await db.runAsync(
    'UPDATE daily_goal SET currentValue = ?, completed = ? WHERE id = ?',
    [newValue, completed, goal.id]
  );

  // Seri bonusu: günlük hedef bu seans ile yeni tamamlandıysa bonus puan ver
  if (!wasCompleted && completed === 1) {
    const streak = await getStreak(userProfileId);
    const streakBonus = streak <= 1 ? 10 : streak <= 3 ? 25 : streak <= 7 ? 50 : 100;
    await addPoints(userProfileId, streakBonus, `🔥 ${streak} günlük seri bonusu`);
  }

  return { ...goal, currentValue: newValue, completed };
}

export async function getStreak(userProfileId: string): Promise<number> {
  const db = await getDatabase();
  const goals = await db.getAllAsync<{ date: string }>(
    "SELECT date FROM daily_goal WHERE userProfileId = ? AND completed = 1 ORDER BY date DESC",
    [userProfileId]
  );

  if (goals.length === 0) return 0;

  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  for (const goal of goals) {
    const goalDate = new Date(goal.date);
    goalDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((checkDate.getTime() - goalDate.getTime()) / 86400000);
    if (diffDays <= 1) {
      streak++;
      checkDate = goalDate;
    } else {
      break;
    }
  }
  return streak;
}

export async function checkAndAwardBadges(
  userProfileId: string,
  totalQuestionsAnswered: number,
  streak: number,
  sessionAccuracy: number,
  levelChanged: boolean,
  fastAnswer: boolean
): Promise<Badge[]> {
  const db = await getDatabase();
  const awarded: Badge[] = [];

  const alreadyAwarded = await db.getAllAsync<{ badgeId: string }>(
    'SELECT badgeId FROM badge_award WHERE userProfileId = ?',
    [userProfileId]
  );
  const awardedSet = new Set(alreadyAwarded.map(a => a.badgeId));

  const candidates: { key: string; condition: boolean }[] = [
    { key: 'first_session', condition: true },
    { key: 'streak_3', condition: streak >= 3 },
    { key: 'streak_7', condition: streak >= 7 },
    { key: 'perfect_session', condition: sessionAccuracy >= 1.0 },
    { key: 'speed_demon', condition: fastAnswer },
    { key: 'level_up', condition: levelChanged },
    { key: '100_questions', condition: totalQuestionsAnswered >= 100 },
  ];

  for (const candidate of candidates) {
    if (!candidate.condition) continue;
    const badge = await db.getFirstAsync<Badge>('SELECT * FROM badge WHERE key = ?', [candidate.key]);
    if (!badge) continue;
    if (awardedSet.has(badge.id)) continue;

    await db.runAsync(
      'INSERT INTO badge_award (id, userProfileId, badgeId, awardedAt) VALUES (?, ?, ?, ?)',
      [generateId(), userProfileId, badge.id, new Date().toISOString()]
    );
    awarded.push(badge);
  }

  return awarded;
}

export async function getAllBadges(): Promise<Badge[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Badge>('SELECT * FROM badge ORDER BY id');
}

export async function getUserBadges(userProfileId: string): Promise<(Badge & { awardedAt: string })[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Badge & { awardedAt: string }>(
    `SELECT b.*, ba.awardedAt FROM badge b
     JOIN badge_award ba ON b.id = ba.badgeId
     WHERE ba.userProfileId = ?
     ORDER BY ba.awardedAt DESC`,
    [userProfileId]
  );
}

export async function getTotalQuestionsAnswered(userProfileId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM answer_attempt aa
     JOIN session_question sq ON aa.sessionQuestionId = sq.id
     JOIN session s ON sq.sessionId = s.id
     WHERE s.userProfileId = ? AND aa.isCorrect = 1`,
    [userProfileId]
  );
  return result?.count ?? 0;
}
