import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, BackHandler
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
import { calculateScore, calculateAbandonPenalty } from '../../features/scoring/scoringEngine';
import { getOrCreateLevelProgress, updateLevelProgressAfterAnswer } from '../../features/progression/progressionEngine';
import { addPoints } from '../../features/rewards-wallet/rewardsWallet';
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
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initSession();
    return () => { if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current); };
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
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO session (id, userProfileId, mode, startedAt, completed, pendingPoints, finalizedPoints) VALUES (?, ?, ?, ?, 0, 0, 0)',
      [sessionId, activeProfile.id, mode, new Date().toISOString()]
    );
    await loadNextQuestion(0);
  }

  async function loadNextQuestion(qIndex: number) {
    if (!activeProfile) return;
    const op = pickOperation(mode, operation);
    const skillId = await getSkillIdForOperation(op);
    const progress = await getOrCreateLevelProgress(activeProfile.id, skillId, 1);
    const level = progress.currentLevel;
    const levelInfo = await getLevelParams(skillId, level);
    if (!levelInfo) return;

    const useMulti = shouldUseMultipleChoice(level, activeProfile.ageGroup);
    const q = generateQuestion(op, level, levelInfo.parametersJson, useMulti);

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
    setIsMultipleChoice(useMulti);
    setQuestion(q);
    setInputValue('');
    setSelectedAnswer(undefined);
    setFeedback(null);
    setUsedSecondChance(false);
    setCanSecondChance(AGE_SECOND_CHANCE[activeProfile.ageGroup as keyof typeof AGE_SECOND_CHANCE] ?? false);
    setQuestionStartTime(Date.now());
    setCurrentQuestionDbId(questionDbId);
    setCurrentQ(qIndex);
  }

  async function submitAnswer(answer: string) {
    if (!activeProfile || !question || !currentLevelParams || !currentQuestionDbId) return;
    if (feedback !== null) return;

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
              await addPoints(activeProfile.id, penalty, 'Seans terk edildi');
            }
            navigation.goBack();
          }
        }
      ]
    );
  }

  const s = styles(theme);

  if (!question) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingContainer}>
          <Text style={s.loadingText}>Sorular hazırlanıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const opSymbols: Record<string, string> = { addition: '+', subtraction: '-', multiplication: '×', division: '÷' };
  const opSymbol = opSymbols[question.operation] ?? '+';

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
      <View style={s.questionContainer}>
        <Text style={s.operationLabel}>{OPERATION_LABELS[question.operation]}</Text>
        <Text style={s.questionText}>
          {question.operand1} {opSymbol} {question.operand2} = ?
        </Text>
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
        {isMultipleChoice && question.choices ? (
          <MultipleChoice
            choices={question.choices}
            onSelect={submitAnswer}
            theme={theme}
            disabled={feedback === 'correct' || (feedback === 'incorrect' && !usedSecondChance)}
            correctAnswer={feedback !== null ? String(question.answer) : undefined}
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
    answerContainer: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  });
