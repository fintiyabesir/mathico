import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import { RootStackParamList, TabParamList } from './types';
import { useAppContext } from '../context/AppContext';

import ProfileSelectScreen from '../screens/ProfileSelectScreen';
import CreateProfileScreen from '../screens/CreateProfileScreen';
import HomeScreen from '../screens/HomeScreen';
import SessionScreen from '../screens/SessionScreen';
import SessionEndScreen from '../screens/SessionEndScreen';
import ReportsScreen from '../screens/ReportsScreen';
import RewardsScreen from '../screens/RewardsScreen';
import ParentScreen from '../screens/ParentScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ emoji, focused, color }: { emoji: string; focused: boolean; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: focused ? 26 : 22 }}>{emoji}</Text>
    </View>
  );
}

function MainTabs() {
  const { theme } = useAppContext();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Ana Sayfa',
          tabBarIcon: ({ focused, color }) => <TabIcon emoji="🏠" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen}
        options={{
          tabBarLabel: 'Raporlar',
          tabBarIcon: ({ focused, color }) => <TabIcon emoji="📊" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="RewardsTab"
        component={RewardsScreen}
        options={{
          tabBarLabel: 'Ödüller',
          tabBarIcon: ({ focused, color }) => <TabIcon emoji="🏆" focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="ParentTab"
        component={ParentScreen}
        options={{
          tabBarLabel: 'Ebeveyn',
          tabBarIcon: ({ focused, color }) => <TabIcon emoji="👨‍👩‍👧" focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ProfileSelect" component={ProfileSelectScreen} />
        <Stack.Screen name="CreateProfile" component={CreateProfileScreen} />
        <Stack.Screen name="Home" component={MainTabs} />
        <Stack.Screen name="Session" component={SessionScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="SessionEnd" component={SessionEndScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Parent" component={ParentScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
