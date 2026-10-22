import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, getAuth, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// Cấu hình để Auth lưu trữ token ổn định trên trình duyệt di động (tránh lỗi mất phiên)
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: browserLocalPersistence
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;
