import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, BackHandler, useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useAppContext } from '../context/AppContext';
import { getDatabase } from '../../shared/storage/database';
import {
  generateQuestion, getSkillIdForOperation, getLevelParams, shouldUseMultipleChoice
} from '../../features/practice/questionEngine';
import {
  generateMissingNumberQuestion,
  generateVerifyQuestion,
  generateCompareQuestion,
  generatePatternQuestion,
  generateTimesTableQuestion,
} from '../../features/practice/extendedGenerators';
import { calculateScore, calculateAbandonPenalty, computeLiveScore, computeMaxScore } from '../../features/scoring/scoringEngine';
import { getOrCreateLevelProgress, updateLevelProgressAfterAnswer } from '../../features/progression/progressionEngine';
import { addPoints, spendPoints } from '../../features/rewards-wallet/rewardsWallet';
import { incrementDailyGoal } from '../../features/gamification/gamificationEngine';
import { QuestionPayload, OperationType, LevelChange } from '../../shared/types';
import { SESSION_QUESTION_COUNT, OPERATION_LABELS, AGE_SECOND_CHANCE } from '../../shared/lib/constants';
import NumericPad from '../../shared/ui/NumericPad';
import MultipleChoice from '../../shared/ui/MultipleChoice';
import { AppTheme } from '../../shared/ui/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Session'>;
  route: RouteProp<RootStackParamList, 'Session'>;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const OPERATIONS: OperationType[] = ['addition', 'subtraction', 'multiplication', 'division'];

function pickOperation(mode: string, requestedOp: OperationType): OperationType {
  if (mode === 'quick' || requestedOp === 'mixed') {
    return OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)];
  }
  return requestedOp;
}

export default function SessionScreen({ navigation, route }: Props) {
  const { mode, operation } = route.params;
  const { activeProfile, theme } = useAppContext();

  const [sessionId] = useState(generateId());
  const [currentQ, setCurrentQ] = useState(0);
  const [totalQ] = useState(SESSION_QUESTION_COUNT[activeProfile?.ageGroup ?? '7-9'] as number);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [pendingPoints, setPendingPoints] = useState(0);
  const [levelChanges, setLevelChanges] = useState<LevelChange[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [currentSkillId, setCurrentSkillId] = useState('skill_addition');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentLevelParams, setCurrentLevelParams] = useState<{ expectedTimeMs: number; basePoint: number; parametersJson: string } | null>(null);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | undefined>(undefined);
  const [canSecondChance, setCanSecondChance] = useState(false);
  const [usedSecondChance, setUsedSecondChance] = useState(false);
  const [currentQuestionDbId, setCurrentQuestionDbId] = useState<string | null>(null);
  const [liveScore, setLiveScore] = useState(0);
  const [rollingAccuracy, setRollingAccuracy] = useState(0.5);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveScoreTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initSession();
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      if (liveScoreTimer.current) clearInterval(liveScoreTimer.current);
    };
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleAbandon();
      return true;
    });
    return () => backHandler.remove();
  }, [pendingPoints]);

  async function initSession() {
    if (!activeProfile) return;
    try {
      const db = await getDatabase();
      await db.runAsync(
        'INSERT INTO session (id, userProfileId, mode, startedAt, completed, pendingPoints, finalizedPoints) VALUES (?, ?, ?, ?, 0, 0, 0)',
        [sessionId, activeProfile.id, mode, new Date().toISOString()]
      );
      await loadNextQuestion(0);
    } catch (e) {
      Alert.alert('Hata', `Seans başlatılamadı: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function loadNextQuestion(qIndex: number) {
    if (!activeProfile) return;

    // Determine skill and arithmetic operation for this question
    let skillId: string;
    let op: OperationType;
    const arithmeticOps: OperationType[] = ['addition', 'subtraction', 'multiplication', 'division'];

    if (mode === 'times_table') {
      op = 'multiplication';
      skillId = 'skill_multiplication';
    } else if (mode === 'missing_number') {
      op = (operation === 'mixed' || !arithmeticOps.includes(operation))
        ? arithmeticOps[Math.floor(Math.random() * arithmeticOps.length)]
        : operation;
      skillId = 'skill_missing_number';
    } else if (mode === 'verify' || mode === 'compare' || mode === 'pattern') {
      op = mode as OperationType;
      skillId = `skill_${mode}`;
    } else {
      op = pickOperation(mode, operation);
      skillId = await getSkillIdForOperation(op);
    }

    const progress = await getOrCreateLevelProgress(activeProfile.id, skillId, 1);
    const level = progress.currentLevel;
    const levelInfo = await getLevelParams(skillId, level)
      ?? { expectedTimeMs: 10000, basePoint: 10, parametersJson: '{}' };

    const useMulti = shouldUseMultipleChoice(level, activeProfile.ageGroup);

    let q: QuestionPayload;
    if (mode === 'times_table') {
      q = generateTimesTableQuestion(route.params.tableNumber ?? 2, useMulti);
    } else if (mode === 'missing_number') {
      q = generateMissingNumberQuestion(op, level, useMulti);
    } else if (mode === 'verify') {
      q = generateVerifyQuestion(level);
    } else if (mode === 'compare') {
      q = generateCompareQuestion(level);
    } else if (mode === 'pattern') {
      q = generatePatternQuestion(level, useMulti);
    } else {
      q = generateQuestion(op, level, levelInfo.parametersJson, useMulti);
    }

    // verify and compare always use their own choices
    const effectiveMultipleChoice =
      useMulti || q.questionType === 'verify' || q.questionType === 'compare';

    // Persist question to DB
    const questionDbId = generateId();
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO session_question (id, sessionId, skillId, levelNo, questionPayloadJson, correctAnswer, presentedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [questionDbId, sessionId, skillId, level, JSON.stringify(q), String(q.answer), new Date().toISOString()]
    );

    setCurrentSkillId(skillId);
    setCurrentLevel(level);
    setCurrentLevelParams(levelInfo);
    setIsMultipleChoice(effectiveMultipleChoice);
    setQuestion(q);
    setInputValue('');
    setSelectedAnswer(undefined);
    setFeedback(null);
    setUsedSecondChance(false);
    setCanSecondChance(AGE_SECOND_CHANCE[activeProfile.ageGroup as keyof typeof AGE_SECOND_CHANCE] ?? false);
    setQuestionStartTime(Date.now());
    setCurrentQuestionDbId(questionDbId);
    setCurrentQ(qIndex);

    // Start live score ticker
    setRollingAccuracy(progress.rollingAccuracy);
    const initScore = computeMaxScore(levelInfo.basePoint, level, progress.rollingAccuracy);
    setLiveScore(initScore);
    if (liveScoreTimer.current) clearInterval(liveScoreTimer.current);
    const _startTime = Date.now();
    const _basePoint = levelInfo.basePoint;
    const _expectedTimeMs = levelInfo.expectedTimeMs;
    const _level = level;
    const _ra = progress.rollingAccuracy;
    liveScoreTimer.current = setInterval(() => {
      const elapsed = Date.now() - _startTime;
      setLiveScore(computeLiveScore(_basePoint, _level, elapsed, _expectedTimeMs, _ra));
    }, 100);
  }

  async function submitAnswer(answer: string) {
    if (!activeProfile || !question || !currentLevelParams || !currentQuestionDbId) return;
    if (feedback !== null) return;

    if (liveScoreTimer.current) {
      clearInterval(liveScoreTimer.current);
      liveScoreTimer.current = null;
    }

    const responseTimeMs = Date.now() - questionStartTime;
    const isCorrect = answer.trim() === String(question.answer);

    // Get rolling accuracy for scoring
    const progress = await getOrCreateLevelProgress(activeProfile.id, currentSkillId, 1);
    const score = calculateScore({
      basePoint: currentLevelParams.basePoint,
      levelNo: currentLevel,
      expectedTimeMs: currentLevelParams.expectedTimeMs,
      responseTimeMs,
      isCorrect,
      isSecondAttempt: usedSecondChance,
      usedHint: false,
      ageGroup: activeProfile.ageGroup,
      rollingAccuracy: progress.rollingAccuracy,
    });

    // Persist attempt
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO answer_attempt (id, sessionQuestionId, attemptNo, submittedAnswer, isCorrect, responseTimeMs, usedHint, awardedPoints) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
      [generateId(), currentQuestionDbId, usedSecondChance ? 2 : 1, answer, isCorrect ? 1 : 0, responseTimeMs, score]
    );

    if (!isCorrect && canSecondChance && !usedSecondChance) {
      // Give second chance for young users
      setFeedback('incorrect');
      setSelectedAnswer(answer);
      setUsedSecondChance(true);
      feedbackTimeout.current = setTimeout(() => {
        setFeedback(null);
        setSelectedAnswer(undefined);
        setInputValue('');
      }, 1200);
      return;
    }

    // Update progression
    const levelResult = await updateLevelProgressAfterAnswer(activeProfile.id, currentSkillId, isCorrect, responseTimeMs);
    if (levelResult.levelChanged) {
      setLevelChanges(prev => [...prev, {
        skillId: currentSkillId,
        operationType: currentSkillId.replace('skill_', '') as OperationType,
        oldLevel: levelResult.oldLevel,
        newLevel: levelResult.newLevel,
      }]);
    }

    // Update pending points
    const newPending = pendingPoints + score;
    setPendingPoints(newPending);
    await db.runAsync('UPDATE session SET pendingPoints = ? WHERE id = ?', [newPending, sessionId]);

    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setSelectedAnswer(answer);

    feedbackTimeout.current = setTimeout(async () => {
      const nextQ = currentQ + 1;
      if (nextQ >= totalQ) {
        await completeSession(newPending);
      } else {
        await loadNextQuestion(nextQ);
      }
    }, 800);
  }

  async function completeSession(finalPoints: number) {
    if (!activeProfile) return;
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE session SET completed = 1, endedAt = ?, finalizedPoints = ? WHERE id = ?',
      [new Date().toISOString(), finalPoints, sessionId]
    );
    await addPoints(activeProfile.id, finalPoints, 'Seans tamamlandı');
    await incrementDailyGoal(activeProfile.id, totalQ);

    navigation.replace('SessionEnd', {
      sessionId,
      userProfileId: activeProfile.id,
      totalPoints: finalPoints,
      levelChanges,
    });
  }

  async function handleAbandon() {
    Alert.alert(
      'Seanstan Çık?',
      'Seansı tamamlamadan çıkarsan puanların kesinleşmez.',
      [
        { text: 'Devam Et', style: 'cancel' },
        {
          text: 'Çık',
          style: 'destructive',
          onPress: async () => {
            if (!activeProfile) return;
            const db = await getDatabase();
            const penalty = calculateAbandonPenalty(activeProfile.ageGroup, currentLevel);
            await db.runAsync(
              'UPDATE session SET completed = 0, endedAt = ?, finalizedPoints = ? WHERE id = ?',
              [new Date().toISOString(), penalty, sessionId]
            );
            if (penalty < 0 && activeProfile) {
              await spendPoints(activeProfile.id, Math.abs(penalty), 'Seans terk edildi');
            }
            navigation.goBack();
          }
        }
      ]
    );
  }

  const s = styles(theme);
  const { height: windowHeight } = useWindowDimensions();

  if (!question) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingContainer}>
          <Text style={s.loadingText}>Sorular hazırlanıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const opSymbols: Record<string, string> = { addition: '+', subtraction: '−', multiplication: '×', division: '÷' };
  const opSymbol = opSymbols[question.operation] ?? '+';

  // ── Helpers for extended question types ──────────────────────────────────

  function computeEquationResult(a: number, b: number, op: string): number {
    switch (op) {
      case 'addition':       return a + b;
      case 'subtraction':    return a - b;
      case 'multiplication': return a * b;
      case 'division':       return Math.floor(a / b);
      default:               return 0;
    }
  }

  function getOperationLabel(): string {
    if (question.questionType === 'compare') {
      return question.compareMode === 'greater' ? 'Hangisi büyük?' : 'Hangisi küçük?';
    }
    if (mode === 'times_table') {
      return `${route.params.tableNumber ?? '?'}× Tablosu`;
    }
    return OPERATION_LABELS[question.operation] ?? question.operation;
  }

  function getQuestionText(): string {
    switch (question.questionType) {
      case 'missing_number': {
        const full = computeEquationResult(question.operand1, question.operand2, question.operation);
        const left  = question.missingPosition === 'left'   ? '?' : String(question.operand1);
        const right = question.missingPosition === 'right'  ? '?' : String(question.operand2);
        const res   = question.missingPosition === 'result' ? '?' : String(full);
        return `${left} ${opSymbol} ${right} = ${res}`;
      }
      case 'verify': {
        const shown = question.isCorrectStatement
          ? computeEquationResult(question.operand1, question.operand2, question.operation)
          : question.wrongAnswer!;
        return `${question.operand1} ${opSymbol} ${question.operand2} = ${shown}`;
      }
      case 'compare':
        return `${question.operand1}   vs   ${question.operand2}`;
      case 'pattern':
        return (question.patternSequence ?? [])
          .map((v) => (v === null ? '?' : String(v)))
          .join(',  ');
      default:
        return `${question.operand1} ${opSymbol} ${question.operand2} = ?`;
    }
  }

  const maxPossibleScore = currentLevelParams
    ? computeMaxScore(currentLevelParams.basePoint, currentLevel, rollingAccuracy)
    : 1;
  const liveScorePercent = maxPossibleScore > 0
    ? Math.round((liveScore / maxPossibleScore) * 100)
    : 100;
  const liveScoreColor = liveScorePercent > 65
    ? theme.colors.correct
    : liveScorePercent > 35
    ? theme.colors.warning
    : theme.colors.incorrect;

  const isVerify = question.questionType === 'verify';
  const feedbackDisabled = feedback === 'correct' || (feedback === 'incorrect' && !usedSecondChance);

  return (
    <SafeAreaView style={[s.container, feedback === 'correct' && s.bgCorrect, feedback === 'incorrect' && s.bgIncorrect]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleAbandon} style={s.exitBtn}>
          <Text style={s.exitBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={s.progressContainer}>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${(currentQ / totalQ) * 100}%` }]} />
          </View>
          <Text style={s.progressText}>{currentQ + 1} / {totalQ}</Text>
        </View>
        <View style={s.pointsBadge}>
          <Text style={s.pointsText}>⭐ {Math.round(pendingPoints)}</Text>
        </View>
      </View>

      {/* Question */}
      <View style={[s.questionContainer, { minHeight: Math.max(windowHeight * 0.28, 130) }]}>
        <Text style={s.operationLabel}>{getOperationLabel()}</Text>
        <Text
          style={s.questionText}
          adjustsFontSizeToFit
          numberOfLines={question.questionType === 'pattern' ? 2 : 1}
          minimumFontScale={0.35}
        >
          {getQuestionText()}
        </Text>
        {isVerify && !feedback && (
          <Text style={s.verifyHint}>Yukarıdaki işlem doğru mu?</Text>
        )}
        {!feedback && liveScore > 0 && (
          <View style={s.liveScoreWrap}>
            <Text style={[s.liveScoreVal, { color: liveScoreColor }]} allowFontScaling={false}>
              ⭐ {liveScore} puan
            </Text>
            <View style={s.liveScoreBarBg}>
              <View style={[s.liveScoreBarFill, {
                width: `${liveScorePercent}%`,
                backgroundColor: liveScoreColor,
              }]} />
            </View>
          </View>
        )}

        {feedback && (
          <View style={[s.feedbackBadge, feedback === 'correct' ? s.feedbackCorrect : s.feedbackIncorrect]}>
            <Text style={s.feedbackText}>
              {feedback === 'correct' ? '✓ Doğru!' : usedSecondChance ? 'Bir daha dene' : `✗ Cevap: ${question.answer}`}
            </Text>
          </View>
        )}
      </View>

      {/* Answer input */}
      <View style={s.answerContainer}>
        {isVerify ? (
          /* Doğru / Yanlış buttons */
          <View style={s.verifyRow}>
            {([
              { value: '1', label: '✓  Doğru', color: theme.colors.correct },
              { value: '0', label: '✗  Yanlış', color: theme.colors.incorrect },
            ] as const).map(({ value, label, color }) => {
              let btnStyle: object[] = [s.verifyBtn];
              if (feedbackDisabled && selectedAnswer === value) {
                btnStyle = [
                  s.verifyBtn,
                  value === String(question.answer) ? s.verifyBtnCorrect : s.verifyBtnWrong,
                ];
              }
              if (feedbackDisabled && value === String(question.answer)) {
                btnStyle = [s.verifyBtn, s.verifyBtnCorrect];
              }
              return (
                <TouchableOpacity
                  key={value}
                  style={btnStyle}
                  onPress={() => !feedbackDisabled && submitAnswer(value)}
                  activeOpacity={0.75}
                  disabled={feedbackDisabled}
                >
                  <Text style={[s.verifyBtnText, { color }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : isMultipleChoice && question.choices ? (
          <MultipleChoice
            choices={question.choices}
            onSelect={submitAnswer}
            theme={theme}
            disabled={feedbackDisabled}
            correctAnswer={feedbackDisabled ? String(question.answer) : undefined}
            selectedAnswer={selectedAnswer}
          />
        ) : (
          <NumericPad
            value={inputValue}
            onChange={setInputValue}
            onSubmit={() => submitAnswer(inputValue)}
            theme={theme}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    bgCorrect: { backgroundColor: theme.colors.correct + '11' },
    bgIncorrect: { backgroundColor: theme.colors.incorrect + '11' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { fontSize: theme.fontSizes.lg, color: theme.colors.textSecondary },
    header: {
      flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md,
      paddingTop: theme.spacing.lg, gap: theme.spacing.sm,
    },
    exitBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: theme.colors.border, justifyContent: 'center', alignItems: 'center',
    },
    exitBtnText: { fontSize: 16, color: theme.colors.text, fontWeight: 'bold' },
    progressContainer: { flex: 1, gap: 4 },
    progressBg: { height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 4 },
    progressText: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, textAlign: 'right' },
    pointsBadge: {
      backgroundColor: theme.colors.warning + '33',
      paddingHorizontal: theme.spacing.sm, paddingVertical: 4,
      borderRadius: theme.borderRadius.full,
    },
    pointsText: { fontSize: theme.fontSizes.sm, fontWeight: '600', color: theme.colors.text },
    questionContainer: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      padding: theme.spacing.xl,
    },
    operationLabel: {
      fontSize: theme.fontSizes.sm, color: theme.colors.textMuted,
      fontWeight: '600', marginBottom: theme.spacing.md, textTransform: 'uppercase', letterSpacing: 2,
    },
    questionText: {
      fontSize: theme.fontSizes.question,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    feedbackBadge: {
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
    },
    feedbackCorrect: { backgroundColor: theme.colors.correct },
    feedbackIncorrect: { backgroundColor: theme.colors.incorrect },
    feedbackText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: theme.fontSizes.md },
    liveScoreWrap: {
      marginTop: theme.spacing.lg,
      alignItems: 'center',
      width: '75%',
    },
    liveScoreVal: {
      fontSize: theme.fontSizes.md,
      fontWeight: 'bold',
      marginBottom: theme.spacing.xs,
    },
    liveScoreBarBg: {
      width: '100%',
      height: 8,
      backgroundColor: theme.colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    liveScoreBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    answerContainer: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
    verifyHint: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.sm,
      fontStyle: 'italic',
    },
    verifyRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      justifyContent: 'space-between',
    },
    verifyBtn: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.border,
      minHeight: 90,
    },
    verifyBtnCorrect: {
      backgroundColor: theme.colors.correct + '22',
      borderColor: theme.colors.correct,
    },
    verifyBtnWrong: {
      backgroundColor: theme.colors.incorrect + '22',
      borderColor: theme.colors.incorrect,
    },
    verifyBtnText: {
      fontSize: theme.fontSizes.lg,
      fontWeight: 'bold',
    },
  });
