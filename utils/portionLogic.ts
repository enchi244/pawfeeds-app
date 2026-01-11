import { collection, doc, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface Schedule {
  id: string;
  isEnabled: boolean;
  repeatDays?: string[];
  skippedDays?: string[];
  [key: string]: any;
}

interface ScheduleUpdate {
  id: string;
  changes: Partial<Schedule>;
}

const DAY_CODES = ['M', 'T', 'W', 'R', 'F', 'S', 'U'];

export const recalculatePortionsForPet = async (
  feederId: string, 
  petId: string, 
  knownDailyPortion?: number,
  pendingUpdate?: ScheduleUpdate
) => {
  if (!feederId || !petId) return;

  try {
    let dailyPortion = knownDailyPortion;

    // 1. Fetch Daily Goal
    if (dailyPortion === undefined) {
        const petDocRef = doc(db, 'feeders', feederId, 'pets', petId);
        const petSnap = await getDoc(petDocRef);
        if (!petSnap.exists() || !petSnap.data().recommendedPortion) return;
        dailyPortion = petSnap.data().recommendedPortion as number;
    }

    // 2. Fetch all schedules
    const schedulesRef = collection(db, 'feeders', feederId, 'schedules');
    const q = query(schedulesRef, where('petId', '==', petId));
    const snapshot = await getDocs(q);

    // 3. Prepare In-Memory State (Apply Optimistic Updates)
    let schedules = snapshot.docs.map(d => ({
      id: d.id,
      isEnabled: d.data().isEnabled !== false,
      repeatDays: d.data().repeatDays || [],
      skippedDays: d.data().skippedDays || [],
      ...d.data()
    })) as Schedule[];

    if (pendingUpdate) {
      schedules = schedules.map(s => 
        s.id === pendingUpdate.id ? { ...s, ...pendingUpdate.changes } : s
      );
    }

    // --- STEP 4: Calculate Meal Counts Per Day ---
    // This determines how many times the pet eats on "Monday", "Tuesday", etc.
    const dayCounts: Record<string, number> = {
      'M': 0, 'T': 0, 'W': 0, 'R': 0, 'F': 0, 'S': 0, 'U': 0
    };

    const activeSchedules = schedules.filter(s => s.isEnabled);

    activeSchedules.forEach(schedule => {
        const repeats = schedule.repeatDays || [];
        // Handle pending updates for skippedDays
        const skips = (pendingUpdate && schedule.id === pendingUpdate.id && pendingUpdate.changes.skippedDays) 
            ? pendingUpdate.changes.skippedDays 
            : (schedule.skippedDays || []);
        
        repeats.forEach(day => {
            if (DAY_CODES.includes(day) && !skips.includes(day)) {
                dayCounts[day]++;
            }
        });
    });

    // --- STEP 5: Calculate Ideal Portion Per Day ---
    // e.g., Mon (1 meal) = 158g. Wed (2 meals) = 79g.
    const dayIdealPortions: Record<string, number> = {};
    DAY_CODES.forEach(day => {
        const count = dayCounts[day];
        dayIdealPortions[day] = count > 0 ? (dailyPortion || 0) / count : 0;
    });

    console.log(`[PortionLogic] Daily Ideals:`, dayIdealPortions);

    // --- STEP 6: Detect Conflicts & Split Schedules ---
    const batch = writeBatch(db);

    for (const schedule of schedules) {
      const originalRef = doc(db, 'feeders', feederId, 'schedules', schedule.id);
      
      // Merge pending changes for logic checks
      const skips = (pendingUpdate && schedule.id === pendingUpdate.id && pendingUpdate.changes.skippedDays) 
          ? pendingUpdate.changes.skippedDays 
          : (schedule.skippedDays || []);
      const repeats = (pendingUpdate && schedule.id === pendingUpdate.id && pendingUpdate.changes.repeatDays)
          ? pendingUpdate.changes.repeatDays
          : (schedule.repeatDays || []);

      if (!schedule.isEnabled) {
          batch.update(originalRef, { portionGrams: 0 });
          continue;
      }

      // Find active days for this schedule
      const activeDays = (repeats as string[]).filter(day => !skips.includes(day));

      if (activeDays.length === 0) {
          batch.update(originalRef, { portionGrams: 0 });
          continue;
      }

      // Group days by their Ideal Portion
      // Example: A Mon/Wed/Fri schedule might result in:
      // { "158": ["M", "F"], "79": ["W"] }
      const portionGroups: Record<number, string[]> = {};
      
      activeDays.forEach(day => {
          const portion = Math.round(dayIdealPortions[day]); // Round to avoid float errors
          if (!portionGroups[portion]) portionGroups[portion] = [];
          portionGroups[portion].push(day);
      });

      const uniquePortions = Object.keys(portionGroups).map(Number);

      // CASE A: Perfect Match (All days need the same amount)
      if (uniquePortions.length === 1) {
          const portion = uniquePortions[0];
          const updates: any = { portionGrams: portion };
          if (pendingUpdate && schedule.id === pendingUpdate.id) {
             Object.assign(updates, pendingUpdate.changes);
          }
          batch.update(originalRef, updates);
      } 
      // CASE B: Conflict Detected (Days need different amounts) -> SPLIT IT
      else if (uniquePortions.length > 1) {
          console.log(`[PortionLogic] Auto-splitting schedule ${schedule.name} due to portion mismatch.`);
          
          // Sort groups by size (keep the largest group in the original ID to minimize deletions)
          uniquePortions.sort((a, b) => portionGroups[b].length - portionGroups[a].length);
          
          const primaryPortion = uniquePortions[0];
          const primaryDays = portionGroups[primaryPortion];

          // 1. Update ORIGINAL schedule to keep only Primary Days (e.g., Mon, Fri)
          batch.update(originalRef, {
              repeatDays: primaryDays,
              skippedDays: [], // Reset skips as we are defining exact days now
              portionGrams: primaryPortion
          });

          // 2. Create NEW schedules for the other groups (e.g., Wed)
          for (let i = 1; i < uniquePortions.length; i++) {
              const portion = uniquePortions[i];
              const days = portionGroups[portion];
              
              const newScheduleRef = doc(collection(db, 'feeders', feederId, 'schedules'));
              batch.set(newScheduleRef, {
                  ...schedule, // Copy all properties (name, time, petId...)
                  id: newScheduleRef.id,
                  repeatDays: days,
                  skippedDays: [],
                  portionGrams: portion,
                  isEnabled: true
              });
          }
      }
    }

    await batch.commit();

  } catch (error) {
    console.error("Error in atomic recalculation:", error);
  }
};