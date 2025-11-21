import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { db, storage } from '../../firebaseConfig';

const COLORS = {
  primary: '#2C3E50',
  background: '#ECF0F1',
  white: '#FFFFFF',
  text: '#34495E',
  accent: '#E74C3C',
  success: '#27AE60',
  info: '#3498DB',
  lightGray: '#BDC3C7'
};

interface FirmwareData {
  version: string;
  url: string;
  releasedAt: any;
  notes?: string;
}

export default function FirmwareManagerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Current State
  const [currentFirmware, setCurrentFirmware] = useState<FirmwareData | null>(null);

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [versionInput, setVersionInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  // --- 1. FETCH CURRENT VERSION ---
  const fetchCurrentFirmware = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'system', 'firmware'); // Singleton document
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setCurrentFirmware(snap.data() as FirmwareData);
      }
    } catch (e) {
      console.error("Error fetching firmware:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentFirmware();
  }, []);

  // --- 2. PICK FILE ---
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Ideally 'application/octet-stream' or .bin, but wildcards are safer on some OS
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      
      const asset = result.assets[0];
      
      // Basic Validation
      if (!asset.name.endsWith('.bin')) {
        Alert.alert("Invalid File", "Firmware files must end with .bin");
        return;
      }

      setSelectedFile(asset);
      
      // Smart Auto-fill Version? (e.g. firmware_v1.2.bin -> 1.2)
      const versionMatch = asset.name.match(/v(\d+\.\d+)/);
      if (versionMatch) {
          setVersionInput(versionMatch[1]);
      }

    } catch (err) {
      Alert.alert("Error", "Could not pick file.");
    }
  };

  // --- 3. UPLOAD & RELEASE ---
  const handleRelease = async () => {
    if (!selectedFile || !versionInput) {
      Alert.alert("Validation", "Please select a file and enter a version number.");
      return;
    }

    setUploading(true);
    try {
      // A. Prepare Blob
      const response = await fetch(selectedFile.uri);
      const blob = await response.blob();

      // B. Upload to Storage
      // Path: firmwares/v1.2/firmware.bin
      const storagePath = `firmwares/v${versionInput}/${selectedFile.name}`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      // C. Update Signal Tower (Firestore)
      const releaseData: FirmwareData = {
        version: versionInput,
        url: downloadUrl,
        releasedAt: Timestamp.now(),
        notes: notesInput
      };

      await setDoc(doc(db, 'system', 'firmware'), releaseData);

      Alert.alert("Success", `Firmware v${versionInput} is now LIVE for all devices.`);
      
      // Cleanup
      setSelectedFile(null);
      setVersionInput('');
      setNotesInput('');
      fetchCurrentFirmware();

    } catch (error: any) {
      console.error("Upload failed:", error);
      Alert.alert("Upload Failed", error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Firmware OTA</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        
        {/* CURRENT STATUS CARD */}
        <View style={styles.statusCard}>
           <Text style={styles.cardTitle}>Current Live Version</Text>
           {loading ? (
             <ActivityIndicator color={COLORS.info} />
           ) : currentFirmware ? (
             <View>
               <Text style={styles.versionHuge}>{currentFirmware.version}</Text>
               <Text style={styles.metaText}>
                 Released: {currentFirmware.releasedAt?.toDate().toLocaleDateString()}
               </Text>
               {currentFirmware.notes && (
                 <Text style={styles.notesText}>{currentFirmware.notes}</Text>
               )}
               <View style={styles.liveBadge}>
                 <View style={styles.dot} />
                 <Text style={styles.liveText}>ACTIVE</Text>
               </View>
             </View>
           ) : (
             <Text style={styles.emptyText}>No firmware released yet.</Text>
           )}
        </View>

        {/* UPLOAD FORM */}
        <Text style={styles.sectionTitle}>Release Update</Text>
        <View style={styles.formCard}>
           
           {/* File Picker */}
           <TouchableOpacity style={styles.fileBtn} onPress={handlePickFile}>
              <MaterialCommunityIcons 
                name={selectedFile ? "check-circle" : "file-upload"} 
                size={28} 
                color={selectedFile ? COLORS.success : COLORS.primary} 
              />
              <View style={{ marginLeft: 12, flex: 1 }}>
                 <Text style={styles.fileBtnTitle}>
                    {selectedFile ? "File Selected" : "Select Firmware (.bin)"}
                 </Text>
                 <Text style={styles.fileBtnSub} numberOfLines={1}>
                    {selectedFile ? selectedFile.name : "Tap to browse files"}
                 </Text>
              </View>
              {selectedFile && (
                 <TouchableOpacity onPress={() => setSelectedFile(null)}>
                    <MaterialCommunityIcons name="close" size={20} color={COLORS.lightGray} />
                 </TouchableOpacity>
              )}
           </TouchableOpacity>

           {/* Inputs */}
           <Text style={styles.label}>Version Number</Text>
           <TextInput 
             style={styles.input} 
             placeholder="e.g. 1.2.0" 
             value={versionInput} 
             onChangeText={setVersionInput} 
             keyboardType="numeric"
           />

           <Text style={styles.label}>Release Notes (Optional)</Text>
           <TextInput 
             style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
             placeholder="What's new?" 
             value={notesInput} 
             onChangeText={setNotesInput} 
             multiline
           />

           {/* Release Button */}
           <TouchableOpacity 
             style={[styles.releaseBtn, (!selectedFile || !versionInput) && styles.disabledBtn]} 
             onPress={handleRelease}
             disabled={uploading || !selectedFile || !versionInput}
           >
              {uploading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.releaseBtnText}>PUSH UPDATE TO DEVICES</Text>
              )}
           </TouchableOpacity>

        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 4 },
  
  content: { padding: 16 },
  
  // STATUS CARD
  statusCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 24,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 3
  },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#95A5A6', textTransform: 'uppercase', marginBottom: 10 },
  versionHuge: { fontSize: 48, fontWeight: 'bold', color: COLORS.primary },
  metaText: { fontSize: 14, color: '#7F8C8D', marginBottom: 8 },
  notesText: { fontSize: 14, color: COLORS.text, fontStyle: 'italic', textAlign: 'center', marginBottom: 16 },
  liveBadge: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F8F5', 
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 6 },
  liveText: { color: COLORS.success, fontWeight: 'bold', fontSize: 12 },
  emptyText: { color: '#BDC3C7', fontStyle: 'italic', marginVertical: 20 },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 12, marginLeft: 4 },
  
  // FORM CARD
  formCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 3
  },
  fileBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA',
    padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed'
  },
  fileBtnTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  fileBtnSub: { fontSize: 12, color: '#95A5A6' },
  
  label: { fontSize: 14, fontWeight: '600', color: '#7F8C8D', marginBottom: 8 },
  input: {
    backgroundColor: '#F5F6FA', borderWidth: 1, borderColor: '#E0E0E0',
    borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.text, marginBottom: 16
  },
  
  releaseBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8
  },
  disabledBtn: { backgroundColor: '#BDC3C7' },
  releaseBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
});