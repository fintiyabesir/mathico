/**
 * ScreenTimeRewardsSection
 *
 * The "Screen Time Rewards" section rendered inside ParentScreen.
 * Handles all Screen Time parental configuration UI:
 *   - Enable/disable toggle
 *   - Permission request
 *   - FamilyActivityPicker
 *   - Points ↔ minutes conversion rule
 *   - Daily max, minimum redemption
 *   - Apply / clear restrictions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { AppTheme } from '../../../shared/ui/theme';
import {
  ScreenTimeRewardSettings,
  DEFAULT_SCREEN_TIME_REWARD_SETTINGS,
  ScreenTimeAuthStatus,
} from '../../../features/screen-time/types';
import {
  loadSettings,
  saveSettings,
} from '../../../features/screen-time/screenTimeSettingsService';
import {
  requestAuthorization,
  getAuthorizationStatus,
  presentFamilyActivityPicker,
  hasSelectedActivities,
  applyRestrictions,
  clearRestrictions,
  isScreenTimeAvailable,
} from '../../../features/screen-time/screenTimeNativeService';

interface Props {
  profileId: string;
  theme: AppTheme;
}

export default function ScreenTimeRewardsSection({ profileId, theme }: Props) {
  const s = styles(theme);

  const [settings, setSettings] = useState<ScreenTimeRewardSettings>(
    DEFAULT_SCREEN_TIME_REWARD_SETTINGS,
  );
  const [authStatus, setAuthStatus] = useState<ScreenTimeAuthStatus>('notDetermined');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Editable field states (strings so TextInput works cleanly)
  const [pointsPerUnit, setPointsPerUnit] = useState('100');
  const [minutesPerUnit, setMinutesPerUnit] = useState('15');
  const [dailyMaxMinutes, setDailyMaxMinutes] = useState('60');
  const [minRedeemable, setMinRedeemable] = useState('100');
  const [displayName, setDisplayName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [s, status] = await Promise.all([
      loadSettings(profileId),
      getAuthorizationStatus(),
    ]);
    setSettings(s);
    setAuthStatus(status);
    setPointsPerUnit(String(s.pointsPerUnit));
    setMinutesPerUnit(String(s.minutesPerUnit));
    setDailyMaxMinutes(String(s.dailyMaxMinutes));
    setMinRedeemable(String(s.minimumRedeemablePoints));
    setDisplayName(s.rewardTargetDisplayName ?? '');
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function buildSettingsFromFields(): ScreenTimeRewardSettings {
    return {
      ...settings,
      pointsPerUnit: Math.max(1, parseInt(pointsPerUnit, 10) || 100),
      minutesPerUnit: Math.max(1, parseInt(minutesPerUnit, 10) || 15),
      dailyMaxMinutes: Math.max(1, parseInt(dailyMaxMinutes, 10) || 60),
      minimumRedeemablePoints: Math.max(1, parseInt(minRedeemable, 10) || 100),
      rewardTargetDisplayName: displayName.trim() || undefined,
    };
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleToggleEnabled(value: boolean) {
    const updated = { ...buildSettingsFromFields(), enabled: value };
    setSettings(updated);
    await saveSettings(profileId, updated);
    if (!value) {
      await clearRestrictions();
    }
  }

  async function handleRequestPermission() {
    if (!isScreenTimeAvailable()) {
      Alert.alert('Desteklenmiyor', 'Bu özellik yalnızca iOS 16+ cihazlarda çalışır.');
      return;
    }
    const approved = await requestAuthorization();
    const newStatus = await getAuthorizationStatus();
    setAuthStatus(newStatus);
    if (approved) {
      Alert.alert('✅ İzin Verildi', 'Ekran süresi izni başarıyla alındı.');
    } else {
      Alert.alert(
        'İzin Reddedildi',
        'Lütfen Ayarlar → Ekran Süresi → Aile Paylaşımı bölümünden izni etkinleştirin.',
      );
    }
  }

  async function handleSelectApps() {
    if (!isScreenTimeAvailable()) {
      Alert.alert('Desteklenmiyor', 'Bu özellik yalnızca iOS 16+ cihazlarda çalışır.');
      return;
    }
    if (authStatus !== 'approved') {
      Alert.alert('İzin Gerekli', 'Önce ekran süresi izni vermelisiniz.');
      return;
    }
    await presentFamilyActivityPicker();
    const selected = await hasSelectedActivities();
    const updated = { ...buildSettingsFromFields(), selectedAppsConfigured: selected };
    setSettings(updated);
    await saveSettings(profileId, updated);
    if (selected) {
      Alert.alert('✅ Uygulamalar Seçildi', 'Seçilen uygulamalar kaydedildi.');
    }
  }

  async function handleSave() {
    setSaving(true);
    const updated = buildSettingsFromFields();
    setSettings(updated);
    await saveSettings(profileId, updated);
    setSaving(false);
    Alert.alert('✅ Kaydedildi', 'Ödül kuralı kaydedildi.');
  }

  async function handleApplyRestrictions() {
    if (!settings.selectedAppsConfigured) {
      Alert.alert('Uygulama Seçilmedi', 'Önce uygulama seçin.');
      return;
    }
    await applyRestrictions();
    Alert.alert('🔒 Kısıtlamalar Uygulandı', `${settings.rewardTargetDisplayName ?? 'Seçilen uygulamalar'} şimdi engellendi.`);
  }

  async function handleClearRestrictions() {
    Alert.alert(
      'Kısıtlamaları Kaldır',
      'Engellenen uygulamalar serbest bırakılacak ve özellik devre dışı kalacak. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Kaldır',
          style: 'destructive',
          onPress: async () => {
            await clearRestrictions();
            const updated = { ...settings, enabled: false };
            setSettings(updated);
            await saveSettings(profileId, updated);
            Alert.alert('✅ Kısıtlamalar Kaldırıldı');
          },
        },
      ],
    );
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  function authStatusLabel(): string {
    switch (authStatus) {
      case 'approved': return '✅ İzin Verildi';
      case 'denied': return '❌ İzin Reddedildi';
      case 'notDetermined': return '⏳ İzin Bekleniyor';
      case 'restricted': return '⚠️ Kısıtlı';
      case 'unavailable': return '🚫 iOS 16+ Gerekli';
    }
  }

  if (Platform.OS !== 'ios') {
    return (
      <View style={s.card}>
        <Text style={s.cardTitle}>📱 Ekran Süresi Ödülleri</Text>
        <Text style={s.infoText}>
          Ekran Süresi Ödülleri şu an yalnızca iOS'ta kullanılabilir.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      {/* Header row */}
      <TouchableOpacity
        style={s.cardTitleRow}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={s.cardTitle}>📱 Ekran Süresi Ödülleri</Text>
        <Text style={s.cardChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator style={{ marginTop: 8 }} />}

      {!loading && (
        <>
          {/* Enable toggle (always visible) */}
          <View style={s.row}>
            <Text style={s.rowLabel}>Etkinleştir</Text>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ true: theme.colors.correct }}
              thumbColor="#FFFFFF"
            />
          </View>

          {expanded && (
            <>
              {/* Auth status */}
              <View style={s.infoRow}>
                <Text style={s.rowLabel}>İzin Durumu</Text>
                <Text style={s.infoValue}>{authStatusLabel()}</Text>
              </View>

              {/* Request permission */}
              {authStatus !== 'approved' && (
                <TouchableOpacity style={s.actionBtn} onPress={handleRequestPermission} activeOpacity={0.8}>
                  <Text style={s.actionBtnText}>🔑 Ekran Süresi İzni İste</Text>
                </TouchableOpacity>
              )}

              {/* Apps configured status */}
              <View style={s.infoRow}>
                <Text style={s.rowLabel}>Uygulama Seçimi</Text>
                <Text style={s.infoValue}>
                  {settings.selectedAppsConfigured ? '✅ Seçildi' : '⚠️ Seçilmedi'}
                </Text>
              </View>

              {/* Select apps */}
              <TouchableOpacity style={s.actionBtn} onPress={handleSelectApps} activeOpacity={0.8}>
                <Text style={s.actionBtnText}>🎮 Uygulamaları Seç (FamilyActivityPicker)</Text>
              </TouchableOpacity>

              {/* Display name */}
              <Text style={s.fieldLabel}>Hedef Uygulama Adı (örn. "Minecraft")</Text>
              <TextInput
                style={s.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder='Örn: Minecraft'
                placeholderTextColor={theme.colors.textMuted}
              />

              {/* Points per unit */}
              <Text style={s.fieldLabel}>Puan / Birim</Text>
              <TextInput
                style={s.input}
                value={pointsPerUnit}
                onChangeText={setPointsPerUnit}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={theme.colors.textMuted}
              />

              {/* Minutes per unit */}
              <Text style={s.fieldLabel}>Dakika / Birim</Text>
              <TextInput
                style={s.input}
                value={minutesPerUnit}
                onChangeText={setMinutesPerUnit}
                keyboardType="number-pad"
                placeholder="15"
                placeholderTextColor={theme.colors.textMuted}
              />

              {/* Daily max */}
              <Text style={s.fieldLabel}>Günlük Maksimum Ek Süre (dk)</Text>
              <TextInput
                style={s.input}
                value={dailyMaxMinutes}
                onChangeText={setDailyMaxMinutes}
                keyboardType="number-pad"
                placeholder="60"
                placeholderTextColor={theme.colors.textMuted}
              />

              {/* Min redeemable points */}
              <Text style={s.fieldLabel}>Minimum Kullanılabilir Puan</Text>
              <TextInput
                style={s.input}
                value={minRedeemable}
                onChangeText={setMinRedeemable}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={theme.colors.textMuted}
              />

              {/* Preview */}
              <View style={s.previewBox}>
                <Text style={s.previewText}>
                  📐 {parseInt(pointsPerUnit, 10) || 100} puan = {parseInt(minutesPerUnit, 10) || 15} dakika
                </Text>
                <Text style={s.previewText}>
                  🔝 Günlük maks: {parseInt(dailyMaxMinutes, 10) || 60} dakika
                </Text>
              </View>

              {/* Save rule */}
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.8} disabled={saving}>
                <Text style={s.saveBtnText}>{saving ? 'Kaydediliyor…' : '💾 Ödül Kuralını Kaydet'}</Text>
              </TouchableOpacity>

              {/* Apply / clear restrictions */}
              <View style={s.destructiveRow}>
                <TouchableOpacity
                  style={[s.halfBtn, { backgroundColor: theme.colors.incorrect }]}
                  onPress={handleApplyRestrictions}
                  activeOpacity={0.8}
                >
                  <Text style={s.halfBtnText}>🔒 Kısıtla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.halfBtn, { backgroundColor: theme.colors.textMuted }]}
                  onPress={handleClearRestrictions}
                  activeOpacity={0.8}
                >
                  <Text style={s.halfBtnText}>🔓 Kaldır</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      marginHorizontal: theme.spacing.xl,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: {
      fontSize: theme.fontSizes.md,
      fontWeight: '600',
      color: theme.colors.text,
    },
    cardTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    cardChevron: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textMuted,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs,
    },
    rowLabel: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.text,
      flexShrink: 1,
    },
    infoValue: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    infoText: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.sm,
    },
    fieldLabel: {
      fontSize: theme.fontSizes.xs,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.sm,
      marginBottom: 2,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      fontSize: theme.fontSizes.sm,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    previewBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    previewText: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.text,
    },
    actionBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    actionBtnText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: theme.fontSizes.sm,
    },
    saveBtn: {
      backgroundColor: theme.colors.correct,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    saveBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: theme.fontSizes.sm,
    },
    destructiveRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    halfBtn: {
      flex: 1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      alignItems: 'center',
    },
    halfBtnText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: theme.fontSizes.sm,
    },
  });
