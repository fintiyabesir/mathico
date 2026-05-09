import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppContext } from '../context/AppContext';
import { getOrCreateDailyGoal, getStreak } from '../../features/gamification/gamificationEngine';
import { getBalance } from '../../features/rewards-wallet/rewardsWallet';
import { DailyGoal } from '../../shared/types';
import { OPERATION_LABELS } from '../../shared/lib/constants';
import { useFocusEffect } from '@react-navigation/native';

type Props = {
  navigation?: NativeStackNavigationProp<RootStackParamList>;
};

export default function HomeScreen(_props: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeProfile, theme } = useAppContext();
  const [dailyGoal, setDailyGoal] = useState<DailyGoal | null>(null);
  const [streak, setStreak] = useState(0);
  const [balance, setBalance] = useState(0);
  const s = styles(theme);

  useFocusEffect(
    useCallback(() => {
      if (!activeProfile) return;
      loadData();
    }, [activeProfile])
  );

  async function loadData() {
    if (!activeProfile) return;
    const [goal, st, bal] = await Promise.all([
      getOrCreateDailyGoal(activeProfile.id, activeProfile.ageGroup),
      getStreak(activeProfile.id),
      getBalance(activeProfile.id),
    ]);
    setDailyGoal(goal);
    setStreak(st);
    setBalance(bal);
  }

  function goToReports() {
    navigation.dispatch(
      CommonActions.navigate({ name: 'ReportsTab' })
    );
  }

  const goalProgress = dailyGoal
    ? Math.min((dailyGoal.currentValue / dailyGoal.targetValue) * 100, 100)
    : 0;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerInfo}>
            <Text style={s.greeting} numberOfLines={2}>Merhaba, {activeProfile?.displayName}! 👋</Text>
            <Text style={s.headerSub}>Bugün pratik yapmaya hazır mısın?</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileSelect')}
            activeOpacity={0.7}
            style={s.avatarBtn}
          >
            <Text style={s.avatarLarge}>{activeProfile?.avatar}</Text>
            <Text style={s.switchLabel}>Değiştir</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <TouchableOpacity style={s.statCard} onPress={goToReports} activeOpacity={0.75}>
            <Text style={s.statEmoji}>🔥</Text>
            <Text style={s.statValue}>{streak}</Text>
            <Text style={s.statLabel}>Gün Serisi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.statCard} onPress={goToReports} activeOpacity={0.75}>
            <Text style={s.statEmoji}>⭐</Text>
            <Text style={s.statValue}>{Math.round(balance)}</Text>
            <Text style={s.statLabel}>Puan</Text>
          </TouchableOpacity>
        </View>

        {/* Daily goal */}
        {dailyGoal && (
          <View style={s.goalCard}>
            <View style={s.goalHeader}>
              <Text style={s.goalTitle}>📅 Günlük Hedef</Text>
              <Text style={s.goalBadge}>{dailyGoal.completed ? '✅ Tamamlandı!' : `${dailyGoal.currentValue}/${dailyGoal.targetValue}`}</Text>
            </View>
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${goalProgress}%` }]} />
            </View>
            <Text style={s.goalHint}>
              {dailyGoal.completed
                ? 'Harika! Bugünkü hedefini tamamladın!'
                : `${dailyGoal.targetValue - dailyGoal.currentValue} soru daha çöz`}
            </Text>
          </View>
        )}

        {/* Quick start */}
        <TouchableOpacity
          style={s.quickStartBtn}
          onPress={() => navigation.navigate('Session', { mode: 'quick', operation: 'mixed' })}
          activeOpacity={0.85}
        >
          <Text style={s.quickStartIcon}>⚡</Text>
          <View>
            <Text style={s.quickStartTitle}>Hızlı Başla</Text>
            <Text style={s.quickStartSub}>Sistem sana uygun soru seçer</Text>
          </View>
        </TouchableOpacity>

        {/* Operations */}
        <Text style={s.sectionTitle}>İşlem Seç</Text>
        <View style={s.opsGrid}>
          {(['addition', 'subtraction', 'multiplication', 'division'] as const).map(op => {
            const emojis: Record<string, string> = {
              addition: '➕', subtraction: '➖', multiplication: '✖️', division: '➗'
            };
            return (
              <TouchableOpacity
                key={op}
                style={s.opCard}
                onPress={() => navigation.navigate('Session', { mode: 'operation', operation: op })}
                activeOpacity={0.8}
              >
                <Text style={s.opEmoji}>{emojis[op]}</Text>
                <Text style={s.opLabel}>{OPERATION_LABELS[op]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Mixed mode */}
        <TouchableOpacity
          style={s.mixedBtn}
          onPress={() => navigation.navigate('Session', { mode: 'operation', operation: 'mixed' })}
          activeOpacity={0.8}
        >
          <Text style={s.mixedBtnText}>🎲  Karışık Mod</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof import('../../shared/ui/theme').getTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: theme.spacing.xl, paddingBottom: theme.spacing.md,
    },
    greeting: { fontSize: theme.fontSizes.xl, fontWeight: 'bold', color: theme.colors.text },
    headerSub: { fontSize: theme.fontSizes.sm, color: theme.colors.textSecondary, marginTop: 2 },
    headerInfo: { flex: 1, flexShrink: 1, marginRight: theme.spacing.sm },
    avatarBtn: { alignItems: 'center' },
    avatarLarge: { fontSize: 44 },
    switchLabel: { fontSize: theme.fontSizes.xs, color: theme.colors.primary, fontWeight: '600', marginTop: 2 },
    statsRow: { flexDirection: 'row', paddingHorizontal: theme.spacing.xl, gap: theme.spacing.md, marginBottom: theme.spacing.md },
    statCard: {
      flex: 1, backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg, padding: theme.spacing.md,
      alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border,
    },
    statEmoji: { fontSize: 24, marginBottom: 2 },
    statValue: { fontSize: theme.fontSizes.xl, fontWeight: 'bold', color: theme.colors.text },
    statLabel: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
    goalCard: {
      marginHorizontal: theme.spacing.xl, marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border,
    },
    goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
    goalTitle: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text },
    goalBadge: { fontSize: theme.fontSizes.sm, color: theme.colors.primary, fontWeight: '600' },
    progressBg: { height: 10, backgroundColor: theme.colors.border, borderRadius: 5, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 5 },
    goalHint: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, marginTop: theme.spacing.sm },
    quickStartBtn: {
      marginHorizontal: theme.spacing.xl, marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    },
    quickStartIcon: { fontSize: 32 },
    quickStartTitle: { fontSize: theme.fontSizes.lg, fontWeight: 'bold', color: '#FFFFFF' },
    quickStartSub: { fontSize: theme.fontSizes.sm, color: 'rgba(255,255,255,0.8)' },
    sectionTitle: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text, paddingHorizontal: theme.spacing.xl, marginBottom: theme.spacing.sm },
    opsGrid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    opCard: {
      width: '47%',
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    opEmoji: { fontSize: 22 },
    opLabel: { fontSize: theme.fontSizes.sm, fontWeight: '600', color: theme.colors.text },
    mixedBtn: {
      marginHorizontal: theme.spacing.xl, marginBottom: theme.spacing.xl,
      backgroundColor: theme.colors.secondary + '22',
      borderRadius: theme.borderRadius.lg, padding: theme.spacing.md,
      alignItems: 'center', borderWidth: 2, borderColor: theme.colors.secondary,
    },
    mixedBtnText: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text },
  });
