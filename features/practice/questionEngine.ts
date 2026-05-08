import { getDatabase } from '../../shared/storage/database';
import { QuestionPayload, OperationType, SkillLevelParams } from '../../shared/types';
import { AGE_GROUP_START_LEVEL, OPERATION_SYMBOLS } from '../../shared/lib/constants';
import { AgeGroup, DifficultyPreference } from '../../shared/types';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateWrongChoices(correct: number, count: number, min: number, max: number): number[] {
  const wrongs = new Set<number>();
  let attempts = 0;
  while (wrongs.size < count && attempts < 100) {
    attempts++;
    const delta = randInt(1, Math.max(5, Math.floor((max - min) * 0.2)));
    const sign = Math.random() < 0.5 ? 1 : -1;
    const candidate = Math.max(min, Math.min(max, correct + sign * delta));
    if (candidate !== correct && !wrongs.has(candidate)) {
      wrongs.add(candidate);
    }
  }
  // Fill with in-range fallbacks if needed
  let fallback = min;
  while (wrongs.size < count && fallback <= max) {
    if (fallback !== correct && !wrongs.has(fallback)) wrongs.add(fallback);
    fallback++;
  }
  // Last resort: go above max but still avoid negatives for young users
  fallback = max + 1;
  while (wrongs.size < count) {
    if (!wrongs.has(fallback)) wrongs.add(fallback);
    fallback++;
  }
  return Array.from(wrongs).slice(0, count);
}

export function generateQuestion(
  operation: OperationType,
  levelNo: number,
  paramsJson: string,
  useMultipleChoice: boolean
): QuestionPayload {
  const params: SkillLevelParams = JSON.parse(paramsJson);
  let operand1: number;
  let operand2: number;
  let answer: number;

  switch (operation) {
    case 'addition': {
      operand1 = randInt(params.minNum, params.maxNum);
      operand2 = randInt(params.minNum, params.maxNum);
      answer = operand1 + operand2;
      break;
    }
    case 'subtraction': {
      operand1 = randInt(params.minNum, params.maxNum);
      operand2 = randInt(params.minNum, operand1); // ensure non-negative result
      answer = operand1 - operand2;
      break;
    }
    case 'multiplication': {
      operand1 = randInt(params.minNum, params.maxNum);
      operand2 = randInt(params.minNum, params.maxNum);
      answer = operand1 * operand2;
      break;
    }
    case 'division': {
      if (params.hasRemainder) {
        // Remainder-based: operand1 is not necessarily divisible by operand2
        operand2 = randInt(Math.max(2, params.minNum), params.maxNum);
        operand1 = randInt(params.minNum * operand2, params.maxNum * operand2);
        // Ensure there actually IS a remainder
        if (operand1 % operand2 === 0 && operand1 > operand2) operand1 -= 1;
        answer = Math.floor(operand1 / operand2);
      } else {
        // Exact division: pick answer first, then multiply
        operand2 = randInt(Math.max(1, params.minNum), params.maxNum);
        answer = randInt(Math.max(1, params.minNum), params.maxNum);
        operand1 = operand2 * answer;
      }
      break;
    }
    default: {
      operand1 = randInt(1, 10);
      operand2 = randInt(1, 10);
      answer = operand1 + operand2;
    }
  }

  if (useMultipleChoice) {
    const maxPossible = operation === 'addition'
      ? params.maxNum * 2
      : operation === 'multiplication' || operation === 'division'
      ? params.maxNum * params.maxNum
      : params.maxNum;
    const wrongs = generateWrongChoices(answer, 3, 0, maxPossible);
    const choices = shuffle([answer, ...wrongs]);
    return { operand1, operand2, operation, answer, choices };
  }

  return { operand1, operand2, operation, answer };
}

export function getOperationSymbol(operation: OperationType): string {
  return OPERATION_SYMBOLS[operation] || '+';
}

export async function getSkillIdForOperation(operation: OperationType): Promise<string> {
  return `skill_${operation}`;
}

export async function getLevelParams(skillId: string, levelNo: number): Promise<{ expectedTimeMs: number; parametersJson: string; basePoint: number } | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<{ expectedTimeMs: number; parametersJson: string; basePoint: number }>(
    'SELECT expectedTimeMs, parametersJson, basePoint FROM skill_level WHERE skillId = ? AND levelNo = ?',
    [skillId, levelNo]
  );
}

export function shouldUseMultipleChoice(levelNo: number, ageGroup: AgeGroup): boolean {
  if (ageGroup === '4-6') return true;
  if (ageGroup === '7-9') return levelNo <= 2;
  return levelNo <= 1;
}

export function getStartLevel(ageGroup: AgeGroup, preference: DifficultyPreference): number {
  return AGE_GROUP_START_LEVEL[ageGroup][preference];
}
