import { getDatabase } from '../../shared/storage/database';
import { LevelProgress } from '../../shared/types';
import {
  ROLLING_WINDOW,
  LEVEL_UP_ACCURACY_THRESHOLD,
  LEVEL_UP_SPEED_RATIO,
  LEVEL_DOWN_ACCURACY_THRESHOLD,
  MIN_QUESTIONS_FOR_EVALUATION,
} from '../../shared/lib/constants';
import { computeMedian, computeEWMA } from '../scoring/scoringEngine';

const MAX_LEVEL = 5;
const MIN_LEVEL = 1;

export async function getOrCreateLevelProgress(
  userProfileId: string,
  skillId: string,
  startLevel: number
): Promise<LevelProgress> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<LevelProgress>(
    'SELECT * FROM level_progress WHERE userProfileId = ? AND skillId = ?',
    [userProfileId, skillId]
  );
  if (existing) return existing;

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO level_progress (id, userProfileId, skillId, currentLevel, rollingAccuracy, rollingMedianTimeMs, rollingScore, confidenceScore, lastEvaluatedAt)
     VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?)`,
    [id, userProfileId, skillId, startLevel, now]
  );
  return { id, userProfileId, skillId, currentLevel: startLevel, rollingAccuracy: 0, rollingMedianTimeMs: 0, rollingScore: 0, confidenceScore: 0, lastEvaluatedAt: now };
}

export async function updateLevelProgressAfterAnswer(
  userProfileId: string,
  skillId: string,
  isCorrect: boolean,
  responseTimeMs: number
): Promise<{ newLevel: number; levelChanged: boolean; oldLevel: number }> {
  const db = await getDatabase();
  const progress = await db.getFirstAsync<LevelProgress>(
    'SELECT * FROM level_progress WHERE userProfileId = ? AND skillId = ?',
    [userProfileId, skillId]
  );
  if (!progress) return { newLevel: 1, levelChanged: false, oldLevel: 1 };

  // Get last ROLLING_WINDOW attempts for this skill
  const attempts = await db.getAllAsync<{ isCorrect: number; responseTimeMs: number }>(
    `SELECT aa.isCorrect, aa.responseTimeMs
     FROM answer_attempt aa
     JOIN session_question sq ON aa.sessionQuestionId = sq.id
     JOIN session s ON sq.sessionId = s.id
     WHERE s.userProfileId = ? AND sq.skillId = ?
     ORDER BY aa.rowid DESC
     LIMIT ?`,
    [userProfileId, skillId, ROLLING_WINDOW]
  );

  if (attempts.length < MIN_QUESTIONS_FOR_EVALUATION) {
    // Update EWMA but don't make level decisions yet
    const newAccuracy = computeEWMA(progress.rollingAccuracy, isCorrect ? 1 : 0);
    const newMedian = computeEWMA(progress.rollingMedianTimeMs, responseTimeMs);
    await db.runAsync(
      'UPDATE level_progress SET rollingAccuracy = ?, rollingMedianTimeMs = ?, lastEvaluatedAt = ? WHERE id = ?',
      [newAccuracy, newMedian, new Date().toISOString(), progress.id]
    );
    return { newLevel: progress.currentLevel, levelChanged: false, oldLevel: progress.currentLevel };
  }

  const correctCount = attempts.filter(a => a.isCorrect === 1).length;
  const accuracy = correctCount / attempts.length;
  const times = attempts.map(a => a.responseTimeMs);
  const medianTime = computeMedian(times);
  const newEWMA = computeEWMA(progress.rollingMedianTimeMs, responseTimeMs);

  const oldLevel = progress.currentLevel;
  let newLevel = oldLevel;

  // Get expected time for current level
  const levelInfo = await db.getFirstAsync<{ expectedTimeMs: number }>(
    'SELECT expectedTimeMs FROM skill_level WHERE skillId = ? AND levelNo = ?',
    [skillId, oldLevel]
  );
  const expectedTime = levelInfo?.expectedTimeMs ?? 15000;

  // Level up: high accuracy AND fast enough AND not already max
  const canLevelUp = oldLevel < MAX_LEVEL;
  if (
    canLevelUp &&
    accuracy >= LEVEL_UP_ACCURACY_THRESHOLD &&
    medianTime <= expectedTime * LEVEL_UP_SPEED_RATIO
  ) {
    newLevel = Math.min(oldLevel + 1, MAX_LEVEL);
  }
  // Level down: poor accuracy AND not already min (hysteresis: lower threshold)
  else if (
    oldLevel > MIN_LEVEL &&
    accuracy < LEVEL_DOWN_ACCURACY_THRESHOLD
  ) {
    newLevel = Math.max(oldLevel - 1, MIN_LEVEL);
  }

  await db.runAsync(
    `UPDATE level_progress
     SET currentLevel = ?, rollingAccuracy = ?, rollingMedianTimeMs = ?, lastEvaluatedAt = ?
     WHERE id = ?`,
    [newLevel, accuracy, newEWMA, new Date().toISOString(), progress.id]
  );

  return { newLevel, levelChanged: newLevel !== oldLevel, oldLevel };
}

export async function getLevelProgress(userProfileId: string, skillId: string): Promise<LevelProgress | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<LevelProgress>(
    'SELECT * FROM level_progress WHERE userProfileId = ? AND skillId = ?',
    [userProfileId, skillId]
  );
}
