import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeAuth, 
  browserLocalPersistence, 
  indexedDBLocalPersistence, 
  GoogleAuthProvider, 
  getAuth,
  Auth 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

export const db = getFirestore(app, (firebaseConfigData as any).firestoreDatabaseId);

// Khởi tạo Auth với bộ nhớ lưu trữ bền vững dành riêng cho trình duyệt di động
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence]
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
