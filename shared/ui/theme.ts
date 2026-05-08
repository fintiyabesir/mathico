import { ThemeType } from '../types';

export interface AppTheme {
  colors: {
    primary: string;
    primaryLight: string;
    secondary: string;
    background: string;
    surface: string;
    card: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    correct: string;
    incorrect: string;
    warning: string;
    border: string;
    numpad: string;
    numpadText: string;
    headerBg: string;
  };
  fontSizes: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    question: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  name: ThemeType;
}

const childTheme: AppTheme = {
  name: 'child',
  colors: {
    primary: '#FF6B6B',
    primaryLight: '#FFD93D',
    secondary: '#6BCB77',
    background: '#FFF8F0',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#2C2C2C',
    textSecondary: '#555555',
    textMuted: '#999999',
    correct: '#6BCB77',
    incorrect: '#FF6B6B',
    warning: '#FFD93D',
    border: '#FFE0B2',
    numpad: '#FFF3E0',
    numpadText: '#2C2C2C',
    headerBg: '#FF6B6B',
  },
  fontSizes: { xs: 12, sm: 14, md: 18, lg: 22, xl: 28, xxl: 36, question: 48 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
};

const teenTheme: AppTheme = {
  name: 'teen',
  colors: {
    primary: '#6C63FF',
    primaryLight: '#A89CFF',
    secondary: '#00D2A0',
    background: '#F5F4FF',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1A1A2E',
    textSecondary: '#444466',
    textMuted: '#888899',
    correct: '#00D2A0',
    incorrect: '#FF4D6D',
    warning: '#FFB703',
    border: '#E0DEFF',
    numpad: '#EEECFF',
    numpadText: '#1A1A2E',
    headerBg: '#6C63FF',
  },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 34, question: 44 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 },
};

const adultTheme: AppTheme = {
  name: 'adult',
  colors: {
    primary: '#1A73E8',
    primaryLight: '#4DABF7',
    secondary: '#2EC4B6',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#212529',
    textSecondary: '#495057',
    textMuted: '#868E96',
    correct: '#2EC4B6',
    incorrect: '#E63946',
    warning: '#FFA62B',
    border: '#DEE2E6',
    numpad: '#F1F3F5',
    numpadText: '#212529',
    headerBg: '#1A73E8',
  },
  fontSizes: { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 32, question: 40 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
};

export const themes: Record<ThemeType, AppTheme> = {
  child: childTheme,
  teen: teenTheme,
  adult: adultTheme,
};

export function getTheme(type: ThemeType): AppTheme {
  return themes[type];
}
