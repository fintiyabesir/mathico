/**
 * ScreenTimeReportSection
 *
 * Collapsible parent-facing report inside ParentScreen.
 * Answers six questions:
 *   1. Which questions did the child solve today?
 *   2. Were they actually correct?
 *   3. How many minutes did they earn?
 *   4. How many total minutes were used today?
 *   5. Which app was opened?
 *   6. Does it automatically close when time expires?
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppTheme } from '../../../shared/ui/theme';
import {
  getTodayRedemptionLogs,
  getTodayAnsweredQuestions,
  ScreenTimeRedemptionLog,
  TodayAnsweredQuestion,
} from '../../../features/screen-time/screenTimeActivityLogService';
import {
  getDailyUsedMinutes,
  loadSettings,
} from '../../../features/screen-time/screenTimeSettingsService';

interface Props {
  profileId: string;
  theme: AppTheme;
}

const OP_SYMBOL: Record<string, string> = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function isExpired(iso: string): boolean {
  return new Date(iso) < new Date();
}

export default function ScreenTimeReportSection({ profileId, theme }: Props) {
  const s = styles(theme);

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redemptions, setRedemptions] = useState<ScreenTimeRedemptionLog[]>([]);
  const [questions, setQuestions] = useState<TodayAnsweredQuestion[]>([]);
  const [usedMinutes, setUsedMinutes] = useState(0);
  const [dailyMax, setDailyMax] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    const [logs, qs, used, settings] = await Promise.all([
      getTodayRedemptionLogs(profileId),
      getTodayAnsweredQuestions(profileId),
      getDailyUsedMinutes(profileId),
      loadSettings(profileId),
    ]);
    setRedemptions(logs);
    setQuestions(qs);
    setUsedMinutes(used);
    setDailyMax(settings.dailyMaxMinutes);
    setLoading(false);
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      if (expanded) load();
    }, [expanded, load]),
  );

  if (Platform.OS !== 'ios') return null;

  const correctCount = questions.filter((q) => q.isCorrect).length;
  const totalEarned = redemptions.reduce((sum, r) => sum + r.minutesGranted, 0);
  const progressRatio = dailyMax > 0 ? Math.min(usedMinutes / dailyMax, 1) : 0;

  return (
    <View style={s.wrapper}>
      {/* Header / toggle */}
      <TouchableOpacity
        style={s.header}
        onPress={() => {
          const next = !expanded;
          setExpanded(next);
          if (next) load();
        }}
        activeOpacity={0.7}
      >
        <View style={s.headerLeft}>
          <Text style={s.headerEmoji}>📊</Text>
          <Text style={s.headerTitle}>Ekran Süresi Raporu</Text>
        </View>
        <View style={s.headerRight}>
          {!expanded && usedMinutes > 0 && (
            <Text style={s.headerBadge}>{usedMinutes} dk</Text>
          )}
          <Text style={s.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={s.body}>
          {loading ? (
            <ActivityIndicator
              color={theme.colors.primary}
              style={{ marginVertical: 20 }}
            />
          ) : (
            <>
              {/* ── 1. Today's usage bar ─────────────────────────────── */}
              <Text style={s.sectionLabel}>Bugün kullanılan ekran süresi</Text>
              <View style={s.progressTrack}>
                <View
                  style={[
                    s.progressFill,
                    { width: `${Math.round(progressRatio * 100)}%` },
                  ]}
                />
              </View>
              <Text style={s.progressText}>
                {usedMinutes} / {dailyMax} dk
                {usedMinutes >= dailyMax ? '  ⚠️ Günlük limit doldu' : ''}
              </Text>

              {/* ── 2. Redemption events ─────────────────────────────── */}
              <Text style={[s.sectionLabel, { marginTop: 16 }]}>
                Ekran süresi talepleri — bugün ({redemptions.length})
              </Text>
              {redemptions.length === 0 ? (
                <Text style={s.emptyText}>Bugün henüz hiç talep yapılmadı.</Text>
              ) : (
                redemptions.map((r) => {
                  const expired = isExpired(r.expiresAt);
                  return (
                    <View key={r.id} style={s.redemptionRow}>
                      <View style={s.redemptionInfo}>
                        <Text style={s.redemptionApp}>
                          📱 {r.targetDisplayName}
                        </Text>
                        <Text style={s.redemptionDetail}>
                          {formatTime(r.redeemedAt)} · {r.minutesGranted} dk ·{' '}
                          {r.pointsSpent} puan
                        </Text>
                        <Text style={s.redemptionDetail}>
                          Bitiş: {formatTime(r.expiresAt)}
                        </Text>
                      </View>
                      <View
                        style={[
                          s.statusBadge,
                          expired ? s.statusExpired : s.statusActive,
                        ]}
                      >
                        <Text style={s.statusText}>
                          {expired ? 'Bitti' : '🟢 Aktif'}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              {/* ── 3. Auto-expire info ──────────────────────────────── */}
              <View style={s.infoBox}>
                <Text style={s.infoText}>
                  ⏱️ Süre dolduğunda uygulama, cihazın{' '}
                  <Text style={{ fontWeight: '700' }}>
                    DeviceActivity
                  </Text>{' '}
                  sistemi tarafından otomatik olarak yeniden engellenir.
                  Uygulama kapatılsa bile kural çalışır.
                </Text>
              </View>

              {/* ── 4. Answered questions ────────────────────────────── */}
              <Text style={[s.sectionLabel, { marginTop: 16 }]}>
                Bugün çözülen sorular ({questions.length} soru,{' '}
                {correctCount} doğru)
              </Text>
              {questions.length === 0 ? (
                <Text style={s.emptyText}>
                  Bugün henüz hiç soru çözülmedi.
                </Text>
              ) : (
                <>
                  {/* Summary pills */}
                  <View style={s.summaryRow}>
                    <View style={[s.pill, s.pillCorrect]}>
                      <Text style={s.pillText}>
                        ✅ {correctCount} doğru
                      </Text>
                    </View>
                    <View style={[s.pill, s.pillWrong]}>
                      <Text style={s.pillText}>
                        ❌ {questions.length - correctCount} yanlış
                      </Text>
                    </View>
                    <View style={[s.pill, s.pillPoints]}>
                      <Text style={s.pillText}>
                        ⭐{' '}
                        {Math.round(
                          questions.reduce((s, q) => s + q.awardedPoints, 0),
                        )}{' '}
                        puan
                      </Text>
                    </View>
                  </View>

                  {/* Question rows */}
                  {questions.map((q, i) => {
                    const sym = OP_SYMBOL[q.operation] ?? '?';
                    const secs = (q.responseTimeMs / 1000).toFixed(1);
                    return (
                      <View key={i} style={s.questionRow}>
                        <Text style={s.questionResultIcon}>
                          {q.isCorrect ? '✅' : '❌'}
                        </Text>
                        <View style={s.questionContent}>
                          <Text style={s.questionExpr}>
                            {q.operand1} {sym} {q.operand2} = ?
                          </Text>
                          {q.isCorrect ? (
                            <Text style={s.questionMeta}>
                              Doğru cevap: {q.correctAnswer} · {secs}s ·{' '}
                              {Math.round(q.awardedPoints)} puan
                            </Text>
                          ) : (
                            <Text style={[s.questionMeta, s.wrongMeta]}>
                              Verilen: {q.submittedAnswer} · Doğru:{' '}
                              {q.correctAnswer} · {secs}s
                            </Text>
                          )}
                        </View>
                        <Text style={s.questionTime}>
                          {formatTime(q.answeredAt)}
                        </Text>
                      </View>
                    );
                  })}
                </>
              )}

              {/* ── 5. Earned minutes summary ────────────────────────── */}
              {totalEarned > 0 && (
                <View style={s.earnedBox}>
                  <Text style={s.earnedText}>
                    Bugün toplam{' '}
                    <Text style={{ fontWeight: '700' }}>
                      {totalEarned} dakika
                    </Text>{' '}
                    ekran süresi kazanıldı.
                  </Text>
                </View>
              )}

              {/* Refresh */}
              <TouchableOpacity
                style={s.refreshBtn}
                onPress={load}
                activeOpacity={0.7}
              >
                <Text style={s.refreshText}>↻ Yenile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function styles(t: AppTheme) {
  return StyleSheet.create({
    wrapper: {
      marginHorizontal: t.spacing.md,
      marginBottom: t.spacing.md,
      borderRadius: t.borderRadius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md,
      paddingVertical: 14,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerEmoji: {
      fontSize: 20,
    },
    headerTitle: {
      fontSize: t.fontSizes.md,
      fontWeight: '700',
      color: t.colors.text,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerBadge: {
      fontSize: t.fontSizes.sm,
      color: t.colors.primary,
      fontWeight: '600',
    },
    chevron: {
      fontSize: 12,
      color: t.colors.textMuted,
    },

    body: {
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.md,
    },

    sectionLabel: {
      fontSize: t.fontSizes.sm,
      fontWeight: '600',
      color: t.colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Progress bar
    progressTrack: {
      height: 10,
      backgroundColor: t.colors.border,
      borderRadius: 5,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: t.colors.primary,
      borderRadius: 5,
    },
    progressText: {
      fontSize: t.fontSizes.sm,
      color: t.colors.textSecondary,
      marginTop: 4,
    },

    // Redemption rows
    redemptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderRadius: t.borderRadius.md,
      padding: t.spacing.sm,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    redemptionInfo: {
      flex: 1,
    },
    redemptionApp: {
      fontSize: t.fontSizes.md,
      fontWeight: '600',
      color: t.colors.text,
    },
    redemptionDetail: {
      fontSize: t.fontSizes.xs,
      color: t.colors.textMuted,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: t.borderRadius.full,
      marginLeft: 8,
    },
    statusActive: {
      backgroundColor: '#E8F5E9',
    },
    statusExpired: {
      backgroundColor: t.colors.border,
    },
    statusText: {
      fontSize: t.fontSizes.xs,
      fontWeight: '600',
      color: t.colors.textSecondary,
    },

    // Info box
    infoBox: {
      backgroundColor: t.colors.surface,
      borderRadius: t.borderRadius.md,
      padding: t.spacing.sm,
      marginTop: 8,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.primary,
    },
    infoText: {
      fontSize: t.fontSizes.xs,
      color: t.colors.textSecondary,
      lineHeight: 18,
    },

    // Questions
    summaryRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: t.borderRadius.full,
    },
    pillCorrect: {
      backgroundColor: '#E8F5E9',
    },
    pillWrong: {
      backgroundColor: '#FFEBEE',
    },
    pillPoints: {
      backgroundColor: '#FFF8E1',
    },
    pillText: {
      fontSize: t.fontSizes.xs,
      fontWeight: '600',
      color: t.colors.text,
    },

    questionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      gap: 8,
    },
    questionResultIcon: {
      fontSize: 16,
      width: 24,
      textAlign: 'center',
    },
    questionContent: {
      flex: 1,
    },
    questionExpr: {
      fontSize: t.fontSizes.md,
      fontWeight: '600',
      color: t.colors.text,
      fontFamily: 'monospace',
    },
    questionMeta: {
      fontSize: t.fontSizes.xs,
      color: t.colors.textMuted,
      marginTop: 2,
    },
    wrongMeta: {
      color: t.colors.incorrect,
    },
    questionTime: {
      fontSize: t.fontSizes.xs,
      color: t.colors.textMuted,
      width: 36,
      textAlign: 'right',
    },

    // Earned summary box
    earnedBox: {
      marginTop: 12,
      backgroundColor: '#E3F2FD',
      borderRadius: t.borderRadius.md,
      padding: t.spacing.sm,
    },
    earnedText: {
      fontSize: t.fontSizes.sm,
      color: '#1565C0',
      textAlign: 'center',
    },

    // Empty / refresh
    emptyText: {
      fontSize: t.fontSizes.sm,
      color: t.colors.textMuted,
      marginBottom: 8,
      fontStyle: 'italic',
    },
    refreshBtn: {
      alignSelf: 'center',
      marginTop: 14,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: t.borderRadius.full,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    refreshText: {
      fontSize: t.fontSizes.sm,
      color: t.colors.textSecondary,
    },
  });
}
