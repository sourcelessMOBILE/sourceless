import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/src/auth';
import { colors, spacing, radius, font } from '@/src/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true); setError(null);
    try { await register(email.trim(), password, name.trim()); router.replace('/(tabs)'); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} testID="register-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.brandMark}>◉ SOURCELESS</Text>
          <Text style={styles.title}>CREATE ACCOUNT</Text>
          <Text style={styles.subtitle}>Start tracking your fleet in seconds.</Text>

          <Text style={styles.label}>FULL NAME</Text>
          <TextInput testID="register-name-input" value={name} onChangeText={setName} placeholder="Alex Driver" placeholderTextColor={colors.onSurfaceTertiary} style={styles.input} />

          <Text style={styles.label}>EMAIL</Text>
          <TextInput testID="register-email-input" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@email.com" placeholderTextColor={colors.onSurfaceTertiary} style={styles.input} />

          <Text style={styles.label}>PASSWORD (min 6)</Text>
          <TextInput testID="register-password-input" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.onSurfaceTertiary} style={styles.input} />

          {error && <Text testID="register-error" style={styles.error}>{error}</Text>}

          <Pressable testID="register-submit-button" onPress={onSubmit} disabled={busy} style={styles.cta}>
            <Text style={styles.ctaText}>{busy ? 'CREATING…' : 'CREATE ACCOUNT'}</Text>
          </Pressable>

          <Link href="/(auth)/login" asChild>
            <Pressable testID="register-go-login" style={styles.linkBtn}>
              <Text style={styles.linkText}>Already have an account? <Text style={{ color: colors.brand }}>Sign in</Text></Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  brandMark: { color: colors.brand, fontSize: font.sm, letterSpacing: 4, marginBottom: spacing.sm, fontWeight: '700' },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: '800', letterSpacing: 1 },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.sm, marginBottom: spacing.xl },
  label: { color: colors.onSurfaceTertiary, fontSize: font.sm, letterSpacing: 2, marginBottom: spacing.sm, marginTop: spacing.md, fontWeight: '700' },
  input: { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, fontSize: font.lg },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '800', letterSpacing: 2, fontSize: font.lg },
  linkBtn: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: colors.onSurfaceSecondary, fontSize: font.base },
  error: { color: colors.error, marginTop: spacing.md, fontSize: font.base },
});
