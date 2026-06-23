import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, radius, font } from './theme';

export type CarFormValue = {
  producer: string;
  model: string;
  year: string;
  engine: string;
  insurance_expiry: string;
  mot_expiry: string;
  tyre_type: string;
  colour: string;
  plate_number: string;
  photos: string[];
};

export const EMPTY_CAR: CarFormValue = {
  producer: '', model: '', year: '', engine: '',
  insurance_expiry: '', mot_expiry: '',
  tyre_type: '', colour: '', plate_number: '', photos: [],
};

type Props = {
  mode: 'create' | 'edit';
  initial?: Partial<CarFormValue>;
  onSubmit: (payload: any) => Promise<void>;
  title: string;
};

export default function CarFormScreen({ mode, initial, onSubmit, title }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CarFormValue>({ ...EMPTY_CAR, ...(initial || {}) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (initial) setForm(f => ({ ...EMPTY_CAR, ...initial, ...f, photos: initial.photos ?? f.photos }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof CarFormValue) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const addPhotos = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!res.granted) { setErr('Photo permission denied'); return; }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5, base64: true, allowsMultipleSelection: true, selectionLimit: 6,
    });
    if (!pick.canceled && pick.assets?.length) {
      const newPhotos = pick.assets
        .filter(a => a.base64)
        .map(a => `data:image/jpeg;base64,${a.base64}`);
      setForm(f => ({ ...f, photos: [...f.photos, ...newPhotos].slice(0, 12) }));
    }
  };

  const removePhoto = (idx: number) => {
    setForm(f => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    setErr(null);
    if (!form.producer || !form.model || !form.plate_number || !form.year) {
      setErr('Producer, Model, Year and Plate Number are required.'); return;
    }
    setBusy(true);
    try {
      const payload: any = {
        ...form,
        year: parseInt(form.year, 10) || 0,
      };
      Object.keys(payload).forEach(k => payload[k] === '' && (payload[k] = null));
      // ensure photos array is sent (empty allowed for clearing)
      payload.photos = form.photos;
      delete payload.photo_base64; // server derives from photos[0]
      await onSubmit(payload);
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID={`${mode}-car-screen`}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>PHOTOS  ({form.photos.length}/12)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
            {form.photos.map((p, i) => (
              <View key={i} style={styles.photoThumb} testID={`photo-thumb-${i}`}>
                <Image source={{ uri: p }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                <Pressable testID={`remove-photo-${i}`} onPress={() => removePhoto(i)} style={styles.photoRemove} hitSlop={6}>
                  <Ionicons name="close" size={16} color={colors.onBrand} />
                </Pressable>
              </View>
            ))}
            <Pressable testID="add-photo-button" onPress={addPhotos} style={[styles.photoThumb, styles.photoAdd]}>
              <Ionicons name="add" size={28} color={colors.brand} />
              <Text style={styles.photoAddText}>ADD</Text>
            </Pressable>
          </ScrollView>

          <Field label="PRODUCER *" testID="field-producer" value={form.producer} onChange={set('producer')} placeholder="BMW" />
          <Field label="MODEL *" testID="field-model" value={form.model} onChange={set('model')} placeholder="M3 Competition" />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field label="YEAR *" testID="field-year" value={form.year} onChange={set('year')} placeholder="2023" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="COLOUR" testID="field-colour" value={form.colour} onChange={set('colour')} placeholder="Black" />
            </View>
          </View>
          <Field label="ENGINE" testID="field-engine" value={form.engine} onChange={set('engine')} placeholder="3.0L Twin-Turbo I6" />
          <Field label="PLATE NUMBER *" testID="field-plate" value={form.plate_number} onChange={set('plate_number')} placeholder="ABC 123" autoCapitalize="characters" />
          <Field label="INSURANCE EXPIRY (YYYY-MM-DD)" testID="field-insurance" value={form.insurance_expiry} onChange={set('insurance_expiry')} placeholder="2026-12-31" />
          <Field label="M.O.T EXPIRY (YYYY-MM-DD)" testID="field-mot" value={form.mot_expiry} onChange={set('mot_expiry')} placeholder="2026-08-15" />
          <Field label="TYRE TYPE" testID="field-tyres" value={form.tyre_type} onChange={set('tyre_type')} placeholder="Summer / Winter / All-season" />

          {err && <Text style={styles.err} testID="form-error">{err}</Text>}

          <Pressable testID="save-car-button" onPress={save} disabled={busy} style={styles.cta}>
            {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.ctaText}>{mode === 'create' ? 'SAVE VEHICLE' : 'UPDATE VEHICLE'}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, testID, keyboardType, autoCapitalize }: any) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={colors.onSurfaceTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { color: colors.onSurface, fontWeight: '800', fontSize: font.xl, letterSpacing: 2 },
  label: { color: colors.onSurfaceTertiary, fontSize: font.sm, letterSpacing: 2, fontWeight: '700', marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, fontSize: font.lg },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '800', letterSpacing: 2, fontSize: font.lg },
  err: { color: colors.error, marginTop: spacing.md, fontSize: font.base },
  photoThumb: { width: 110, height: 80, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, position: 'relative' },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.error, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  photoAdd: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoAddText: { color: colors.brand, fontSize: 11, letterSpacing: 2, marginTop: 2, fontWeight: '700' },
});
