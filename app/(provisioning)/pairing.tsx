import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

const COLORS = {
  primary: '#8C6E63',
  accent: '#FFC107',
  background: '#F5F5F5',
  text: '#333333',
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
  danger: '#D32F2F',
  success: '#4CAF50',
};

type StepStatus = 'pending' | 'active' | 'success' | 'error';

interface PairingStep {
  key: string;
  text: string;
  status: StepStatus;
}

const INITIAL_STEPS: PairingStep[] = [
  { key: 'sending', text: 'Sending credentials to feeder', status: 'pending' },
  { key: 'connecting', text: 'Feeder connecting to your Wi-Fi', status: 'pending' },
  { key: 'registering', text: 'Waiting for feeder to register...', status: 'pending' },
];

export default function PairingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams(); // ssid, password
  const [steps, setSteps] = useState<PairingStep[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const startPairingProcess = async () => {
      if (!user) {
        setError("User not authenticated. Please restart the process.");
        return;
      }

      // --- This is where you would send credentials to the ESP32 ---
      // For now, we simulate this step's success
      await updateStepStatus('sending', 'active');
      // const feederApi = new FeederProvisioningApi();
      // await feederApi.sendCredentials(params.ssid, params.password, user.uid);
      await wait(1500); 
      await updateStepStatus('sending', 'success');
      await updateStepStatus('connecting', 'active');
      // --- End of credential sending simulation ---


      // Set a timeout for the entire process
      timeoutId = setTimeout(() => {
        updateStepStatus('connecting', 'error', 'Feeder took too long to connect. Please check your Wi-Fi credentials and try again.');
        unsubscribe?.(); // Stop listening on timeout
      }, 60000); // 60-second timeout

      // Start listening for the feeder to appear in Firestore
      const feedersCollectionRef = collection(db, 'feeders');
      const q = query(feedersCollectionRef, where('owner_uid', '==', user.uid));
      
      unsubscribe = onSnapshot(q, async (querySnapshot) => {
        if (!querySnapshot.empty) {
            // A feeder document linked to this user has appeared!
            if (timeoutId) clearTimeout(timeoutId); // Clear the timeout
            unsubscribe?.(); // Stop listening
            
            await updateStepStatus('connecting', 'success');
            await updateStepStatus('registering', 'active');
            await wait(500);
            await updateStepStatus('registering', 'success');
            
            router.replace('/(provisioning)/complete');
        }
      }, (err) => {
        console.error("Firestore listener error:", err);
        setError("A database error occurred. Please try again.");
        if (timeoutId) clearTimeout(timeoutId);
      });
    };

    startPairingProcess();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user, router, params]);

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const updateStepStatus = async (key: string, status: StepStatus, errorMessage?: string) => {
    setSteps(prevSteps =>
      prevSteps.map(step => (step.key === key ? { ...step, status } : step))
    );
    if (status === 'error' && errorMessage) {
      setError(errorMessage);
    }
  };

  const renderStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'active':
        return <ActivityIndicator size="small" color={COLORS.primary} />;
      case 'success':
        return <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />;
      case 'error':
        return <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.danger} />;
      case 'pending':
        return <MaterialCommunityIcons name="circle-outline" size={24} color={COLORS.lightGray} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Step 3: Pairing...' }} />
      <View style={styles.content}>
        <Text style={styles.title}>Connecting Your Feeder</Text>
        <Text style={styles.subtitle}>This may take a moment. Please wait...</Text>

        <View style={styles.stepsContainer}>
          {steps.map(step => (
            <View key={step.key} style={styles.step}>
              <View style={styles.stepIcon}>{renderStepIcon(step.status)}</View>
              <Text style={[styles.stepText, step.status === 'active' && styles.activeText]}>
                {step.text}
              </Text>
            </View>
          ))}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.back()} // Go back to the select network screen
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
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
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  stepsContainer: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  stepIcon: {
    width: 30,
    alignItems: 'center',
    marginRight: 16,
  },
  stepText: {
    fontSize: 16,
    color: '#888',
  },
  activeText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  errorContainer: {
    marginTop: 32,
    alignItems: 'center',
    width: '100%',
  },
  errorText: {
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    lineHeight: 22,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
});