import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { api } from '@/src/api';
import { colors, spacing, radius, font } from '@/src/theme';

type Occurrence = {
  code: string;
  description?: string | null;
  system?: string | null;
  severity?: string | null;
  scanned_at: string;
  car_id: string;
  car_label: string;
  diagnostic_id: string;
};

const sevColor = (s?: string | null) =>
  s === 'critical' ? colors.error : s === 'warning' ? colors.warning : colors.info;

export default function CodeDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!code) return;
    setErr(null);
    try {
      const all: Occurrence[] = await api.searchCodes(code);
      // exact-code filter so P0171 ≠ P0171X
      setItems(all.filter(it => (it.code || '').toUpperCase() === code.toUpperCase()));
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [code]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const first = items[0];
  const severity = first?.severity || 'info';
  const description = first?.description || '';
  const system = first?.system || '';
  const sc = sevColor(severity);

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="code-detail-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>TROUBLE CODE</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.codeHero, { borderColor: sc }]} testID="code-hero">
        <Text style={[styles.codeBig, { color: sc }]}>{(code || '').toUpperCase()}</Text>
        <Text style={styles.codeSev}>{severity.toUpperCase()}</Text>
        {description ? <Text style={styles.codeDesc}>{description}</Text> : null}
        {system ? <Text style={styles.codeSystem}>{system}</Text> : null}
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countTitle}>OCCURRENCES</Text>
        <Text style={styles.countNum}>{items.length}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          testID="occurrences-list"
          data={items}
          keyExtractor={(it, i) => `${it.diagnostic_id}-${i}`}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxxl }}
          ListEmptyComponent={
            <View style={styles.empty} testID="empty-occurrences">
              <Ionicons name="documents-outline" size={42} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>
                No occurrences found for this code.
              </Text>
              {err && <Text style={{ color: colors.error, marginTop: spacing.md }}>{err}</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`occurrence-${item.diagnostic_id}`}
              onPress={() => router.push(`/car/${item.car_id}`)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowCar}>{item.car_label}</Text>
                <Text style={styles.rowDate}>{new Date(item.scanned_at).toLocaleString()}</Text>
                {item.description && item.description !== description ? (
                  <Text style={styles.rowDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { color: colors.onSurface, fontWeight: '800', fontSize: font.xl, letterSpacing: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  codeHero: { marginHorizontal: spacing.lg, padding: spacing.lg, borderWidth: 1.5, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  codeBig: { fontSize: 36, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] },
  codeSev: { color: colors.onSurfaceTertiary, fontSize: font.sm, letterSpacing: 3, fontWeight: '700', marginTop: 2 },
  codeDesc: { color: colors.onSurface, fontSize: font.base, marginTop: spacing.md, lineHeight: 20 },
  codeSystem: { color: colors.brand, fontSize: font.sm, letterSpacing: 2, fontWeight: '700', marginTop: spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  countTitle: { color: colors.brand, fontSize: font.sm, letterSpacing: 3, fontWeight: '800' },
  countNum: { color: colors.onSurfaceTertiary, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  rowCar: { color: colors.onSurface, fontWeight: '700', fontSize: font.base },
  rowDate: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  rowDesc: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 4 },
  empty: { alignItems: 'center', padding: spacing.xxl, marginTop: spacing.lg },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.md, textAlign: 'center' },
});
