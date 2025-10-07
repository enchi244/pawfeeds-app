import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
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
  overlay: 'rgba(0, 0, 0, 0.4)',
};

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Helper function to parse a time string like "08:00 AM" into a Date object
const parseTimeString = (timeString: string): Date => {
  const [time, modifier] = timeString.split(' ');
  let [hours, minutes] = time.split(':').map(Number);

  if (modifier === 'PM' && hours < 12) {
    hours += 12;
  }
  if (modifier === 'AM' && hours === 12) {
    hours = 0;
  }
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export default function ScheduleProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isEditing = id !== 'new';

  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const feederId = "eNFJODJ5YP1t3lw77WJG";

  useEffect(() => {
    const fetchScheduleData = async () => {
      if (isEditing && id) {
        setIsLoading(true);
        const scheduleDocRef = doc(db, 'feeders', feederId, 'schedules', id);
        const docSnap = await getDoc(scheduleDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || '');
          if (data.time && typeof data.time === 'string') {
            setDate(parseTimeString(data.time));
          }
          if (data.repeatDays && Array.isArray(data.repeatDays)) {
              const dayIndices = data.repeatDays.map(dayLetter => DAYS.indexOf(dayLetter)).filter(index => index !== -1);
              setSelectedDays(dayIndices);
          }
        }
        setIsLoading(false);
      }
    };
    fetchScheduleData();
  }, [id, isEditing]);

  const onTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
        setShowTimePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatTime = (dateToFormat: Date) => {
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
    if (!name) {
      Alert.alert('Missing Name', 'Please give this schedule a name.');
      return;
    }
    
    setIsLoading(true);
    const scheduleData = {
      name,
      time: formatTime(date), // Save time as a simple string
      repeatDays: selectedDays.sort((a, b) => a - b).map(index => DAYS[index]),
      petName: 'Buddy', // Placeholder
      bowlNumber: 1, // Placeholder
      isEnabled: true,
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
            if (isEditing && id) {
              setIsLoading(true);
              try {
                const scheduleDocRef = doc(db, 'feeders', feederId, 'schedules', id);
                await deleteDoc(scheduleDocRef);
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
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <DateTimePicker value={date} mode="time" is24Hour={false} display="spinner" onChange={onTimeChange} textColor={COLORS.text}/>
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
        <TextInput style={styles.input} value="Buddy" placeholder="Select a pet..." editable={false} />

        <Text style={styles.label}>Dispense from</Text>
        <TextInput style={styles.input} value="Bowl 1" placeholder="Select a bowl..." editable={false} />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{isEditing ? 'Update Schedule' : 'Save Schedule'}</Text>
        </TouchableOpacity>
        
        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Schedule</Text>
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
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.overlay },
    modalContent: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, width: '80%', alignItems: 'center' },
    doneButton: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 30, marginTop: 20 },
    doneButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
});