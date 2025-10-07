import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, DocumentData, onSnapshot, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ListRenderItem,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebaseConfig';

const COLORS = {
  primary: '#8C6E63',
  accent: '#FFC107',
  background: '#F5F5F5',
  text: '#333333',
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
};

interface Schedule {
  id: string;
  name: string;
  time: string;
  petName: string;
  bowlNumber: number;
  isEnabled: boolean;
  repeatDays: string[];
}

export default function SchedulesScreen() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  const petFilters = ['All', ...Array.from(new Set(schedules.map(s => s.petName)))];
  const [activeFilter, setActiveFilter] = useState('All');
  
  const feederId = "eNFJODJ5YP1t3lw77WJG";

  useEffect(() => {
    const schedulesCollectionRef = collection(db, 'feeders', feederId, 'schedules');
    const q = query(schedulesCollectionRef);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const schedulesData: Schedule[] = [];
      querySnapshot.forEach((doc: DocumentData) => {
        schedulesData.push({
          id: doc.id,
          ...doc.data(),
        } as Schedule);
      });
      // Sort schedules by time
      schedulesData.sort((a, b) => {
          const timeA = new Date(`1970/01/01 ${a.time}`).getTime();
          const timeB = new Date(`1970/01/01 ${b.time}`).getTime();
          return timeA - timeB;
      });
      setSchedules(schedulesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching schedules: ", error);
      setLoading(false);
      Alert.alert("Error", "Could not fetch schedules.");
    });

    return () => unsubscribe();
  }, []);

  const handleAddSchedule = () => {
    router.push({ pathname: "/schedule/[id]", params: { id: 'new' } });
  };

  const handleEditSchedule = (scheduleId: string) => {
    router.push({ pathname: "/schedule/[id]", params: { id: scheduleId } });
  };

  const toggleSwitch = async (id: string, currentValue: boolean) => {
    const scheduleDocRef = doc(db, 'feeders', feederId, 'schedules', id);
    try {
      await updateDoc(scheduleDocRef, { isEnabled: !currentValue });
    } catch (error) {
      console.error("Error updating schedule status: ", error);
      Alert.alert('Error', 'Could not update the schedule status.');
    }
  };

  const filteredSchedules = schedules.filter(schedule => {
    if (activeFilter === 'All') return true;
    return schedule.petName === activeFilter;
  });

  const renderScheduleItem: ListRenderItem<Schedule> = ({ item }) => (
    <TouchableOpacity style={styles.scheduleItem} onPress={() => handleEditSchedule(item.id)}>
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={styles.scheduleTime}>{item.time}</Text>
        <Text style={styles.scheduleName} numberOfLines={1}>{`${item.name} for ${item.petName}`}</Text>
        <Text style={styles.scheduleDays}>{item.repeatDays && item.repeatDays.length > 0 ? item.repeatDays.join(', ') : 'Does not repeat'}</Text>
      </View>
      <Switch
        trackColor={{ false: COLORS.lightGray, true: COLORS.accent }}
        thumbColor={COLORS.white}
        ios_backgroundColor={COLORS.lightGray}
        onValueChange={() => toggleSwitch(item.id, item.isEnabled)}
        value={item.isEnabled}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feeding Schedules</Text>
      </View>
      
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
          {petFilters.map(petName => (
            <TouchableOpacity
              key={petName}
              style={[styles.filterButton, activeFilter === petName && styles.filterButtonActive]}
              onPress={() => setActiveFilter(petName)}>
              <Text style={[styles.filterButtonText, activeFilter === petName && styles.filterButtonTextActive]}>{petName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredSchedules}
          renderItem={renderScheduleItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clock-outline" size={80} color={COLORS.lightGray} />
              <Text style={styles.emptyText}>No Schedules Found</Text>
              <Text style={styles.emptySubText}>Try adjusting your filters or adding a new schedule.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleAddSchedule}>
        <MaterialCommunityIcons name="plus" size={32} color={COLORS.text} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  filterBar: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  filterButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.lightGray, backgroundColor: COLORS.white, marginHorizontal: 4 },
  filterButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterButtonText: { fontWeight: '600', color: COLORS.primary },
  filterButtonTextActive: { color: COLORS.white },
  listContainer: { padding: 20, flexGrow: 1 },
  scheduleItem: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  scheduleTime: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  scheduleName: { fontSize: 16, color: '#555', marginTop: 4 },
  scheduleDays: { fontSize: 14, color: '#999', marginTop: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 50 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#aaa', marginTop: 16 },
  emptySubText: { fontSize: 16, color: '#bbb', marginTop: 8, textAlign: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 6 },
});