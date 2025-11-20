import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDatabase, off, onValue, ref, set as rtdbSet, serverTimestamp } from 'firebase/database';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../firebaseConfig';
import { recalculatePortionsForPet } from '../../utils/portionLogic';

// --- REST API Upload Helper ---
const encodeStoragePath = (path: string) => {
  return encodeURIComponent(path).replace(/\./g, '%2E');
};

const COLORS = {
  primary: '#8C6E63',
  accent: '#FFC107',
  background: '#F5F5F5',
  text: '#333333',
  lightGray: '#E0E0E0',
  white: '#FFFFFF',
  danger: '#D32F2F',
  info: '#2196F3', // Blue for info
  warning: '#FF9800' // Orange for warning
};

interface DogBreed {
  id: string; 
  name: string;
  size: 'Small' | 'Medium' | 'Large';
  defaultWeight: number;
  defaultKcal: number;
  defaultActivity: 'Low' | 'Normal' | 'High';
  defaultNeuterStatus: 'Neutered/Spayed' | 'Intact';
}

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

// --- Growth Curve Logic ---
const estimatePuppyWeight = (adultWeight: number, months: number): number => {
  let factor = 1.0;
  if (months < 2) factor = 0.20;       
  else if (months < 3) factor = 0.30;  
  else if (months < 4) factor = 0.40; 
  else if (months < 5) factor = 0.50;  
  else if (months < 6) factor = 0.60;
  else if (months < 7) factor = 0.70;
  else if (months < 8) factor = 0.75;
  else if (months < 10) factor = 0.85;
  else if (months < 12) factor = 0.95; 
  return Math.round(adultWeight * factor * 10) / 10;
};

// --- Age Calculation Helper ---
const getAgeString = (birthDate: Date | null) => {
  if (!birthDate) return null;
  
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  // Adjust for negative days
  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  // Adjust for negative months
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 0) return "Not born yet";

  if (years > 0) {
     return `${years}y ${months}m old`;
  } else {
     if (months === 0) return `${days}d old`;
     return `${months}m ${days}d old`;
  }
};

export default function PetProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isEditing = id !== 'new';

  // --- Pet Data States ---
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [kcal, setKcal] = useState('');
  const [neuterStatus, setNeuterStatus] = useState('Neutered/Spayed');
  const [activityLevel, setActivityLevel] = useState('Normal');
  const [recommendedPortion, setRecommendedPortion] = useState(0);
  const [feederId, setFeederId] = useState<string | null>(null);

  // --- New State for Weight Insight ---
  const [idealPortion, setIdealPortion] = useState<number | null>(null);

  const [birthday, setBirthday] = useState<Date | null>(null);
  const [ageInMonths, setAgeInMonths] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [breeds, setBreeds] = useState<DogBreed[]>([]);
  const [breedsLoading, setBreedsLoading] = useState(true);
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(null);
  
  const [rfidTagId, setRfidTagId] = useState('');
  const [assignedBowl, setAssignedBowl] = useState<number>(1);
  const [isScanning, setIsScanning] = useState(false);
  const [scanTargetBowl, setScanTargetBowl] = useState<number | null>(null);
  
  const [photoUrl, setPhotoUrl] = useState<string | null>(null); 
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  
  const [unavailableBowls, setUnavailableBowls] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false); 
  
  // Fetch Feeder ID
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

  // Fetch Occupied Bowls
  useEffect(() => {
    const fetchOccupiedBowls = async () => {
        if (!feederId) return;
        try {
            const petsRef = collection(db, 'feeders', feederId, 'pets');
            const snapshot = await getDocs(petsRef);
            const taken = snapshot.docs
                .filter(doc => doc.id !== id)
                .map(doc => doc.data().bowlNumber)
                .filter(num => num !== undefined && num !== null);
            setUnavailableBowls(taken);
            if (!isEditing) {
                const freeBowl = [1, 2].find(b => !taken.includes(b));
                if (freeBowl) setAssignedBowl(freeBowl);
            }
        } catch (error) {
            console.error("Error checking bowl availability:", error);
        }
    };
    fetchOccupiedBowls();
  }, [feederId, id, isEditing]);

  // Fetch Pet Data
  useEffect(() => {
    const fetchPetData = async () => {
      if (isEditing && id && feederId) {
        setIsLoading(true);
        const petDocRef = doc(db, 'feeders', feederId, 'pets', id);
        const docSnap = await getDoc(petDocRef);
        if (docSnap.exists()) {
          const petData = docSnap.data();
          setName(petData.name || '');
          if (petData.birthday) {
            setBirthday(petData.birthday.toDate ? petData.birthday.toDate() : new Date(petData.birthday));
          }
          setWeight(petData.weight ? petData.weight.toString() : '');
          setKcal(petData.kcal ? petData.kcal.toString() : '');
          setNeuterStatus(petData.neuterStatus || 'Neutered/Spayed');
          setActivityLevel(petData.activityLevel || 'Normal');
          setRecommendedPortion(petData.recommendedPortion || 0);
          setRfidTagId(petData.rfidTagId || '');
          setAssignedBowl(petData.bowlNumber || 1);
          setPhotoUrl(petData.photoUrl || null);
        }
        setIsLoading(false);
      }
    };
    fetchPetData();
  }, [id, isEditing, feederId]);

  // Fetch Dog Breeds & Sort
  useEffect(() => {
    const fetchBreeds = async () => {
      try {
        const breedsCollectionRef = collection(db, 'dogBreeds');
        const q = query(breedsCollectionRef, orderBy('name')); 
        const querySnapshot = await getDocs(q);
        const breedsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as DogBreed));

        // Sort: Size First, then Name
        const sizeOrder: { [key: string]: number } = { 'Small': 1, 'Medium': 2, 'Large': 3 };
        breedsData.sort((a, b) => {
            const sizeDiff = sizeOrder[a.size] - sizeOrder[b.size];
            if (sizeDiff !== 0) return sizeDiff;
            return a.name.localeCompare(b.name);
        });

        setBreeds(breedsData);
      } catch (error) {
        console.error("Error fetching breeds:", error);
        Alert.alert("Error", "Could not load dog breeds.");
      } finally {
        setBreedsLoading(false);
      }
    };
    fetchBreeds();
  }, []);

  // Smart Preset Application
  useEffect(() => {
    if (!selectedBreedId || isEditing || breeds.length === 0) return; 
    
    const preset = breeds.find(b => b.id === selectedBreedId);
    if (preset) {
      setKcal(preset.defaultKcal.toString());
      setActivityLevel(preset.defaultActivity);
      setNeuterStatus(preset.defaultNeuterStatus);

      if (ageInMonths !== null && ageInMonths < 12) {
        const estimated = estimatePuppyWeight(preset.defaultWeight, ageInMonths);
        setWeight(estimated.toString());
      } else {
        setWeight(preset.defaultWeight.toString());
      }
    }
  }, [selectedBreedId, ageInMonths, isEditing, breeds]);

  // Calculate ageInMonths
  useEffect(() => {
    if (birthday) {
      const today = new Date();
      const birthDate = new Date(birthday);
      let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
      months -= birthDate.getMonth();
      months += today.getMonth();
      if (today.getDate() < birthDate.getDate()) {
        months--;
      }
      setAgeInMonths(months <= 0 ? 0 : months);
    } else {
      setAgeInMonths(null);
    }
  }, [birthday]);

  // RTDB Listener for RFID
  useEffect(() => {
    if (!isScanning || !feederId || scanTargetBowl === null) return;
    const rtdb = getDatabase();
    const commandPath = `commands/${feederId}`;
    const scanRef = ref(rtdb, `scan_pairing/${feederId}/bowl_${scanTargetBowl}`);
    const scanTimeout = setTimeout(() => {
      setIsScanning(false);
      setScanTargetBowl(null);
      Alert.alert('Scan Timed Out', 'No tag was detected in 30 seconds.');
      rtdbSet(ref(rtdb, commandPath), { command: `cancel_scan_bowl_${scanTargetBowl}`, timestamp: serverTimestamp() });
    }, 30500); 
    const onTagScanned = (snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.tagId) {
          clearTimeout(scanTimeout);
          setRfidTagId(data.tagId); 
          setIsScanning(false);
          setScanTargetBowl(null); 
          Alert.alert('Tag Scanned!', `Tag ID: ${data.tagId} has been assigned.`);
          rtdbSet(scanRef, null);
        }
      }
    };
    onValue(scanRef, onTagScanned);
    return () => {
      off(scanRef, 'value', onTagScanned);
      clearTimeout(scanTimeout);
      if (isScanning && feederId && scanTargetBowl) {
        rtdbSet(ref(rtdb, commandPath), { command: `cancel_scan_bowl_${scanTargetBowl}`, timestamp: serverTimestamp() });
      }
    };
  }, [isScanning, feederId, scanTargetBowl]);

  // Granular Age + Activity Portions + Diet Insight
  useEffect(() => {
    const calculatePortion = () => {
      const weightKg = parseFloat(weight);
      const foodKcal = parseFloat(kcal);
      
      // Basic Validation
      if (isNaN(weightKg) || weightKg <= 0 || isNaN(foodKcal) || foodKcal <= 0 || ageInMonths === null || ageInMonths < 0) {
        setRecommendedPortion(0);
        setIdealPortion(null);
        return;
      }

      // 1. Helper to calculate grams
      const getGramsForWeight = (targetWeight: number) => {
        const rer = 70 * Math.pow(targetWeight, 0.75);
        let merFactor;

        if (ageInMonths < 4) {
            // Rapid Growth
            if (activityLevel === 'Low') merFactor = 2.8;
            else if (activityLevel === 'High') merFactor = 3.2;
            else merFactor = 3.0; 
        } 
        else if (ageInMonths < 12) {
            // Adolescent Growth
            if (activityLevel === 'Low') merFactor = 1.8;
            else if (activityLevel === 'High') merFactor = 2.2;
            else merFactor = 2.0;
        } 
        else {
            // Adult Phase
            merFactor = 1.6; 
            if (neuterStatus === 'Neutered/Spayed') {
                if (activityLevel === 'Low') merFactor = 1.4;
                if (activityLevel === 'High') merFactor = 1.8;
            } else {
                if (activityLevel === 'Low') merFactor = 1.4;
                if (activityLevel === 'Normal') merFactor = 1.8;
                if (activityLevel === 'High') merFactor = 3.0; 
            }
        }
        
        const mer = rer * merFactor;
        return Math.round((mer / foodKcal) * 100);
      };

      // 2. Calculate for CURRENT Input
      const currentGrams = getGramsForWeight(weightKg);
      setRecommendedPortion(currentGrams);

      // 3. Calculate for IDEAL Breed Weight (Adults only)
      if (ageInMonths >= 12 && selectedBreedId && breeds.length > 0) {
        const preset = breeds.find(b => b.id === selectedBreedId);
        if (preset && preset.defaultWeight) {
           // Trigger insight if current weight is > 15% over average
           if (weightKg > preset.defaultWeight * 1.15) {
              const idealGrams = getGramsForWeight(preset.defaultWeight);
              setIdealPortion(idealGrams);
           } else {
              setIdealPortion(null);
           }
        }
      } else {
        setIdealPortion(null);
      }
    };
    calculatePortion();
  }, [weight, kcal, neuterStatus, activityLevel, ageInMonths, selectedBreedId, breeds]);


  // Scan Handler
  const handleScanTag = async () => {
    if (!feederId) {
      Alert.alert('Error', 'Feeder not found. Cannot start scan.');
      return;
    }
    setScanTargetBowl(assignedBowl); 
    setIsScanning(true);
    Alert.alert(
      `Scanning for Bowl ${assignedBowl}...`,
      "Please scan your pet's tag near the correct reader now.",
      [{ text: 'Cancel', onPress: () => { setIsScanning(false); setScanTargetBowl(null); }, style: 'cancel' }],
      { cancelable: false } 
    );
    try {
      const rtdb = getDatabase();
      await rtdbSet(ref(rtdb, `scan_pairing/${feederId}/bowl_${assignedBowl}`), null);
      const commandPath = `commands/${feederId}`;
      const command = `scan_tag_bowl_${assignedBowl}`;
      await rtdbSet(ref(rtdb, commandPath), { command: command, timestamp: serverTimestamp() });
    } catch (error) {
      console.error(`Error sending ${`scan_tag_bowl_${assignedBowl}`} command:`, error);
      Alert.alert('Error', 'Could not send scan command to feeder.');
      setIsScanning(false);
      setScanTargetBowl(null);
    }
  };
 
  // Image Picker
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], 
      quality: 0.5,
    });

    if (!result.canceled) {
      setLocalImageUri(result.assets[0].uri);
    }
  };

  // Direct REST API Upload
  const uploadImage = async (uri: string, petId: string): Promise<string | null> => {
    if (!feederId || !user) {
      console.error("Feeder ID or User is null, cannot upload image.");
      return null;
    }
    
    let blob: any = null;

    try {
      console.log("Creating Native Blob...");
      blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
          resolve(xhr.response);
        };
        xhr.onerror = function (e) {
          console.log("XHR Error:", e);
          reject(new TypeError("Network request failed"));
        };
        xhr.responseType = "blob";
        xhr.open("GET", uri, true);
        xhr.send(null);
      });

      const bucketName = storage.app.options.storageBucket;
      if (!bucketName) {
         throw new Error("Storage bucket name not found in Firebase Config.");
      }
      console.log("Using Configured Bucket:", bucketName);

      const filePath = `pet_photos/${feederId}/${petId}.jpg`;
      const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o?name=${encodeURIComponent(filePath)}`;
      
      console.log("Starting REST upload to:", url);

      const authToken = await user.getIdToken();
      const response = await fetch(url, {
        method: 'POST',
        body: blob,
        headers: {
          'Content-Type': 'image/jpeg',
          'Authorization': `Bearer ${authToken}`, 
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("REST Upload Failed:", response.status, errorText);
        
        if (response.status === 404) {
            Alert.alert(
                "Configuration Error", 
                `The Storage Bucket '${bucketName}' was not found. \n\nPlease check your firebaseConfig.ts file.`
            );
        }
        
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("Upload Success. Metadata:", data);

      const downloadToken = data.downloadTokens;
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

      return downloadUrl;

    } catch (error: any) {
      console.error("Error uploading image via REST:", error);
      if (error.message && !error.message.includes("Server returned 404")) {
           Alert.alert('Upload Failed', `Could not upload pet photo: ${error.message}`);
      }
      return null;
    } finally {
      if (blob && typeof blob.close === 'function') {
          blob.close();
      }
    }
  };

  // handleSave
  const handleSave = async () => {
    if (!name || !birthday || !weight || !kcal) {
      Alert.alert('Missing Information', 'Please fill out Name, Birthday, Weight, and Kcal fields.');
      return;
    }
    if (!rfidTagId) {
      Alert.alert('Missing Information', 'Please scan and assign an RFID tag to this pet.');
      return;
    }
    if (!feederId) {
      Alert.alert('Error', 'Feeder ID not found. Cannot save pet.');
      return;
    }
   
    setIsLoading(true); 
    
    const petData = {
      name,
      birthday: Timestamp.fromDate(birthday), 
      weight: parseFloat(weight),
      kcal: parseInt(kcal, 10),
      neuterStatus,
      activityLevel,
      recommendedPortion,
      rfidTagId: rfidTagId,
      bowlNumber: assignedBowl,
      breed: selectedBreedId ? breeds.find(b => b.id === selectedBreedId)?.name : 'Unknown',
    };

    try {
      if (isEditing && id) {
        let finalPhotoUrl = photoUrl; 
        if (localImageUri) {
          const uploadedUrl = await uploadImage(localImageUri, id);
          if (uploadedUrl) {
            finalPhotoUrl = uploadedUrl;
          } else {
             console.log("Image upload failed, saving text data only.");
          }
        }
        
        const petDocRef = doc(db, 'feeders', feederId, 'pets', id);
        await updateDoc(petDocRef, { ...petData, photoUrl: finalPhotoUrl });
        
        await recalculatePortionsForPet(id);
        Alert.alert('Pet Updated!', `Profile for ${name} has been updated.`);
        
      } else {
        const petsCollectionRef = collection(db, 'feeders', feederId, 'pets');
        const newPetRef = await addDoc(petsCollectionRef, petData);
        
        if (localImageUri) {
          const finalPhotoUrl = await uploadImage(localImageUri, newPetRef.id);
          if (finalPhotoUrl) {
            await updateDoc(newPetRef, { photoUrl: finalPhotoUrl });
          }
        }
        
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

  // Delete Handler
  const handleDelete = () => {
    Alert.alert(
      'Delete Pet',
      `Are you sure you want to delete ${name}'s profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (isEditing && id && feederId) {
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
      ]
    );
  };
  
  // Date Picker Handler
  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || birthday;
    setShowDatePicker(Platform.OS === 'ios');
    if (currentDate) {
      setBirthday(currentDate);
    }
  };
 
  if (isLoading || (breedsLoading && !isEditing)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10, color: COLORS.text }}>
          {isLoading ? "Saving Pet..." : (breedsLoading ? "Loading Breeds..." : "Loading Pet...")}
        </Text>
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
        
        <TouchableOpacity style={styles.photoContainer} onPress={handlePickImage}>
          { (localImageUri || photoUrl) ? (
            <Image 
              source={{ uri: localImageUri || photoUrl! }} 
              style={styles.petImage} 
            />
          ) : (
            <MaterialCommunityIcons name="plus" size={48} color={COLORS.lightGray} />
          )}
        </TouchableOpacity>

        {!isEditing && (
          <>
            <Text style={styles.label}>Start with a Breed Preset (Optional)</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedBreedId}
                onValueChange={(itemValue) => setSelectedBreedId(itemValue)}
                style={styles.picker}
                enabled={!isEditing && !breedsLoading}
              >
                <Picker.Item label="-- Select a breed --" value={null} />
                {breeds.map((breed) => (
                  <Picker.Item key={breed.id} label={`${breed.name} (${breed.size})`} value={breed.id} />
                ))}
              </Picker>
            </View>
          </>
        )}

        <Text style={styles.label}>{"Pet's Name"}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g., Buddy" />

        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.label}>Birthday</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
              <Text style={birthday ? styles.dateText : styles.datePlaceholder}>
                {birthday ? birthday.toLocaleDateString() : "Select date..."}
              </Text>
            </TouchableOpacity>
            {/* --- NEW: Birthday/Age Helper --- */}
            {birthday && (
              <View style={styles.infoContainer}>
                <MaterialCommunityIcons name="calendar-clock" size={16} color={COLORS.info} />
                <Text style={[styles.helperText, { color: COLORS.info }]}>
                  {` ${getAgeString(birthday)}`}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="e.g., 15" keyboardType="numeric" />
            
            <View style={styles.infoContainer}>
                <MaterialCommunityIcons 
                    name={ageInMonths !== null && ageInMonths < 12 ? "alert-circle-outline" : "scale"} 
                    size={16} 
                    color={ageInMonths !== null && ageInMonths < 12 ? COLORS.warning : COLORS.text} 
                />
                <Text style={[styles.helperText, ageInMonths !== null && ageInMonths < 12 && { color: COLORS.warning, fontWeight: 'bold' }]}>
                    {ageInMonths !== null && ageInMonths < 12 
                        ? " Estimated based on age. Please verify!" 
                        : " Enter current weight"
                    }
                </Text>
            </View>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={birthday || new Date()}
            mode="date"
            display="default"
            onChange={onDateChange}
            maximumDate={new Date()}
            accentColor={Platform.OS === 'ios' ? COLORS.primary : undefined} 
          />
        )}

        <Text style={styles.label}>Food Calories (kcal/100g)</Text>
        <TextInput 
          style={styles.input} 
          value={kcal} 
          onChangeText={setKcal} 
          placeholder="Check your dog food bag" 
          keyboardType="numeric" 
        />
        
        <View style={styles.infoContainer}>
             <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.info} />
             <Text style={[styles.helperText, {color: COLORS.info}]}> Check the label on your food bag</Text>
        </View>

        <Text style={styles.label}>Sex / Neuter Status</Text>
        <SegmentedControl 
          options={['Neutered/Spayed', 'Intact']} 
          selected={neuterStatus} 
          onSelect={setNeuterStatus} 
        />
       
        <Text style={styles.label}>Activity Level</Text>
        <SegmentedControl 
          options={['Low', 'Normal', 'High']} 
          selected={activityLevel} 
          onSelect={setActivityLevel} 
        />

        <Text style={styles.label}>Assign to Bowl</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={assignedBowl}
            onValueChange={(itemValue: number) => setAssignedBowl(itemValue)}
            style={styles.picker}
          >
            {[1, 2].filter(b => !unavailableBowls.includes(b) || b === assignedBowl).map(bowlNum => (
                 <Picker.Item key={bowlNum} label={`Bowl ${bowlNum}`} value={bowlNum} />
            ))}
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
          disabled={isScanning || isLoading} 
        >
          {isScanning ? (
            <>
              <ActivityIndicator color={COLORS.text} style={{ marginRight: 10 }} />
              <Text style={styles.saveButtonText}>{`Waiting for Scan (Bowl ${assignedBowl})...`}</Text>
            </>
          ) : (
            <Text style={styles.saveButtonText}>
              {rfidTagId ? `Re-Scan Tag for Bowl ${assignedBowl}` : `Scan Pet Tag for Bowl ${assignedBowl}`}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Recommended Daily Portion</Text>
          <Text style={styles.resultValue}>{recommendedPortion}g</Text>
          <Text style={styles.resultSubtext}>
            {ageInMonths !== null && ageInMonths < 12 
              ? "Based on puppy growth formula." 
              : "Based on adult maintenance formula."
            }
          </Text>

          {/* --- NEW: Diet Insight / Warning --- */}
          {idealPortion !== null && (
            <View style={styles.dietContainer}>
               <View style={styles.dietHeader}>
                 <MaterialCommunityIcons name="scale-bathroom" size={20} color={COLORS.warning} />
                 <Text style={styles.dietTitle}>Weight Management Insight</Text>
               </View>
               <Text style={styles.dietText}>
                 Your entered weight ({weight}kg) is higher than the breed average.
               </Text>
               <Text style={styles.dietText}>
                 If your goal is weight loss, consider feeding for the ideal weight:
               </Text>
               <Text style={styles.dietValue}>{idealPortion}g / day</Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave} 
          disabled={isLoading || isScanning} 
        >
          <Text style={styles.saveButtonText}>{isEditing ? 'Update Pet' : 'Save Pet'}</Text>
        </TouchableOpacity>
       
        {isEditing && (
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={handleDelete}
            disabled={isLoading || isScanning} 
          >
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
    scrollContent: { padding: 20, paddingBottom: 40 },
    photoContainer: { width: 120, height: 120, borderRadius: 12, borderWidth: 2, borderColor: COLORS.lightGray, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 24, backgroundColor: COLORS.white, overflow: 'hidden' }, 
    petImage: {
      width: '100%',
      height: '100%',
    },
    label: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text, justifyContent: 'center' },
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
        backgroundColor: COLORS.accent, 
        marginTop: 10,
    },
    scanningButton: {
        backgroundColor: '#888',
        marginTop: 10,
    },
    datePlaceholder: {
      fontSize: 16,
      color: '#999'
    },
    dateText: {
      fontSize: 16,
      color: COLORS.text
    },
    // --- NEW HELPER STYLES ---
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    helperText: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
        fontStyle: 'italic'
    },
    // --- Diet Card Styles ---
    dietContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
        width: '100%',
        alignItems: 'center',
    },
    dietHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
    },
    dietTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.warning,
    },
    dietText: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
        marginBottom: 4,
    },
    dietValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginTop: 4,
    },
});