import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { api } from '@/src/api';
import { colors, spacing, radius, font } from '@/src/theme';

export default function NewCarScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    producer: '', model: '', year: '', engine: '',
    insurance_expiry: '', mot_expiry: '',
    tyre_type: '', colour: '', plate_number: '',
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const pickImage = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!res.granted) { setErr('Photo permission denied'); return; }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5, base64: true, allowsEditing: true, aspect: [16, 9],
    });
    if (!pick.canceled && pick.assets[0]?.base64) {
      setPhoto(`data:image/jpeg;base64,${pick.assets[0].base64}`);
    }
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
        photo_base64: photo,
      };
      Object.keys(payload).forEach(k => payload[k] === '' && (payload[k] = null));
      await api.createCar(payload);
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="new-car-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>ADD VEHICLE</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
          <Pressable testID="pick-photo-button" onPress={pickImage} style={styles.photoBox}>
            {photo ? (
              <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <>
                <Ionicons name="camera" size={28} color={colors.brand} />
                <Text style={styles.photoText}>ADD PHOTO</Text>
              </>
            )}
          </Pressable>

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
            {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.ctaText}>SAVE VEHICLE</Text>}
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
  photoBox: { height: 160, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.md, borderStyle: 'dashed' },
  photoText: { color: colors.onSurfaceTertiary, marginTop: spacing.sm, letterSpacing: 2, fontWeight: '700' },
  label: { color: colors.onSurfaceTertiary, fontSize: font.sm, letterSpacing: 2, fontWeight: '700', marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceSecondary, color: colors.onSurface, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, fontSize: font.lg },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '800', letterSpacing: 2, fontSize: font.lg },
  err: { color: colors.error, marginTop: spacing.md, fontSize: font.base },
});
