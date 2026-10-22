import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  GoogleAuthProvider, 
  getAuth 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfigData from "../firebase-applet-config.json";

// Lấy biến môi trường an toàn (hỗ trợ cả process.env, import.meta.env và file JSON)
const getEnv = (key: string, fallback: string = ''): string => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key]!;
    }
  } catch {}
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key]!;
    }
  } catch {}
  return fallback;
};

let app: any = null;
let db: any = null;
let auth: any = null;

if (typeof window !== 'undefined') {
  try {
    const host = window.location.host || '';
    const apiKey = getEnv('NEXT_PUBLIC_FIREBASE_API_KEY', (firebaseConfigData as any)?.apiKey || '');
    const authDomain = getEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', host || (firebaseConfigData as any)?.authDomain || "luyenthipro-tau.vercel.app");
    const projectId = getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', (firebaseConfigData as any)?.projectId || 'lop12-thpt-phulam');
    const storageBucket = getEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', (firebaseConfigData as any)?.storageBucket || '');
    const messagingSenderId = getEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', (firebaseConfigData as any)?.messagingSenderId || '');
    const appId = getEnv('NEXT_PUBLIC_FIREBASE_APP_ID', (firebaseConfigData as any)?.appId || '');

    const firebaseConfig = {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId
    };

    if (apiKey) {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const dbId = (firebaseConfigData as any)?.firestoreDatabaseId;
      db = dbId ? getFirestore(app, dbId) : getFirestore(app);
      auth = getAuth(app);
    }
  } catch (e) {
    console.error("Firebase init error safely caught:", e);
  }
}

export { app, db, auth };

export const googleProvider = new GoogleAuthProvider();
try {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (e) {}
