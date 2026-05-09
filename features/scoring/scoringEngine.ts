import { AgeGroup } from '../../shared/types';
import {
  MIN_SPEED_MULTIPLIER,
  MAX_SPEED_MULTIPLIER,
  MASTERY_DECAY_THRESHOLD,
  MASTERY_DECAY_MULTIPLIER,
} from '../../shared/lib/constants';

export interface ScoreInput {
  basePoint: number;
  levelNo: number;
  expectedTimeMs: number;
  responseTimeMs: number;
  isCorrect: boolean;
  isSecondAttempt: boolean;
  usedHint: boolean;
  ageGroup: AgeGroup;
  rollingAccuracy: number; // 0..1 for mastery decay check
}

export function calculateScore(input: ScoreInput): number {
  if (!input.isCorrect || input.isSecondAttempt || input.usedHint) {
    return 0;
  }

  const difficultyMultiplier = getDifficultyMultiplier(input.levelNo);
  const speedMultiplier = getSpeedMultiplier(input.responseTimeMs, input.expectedTimeMs);
  const masteryDecay = getMasteryDecay(input.rollingAccuracy, input.levelNo);

  const raw = input.basePoint * difficultyMultiplier * speedMultiplier * masteryDecay;
  return Math.round(raw);
}

function getDifficultyMultiplier(levelNo: number): number {
  // Level 1 = 1.0x, each level adds 0.25x
  return 1.0 + (levelNo - 1) * 0.25;
}

function getSpeedMultiplier(responseTimeMs: number, expectedTimeMs: number): number {
  if (expectedTimeMs <= 0) return 1.0;
  const ratio = responseTimeMs / expectedTimeMs;
  // Faster = higher multiplier, capped at MAX_SPEED_MULTIPLIER
  // Slower = lower multiplier, floored at MIN_SPEED_MULTIPLIER
  if (ratio <= 0.5) return MAX_SPEED_MULTIPLIER;
  if (ratio >= 2.0) return MIN_SPEED_MULTIPLIER;
  // Linear interpolation between the bounds
  const normalized = (ratio - 0.5) / 1.5; // 0..1 as ratio goes 0.5..2.0
  return MAX_SPEED_MULTIPLIER - normalized * (MAX_SPEED_MULTIPLIER - MIN_SPEED_MULTIPLIER);
}

function getMasteryDecay(rollingAccuracy: number, levelNo: number): number {
  // Only apply decay at lower levels when user is clearly too good
  if (levelNo <= 1 && rollingAccuracy >= MASTERY_DECAY_THRESHOLD) {
    return MASTERY_DECAY_MULTIPLIER;
  }
  return 1.0;
}

export function calculateAbandonPenalty(ageGroup: AgeGroup, levelNo: number): number {
  if (ageGroup === '4-6' || ageGroup === '7-9') return 0;
  if (levelNo >= 3) return -10;
  if (levelNo >= 2) return -5;
  return 0;
}

export function computeLiveScore(
  basePoint: number,
  levelNo: number,
  elapsedMs: number,
  expectedTimeMs: number,
  rollingAccuracy: number,
): number {
  const diff = getDifficultyMultiplier(levelNo);
  const speed = getSpeedMultiplier(elapsedMs, expectedTimeMs);
  const mastery = getMasteryDecay(rollingAccuracy, levelNo);
  return Math.max(1, Math.round(basePoint * diff * speed * mastery));
}

export function computeMaxScore(
  basePoint: number,
  levelNo: number,
  rollingAccuracy: number,
): number {
  const diff = getDifficultyMultiplier(levelNo);
  const mastery = getMasteryDecay(rollingAccuracy, levelNo);
  return Math.max(1, Math.round(basePoint * diff * MAX_SPEED_MULTIPLIER * mastery));
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeEWMA(previous: number, current: number, alpha = 0.3): number {
  return alpha * current + (1 - alpha) * previous;
}
