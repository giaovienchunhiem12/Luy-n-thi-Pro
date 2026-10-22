import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  GoogleAuthProvider, 
  getAuth,
  Auth 
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import firebaseConfigData from "../firebase-applet-config.json";

let app: any = null;
let db: any = null;
let auth: any = null;

if (typeof window !== 'undefined') {
  try {
    const host = window.location.host || '';
    const firebaseConfig = {
      apiKey: (firebaseConfigData as any).apiKey,
      authDomain: host ? host : ((firebaseConfigData as any).authDomain || "luyenthipro-tau.vercel.app"),
      projectId: (firebaseConfigData as any).projectId,
      storageBucket: (firebaseConfigData as any).storageBucket,
      messagingSenderId: (firebaseConfigData as any).messagingSenderId,
      appId: (firebaseConfigData as any).appId
    };
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

    const dbId = (firebaseConfigData as any).firestoreDatabaseId;
    db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    auth = getAuth(app);
  } catch (e) {
    console.error("Firebase init error:", e);
  }
}

export { app, db, auth };

export const googleProvider = new GoogleAuthProvider();
try {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (e) {}
