import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { api } from '@/src/api';
import { colors, spacing, radius, font } from '@/src/theme';

export default function DiagnosticsScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string) => {
    setLoading(true); setError(null);
    try { const r = await api.searchCodes(query); setResults(r); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { search(''); }, []);
  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const severityColor = (s?: string) => s === 'critical' ? colors.error : s === 'warning' ? colors.warning : colors.info;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="diagnostics-screen">
      <View style={styles.header}>
        <Text style={styles.brandMark}>◉ TROUBLE CODES</Text>
        <Text style={styles.title}>DIAGNOSTICS</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="diagnostics-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search code (e.g. P0171)"
            placeholderTextColor={colors.onSurfaceTertiary}
            autoCapitalize="characters"
            style={styles.search}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          testID="diagnostics-results"
          data={results}
          keyExtractor={(r, i) => `${r.diagnostic_id}-${r.code}-${i}`}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="terminal-outline" size={42} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>
                {q ? 'No trouble codes match this search.' : 'Upload an Xtool PDF from a vehicle to scan trouble codes.'}
              </Text>
              {error && <Text style={{ color: colors.error, marginTop: spacing.md }}>{error}</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable testID={`code-row-${item.code}`} onPress={() => router.push(`/car/${item.car_id}`)} style={styles.row}>
              <View style={[styles.codePill, { borderColor: severityColor(item.severity) }]}>
                <Text style={[styles.codeText, { color: severityColor(item.severity) }]}>{item.code}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.desc}>{item.description || 'No description'}</Text>
                <Text style={styles.meta}>{item.car_label} · {new Date(item.scanned_at).toLocaleDateString()}</Text>
                {item.system ? <Text style={styles.system}>{item.system}</Text> : null}
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
  header: { padding: spacing.lg, paddingTop: spacing.md },
  brandMark: { color: colors.brand, fontSize: font.sm, letterSpacing: 3, fontWeight: '700' },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: '800', letterSpacing: 1, marginTop: 4, marginBottom: spacing.lg },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  search: { flex: 1, color: colors.onSurface, fontSize: font.lg, paddingVertical: spacing.md, marginLeft: spacing.sm, letterSpacing: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  codePill: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  codeText: { fontWeight: '800', letterSpacing: 1, fontSize: font.base, fontVariant: ['tabular-nums'] },
  desc: { color: colors.onSurface, fontSize: font.base, fontWeight: '600' },
  meta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  system: { color: colors.brand, fontSize: font.sm, marginTop: 2, letterSpacing: 1, fontWeight: '600' },
  empty: { alignItems: 'center', padding: spacing.xxl, marginTop: spacing.xl },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.md, textAlign: 'center' },
});
