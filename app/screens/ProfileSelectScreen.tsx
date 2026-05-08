import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getAllProfiles } from '../../features/profile/profileService';
import { UserProfile } from '../../shared/types';
import { useAppContext } from '../context/AppContext';
import { getTheme } from '../../shared/ui/theme';
import { AppTheme } from '../../shared/ui/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProfileSelect'>;
};

export default function ProfileSelectScreen({ navigation }: Props) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { setActiveProfile } = useAppContext();
  const theme = getTheme('child');

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      const ps = await getAllProfiles();
      setProfiles(ps);
      if (ps.length === 1) {
        // Auto-select single profile
        setActiveProfile(ps[0]);
        navigation.replace('Home');
      }
    } finally {
      setLoading(false);
    }
  }

  function selectProfile(profile: UserProfile) {
    setActiveProfile(profile);
    navigation.replace('Home');
  }

  const s = styles(theme);

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Kim oynuyor? 👋</Text>
        <Text style={s.subtitle}>Profilini seç</Text>
      </View>

      {profiles.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyEmoji}>📚</Text>
          <Text style={s.emptyText}>Henüz profil yok</Text>
          <Text style={s.emptySubText}>Başlamak için bir profil oluştur</Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          numColumns={2}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.profileCard} onPress={() => selectProfile(item)} activeOpacity={0.8}>
              <Text style={s.avatar}>{item.avatar}</Text>
              <Text style={s.profileName}>{item.displayName}</Text>
              <Text style={s.ageGroup}>{item.ageGroup} yaş</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={s.addButton}
        onPress={() => navigation.navigate('CreateProfile')}
        activeOpacity={0.8}
      >
        <Text style={s.addButtonText}>+ Yeni Profil</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.md, alignItems: 'center' },
    title: { fontSize: theme.fontSizes.xxl, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 },
    subtitle: { fontSize: theme.fontSizes.md, color: theme.colors.textSecondary },
    list: { padding: theme.spacing.md, gap: theme.spacing.md },
    profileCard: {
      flex: 1, margin: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      alignItems: 'center',
      borderWidth: 2, borderColor: theme.colors.border,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    avatar: { fontSize: 52, marginBottom: theme.spacing.sm },
    profileName: { fontSize: theme.fontSizes.lg, fontWeight: 'bold', color: theme.colors.text, textAlign: 'center' },
    ageGroup: { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, marginTop: 2 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
    emptyEmoji: { fontSize: 64, marginBottom: theme.spacing.md },
    emptyText: { fontSize: theme.fontSizes.xl, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
    emptySubText: { fontSize: theme.fontSizes.md, color: theme.colors.textSecondary, textAlign: 'center' },
    addButton: {
      margin: theme.spacing.xl,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      alignItems: 'center',
    },
    addButtonText: { fontSize: theme.fontSizes.md, fontWeight: 'bold', color: '#FFFFFF' },
  });
