import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, Unsubscribe, updateDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebaseConfig';

const COLORS = {
  primary: '#8C6E63',
  accent: '#FFC107',
  background: '#F5F5F5',
  text: '#333333',
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
  danger: '#D32F2F',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

// --- Interfaces for Firestore data ---
interface Pet {
    id: string;
    name: string;
    recommendedPortion: number;
}

interface Schedule {
    id: string;
    petId: string;
    petName: string;
    time: string;
    bowlNumber: number;
    isEnabled: boolean;
}

interface BowlAssignments {
    [key: string]: string; // bowlNumber: petId
}

interface BowlCardProps {
  bowlNumber: number;
  assignedPet: Pet | undefined;
  foodLevel: number;
  perMealPortion: number;
  onPressFeed: () => void;
  onPressAssign: () => void;
}

const BowlCard: React.FC<BowlCardProps> = ({ bowlNumber, assignedPet, foodLevel, perMealPortion, onPressFeed, onPressAssign }) => {
  return (
    <View style={[styles.card, { width: CARD_WIDTH }]}>
      <View style={styles.cardHeader}>
        <TouchableOpacity onPress={onPressAssign} style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{`Bowl ${bowlNumber} - ${assignedPet?.name || 'Unassigned'}`}</Text>
            <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.onlineIndicator} />
      </View>
      <View style={styles.videoFeedPlaceholder}>
        <Text style={styles.videoFeedText}>Live Feed Unavailable</Text>
      </View>
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Food Level</Text>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${foodLevel}%` }]} />
        </View>
        <Text style={styles.statusPercentage}>{foodLevel}%</Text>
      </View>
      <TouchableOpacity style={styles.feedButton} onPress={onPressFeed}>
        <Text style={styles.feedButtonText}>Feed Now</Text>
      </TouchableOpacity>
      <Text style={styles.portionText}>
        {`Next meal portion: ${perMealPortion > 0 ? perMealPortion : '--'}g`}
      </Text>
    </View>
  );
};

export default function DashboardScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // States for UI control from your original code
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [filters, setFilters] = useState({ bowl1: true, bowl2: true });

  // --- State for Firestore data ---
  const [pets, setPets] = useState<Pet[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [bowlAssignments, setBowlAssignments] = useState<BowlAssignments>({});

  // --- State for Modals ---
  const [isFeedModalVisible, setIsFeedModalVisible] = useState(false);
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [selectedBowl, setSelectedBowl] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  
  const feederId = "eNFJODJ5YP1t3lw77WJG";

  useEffect(() => {
    const unsubscribes: Unsubscribe[] = [];
    
    const petsRef = collection(db, 'feeders', feederId, 'pets');
    const petsUnsub = onSnapshot(petsRef, (snapshot) => {
        const petsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pet));
        setPets(petsData);
    });
    unsubscribes.push(petsUnsub);

    const schedulesRef = collection(db, 'feeders', feederId, 'schedules');
    const schedulesUnsub = onSnapshot(schedulesRef, (snapshot) => {
        const schedulesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule));
        setSchedules(schedulesData);
    });
    unsubscribes.push(schedulesUnsub);

    const feederRef = doc(db, 'feeders', feederId);
    const feederUnsub = onSnapshot(feederRef, (doc) => {
        if (doc.exists()) {
            setBowlAssignments(doc.data().bowlAssignments || {});
        }
        setIsLoading(false);
    });
    unsubscribes.push(feederUnsub);

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  const activeSchedulesByPetId = useMemo(() => {
    const counts: { [petId: string]: number } = {};
    schedules.forEach(schedule => {
      // petId is crucial for correct mapping
      const petId = schedule.petId; 
      if (schedule.isEnabled && petId) {
        if (!counts[petId]) {
          counts[petId] = 0;
        }
        counts[petId]++;
      }
    });
    return counts;
  }, [schedules]);
  
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + 20));
    setActiveIndex(index);
  };
  
  // --- Preserved functionality from your code ---
  const handleMenu = () => setIsMenuVisible(true);
  const handleMenuClose = () => setIsMenuVisible(false);

  const handleLogout = () => {
    handleMenuClose();
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/'); // Navigate to the root login screen
          } catch (error) {
            console.error("Error logging out: ", error);
            Alert.alert('Error', 'Failed to log out. Please try again.');
          }
        },
      },
    ]);
  };
  
  const handleAccountPress = () => {
    Alert.alert('Navigate', 'This would navigate to the account screen.');
    handleMenuClose();
  };

  const toggleFilter = (bowl: 'bowl1' | 'bowl2') => {
    setFilters(prevFilters => ({ ...prevFilters, [bowl]: !prevFilters[bowl] }));
  };
  
  const filteredSchedules = useMemo(() => schedules.filter(schedule => {
    if (filters.bowl1 && schedule.bowlNumber === 1) return true;
    if (filters.bowl2 && schedule.bowlNumber === 2) return true;
    return false;
  }), [schedules, filters]);

  // --- New functionality for modals ---
  const handleOpenFeedModal = (bowlNumber: number) => {
    setSelectedBowl(bowlNumber);
    setIsFeedModalVisible(true);
  };

  const handleOpenAssignModal = (bowlNumber: number) => {
    setSelectedBowl(bowlNumber);
    setIsAssignModalVisible(true);
  };

  const handleAssignPet = async (petId: string | null) => {
    if (selectedBowl === null) return;
    
    const feederRef = doc(db, 'feeders', feederId);
    try {
      await updateDoc(feederRef, { [`bowlAssignments.${selectedBowl}`]: petId || null });
    } catch (error) {
      console.error("Error assigning pet:", error);
      Alert.alert('Error', 'Could not update bowl assignment.');
    } finally {
      setIsAssignModalVisible(false);
      setSelectedBowl(null);
    }
  };
  
  const handleDispenseFeed = async (amount: number) => {
    if (selectedBowl === null || !amount || amount <= 0) {
        Alert.alert('Invalid Amount', 'Please provide a valid portion amount.');
        return;
    }
    try {
      const commandsRef = collection(db, 'feeders', feederId, 'commands');
      await addDoc(commandsRef, { command: 'feed', bowl: selectedBowl, amount, timestamp: serverTimestamp() });
      Alert.alert('Success', `Dispensing ${amount}g from Bowl ${selectedBowl}.`);
    } catch (error) {
      console.error("Error sending feed command:", error);
      Alert.alert('Error', 'Could not send feed command.');
    } finally {
      setIsFeedModalVisible(false);
      setSelectedBowl(null);
      setCustomAmount('');
    }
  };
  
  const selectedBowlData = useMemo(() => {
    if (selectedBowl === null) return null;
    const petId = bowlAssignments[selectedBowl];
    const pet = pets.find(p => p.id === petId);
    const activeScheduleCount = pet ? (activeSchedulesByPetId[pet.id] || 0) : 0;
    const perMealPortion = (pet && activeScheduleCount > 0) ? Math.round(pet.recommendedPortion / activeScheduleCount) : (pet?.recommendedPortion || 0);
    return { pet, perMealPortion };
  }, [selectedBowl, bowlAssignments, pets, activeSchedulesByPetId]);

  const bowls = [{ id: 1, foodLevel: 85 }, { id: 2, foodLevel: 60 }];

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleMenu}><MaterialCommunityIcons name="menu" size={28} color={COLORS.primary} /></TouchableOpacity>
        <Text style={styles.headerTitle}>PawFeeds</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16} contentContainerStyle={styles.swiperContainer} decelerationRate="fast" snapToInterval={CARD_WIDTH + 20} snapToAlignment="start">
            {bowls.map((bowl) => {
                const assignedPetId = bowlAssignments[bowl.id];
                const assignedPet = pets.find(p => p.id === assignedPetId);
                const activeScheduleCount = assignedPet ? (activeSchedulesByPetId[assignedPet.id] || 0) : 0;
                const perMealPortion = (assignedPet && activeScheduleCount > 0) ? Math.round(assignedPet.recommendedPortion / activeScheduleCount) : (assignedPet?.recommendedPortion || 0);

                return (
                    <BowlCard
                        key={bowl.id}
                        bowlNumber={bowl.id}
                        assignedPet={assignedPet}
                        foodLevel={bowl.foodLevel}
                        perMealPortion={perMealPortion}
                        onPressFeed={() => handleOpenFeedModal(bowl.id)}
                        onPressAssign={() => handleOpenAssignModal(bowl.id)}
                    />
                );
            })}
          </ScrollView>
          <View style={styles.pagination}>
            {bowls.map((_, index) => (<View key={index} style={[styles.dot, index === activeIndex ? styles.activeDot : styles.inactiveDot]}/>))}
          </View>
        </View>

        <View style={styles.scheduleSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Feedings</Text>
            <View style={styles.filterContainer}>
              <TouchableOpacity style={[styles.filterButton, filters.bowl1 && styles.filterButtonActive]} onPress={() => toggleFilter('bowl1')}><Text style={[styles.filterButtonText, filters.bowl1 && styles.filterButtonTextActive]}>Bowl 1</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.filterButton, filters.bowl2 && styles.filterButtonActive]} onPress={() => toggleFilter('bowl2')}><Text style={[styles.filterButtonText, filters.bowl2 && styles.filterButtonTextActive]}>Bowl 2</Text></TouchableOpacity>
            </View>
          </View>
          {filteredSchedules.length > 0 ? (
            filteredSchedules.map((schedule) => (
              <View style={styles.scheduleItem} key={schedule.id}>
                <Text style={styles.scheduleTime}>{schedule.time}</Text>
                <Text style={styles.scheduleDetails}>{`${schedule.petName} - Bowl ${schedule.bowlNumber}`}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noSchedulesText}>No feedings scheduled for the selected bowls.</Text>
          )}
        </View>
      </ScrollView>

      {/* Menu Modal (Preserved) */}
      <Modal animationType="fade" transparent={true} visible={isMenuVisible} onRequestClose={handleMenuClose} >
        <TouchableOpacity style={styles.modalOverlay} onPress={handleMenuClose} activeOpacity={1}>
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Menu</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleAccountPress}><MaterialCommunityIcons name="account-circle-outline" size={24} color={COLORS.text} style={styles.menuIcon} /><Text style={styles.menuItemText}>Account</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Coming Soon', 'Device provisioning will be available in a future update.')}><MaterialCommunityIcons name="plus-box-outline" size={24} color={COLORS.text} style={styles.menuIcon} /><Text style={styles.menuItemText}>Add Device</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Coming Soon', 'Manual and tutorials will be available here.')}><MaterialCommunityIcons name="book-open-outline" size={24} color={COLORS.text} style={styles.menuIcon} /><Text style={styles.menuItemText}>Manual</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuLogoutButton} onPress={handleLogout}><MaterialCommunityIcons name="logout" size={24} color={COLORS.danger} style={styles.menuIcon} /><Text style={styles.menuLogoutText}>Logout</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Feed Now Modal (New) */}
      <Modal visible={isFeedModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsFeedModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Manual Feed</Text>
                <Text style={styles.modalSubtitle}>Dispense food from Bowl {selectedBowl} for {selectedBowlData?.pet?.name || 'N/A'}.</Text>
                <TouchableOpacity style={styles.modalButton} onPress={() => handleDispenseFeed(selectedBowlData?.perMealPortion || 0)} disabled={!selectedBowlData?.perMealPortion}>
                    <Text style={styles.modalButtonText}>{`Dispense Meal (${selectedBowlData?.perMealPortion || 0}g)`}</Text>
                </TouchableOpacity>
                <Text style={styles.modalDivider}>OR</Text>
                <TextInput style={styles.modalInput} placeholder="Enter custom amount (grams)" keyboardType="number-pad" value={customAmount} onChangeText={setCustomAmount} />
                <TouchableOpacity style={styles.modalButton} onPress={() => handleDispenseFeed(parseInt(customAmount, 10))}>
                    <Text style={styles.modalButtonText}>Dispense Custom</Text>
                </TouchableOpacity>
                 <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsFeedModalVisible(false)}>
                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* Assign Pet Modal (New) */}
      <Modal visible={isAssignModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsAssignModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Assign Pet to Bowl {selectedBowl}</Text>
                <ScrollView style={styles.modalScrollView}>
                    {pets.map(pet => (
                        <TouchableOpacity key={pet.id} style={styles.modalButton} onPress={() => handleAssignPet(pet.id)}>
                            <Text style={styles.modalButtonText}>{pet.name}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={[styles.modalButton, styles.unassignButton]} onPress={() => handleAssignPet(null)}>
                        <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Unassign</Text>
                    </TouchableOpacity>
                </ScrollView>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAssignModalVisible(false)}>
                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  scrollContainer: { paddingBottom: 20 },
  swiperContainer: { paddingHorizontal: 20, paddingTop: 20 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4, marginRight: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  onlineIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50' },
  videoFeedPlaceholder: { height: 180, backgroundColor: '#E0E0E0', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  videoFeedText: { color: '#999', fontWeight: '500' },
  statusContainer: { marginBottom: 16 },
  statusLabel: { fontSize: 14, color: '#666', marginBottom: 6 },
  progressBarBackground: { height: 10, backgroundColor: COLORS.lightGray, borderRadius: 5 },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 5 },
  statusPercentage: { textAlign: 'right', fontSize: 12, color: '#666', marginTop: 4 },
  feedButton: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  feedButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  portionText: { textAlign: 'center', color: '#888', marginTop: 12, fontSize: 14, fontStyle: 'italic' },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  activeDot: { backgroundColor: COLORS.primary, width: 16 },
  inactiveDot: { backgroundColor: COLORS.lightGray, width: 8 },
  scheduleSection: { marginTop: 24, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  filterContainer: { flexDirection: 'row' },
  filterButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.lightGray, backgroundColor: COLORS.white, marginLeft: 8 },
  filterButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterButtonText: { fontWeight: '600', color: COLORS.primary },
  filterButtonTextActive: { color: COLORS.white },
  scheduleItem: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scheduleTime: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  scheduleDetails: { fontSize: 16, color: '#555' },
  noSchedulesText: { textAlign: 'center', color: '#999', marginTop: 20, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center' },
  menuContainer: { position: 'absolute', top: 0, left: 0, width: '80%', height: '100%', backgroundColor: COLORS.white, padding: 20, paddingTop: 60, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 8 },
  menuTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary, marginBottom: 20, textAlign: 'left', paddingLeft: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  menuItemText: { fontSize: 18, fontWeight: '500', color: COLORS.text, marginLeft: 15 },
  menuIcon: { width: 24, textAlign: 'center' },
  menuLogoutButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, marginTop: 'auto', paddingHorizontal: 10 },
  menuLogoutText: { fontSize: 18, fontWeight: '500', color: COLORS.danger, marginLeft: 15 },
  // Styles for new modals
  modalContent: { width: '85%', backgroundColor: COLORS.white, borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary, marginBottom: 8 },
  modalSubtitle: { fontSize: 16, color: COLORS.text, marginBottom: 24, textAlign: 'center' },
  modalButton: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%', marginBottom: 12 },
  modalButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.white },
  modalDivider: { color: '#aaa', fontWeight: 'bold', marginVertical: 8 },
  modalInput: { width: '100%', backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text, textAlign: 'center', marginVertical: 12 },
  cancelButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.lightGray },
  cancelButtonText: { color: COLORS.text },
  unassignButton: { backgroundColor: COLORS.danger, borderWidth: 0},
  modalScrollView: { width: '100%', maxHeight: 240, marginTop: 12 },
});