import { Redirect, Stack } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

const COLORS = {
  primary: '#8C6E63',
  background: '#F5F5F5',
};

// Custom hook to manage authentication state and device provisioning status
function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasDevice, setHasDevice] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          // New user, create document and set hasDevice to false
          await setDoc(userDocRef, { feederId: null });
          setHasDevice(false);
        } else {
          // Existing user, check for feederId
          setHasDevice(!!userDoc.data().feederId);
        }
      } else {
        // User is signed out
        setUser(null);
        setHasDevice(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, isLoading, hasDevice };
}

export default function AppLayout() {
  const { user, isLoading, hasDevice } = useSession();

  if (isLoading || hasDevice === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (user && !hasDevice) {
    return <Redirect href="/provisioning" />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return (
    <Stack>
      <Stack.Screen name="provisioning" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="account/account" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});