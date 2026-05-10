/**
 * Extended question generators for new question types:
 *   - missing_number: "7 + __ = 12"
 *   - verify:         "8 × 7 = 54 — Doğru mu?"
 *   - compare:        "Hangisi büyük? 47 mi 74 mü?"
 *   - pattern:        "2, 4, 6, __, 10"
 *   - times_table:    fixed-operand multiplication drill
 */

import { QuestionPayload, OperationType } from '../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers (duplicated locally to avoid circular imports)
// ─────────────────────────────────────────────────────────────────────────────

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

function generateWrongChoices(
  correct: number,
  count: number,
  min: number,
  max: number,
): number[] {
  const wrongs = new Set<number>();
  let attempts = 0;
  while (wrongs.size < count && attempts < 100) {
    attempts++;
    const delta = randInt(1, Math.max(5, Math.floor((max - min) * 0.2)));
    const sign = Math.random() < 0.5 ? 1 : -1;
    const candidate = Math.max(min, Math.min(max, correct + sign * delta));
    if (candidate !== correct && !wrongs.has(candidate)) wrongs.add(candidate);
  }
  let fallback = Math.max(0, min);
  while (wrongs.size < count && fallback <= max + 20) {
    if (fallback !== correct && !wrongs.has(fallback)) wrongs.add(fallback);
    fallback++;
  }
  return Array.from(wrongs).slice(0, count);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Missing number  ("7 + __ = 12")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates an arithmetic question where one of the three positions is hidden.
 * @param operation  underlying arithmetic operation (not 'mixed')
 * @param levelNo    1-3
 * @param useMultipleChoice
 */
export function generateMissingNumberQuestion(
  operation: OperationType,
  levelNo: number,
  useMultipleChoice: boolean,
): QuestionPayload {
  const maxNum = levelNo === 1 ? 9 : levelNo === 2 ? 20 : 50;

  let a: number, b: number, result: number;

  switch (operation) {
    case 'subtraction': {
      a = randInt(2, maxNum);
      b = randInt(1, Math.max(1, a - 1));
      result = a - b;
      break;
    }
    case 'multiplication': {
      const cap = Math.min(9, maxNum);
      a = randInt(2, cap);
      b = randInt(2, cap);
      result = a * b;
      break;
    }
    case 'division': {
      b = randInt(2, Math.min(9, maxNum));
      result = randInt(2, Math.min(9, maxNum));
      a = b * result;
      break;
    }
    default: {
      // addition
      a = randInt(1, maxNum);
      b = randInt(1, maxNum);
      result = a + b;
    }
  }

  // Level 1: only hide right operand or result (easier)
  // Level 2+: any position
  const positions: Array<'left' | 'right' | 'result'> =
    levelNo === 1 ? ['right', 'result'] : ['left', 'right', 'result'];
  const missingPosition = positions[Math.floor(Math.random() * positions.length)];

  const missingValue =
    missingPosition === 'left' ? a : missingPosition === 'right' ? b : result;
  const maxPossible = Math.max(result, a, b) + 10;

  if (useMultipleChoice) {
    const wrongs = generateWrongChoices(missingValue, 3, 0, maxPossible);
    const choices = shuffle([missingValue, ...wrongs]);
    return {
      operand1: a,
      operand2: b,
      operation,
      answer: missingValue,
      choices,
      questionType: 'missing_number',
      missingPosition,
    };
  }

  return {
    operand1: a,
    operand2: b,
    operation,
    answer: missingValue,
    questionType: 'missing_number',
    missingPosition,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Verify  ("8 × 7 = 54 — Doğru mu?")
// ─────────────────────────────────────────────────────────────────────────────

export function generateVerifyQuestion(levelNo: number): QuestionPayload {
  const maxNum = levelNo === 1 ? 9 : levelNo === 2 ? 20 : 50;
  const ops: OperationType[] = ['addition', 'subtraction', 'multiplication'];
  const operation = ops[Math.floor(Math.random() * ops.length)];

  let a: number, b: number, correct: number;

  switch (operation) {
    case 'subtraction': {
      a = randInt(2, maxNum);
      b = randInt(1, Math.max(1, a - 1));
      correct = a - b;
      break;
    }
    case 'multiplication': {
      const cap = Math.min(9, maxNum);
      a = randInt(2, cap);
      b = randInt(2, cap);
      correct = a * b;
      break;
    }
    default: {
      a = randInt(1, maxNum);
      b = randInt(1, maxNum);
      correct = a + b;
    }
  }

  const isCorrectStatement = Math.random() < 0.5;
  let wrongAnswer: number | undefined;

  if (!isCorrectStatement) {
    const delta = randInt(1, Math.max(3, Math.ceil(correct * 0.25)));
    const sign = Math.random() < 0.5 ? 1 : -1;
    wrongAnswer = Math.max(0, correct + sign * delta);
    if (wrongAnswer === correct) wrongAnswer = correct + 1;
  }

  return {
    operand1: a,
    operand2: b,
    operation,
    answer: isCorrectStatement ? 1 : 0, // 1 = Doğru, 0 = Yanlış
    choices: [1, 0],                    // rendered as "Doğru" / "Yanlış" in UI
    questionType: 'verify',
    isCorrectStatement,
    wrongAnswer,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Compare  ("Hangisi büyük? 47 mi 74 mü?")
// ─────────────────────────────────────────────────────────────────────────────

export function generateCompareQuestion(levelNo: number): QuestionPayload {
  const [min, max] =
    levelNo === 1 ? [10, 99] : levelNo === 2 ? [10, 999] : [100, 9999];

  let num1: number, num2: number;
  do {
    num1 = randInt(min, max);
    num2 = randInt(min, max);
  } while (num1 === num2);

  const compareMode: 'greater' | 'lesser' = Math.random() < 0.65 ? 'greater' : 'lesser';
  const answer = compareMode === 'greater' ? Math.max(num1, num2) : Math.min(num1, num2);

  return {
    operand1: num1,
    operand2: num2,
    operation: 'compare',
    answer,
    choices: shuffle([num1, num2]),
    questionType: 'compare',
    compareMode,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pattern  ("2, 4, 6, __, 10")
// ─────────────────────────────────────────────────────────────────────────────

export function generatePatternQuestion(
  levelNo: number,
  useMultipleChoice: boolean,
): QuestionPayload {
  const maxStep = levelNo === 1 ? 5 : levelNo === 2 ? 10 : 25;
  const maxStart = levelNo === 1 ? 20 : levelNo === 2 ? 50 : 100;
  const length = 5;

  const a = randInt(1, maxStart);
  const d = randInt(2, maxStep);
  const seq: number[] = Array.from({ length }, (_, i) => a + d * i);

  // Don't remove first element (too easy) — pick index 1..length-1
  const missingIdx = randInt(1, length - 1);
  const missingValue = seq[missingIdx];
  const patternSequence: (number | null)[] = seq.map((v, i) =>
    i === missingIdx ? null : v,
  );

  const maxPossible = seq[length - 1] + maxStep;

  if (useMultipleChoice) {
    const wrongs = generateWrongChoices(missingValue, 3, a, maxPossible);
    const choices = shuffle([missingValue, ...wrongs]);
    return {
      operand1: a,
      operand2: d,
      operation: 'pattern',
      answer: missingValue,
      choices,
      questionType: 'pattern',
      patternSequence,
      patternStep: d,
    };
  }

  return {
    operand1: a,
    operand2: d,
    operation: 'pattern',
    answer: missingValue,
    questionType: 'pattern',
    patternSequence,
    patternStep: d,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Times table  ("7 × __ = 42")
// ─────────────────────────────────────────────────────────────────────────────

export function generateTimesTableQuestion(
  tableNumber: number,
  useMultipleChoice: boolean,
): QuestionPayload {
  const n = randInt(1, 12);
  const answer = tableNumber * n;

  if (useMultipleChoice) {
    const wrongs = generateWrongChoices(answer, 3, 1, 144);
    const choices = shuffle([answer, ...wrongs]);
    return { operand1: tableNumber, operand2: n, operation: 'multiplication', answer, choices };
  }

  return { operand1: tableNumber, operand2: n, operation: 'multiplication', answer };
}
