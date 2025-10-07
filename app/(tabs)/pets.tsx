import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    FlatList,
    Image,
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

// Sample data - we will replace this with Firebase data later
const samplePets = [
  { id: '1', name: 'Buddy', photoUrl: 'https://placehold.co/100x100/A0522D/FFFFFF?text=B' },
  { id: '2', name: 'Lucy', photoUrl: 'https://placehold.co/100x100/8C6E63/FFFFFF?text=L' },
];

// To test the empty state, use this instead:
// const samplePets = [];

export default function PetsScreen() {
  const router = useRouter();

  const handleAddPet = () => {
    // We will navigate to the "Add Pet" screen here in a future step
    Alert.alert('Add Pet', 'This will open the screen to add a new pet profile.');
  };

  const renderPetItem = ({ item }) => (
    <TouchableOpacity style={styles.petItem}>
      <Image source={{ uri: item.photoUrl }} style={styles.petPhoto} />
      <Text style={styles.petName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Pets</Text>
      </View>

      {samplePets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="dog" size={80} color={COLORS.lightGray} />
          <Text style={styles.emptyText}>No pets added yet.</Text>
          <Text style={styles.emptySubText}>Tap the + button to add your first pet!</Text>
        </View>
      ) : (
        <FlatList
          data={samplePets}
          renderItem={renderPetItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleAddPet}>
        <MaterialCommunityIcons name="plus" size={32} color={COLORS.text} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  listContainer: {
    padding: 20,
  },
  petItem: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  petPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: COLORS.lightGray,
  },
  petName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#aaa',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 16,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
});