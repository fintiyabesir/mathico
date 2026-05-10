/**
 * ScreenTimeActivityLogService
 *
 * Persists Screen Time redemption events per day (AsyncStorage) and
 * queries today's answered math questions from SQLite so the parent
 * can see exactly what the child did to earn/spend screen time.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../../shared/storage/database';
import { QuestionPayload } from '../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** One redemption event stored when child exchanges points for screen time. */
export interface ScreenTimeRedemptionLog {
  id: string;
  redeemedAt: string;       // ISO-8601
  pointsSpent: number;
  minutesGranted: number;
  targetDisplayName: string;
  expiresAt: string;        // ISO-8601
}

/** One answered math question from today's SQLite session records. */
export interface TodayAnsweredQuestion {
  operand1: number;
  operand2: number;
  operation: string;         // 'addition' | 'subtraction' | 'multiplication' | 'division'
  correctAnswer: number;
  submittedAnswer: string;
  isCorrect: boolean;
  responseTimeMs: number;
  awardedPoints: number;
  answeredAt: string;        // ISO-8601 (sq.presentedAt)
}

// ─────────────────────────────────────────────────────────────────────────────
// Redemption log — AsyncStorage
// ─────────────────────────────────────────────────────────────────────────────

const LOG_KEY_PREFIX = 'mathico_st_activity_log_';

function todayLogKey(profileId: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${LOG_KEY_PREFIX}${profileId}_${today}`;
}

export async function logRedemption(
  profileId: string,
  entry: ScreenTimeRedemptionLog,
): Promise<void> {
  try {
    const key = todayLogKey(profileId);
    const raw = await AsyncStorage.getItem(key);
    const existing: ScreenTimeRedemptionLog[] = raw ? JSON.parse(raw) : [];
    existing.push(entry);
    await AsyncStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // non-fatal — logging should never block the redemption flow
  }
}

export async function getTodayRedemptionLogs(
  profileId: string,
): Promise<ScreenTimeRedemptionLog[]> {
  try {
    const raw = await AsyncStorage.getItem(todayLogKey(profileId));
    return raw ? (JSON.parse(raw) as ScreenTimeRedemptionLog[]) : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Today's answered questions — SQLite
// ─────────────────────────────────────────────────────────────────────────────

interface RawQuestionRow {
  questionPayloadJson: string;
  correctAnswer: string;
  presentedAt: string;
  submittedAnswer: string;
  isCorrect: number;
  responseTimeMs: number;
  awardedPoints: number;
}

export async function getTodayAnsweredQuestions(
  profileId: string,
): Promise<TodayAnsweredQuestion[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<RawQuestionRow>(
      `SELECT
        sq.questionPayloadJson,
        sq.correctAnswer,
        sq.presentedAt,
        aa.submittedAnswer,
        aa.isCorrect,
        aa.responseTimeMs,
        aa.awardedPoints
       FROM session s
       JOIN session_question sq ON sq.sessionId = s.id
       JOIN answer_attempt aa ON aa.sessionQuestionId = sq.id
       WHERE s.userProfileId = ?
         AND date(s.startedAt) = date('now', 'localtime')
         AND aa.attemptNo = 1
       ORDER BY sq.presentedAt ASC`,
      [profileId],
    );

    return rows.map((row) => {
      const payload = JSON.parse(row.questionPayloadJson) as QuestionPayload;
      return {
        operand1: payload.operand1,
        operand2: payload.operand2,
        operation: payload.operation,
        correctAnswer: payload.answer,
        submittedAnswer: row.submittedAnswer,
        isCorrect: row.isCorrect === 1,
        responseTimeMs: row.responseTimeMs,
        awardedPoints: row.awardedPoints,
        answeredAt: row.presentedAt,
      };
    });
  } catch {
    return [];
  }
}
