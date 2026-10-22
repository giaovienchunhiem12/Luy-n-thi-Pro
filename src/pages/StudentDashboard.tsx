import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Bell,
  FileText,
  KeyRound,
  LogOut,
  CheckCircle2,
  User,
  Clock,
  ShieldCheck,
  X,
  Play,
  Award,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Eye,
  Check,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Menu,
  GraduationCap
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';

export interface StudentSubmission {
  id?: string;
  sessionId: string;
  examTitle: string;
  studentName: string;
  studentId?: string;
  sbd?: string;
  totalScore: number;
  p1?: string;
  p2?: string;
  p3?: string;
  p4?: string;
  startedAtStr?: string;
  submittedAtStr?: string;
  status?: string;
  violationCount?: number;
  tabSwitchCount?: number;
  violationLogs?: Array<{ time: string; type: string; details: string }>;
  answers?: Record<string, any>;
}

export default function StudentDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const studentId = searchParams.get('studentId') || '';

  const [studentName, setStudentName] = useState<string>('Học sinh');
  const [cleanStudentName, setCleanStudentName] = useState<string>('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal xem chi tiết kết quả bài đã làm
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);

  const [notifications] = useState([
    { id: 1, title: 'Quy chế thi trực tuyến', message: 'Học sinh chú ý không chuyển tab hoặc thoát khỏi màn hình trong khi làm bài (vi phạm 2 lần sẽ tự động nộp bài).' },
    { id: 2, title: 'Thông báo bài tập', message: 'Hãy hoàn thành các bài thi được giao đúng thời hạn quy định của giáo viên bộ môn.' },
  ]);

  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);

  // 1. Tải thông tin học sinh từ collection classes
  useEffect(() => {
    const loadStudentInfo = async () => {
      try {
        const classesSnap = await getDocs(collection(db, 'classes'));
        let foundFull = '';
        let foundPure = '';
        classesSnap.forEach(d => {
          const cData = d.data();
          if (cData.students && Array.isArray(cData.students)) {
            const st = cData.students.find((s: any) => s.id === studentId || s.name === studentId);
            if (st) {
              foundFull = `${st.name} (${cData.name || 'Lớp'}${st.id ? ` - ${st.id}` : ''})`;
              foundPure = st.name;
            }
          }
        });
        if (!foundFull && studentId) {
          const default12Students = [
            { id: 'SBD001', name: 'Nguyễn Văn An' },
            { id: 'SBD002', name: 'Trần Thị Mai' },
            { id: 'SBD003', name: 'Lê Hoàng Nam' },
            { id: 'SBD004', name: 'Phạm Minh Đức' },
            { id: 'SBD005', name: 'Đỗ Khánh Linh' },
            { id: 'SBD006', name: 'Vũ Phương Thảo' },
            { id: 'SBD007', name: 'Hoàng Quốc Huy' }
          ];
          const matchDef = default12Students.find(s => s.id === studentId || s.name === studentId || studentId.includes(s.name));
          if (matchDef) {
            foundFull = `${matchDef.name} (Lớp 12A1 - ${matchDef.id})`;
            foundPure = matchDef.name;
          }
        }

        if (foundFull) {
          setStudentName(foundFull);
          setCleanStudentName(foundPure);
        } else if (studentId) {
          setStudentName(studentId);
          setCleanStudentName(studentId.split('(')[0].trim());
        }
      } catch (err) {
        console.error('Lỗi tải thông tin học sinh:', err);
      }
    };

    loadStudentInfo();
  }, [studentId]);

  // 2. Lắng nghe danh sách bài thi được giao từ Firestore
  useEffect(() => {
    const unsubSessions = onSnapshot(collection(db, 'examSessions'), (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setAssignments(list);
      } else {
        setAssignments([
          { id: 'GD12_Bai2_12A1', name: 'GD12_Bài 2.docx_12A1', examTitle: 'GD12_Bài 2.docx', className: '12A1', durationMinutes: 45, status: 'Đang diễn ra' },
          { id: 'Ls12_B1_12A1', name: 'Ls12_B1.docx_12A1', examTitle: 'Ls12_B1.docx', className: '12A1', durationMinutes: 45, status: 'Đang diễn ra' },
        ]);
      }
      setLoadingAssignments(false);
    }, (err) => {
      console.warn('Lỗi đọc examSessions:', err);
      setLoadingAssignments(false);
    });

    return () => unsubSessions();
  }, []);

  // 3. Lắng nghe bảng điểm cá nhân của học sinh từ collection examSubmissions
  useEffect(() => {
    const unsubSubmissions = onSnapshot(collection(db, 'examSubmissions'), (snap) => {
      const pureTarget = (cleanStudentName || studentId).toLowerCase().trim();
      const list: StudentSubmission[] = [];

      snap.docs.forEach((d) => {
        const data = d.data() as StudentSubmission;
        const item: StudentSubmission = { id: d.id, ...data };

        const matchId = studentId && (item.studentId === studentId || item.sbd === studentId);
        const matchName = pureTarget && item.studentName && item.studentName.toLowerCase().includes(pureTarget);

        if (matchId || matchName) {
          list.push(item);
        }
      });

      // Sắp xếp bài mới nhất lên đầu
      list.sort((a, b) => {
        const tA = a.submittedAtStr || '';
        const tB = b.submittedAtStr || '';
        return tB.localeCompare(tA);
      });

      setSubmissions(list);
      setLoadingSubmissions(false);
    }, (err) => {
      console.warn('Lỗi đọc bảng điểm học sinh:', err);
      setLoadingSubmissions(false);
    });

    return () => unsubSubmissions();
  }, [studentId, cleanStudentName]);

  // Hành động bắt đầu làm bài thi
  const handleStartExam = (sessionId: string) => {
    const url = `/exam-test/${sessionId}?studentId=${encodeURIComponent(studentId)}&studentName=${encodeURIComponent(cleanStudentName || studentName)}`;
    navigate(url);
  };

  // Đổi mật khẩu
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPass = localStorage.getItem(`student_pass_${studentId}`) || '123';
    if (currentPassword !== storedPass) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu hiện tại không chính xác.' });
      return;
    }
    if (!newPassword || newPassword.length < 3) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 3 ký tự.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }

    localStorage.setItem(`student_pass_${studentId}`, newPassword);
    setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' });
    setTimeout(() => {
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg(null);
    }, 1500);
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'notifications' | 'assignments' | 'scores'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Thống kê điểm số trung bình
  const totalCompleted = submissions.length;
  const avgScore = totalCompleted > 0
    ? (submissions.reduce((acc, cur) => acc + (cur.totalScore || 0), 0) / totalCompleted).toFixed(2)
    : '0.00';
  const highestScore = totalCompleted > 0
    ? Math.max(...submissions.map(s => s.totalScore || 0)).toFixed(2)
    : '0.00';

  const menuItems = [
    {
      id: 'overview',
      label: 'Tổng quan',
      sublabel: 'Xem tất cả',
      icon: Sparkles,
      color: 'teal'
    },
    {
      id: 'notifications',
      label: 'Thông báo',
      sublabel: 'Tin tức & quy chế',
      icon: Bell,
      badge: notifications.length > 0 ? `${notifications.length}` : undefined,
      color: 'indigo'
    },
    {
      id: 'assignments',
      label: 'Bài thi được giao online',
      sublabel: 'Làm bài thi trực tuyến',
      icon: FileText,
      badge: assignments.length > 0 ? `${assignments.length}` : undefined,
      color: 'emerald'
    },
    {
      id: 'scores',
      label: 'Bảng điểm',
      sublabel: 'Lịch sử & kết quả thi',
      icon: Award,
      badge: totalCompleted > 0 ? `${totalCompleted} bài` : undefined,
      color: 'amber'
    }
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* ========================================================= */}
      {/* MOBILE OVERLAY                                            */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* ========================================================= */}
      {/* THANH MENU BÊN TRÁI (LEFT SIDEBAR)                        */}
      {/* ========================================================= */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-72 bg-white border-r border-gray-200 z-50 flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 shadow-sm ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo Brand Cổng Học Sinh - Phối chuẩn giao diện giáo viên */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-base leading-tight">Luyện Thi Pro</h2>
                <p className="text-xs text-gray-400">Cổng học sinh</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Thẻ thông tin học sinh */}
          <div className="p-4 mx-3 my-3 bg-gray-50 border border-gray-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {cleanStudentName?.charAt(0)?.toUpperCase() || studentName?.charAt(0)?.toUpperCase() || 'H'}
              </div>
              <div className="overflow-hidden min-w-0">
                <div className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">Học sinh</div>
                <div className="text-xs font-bold text-gray-800 truncate" title={studentName}>
                  {cleanStudentName || studentName}
                </div>
                {studentId && (
                  <div className="text-[11px] text-gray-500 font-mono truncate">
                    Mã/SBD: {studentId}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Danh sách Menu bên trái */}
          <div className="px-3 py-2">
            <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Danh mục học tập
            </div>
            <nav className="space-y-1.5">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer text-left ${
                      isActive
                        ? 'bg-teal-50 text-teal-800 font-semibold shadow-xs'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-teal-600 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="leading-tight font-medium text-xs">{item.label}</div>
                        <div
                          className={`text-[10px] leading-tight mt-0.5 ${
                            isActive ? 'text-teal-700/80' : 'text-gray-400'
                          }`}
                        >
                          {item.sublabel}
                        </div>
                      </div>
                    </div>

                    {item.badge && (
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isActive
                            ? 'bg-teal-700 text-white'
                            : 'bg-gray-200/80 text-gray-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Stats Widget trong Menu */}
          <div className="p-3 mx-3 my-2 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Kết quả học tập
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-white rounded-xl border border-gray-100">
                <div className="text-[10px] text-gray-400 font-medium">Đã làm</div>
                <div className="text-xs font-bold text-gray-800">{totalCompleted} bài</div>
              </div>
              <div className="p-2 bg-white rounded-xl border border-gray-100">
                <div className="text-[10px] text-gray-400 font-medium">Điểm TB</div>
                <div className="text-xs font-bold text-teal-700">{avgScore}</div>
              </div>
            </div>
          </div>

          {/* Đẩy footer xuống đáy */}
          <div className="mt-auto p-4 border-t border-gray-100 bg-gray-50/50 space-y-1.5">
            <button
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordMsg(null);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200 transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-gray-500" />
              <span>Đổi mật khẩu</span>
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50 border border-teal-100 transition-all cursor-pointer"
              title="Chuyển sang màn hình quản lý dành cho giáo viên"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Giao diện Giáo viên</span>
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* VÙNG NỘI DUNG CHÍNH (RIGHT CONTENT AREA)                   */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gray-50/60">
        {/* Top bar trên cùng */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              title="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="text-[11px] font-semibold text-gray-400">
                Cổng Học Sinh / {menuItems.find(m => m.id === activeTab)?.label}
              </div>
              <h1 className="text-base md:text-lg font-bold text-gray-900">
                {activeTab === 'notifications' && 'Thông báo từ nhà trường'}
                {activeTab === 'assignments' && 'Bài thi được giao online'}
                {activeTab === 'scores' && 'Bảng điểm & Lịch sử làm bài'}
                {activeTab === 'overview' && 'Tổng quan học tập'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordMsg(null);
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-gray-600" />
              <span>Đổi mật khẩu</span>
            </button>

            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>

        {/* Nội dung theo từng mục menu */}
        <div className="p-4 md:p-8 space-y-6 max-w-6xl w-full mx-auto">
          {/* BANNER TỔNG QUAN HỌC TẬP (Chuẩn giao diện Giáo viên) */}
          <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-indigo-700 rounded-3xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-xs text-white">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tổng quan Cổng Học Sinh</span>
              </span>
              <h2 className="text-xl md:text-2xl font-black">
                Xin chào, {cleanStudentName || studentName}!
              </h2>
              <p className="text-xs md:text-sm text-teal-100 max-w-2xl leading-relaxed">
                Chào mừng bạn quay trở lại. Hãy theo dõi các thông báo mới từ nhà trường, làm bài thi được giao và tra cứu bảng điểm học tập ngay bên dưới.
              </p>

              <div className="pt-3 flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab('assignments')}
                  className="px-4 py-2.5 bg-white text-teal-800 hover:bg-teal-50 font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>Xem bài thi được giao ({assignments.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('scores')}
                  className="px-4 py-2.5 bg-teal-900/60 hover:bg-teal-900 text-white font-bold rounded-xl text-xs transition-all border border-teal-400/40 cursor-pointer flex items-center gap-2"
                >
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  <span>Xem bảng điểm cá nhân ({totalCompleted})</span>
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className="px-4 py-2.5 bg-teal-900/60 hover:bg-teal-900 text-white font-bold rounded-xl text-xs transition-all border border-teal-400/40 cursor-pointer flex items-center gap-2"
                >
                  <Bell className="w-3.5 h-3.5 text-teal-200" />
                  <span>Thông báo mới ({notifications.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* 1. MỤC: THÔNG BÁO */}
          {(activeTab === 'notifications' || activeTab === 'overview') && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Thông báo</h2>
                    <p className="text-xs text-gray-500">Tin tức, lịch thi & nhắc nhở từ nhà trường</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  {notifications.length} thông báo
                </span>
              </div>

              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="p-4 bg-gray-50/80 hover:bg-gray-50 rounded-2xl border border-gray-200 space-y-2 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                        <h3 className="font-bold text-xs md:text-sm text-gray-900">{n.title}</h3>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                        Thông báo chung
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed pl-4">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. MỤC: BÀI THI ĐƯỢC GIAO ONLINE */}
          {(activeTab === 'assignments' || activeTab === 'overview') && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Bài thi được giao online</h2>
                    <p className="text-xs text-gray-500">Bấm "LÀM BÀI NGAY" để tiến hành làm bài kiểm tra trực tuyến</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
                  {assignments.length} bài thi được giao
                </span>
              </div>

              <div className="space-y-3.5">
                {loadingAssignments ? (
                  <div className="py-12 text-center text-xs text-gray-400">Đang tải danh sách bài tập...</div>
                ) : assignments.length === 0 ? (
                  <div className="py-12 text-center space-y-2 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <FileText className="w-9 h-9 text-gray-300 mx-auto" />
                    <p className="text-xs font-bold text-gray-600">Hiện chưa có bài thi nào được giao cho bạn</p>
                    <p className="text-[11px] text-gray-400">Vui lòng quay lại kiểm tra khi giáo viên gửi bài tập mới.</p>
                  </div>
                ) : (
                  assignments.map((a, idx) => {
                    const submission = submissions.find(s => s.sessionId === a.id);
                    const isDone = !!submission;

                    return (
                      <div
                        key={`${a.id || 'assign'}_${idx}`}
                        className="p-4 md:p-5 bg-gray-50/80 hover:bg-gray-50 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-2xs"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-gray-900 truncate" title={a.name || a.examTitle}>
                              {a.name || a.examTitle || 'Đề kiểm tra trắc nghiệm'}
                            </h3>
                            {isDone && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Đã nộp bài</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
                            <span>Lớp áp dụng: <strong className="text-gray-700 font-semibold">{a.className || 'Toàn trường'}</strong></span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              Thời gian: <strong className="text-gray-700">{a.durationMinutes || 45} phút</strong>
                            </span>
                            {(a.startDateStr || a.startDate) && (
                              <span className="flex items-center gap-1 text-teal-700 font-medium">
                                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                                Ngày làm: {a.startDateStr || a.startDate}
                              </span>
                            )}
                            {(a.endDateStr || a.endDate) && (
                              <span className="flex items-center gap-1 text-rose-700 font-medium">
                                <Calendar className="w-3.5 h-3.5 text-rose-600" />
                                Kết thúc: {a.endDateStr || a.endDate}
                              </span>
                            )}
                            {isDone && (
                              <span className="font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md font-mono">
                                Điểm đạt: {submission.totalScore?.toFixed(2)} / 10
                              </span>
                            )}
                          </div>
                        </div>

                        {/* NÚT LÀM BÀI NGAY HOẶC TRẠNG THÁI */}
                        <div className="flex items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-200">
                          {isDone ? (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => setSelectedSubmission(submission)}
                                className="w-full sm:w-auto px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                title="Xem điểm số và đáp án chi tiết"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Xem điểm</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartExam(a.id)}
                              className="w-full sm:w-auto px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" />
                              <span>LÀM BÀI NGAY</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 3. MỤC: BẢNG ĐIỂM & LỊCH SỬ LÀM BÀI */}
          {(activeTab === 'scores' || activeTab === 'overview') && (
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Bảng điểm & Lịch sử làm bài thi</h2>
                    <p className="text-xs text-gray-500">Lưu trữ kết quả, điểm số từng phần và tình trạng giám sát trực tuyến</p>
                  </div>
                </div>

                {/* Thẻ chỉ số điểm số */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600">
                    <span>Đã làm: </span>
                    <strong className="text-gray-900">{totalCompleted} bài</strong>
                  </div>
                  <div className="px-3 py-1.5 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-800">
                    <span>Điểm TB: </span>
                    <strong className="text-teal-900 font-bold">{avgScore}</strong>
                  </div>
                  <div className="px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                    <span>Cao nhất: </span>
                    <strong className="text-emerald-900 font-bold">{highestScore}</strong>
                  </div>
                </div>
              </div>

              {/* Bảng điểm chi tiết */}
              {loadingSubmissions ? (
                <div className="py-12 text-center text-xs text-gray-400">Đang tải bảng điểm...</div>
              ) : submissions.length === 0 ? (
                <div className="py-12 text-center space-y-2 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <Award className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-bold text-gray-700">Chưa có kết quả làm bài nào</p>
                  <p className="text-xs text-gray-400 max-w-md mx-auto">
                    Khi hoàn thành các bài thi ở mục "Bài thi được giao online", điểm số chi tiết của bạn sẽ được tự động lưu trữ và hiển thị tại bảng này.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[11px] font-bold border-b border-gray-200">
                      <tr>
                        <th className="py-3.5 px-4 w-12 text-center">STT</th>
                        <th className="py-3.5 px-4">Tên bài thi</th>
                        <th className="py-3.5 px-4 w-32">Thời gian nộp</th>
                        <th className="py-3.5 px-4 w-28 text-center">Điểm tổng</th>
                        <th className="py-3.5 px-4">Chi tiết điểm (Phần I - II - III)</th>
                        <th className="py-3.5 px-4 w-36">Giám sát & Vi phạm</th>
                        <th className="py-3.5 px-4 w-28 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {submissions.map((sub, sIdx) => {
                        const score = sub.totalScore || 0;
                        const scoreColor =
                          score >= 8
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : score >= 5
                            ? 'text-teal-700 bg-teal-50 border-teal-200'
                            : 'text-amber-700 bg-amber-50 border-amber-200';

                        const hasViolations = (sub.violationCount && sub.violationCount > 0) || (sub.tabSwitchCount && sub.tabSwitchCount > 0);

                        return (
                          <tr key={`${sub.id || 'sub'}_${sIdx}`} className="hover:bg-gray-50/80 transition-colors">
                            <td className="py-3.5 px-4 text-center font-mono text-gray-400 font-bold">
                              {sIdx + 1}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-gray-900">
                              {sub.examTitle || 'Bài kiểm tra'}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-gray-600 text-[11px]">
                              {sub.submittedAtStr || 'Vừa xong'}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-xl font-bold font-mono text-sm border ${scoreColor}`}>
                                {score.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-[11px] text-gray-600">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">
                                  PI: <b>{sub.p1 || '0'}</b>
                                </span>
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">
                                  PII: <b>{sub.p2 || '0'}</b>
                                </span>
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">
                                  PIII: <b>{sub.p3 || '0'}</b>
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {hasViolations ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>{sub.tabSwitchCount ? `${sub.tabSwitchCount} lần chuyển tab` : `${sub.violationCount} vi phạm`}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Chuẩn quy chế</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedSubmission(sub)}
                                className="px-2.5 py-1 text-xs font-bold text-teal-700 hover:text-teal-800 hover:bg-teal-50 border border-teal-200 rounded-lg transition-colors cursor-pointer"
                              >
                                Xem điểm
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL: XEM CHI TIẾT KẾT QUẢ BÀI THI                       */}
      {/* ========================================================= */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Chi tiết kết quả bài thi</h3>
                  <p className="text-[11px] text-gray-500">{selectedSubmission.examTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thẻ điểm tổng */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Học sinh: <strong className="text-gray-800">{selectedSubmission.studentName}</strong></div>
                <div className="text-[11px] text-gray-500 mt-0.5">Thời gian nộp: {selectedSubmission.submittedAtStr}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 font-medium">Điểm tổng kết</div>
                <div className="text-2xl font-black text-teal-700 font-mono">
                  {selectedSubmission.totalScore?.toFixed(2)} <span className="text-xs font-normal text-gray-400">/ 10</span>
                </div>
              </div>
            </div>

            {/* Chi tiết từng phần */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-800">Điểm số chi tiết theo từng phần:</h4>
              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="text-[11px] text-gray-500">Phần I (Trắc nghiệm)</div>
                  <div className="font-bold text-gray-900 mt-1 font-mono">{selectedSubmission.p1 || '0'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="text-[11px] text-gray-500">Phần II (Đúng/Sai)</div>
                  <div className="font-bold text-gray-900 mt-1 font-mono">{selectedSubmission.p2 || '0'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="text-[11px] text-gray-500">Phần III (Trả lời ngắn)</div>
                  <div className="font-bold text-gray-900 mt-1 font-mono">{selectedSubmission.p3 || '0'}</div>
                </div>
              </div>
            </div>

            {/* Giám sát vi phạm */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Trạng thái nộp bài:</span>
                <span className="font-bold text-gray-800">{selectedSubmission.status || 'Đúng giờ'}</span>
              </div>
              {selectedSubmission.violationLogs && selectedSubmission.violationLogs.length > 0 && (
                <div className="pt-2 border-t border-gray-200 text-[11px] text-rose-700 space-y-1">
                  <span className="font-bold">Các vi phạm được hệ thống ghi nhận:</span>
                  <div className="max-h-28 overflow-y-auto space-y-1 mt-1">
                    {selectedSubmission.violationLogs.map((log, lIdx) => (
                      <div key={lIdx} className="bg-white p-1.5 rounded border border-rose-200 flex justify-between">
                        <span>{log.type}: {log.details}</span>
                        <span className="font-mono text-gray-500">{log.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ĐỔI MẬT KHẨU                                       */}
      {/* ========================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-teal-600" />
                <span>Đổi mật khẩu</span>
              </h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordMsg && (
              <div className={`p-3 rounded-xl text-xs font-medium ${
                passwordMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {passwordMsg.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mật khẩu hiện tại (mặc định 123)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold cursor-pointer"
                >
                  Lưu mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
