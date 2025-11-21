// Import the functions you need
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query } = require('firebase/firestore');

// TODO: COPY YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyD6qqin2W1UpqCbtudFN6cMHo8S3jtqz0c",
  authDomain: "pawfeeds-v2.firebaseapp.com",
  projectId: "pawfeeds-v2",
  storageBucket: "pawfeeds-v2.firebasestorage.app",
  messagingSenderId: "847280230673",
  appId: "1:847280230673:web:e82d2fa686e31775bbfcb0",
  databaseURL: "https://pawfeeds-v2-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- UPDATED SEED DATA ---
// Expanded with sub-breeds and wider coverage
const BREED_SEED_DATA = [
  // --- SMALL BREEDS (< 10kg) ---
  { name: 'Chihuahua', size: 'Small', defaultWeight: 2.5, defaultKcal: 400, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Pomeranian', size: 'Small', defaultWeight: 3, defaultKcal: 400, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Yorkshire Terrier', size: 'Small', defaultWeight: 3, defaultKcal: 400, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Poodle (Toy)', size: 'Small', defaultWeight: 4, defaultKcal: 410, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Dachshund (Miniature)', size: 'Small', defaultWeight: 5, defaultKcal: 395, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Shih Tzu', size: 'Small', defaultWeight: 6, defaultKcal: 390, defaultActivity: 'Low', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Pug', size: 'Small', defaultWeight: 8, defaultKcal: 380, defaultActivity: 'Low', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Schnauzer (Miniature)', size: 'Small', defaultWeight: 8, defaultKcal: 390, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Boston Terrier', size: 'Small', defaultWeight: 9, defaultKcal: 390, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },

  // --- MEDIUM BREEDS (10kg - 25kg) ---
  { name: 'Shiba Inu', size: 'Medium', defaultWeight: 10, defaultKcal: 380, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Poodle (Miniature)', size: 'Medium', defaultWeight: 11, defaultKcal: 400, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Dachshund (Standard)', size: 'Medium', defaultWeight: 11, defaultKcal: 385, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Corgi (Pembroke/Cardigan)', size: 'Medium', defaultWeight: 12, defaultKcal: 380, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'French Bulldog', size: 'Medium', defaultWeight: 12, defaultKcal: 375, defaultActivity: 'Low', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Cocker Spaniel (American)', size: 'Medium', defaultWeight: 12, defaultKcal: 390, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Beagle', size: 'Medium', defaultWeight: 13, defaultKcal: 390, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Cocker Spaniel (English)', size: 'Medium', defaultWeight: 14, defaultKcal: 385, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Schnauzer (Standard)', size: 'Medium', defaultWeight: 18, defaultKcal: 380, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Border Collie', size: 'Medium', defaultWeight: 20, defaultKcal: 400, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Bulldog (English)', size: 'Medium', defaultWeight: 23, defaultKcal: 370, defaultActivity: 'Low', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Siberian Husky', size: 'Medium', defaultWeight: 23, defaultKcal: 400, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },

  // --- LARGE BREEDS (> 25kg) ---
  { name: 'Poodle (Standard)', size: 'Large', defaultWeight: 27, defaultKcal: 390, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Boxer', size: 'Large', defaultWeight: 30, defaultKcal: 385, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Golden Retriever', size: 'Large', defaultWeight: 30, defaultKcal: 370, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Labrador Retriever', size: 'Large', defaultWeight: 32, defaultKcal: 375, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'German Shepherd', size: 'Large', defaultWeight: 35, defaultKcal: 375, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Schnauzer (Giant)', size: 'Large', defaultWeight: 35, defaultKcal: 380, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Doberman Pinscher', size: 'Large', defaultWeight: 40, defaultKcal: 390, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Bulldog (American)', size: 'Large', defaultWeight: 40, defaultKcal: 380, defaultActivity: 'High', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Bernese Mountain Dog', size: 'Large', defaultWeight: 45, defaultKcal: 370, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Rottweiler', size: 'Large', defaultWeight: 50, defaultKcal: 380, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
  { name: 'Great Dane', size: 'Large', defaultWeight: 65, defaultKcal: 390, defaultActivity: 'Normal', defaultNeuterStatus: 'Neutered/Spayed' },
];

async function seedDatabase() {
  const breedsRef = collection(db, 'dogBreeds');
  
  const q = query(breedsRef);
  const snapshot = await getDocs(q);
  // NOTE: If you want to force re-seeding, you might want to temporarily comment out this check
  // or manually delete the collection in your Firebase Console.
  if (!snapshot.empty) {
    console.log('Database already seeded. Aborting. Please delete the "dogBreeds" collection from your Firebase console to re-seed.');
    return;
  }

  console.log(`Seeding dogBreeds collection with ${BREED_SEED_DATA.length} breeds...`);
  for (const breed of BREED_SEED_DATA) {
    await addDoc(breedsRef, breed);
    console.log(`Added ${breed.name}`);
  }
  console.log('Seeding complete!');
}

seedDatabase().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});