import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/src/auth';
import { colors, spacing, radius, font } from '@/src/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('demo@sandgarage.app');
  const [password, setPassword] = useState('Demo12345!');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true); setError(null);
    try { await login(email.trim(), password); router.replace('/(tabs)'); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.brandMark}>◉ SOURCELESS</Text>
            <Text style={styles.title}>SAND GARAGE</Text>
            <Text style={styles.subtitle}>Your virtual fleet command center.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@email.com"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
            {error && <Text testID="login-error" style={styles.error}>{error}</Text>}
            <Pressable testID="login-submit-button" onPress={onSubmit} disabled={busy} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}>
              <Text style={styles.ctaText}>{busy ? 'SIGNING IN…' : 'SIGN IN'}</Text>
            </Pressable>
            <Link href="/(auth)/register" asChild>
              <Pressable testID="login-go-register" style={styles.linkBtn}>
                <Text style={styles.linkText}>New here? <Text style={{ color: colors.brand }}>Create account</Text></Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  brand: { marginBottom: spacing.xxxl },
  brandMark: { color: colors.brand, fontSize: font.sm, letterSpacing: 4, marginBottom: spacing.sm, fontWeight: '700' },
  title: { color: colors.onSurface, fontSize: 36, fontWeight: '800', letterSpacing: 1 },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.sm },
  form: {},
  label: { color: colors.onSurfaceTertiary, fontSize: font.sm, letterSpacing: 2, marginBottom: spacing.sm, marginTop: spacing.md, fontWeight: '700' },
  input: {
    backgroundColor: colors.surfaceSecondary,
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    fontSize: font.lg,
  },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.brand,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaText: { color: colors.onBrand, fontWeight: '800', letterSpacing: 2, fontSize: font.lg },
  linkBtn: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: colors.onSurfaceSecondary, fontSize: font.base },
  error: { color: colors.error, marginTop: spacing.md, fontSize: font.base },
});
