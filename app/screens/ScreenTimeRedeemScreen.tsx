/**
 * ScreenTimeRedeemScreen
 *
 * Child-facing screen where a child can spend earned points to unlock
 * a parent-selected app (e.g. Minecraft) for a limited time.
 *
 * Shows:
 *   - Current points balance
 *   - Conversion rule
 *   - Unit selector (+/−)
 *   - Points cost & granted minutes
 *   - Remaining daily budget
 *   - Active unlock countdown (JS UI only; enforcement is native)
 *   - "Redeem" button with all guard conditions
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../context/AppContext';
import { getBalance } from '../../features/rewards-wallet/rewardsWallet';
import {
  loadSettings,
} from '../../features/screen-time/screenTimeSettingsService';
import {
  getAuthorizationStatus,
  getRewardSessionStatus,
  isScreenTimeAvailable,
} from '../../features/screen-time/screenTimeNativeService';
import { redeemScreenTime } from '../../features/screen-time/screenTimeRewardRedemptionService';
import {
  calculatePointsCost,
  calculateMinutesGranted,
  remainingDailyMinutes,
  remainingSessionSeconds,
  minimumUnits,
  buildConversionPreview,
} from '../../features/screen-time/screenTimeRewardCalculator';
import {
  ScreenTimeRewardSettings,
  DEFAULT_SCREEN_TIME_REWARD_SETTINGS,
  ScreenTimeRewardSession,
  ScreenTimeAuthStatus,
} from '../../features/screen-time/types';
import { getDailyUsedMinutes } from '../../features/screen-time/screenTimeSettingsService';
import { AppTheme } from '../../shared/ui/theme';

export default function ScreenTimeRedeemScreen() {
  const { activeProfile, theme } = useAppContext();
  const s = styles(theme);

  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  const [balance, setBalance] = useState(0);
  const [settings, setSettings] = useState<ScreenTimeRewardSettings>(
    DEFAULT_SCREEN_TIME_REWARD_SETTINGS,
  );
  const [authStatus, setAuthStatus] = useState<ScreenTimeAuthStatus>('notDetermined');
  const [dailyUsed, setDailyUsed] = useState(0);
  const [activeSession, setActiveSession] = useState<ScreenTimeRewardSession | null>(null);

  const [units, setUnits] = useState(1);

  // JS countdown timer (display only — enforcement is done natively)
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const profileId = activeProfile?.id ?? '';

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const [bal, cfg, auth, used, session] = await Promise.all([
      getBalance(profileId),
      loadSettings(profileId),
      getAuthorizationStatus(),
      getDailyUsedMinutes(profileId),
      getRewardSessionStatus(),
    ]);
    setBalance(bal);
    setSettings(cfg);
    setAuthStatus(auth);
    setDailyUsed(used);
    setActiveSession(session);
    setUnits(Math.max(minimumUnits(cfg), 1));
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  // Start / update countdown when activeSession changes
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (activeSession?.isActive) {
      const tick = () => {
        const secs = remainingSessionSeconds(activeSession);
        setCountdownSeconds(secs);
        if (secs <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setActiveSession(null);
          load(); // refresh balance and session status
        }
      };
      tick();
      countdownRef.current = setInterval(tick, 1000);
    } else {
      setCountdownSeconds(0);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [activeSession, load]);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const minUnits = minimumUnits(settings);
  const preview = buildConversionPreview(units, settings);
  const remainingDaily = remainingDailyMinutes(settings, dailyUsed);
  const targetName = settings.rewardTargetDisplayName ?? 'Uygulama';

  // ─── Validation for button state ────────────────────────────────────────────

  function getBlockReason(): string | null {
    if (Platform.OS !== 'ios') return 'Bu özellik yalnızca iOS\'ta kullanılabilir.';
    if (!isScreenTimeAvailable()) return 'iOS 16+ gerekli.';
    if (!settings.enabled) return 'Ebeveyn ekran süresi ödüllerini etkinleştirmedi.';
    if (authStatus !== 'approved') return 'Ebeveyn izin vermedi.';
    if (!settings.selectedAppsConfigured) return 'Ebeveyn henüz uygulama seçmedi.';
    if (balance < preview.pointsCost) return `Yeterli puan yok (${Math.round(balance)} / ${preview.pointsCost}).`;
    if (preview.minutesGranted > remainingDaily) return `Bugünkü limit doldu (kalan: ${remainingDaily} dk).`;
    if (activeSession?.isActive) return 'Zaten aktif bir ödül oturumu var.';
    return null;
  }

  const blockReason = getBlockReason();
  const canRedeem = blockReason === null && !redeeming;

  // ─── Redeem handler ──────────────────────────────────────────────────────────

  async function handleRedeem() {
    if (!canRedeem || !profileId) return;

    setRedeeming(true);
    const result = await redeemScreenTime(
      {
        childId: profileId,
        requestedUnits: units,
        requestedPoints: preview.pointsCost,
        requestedMinutes: preview.minutesGranted,
      },
      settings,
    );
    setRedeeming(false);

    if (result.success) {
      setBalance(result.remainingPoints);
      if (result.activeSession) {
        setActiveSession(result.activeSession);
      }
      Alert.alert(
        '🎮 Kilidi Açıldı!',
        `${targetName} ${preview.minutesGranted} dakika boyunca açık. İyi oyunlar!`,
      );
    } else {
      Alert.alert('Hata', result.message ?? 'Bir sorun oluştu.');
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!activeProfile) {
    return (
      <SafeAreaView style={s.container}>
        <Text style={s.errorText}>Profil seçili değil.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.screenTitle}>🕹️ Ekran Süresi Kazan</Text>

        {/* Points balance */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Mevcut Puanın</Text>
          <Text style={s.balanceValue}>{Math.round(balance)} puan</Text>
        </View>

        {/* Conversion rule */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Dönüşüm Kuralı</Text>
          <Text style={s.infoRow}>
            {settings.pointsPerUnit} puan = {settings.minutesPerUnit} dakika {targetName}
          </Text>
          <Text style={s.infoRow}>
            📅 Günlük kota: {settings.dailyMaxMinutes} dakika
          </Text>
          <Text style={s.infoRow}>
            ⏳ Bugün kullandığın: {dailyUsed} dk · Kalan: {remainingDaily} dk
          </Text>
        </View>

        {/* Active session countdown */}
        {activeSession?.isActive && (
          <View style={s.activeCard}>
            <Text style={s.activeTitle}>🟢 Aktif Oturum: {targetName}</Text>
            <Text style={s.activeCountdown}>{formatDuration(countdownSeconds)}</Text>
            <Text style={s.activeNote}>Süre dolduğunda otomatik olarak kilitlenecek.</Text>
          </View>
        )}

        {/* Unit selector */}
        {!activeSession?.isActive && (
          <>
            <View style={s.unitCard}>
              <Text style={s.unitTitle}>Kaç birim?</Text>
              <View style={s.unitRow}>
                <TouchableOpacity
                  style={s.unitBtn}
                  onPress={() => setUnits(u => Math.max(minUnits, u - 1))}
                  activeOpacity={0.7}
                >
                  <Text style={s.unitBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.unitValue}>{units}</Text>
                <TouchableOpacity
                  style={s.unitBtn}
                  onPress={() => setUnits(u => u + 1)}
                  activeOpacity={0.7}
                >
                  <Text style={s.unitBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Cost preview */}
              <View style={s.previewBox}>
                <View style={s.previewRow}>
                  <Text style={s.previewLabel}>Puan maliyeti</Text>
                  <Text style={[s.previewValue, balance < preview.pointsCost && s.previewDanger]}>
                    {preview.pointsCost} puan
                  </Text>
                </View>
                <View style={s.previewRow}>
                  <Text style={s.previewLabel}>Kazanacağın süre</Text>
                  <Text style={s.previewValue}>{preview.minutesGranted} dakika</Text>
                </View>
                <View style={s.previewRow}>
                  <Text style={s.previewLabel}>Hedef</Text>
                  <Text style={s.previewValue}>{targetName}</Text>
                </View>
              </View>
            </View>

            {/* Block reason (if any) */}
            {blockReason && (
              <View style={s.warningBox}>
                <Text style={s.warningText}>⚠️ {blockReason}</Text>
              </View>
            )}

            {/* Redeem button */}
            <TouchableOpacity
              style={[s.redeemBtn, !canRedeem && s.redeemBtnDisabled]}
              onPress={handleRedeem}
              activeOpacity={canRedeem ? 0.8 : 1}
              disabled={!canRedeem}
            >
              {redeeming ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={s.redeemBtnText}>
                  🎮 {preview.pointsCost} puana {preview.minutesGranted} dk {targetName} Kazan
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xxl },
    screenTitle: {
      fontSize: theme.fontSizes.xl,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
    },
    errorText: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
    balanceCard: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    balanceLabel: { fontSize: theme.fontSizes.sm, color: 'rgba(255,255,255,0.8)' },
    balanceValue: { fontSize: theme.fontSizes.xxl, fontWeight: 'bold', color: '#FFFFFF' },
    infoCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    infoTitle: {
      fontSize: theme.fontSizes.md,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    infoRow: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textMuted,
      marginBottom: 2,
    },
    activeCard: {
      backgroundColor: theme.colors.correct + '22',
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderWidth: 2,
      borderColor: theme.colors.correct,
      alignItems: 'center',
    },
    activeTitle: {
      fontSize: theme.fontSizes.md,
      fontWeight: '600',
      color: theme.colors.correct,
      marginBottom: 4,
    },
    activeCountdown: {
      fontSize: 48,
      fontWeight: 'bold',
      color: theme.colors.correct,
      marginBottom: 4,
    },
    activeNote: {
      fontSize: theme.fontSizes.xs,
      color: theme.colors.textMuted,
    },
    unitCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    unitTitle: {
      fontSize: theme.fontSizes.md,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    unitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xl,
      marginBottom: theme.spacing.md,
    },
    unitBtn: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unitBtnText: {
      fontSize: 24,
      color: '#FFFFFF',
      fontWeight: 'bold',
      lineHeight: 28,
    },
    unitValue: {
      fontSize: 36,
      fontWeight: 'bold',
      color: theme.colors.text,
      minWidth: 40,
      textAlign: 'center',
    },
    previewBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
    },
    previewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    previewLabel: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
    previewValue: { fontSize: theme.fontSizes.sm, fontWeight: '600', color: theme.colors.text },
    previewDanger: { color: theme.colors.incorrect },
    warningBox: {
      backgroundColor: theme.colors.warning + '22',
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.warning,
    },
    warningText: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.warning,
    },
    redeemBtn: {
      backgroundColor: theme.colors.correct,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    redeemBtnDisabled: {
      backgroundColor: theme.colors.border,
    },
    redeemBtnText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: theme.fontSizes.sm,
      textAlign: 'center',
    },
  });
