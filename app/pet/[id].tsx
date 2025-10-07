import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  danger: '#D32F2F',
};

interface SegmentedControlProps {
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, selected, onSelect }) => (
  <View style={styles.segmentedControlContainer}>
    {options.map((option) => (
      <TouchableOpacity
        key={option}
        style={[
          styles.segment,
          selected === option ? styles.segmentActive : {},
        ]}
        onPress={() => onSelect(option)}>
        <Text style={[styles.segmentText, selected === option ? styles.segmentTextActive : {}]}>
          {option}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

export default function PetProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isEditing = id !== 'new';

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [kcal, setKcal] = useState('');
  const [neuterStatus, setNeuterStatus] = useState('Neutered/Spayed');
  const [activityLevel, setActivityLevel] = useState('Normal');
  const [recommendedPortion, setRecommendedPortion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // IMPORTANT: Replace this with your actual feeder ID from the Firebase console
  const feederId = "eNFJODJ5YP1t3lw77WJG";

  useEffect(() => {
    const fetchPetData = async () => {
      if (isEditing && id) {
        setIsLoading(true);
        try {
            const petDocRef = doc(db, 'feeders', feederId, 'pets', id);
            const docSnap = await getDoc(petDocRef);
            if (docSnap.exists()) {
              const petData = docSnap.data();
              setName(petData.name || '');
              setAge(petData.age ? petData.age.toString() : '');
              setWeight(petData.weight ? petData.weight.toString() : '');
              setKcal(petData.kcal ? petData.kcal.toString() : '');
              setNeuterStatus(petData.neuterStatus || 'Neutered/Spayed');
              setActivityLevel(petData.activityLevel || 'Normal');
              // When editing, we should populate recommendedPortion from the saved data if it exists
              setRecommendedPortion(petData.recommendedPortion || 0); 
            } else {
                Alert.alert('Error', 'Pet profile not found.');
                router.back();
            }
        } catch (error) {
            console.error("Error fetching pet data: ", error);
            Alert.alert('Error', 'There was a problem fetching the pet profile.');
            router.back();
        } finally {
            setIsLoading(false);
        }
      }
    };
    fetchPetData();
  }, [id, isEditing, router]);

  useEffect(() => {
    const calculatePortion = () => {
      const weightKg = parseFloat(weight);
      const foodKcal = parseFloat(kcal);

      if (isNaN(weightKg) || weightKg <= 0 || isNaN(foodKcal) || foodKcal <= 0) {
        setRecommendedPortion(0);
        return;
      }

      // Resting Energy Requirement (RER)
      const rer = 70 * Math.pow(weightKg, 0.75);

      // Maintenance Energy Requirement (MER) factor
      let merFactor = 1.6; // Default for normal, neutered adult
      if (neuterStatus === 'Neutered/Spayed') {
        if (activityLevel === 'Low') merFactor = 1.2;
        if (activityLevel === 'High') merFactor = 1.8;
      } else { // Intact
        if (activityLevel === 'Low') merFactor = 1.4;
        if (activityLevel === 'Normal') merFactor = 1.8;
        if (activityLevel === 'High') merFactor = 3.0;
      }

      const mer = rer * merFactor;
      const dailyGrams = (mer / foodKcal) * 100;

      setRecommendedPortion(Math.round(dailyGrams));
    };
    calculatePortion();
  }, [weight, kcal, neuterStatus, activityLevel]);

  const handleSave = async () => {
    if (!name || !age || !weight || !kcal) {
      Alert.alert('Missing Information', 'Please fill out all fields.');
      return;
    }
    
    setIsLoading(true);
    const petData = {
      name,
      age: parseInt(age, 10),
      weight: parseFloat(weight),
      kcal: parseInt(kcal, 10),
      neuterStatus,
      activityLevel,
      recommendedPortion, // Ensure recommendedPortion is always included
    };

    try {
      if (isEditing && id) {
        // Update existing document
        const petDocRef = doc(db, 'feeders', feederId, 'pets', id);
        await updateDoc(petDocRef, petData); // Use petData directly
        Alert.alert('Pet Updated!', `Profile for ${name} has been updated.`);
      } else {
        // Add new document
        const petsCollectionRef = collection(db, 'feeders', feederId, 'pets');
        const finalPetData = {
            ...petData, 
            photoUrl: 'https://firebasestorage.googleapis.com/v0/b/pawfeeds-app.appspot.com/o/pet_place.png?alt=media&token=1432243_placeholder'
        };
        await addDoc(petsCollectionRef, finalPetData);
        Alert.alert('Pet Saved!', `Profile for ${name} has been created.`);
      }
      router.back();
    } catch (error) {
      console.error("Error saving pet: ", error);
      Alert.alert('Error', 'There was a problem saving the pet profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Pet',
      `Are you sure you want to delete ${name}'s profile? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => { 
            if (isEditing && id) {
              setIsLoading(true);
              try {
                const petDocRef = doc(db, 'feeders', feederId, 'pets', id);
                await deleteDoc(petDocRef);
                Alert.alert('Pet Deleted', `${name}'s profile has been removed.`);
                router.back();
              } catch (error) {
                console.error("Error deleting pet: ", error);
                Alert.alert('Error', 'There was a problem deleting the pet profile.');
              } finally {
                setIsLoading(false);
              }
            }
          }
        },
      ],
      { cancelable: true }
    );
  };
  
  if (isLoading && isEditing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Pet Profile' : 'Add New Pet'}</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.photoContainer}>
           <MaterialCommunityIcons name="plus" size={48} color={COLORS.lightGray} />
        </TouchableOpacity>

        <Text style={styles.label}>{"Pet's Name"}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g., Buddy" />

        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.label}>Age (months)</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="e.g., 24" keyboardType="numeric" />
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="e.g., 15" keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>Food Calories (kcal/100g)</Text>
        <TextInput style={styles.input} value={kcal} onChangeText={setKcal} placeholder="Check your dog food bag" keyboardType="numeric" />

        <Text style={styles.label}>Sex / Neuter Status</Text>
        <SegmentedControl options={['Neutered/Spayed', 'Intact']} selected={neuterStatus} onSelect={setNeuterStatus} />
        
        <Text style={styles.label}>Activity Level</Text>
        <SegmentedControl options={['Low', 'Normal', 'High']} selected={activityLevel} onSelect={setActivityLevel} />

        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Recommended Daily Portion</Text>
          <Text style={styles.resultValue}>{recommendedPortion}g</Text>
          <Text style={styles.resultSubtext}>per day, based on veterinary formulas.</Text>
        </View>

        <TouchableOpacity style={[styles.saveButton, isLoading && styles.disabledButton]} onPress={handleSave} disabled={isLoading}>
            {isLoading ? (
                <ActivityIndicator color={COLORS.text} />
            ) : (
                <Text style={styles.saveButtonText}>{isEditing ? 'Update Pet' : 'Save Pet'}</Text>
            )}
        </TouchableOpacity>
        
        {isEditing && (
          <TouchableOpacity style={[styles.deleteButton, isLoading && styles.disabledButton]} onPress={handleDelete} disabled={isLoading}>
            <Text style={styles.deleteButtonText}>Delete Pet</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    scrollContent: { padding: 20 },
    photoContainer: { width: 120, height: 120, borderRadius: 12, borderWidth: 2, borderColor: COLORS.lightGray, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 24, backgroundColor: COLORS.white },
    label: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
    column: { flex: 1 },
    segmentedControlContainer: { flexDirection: 'row', backgroundColor: COLORS.lightGray, borderRadius: 12, padding: 4 },
    segment: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    segmentActive: { backgroundColor: COLORS.white },
    segmentText: { fontWeight: '600', color: '#888' },
    segmentTextActive: { color: COLORS.primary },
    resultCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 20, alignItems: 'center', marginTop: 24 },
    resultLabel: { fontSize: 16, fontWeight: '600', color: '#666' },
    resultValue: { fontSize: 48, fontWeight: 'bold', color: COLORS.primary, marginVertical: 8 },
    resultSubtext: { fontSize: 12, color: '#aaa', textAlign: 'center' },
    saveButton: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
    saveButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    deleteButton: { paddingVertical: 16, alignItems: 'center', marginTop: 16 },
    deleteButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.danger },
    disabledButton: { opacity: 0.5 },
});