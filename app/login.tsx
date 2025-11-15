// enchi244/pawfeeds-app/pawfeeds-app-67639f9c704304a88b300ab379913fec52cb96bb/app/login.tsx
import { useRouter } from 'expo-router';
// 1. IMPORT THE NEW MODULES
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// 2. IMPORT expo-auth-session
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../firebaseConfig'; // Your existing firebase config

// 3. This completes the auth-flow in a web-browser
WebBrowser.maybeCompleteAuthSession();

const COLORS = {
  primary: '#8C6E63',
  accent: '#FFC107',
  background: '#F5F5FF',
  text: '#333333',
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false); // Loading state for Google

  // 4. SETUP THE GOOGLE AUTH REQUEST HOOK
  // Replace these with the IDs you got in Step 2!
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '847280230673-unso54fvd6etf0cuihmjb56q2j1eol09.apps.googleusercontent.com',
    androidClientId: '847280230673-7q2sed7dlea9j9vh97rvib4reg0un3g4.apps.googleusercontent.com',
  });

  // 5. ADD A useEffect TO HANDLE THE RESPONSE FROM THE HOOK
  useEffect(() => {
    if (response?.type === 'success') {
      setGoogleLoading(true);
      const { id_token } = response.params;
      
      // Create a Firebase credential with the Google ID token
      const credential = GoogleAuthProvider.credential(id_token);
      
      // Sign in to Firebase with the credential
      signInWithCredential(auth, credential)
        .then(() => {
          // On success, the AuthContext will see the new user
          // and the router will redirect automatically.
          // We don't need router.replace() here.
        })
        .catch((error) => {
          Alert.alert('Google Sign-In Failed', error.message);
        })
        .finally(() => {
          setGoogleLoading(false);
        });
    } else if (response?.type === 'error') {
      Alert.alert('Google Sign-In Error', response.error?.message || 'Something went wrong.');
      setGoogleLoading(false);
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      // Note: signInWithEmailAndPassword is unchanged
      await signInWithEmailAndPassword(auth, email, password);
      // AuthContext will handle the redirect, but we'll leave this
      // as a fallback just in case.
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 6. UPDATE handleGoogleSignIn
  const handleGoogleSignIn = () => {
    // Check if a prompt is already in progress
    if (googleLoading || !request) {
      return;
    }
    promptAsync(); // This opens the Google Sign-In prompt
  };
  
  const handleGoToSignUp = () => {
    router.push('/signup');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>PawFeeds</Text>
          <Text style={styles.tagline}>Your pet's personal chef.</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            // ... (rest of props)
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            // ... (rest of props)
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.buttonPrimary} onPress={handleLogin} disabled={loading || googleLoading}>
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.buttonPrimaryText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.dividerText}>OR</Text>

        <View style={styles.actions}>
          {/* 7. UPDATE GOOGLE SIGN-IN BUTTON */}
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}>
            {googleLoading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.buttonSecondaryText}>Sign in with Google</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handleGoToSignUp} 
            disabled={loading || googleLoading}>
            <Text style={styles.buttonSecondaryText}>Create an Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

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