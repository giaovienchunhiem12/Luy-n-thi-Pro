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

// Hỗ trợ lưu trữ 4 lớp đa thiết bị (In-Memory + LocalStorage + SessionStorage + Cookie)
// Hoạt động 100% trên điện thoại (Safari Private, Android Chrome, WebViews Zalo/FB, iPad)
let memoryTeacherSession: AppUser | null = null;

export const safeStorage = {
  getTeacherSession: (): AppUser | null => {
    if (memoryTeacherSession) return memoryTeacherSession;
    if (typeof window === 'undefined') return null;

    // 1. Kiểm tra localStorage
    try {
      const raw = localStorage.getItem(TEACHER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryTeacherSession = parsed;
        return parsed;
      }
    } catch (e) {}

    // 2. Kiểm tra sessionStorage
    try {
      const raw = sessionStorage.getItem(TEACHER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryTeacherSession = parsed;
        return parsed;
      }
    } catch (e) {}

    // 3. Kiểm tra Cookie (hoạt động tốt khi localStorage bị chặn ở chế độ ẩn danh iOS)
    try {
      const match = document.cookie.match(new RegExp('(^| )' + TEACHER_STORAGE_KEY + '=([^;]+)'));
      if (match && match[2]) {
        const parsed = JSON.parse(decodeURIComponent(match[2]));
        memoryTeacherSession = parsed;
        return parsed;
      }
    } catch (e) {}

    return null;
  },
  setTeacherSession: (teacher: AppUser) => {
    memoryTeacherSession = teacher;
    const str = JSON.stringify(teacher);
    try {
      localStorage.setItem(TEACHER_STORAGE_KEY, str);
    } catch {}
    try {
      sessionStorage.setItem(TEACHER_STORAGE_KEY, str);
    } catch {}
    try {
      document.cookie = `${TEACHER_STORAGE_KEY}=${encodeURIComponent(str)}; path=/; max-age=2592000; SameSite=Lax`;
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
    try {
      document.cookie = `${TEACHER_STORAGE_KEY}=; path=/; max-age=0`;
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

    // 2. Fallback timeout: Trên mạng di động (3G/4G/mạng trường học) nếu Firebase Auth kết nối chậm,
    // tự động giải phóng loading sau 1.2s để không bao giờ bị kẹt màn hình tải
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    // 3. Lắng nghe trạng thái Firebase Authentication (Google / Email)
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      clearTimeout(fallbackTimer);
      if (currentUser) {
        setUser(currentUser);
      } else {
        const teacher = safeStorage.getTeacherSession();
        if (teacher) {
          setUser(teacher);
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginAsTeacher, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

