import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import CarFormScreen, { EMPTY_CAR, CarFormValue } from '@/src/CarForm';
import { api } from '@/src/api';
import { colors } from '@/src/theme';

export default function EditCarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initial, setInitial] = useState<CarFormValue | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const car = await api.getCar(id);
      setInitial({
        ...EMPTY_CAR,
        producer: car.producer || '',
        model: car.model || '',
        year: car.year ? String(car.year) : '',
        engine: car.engine || '',
        insurance_expiry: car.insurance_expiry || '',
        mot_expiry: car.mot_expiry || '',
        tyre_type: car.tyre_type || '',
        colour: car.colour || '',
        plate_number: car.plate_number || '',
        photos: car.photos || (car.photo_base64 ? [car.photo_base64] : []),
      });
    })();
  }, [id]);

  if (!initial) {
    return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  }

  return (
    <CarFormScreen
      mode="edit"
      title="EDIT VEHICLE"
      initial={initial}
      onSubmit={async (payload) => { await api.updateCar(id!, payload); }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
