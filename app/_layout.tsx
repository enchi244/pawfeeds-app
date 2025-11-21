import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { authStatus } = useAuth();
  const isLoading = authStatus === 'loading';
  const router = useRouter();
  const segments = useSegments();

  usePushNotifications();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)' || segments[0] === 'login' || segments[0] === 'signup';
    const inAdminGroup = segments[0] === 'admin';
    const inAppGroup = segments[0] === '(tabs)';

    // --- 1. HANDLE ADMIN REDIRECT ---
    if (authStatus === 'authenticated_admin') {
      // If they are an admin but NOT in the admin folder, send them there
      if (!inAdminGroup) {
        router.replace('/admin');
      }
    } 
    // --- 2. HANDLE USER REDIRECT ---
    else if (
      authStatus === 'authenticated_no_feeder' || 
      authStatus === 'authenticated_with_feeder'
    ) {
      // If logged in user is in auth pages or admin pages, send to tabs
      if (inAuthGroup || inAdminGroup) {
         router.replace('/(tabs)');
      }
    } 
    // --- 3. HANDLE UNAUTHENTICATED ---
    else if (authStatus === 'unauthenticated') {
      if (!inAuthGroup) {
        router.replace('/login');
      }
    }

    SplashScreen.hideAsync();
  }, [isLoading, authStatus, segments, router]);

  if (isLoading) return null;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(provisioning)" options={{ headerShown: false }} />
      {/* --- ADD THE ADMIN ROUTE --- */}
      <Stack.Screen name="admin" options={{ headerShown: false }} /> 
      
      <Stack.Screen name="pet/[id]" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="schedule/[id]" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}