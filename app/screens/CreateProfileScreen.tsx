import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { createProfile } from '../../features/profile/profileService';
import { getOrCreateLevelProgress } from '../../features/progression/progressionEngine';
import { getStartLevel } from '../../features/practice/questionEngine';
import { AgeGroup, DifficultyPreference } from '../../shared/types';
import { AVATARS } from '../../shared/lib/constants';
import { useAppContext } from '../context/AppContext';
import { getTheme, AppTheme } from '../../shared/ui/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreateProfile'>;
};

const AGE_GROUPS: AgeGroup[] = ['4-6', '7-9', '10-12', '13-17', '18+'];
const DIFFICULTY_OPTIONS: { value: DifficultyPreference; label: string; desc: string }[] = [
  { value: 'easy', label: 'Kolaydan Başla', desc: 'Temel sorularla başla' },
  { value: 'medium', label: 'Ortadan Başla', desc: 'Normal zorlukla başla' },
  { value: 'hard', label: 'Zordan Başla', desc: 'Hemen zorlu sorulara geç' },
];

export default function CreateProfileScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [selectedAge, setSelectedAge] = useState<AgeGroup>('7-9');
  const [selectedDiff, setSelectedDiff] = useState<DifficultyPreference>('medium');
  const [loading, setLoading] = useState(false);
  const { setActiveProfile } = useAppContext();
  const theme = getTheme('child');
  const s = styles(theme);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('İsim Gerekli', 'Lütfen bir isim gir.');
      return;
    }
    setLoading(true);
    try {
      const profile = await createProfile(name.trim(), selectedAvatar, selectedAge, selectedDiff);
      // Initialize level progress for all operations
      const ops = ['addition', 'subtraction', 'multiplication', 'division'];
      const startLevel = getStartLevel(selectedAge, selectedDiff);
      for (const op of ops) {
        await getOrCreateLevelProgress(profile.id, `skill_${op}`, startLevel);
      }
      setActiveProfile(profile);
      navigation.replace('Home');
    } catch (e) {
      Alert.alert('Hata', 'Profil oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Yeni Profil</Text>

        {/* Name input */}
        <View style={s.section}>
          <Text style={s.label}>İsmin ne?</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="İsim gir..."
            placeholderTextColor={theme.colors.textMuted}
            maxLength={20}
          />
        </View>

        {/* Avatar selector */}
        <View style={s.section}>
          <Text style={s.label}>Avatarını seç</Text>
          <View style={s.avatarGrid}>
            {AVATARS.map(av => (
              <TouchableOpacity
                key={av}
                style={[s.avatarBtn, selectedAvatar === av && s.avatarBtnSelected]}
                onPress={() => setSelectedAvatar(av)}
              >
                <Text style={s.avatarText}>{av}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Age group */}
        <View style={s.section}>
          <Text style={s.label}>Yaş grubu</Text>
          <View style={s.optionRow}>
            {AGE_GROUPS.map(ag => (
              <TouchableOpacity
                key={ag}
                style={[s.chip, selectedAge === ag && s.chipSelected]}
                onPress={() => setSelectedAge(ag)}
              >
                <Text style={[s.chipText, selectedAge === ag && s.chipTextSelected]}>{ag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Difficulty */}
        <View style={s.section}>
          <Text style={s.label}>Nereden başlayalım?</Text>
          {DIFFICULTY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.diffBtn, selectedDiff === opt.value && s.diffBtnSelected]}
              onPress={() => setSelectedDiff(opt.value)}
            >
              <Text style={[s.diffBtnTitle, selectedDiff === opt.value && s.diffBtnTitleSelected]}>
                {opt.label}
              </Text>
              <Text style={s.diffBtnDesc}>{opt.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.createBtn, loading && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={s.createBtnText}>{loading ? 'Oluşturuluyor...' : 'Profili Oluştur 🚀'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing.xl, paddingBottom: 48 },
    title: { fontSize: theme.fontSizes.xxl, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.xl, textAlign: 'center' },
    section: { marginBottom: theme.spacing.xl },
    label: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.sm },
    input: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      fontSize: theme.fontSizes.lg,
      color: theme.colors.text,
      borderWidth: 2, borderColor: theme.colors.border,
    },
    avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    avatarBtn: {
      width: 52, height: 52,
      borderRadius: theme.borderRadius.md,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 2, borderColor: theme.colors.border,
    },
    avatarBtnSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '22' },
    avatarText: { fontSize: 28 },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 2, borderColor: theme.colors.border,
    },
    chipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    chipText: { fontSize: theme.fontSizes.sm, fontWeight: '600', color: theme.colors.text },
    chipTextSelected: { color: '#FFFFFF' },
    diffBtn: {
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 2, borderColor: theme.colors.border,
      marginBottom: theme.spacing.sm,
    },
    diffBtnSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '11' },
    diffBtnTitle: { fontSize: theme.fontSizes.md, fontWeight: '600', color: theme.colors.text },
    diffBtnTitleSelected: { color: theme.colors.primary },
    diffBtnDesc: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, marginTop: 2 },
    createBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    createBtnText: { fontSize: theme.fontSizes.lg, fontWeight: 'bold', color: '#FFFFFF' },
  });
