/**
 * MultiplicationTableScreen
 *
 * Lets the child pick a specific times table (2-12) and launch a
 * dedicated multiplication drill session.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useAppContext } from '../context/AppContext';
import { getDatabase } from '../../shared/storage/database';
import { getOrCreateLevelProgress } from '../../features/progression/progressionEngine';

const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface TableStat {
  tableNumber: number;
  accuracy: number | null; // null = not practised yet
}

export default function MultiplicationTableScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeProfile, theme } = useAppContext();
  const s = styles(theme);

  const [stats, setStats] = useState<TableStat[]>(
    TABLES.map((t) => ({ tableNumber: t, accuracy: null })),
  );

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [activeProfile]),
  );

  async function loadStats() {
    if (!activeProfile) return;
    // We use the rolling accuracy from the multiplication skill progress
    // as a proxy (same skill for all tables).
    const progress = await getOrCreateLevelProgress(
      activeProfile.id,
      'skill_multiplication',
      1,
    );
    const db = await getDatabase();

    // Per-table accuracy: count correct/total attempts where one operand = tableNumber
    const rows = await db.getAllAsync<{
      tableNumber: number;
      total: number;
      correct: number;
    }>(
      `SELECT
          CASE
            WHEN json_extract(sq.questionPayloadJson, '$.operand1') IN (${TABLES.join(',')})
                 AND json_extract(sq.questionPayloadJson, '$.operation') = 'multiplication'
            THEN json_extract(sq.questionPayloadJson, '$.operand1')
            ELSE json_extract(sq.questionPayloadJson, '$.operand2')
          END as tableNumber,
          COUNT(*) as total,
          SUM(aa.isCorrect) as correct
       FROM session s
       JOIN session_question sq ON sq.sessionId = s.id
       JOIN answer_attempt aa ON aa.sessionQuestionId = sq.id
       WHERE s.userProfileId = ?
         AND json_extract(sq.questionPayloadJson, '$.operation') = 'multiplication'
         AND aa.attemptNo = 1
       GROUP BY tableNumber`,
      [activeProfile.id],
    );

    const statMap: Record<number, TableStat> = {};
    TABLES.forEach((t) => (statMap[t] = { tableNumber: t, accuracy: null }));
    rows.forEach((r) => {
      const tn = Number(r.tableNumber);
      if (TABLES.includes(tn) && r.total >= 3) {
        statMap[tn] = { tableNumber: tn, accuracy: r.correct / r.total };
      }
    });
    setStats(Object.values(statMap));
  }

  function startSession(tableNumber: number) {
    navigation.navigate('Session', {
      mode: 'times_table',
      operation: 'multiplication',
      tableNumber,
    });
  }

  function accuracyColor(acc: number | null): string {
    if (acc === null) return theme.colors.border;
    if (acc >= 0.85) return theme.colors.correct;
    if (acc >= 0.6) return theme.colors.warning;
    return theme.colors.incorrect;
  }

  function accuracyLabel(acc: number | null): string {
    if (acc === null) return 'Henüz yok';
    return `%${Math.round(acc * 100)}`;
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.intro}>
          <Text style={s.emoji}>✖️</Text>
          <Text style={s.title}>Çarpım Tablosu</Text>
          <Text style={s.subtitle}>
            Hangi tabloyu çalışmak istiyorsun?
          </Text>
        </View>

        <View style={s.grid}>
          {stats.map(({ tableNumber, accuracy }) => (
            <TouchableOpacity
              key={tableNumber}
              style={[s.tableCard, { borderColor: accuracyColor(accuracy) }]}
              onPress={() => startSession(tableNumber)}
              activeOpacity={0.8}
            >
              <Text style={s.tableNumber}>{tableNumber}</Text>
              <Text style={s.tableLabel}>× tablosu</Text>
              <View
                style={[
                  s.accuracyDot,
                  { backgroundColor: accuracyColor(accuracy) },
                ]}
              />
              <Text style={[s.accuracyText, { color: accuracyColor(accuracy) }]}>
                {accuracyLabel(accuracy)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: theme.colors.correct }]} />
            <Text style={s.legendText}>≥ %85 — İyi</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: theme.colors.warning }]} />
            <Text style={s.legendText}>%60–84 — Gelişiyor</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: theme.colors.incorrect }]} />
            <Text style={s.legendText}>{'< %60 — Pratik gerek'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function styles(t: ReturnType<typeof import('../../shared/ui/theme').getTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    intro: {
      alignItems: 'center',
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.md,
    },
    emoji: { fontSize: 48, marginBottom: 8 },
    title: {
      fontSize: t.fontSizes.xxl,
      fontWeight: 'bold',
      color: t.colors.text,
    },
    subtitle: {
      fontSize: t.fontSizes.sm,
      color: t.colors.textSecondary,
      marginTop: 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: t.spacing.md,
      gap: t.spacing.sm,
      justifyContent: 'space-between',
    },
    tableCard: {
      width: '30%',
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      borderWidth: 2,
      marginBottom: 4,
    },
    tableNumber: {
      fontSize: t.fontSizes.xxl,
      fontWeight: 'bold',
      color: t.colors.text,
    },
    tableLabel: {
      fontSize: t.fontSizes.xs,
      color: t.colors.textMuted,
      marginBottom: 6,
    },
    accuracyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginBottom: 4,
    },
    accuracyText: {
      fontSize: t.fontSizes.xs,
      fontWeight: '600',
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: t.spacing.lg,
      padding: t.spacing.lg,
      flexWrap: 'wrap',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: t.fontSizes.xs,
      color: t.colors.textSecondary,
    },
  });
}
