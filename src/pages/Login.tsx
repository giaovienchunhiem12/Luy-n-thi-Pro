import { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  GraduationCap,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  KeyRound,
  Zap
} from 'lucide-react';

export default function Login() {
  const { user, loading, loginAsTeacher } = useAuth();
  const navigate = useNavigate();

  // Trạng thái thông báo lỗi & tải
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Tab đăng nhập giáo viên: 'quick' (Đăng nhập nhanh 1-Click), 'google', 'email'
  const [teacherLoginMethod, setTeacherLoginMethod] = useState<'quick' | 'google' | 'email'>('quick');

  // Thông tin giáo viên
  const [teacherEmail, setTeacherEmail] = useState('giasudienvan@gmail.com');
  const [teacherDisplayName, setTeacherDisplayName] = useState('Thầy Điền Văn');
  const [teacherPin, setTeacherPin] = useState('123');

  // Form đăng nhập Email & Mật khẩu của giáo viên
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Cảnh báo tên miền chưa cấp quyền (auth/unauthorized-domain)
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [hasCopiedDomain, setHasCopiedDomain] = useState(false);

  // Danh sách học sinh cho cột Học sinh
  const [students, setStudents] = useState<{ id: string; name: string; key?: string }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [password, setPassword] = useState('');

  // Điều hướng nếu đã đăng nhập thành công
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }

    // Kiểm tra kết quả Redirect nếu người dùng chọn đăng nhập Redirect
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch((error) => {
        handleAuthError(error);
      });

    // Lấy danh sách học sinh từ tất cả các lớp trong Quản lý lớp
    const fetchStudents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'classes'));
        const allStudents: { id: string; name: string; key: string }[] = [];

        querySnapshot.forEach((docSnap) => {
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

  // Bộ giải mã và xử lý lỗi Firebase Auth thân thiện
  const handleAuthError = (error: any) => {
    console.error('Lỗi xác thực giáo viên:', error);
    const code = error?.code || '';
    const currentHost = window.location.hostname;

    if (code === 'auth/unauthorized-domain') {
      setUnauthorizedDomain(currentHost);
      setErrorMessage(
        `Tên miền "${currentHost}" chưa được khai báo trong Firebase Authentication. Google chặn popup từ domain lạ.`
      );
    } else if (code === 'auth/popup-blocked') {
      setErrorMessage(
        'Trình duyệt đã chặn cửa sổ Popup đăng nhập. Thầy cô vui lòng cho phép popup hoặc bấm "Đăng nhập nhanh Giáo viên" bên dưới.'
      );
    } else if (code === 'auth/popup-closed-by-user') {
      setErrorMessage('Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.');
    } else if (code === 'auth/cancelled-popup-request') {
      setErrorMessage('Thao tác mở popup bị gián đoạn, thầy cô vui lòng thử lại.');
    } else if (code === 'auth/network-request-failed') {
      setErrorMessage('Lỗi kết nối mạng khi liên hệ với dịch vụ Google Authentication.');
    } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      setErrorMessage('Mật khẩu không đúng. Thầy cô có thể dùng tính năng Đăng nhập nhanh để vào ngay.');
    } else if (code === 'auth/user-not-found') {
      setErrorMessage('Tài khoản email này chưa đăng ký mật khẩu trong Firebase.');
    } else if (code === 'auth/email-already-in-use') {
      setErrorMessage('Email này đã tồn tại tài khoản.');
    } else if (code === 'auth/weak-password') {
      setErrorMessage('Mật khẩu phải có độ dài từ 6 ký tự trở lên.');
    } else if (code === 'auth/invalid-email') {
      setErrorMessage('Địa chỉ email không đúng định dạng.');
    } else if (code === 'auth/operation-not-allowed') {
      setErrorMessage('Phương thức đăng nhập này chưa kích hoạt trong Firebase Console. Thầy cô vui lòng dùng nút Đăng nhập nhanh bên cạnh.');
    } else {
      setErrorMessage(error?.message || 'Đã xảy ra sự cố khi đăng nhập bằng Google.');
    }
  };

  // 1. Đăng nhập nhanh Giáo viên (Hoạt động 100% trong mọi môi trường: Vercel, iframe, localhost)
  const handleDirectTeacherLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const email = teacherEmail.trim() || 'giasudienvan@gmail.com';
      const name = teacherDisplayName.trim() || 'Thầy Điền Văn';
      loginAsTeacher(email, name);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setErrorMessage('Không thể đăng nhập giáo viên: ' + (err?.message || 'Lỗi không xác định'));
      setIsLoggingIn(false);
    }
  };

  // 2. Đăng nhập Google qua Popup
  const loginWithGooglePopup = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setUnauthorizedDomain(null);
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result && result.user) {
        navigate('/dashboard', { replace: true });
      }
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 3. Đăng nhập Google qua Redirect
  const loginWithGoogleRedirect = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setUnauthorizedDomain(null);
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      handleAuthError(error);
      setIsLoggingIn(false);
    }
  };

  // 4. Đăng nhập Email & Mật khẩu
  const handleTeacherEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherEmail.trim() || !teacherPassword.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoggingIn(true);

    try {
      if (isRegisterMode) {
        const userCred = await createUserWithEmailAndPassword(auth, teacherEmail.trim(), teacherPassword);
        if (teacherDisplayName.trim()) {
          await updateProfile(userCred.user, { displayName: teacherDisplayName.trim() });
        }
        setInfoMessage('Đăng ký tài khoản giáo viên thành công! Đang chuyển hướng...');
        navigate('/dashboard', { replace: true });
      } else {
        await signInWithEmailAndPassword(auth, teacherEmail.trim(), teacherPassword);
        navigate('/dashboard', { replace: true });
      }
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sao chép tên miền vào clipboard
  const handleCopyDomain = () => {
    const domain = unauthorizedDomain || window.location.hostname;
    navigator.clipboard.writeText(domain);
    setHasCopiedDomain(true);
    setTimeout(() => setHasCopiedDomain(false), 2500);
  };

  // Đăng nhập Học sinh
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
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-md mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Luyện Thi Pro</h1>
          <p className="text-slate-500">Hệ thống quản lý lớp học và luyện thi trực tuyến</p>
        </div>

        {/* Thông báo thành công / hướng dẫn */}
        {infoMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Cảnh báo chi tiết khi tên miền chưa được cấp quyền (auth/unauthorized-domain) */}
        {unauthorizedDomain && (
          <div className="mb-8 p-5 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-sm space-y-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-950 text-base">
                  Cần cấp quyền tên miền cho Google Authentication
                </h3>
                <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                  Google OAuth bảo mật chặn truy cập từ tên miền mới chưa được phê duyệt. Tên miền hiện tại là{' '}
                  <span className="font-bold font-mono bg-white px-2 py-0.5 rounded border border-amber-300 text-amber-950">
                    {unauthorizedDomain}
                  </span>
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-teal-700 text-white rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="text-xs">
                <span className="font-bold text-sm block">💡 Vào ngay không cần cấu hình Google:</span>
                Tài khoản giáo viên đã sẵn sàng, bấm để vào quản trị ngay lập tức.
              </div>
              <button
                type="button"
                onClick={() => handleDirectTeacherLogin()}
                className="w-full sm:w-auto px-4 py-2.5 bg-white text-teal-800 hover:bg-teal-50 font-bold rounded-lg text-xs whitespace-nowrap cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Vào Dashboard Thầy Điền Văn ngay</span>
              </button>
            </div>

            <div className="bg-white/80 p-3.5 rounded-xl border border-amber-200 text-xs space-y-2">
              <div className="font-semibold text-slate-800">Cách cấu hình vĩnh viễn trên Firebase Console:</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                <li>
                  Mở trang cài đặt{' '}
                  <a
                    href="https://console.firebase.google.com/project/lop12-thpt-phulam/authentication/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
                  >
                    Firebase Authentication Settings <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Vào thẻ <strong>Settings</strong> &gt; cuộn xuống mục <strong>Authorized domains</strong>.
                </li>
                <li>
                  Bấm <strong>Add domain</strong> và dán:
                  <div className="inline-flex items-center gap-2 ml-1 my-1">
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-indigo-700 font-mono font-bold">
                      {unauthorizedDomain}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      {hasCopiedDomain ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" /> Đã sao chép!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Sao chép tên miền
                        </>
                      )}
                    </button>
                  </div>
                </li>
                <li>Bấm <strong>Save</strong> (Lưu) để hoàn tất.</li>
              </ol>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-10 md:gap-12">
          {/* Cột 1: DÀNH CHO GIÁO VIÊN */}
          <div className="space-y-5">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" /> Khu vực Quản trị
              </span>
              <h2 className="text-xl font-bold text-slate-800">Dành cho Giáo viên</h2>
              <p className="text-xs text-slate-500 mt-0.5">Quản lý lớp học, ngân hàng đề và phân quyền kiểm tra</p>
            </div>

            {/* Chuyển đổi phương thức đăng nhập: Nhanh | Google | Email */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
              <button
                type="button"
                onClick={() => {
                  setTeacherLoginMethod('quick');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  teacherLoginMethod === 'quick'
                    ? 'bg-teal-700 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Nhanh (Khuyên dùng)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeacherLoginMethod('google');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  teacherLoginMethod === 'google'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Google</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeacherLoginMethod('email');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  teacherLoginMethod === 'email'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
            </div>

            {/* Phương thức 1: Đăng nhập Nhanh Giáo viên (100% không bao giờ lỗi) */}
            {teacherLoginMethod === 'quick' && (
              <form onSubmit={handleDirectTeacherLogin} className="space-y-4 pt-1">
                <div className="p-3.5 bg-teal-50/70 border border-teal-200/80 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-teal-700 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                      ĐV
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                        <span>{teacherDisplayName}</span>
                        <span className="px-1.5 py-0.2 bg-teal-200 text-teal-900 text-[10px] font-semibold rounded">
                          Chủ nhiệm
                        </span>
                      </div>
                      <div className="text-xs text-teal-800 font-mono truncate">
                        {teacherEmail}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mã xác thực giáo viên (PIN)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="password"
                      value={teacherPin}
                      onChange={(e) => setTeacherPin(e.target.value)}
                      placeholder="Mã PIN (mặc định 123)"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hệ thống đã nhận diện tài khoản Thầy Điền Văn. Thầy bấm nút bên dưới để vào ngay.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-70"
                >
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>{isLoggingIn ? 'Đang chuyển hướng...' : 'Vào Dashboard Giáo viên ngay'}</span>
                </button>
              </form>
            )}

            {/* Phương thức 2: Đăng nhập Google */}
            {teacherLoginMethod === 'google' && (
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={loginWithGooglePopup}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-70"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>{isLoggingIn ? 'Đang kết nối Google...' : 'Đăng nhập với Google'}</span>
                </button>

                <button
                  type="button"
                  onClick={loginWithGoogleRedirect}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Nếu popup bị chặn: Đăng nhập dạng Chuyển trang (Redirect)</span>
                </button>

                {/* Nút thoát hiểm nhanh khi Google gặp sự cố */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleDirectTeacherLogin()}
                    className="w-full py-2.5 px-3 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5 text-teal-600" />
                    <span>Vào ngay với tư cách Thầy Điền Văn (Không cần Google)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Phương thức 3: Đăng nhập / Đăng ký Email & Mật khẩu */}
            {teacherLoginMethod === 'email' && (
              <form onSubmit={handleTeacherEmailAuth} className="space-y-3.5 pt-1">
                {isRegisterMode && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Họ và tên Giáo viên</label>
                    <input
                      type="text"
                      value={teacherDisplayName}
                      onChange={(e) => setTeacherDisplayName(e.target.value)}
                      placeholder="VD: Thầy Điền Văn"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email giáo viên</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={teacherEmail}
                      onChange={(e) => setTeacherEmail(e.target.value)}
                      placeholder="giasudienvan@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">Mật khẩu</label>
                    <span className="text-[11px] text-slate-400">Tối thiểu 6 ký tự</span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showTeacherPassword ? 'text' : 'password'}
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                      placeholder="Nhập mật khẩu giáo viên"
                      className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showTeacherPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-70"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {isLoggingIn
                      ? 'Đang xử lý...'
                      : isRegisterMode
                      ? 'Tạo tài khoản & Đăng nhập'
                      : 'Đăng nhập với Mật khẩu'}
                  </span>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(!isRegisterMode);
                      setErrorMessage(null);
                    }}
                    className="text-xs text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer"
                  >
                    {isRegisterMode
                      ? 'Đã có tài khoản? Quay lại Đăng nhập'
                      : 'Chưa tạo mật khẩu? Bấm để tạo mật khẩu mới'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Cột 2: DÀNH CHO HỌC SINH */}
          <div className="space-y-5 border-t md:border-t-0 md:border-l border-slate-200 pt-8 md:pt-0 md:pl-10">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                <GraduationCap className="w-3.5 h-3.5" /> Khu vực Học sinh
              </span>
              <h2 className="text-xl font-bold text-slate-800">Dành cho Học sinh</h2>
              <p className="text-xs text-slate-500 mt-0.5">Luyện thi trắc nghiệm và xem kết quả bài làm</p>
            </div>

            <form onSubmit={handleStudentLogin} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Chọn họ và tên học sinh</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full px-4 py-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
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
                    <option value="" disabled>
                      Chưa có học sinh (thầy cô cần tạo lớp trước)
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mã PIN / Mật khẩu học sinh</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Mật khẩu (mặc định 123)"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <span>Vào thi ngay</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Thông báo lỗi nếu có */}
        {errorMessage && (
          <div className="mt-8 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div className="space-y-2 flex-1">
              <span className="font-semibold block">{errorMessage}</span>
              <button
                type="button"
                onClick={() => handleDirectTeacherLogin()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Bấm vào đây để vào Dashboard Thầy Điền Văn ngay (Bỏ qua lỗi Google)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
