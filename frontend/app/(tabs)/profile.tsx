import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/src/auth';
import { colors, spacing, radius, font } from '@/src/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="profile-screen">
      <View style={styles.header}>
        <Text style={styles.brandMark}>◉ PROFILE</Text>
        <Text style={styles.title}>ACCOUNT</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color={colors.brand} />
        </View>
        <View>
          <Text style={styles.name}>{user?.full_name || 'Driver'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      <Pressable
        testID="logout-button"
        onPress={async () => { await logout(); router.replace('/(auth)/login'); }}
        style={styles.logoutBtn}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>LOG OUT</Text>
      </Pressable>

      <View style={{ flex: 1 }} />
      <Text style={styles.footer}>SourceLess Sand Garage · v1.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  header: { paddingTop: spacing.md, marginBottom: spacing.xl },
  brandMark: { color: colors.brand, fontSize: font.sm, letterSpacing: 3, fontWeight: '700' },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg },
  name: { color: colors.onSurface, fontWeight: '700', fontSize: font.lg },
  email: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSecondary, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border, gap: 8 },
  logoutText: { color: colors.error, fontWeight: '800', letterSpacing: 2, marginLeft: spacing.sm },
  footer: { color: colors.onSurfaceTertiary, textAlign: 'center', fontSize: font.sm, padding: spacing.lg },
});
