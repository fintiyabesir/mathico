import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppTheme } from './theme';

interface NumericPadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  theme: AppTheme;
  maxDigits?: number;
}

export default function NumericPad({ value, onChange, onSubmit, theme, maxDigits = 6 }: NumericPadProps) {
  const handlePress = (digit: string) => {
    if (digit === '⌫') {
      onChange(value.slice(0, -1));
    } else if (digit === 'OK') {
      if (value.length > 0) onSubmit();
    } else {
      if (value.length < maxDigits) {
        // Handle negative toggle
        if (digit === '-') {
          if (value.startsWith('-')) {
            onChange(value.slice(1));
          } else {
            onChange('-' + value);
          }
        } else {
          onChange(value + digit);
        }
      }
    }
  };

  const buttons = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['-', '0', '⌫'],
  ];

  const s = styles(theme);

  return (
    <View style={s.container}>
      <View style={s.display}>
        <Text style={s.displayText}>{value || '?'}</Text>
      </View>
      {buttons.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((btn) => (
            <TouchableOpacity
              key={btn}
              style={[s.btn, btn === '⌫' && s.btnDelete]}
              onPress={() => handlePress(btn)}
              activeOpacity={0.7}
            >
              <Text style={[s.btnText, btn === '⌫' && s.btnDeleteText]}>{btn}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <TouchableOpacity
        style={[s.okBtn, value.length === 0 && s.okBtnDisabled]}
        onPress={() => handlePress('OK')}
        activeOpacity={0.8}
        disabled={value.length === 0}
      >
        <Text style={s.okBtnText}>Cevapla</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.md,
      backgroundColor: theme.colors.numpad,
      borderRadius: theme.borderRadius.xl,
    },
    display: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      borderWidth: 2,
      borderColor: theme.colors.border,
      minHeight: 56,
      justifyContent: 'center',
    },
    displayText: {
      fontSize: theme.fontSizes.xl,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    btn: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 56,
    },
    btnDelete: {
      backgroundColor: theme.colors.warning + '33',
    },
    btnText: {
      fontSize: theme.fontSizes.lg,
      fontWeight: '600',
      color: theme.colors.numpadText,
    },
    btnDeleteText: {
      fontSize: theme.fontSizes.xl,
      color: theme.colors.text,
    },
    okBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.xs,
    },
    okBtnDisabled: {
      opacity: 0.4,
    },
    okBtnText: {
      fontSize: theme.fontSizes.md,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
  });
