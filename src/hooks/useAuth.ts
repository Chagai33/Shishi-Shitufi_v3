// src/hooks/useAuth.ts

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { auth, database } from '../lib/firebase';
import { useStore } from '../store/useStore';
import { User } from '../types';

/**
 * Hook לניהול מצב האימות - מותאם לארכיטקטורת Multi-Tenant
 * מאזין לשינויים במצב ההתחברות ומסנכרן עם ה-Store
 */
export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { setUser, clearCurrentEvent } = useStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      if (user) {
        setFirebaseUser(user);

        // A visitor arriving through an invitation link is signed in
        // anonymously before they have done anything at all, and this used to
        // write them a permanent user record on the spot: a fixed name, an
        // empty email, and nothing else, kept forever. 826 of the 848 records
        // in the database were that. Nothing reads them - the name a guest
        // types is stored on the event's participant list, not here - so the
        // only thing they ever did was make the number of users look 38 times
        // larger than it is.
        //
        // They get no record now, and no read either: there is nothing to look
        // for. The store simply has no user, which every screen already
        // handles, since that is the same state as being signed out. Two
        // things change on screen and both are corrections: the header says
        // "guest" instead of "new user", and the dashboard link stops being
        // offered to people who have no dashboard.
        // See DOCS/PLANING/26-anonymous-visitors-leave-empty-profiles.md.
        if (user.isAnonymous) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Load user profile from Database
        const userProfileRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userProfileRef);

        if (snapshot.exists()) {
          setUser(snapshot.val() as User);
        } else {
          // Create new profile for new user
          const newUserProfile: User = {
            id: user.uid,
            name: user.displayName || 'משתמש חדש',
            email: user.email || '',
            createdAt: Date.now(),
          };
          await set(userProfileRef, newUserProfile);
          setUser(newUserProfile);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
        clearCurrentEvent();
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, clearCurrentEvent]);

  const logout = () => auth.signOut();

  return {
    user: firebaseUser,
    isLoading,
    logout
  };
}