import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  primary: '#8C6E63',
  accent: '#FFC107',
  background: '#F5F5F5',
  text: '#333333',
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [filters, setFilters] = useState({ bowl1: true, bowl2: true });

  const bowls = [
    { id: 1, petName: 'Buddy', foodLevel: 85 },
    { id: 2, petName: 'Lucy', foodLevel: 60 },
  ];

  // More sample data to show filtering
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PawFeeds</Text>
        <TouchableOpacity>
          <MaterialCommunityIcons name="cog" size={24} color={COLORS.primary} />
        </TouchableOpacity>
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
              <BowlCard
                key={bowl.id}
                bowlNumber={bowl.id}
                petName={bowl.petName}
                foodLevel={bowl.foodLevel}
              />
            ))}
          </ScrollView>
          <View style={styles.pagination}>
            {bowls.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === activeIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.scheduleSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Todays Feedings</Text>
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterButton, filters.bowl1 && styles.filterButtonActive]}
                onPress={() => toggleFilter('bowl1')}>
                <Text style={[styles.filterButtonText, filters.bowl1 && styles.filterButtonTextActive]}>Bowl 1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, filters.bowl2 && styles.filterButtonActive]}
                onPress={() => toggleFilter('bowl2')}>
                <Text style={[styles.filterButtonText, filters.bowl2 && styles.filterButtonTextActive]}>Bowl 2</Text>
              </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  scrollContainer: {
    paddingVertical: 20,
  },
  swiperContainer: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    marginRight: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  videoFeedPlaceholder: {
    height: 180,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  videoFeedText: {
    color: '#999',
    fontWeight: '500',
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 5,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  statusPercentage: {
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  feedButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  feedButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: COLORS.primary,
    width: 16,
  },
  inactiveDot: {
    backgroundColor: COLORS.lightGray,
    width: 8,
  },
  scheduleSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  filterContainer: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    marginLeft: 8,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  filterButtonTextActive: {
    color: COLORS.white,
  },
  scheduleItem: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleTime: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  scheduleDetails: {
    fontSize: 16,
    color: '#555',
  },
  noSchedulesText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontStyle: 'italic',
  },
});