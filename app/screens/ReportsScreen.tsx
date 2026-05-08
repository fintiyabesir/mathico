import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../context/AppContext';
import { getDailyMetrics, getOperationMetrics, OperationMetrics } from '../../features/reporting/reportingEngine';
import { AppTheme } from '../../shared/ui/theme';
import { useFocusEffect } from '@react-navigation/native';

export default function ReportsScreen() {
  const { activeProfile, theme } = useAppContext();
  const [opMetrics, setOpMetrics] = useState<OperationMetrics[]>([]);
  const s = styles(theme);

  useFocusEffect(
    useCallback(() => {
      if (activeProfile) {
        getOperationMetrics(activeProfile.id).then(setOpMetrics);
      }
    }, [activeProfile])
  );

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>📊 Raporlar</Text>
        </View>

        <Text style={s.sectionTitle}>İşlem Türü Performansı</Text>
        {opMetrics.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>📖</Text>
            <Text style={s.emptyText}>Henüz veri yok</Text>
            <Text style={s.emptySubText}>Seans tamamladıktan sonra raporların burada görünür</Text>
          </View>
        ) : (
          opMetrics.map(op => (
            <View key={op.operation} style={s.opCard}>
              <View style={s.opHeader}>
                <Text style={s.opLabel}>{op.label}</Text>
                <Text style={s.opLevel}>Seviye {op.currentLevel}</Text>
              </View>
              <View style={s.opStats}>
                <View style={s.opStat}>
                  <Text style={s.opStatVal}>{Math.round(op.accuracy * 100)}%</Text>
                  <Text style={s.opStatLabel}>Doğruluk</Text>
                </View>
                <View style={s.opStat}>
                  <Text style={s.opStatVal}>{(op.avgTimeMs / 1000).toFixed(1)}s</Text>
                  <Text style={s.opStatLabel}>Ort. Süre</Text>
                </View>
                <View style={s.opStat}>
                  <Text style={s.opStatVal}>{op.questionsAnswered}</Text>
                  <Text style={s.opStatLabel}>Soru</Text>
                </View>
              </View>
              <View style={s.accuracyBarBg}>
                <View style={[s.accuracyBarFill, {
                  width: `${op.accuracy * 100}%`,
                  backgroundColor: op.accuracy >= 0.8 ? theme.colors.correct : op.accuracy >= 0.5 ? theme.colors.warning : theme.colors.incorrect
                }]} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { padding: theme.spacing.xl, paddingBottom: theme.spacing.md },
    title: { fontSize: theme.fontSizes.xxl, fontWeight: 'bold', color: theme.colors.text },
    sectionTitle: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text, paddingHorizontal: theme.spacing.xl, marginBottom: theme.spacing.sm },
    empty: { alignItems: 'center', padding: theme.spacing.xxl },
    emptyEmoji: { fontSize: 48, marginBottom: theme.spacing.md },
    emptyText: { fontSize: theme.fontSizes.lg, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 },
    emptySubText: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, textAlign: 'center' },
    opCard: {
      marginHorizontal: theme.spacing.xl, marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border,
    },
    opHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
    opLabel: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text },
    opLevel: { fontSize: theme.fontSizes.sm, color: theme.colors.primary, fontWeight: '600' },
    opStats: { flexDirection: 'row', marginBottom: theme.spacing.sm },
    opStat: { flex: 1, alignItems: 'center' },
    opStatVal: { fontSize: theme.fontSizes.lg, fontWeight: 'bold', color: theme.colors.text },
    opStatLabel: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
    accuracyBarBg: { height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' },
    accuracyBarFill: { height: '100%', borderRadius: 3 },
  });
