import { collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Define the shape of our schedule documents
interface Schedule {
  id: string;
  isEnabled: boolean;
  [key: string]: any; // Allow other properties
}

/**
 * Recalculates the portion size for all active schedules of a given pet and updates them in Firestore.
 * @param feederId The ID of the feeder (Required to find the correct path).
 * @param petId The ID of the pet whose schedule portions need recalculating.
 * @param knownDailyPortion (Optional) If the recommended portion is already known (e.g. during save), pass it to avoid a fetch.
 */
export const recalculatePortionsForPet = async (feederId: string, petId: string, knownDailyPortion?: number) => {
  if (!feederId || !petId) {
    console.error("recalculatePortionsForPet called with missing feederId or petId.");
    return;
  }

  try {
    let dailyPortion = knownDailyPortion;

    // 1. If portion isn't provided, fetch it from the pet document
    if (dailyPortion === undefined) {
        const petDocRef = doc(db, 'feeders', feederId, 'pets', petId);
        const petSnap = await getDoc(petDocRef);

        if (!petSnap.exists() || !petSnap.data().recommendedPortion) {
          console.log(`Pet ${petId} not found or has no recommendedPortion. Skipping calculation.`);
          return;
        }
        dailyPortion = petSnap.data().recommendedPortion as number;
    }

    // 2. Find all schedules for this pet
    const schedulesCollectionRef = collection(db, 'feeders', feederId, 'schedules');
    const q = query(schedulesCollectionRef, where('petId', '==', petId));
    const scheduleSnapshot = await getDocs(q);

    // Cast the documents to our Schedule type safely
    const allSchedules = scheduleSnapshot.docs.map(doc => {
      const data = doc.data() as Partial<Schedule>;
      return {
        id: doc.id,
        // FIX: Default to TRUE if undefined (handles legacy schedules missing the flag)
        isEnabled: data.isEnabled !== false, 
        ...data,
      };
    }) as Schedule[];
    
    const activeSchedules = allSchedules.filter(s => s.isEnabled);
    const activeScheduleCount = activeSchedules.length;

    console.log(`[recalculatePortionsForPet] Found ${activeScheduleCount} active schedules for pet ${petId} (Daily Goal: ${dailyPortion}g)`);

    // 3. Calculate the new per-meal portion
    const perMealPortion = activeScheduleCount > 0 ? Math.round(dailyPortion / activeScheduleCount) : 0;
    
    // 4. Use a batch write to update all schedules atomically
    const batch = writeBatch(db);

    allSchedules.forEach(schedule => {
      const scheduleDocRef = doc(db, 'feeders', feederId, 'schedules', schedule.id);
      // Update active schedules with the new portion, and inactive ones with 0
      const newPortion = schedule.isEnabled ? perMealPortion : 0;
      batch.update(scheduleDocRef, { portionGrams: newPortion });
    });

    await batch.commit();
    console.log(`Successfully recalculated portions for pet ${petId}. New per-meal portion: ${perMealPortion}g`);

  } catch (error) {
    console.error("Error recalculating portions: ", error);
  }
};