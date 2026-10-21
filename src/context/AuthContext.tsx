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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
    try {
      localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(teacherUser));
    } catch (e) {
      console.warn('Không thể lưu session vào localStorage:', e);
    }
    setUser(teacherUser);
  };

  const logout = async () => {
    try {
      localStorage.removeItem(TEACHER_STORAGE_KEY);
    } catch (e) {
      console.warn('Lỗi khi xóa session khỏi localStorage:', e);
    }
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Lỗi khi đăng xuất Firebase Auth:', e);
    }
    setUser(null);
  };

  useEffect(() => {
    // 1. Kiểm tra session giáo viên đã lưu trong localStorage
    let storedTeacher: AppUser | null = null;
    try {
      const raw = localStorage.getItem(TEACHER_STORAGE_KEY);
      if (raw) {
        storedTeacher = JSON.parse(raw);
        setUser(storedTeacher);
      }
    } catch (e) {
      console.warn('Lỗi khi đọc session từ localStorage:', e);
    }

    // 2. Lắng nghe trạng thái Firebase Authentication (Google / Email)
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else if (!storedTeacher) {
        // Chỉ reset về null nếu không có session giáo viên trong localStorage
        setUser(null);
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

