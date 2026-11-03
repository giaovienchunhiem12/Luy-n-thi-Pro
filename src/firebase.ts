import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  GoogleAuthProvider, 
  getAuth 
} from "firebase/auth";
import { getFirestore, initializeFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfigData from "../firebase-applet-config.json";

// Lấy biến môi trường an toàn (hỗ trợ cả VITE_*, NEXT_PUBLIC_*, process.env, import.meta.env và file JSON)
const getEnv = (keys: string[], fallback: string = ''): string => {
  for (const key of keys) {
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
  }
  return fallback;
};

let app: any = null;
let db: any = null;
let auth: any = null;

if (typeof window !== 'undefined') {
  try {
    const apiKey = getEnv(
      ['VITE_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY'],
      (firebaseConfigData as any)?.apiKey || ''
    );
    // QUAN TRỌNG: Luôn dùng authDomain chuẩn của Firebase (lop12-thpt-phulam.firebaseapp.com)
    // để Google SignIn (Popup & Redirect) hoạt động 100% trên điện thoại, iPad, máy tính bảng và laptop
    const authDomain = getEnv(
      ['VITE_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
      (firebaseConfigData as any)?.authDomain || 'lop12-thpt-phulam.firebaseapp.com'
    );
    const projectId = getEnv(
      ['VITE_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
      (firebaseConfigData as any)?.projectId || 'lop12-thpt-phulam'
    );
    const storageBucket = getEnv(
      ['VITE_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
      (firebaseConfigData as any)?.storageBucket || ''
    );
    const messagingSenderId = getEnv(
      ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
      (firebaseConfigData as any)?.messagingSenderId || ''
    );
    const appId = getEnv(
      ['VITE_FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'],
      (firebaseConfigData as any)?.appId || ''
    );

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
      const dbId = getEnv(
        ['VITE_FIREBASE_DATABASE_ID', 'NEXT_PUBLIC_FIREBASE_DATABASE_ID'],
        (firebaseConfigData as any)?.firestoreDatabaseId || ''
      );
      try {
        // Bật experimentalAutoDetectLongPolling để tự động vượt tường lửa mạng di động 3G/4G/5G, iPad Safari, Zalo WebView & mạng trường học
        const firestoreSettings = {
          ignoreUndefinedProperties: true,
          experimentalAutoDetectLongPolling: true,
        };
        db = dbId
          ? initializeFirestore(app, firestoreSettings, dbId)
          : initializeFirestore(app, firestoreSettings);
      } catch {
        db = dbId ? getFirestore(app, dbId) : getFirestore(app);
      }
      auth = getAuth(app);

      // Kiểm tra kết nối Firestore ngầm khi khởi tạo
      const testConnection = async () => {
        try {
          if (db) {
            await getDocFromServer(doc(db, 'systemConfig', 'connectionCheck'));
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.warn("Firestore đang ở chế độ ngoại tuyến hoặc mạng chậm, tự động chuyển sang Long-Polling.");
          }
        }
      };
      testConnection();
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

