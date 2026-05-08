import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppTheme } from './theme';

interface MultipleChoiceProps {
  choices: number[];
  onSelect: (answer: string) => void;
  theme: AppTheme;
  disabled?: boolean;
  correctAnswer?: string;
  selectedAnswer?: string;
}

export default function MultipleChoice({
  choices,
  onSelect,
  theme,
  disabled = false,
  correctAnswer,
  selectedAnswer,
}: MultipleChoiceProps) {
  const s = styles(theme);

  const getButtonStyle = (choice: number) => {
    if (!selectedAnswer) return s.btn;
    const choiceStr = String(choice);
    if (choiceStr === selectedAnswer) {
      if (choiceStr === correctAnswer) return [s.btn, s.btnCorrect];
      return [s.btn, s.btnIncorrect];
    }
    if (choiceStr === correctAnswer && selectedAnswer) return [s.btn, s.btnCorrect];
    return s.btn;
  };

  return (
    <View style={s.container}>
      {choices.map((choice) => (
        <TouchableOpacity
          key={String(choice)}
          style={getButtonStyle(choice)}
          onPress={() => !disabled && onSelect(String(choice))}
          activeOpacity={0.75}
          disabled={disabled}
        >
          <Text style={s.btnText}>{choice}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    btn: {
      width: '47%',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.border,
      minHeight: 72,
    },
    btnCorrect: {
      backgroundColor: theme.colors.correct + '22',
      borderColor: theme.colors.correct,
    },
    btnIncorrect: {
      backgroundColor: theme.colors.incorrect + '22',
      borderColor: theme.colors.incorrect,
    },
    btnText: {
      fontSize: theme.fontSizes.xl,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
  });
