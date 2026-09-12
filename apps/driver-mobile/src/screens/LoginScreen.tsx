import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { BrandMark, BrandWordmark, Button, Pill } from '../components/ui';
import { colors, radii, spacing } from '../lib/theme';
import { isSupabaseConfigured } from '../lib/supabase';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Configuration Supabase manquante.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Email et mot de passe requis.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <BrandMark size={132} />
          <View style={{ marginTop: 18 }}>
            <BrandWordmark light />
          </View>
          <Pill label="LIVRAISON" />
          <Text style={styles.heroSub}>Espace livreur — courses, GPS & portefeuille</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Connexion</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="livreur@exemple.com"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title="Se connecter"
            variant="accent"
            loading={loading}
            onPress={onSubmit}
            style={{ marginTop: 16 }}
          />
          <Text style={styles.hint}>
            Compte livreur validé AfriZone — mêmes identifiants que le site.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand },
  scroll: { flexGrow: 1 },
  hero: {
    paddingTop: 64,
    paddingHorizontal: spacing.lg,
    paddingBottom: 36,
    alignItems: 'center',
    backgroundColor: colors.brand,
  },
  heroGlow: {
    position: 'absolute',
    top: 40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245,166,35,0.18)',
  },
  heroSub: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    marginTop: -8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.ink,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    marginTop: 12,
    fontWeight: '700',
  },
  hint: {
    marginTop: 16,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
