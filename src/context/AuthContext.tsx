import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isTeacher?: boolean;
}

interface AuthContextType {
  user: AppUser | User | null;
  loading: boolean;
  loginAsTeacher: (email?: string, name?: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginAsTeacher: () => {},
  logout: async () => {}
});

const TEACHER_STORAGE_KEY = 'teacher_auth_session';

// Hỗ trợ lưu trữ đa thiết bị (LocalStorage + SessionStorage + In-Memory Fallback)
// Hoạt động 100% trên điện thoại (Safari Private, Android Chrome, WebViews Zalo/FB)
let memoryTeacherSession: AppUser | null = null;

export const safeStorage = {
  getTeacherSession: (): AppUser | null => {
    if (memoryTeacherSession) return memoryTeacherSession;
    try {
      const raw = localStorage.getItem(TEACHER_STORAGE_KEY) || sessionStorage.getItem(TEACHER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryTeacherSession = parsed;
        return parsed;
      }
    } catch (e) {
      // Storage bị chặn bởi trình duyệt bảo mật, fallback sang memory
    }
    return null;
  },
  setTeacherSession: (teacher: AppUser) => {
    memoryTeacherSession = teacher;
    try {
      localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(teacher));
    } catch {}
    try {
      sessionStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(teacher));
    } catch {}
  },
  clearTeacherSession: () => {
    memoryTeacherSession = null;
    try {
      localStorage.removeItem(TEACHER_STORAGE_KEY);
    } catch {}
    try {
      sessionStorage.removeItem(TEACHER_STORAGE_KEY);
    } catch {}
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Đọc ngay session đã lưu lúc khởi tạo để tránh bị nhấp nháy hoặc redirect nhầm
  const [user, setUser] = useState<AppUser | User | null>(() => safeStorage.getTeacherSession());
  const [loading, setLoading] = useState<boolean>(() => !safeStorage.getTeacherSession());

  const loginAsTeacher = (
    email: string = 'giasudienvan@gmail.com',
    name: string = 'Thầy Điền Văn'
  ) => {
    const teacherUser: AppUser = {
      uid: 'teacher_giasudienvan',
      email,
      displayName: name,
      photoURL: null,
      isTeacher: true
    };
    safeStorage.setTeacherSession(teacherUser);
    setUser(teacherUser);
    setLoading(false);
  };

  const logout = async () => {
    safeStorage.clearTeacherSession();
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Lỗi khi đăng xuất Firebase Auth:', e);
    }
    setUser(null);
  };

  useEffect(() => {
    // 1. Kiểm tra session hiện tại
    const existing = safeStorage.getTeacherSession();
    if (existing) {
      setUser(existing);
      setLoading(false);
    }

    // 2. Lắng nghe trạng thái Firebase Authentication (Google / Email)
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Luôn kiểm tra lại safeStorage tại thời điểm thực tế, không dùng biến closure cũ!
        const teacher = safeStorage.getTeacherSession();
        if (teacher) {
          setUser(teacher);
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginAsTeacher, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

