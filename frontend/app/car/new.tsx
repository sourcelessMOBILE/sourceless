import React from 'react';
import CarFormScreen from '@/src/CarForm';
import { api } from '@/src/api';

export default function NewCarScreen() {
  return (
    <CarFormScreen
      mode="create"
      title="ADD VEHICLE"
      onSubmit={async (payload) => { await api.createCar(payload); }}
    />
  );
}
