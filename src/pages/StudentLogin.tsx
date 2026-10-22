import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const DEFAULT_STUDENTS = [
  { id: 'SBD001', key: 'def_SBD001', name: 'Nguyễn Văn An (Lớp 12A1 - SBD001)' },
  { id: 'SBD002', key: 'def_SBD002', name: 'Trần Thị Mai (Lớp 12A1 - SBD002)' },
  { id: 'SBD003', key: 'def_SBD003', name: 'Lê Hoàng Nam (Lớp 12A1 - SBD003)' },
  { id: 'SBD004', key: 'def_SBD004', name: 'Phạm Minh Đức (Lớp 12A1 - SBD004)' },
  { id: 'SBD005', key: 'def_SBD005', name: 'Đỗ Khánh Linh (Lớp 12A1 - SBD005)' },
  { id: 'SBD006', key: 'def_SBD006', name: 'Vũ Phương Thảo (Lớp 12A1 - SBD006)' },
  { id: 'SBD007', key: 'def_SBD007', name: 'Hoàng Quốc Huy (Lớp 12A1 - SBD007)' }
];

export default function StudentLogin() {
  const navigate = useNavigate();
  const [selectedStudent, setSelectedStudent] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState<{ id: string; name: string; key?: string }[]>(DEFAULT_STUDENTS);

  useEffect(() => {
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
          setStudents(DEFAULT_STUDENTS);
        } else {
          allStudents.sort((a, b) => a.name.localeCompare(b.name));
          setStudents(allStudents);
        }
      } catch (error) {
        console.error('Lỗi khi lấy danh sách học sinh:', error);
        setStudents(DEFAULT_STUDENTS);
      }
    };
    fetchStudents();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !password) {
      setErrorMessage('Vui lòng chọn tên học sinh và nhập mật khẩu.');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);

    // Xác thực mật khẩu (mặc định 123 hoặc mật khẩu học sinh đã đổi)
    let storedPass = '123';
    try {
      storedPass =
        localStorage.getItem(`student_pass_${selectedStudent}`) ||
        sessionStorage.getItem(`student_pass_${selectedStudent}`) ||
        '123';
    } catch {}

    const cleanPass = password.trim();
    if (cleanPass !== storedPass && cleanPass !== '123') {
        setErrorMessage('Mật khẩu không đúng. Mật khẩu mặc định là 123.');
        setIsLoading(false);
        return;
    }

    try {
      // Đăng nhập thành công, chuyển hướng đến trang học sinh
      navigate(`/student-dashboard?studentId=${selectedStudent}`);
    } catch (error) {
      setErrorMessage('Đã xảy ra lỗi khi đăng nhập.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-200 p-5 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Đăng nhập Học sinh</h1>
          <p className="text-xs text-gray-500">Cổng luyện thi và làm bài trắc nghiệm trực tuyến</p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Họ tên học sinh</label>
            <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                disabled={isLoading}
            >
                <option value="">Chọn học sinh</option>
                {students.map((student, idx) => (
                    <option key={student.key || `${student.id}-${idx}`} value={student.id}>{student.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
              placeholder="Nhập mật khẩu (mặc định 123)"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            disabled={isLoading}
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-gray-100">
          <Link
            to="/"
            className="text-xs text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Chuyển sang Khu vực Giáo viên</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
