export type AgeGroup = '4-6' | '7-9' | '10-12' | '13-17' | '18+';
export type OperationType = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed' | 'missing_number' | 'verify' | 'compare' | 'pattern';
export type DifficultyPreference = 'easy' | 'medium' | 'hard';
export type ThemeType = 'child' | 'teen' | 'adult';
export type PeriodType = 'daily' | 'weekly' | 'monthly';
export type RewardTransactionType = 'earned' | 'spent';
export type SessionMode = 'quick' | 'operation' | 'daily_goal' | 'times_table' | 'missing_number' | 'verify' | 'compare' | 'pattern';

export interface UserProfile {
  id: string;
  displayName: string;
  avatar: string;
  ageGroup: AgeGroup;
  startDifficultyPreference: DifficultyPreference;
  selectedTheme: ThemeType;
  createdAt: string;
  settingsJson: string;
}

export interface Skill {
  id: string;
  operationType: OperationType;
  topicType: string;
}

export interface SkillLevel {
  id: string;
  skillId: string;
  levelNo: number;
  expectedTimeMs: number;
  parametersJson: string;
  basePoint: number;
}

export interface Session {
  id: string;
  userProfileId: string;
  mode: SessionMode;
  startedAt: string;
  endedAt: string | null;
  completed: number; // 0 or 1
  pendingPoints: number;
  finalizedPoints: number;
}

export interface SessionQuestion {
  id: string;
  sessionId: string;
  skillId: string;
  levelNo: number;
  questionPayloadJson: string;
  correctAnswer: string;
  presentedAt: string;
}

export interface AnswerAttempt {
  id: string;
  sessionQuestionId: string;
  attemptNo: number;
  submittedAnswer: string;
  isCorrect: number; // 0 or 1
  responseTimeMs: number;
  usedHint: number; // 0 or 1
  awardedPoints: number;
}

export interface LevelProgress {
  id: string;
  userProfileId: string;
  skillId: string;
  currentLevel: number;
  rollingAccuracy: number;
  rollingMedianTimeMs: number;
  rollingScore: number;
  confidenceScore: number;
  lastEvaluatedAt: string;
}

export interface DailyGoal {
  id: string;
  userProfileId: string;
  date: string;
  goalType: 'questions' | 'time' | 'accuracy' | 'operation';
  targetValue: number;
  currentValue: number;
  completed: number; // 0 or 1
}

export interface RewardTransaction {
  id: string;
  userProfileId: string;
  type: RewardTransactionType;
  amount: number;
  description: string;
  createdByType: 'system' | 'parent';
  createdAt: string;
}

export interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  iconEmoji: string;
}

export interface BadgeAward {
  id: string;
  userProfileId: string;
  badgeId: string;
  awardedAt: string;
}

export interface PerformanceSnapshot {
  id: string;
  userProfileId: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  metricsJson: string;
}

export type QuestionType = 'arithmetic' | 'missing_number' | 'verify' | 'compare' | 'pattern';
export type MissingPosition = 'left' | 'right' | 'result';
export type CompareMode = 'greater' | 'lesser';

export interface QuestionPayload {
  operand1: number;
  operand2: number;
  operation: OperationType;
  answer: number;
  choices?: number[];
  // Extended question types
  questionType?: QuestionType;
  missingPosition?: MissingPosition;   // for missing_number
  isCorrectStatement?: boolean;         // for verify
  wrongAnswer?: number;                 // for verify: wrong answer shown in the statement
  patternSequence?: (number | null)[]; // for pattern: sequence with null at missing position
  patternStep?: number;                 // for pattern: common difference
  compareMode?: CompareMode;            // for compare
}

export interface SessionResult {
  sessionId: string;
  totalPoints: number;
  accuracy: number;
  avgResponseTimeMs: number;
  medianResponseTimeMs: number;
  strongArea: string | null;
  weakArea: string | null;
  levelChanges: LevelChange[];
  questionsAnswered: number;
  correctAnswers: number;
}

export interface LevelChange {
  skillId: string;
  operationType: OperationType;
  oldLevel: number;
  newLevel: number;
}

export interface SkillLevelParams {
  minNum: number;
  maxNum: number;
  digits: number;
  requiresCarry: boolean;
  requiresBorrow: boolean;
  hasRemainder: boolean;
}
