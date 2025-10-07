import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function StartPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // While loading, you can show a loading indicator or just a blank screen.
    // The splash screen will cover this anyway.
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (user) {
    // If the user is authenticated, redirect to the main app layout.
    return <Redirect href="/(tabs)" />;
  } else {
    // If the user is not authenticated, redirect to the login screen.
    return <Redirect href="/login" />;
  }
}