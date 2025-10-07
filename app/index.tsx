import React from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// --- Color Palette ---
const COLORS = {
  primary: '#8C6E63', // Kibble Brown
  accent: '#FFC107', // Golden Hour Yellow
  background: '#F5F5F5', // Soft Cream
  text: '#333333', // Charcoal Gray
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
};

// --- Main Login Screen Component ---
export default function LoginScreen() {
  // --- Event Handlers (will be implemented later) ---
  const handleLogin = () => {
    Alert.alert('Login Pressed', 'Firebase login logic will go here.');
  };

  const handleCreateAccount = () => {
    Alert.alert(
      'Create Account Pressed',
      'Navigation to the sign-up screen will go here.'
    );
  };

  const handleGoogleSignIn = () => {
    Alert.alert(
      'Google Sign-In Pressed',
      'Firebase Google Sign-In logic will go here.'
    );
  };

  // --- Rendered UI ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.content}>
        {/* --- Header Section --- */}
        <View style={styles.header}>
          <Text style={styles.logo}>PawFeeds</Text>
          <Text style={styles.tagline}>Your pets personal chef.</Text>
        </View>

        {/* --- Form Section --- */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry
          />
          <TouchableOpacity style={styles.buttonPrimary} onPress={handleLogin}>
            <Text style={styles.buttonPrimaryText}>Login</Text>
          </TouchableOpacity>
        </View>

        {/* --- Or Divider --- */}
        <Text style={styles.dividerText}>OR</Text>

        {/* --- Social & Other Actions Section --- */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handleGoogleSignIn}>
            <Text style={styles.buttonSecondaryText}>Sign in with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handleCreateAccount}>
            <Text style={styles.buttonSecondaryText}>Create an Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// --- Stylesheet ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  tagline: {
    fontSize: 16,
    color: COLORS.text,
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    color: COLORS.text,
  },
  buttonPrimary: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  dividerText: {
    textAlign: 'center',
    color: '#aaa',
    marginVertical: 24,
    fontWeight: '500',
  },
  actions: {
    width: '100%',
  },
  buttonSecondary: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});

