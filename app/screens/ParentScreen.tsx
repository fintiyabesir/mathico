import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppContext } from '../context/AppContext';
import { getBalance, getTransactions, spendPoints } from '../../features/rewards-wallet/rewardsWallet';
import { RewardTransaction } from '../../shared/types';
import { AppTheme, getTheme } from '../../shared/ui/theme';
import { ThemeType } from '../../shared/types';
import { useFocusEffect } from '@react-navigation/native';
import { updateProfileTheme } from '../../features/profile/profileService';
import { RootStackParamList } from '../navigation/types';
import * as SecureStore from 'expo-secure-store';

const PARENT_PIN_KEY = 'mathico_parent_pin';
const DEFAULT_PIN = '1234';

export default function ParentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeProfile, theme, setTheme } = useAppContext();
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [spendAmount, setSpendAmount] = useState('');
  const [spendDesc, setSpendDesc] = useState('');
  const s = styles(theme);

  useFocusEffect(
    useCallback(() => {
      if (activeProfile && pinUnlocked) {
        loadData();
      }
    }, [activeProfile, pinUnlocked])
  );

  async function loadData() {
    if (!activeProfile) return;
    const [bal, txs] = await Promise.all([
      getBalance(activeProfile.id),
      getTransactions(activeProfile.id, 20),
    ]);
    setBalance(bal);
    setTransactions(txs);
  }

  async function verifyPin() {
    const storedPin = await SecureStore.getItemAsync(PARENT_PIN_KEY) ?? DEFAULT_PIN;
    if (pinInput === storedPin) {
      setPinUnlocked(true);
      loadData();
    } else {
      Alert.alert('Hatalı PIN', 'PIN hatalı. Tekrar dene.');
      setPinInput('');
    }
  }

  async function handleSpend() {
    const amount = parseFloat(spendAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Hatalı Miktar', 'Geçerli bir miktar gir.');
      return;
    }
    if (!spendDesc.trim()) {
      Alert.alert('Açıklama Gerekli', 'Lütfen açıklama gir.');
      return;
    }
    if (!activeProfile) return;

    const success = await spendPoints(activeProfile.id, amount, spendDesc.trim());
    if (success) {
      Alert.alert('Başarılı', `${amount} puan harcandı.`);
      setSpendAmount('');
      setSpendDesc('');
      loadData();
    } else {
      Alert.alert('Yetersiz Puan', `Bakiye ${Math.round(balance)} puan. Yeterli puan yok.`);
    }
  }

  async function handleThemeChange(t: ThemeType) {
    setTheme(t);
    if (activeProfile) {
      await updateProfileTheme(activeProfile.id, t);
    }
  }

  if (!pinUnlocked) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.pinContainer}>
          <Text style={s.pinEmoji}>🔒</Text>
          <Text style={s.pinTitle}>Ebeveyn Modu</Text>
          <Text style={s.pinSubtitle}>PIN gir (demo: 1234)</Text>
          <TextInput
            style={s.pinInput}
            value={pinInput}
            onChangeText={setPinInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder="••••"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TouchableOpacity style={s.pinBtn} onPress={verifyPin} activeOpacity={0.8}>
            <Text style={s.pinBtnText}>Giriş</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.switchProfileBtn}
            onPress={() => navigation.navigate('ProfileSelect')}
          >
            <Text style={s.switchProfileBtnText}>Profil Değiştir</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>👨‍👩‍👧 Ebeveyn Modu</Text>
          <TouchableOpacity onPress={() => setPinUnlocked(false)} style={s.lockBtn}>
            <Text style={s.lockBtnText}>🔒 Kilitle</Text>
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Bakiye</Text>
          <Text style={s.balanceValue}>{Math.round(balance)} puan</Text>
        </View>

        {/* Spend points */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Puan Harca</Text>
          <TextInput
            style={s.input}
            value={spendAmount}
            onChangeText={setSpendAmount}
            keyboardType="numeric"
            placeholder="Puan miktarı"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TextInput
            style={[s.input, { marginTop: theme.spacing.sm }]}
            value={spendDesc}
            onChangeText={setSpendDesc}
            placeholder='Örn: "1000 puan karşılığı gofret"'
            placeholderTextColor={theme.colors.textMuted}
          />
          <TouchableOpacity style={s.spendBtn} onPress={handleSpend} activeOpacity={0.8}>
            <Text style={s.spendBtnText}>Puan Harca</Text>
          </TouchableOpacity>
        </View>

        {/* Theme selector */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Tema Seç</Text>
          <View style={s.themeRow}>
            {(['child', 'teen', 'adult'] as ThemeType[]).map(t => {
              const labels: Record<ThemeType, string> = { child: '🎨 Çocuk', teen: '🎮 Genç', adult: '📊 Yetişkin' };
              const current = getTheme(t);
              return (
                <TouchableOpacity
                  key={t}
                  style={[s.themeBtn, theme.name === t && { borderColor: current.colors.primary, backgroundColor: current.colors.primary + '22' }]}
                  onPress={() => handleThemeChange(t)}
                >
                  <Text style={s.themeBtnText}>{labels[t]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Transaction history */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Puan Ekstresi</Text>
          {transactions.length === 0 ? (
            <Text style={s.emptyText}>Henüz işlem yok</Text>
          ) : (
            transactions.map(tx => (
              <View key={tx.id} style={s.txRow}>
                <View style={s.txInfo}>
                  <Text style={s.txDesc}>{tx.description}</Text>
                  <Text style={s.txDate}>
                    {new Date(tx.createdAt).toLocaleDateString('tr-TR')} · {tx.createdByType === 'parent' ? 'Ebeveyn' : 'Sistem'}
                  </Text>
                </View>
                <Text style={[s.txAmount, tx.type === 'earned' ? s.txEarned : s.txSpent]}>
                  {tx.type === 'earned' ? '+' : '-'}{Math.round(tx.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    pinContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
    pinEmoji: { fontSize: 56, marginBottom: theme.spacing.md },
    pinTitle: { fontSize: theme.fontSizes.xxl, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 },
    pinSubtitle: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.xl },
    pinInput: {
      backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md, fontSize: theme.fontSizes.xl, color: theme.colors.text,
      borderWidth: 2, borderColor: theme.colors.border, textAlign: 'center',
      width: '60%', marginBottom: theme.spacing.md,
    },
    pinBtn: {
      backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xxl,
      marginBottom: theme.spacing.md,
    },
    pinBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: theme.fontSizes.md },
    switchProfileBtn: { marginTop: theme.spacing.md },
    switchProfileBtnText: { color: theme.colors.primary, fontSize: theme.fontSizes.sm, textDecorationLine: 'underline' },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: theme.spacing.xl, paddingBottom: theme.spacing.md,
    },
    title: { fontSize: theme.fontSizes.xl, fontWeight: 'bold', color: theme.colors.text },
    lockBtn: {
      paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.border, borderRadius: theme.borderRadius.full,
    },
    lockBtnText: { fontSize: theme.fontSizes.sm, color: theme.colors.text },
    balanceCard: {
      marginHorizontal: theme.spacing.xl, marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl, alignItems: 'center',
    },
    balanceLabel: { fontSize: theme.fontSizes.sm, color: 'rgba(255,255,255,0.8)' },
    balanceValue: { fontSize: theme.fontSizes.xxl, fontWeight: 'bold', color: '#FFFFFF' },
    card: {
      marginHorizontal: theme.spacing.xl, marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border,
    },
    cardTitle: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.sm },
    input: {
      backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm, fontSize: theme.fontSizes.md, color: theme.colors.text,
      borderWidth: 1, borderColor: theme.colors.border,
    },
    spendBtn: {
      backgroundColor: theme.colors.incorrect,
      borderRadius: theme.borderRadius.md, padding: theme.spacing.sm,
      alignItems: 'center', marginTop: theme.spacing.sm,
    },
    spendBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: theme.fontSizes.sm },
    themeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    themeBtn: {
      flex: 1, padding: theme.spacing.sm, borderRadius: theme.borderRadius.md,
      alignItems: 'center', borderWidth: 2, borderColor: theme.colors.border,
    },
    themeBtnText: { fontSize: theme.fontSizes.sm, color: theme.colors.text },
    emptyText: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, textAlign: 'center', padding: theme.spacing.md },
    txRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    txInfo: { flex: 1 },
    txDesc: { fontSize: theme.fontSizes.sm, color: theme.colors.text },
    txDate: { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
    txAmount: { fontSize: theme.fontSizes.md, fontWeight: 'bold' },
    txEarned: { color: theme.colors.correct },
    txSpent: { color: theme.colors.incorrect },
  });
