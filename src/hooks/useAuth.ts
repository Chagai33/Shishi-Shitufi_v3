// src/hooks/useAuth.ts

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { ref, get, runTransaction } from 'firebase/database';
import { auth, database } from '../lib/firebase';
import { useStore } from '../store/useStore';
import { User } from '../types';

// The auth error codes that mean the account behind this session is gone or
// switched off, as opposed to a network that did not answer. Only these may
// sign anybody out: logging out a live person is the worse of the two harms,
// so every other failure is read as "we do not know" and nothing happens.
//
// Measured against the live project on 25/08/2026 rather than taken from the
// documentation. A deleted account answers USER_NOT_FOUND on the wire, which
// this library maps to user-token-expired: the name says token, the answer
// behind it says the account is not there. A dead network answers
// network-request-failed, the session survives it, and the next attempt works.
// See DOCS/PLANING/40-deleted-account-comes-back-as-a-profile.md.
const ACCOUNT_IS_GONE = new Set([
  'auth/user-token-expired',
  'auth/user-disabled',
  'auth/user-not-found',
]);

type AccountState = 'alive' | 'gone' | 'unknown';

/**
 * Whether the account behind this session still exists.
 *
 * Asking the server for a fresh token is the only way to find out from here.
 * The token already in the browser keeps working for up to an hour after the
 * server has deleted the account, so the browser on its own cannot tell.
 */
async function accountState(user: FirebaseUser): Promise<AccountState> {
  try {
    await user.getIdToken(true);
    return 'alive';
  } catch (error) {
    const code = (error as { code?: string })?.code ?? '';
    return ACCOUNT_IS_GONE.has(code) ? 'gone' : 'unknown';
  }
}

/**
 * Hook לניהול מצב האימות - מותאם לארכיטקטורת Multi-Tenant
 * מאזין לשינויים במצב ההתחברות ומסנכרן עם ה-Store
 */
export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { setUser, clearCurrentEvent } = useStore();

  useEffect(() => {
    // Unsubscribing stops the next callback; it cannot stop one that is already
    // parked on an await. This hook is mounted by ten different components, and
    // the branch below waits on the network twice, so an instance that has gone
    // away must not come back a second later and sign the whole application
    // out on behalf of a screen that no longer exists.
    let cancelled = false;

    const forgetTheUser = () => {
      setFirebaseUser(null);
      setUser(null);
      clearCurrentEvent();
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);

      // Everything below reaches the network, and any of it can reject. Without
      // this the rejection escapes the callback, the line that lowers the
      // loading flag is never reached, and the whole application stays on the
      // full screen spinner with nothing anywhere saying why.
      try {
        if (!user) {
          forgetTheUser();
          return;
        }

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
          return;
        }

        // Load user profile from Database
        const userProfileRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userProfileRef);
        if (cancelled) return;

        if (snapshot.exists()) {
          setUser(snapshot.val() as User);
          return;
        }

        // Signed in, with no record. Two very different people land here.
        //
        // One is somebody registering right now, or an account created outside
        // the product, and they should get a record.
        //
        // The other is somebody who has just asked to be deleted. The server
        // deletes the account and wipes every trace of them, and then a tab
        // still holding that identity - not necessarily the tab that pressed
        // the button, which is why signing that one tab out cannot fix this -
        // arrives here, finds no record, and writes the person back into the
        // database with their name and their email address in it. It happened,
        // six seconds after a deletion completed, and nothing on any screen
        // said so.
        //
        // The two look identical from here, so the server is asked which one
        // this is before anything is written.
        // See DOCS/PLANING/40-deleted-account-comes-back-as-a-profile.md.
        const state = await accountState(user);
        if (cancelled) return;

        // Only an answer that says the account is gone ends the session.
        //
        // The library normally gets to the sign-out first - it clears the
        // session itself on two of the three codes, and the listener sees
        // that - so this is belt and braces for the third, and for any
        // version that stops doing it. Signing out a session that is already
        // gone was measured as a no-op with no side effects. It is skipped
        // only if somebody else has signed in during the wait, which happens
        // on an event page, where a guest identity is handed out the moment
        // the old one goes.
        if (state === 'gone') {
          forgetTheUser();
          const somebodyElseIsHereNow = !!auth.currentUser && auth.currentUser.uid !== user.uid;
          if (!somebodyElseIsHereNow) {
            await auth.signOut();
          }
          return;
        }

        // No answer either way. Nothing is written and nobody is signed out: a
        // network fault has to leave a live person exactly where they were,
        // and it is the worse of the two harms to get wrong.
        //
        // One more look before giving up, because the commonest way to be
        // standing here is not a deleted account at all. Registration lands in
        // this branch every single time - the account exists a moment before
        // its record does - and the record usually arrives while the question
        // above is still in the air. Without this, one dropped request during
        // sign-up left somebody with a working account looking at the login
        // form, and nothing re-runs on its own to get them out of it.
        if (state === 'unknown') {
          const settled = await get(userProfileRef);
          if (cancelled) return;
          if (settled.exists()) setUser(settled.val() as User);
          return;
        }

        if (auth.currentUser?.uid !== user.uid) return;

        // Create new profile for new user
        const newUserProfile: User = {
          id: user.uid,
          name: user.displayName || 'משתמש חדש',
          email: user.email || '',
          createdAt: Date.now(),
        };

        // Written only if there is still nothing there. Asking the server about
        // the account costs a round trip, and that round trip sits between
        // finding no record and writing one - which is exactly the window in
        // which registration writes the real record, carrying the name the
        // person actually typed. A plain write would land last and replace it
        // with "new user". This one steps aside instead, and the store takes
        // whichever record ended up in the database.
        let stored: User | null;
        try {
          const outcome = await runTransaction(userProfileRef, (existing: User | null) =>
            existing === null ? newUserProfile : undefined
          );
          stored = outcome.snapshot.val() as User | null;
        } catch {
          // A plain write landing on this same node while the transaction is
          // outstanding cancels it outright, and registration is a plain write
          // landing on this same node. Read what it left rather than treating
          // somebody's successful sign-up as a failure.
          stored = (await get(userProfileRef)).val() as User | null;
        }
        if (cancelled) return;

        if (stored) setUser(stored);
      } catch (error) {
        // Deliberately only a record and a lowered flag. Whatever failed here
        // says nothing about who is signed in, so clearing the store would
        // throw an established organizer off their own dashboard because one
        // read did not come back.
        console.error('Could not settle the signed-in user:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setUser, clearCurrentEvent]);

  const logout = () => auth.signOut();

  return {
    user: firebaseUser,
    isLoading,
    logout
  };
}
