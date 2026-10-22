import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  GoogleAuthProvider, 
  getAuth,
  Auth 
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import firebaseConfigData from "../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: (firebaseConfigData as any).apiKey,
  authDomain: (firebaseConfigData as any).authDomain,
  projectId: (firebaseConfigData as any).projectId,
  storageBucket: (firebaseConfigData as any).storageBucket,
  messagingSenderId: (firebaseConfigData as any).messagingSenderId,
  appId: (firebaseConfigData as any).appId
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export let db: Firestore;
try {
  const dbId = (firebaseConfigData as any).firestoreDatabaseId;
  db = dbId ? getFirestore(app, dbId) : getFirestore(app);
} catch (e) {
  console.warn("Failed to init named firestore, falling back to default:", e);
  db = getFirestore(app);
}

export let auth: Auth;
try {
  auth = getAuth(app);
} catch (e) {
  console.warn("Failed to init auth:", e);
  auth = getAuth(app);
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

