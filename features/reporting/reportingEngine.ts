import { getDatabase } from '../../shared/storage/database';
import { SessionResult, LevelChange, OperationType } from '../../shared/types';
import { OPERATION_LABELS } from '../../shared/lib/constants';
import { computeMedian } from '../scoring/scoringEngine';

export interface DailyMetrics {
  date: string;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  avgResponseTimeMs: number;
  totalPoints: number;
}

export interface OperationMetrics {
  operation: OperationType;
  label: string;
  accuracy: number;
  avgTimeMs: number;
  questionsAnswered: number;
  currentLevel: number;
}

export async function buildSessionResult(
  sessionId: string,
  userProfileId: string,
  levelChanges: LevelChange[]
): Promise<SessionResult> {
  const db = await getDatabase();

  const questions = await db.getAllAsync<{ id: string; skillId: string }>(
    'SELECT id, skillId FROM session_question WHERE sessionId = ?',
    [sessionId]
  );

  const attempts = await db.getAllAsync<{
    sessionQuestionId: string;
    isCorrect: number;
    responseTimeMs: number;
    awardedPoints: number;
    skillId: string;
  }>(
    `SELECT aa.sessionQuestionId, aa.isCorrect, aa.responseTimeMs, aa.awardedPoints, sq.skillId
     FROM answer_attempt aa
     JOIN session_question sq ON aa.sessionQuestionId = sq.id
     WHERE sq.sessionId = ?`,
    [sessionId]
  );

  const totalPoints = attempts.reduce((s, a) => s + a.awardedPoints, 0);
  const correctAnswers = attempts.filter(a => a.isCorrect === 1).length;
  const accuracy = attempts.length > 0 ? correctAnswers / attempts.length : 0;
  const times = attempts.map(a => a.responseTimeMs);
  const avgResponseTimeMs = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : 0;
  const medianResponseTimeMs = computeMedian(times);

  // Per-operation breakdown
  const opMap: Record<string, { correct: number; total: number }> = {};
  for (const attempt of attempts) {
    const op = attempt.skillId.replace('skill_', '');
    if (!opMap[op]) opMap[op] = { correct: 0, total: 0 };
    opMap[op].total++;
    if (attempt.isCorrect === 1) opMap[op].correct++;
  }

  let strongArea: string | null = null;
  let weakArea: string | null = null;
  let bestAcc = -1;
  let worstAcc = 2;

  for (const [op, data] of Object.entries(opMap)) {
    if (data.total < 2) continue;
    const acc = data.correct / data.total;
    if (acc > bestAcc) { bestAcc = acc; strongArea = OPERATION_LABELS[op] ?? op; }
    if (acc < worstAcc) { worstAcc = acc; weakArea = OPERATION_LABELS[op] ?? op; }
  }

  return {
    sessionId,
    totalPoints,
    accuracy,
    avgResponseTimeMs,
    medianResponseTimeMs,
    strongArea,
    weakArea,
    levelChanges,
    questionsAnswered: attempts.length,
    correctAnswers,
  };
}

export async function getDailyMetrics(userProfileId: string, days = 7): Promise<DailyMetrics[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    date: string;
    questionsAnswered: number;
    correctAnswers: number;
    totalPoints: number;
    avgTime: number;
  }>(
    `SELECT
       DATE(s.startedAt) as date,
       COUNT(aa.id) as questionsAnswered,
       SUM(aa.isCorrect) as correctAnswers,
       SUM(aa.awardedPoints) as totalPoints,
       AVG(aa.responseTimeMs) as avgTime
     FROM session s
     JOIN session_question sq ON sq.sessionId = s.id
     JOIN answer_attempt aa ON aa.sessionQuestionId = sq.id
     WHERE s.userProfileId = ? AND s.completed = 1
       AND DATE(s.startedAt) >= DATE('now', ?)
     GROUP BY DATE(s.startedAt)
     ORDER BY date DESC`,
    [userProfileId, `-${days} days`]
  );

  return rows.map(r => ({
    date: r.date,
    questionsAnswered: r.questionsAnswered,
    correctAnswers: r.correctAnswers,
    accuracy: r.questionsAnswered > 0 ? r.correctAnswers / r.questionsAnswered : 0,
    avgResponseTimeMs: r.avgTime ?? 0,
    totalPoints: r.totalPoints ?? 0,
  }));
}

export async function getOperationMetrics(userProfileId: string): Promise<OperationMetrics[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    skillId: string;
    questionsAnswered: number;
    correctAnswers: number;
    avgTime: number;
    currentLevel: number;
  }>(
    `SELECT
       sq.skillId,
       COUNT(aa.id) as questionsAnswered,
       SUM(aa.isCorrect) as correctAnswers,
       AVG(aa.responseTimeMs) as avgTime,
       COALESCE(lp.currentLevel, 1) as currentLevel
     FROM session s
     JOIN session_question sq ON sq.sessionId = s.id
     JOIN answer_attempt aa ON aa.sessionQuestionId = sq.id
     LEFT JOIN level_progress lp ON lp.userProfileId = s.userProfileId AND lp.skillId = sq.skillId
     WHERE s.userProfileId = ? AND s.completed = 1
     GROUP BY sq.skillId`,
    [userProfileId]
  );

  return rows.map(r => {
    const op = r.skillId.replace('skill_', '') as OperationType;
    return {
      operation: op,
      label: OPERATION_LABELS[op] ?? op,
      accuracy: r.questionsAnswered > 0 ? r.correctAnswers / r.questionsAnswered : 0,
      avgTimeMs: r.avgTime ?? 0,
      questionsAnswered: r.questionsAnswered,
      currentLevel: r.currentLevel,
    };
  });
}
