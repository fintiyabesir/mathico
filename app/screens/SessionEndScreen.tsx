import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useAppContext } from '../context/AppContext';
import { buildSessionResult } from '../../features/reporting/reportingEngine';
import { SessionResult } from '../../shared/types';
import { AppTheme } from '../../shared/ui/theme';
import { OPERATION_LABELS } from '../../shared/lib/constants';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SessionEnd'>;
  route: RouteProp<RootStackParamList, 'SessionEnd'>;
};

export default function SessionEndScreen({ navigation, route }: Props) {
  const { sessionId, userProfileId, totalPoints, levelChanges } = route.params;
  const { theme } = useAppContext();
  const [result, setResult] = useState<SessionResult | null>(null);
  const s = styles(theme);

  useEffect(() => {
    buildSessionResult(sessionId, levelChanges).then(setResult);
  }, []);

  if (!result) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: theme.fontSizes.lg, color: theme.colors.text }}>Hesaplanıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pct = Math.round(result.accuracy * 100);
  const grade = pct >= 90 ? '🌟' : pct >= 70 ? '😊' : pct >= 50 ? '🙂' : '💪';
  const avgSec = (result.avgResponseTimeMs / 1000).toFixed(1);
  const medSec = (result.medianResponseTimeMs / 1000).toFixed(1);

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.grade}>{grade}</Text>
        <Text style={s.title}>Seans Tamamlandı!</Text>

        {/* Points */}
        <View style={s.pointsCard}>
          <Text style={s.pointsLabel}>Kazanılan Puan</Text>
          <Text style={s.pointsValue}>+{Math.round(result.totalPoints)}</Text>
        </View>

        {/* Stats */}
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={s.statEmoji}>🎯</Text>
            <Text style={s.statValue}>{pct}%</Text>
            <Text style={s.statLabel}>Doğruluk</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statEmoji}>✅</Text>
            <Text style={s.statValue}>{result.correctAnswers}/{result.questionsAnswered}</Text>
            <Text style={s.statLabel}>Doğru</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statEmoji}>⏱</Text>
            <Text style={s.statValue}>{avgSec}s</Text>
            <Text style={s.statLabel}>Ort. Süre</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statEmoji}>📊</Text>
            <Text style={s.statValue}>{medSec}s</Text>
            <Text style={s.statLabel}>Medyan</Text>
          </View>
        </View>

        {/* Strong / Weak */}
        {(result.strongArea || result.weakArea) && (
          <View style={s.insightCard}>
            {result.strongArea && (
              <View style={s.insightRow}>
                <Text style={s.insightEmoji}>💪</Text>
                <Text style={s.insightText}>Güçlü alanın: <Text style={s.insightHighlight}>{result.strongArea}</Text></Text>
              </View>
            )}
            {result.weakArea && result.weakArea !== result.strongArea && (
              <View style={s.insightRow}>
                <Text style={s.insightEmoji}>📖</Text>
                <Text style={s.insightText}>Daha fazla çalış: <Text style={s.insightHighlight}>{result.weakArea}</Text></Text>
              </View>
            )}
          </View>
        )}

        {/* Level changes */}
        {result.levelChanges.length > 0 && (
          <View style={s.levelCard}>
            <Text style={s.levelCardTitle}>📈 Seviye Değişimi!</Text>
            {result.levelChanges.map((lc, i) => (
              <Text key={i} style={s.levelChange}>
                {OPERATION_LABELS[lc.operationType]}: {lc.oldLevel} → {lc.newLevel}
                {lc.newLevel > lc.oldLevel ? ' 🎉' : ' 📉'}
              </Text>
            ))}
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => navigation.replace('Session', { mode: 'quick', operation: 'mixed' })}
          activeOpacity={0.8}
        >
          <Text style={s.primaryBtnText}>⚡ Bir Seans Daha</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
        >
          <Text style={s.secondaryBtnText}>Ana Sayfaya Dön</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing.xl, alignItems: 'center', paddingBottom: 48 },
    grade: { fontSize: 72, marginBottom: theme.spacing.sm },
    title: { fontSize: theme.fontSizes.xxl, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.xl },
    pointsCard: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.xl,
      paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.xxl,
      alignItems: 'center', marginBottom: theme.spacing.xl, width: '100%',
    },
    pointsLabel: { fontSize: theme.fontSizes.sm, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    pointsValue: { fontSize: 48, fontWeight: 'bold', color: '#FFFFFF' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, width: '100%', marginBottom: theme.spacing.md },
    statCard: {
      flex: 1, minWidth: '44%',
      backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md, alignItems: 'center',
      borderWidth: 1, borderColor: theme.colors.border,
    },
    statEmoji: { fontSize: 24, marginBottom: 4 },
    statValue: { fontSize: theme.fontSizes.xl, fontWeight: 'bold', color: theme.colors.text },
    statLabel: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
    insightCard: {
      width: '100%', backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg, padding: theme.spacing.md,
      borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    insightRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: 4 },
    insightEmoji: { fontSize: 20 },
    insightText: { fontSize: theme.fontSizes.md, color: theme.colors.text },
    insightHighlight: { fontWeight: 'bold', color: theme.colors.primary },
    levelCard: {
      width: '100%', backgroundColor: theme.colors.correct + '15',
      borderRadius: theme.borderRadius.lg, padding: theme.spacing.md,
      borderWidth: 1, borderColor: theme.colors.correct, marginBottom: theme.spacing.md,
    },
    levelCardTitle: { fontSize: theme.fontSizes.md, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.sm },
    levelChange: { fontSize: theme.fontSizes.md, color: theme.colors.text, marginBottom: 2 },
    primaryBtn: {
      width: '100%', backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg, padding: theme.spacing.md,
      alignItems: 'center', marginBottom: theme.spacing.sm,
    },
    primaryBtnText: { fontSize: theme.fontSizes.md, fontWeight: 'bold', color: '#FFFFFF' },
    secondaryBtn: {
      width: '100%', backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg, padding: theme.spacing.md,
      alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border,
    },
    secondaryBtnText: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.textSecondary },
  });
