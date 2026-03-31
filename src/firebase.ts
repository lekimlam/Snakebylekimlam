import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user exists in private collection
    const privateRef = doc(db, 'users_private', user.uid);
    const privateSnap = await getDoc(privateRef);
    
    if (!privateSnap.exists()) {
      // Create new user profile
      const role = user.email === 'lekimlam16052015@gmail.com' ? 'admin' : 'player';
      await setDoc(privateRef, {
        uid: user.uid,
        email: user.email,
        role: role,
        createdAt: serverTimestamp()
      });
      
      const publicRef = doc(db, 'users_public', user.uid);
      await setDoc(publicRef, {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        highestScore: 0
      });
    }
    return user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      // Auto-register if not found
      try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        const user = result.user;
        
        const role = email === 'lekimlam@admin.com' ? 'admin' : 'player';
        
        await setDoc(doc(db, 'users_private', user.uid), {
          uid: user.uid,
          email: user.email,
          role: role,
          createdAt: serverTimestamp()
        });
        
        await setDoc(doc(db, 'users_public', user.uid), {
          uid: user.uid,
          displayName: email.split('@')[0],
          highestScore: 0
        });
        return user;
      } catch (regError) {
        throw regError;
      }
    }
    throw error;
  }
};

export const logout = () => signOut(auth);

export const updateHighScore = async (uid: string, score: number) => {
  try {
    const publicRef = doc(db, 'users_public', uid);
    const publicSnap = await getDoc(publicRef);
    if (publicSnap.exists()) {
      const currentHigh = publicSnap.data().highestScore || 0;
      if (score > currentHigh) {
        await updateDoc(publicRef, { highestScore: score });
      }
    }
  } catch (error) {
    console.error("Error updating high score", error);
  }
};
