import AsyncStorage from '@react-native-async-storage/async-storage';

const API = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'sg_token';
const USER_KEY = 'sg_user';

export type User = { id: string; email: string; full_name?: string };

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(t: string) { await AsyncStorage.setItem(TOKEN_KEY, t); }
export async function clearToken() { await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]); }

export async function setStoredUser(u: User) { await AsyncStorage.setItem(USER_KEY, JSON.stringify(u)); }
export async function getStoredUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function request(path: string, options: RequestInit = {}, isJson = true): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as any),
  };
  if (isJson && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}/api${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail || JSON.stringify(j); } catch {}
    throw new Error(detail);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  register: (email: string, password: string, full_name?: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, full_name }) }),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),

  listCars: () => request('/cars'),
  getCar: (id: string) => request(`/cars/${id}`),
  createCar: (data: any) => request('/cars', { method: 'POST', body: JSON.stringify(data) }),
  updateCar: (id: string, data: any) => request(`/cars/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCar: (id: string) => request(`/cars/${id}`, { method: 'DELETE' }),

  listDiagnostics: (carId: string) => request(`/cars/${carId}/diagnostics`),
  uploadDiagnostic: async (carId: string, file: { uri: string; name: string; mimeType?: string }) => {
    const form = new FormData();
    // @ts-ignore RN FormData file
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/pdf' });
    return request(`/cars/${carId}/diagnostics/upload`, { method: 'POST', body: form }, false);
  },
  deleteDiagnostic: (id: string) => request(`/diagnostics/${id}`, { method: 'DELETE' }),
  searchCodes: (q: string) => request(`/diagnostics/search?q=${encodeURIComponent(q)}`),
};
