import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, DocumentData, getDoc, getDocs, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebaseConfig';
import { recalculatePortionsForPet } from '../../utils/portionLogic'; // 1. Import our utility function

const COLORS = {
  primary: '#8C6E63',
  accent: '#FFC107',
  background: '#F5F5F5',
  text: '#333333',
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
  danger: '#D32F2F',
  overlay: 'rgba(0, 0, 0, 0.4)',
};

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Pet {
  id: string;
  name: string;
}

const parseTimeString = (timeString: string): Date => {
  const now = new Date();
  if (!timeString || typeof timeString !== 'string') {
    return now;
  }

  const parts = timeString.match(/(\d+):(\d+)\s+(AM|PM)/i);
  if (!parts) {
    return new Date('invalid');
  }

  let [, hoursStr, minutesStr, modifier] = parts;
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  
  modifier = modifier.toUpperCase();

  if (modifier === 'PM' && hours < 12) {
    hours += 12;
  }
  if (modifier === 'AM' && hours === 12) {
    hours = 0;
  }

  now.setHours(hours, minutes, 0, 0);
  return now;
};

export default function ScheduleProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isEditing = id !== 'new';
  const colorScheme = useColorScheme();

  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedBowl, setSelectedBowl] = useState<number | null>(null);

  const [isPetModalVisible, setPetModalVisible] = useState(false);
  const [isBowlModalVisible, setBowlModalVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  
  const feederId = "eNFJODJ5YP1t3lw77WJG";

  const bowls = useMemo(() => [{ id: 1, name: 'Bowl 1' }, { id: 2, name: 'Bowl 2' }], []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      
      try {
        const petsCollectionRef = collection(db, 'feeders', feederId, 'pets');
        const q = query(petsCollectionRef);
        const querySnapshot = await getDocs(q);
        const petsData: Pet[] = [];
        querySnapshot.forEach((doc: DocumentData) => {
          petsData.push({ id: doc.id, name: doc.data().name } as Pet);
        });
        setPets(petsData);

        if (isEditing && id) {
          const scheduleDocRef = doc(db, 'feeders', feederId, 'schedules', id);
          const docSnap = await getDoc(scheduleDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setName(data.name || '');
            
            const parsedDate = parseTimeString(data.time || '');
            if (!isNaN(parsedDate.getTime())) {
              setDate(parsedDate);
            }

            if (data.repeatDays && Array.isArray(data.repeatDays)) {
                const dayIndices = data.repeatDays.map(dayLetter => DAYS.indexOf(dayLetter)).filter(index => index !== -1);
                setSelectedDays(dayIndices);
            }
            
            // 2. Use the more reliable petId to find the selected pet
            const pet = petsData.find(p => p.id === data.petId);
            setSelectedPet(pet || null);
            setSelectedBowl(data.bowlNumber || null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
        Alert.alert("Error", "Could not load data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
  }, [id, isEditing]);


  const onTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatTime = (dateToFormat: Date) => {
    if (isNaN(dateToFormat.getTime())) {
        return 'Select a time';
    }
    return dateToFormat.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };
  
  const handleDayPress = (dayIndex: number) => {
    setSelectedDays(prevDays => 
      prevDays.includes(dayIndex) 
        ? prevDays.filter(d => d !== dayIndex) 
        : [...prevDays, dayIndex]
    );
  };

  const handleSave = async () => {
    if (!name || !selectedPet || !selectedBowl) {
      Alert.alert('Missing Information', 'Please provide a name, select a pet, and choose a bowl.');
      return;
    }
    
    setIsLoading(true);
    // 3. Add petId and portionGrams to the data being saved
    const scheduleData = {
      name,
      time: formatTime(date),
      repeatDays: selectedDays.sort((a, b) => a - b).map(index => DAYS[index]),
      petId: selectedPet.id,
      petName: selectedPet.name,
      bowlNumber: selectedBowl,
      isEnabled: true,
      portionGrams: 0, // Default to 0, will be updated by the recalculation
    };

    try {
      if (isEditing && id) {
        const scheduleDocRef = doc(db, 'feeders', feederId, 'schedules', id);
        await updateDoc(scheduleDocRef, scheduleData);
        Alert.alert('Schedule Updated');
      } else {
        const schedulesCollectionRef = collection(db, 'feeders', feederId, 'schedules');
        await addDoc(schedulesCollectionRef, scheduleData);
        Alert.alert('Schedule Saved');
      }
      
      // 4. Trigger the portion recalculation after saving
      await recalculatePortionsForPet(selectedPet.id);

      router.back();
    } catch (error) {
      console.error("Error saving schedule: ", error);
      Alert.alert('Error', 'Could not save the schedule.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Schedule',
      `Are you sure you want to delete the "${name}" schedule?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            if (isEditing && id && selectedPet) { // Ensure we have a pet to update
              setIsLoading(true);
              try {
                const scheduleDocRef = doc(db, 'feeders', feederId, 'schedules', id);
                await deleteDoc(scheduleDocRef);
                
                // 5. Trigger portion recalculation after deleting
                await recalculatePortionsForPet(selectedPet.id);

                Alert.alert('Schedule Deleted');
                router.back();
              } catch (error) {
                console.error("Error deleting schedule: ", error);
                Alert.alert('Error', 'Could not delete the schedule.');
              } finally {
                setIsLoading(false);
              }
            }
          }
        },
      ]
    );
  };

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Schedule' : 'Add Schedule'}</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>Schedule Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g., Breakfast" />

        <Text style={styles.label}>Time</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.timeText}>{formatTime(date)}</Text>
        </TouchableOpacity>
        
        {Platform.OS === 'android' && showTimePicker && (
          <DateTimePicker value={date} mode="time" is24Hour={false} display="default" onChange={onTimeChange} />
        )}

        {Platform.OS === 'ios' && (
            <Modal visible={showTimePicker} transparent={true} animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? '#333' : COLORS.background }]}>
                        <DateTimePicker 
                            value={date} 
                            mode="time" 
                            is24Hour={false} 
                            display="spinner" 
                            onChange={onTimeChange} 
                            textColor={colorScheme === 'dark' ? COLORS.white : COLORS.text}
                            themeVariant={colorScheme ?? 'light'}
                        />
                        <TouchableOpacity style={styles.doneButton} onPress={() => setShowTimePicker(false)}>
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        )}
        
        <Text style={styles.label}>Repeat on Days</Text>
        <View style={styles.daySelectorContainer}>
          {DAYS.map((day, index) => (
            <TouchableOpacity 
              key={index}
              style={[styles.dayButton, selectedDays.includes(index) && styles.dayButtonSelected]}
              onPress={() => handleDayPress(index)}
            >
              <Text style={[styles.dayButtonText, selectedDays.includes(index) && styles.dayButtonTextSelected]}>{day}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Pet to Feed</Text>
        <TouchableOpacity style={styles.input} onPress={() => setPetModalVisible(true)}>
            <Text style={[styles.timeText, !selectedPet && { color: '#999' }]}>
                {selectedPet ? selectedPet.name : 'Select a pet...'}
            </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Dispense from</Text>
        <TouchableOpacity style={styles.input} onPress={() => setBowlModalVisible(true)}>
            <Text style={[styles.timeText, !selectedBowl && { color: '#999' }]}>
                {selectedBowl ? `Bowl ${selectedBowl}` : 'Select a bowl...'}
            </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{isEditing ? 'Update Schedule' : 'Save Schedule'}</Text>
        </TouchableOpacity>
        
        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Schedule</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={isPetModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalBackdrop}>
            <View style={styles.selectionModalContent}>
                <Text style={styles.modalTitle}>Select a Pet</Text>
                <FlatList
                    data={pets}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.selectionItem} onPress={() => { setSelectedPet(item); setPetModalVisible(false); }}>
                            <Text style={styles.selectionItemText}>{item.name}</Text>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={styles.emptyListText}>No pets found. Add a pet first!</Text>}
                />
                <TouchableOpacity style={styles.cancelButton} onPress={() => setPetModalVisible(false)}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

       <Modal visible={isBowlModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalBackdrop}>
            <View style={styles.selectionModalContent}>
                <Text style={styles.modalTitle}>Select a Bowl</Text>
                <FlatList
                    data={bowls}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.selectionItem} onPress={() => { setSelectedBowl(item.id); setBowlModalVisible(false); }}>
                            <Text style={styles.selectionItemText}>{item.name}</Text>
                        </TouchableOpacity>
                    )}
                />
                 <TouchableOpacity style={styles.cancelButton} onPress={() => setBowlModalVisible(false)}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
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
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
    scrollContent: { padding: 20, paddingBottom: 40 },
    label: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text, justifyContent: 'center' },
    timeText: { fontSize: 16, color: COLORS.text },
    daySelectorContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    dayButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center' },
    dayButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    dayButtonText: { fontWeight: 'bold', color: COLORS.primary },
    dayButtonTextSelected: { color: COLORS.white },
    saveButton: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
    saveButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    deleteButton: { paddingVertical: 16, alignItems: 'center', marginTop: 16 },
    deleteButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.danger },
    modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.overlay },
    modalContent: { backgroundColor: COLORS.background, borderRadius: 20, padding: 20, width: '80%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    doneButton: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 30, marginTop: 20 },
    doneButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    selectionModalContent: { backgroundColor: COLORS.white, borderRadius: 12, padding: 20, width: '85%', maxHeight: '60%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary, marginBottom: 16, textAlign: 'center' },
    selectionItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
    selectionItemText: { fontSize: 18, color: COLORS.text, textAlign: 'center' },
    emptyListText: { textAlign: 'center', color: '#999', marginVertical: 20 },
    cancelButton: { paddingTop: 16, alignItems: 'center', },
    cancelButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.danger },
});