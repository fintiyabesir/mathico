import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppContext } from '../context/AppContext';
import { getUserBadges, getStreak, getAllBadges } from '../../features/gamification/gamificationEngine';
import { getBalance, getTransactions } from '../../features/rewards-wallet/rewardsWallet';
import { Badge, RewardTransaction } from '../../shared/types';
import { AppTheme } from '../../shared/ui/theme';
import { useFocusEffect } from '@react-navigation/native';

export default function RewardsScreen() {
  const { activeProfile, theme } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [badges, setBadges] = useState<(Badge & { awardedAt: string })[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [streak, setStreak] = useState(0);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const s = styles(theme);

  useFocusEffect(
    useCallback(() => {
      if (!activeProfile) return;
      Promise.all([
        getUserBadges(activeProfile.id),
        getStreak(activeProfile.id),
        getBalance(activeProfile.id),
        getTransactions(activeProfile.id, 10),
        getAllBadges(),
      ]).then(([b, st, bal, txs, all]) => {
        setBadges(b);
        setStreak(st);
        setBalance(bal);
        setTransactions(txs);
        setAllBadges(all);
      });
    }, [activeProfile])
  );

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>🏆 Ödüller</Text>
        </View>

        {/* Screen Time Redeem shortcut */}
        <TouchableOpacity
          style={[s.streakCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          onPress={() => navigation.navigate('ScreenTimeRedeem')}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: theme.fontSizes.md, color: theme.colors.text, fontWeight: '600' }}>🎮 Ekran Süresi Kazan</Text>
          <Text style={{ color: theme.colors.textMuted }}>▶</Text>
        </TouchableOpacity>
        <View style={s.streakCard}>
          <Text style={s.streakEmoji}>🔥</Text>
          <View>
            <Text style={s.streakValue}>{streak} Gün</Text>
            <Text style={s.streakLabel}>Kesintisiz Seri</Text>
          </View>
        </View>

        {/* Balance */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Toplam Puan</Text>
          <Text style={s.balanceValue}>{Math.round(balance)}</Text>
          <Text style={s.balanceSubLabel}>⭐ biriktirdiğin puan</Text>
        </View>

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Son İşlemler</Text>
            {transactions.map(tx => (
              <View key={tx.id} style={s.txRow}>
                <Text style={s.txEmoji}>{tx.type === 'earned' ? '➕' : '➖'}</Text>
                <View style={s.txInfo}>
                  <Text style={s.txDesc}>{tx.description}</Text>
                  <Text style={s.txDate}>{new Date(tx.createdAt).toLocaleDateString('tr-TR')}</Text>
                </View>
                <Text style={[s.txAmount, tx.type === 'earned' ? s.txEarned : s.txSpent]}>
                  {tx.type === 'earned' ? '+' : '-'}{Math.round(tx.amount)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Badges */}
        <Text style={s.sectionTitle}>Rozetler</Text>
        <View style={s.badgesGrid}>
          {allBadges.map((badge, i) => {
            const earned = badges.find(b => b.id === badge.id);
            return (
              <View key={badge.id} style={[
                s.badgeCard,
                earned ? s.badgeCardEarned : s.badgeCardLocked,
              ]}>
                <Text style={s.badgeEmoji}>{earned ? badge.iconEmoji : '🔒'}</Text>
                <Text style={[s.badgeName, !earned && s.badgeNameLocked]}>{badge.name}</Text>
                <Text style={s.badgeDesc}>{badge.description}</Text>
                {earned
                  ? <Text style={s.badgeDate}>✅ {new Date(earned.awardedAt).toLocaleDateString('tr-TR')}</Text>
                  : <Text style={s.badgeLockLabel}>Kilitli</Text>
                }
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { padding: theme.spacing.xl, paddingBottom: theme.spacing.md },
    title: { fontSize: theme.fontSizes.xxl, fontWeight: 'bold', color: theme.colors.text },
    streakCard: {
      marginHorizontal: theme.spacing.xl, marginBottom: theme.spacing.md,
      backgroundColor: '#FFF3E0', borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      borderWidth: 1, borderColor: theme.colors.warning + '88',
    },
    streakEmoji: { fontSize: 40 },
    streakValue: { fontSize: theme.fontSizes.xl, fontWeight: 'bold', color: theme.colors.text },
    streakLabel: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
    balanceCard: {
      marginHorizontal: theme.spacing.xl, marginBottom: theme.spacing.xl,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.xl, padding: theme.spacing.xl, alignItems: 'center',
    },
    balanceLabel: { fontSize: theme.fontSizes.sm, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    balanceValue: { fontSize: 56, fontWeight: 'bold', color: '#FFFFFF' },
    balanceSubLabel: { fontSize: theme.fontSizes.sm, color: 'rgba(255,255,255,0.7)' },
    sectionTitle: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text, paddingHorizontal: theme.spacing.xl, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md },
    txRow: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: theme.spacing.xl, marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md, gap: theme.spacing.sm,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    txEmoji: { fontSize: 20 },
    txInfo: { flex: 1 },
    txDesc: { fontSize: theme.fontSizes.sm, color: theme.colors.text, fontWeight: '500' },
    txDate: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
    txAmount: { fontSize: theme.fontSizes.md, fontWeight: 'bold' },
    txEarned: { color: theme.colors.correct },
    txSpent: { color: theme.colors.incorrect },
    empty: { alignItems: 'center', padding: theme.spacing.xl },
    emptyEmoji: { fontSize: 48, marginBottom: theme.spacing.md },
    emptyText: { fontSize: theme.fontSizes.lg, fontWeight: 'bold', color: theme.colors.text },
    emptySubText: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, textAlign: 'center', marginTop: 4 },
    badgesGrid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
      marginTop: theme.spacing.sm,
    },
    badgeCard: {
      width: '30%',
      flexGrow: 1,
      padding: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    badgeCardEarned: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.primary + '55',
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    },
    badgeCardLocked: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      opacity: 0.5,
    },
    badgeEmoji: { fontSize: 38, marginBottom: 6 },
    badgeName: { fontSize: theme.fontSizes.sm, fontWeight: 'bold', color: theme.colors.text, textAlign: 'center' },
    badgeNameLocked: { color: theme.colors.textMuted },
    badgeDesc: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, textAlign: 'center', marginTop: 2, lineHeight: 16 },
    badgeDate: { fontSize: 10, color: theme.colors.primary, marginTop: 6, fontWeight: '700' },
    badgeLockLabel: { fontSize: 10, color: theme.colors.textMuted, marginTop: 6 },
  });
