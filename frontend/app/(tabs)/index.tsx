import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { api } from '@/src/api';
import { colors, spacing, radius, font } from '@/src/theme';

type Car = {
  id: string; producer: string; model: string; year: number; engine: string;
  insurance_expiry?: string | null; mot_expiry?: string | null;
  tyre_type?: string | null; colour?: string | null; plate_number: string; photo_base64?: string | null;
};

const daysUntil = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso); if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

export default function GarageScreen() {
  const router = useRouter();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { const data = await api.listCars(); setCars(data); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const alerts = cars.filter(c => {
    const di = daysUntil(c.insurance_expiry); const dm = daysUntil(c.mot_expiry);
    return (di !== null && di <= 30) || (dm !== null && dm <= 30);
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="garage-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.brandMark}>◉ SAND GARAGE</Text>
          <Text style={styles.title}>MY FLEET</Text>
        </View>
        <Pressable testID="add-car-button" onPress={() => router.push('/car/new')} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={colors.onBrand} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          testID="cars-list"
          data={cars}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          ListHeaderComponent={
            alerts.length > 0 ? (
              <View style={styles.alertCard} testID="critical-alerts">
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                  <Ionicons name="warning" size={16} color={colors.warning} />
                  <Text style={styles.alertTitle}>  CRITICAL ALERTS · {alerts.length}</Text>
                </View>
                {alerts.map(c => {
                  const di = daysUntil(c.insurance_expiry); const dm = daysUntil(c.mot_expiry);
                  return (
                    <Text key={c.id} style={styles.alertItem}>
                      • {c.producer} {c.model} ({c.plate_number}) —{' '}
                      {di !== null && di <= 30 ? `INS ${di}d ` : ''}
                      {dm !== null && dm <= 30 ? `MOT ${dm}d` : ''}
                    </Text>
                  );
                })}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox} testID="empty-state">
              <Ionicons name="car-sport-outline" size={48} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyTitle}>No vehicles in the garage.</Text>
              <Text style={styles.emptySub}>Add your first car to start tracking.</Text>
              <Pressable onPress={() => router.push('/car/new')} testID="empty-add-car" style={styles.cta}>
                <Text style={styles.ctaText}>ADD VEHICLE</Text>
              </Pressable>
              {error && <Text style={{ color: colors.error, marginTop: spacing.md }}>{error}</Text>}
            </View>
          }
          renderItem={({ item }) => <CarRow car={item} onPress={() => router.push(`/car/${item.id}`)} />}
        />
      )}
    </SafeAreaView>
  );
}

function CarRow({ car, onPress }: { car: Car; onPress: () => void }) {
  const di = daysUntil(car.insurance_expiry); const dm = daysUntil(car.mot_expiry);
  const dot = (d: number | null) => d === null ? colors.onSurfaceTertiary : d < 0 ? colors.error : d <= 30 ? colors.warning : colors.success;
  return (
    <Pressable onPress={onPress} testID={`car-card-${car.id}`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={styles.cardImage}>
        {car.photo_base64 ? (
          <Image source={{ uri: car.photo_base64 }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Ionicons name="car-sport" size={32} color={colors.brand} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardPlate}>{car.plate_number}</Text>
        <Text style={styles.cardModel}>{car.producer} {car.model}</Text>
        <Text style={styles.cardSub}>{car.year} · {car.engine}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: dot(di) }]} />
          <Text style={styles.statusText}>INS {di !== null ? `${di}d` : '—'}</Text>
          <View style={[styles.statusDot, { backgroundColor: dot(dm), marginLeft: spacing.md }]} />
          <Text style={styles.statusText}>MOT {dm !== null ? `${dm}d` : '—'}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.md },
  brandMark: { color: colors.brand, fontSize: font.sm, letterSpacing: 3, fontWeight: '700' },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  addBtn: { backgroundColor: colors.brand, width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  alertCard: { backgroundColor: colors.surfaceSecondary, borderLeftWidth: 3, borderLeftColor: colors.warning, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  alertTitle: { color: colors.warning, fontWeight: '800', letterSpacing: 1, fontSize: font.sm },
  alertItem: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginVertical: 2 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardImage: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, overflow: 'hidden' },
  cardPlate: { color: colors.brand, fontWeight: '800', letterSpacing: 2, fontSize: font.sm },
  cardModel: { color: colors.onSurface, fontWeight: '700', fontSize: font.lg, marginTop: 2 },
  cardSub: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  statusText: { color: colors.onSurfaceSecondary, fontSize: font.sm, letterSpacing: 1 },
  emptyBox: { alignItems: 'center', padding: spacing.xxl, marginTop: spacing.xxl },
  emptyTitle: { color: colors.onSurface, fontWeight: '700', fontSize: font.lg, marginTop: spacing.lg },
  emptySub: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.sm, textAlign: 'center' },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.xl },
  ctaText: { color: colors.onBrand, fontWeight: '800', letterSpacing: 2 },
});
