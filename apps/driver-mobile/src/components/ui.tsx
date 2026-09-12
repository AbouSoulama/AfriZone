import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '../lib/theme';

type ButtonProps = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';
  style?: ViewStyle;
};

export function Button({
  title,
  loading,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const bg =
    variant === 'primary'
      ? colors.brand
      : variant === 'accent'
        ? colors.accent
        : variant === 'danger'
          ? colors.danger
          : variant === 'secondary'
            ? colors.ink
            : 'transparent';
  const textColor =
    variant === 'ghost' ? colors.brand : variant === 'accent' ? colors.ink : colors.white;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          opacity: disabled || loading ? 0.5 : pressed ? 0.88 : 1,
        },
        variant === 'ghost' && styles.ghost,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

export function BrandMark({ size = 120 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/logo-livraison.jpg')}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      resizeMode="cover"
    />
  );
}

export function BrandWordmark({ light = false }: { light?: boolean }) {
  return (
    <Text style={styles.wordmark}>
      <Text style={{ color: light ? colors.white : colors.ink }}>Afri</Text>
      <Text style={{ color: colors.accent }}>Zone</Text>
    </Text>
  );
}

export function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  btn: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  ghost: {
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  btnText: {
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#1FAE4B',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 6,
    color: colors.muted,
    textAlign: 'center',
  },
  wordmark: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pillText: {
    color: colors.brandDark,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
  },
});
