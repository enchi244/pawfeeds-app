// app/_layout.tsx
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router'; // Make sure all are imported
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

// Keep the splash screen visible
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { authStatus } = useAuth();
  const isLoading = authStatus === 'loading';
  const router = useRouter();
  const segments = useSegments();

  usePushNotifications();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inApp = segments[0] === '(tabs)';
    const inAuth = segments[0] === 'login' || segments[0] === 'signup';

    // --- FIX 1: Check for your specific authenticated states ---
    const isAuthenticated =
      authStatus === 'authenticated_no_feeder' ||
      authStatus === 'authenticated_with_feeder';

    if (isAuthenticated) {
      // --- FIX 2: Removed 'segments.length === 0' ---
      // This logic now assumes your root index.tsx file correctly
      // redirects to /login if the user is unauthenticated.
      if (inAuth) {
        router.replace('/(tabs)');
      }
    } else if (authStatus === 'unauthenticated') {
      // If the user is unauthenticated and is trying to access
      // any page inside the app, redirect them to login.
      if (inApp) {
        router.replace('/login');
      }
    }

    // Hide the splash screen only after loading and routing are done
    SplashScreen.hideAsync();
  }, [isLoading, authStatus, segments, router]);

  // Render nothing while loading. The splash screen will be visible.
  if (isLoading) {
    return null;
  }

  // Once loaded, render the stack
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(provisioning)" options={{ headerShown: false }} />
      <Stack.Screen name="pet/[id]" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="schedule/[id]" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
}

// Your RootLayout function (unchanged)
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}