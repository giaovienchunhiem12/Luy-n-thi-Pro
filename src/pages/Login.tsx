import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, GraduationCap, CheckCircle2, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [students, setStudents] = useState<{ id: string; name: string; key?: string }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
    
    // Lấy danh sách học sinh từ tất cả các lớp trong Quản lý lớp
    const fetchStudents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'classes'));
        const allStudents: { id: string; name: string; key: string }[] = [];
        
        querySnapshot.forEach(docSnap => {
          const classData = docSnap.data();
          if (classData.students && Array.isArray(classData.students)) {
            classData.students.forEach((st: any, sIdx: number) => {
              if (st && st.name) {
                const sId = st.id || st.name;
                allStudents.push({
                  key: `${docSnap.id}_${sId}_${sIdx}`,
                  id: sId,
                  name: `${st.name} (${classData.name || 'Lớp'}${st.id ? ` - ${st.id}` : ''})`
                });
              }
            });
          }
        });
        
        if (allStudents.length === 0) {
          const default12Students = [
            { id: 'SBD001', key: 'def_SBD001', name: 'Nguyễn Văn An (Lớp 12A1 - SBD001)' },
            { id: 'SBD002', key: 'def_SBD002', name: 'Trần Thị Mai (Lớp 12A1 - SBD002)' },
            { id: 'SBD003', key: 'def_SBD003', name: 'Lê Hoàng Nam (Lớp 12A1 - SBD003)' },
            { id: 'SBD004', key: 'def_SBD004', name: 'Phạm Minh Đức (Lớp 12A1 - SBD004)' },
            { id: 'SBD005', key: 'def_SBD005', name: 'Đỗ Khánh Linh (Lớp 12A1 - SBD005)' },
            { id: 'SBD006', key: 'def_SBD006', name: 'Vũ Phương Thảo (Lớp 12A1 - SBD006)' },
            { id: 'SBD007', key: 'def_SBD007', name: 'Hoàng Quốc Huy (Lớp 12A1 - SBD007)' }
          ];
          setStudents(default12Students);
        } else {
          allStudents.sort((a, b) => a.name.localeCompare(b.name));
          setStudents(allStudents);
        }
      } catch (error) {
        console.error('Lỗi khi lấy danh sách học sinh từ các lớp:', error);
        // Fallback grade 12 students on error
        setStudents([
          { id: 'SBD001', key: 'def_SBD001', name: 'Nguyễn Văn An (Lớp 12A1 - SBD001)' },
          { id: 'SBD002', key: 'def_SBD002', name: 'Trần Thị Mai (Lớp 12A1 - SBD002)' },
          { id: 'SBD003', key: 'def_SBD003', name: 'Lê Hoàng Nam (Lớp 12A1 - SBD003)' },
          { id: 'SBD004', key: 'def_SBD004', name: 'Phạm Minh Đức (Lớp 12A1 - SBD004)' },
          { id: 'SBD005', key: 'def_SBD005', name: 'Đỗ Khánh Linh (Lớp 12A1 - SBD005)' },
          { id: 'SBD006', key: 'def_SBD006', name: 'Vũ Phương Thảo (Lớp 12A1 - SBD006)' },
          { id: 'SBD007', key: 'def_SBD007', name: 'Hoàng Quốc Huy (Lớp 12A1 - SBD007)' }
        ]);
      }
    };
    fetchStudents();
  }, [user, loading, navigate]);

  const login = async () => {
    setErrorMessage(null);
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error: any) {
      setErrorMessage('Đã xảy ra sự cố khi đăng nhập bằng Google.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setErrorMessage('Vui lòng chọn học sinh từ danh sách.');
      return;
    }
    const storedPass = localStorage.getItem(`student_pass_${selectedStudent}`) || '123';
    if (password !== storedPass) {
      setErrorMessage('Mật khẩu không đúng. Mật khẩu mặc định là 123.');
      return;
    }
    setErrorMessage(null);
    navigate(`/student-dashboard?studentId=${encodeURIComponent(selectedStudent)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-lg border border-slate-200 p-8 md:p-12">
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-md mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Luyện Thi Pro</h1>
          <p className="text-slate-500">Hệ thống quản lý lớp học và luyện thi trực tuyến</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Giáo viên */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 text-center">Dành cho Giáo viên</h2>
            <button
                onClick={login}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-all shadow-sm cursor-pointer"
            >
                {isLoggingIn ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}
            </button>
          </div>

          {/* Học sinh */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800 text-center">Dành cho Học sinh</h2>
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
              >
                  <option value="">-- Chọn họ và tên học sinh --</option>
                  {students.length > 0 ? (
                    students.map((st, idx) => (
                      <option key={st.key || `${st.id}-${idx}`} value={st.id}>
                        {st.name}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>Chưa có học sinh (thầy cô cần tạo lớp trước)</option>
                  )}
              </select>
              <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Mật khẩu (mặc định 123)"
                  required
              />
              <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all cursor-pointer"
              >
                  Đăng nhập <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-8 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-sm text-rose-700">
            <AlertCircle className="w-5 h-5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
