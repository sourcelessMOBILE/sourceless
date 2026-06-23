import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Dimensions, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';

import { api, API_BASE, getToken } from '@/src/api';
import { colors, spacing, radius, font } from '@/src/theme';

const SCREEN_W = Dimensions.get('window').width;

export default function CarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [car, setCar] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const [c, h] = await Promise.all([api.getCar(id), api.listDiagnostics(id)]);
      setCar(c); setHistory(h);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const upload = async () => {
    if (!id) return;
    setErr(null);
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      await api.uploadDiagnostic(id, { uri: a.uri, name: a.name, mimeType: a.mimeType });
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setUploading(false); }
  };

  const remove = async () => {
    if (!id) return;
    setUploading(true);
    try { await api.deleteCar(id); router.back(); }
    catch (e: any) { setErr(e.message); setUploading(false); }
  };

  const exportPdf = async () => {
    if (!id) return;
    setExporting(true);
    setErr(null);
    try {
      const tok = await getToken();
      if (!tok) throw new Error('Not authenticated');
      const url = `${API_BASE}/api/cars/${id}/diagnostics/export?token=${encodeURIComponent(tok)}`;
      await Linking.openURL(url);
    } catch (e: any) { setErr(e.message); }
    finally { setExporting(false); }
  };

  if (loading) {
    return <View style={[styles.safe, styles.center]}><ActivityIndicator color={colors.brand} /></View>;
  }
  if (!car) {
    return <View style={[styles.safe, styles.center]}><Text style={{ color: colors.onSurface }}>Vehicle not found</Text></View>;
  }

  const sev = (s?: string) => s === 'critical' ? colors.error : s === 'warning' ? colors.warning : colors.info;
  const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString() : '—';
  const photos: string[] = (car.photos && car.photos.length ? car.photos : (car.photo_base64 ? [car.photo_base64] : []));

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="car-detail-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>
        <View style={styles.hero}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              testID="photo-gallery">
              {photos.map((p, i) => (
                <Image key={i} source={{ uri: p }} style={{ width: SCREEN_W, height: 280 }} contentFit="cover" testID={`gallery-photo-${i}`} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.heroPh}>
              <Ionicons name="car-sport" size={64} color={colors.brand} />
            </View>
          )}
          <LinearGradient colors={["transparent", colors.surface]} style={styles.heroOverlay} pointerEvents="none" />
          <View style={styles.heroHeader} pointerEvents="box-none">
            <Pressable testID="detail-back" onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={28} color={colors.onSurface} />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable testID="edit-car" onPress={() => router.push(`/car/edit/${id}`)} hitSlop={10}>
                <Ionicons name="create-outline" size={22} color={colors.brand} />
              </Pressable>
              <Pressable testID="delete-car" onPress={remove} hitSlop={10}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </Pressable>
            </View>
          </View>
          {photos.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              {photos.map((_, i) => <View key={i} style={styles.dot} />)}
            </View>
          ) : null}
          <View style={styles.heroFooter} pointerEvents="none">
            <Text style={styles.heroPlate}>{car.plate_number}</Text>
            <Text style={styles.heroModel}>{car.producer} {car.model}</Text>
            <Text style={styles.heroSub}>{car.year} · {car.engine || '—'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPECIFICATIONS</Text>
          <View style={styles.grid}>
            <Spec label="COLOUR" value={car.colour || '—'} />
            <Spec label="TYRES" value={car.tyre_type || '—'} />
            <Spec label="INSURANCE" value={fmt(car.insurance_expiry)} />
            <Spec label="M.O.T" value={fmt(car.mot_expiry)} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>DIAGNOSTIC HISTORY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {history.length > 0 ? (
                <Pressable testID="export-pdf-button" onPress={exportPdf} disabled={exporting} style={styles.exportBtn} hitSlop={6}>
                  {exporting ? <ActivityIndicator color={colors.brand} size="small" /> : (
                    <>
                      <Ionicons name="download-outline" size={14} color={colors.brand} />
                      <Text style={styles.exportText}>  EXPORT</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
              <Text style={styles.count}>{history.length}</Text>
            </View>
          </View>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No diagnostics yet. Upload an Xtool PDF below.</Text>
          ) : (
            history.map(entry => (
              <View key={entry.id} style={styles.entry} testID={`diag-entry-${entry.id}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text style={styles.entryDate}>{new Date(entry.scanned_at).toLocaleString()}</Text>
                  <Text style={styles.entryFile} numberOfLines={1}>{entry.source_filename}</Text>
                </View>
                {(entry.trouble_codes || []).length === 0 ? (
                  <Text style={styles.emptyText}>No codes detected.</Text>
                ) : (
                  <View style={styles.codesWrap}>
                    {entry.trouble_codes.map((tc: any, i: number) => (
                      <View key={`${tc.code}-${i}`} style={[styles.codeChip, { borderColor: sev(tc.severity) }]} testID={`code-chip-${tc.code}`}>
                        <Text style={[styles.codeText, { color: sev(tc.severity) }]}>{tc.code}</Text>
                        {tc.description ? <Text style={styles.codeDesc} numberOfLines={2}>{tc.description}</Text> : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
          {err && <Text style={{ color: colors.error, marginTop: spacing.md }}>{err}</Text>}
        </View>
      </ScrollView>

      <View style={styles.stickyBar}>
        <Pressable testID="upload-pdf-button" onPress={upload} disabled={uploading} style={styles.uploadBtn}>
          {uploading ? <ActivityIndicator color={colors.onBrand} /> : (
            <>
              <Ionicons name="cloud-upload" size={20} color={colors.onBrand} />
              <Text style={styles.uploadText}>  UPLOAD XTOOL PDF</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  hero: { height: 280, backgroundColor: colors.surfaceSecondary, position: 'relative' },
  heroPh: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  heroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 200 },
  heroHeader: { position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' },
  heroFooter: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  heroPlate: { color: colors.brand, fontWeight: '800', letterSpacing: 4, fontSize: font.base },
  heroModel: { color: colors.onSurface, fontSize: 26, fontWeight: '800', marginTop: 4 },
  heroSub: { color: colors.onSurfaceTertiary, marginTop: 4 },
  dots: { position: 'absolute', top: spacing.lg, alignSelf: 'center', flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.onSurface, opacity: 0.6 },
  section: { padding: spacing.lg },
  sectionTitle: { color: colors.brand, fontSize: font.sm, letterSpacing: 3, fontWeight: '800', marginBottom: spacing.md },
  count: { color: colors.onSurfaceTertiary, fontSize: font.sm, letterSpacing: 1, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  spec: { width: '48%', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  specLabel: { color: colors.onSurfaceTertiary, fontSize: font.sm, letterSpacing: 2, fontWeight: '700' },
  specValue: { color: colors.onSurface, fontSize: font.lg, fontWeight: '700', marginTop: 4 },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.sm },
  entry: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  entryDate: { color: colors.onSurface, fontSize: font.sm, fontWeight: '700' },
  entryFile: { color: colors.onSurfaceTertiary, fontSize: font.sm, maxWidth: 180 },
  codesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  codeChip: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, maxWidth: '100%' },
  codeText: { fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  codeDesc: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 2 },
  stickyBar: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  uploadBtn: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  uploadText: { color: colors.onBrand, fontWeight: '800', letterSpacing: 2, fontSize: font.lg },
  exportBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
  exportText: { color: colors.brand, fontSize: font.sm, letterSpacing: 2, fontWeight: '800' },
});
