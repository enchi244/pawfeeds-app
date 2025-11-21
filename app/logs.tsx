import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';

const COLORS = {
  primary: '#8C6E63',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#333333',
  lightGray: '#E0E0E0',
  secondaryText: '#666666'
};

interface FeedLog {
  id: string;
  type: 'manual' | 'scheduled';
  amount: number;
  bowlNumber: number;
  petName: string;
  timestamp: any; // Firestore Timestamp
}

export default function LogsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [logs, setLogs] = useState<FeedLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user) return;

      try {
        // 1. Get Feeder ID for current user
        const feedersRef = collection(db, 'feeders');
        const qFeeder = query(feedersRef, where('owner_uid', '==', user.uid));
        const feederSnap = await getDocs(qFeeder);

        if (feederSnap.empty) {
          setIsLoading(false);
          return;
        }

        const feederId = feederSnap.docs[0].id;

        // 2. Fetch History
        const historyRef = collection(db, 'feeders', feederId, 'history');
        const qHistory = query(historyRef, orderBy('timestamp', 'desc'));
        const historySnap = await getDocs(qHistory);

        const fetchedLogs = historySnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as FeedLog));

        setLogs(fetchedLogs);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [user]);

  const renderItem = ({ item }: { item: FeedLog }) => {
    const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date();
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.logCard}>
        <View style={styles.iconContainer}>
          {/* FIX: Changed 'hand-right' (invalid) to 'gesture-tap' (valid) for manual feeds */}
          <MaterialCommunityIcons 
            name={item.type === 'scheduled' ? 'clock-outline' : 'gesture-tap'} 
            size={24} 
            color={COLORS.primary} 
          />
        </View>
        <View style={styles.logDetails}>
          <Text style={styles.logTitle}>{`Bowl ${item.bowlNumber} - ${item.petName}`}</Text>
          <Text style={styles.logSubtitle}>{`${formattedDate} at ${formattedTime}`}</Text>
        </View>
        <View style={styles.amountContainer}>
           <Text style={styles.amountText}>{item.amount}g</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feeding History</Text>
        <View style={{ width: 28 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="history" size={48} color={COLORS.lightGray} />
              <Text style={styles.emptyText}>No feeding history yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  backButton: { padding: 4 },
  listContent: { padding: 20 },
  logCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  iconContainer: { width: 40, alignItems: 'center' },
  logDetails: { flex: 1, paddingHorizontal: 10 },
  logTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  logSubtitle: { fontSize: 14, color: COLORS.secondaryText, marginTop: 4 },
  amountContainer: { backgroundColor: '#F0EAE8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  amountText: { color: COLORS.primary, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: COLORS.secondaryText, marginTop: 16, fontSize: 16 },
});