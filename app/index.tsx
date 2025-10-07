import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../firebaseConfig';

const COLORS = {
  primary: '#8C6E63',
  accent: '#FFC107',
  background: '#F5F5FF',
  text: '#333333',
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const auth = getAuth(app);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      Alert.alert('Success', 'Logged in successfully!');
    } catch (error: any) {
      console.error('Login Error:', error.message);
      Alert.alert('Login Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      Alert.alert('Success', 'Account created successfully!');
    } catch (error: any) {
      console.error('Sign Up Error:', error.message);
      Alert.alert('Sign Up Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>PawFeeds</Text>
          <Text style={styles.tagline}>Your pets personal chef.</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.buttonPrimary} onPress={handleLogin} disabled={isLoading}>
            <Text style={styles.buttonPrimaryText}>
              {isLoading ? 'Loading...' : 'Login'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.dividerText}>OR</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={() => Alert.alert('Coming Soon', 'Google Sign-In logic will be implemented in a future update.')}
            disabled={isLoading}>
            <Text style={styles.buttonSecondaryText}>Sign in with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handleCreateAccount}
            disabled={isLoading}>
            <Text style={styles.buttonSecondaryText}>Create an Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  logo: { fontSize: 48, fontWeight: 'bold', color: COLORS.primary },
  tagline: { fontSize: 16, color: COLORS.text, marginTop: 8 },
  form: { width: '100%' },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 16, color: COLORS.text },
  buttonPrimary: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  buttonPrimaryText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  dividerText: { textAlign: 'center', color: '#aaa', marginVertical: 24, fontWeight: '500' },
  actions: { width: '100%' },
  buttonSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  buttonSecondaryText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
});