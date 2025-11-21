import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'; // Added doc, getDoc
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';

// 1. Update the Status Type to include 'authenticated_admin'
type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated_no_feeder' | 'authenticated_with_feeder' | 'authenticated_admin';

interface AuthContextType {
  user: User | null;
  authStatus: AuthStatus;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authStatus: 'loading',
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        try {
          // --- NEW: CHECK FOR ADMIN ROLE FIRST ---
          // We assume you have a 'users' collection. 
          // If a doc exists with isAdmin: true, they are an admin.
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data().isAdmin === true) {
            console.log("User is Admin");
            setAuthStatus('authenticated_admin');
            return; // Stop execution here, don't check feeders
          }

          // --- EXISTING: CHECK FOR FEEDERS (For normal users) ---
          const feedersCollectionRef = collection(db, 'feeders');
          const q = query(feedersCollectionRef, where('owner_uid', '==', firebaseUser.uid));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            setAuthStatus('authenticated_no_feeder');
          } else {
            setAuthStatus('authenticated_with_feeder');
          }
        } catch (e) {
          console.error("Error checking auth status:", e);
          setAuthStatus('authenticated_no_feeder'); 
        }
      } else {
        setUser(null);
        setAuthStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, authStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);