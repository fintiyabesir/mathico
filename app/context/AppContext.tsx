import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserProfile } from '../../shared/types';
import { AppTheme, getTheme } from '../../shared/ui/theme';
import { ThemeType } from '../../shared/types';

interface AppContextValue {
  activeProfile: UserProfile | null;
  setActiveProfile: (profile: UserProfile | null) => void;
  theme: AppTheme;
  setTheme: (type: ThemeType) => void;
}

const AppContext = createContext<AppContextValue>({
  activeProfile: null,
  setActiveProfile: () => {},
  theme: getTheme('child'),
  setTheme: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeProfile, setActiveProfileState] = useState<UserProfile | null>(null);
  const [theme, setThemeState] = useState<AppTheme>(getTheme('child'));

  const setActiveProfile = (profile: UserProfile | null) => {
    setActiveProfileState(profile);
    if (profile) {
      setThemeState(getTheme(profile.selectedTheme));
    }
  };

  const setTheme = (type: ThemeType) => {
    setThemeState(getTheme(type));
  };

  return (
    <AppContext.Provider value={{ activeProfile, setActiveProfile, theme, setTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
