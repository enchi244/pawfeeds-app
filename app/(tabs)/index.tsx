import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';

const COLORS = { 
  primary: '#8C6E63', 
  accent: '#FFC107', 
  background: '#F5F5F5', 
  text: '#333333', 
  lightGray: '#E0E0E0', 
  white: '#FFFFFF', 
  danger: '#D32F2F', 
  overlay: 'rgba(0, 0, 0, 0.4)' 
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

interface BowlCardProps {
  bowlNumber: number;
  petName: string;
  foodLevel: number;
}

const BowlCard: React.FC<BowlCardProps> = ({ bowlNumber, petName, foodLevel }) => {
  const handleFeedNow = () => {
    Alert.alert(`Feed Now - Bowl ${bowlNumber}`, `Feeding ${petName}...`);
  };

  return (
    <View style={[styles.card, { width: CARD_WIDTH }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{`Bowl ${bowlNumber} - ${petName}`}</Text>
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
      <TouchableOpacity style={styles.feedButton} onPress={handleFeedNow}>
        <Text style={styles.feedButtonText}>Feed Now</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function DashboardScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [filters, setFilters] = useState({ bowl1: true, bowl2: true });

  const bowls = [
    { id: 1, petName: 'Buddy', foodLevel: 85 },
    { id: 2, petName: 'Lucy', foodLevel: 60 },
  ];

  const allSchedules = [
      { time: '08:00 AM', details: 'Buddy - Bowl 1', bowl: 1 },
      { time: '12:00 PM', details: 'Lucy - Bowl 2', bowl: 2 },
      { time: '06:00 PM', details: 'Buddy - Bowl 1', bowl: 1 },
      { time: '09:00 PM', details: 'Lucy - Bowl 2', bowl: 2 },
  ];
  
  const toggleFilter = (bowl: 'bowl1' | 'bowl2') => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [bowl]: !prevFilters[bowl],
    }));
  };

  const filteredSchedules = allSchedules.filter(schedule => {
    if (filters.bowl1 && schedule.bowl === 1) return true;
    if (filters.bowl2 && schedule.bowl === 2) return true;
    return false;
  });

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + 20));
    setActiveIndex(index);
  };
  
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
            // With the new structure, we can safely navigate.
            // The AuthProvider will update, and the new layout will handle the rest.
            router.replace('/login');
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleMenu}>
          <MaterialCommunityIcons name="menu" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PawFeeds</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View>
          <ScrollView
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false} 
            onScroll={handleScroll} 
            scrollEventThrottle={16} 
            contentContainerStyle={styles.swiperContainer} 
            decelerationRate="fast" 
            snapToInterval={CARD_WIDTH + 20} 
            snapToAlignment="start"
          >
            {bowls.map((bowl) => (
              <BowlCard key={bowl.id} bowlNumber={bowl.id} petName={bowl.petName} foodLevel={bowl.foodLevel} />
            ))}
          </ScrollView>
          <View style={styles.pagination}>
            {bowls.map((_, index) => (
              <View key={index} style={[styles.dot, index === activeIndex ? styles.activeDot : styles.inactiveDot]} />
            ))}
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
            filteredSchedules.map((schedule, index) => (
              <View style={styles.scheduleItem} key={index}>
                <Text style={styles.scheduleTime}>{schedule.time}</Text>
                <Text style={styles.scheduleDetails}>{schedule.details}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noSchedulesText}>No feedings scheduled for the selected bowls.</Text>
          )}
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={isMenuVisible} onRequestClose={handleMenuClose} >
        <TouchableOpacity style={styles.modalOverlay} onPress={handleMenuClose} activeOpacity={1}>
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Menu</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleAccountPress}>
              <MaterialCommunityIcons name="account-circle-outline" size={24} color={COLORS.text} style={styles.menuIcon} />
              <Text style={styles.menuItemText}>Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Coming Soon', 'Device provisioning will be available in a future update.')}>
              <MaterialCommunityIcons name="plus-box-outline" size={24} color={COLORS.text} style={styles.menuIcon} />
              <Text style={styles.menuItemText}>Add Device</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Coming Soon', 'Manual and tutorials will be available here.')}>
              <MaterialCommunityIcons name="book-open-outline" size={24} color={COLORS.text} style={styles.menuIcon} />
              <Text style={styles.menuItemText}>Manual</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuLogoutButton} onPress={handleLogout}>
              <MaterialCommunityIcons name="logout" size={24} color={COLORS.danger} style={styles.menuIcon} />
              <Text style={styles.menuLogoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  scrollContainer: { paddingVertical: 20 },
  swiperContainer: { paddingHorizontal: 20 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4, marginRight: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
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
  menuContainer: { width: '80%', backgroundColor: COLORS.white, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 8 },
  menuTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary, marginBottom: 20, textAlign: 'center' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  menuItemText: { fontSize: 18, fontWeight: '500', color: COLORS.text, marginLeft: 15 },
  menuIcon: { width: 24, textAlign: 'center' },
  menuLogoutButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, marginTop: 20 },
  menuLogoutText: { fontSize: 18, fontWeight: '500', color: COLORS.danger, marginLeft: 15 },
});