import { initializeApp, getApps, getApp } from "firebase/app";
import { 
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

// Sử dụng getAuth tiêu chuẩn để tương thích 100% trên Safari/Chrome Mobile, tránh lỗi initializeAuth gây trắng màn hình
export const auth: Auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
