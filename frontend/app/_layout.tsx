import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar, View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/auth";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    else if (user && inAuth) router.replace('/(tabs)');
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
