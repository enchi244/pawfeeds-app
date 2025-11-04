// app/pet/[id].tsx

// This is your original, working file with the new RFID/Bowl features merged in.



import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';

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

import { useAuth } from '../../context/AuthContext';

import { db } from '../../firebaseConfig';

import { recalculatePortionsForPet } from '../../utils/portionLogic';



// --- NEW IMPORTS ---

import { Picker } from '@react-native-picker/picker';

import { getDatabase, off, onValue, ref, set as rtdbSet, serverTimestamp } from 'firebase/database';

// --- END NEW IMPORTS ---



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

  const { user } = useAuth();

  const isEditing = id !== 'new';



  // --- EXISTING STATES ---

  const [name, setName] = useState('');

  const [age, setAge] = useState('');

  const [weight, setWeight] = useState('');

  const [kcal, setKcal] = useState('');

  const [neuterStatus, setNeuterStatus] = useState('Neutered/Spayed');

  const [activityLevel, setActivityLevel] = useState('Normal');

  const [recommendedPortion, setRecommendedPortion] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

  const [feederId, setFeederId] = useState<string | null>(null);



  // --- NEW STATES for RFID/BOWL ---

  const [rfidTagId, setRfidTagId] = useState('');

  const [assignedBowl, setAssignedBowl] = useState<number>(1);

  const [isScanning, setIsScanning] = useState(false);

  const [scanTargetBowl, setScanTargetBowl] = useState<number | null>(null);

  // --- END NEW STATES ---



  useEffect(() => {

    const fetchFeederId = async () => {

      if (!user) {

        Alert.alert('Error', 'You must be logged in to manage pets.');

        router.back();

        return;

      }

      const feedersRef = collection(db, 'feeders');

      const q = query(feedersRef, where('owner_uid', '==', user.uid));

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {

        setFeederId(querySnapshot.docs[0].id);

      } else {

        Alert.alert('No Feeder Found', 'Could not find a feeder associated with your account.');

        router.back();

      }

    };

    fetchFeederId();

  }, [user, router]);



  useEffect(() => {

    const fetchPetData = async () => {

      if (isEditing && id && feederId) {

        setIsLoading(true);

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

          setRecommendedPortion(petData.recommendedPortion || 0);

         

          // --- NEW: Load RFID/Bowl data ---

          setRfidTagId(petData.rfidTagId || '');

          setAssignedBowl(petData.bowlNumber || 1);

          // --- END NEW ---

        }

        setIsLoading(false);

      }

    };

    fetchPetData();

  }, [id, isEditing, feederId]);



// --- NEW: RTDB Listener for RFID scan results ---

  useEffect(() => {

    if (!isScanning || !feederId || scanTargetBowl === null) return;



    const rtdb = getDatabase();

    // --- FIX: Define commandPath here so we can use it in the timeout ---

    const commandPath = `commands/${feederId}`;

    const scanRef = ref(rtdb, `scan_pairing/${feederId}/bowl_${scanTargetBowl}`);



    console.log(`[App] Listening for tag on path: scan_pairing/${feederId}/bowl_${scanTargetBowl}`);



    // --- FIX: Set a 30.5-second timeout to match the ESP32 ---

    const scanTimeout = setTimeout(() => {

      console.log(`[App] Scan for bowl ${scanTargetBowl} timed out.`);

      Alert.alert('Scan Timed Out', 'No tag was detected in 30 seconds.');

     

      // Reset the UI state

      setIsScanning(false);

      setScanTargetBowl(null);



      // Send a cancel command to the ESP32 just in case

      rtdbSet(ref(rtdb, commandPath), {

        command: `cancel_scan_bowl_${scanTargetBowl}`,

        timestamp: serverTimestamp()

      });



    }, 30500); // 30.5 seconds, just after the ESP32's 30s timeout



    const onTagScanned = (snapshot: any) => {

      if (snapshot.exists()) {

        const data = snapshot.val();

        if (data.tagId) {

          // --- FIX: A tag was found! Clear the timeout. ---

          clearTimeout(scanTimeout);



          console.log(`[App] Received tag ${data.tagId} for bowl ${scanTargetBowl}`);

          setRfidTagId(data.tagId); // Set the tag ID in our state

          setIsScanning(false);

          setScanTargetBowl(null); // Stop listening

          Alert.alert('Tag Scanned!', `Tag ID: ${data.tagId} has been assigned.`);

          // Clear the value in RTDB

          rtdbSet(scanRef, null);

        }

      }

    };



    onValue(scanRef, onTagScanned);



    // Cleanup listener

    return () => {

      off(scanRef, 'value', onTagScanned);

     

      // --- FIX: Also clear the timeout if the component unmounts ---

      clearTimeout(scanTimeout);



      // If we unmount while scanning, tell ESP32 to stop

      // (This logic was already here and is still correct)

      if (isScanning && feederId && scanTargetBowl) {

        console.log(`[App] Cleaning up: Sending cancel_scan for bowl ${scanTargetBowl}`);

        // Note: commandPath is already defined above, so this works

        rtdbSet(ref(rtdb, commandPath), { command: `cancel_scan_bowl_${scanTargetBowl}`, timestamp: serverTimestamp() });

      }

    };

  }, [isScanning, feederId, scanTargetBowl]);

  // --- END NEW ---



  // --- EXISTING Calculation Logic (Unchanged) ---

  useEffect(() => {

    const calculatePortion = () => {

      const weightKg = parseFloat(weight);

      const foodKcal = parseFloat(kcal);

      if (isNaN(weightKg) || weightKg <= 0 || isNaN(foodKcal) || foodKcal <= 0) {

        setRecommendedPortion(0);

        return;

      }

      const rer = 70 * Math.pow(weightKg, 0.75);

      let merFactor = 1.6;

      if (neuterStatus === 'Neutered/Spayed') {

        if (activityLevel === 'Low') merFactor = 1.2;

        if (activityLevel === 'High') merFactor = 1.8;

      } else {

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

  // --- END EXISTING ---



// --- NEW: Handler for Scan Tag button ---

  const handleScanTag = async () => {

    if (!feederId) {

      Alert.alert('Error', 'Feeder not found. Cannot start scan.');

      return;

    }



    setScanTargetBowl(assignedBowl); // Set which bowl we are scanning for

    setIsScanning(true);



    // --- FIX: Replaced the simple alert with one that has a "Cancel" button ---

    Alert.alert(

      `Scanning for Bowl ${assignedBowl}...`,

      "Please scan your pet's tag near the correct reader now. This will time out in 30 seconds.",

      [

        {

          text: 'Cancel',

          onPress: () => {

            console.log('[App] User canceled scan from alert.');

            // --- THIS IS THE FIX ---

            // Manually trigger the cancellation logic

            setIsScanning(false);

            setScanTargetBowl(null);

            

            // The useEffect cleanup hook (lines 165-221) will 

            // now reliably handle sending the 'cancel_scan' command

            // because its dependencies (isScanning, scanTargetBowl) have changed.

            // --- END OF FIX ---

          },

          style: 'cancel'

        }

      ],

      { cancelable: false } // Prevents tapping outside the alert to dismiss it

    );

    // --- END FIX ---



    try {

      const rtdb = getDatabase();

      // Clear any old scan data for this specific bowl

      await rtdbSet(ref(rtdb, `scan_pairing/${feederId}/bowl_${assignedBowl}`), null);



      // Send scan command for the specific bowl

      const commandPath = `commands/${feederId}`;

      const command = `scan_tag_bowl_${assignedBowl}`;

      console.log(`[App] Sending command: ${command}`);

      await rtdbSet(ref(rtdb, commandPath), {

        command: command,

        timestamp: serverTimestamp(),

      });

    } catch (error) {

      console.error(`Error sending ${`scan_tag_bowl_${assignedBowl}`} command:`, error);

      Alert.alert('Error', 'Could not send scan command to feeder.');

      setIsScanning(false);

      setScanTargetBowl(null);

    }

  };

  // --- END NEW ---

 

  // --- MODIFIED handleSave ---

  const handleSave = async () => {

    // Existing validation

    if (!name || !age || !weight || !kcal) {

      Alert.alert('Missing Information', 'Please fill out all fields.');

      return;

    }

    // --- NEW: Add validation for RFID ---

    if (!rfidTagId) {

      Alert.alert('Missing Information', 'Please scan and assign an RFID tag to this pet.');

      return;

    }

    // --- END NEW ---

    if (!feederId) {

      Alert.alert('Error', 'Feeder ID not found. Cannot save pet.');

      return;

    }

   

    setIsLoading(true);

    const petData = {

      // Existing data

      name,

      age: parseInt(age, 10),

      weight: parseFloat(weight),

      kcal: parseInt(kcal, 10),

      neuterStatus,

      activityLevel,

      recommendedPortion,

     

      // --- NEW: Add RFID/Bowl data to save object ---

      rfidTagId: rfidTagId,

      bowlNumber: assignedBowl,

      // --- END NEW ---

    };



    try {

      if (isEditing && id) {

        const petDocRef = doc(db, 'feeders', feederId, 'pets', id);

        await updateDoc(petDocRef, petData); // updateDoc is fine, it merges by default

        await recalculatePortionsForPet(id);

        Alert.alert('Pet Updated!', `Profile for ${name} has been updated.`);

      } else {

        const petsCollectionRef = collection(db, 'feeders', feederId, 'pets');

        const newPetRef = await addDoc(petsCollectionRef, petData);

        await recalculatePortionsForPet(newPetRef.id);

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

  // --- END MODIFIED ---



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

            if (isEditing && id && feederId) {

              setIsLoading(true);

              try {

                // Note: Consider deleting associated schedules or reassigning them in a real app

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

      ]

    );

  };

 

  if (isLoading) {

    return (

      <View style={styles.loadingContainer}>

        <ActivityIndicator size="large" color={COLORS.primary} />

      </View>

    );

  }



  // --- JSX is your original + NEW RFID/BOWL SECTION ---

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



        {/* --- NEW RFID/BOWL SECTION --- */}

        <Text style={styles.label}>Assign to Bowl</Text>

        <View style={styles.pickerContainer}>

          <Picker

            selectedValue={assignedBowl}

            onValueChange={(itemValue: number) => setAssignedBowl(itemValue)}

            style={styles.picker}

          >

            <Picker.Item label="Bowl 1" value={1} />

            <Picker.Item label="Bowl 2" value={2} />

          </Picker>

        </View>



        <Text style={styles.label}>Assigned RFID Tag</Text>

        <TextInput

          style={[styles.input, styles.disabledInput]}

          value={rfidTagId}

          placeholder="Scan tag below"

          editable={false}

        />

        <TouchableOpacity

          style={[styles.button, isScanning ? styles.scanningButton : styles.scanButton]}

          onPress={handleScanTag}

          disabled={isScanning}

        >

          {isScanning ? (

            <>

              <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />

              <Text style={styles.saveButtonText}>{`Waiting for Scan (Bowl ${assignedBowl})...`}</Text>

            </>

          ) : (

            <Text style={styles.saveButtonText}>

              {rfidTagId ? `Re-Scan Tag for Bowl ${assignedBowl}` : `Scan Pet Tag for Bowl ${assignedBowl}`}

            </Text>

          )}

        </TouchableOpacity>

        {/* --- END NEW SECTION --- */}



        <View style={styles.resultCard}>

          <Text style={styles.resultLabel}>Recommended Daily Portion</Text>

          <Text style={styles.resultValue}>{recommendedPortion}g</Text>

          <Text style={styles.resultSubtext}>per day, based on veterinary formulas.</Text>

        </View>



        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>

          <Text style={styles.saveButtonText}>{isEditing ? 'Update Pet' : 'Save Pet'}</Text>

        </TouchableOpacity>

       

        {isEditing && (

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>

            <Text style={styles.deleteButtonText}>Delete Pet</Text>

          </TouchableOpacity>

        )}

      </ScrollView>

    </SafeAreaView>

  );

}



// --- STYLES (Originals + New styles for picker/scan button) ---

const styles = StyleSheet.create({

    container: { flex: 1, backgroundColor: COLORS.background },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },

    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },

    scrollContent: { padding: 20, paddingBottom: 40 },

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



    // --- NEW STYLES ---

    pickerContainer: {

        backgroundColor: COLORS.white,

        borderRadius: 12,

        borderWidth: 1,

        borderColor: COLORS.lightGray,

        overflow: 'hidden',

    },

    picker: {

        width: '100%',

        height: 60,

    },

    disabledInput: {

        backgroundColor: '#eee',

        color: '#888',

        marginTop: 8

    },

    button: {

        paddingVertical: 14,

        borderRadius: 10,

        alignItems: 'center',

        flexDirection: 'row',

        justifyContent: 'center',

    },

    scanButton: {

        backgroundColor: '#ffff00ff', // Blue

        marginTop: 10,

    },

    scanningButton: {

        backgroundColor: '#888', // Gray

        marginTop: 10,

    },

    // --- END NEW STYLES ---

});