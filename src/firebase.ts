import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  GoogleAuthProvider, 
  getAuth,
  Auth 
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import firebaseConfigData from "../firebase-applet-config.json";

let app: any = null;
try {
  const firebaseConfig = {
    apiKey: (firebaseConfigData as any).apiKey,
    authDomain: typeof window !== 'undefined' && window.location.host ? window.location.host : ((firebaseConfigData as any).authDomain || "luyenthipro-tau.vercel.app"),
    projectId: (firebaseConfigData as any).projectId,
    storageBucket: (firebaseConfigData as any).storageBucket,
    messagingSenderId: (firebaseConfigData as any).messagingSenderId,
    appId: (firebaseConfigData as any).appId
  };
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.error("Critical: Firebase app initialization failed:", e);
}

export let db: any = null;
try {
  if (app) {
    const dbId = (firebaseConfigData as any).firestoreDatabaseId;
    db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
} catch (e) {
  console.warn("Firestore initialization warning:", e);
}

export let auth: any = null;
try {
  if (app) {
    auth = getAuth(app);
  }
} catch (e) {
  console.warn("Auth initialization warning:", e);
}

export const googleProvider = new GoogleAuthProvider();
try {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (e) {}
