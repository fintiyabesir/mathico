import { AgeGroup, ThemeType } from '../types';

export const AVATARS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐙', '🦋', '🐬', '🦄'];

export const AGE_GROUP_DEFAULT_THEME: Record<AgeGroup, ThemeType> = {
  '4-6': 'child',
  '7-9': 'child',
  '10-12': 'teen',
  '13-17': 'teen',
  '18+': 'adult',
};

export const AGE_GROUP_START_LEVEL: Record<AgeGroup, { easy: number; medium: number; hard: number }> = {
  '4-6':   { easy: 1, medium: 1, hard: 2 },
  '7-9':   { easy: 1, medium: 2, hard: 3 },
  '10-12': { easy: 2, medium: 3, hard: 4 },
  '13-17': { easy: 2, medium: 3, hard: 4 },
  '18+':   { easy: 3, medium: 4, hard: 5 },
};

export const AGE_SECOND_CHANCE: Record<AgeGroup, boolean> = {
  '4-6': true,
  '7-9': true,
  '10-12': false,
  '13-17': false,
  '18+': false,
};

export const AGE_ABANDON_PENALTY: Record<AgeGroup, boolean> = {
  '4-6': false,
  '7-9': false,
  '10-12': true,
  '13-17': true,
  '18+': true,
};

// Scoring constants
export const MIN_SPEED_MULTIPLIER = 0.5;
export const MAX_SPEED_MULTIPLIER = 2.0;
export const ABANDON_PENALTY_POINTS = -5;

// Progression constants
export const ROLLING_WINDOW = 20;
export const LEVEL_UP_ACCURACY_THRESHOLD = 0.85;
export const LEVEL_UP_SPEED_RATIO = 0.75; // must be 75% of expected time or better
export const LEVEL_DOWN_ACCURACY_THRESHOLD = 0.50;
export const MIN_QUESTIONS_FOR_EVALUATION = 10;

// Mastery decay multiplier (when user is over-skilled at a level)
export const MASTERY_DECAY_THRESHOLD = 0.95; // 95% accuracy at this level
export const MASTERY_DECAY_MULTIPLIER = 0.5;

// Session constants
export const SESSION_QUESTION_COUNT: Record<AgeGroup, number> = {
  '4-6':   10,
  '7-9':   12,
  '10-12': 15,
  '13-17': 15,
  '18+':   20,
};

// Daily goal defaults
export const DAILY_GOAL_QUESTION_COUNT: Record<AgeGroup, number> = {
  '4-6':   10,
  '7-9':   15,
  '10-12': 20,
  '13-17': 25,
  '18+':   30,
};

export const OPERATION_LABELS: Record<string, string> = {
  addition: 'Toplama',
  subtraction: 'Çıkarma',
  multiplication: 'Çarpma',
  division: 'Bölme',
  mixed: 'Karışık',
};

export const OPERATION_SYMBOLS: Record<string, string> = {
  addition: '+',
  subtraction: '-',
  multiplication: '×',
  division: '÷',
};
