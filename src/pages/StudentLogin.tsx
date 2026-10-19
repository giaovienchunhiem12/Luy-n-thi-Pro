import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function StudentLogin() {
  const navigate = useNavigate();
  const [selectedStudent, setSelectedStudent] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState<{ id: string; name: string; key?: string }[]>([]);

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
        console.error('Lỗi khi lấy danh sách học sinh:', error);
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
    const storedPass = localStorage.getItem(`student_pass_${selectedStudent}`) || '123';
    if (password !== storedPass) {
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đăng nhập Học sinh</h1>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên học sinh</label>
            <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                disabled={isLoading}
            >
                <option value="">Chọn học sinh</option>
                {students.map((student, idx) => (
                    <option key={student.key || `${student.id}-${idx}`} value={student.id}>{student.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Nhập mật khẩu (mặc định 123)"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
