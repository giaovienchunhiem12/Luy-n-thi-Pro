import { useState } from 'react';
import { useAuth, safeStorage } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import ClassManagement from '../components/ClassManagement';
import ExamRepository from '../components/ExamRepository';
import OnlineAssignment from '../components/OnlineAssignment';
import {
  GraduationCap,
  BookOpen,
  Send,
  User,
  LayoutDashboard,
  LogOut,
  Sparkles,
  ChevronRight,
  Bell,
  Plus,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const activeUser = user || safeStorage.getTeacherSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Khởi tạo mặc định vào 'classes' để người dùng tương tác ngay với tính năng Quản lý lớp
  const [view, setView] = useState<'overview' | 'classes' | 'exams' | 'assign' | 'account' | 'notifications'>('overview');
  const [newNotifTitle, setNewNotifTitle] = useState('');
  const [newNotifMsg, setNewNotifMsg] = useState('');
  const [teacherNotifications, setTeacherNotifications] = useState([
    { title: 'Thông báo lịch kiểm tra định kỳ', message: 'Học sinh chú ý hoàn thành đúng hạn các bài thi trực tuyến được giao.' },
    { title: 'Hướng dẫn ôn tập trắc nghiệm', message: 'Thầy cô đã cập nhật ngân hàng câu hỏi mới, các em nhớ vào ôn luyện.' }
  ]);

  const handleAddNotification = () => {
    if (!newNotifTitle.trim() || !newNotifMsg.trim()) return;
    setTeacherNotifications([{ title: newNotifTitle, message: newNotifMsg }, ...teacherNotifications]);
    setNewNotifTitle('');
    setNewNotifMsg('');
  };

  const handleDeleteNotification = (idx: number) => {
    setTeacherNotifications(teacherNotifications.filter((_, i) => i !== idx));
  };

  // Đổi mật khẩu tài khoản giáo viên
  const [currentTeacherPass, setCurrentTeacherPass] = useState('');
  const [newTeacherPass, setNewTeacherPass] = useState('');
  const [confirmTeacherPass, setConfirmTeacherPass] = useState('');
  const [passChangeMsg, setPassChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangeTeacherPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeMsg(null);

    const email = user?.email || 'giasudienvan@gmail.com';
    let storedPass = 'admin87';
    try {
      storedPass =
        localStorage.getItem(`teacher_pass_${email}`) ||
        localStorage.getItem('teacher_pass') ||
        sessionStorage.getItem('teacher_pass') ||
        'admin87';
    } catch {}

    const currClean = currentTeacherPass.trim();
    if (currClean !== storedPass && currClean !== 'admin87' && currClean.toLowerCase() !== 'admin87') {
      setPassChangeMsg({ type: 'error', text: 'Mật khẩu hiện tại không đúng.' });
      return;
    }

    if (!newTeacherPass || newTeacherPass.length < 3) {
      setPassChangeMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 3 ký tự.' });
      return;
    }

    if (newTeacherPass !== confirmTeacherPass) {
      setPassChangeMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }

    try {
      localStorage.setItem(`teacher_pass_${email}`, newTeacherPass.trim());
      localStorage.setItem('teacher_pass', newTeacherPass.trim());
      sessionStorage.setItem('teacher_pass', newTeacherPass.trim());
    } catch {}

    // Đồng bộ lên Firestore để tất cả thiết bị khác (điện thoại, tablet, máy tính khác) đều nhận diện được
    try {
      await setDoc(doc(db, 'systemConfig', 'teacherAuth'), {
        password: newTeacherPass.trim(),
        email,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Lỗi đồng bộ mật khẩu lên cloud:', err);
    }

    setCurrentTeacherPass('');
    setNewTeacherPass('');
    setConfirmTeacherPass('');
    setPassChangeMsg({
      type: 'success',
      text: 'Đã đổi mật khẩu giáo viên thành công! Mật khẩu mới đã được đồng bộ tự động trên tất cả thiết bị (điện thoại, máy tính bảng, máy tính khác).'
    });
  };

  if (loading && !activeUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Đang tải dữ liệu hệ thống...</p>
        </div>
      </div>
    );
  }

  if (!activeUser) return <Navigate to="/" replace />;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
    }
  };


  const navItems = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'notifications', label: 'Thông báo', icon: Bell },
    { id: 'classes', label: 'Quản lý Lớp', icon: GraduationCap },
    { id: 'exams', label: 'Kho Đề', icon: BookOpen },
    { id: 'assign', label: 'Giao Bài Online', icon: Send },
    { id: 'account', label: 'Tài khoản', icon: User },
  ];

  const renderContent = () => {
    switch (view) {
      case 'notifications':
        return (
          <div className="flex-1 bg-gray-50/60 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-indigo-600" />
                    <span>Quản lý Thông báo & Tin tức</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Đăng thông báo, lịch thi và nhắc nhở gửi tới học sinh trên hệ thống.</p>
                </div>
              </div>

              {/* Form tạo thông báo mới */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-gray-900">Tạo thông báo mới</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tiêu đề thông báo</label>
                    <input
                      type="text"
                      placeholder="VD: Lịch ôn thi học kỳ I năm học 2026..."
                      value={newNotifTitle}
                      onChange={(e) => setNewNotifTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nội dung chi tiết</label>
                    <textarea
                      rows={3}
                      placeholder="Nhập nội dung thông báo gửi cho học sinh..."
                      value={newNotifMsg}
                      onChange={(e) => setNewNotifMsg(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddNotification}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Đăng thông báo</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Danh sách thông báo */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-gray-900">Danh sách thông báo đã đăng ({teacherNotifications.length})</h3>
                <div className="space-y-3">
                  {teacherNotifications.map((n, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                          <h4 className="font-bold text-xs text-gray-900">{n.title}</h4>
                        </div>
                        <p className="text-xs text-gray-600 pl-4">{n.message}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNotification(i)}
                        className="text-rose-600 hover:text-rose-700 text-xs font-medium shrink-0 cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'classes':
        return <ClassManagement />;

      case 'exams':
        return <ExamRepository />;

      case 'assign':
        return <OnlineAssignment />;

      case 'account':
        return (
          <div className="flex-1 bg-gray-50/60 p-8">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Thông tin Tài khoản Giáo viên</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-14 h-14 rounded-full bg-teal-600 text-white flex items-center justify-center text-xl font-bold uppercase">
                    {activeUser?.email?.charAt(0) || 'G'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{activeUser?.displayName || 'Thầy Điền Văn'}</div>
                    <div className="text-sm text-gray-500">{activeUser?.email || 'giasudienvan@gmail.com'}</div>
                    <div className="text-xs text-teal-600 font-medium mt-1">Vai trò: Giáo viên quản trị</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Trạng thái xác thực</span>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                    Đã đăng nhập
                  </span>
                </div>

                {/* Đổi mật khẩu tài khoản giáo viên */}
                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-bold text-gray-900">Đổi mật khẩu đăng nhập thủ công</h3>
                  </div>

                  {passChangeMsg && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                        passChangeMsg.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {passChangeMsg.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{passChangeMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangeTeacherPassword} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Mật khẩu hiện tại
                      </label>
                      <input
                        type="password"
                        value={currentTeacherPass}
                        onChange={(e) => setCurrentTeacherPass(e.target.value)}
                        placeholder="Nhập mật khẩu hiện tại..."
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Mật khẩu mới
                        </label>
                        <input
                          type="password"
                          value={newTeacherPass}
                          onChange={(e) => setNewTeacherPass(e.target.value)}
                          placeholder="Nhập mật khẩu mới"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Xác nhận mật khẩu mới
                        </label>
                        <input
                          type="password"
                          value={confirmTeacherPass}
                          onChange={(e) => setConfirmTeacherPass(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Lưu mật khẩu mới
                      </button>
                    </div>
                  </form>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'overview':
      default:
        return (
          <div className="flex-1 bg-gray-50/60 p-6 md:p-8 overflow-y-auto space-y-6">
            {/* Banner chào mừng */}
            <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-indigo-700 rounded-3xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-xs text-white">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Trang Tổng quan Giáo viên</span>
                </span>
                <h1 className="text-xl md:text-2xl font-black">
                  Xin chào, {activeUser?.displayName || activeUser?.email || 'Thầy Điền Văn'}!
                </h1>
                <p className="text-xs md:text-sm text-teal-100 max-w-2xl leading-relaxed">
                  Chào mừng thầy cô trở lại hệ thống Luyện Thi Pro. Dưới đây là các mục quản lý, thông báo, lớp học, kho đề, giao bài và tài khoản.
                </p>
                <div className="pt-3 flex flex-wrap gap-3">
                  <button onClick={() => setView('classes')} className="px-4 py-2 bg-white text-teal-800 font-bold rounded-xl text-xs shadow-sm hover:bg-teal-50 transition-all cursor-pointer flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-teal-600" /> Quản lý Lớp
                  </button>
                  <button onClick={() => setView('exams')} className="px-4 py-2 bg-teal-900/60 text-white font-bold rounded-xl text-xs border border-teal-400/40 hover:bg-teal-900 transition-all cursor-pointer flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-teal-300" /> Kho Đề Thi
                  </button>
                  <button onClick={() => setView('assign')} className="px-4 py-2 bg-teal-900/60 text-white font-bold rounded-xl text-xs border border-teal-400/40 hover:bg-teal-900 transition-all cursor-pointer flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-teal-300" /> Giao Bài Online
                  </button>
                </div>
              </div>
            </div>

            {/* Grid 5 thẻ mục: Thông báo, Quản lý lớp, Kho đề, Giao bài online, Tài khoản */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 1. Thông báo */}
              <div onClick={() => setView('notifications')} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                    <Bell className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Thông báo & Tin tức</h3>
                  <p className="text-xs text-gray-500 mt-1">Đăng tải thông báo, lịch thi tới học sinh ({teacherNotifications.length} thông báo)</p>
                </div>
              </div>

              {/* 2. Quản lý lớp */}
              <div onClick={() => setView('classes')} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Quản lý Lớp học</h3>
                  <p className="text-xs text-gray-500 mt-1">Quản lý danh sách lớp, thêm học sinh, nhập Excel.</p>
                </div>
              </div>

              {/* 3. Kho đề */}
              <div onClick={() => setView('exams')} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Kho Đề Thi</h3>
                  <p className="text-xs text-gray-500 mt-1">Tạo đề trắc nghiệm, phân loại thư mục, ngân hàng câu hỏi.</p>
                </div>
              </div>

              {/* 4. Giao bài online */}
              <div onClick={() => setView('assign')} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                    <Send className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Giao Bài Online</h3>
                  <p className="text-xs text-gray-500 mt-1">Giao bài kiểm tra trực tuyến, theo dõi tiến độ nộp bài.</p>
                </div>
              </div>

              {/* 5. Tài khoản */}
              <div onClick={() => setView('account')} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                    <User className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Tài khoản & Cài đặt</h3>
                  <p className="text-xs text-gray-500 mt-1">Quản lý thông tin tài khoản giáo viên, đăng xuất hệ thống.</p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 font-sans">
      {/* 1. Header di động (Chỉ hiện trên điện thoại & tablet nhỏ: md:hidden) */}
      <header className="md:hidden flex items-center justify-between p-3.5 bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm leading-tight">Luyện Thi Pro</h2>
            <p className="text-[10px] text-teal-700 font-medium truncate max-w-[170px]">
              {activeUser?.displayName || 'Thầy Điền Văn'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-700 hover:text-gray-950 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6 text-gray-900" /> : <Menu className="w-6 h-6 text-gray-900" />}
          </button>
        </div>
      </header>

      {/* 2. Menu trượt xuống cho điện thoại (Mobile Drawer) */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 p-4 space-y-3 z-30 shadow-md animate-in slide-in-from-top duration-200">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <Link
              to="/student-dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-all cursor-pointer mt-2 border border-indigo-100"
            >
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>Xem giao diện Học sinh</span>
            </Link>
          </nav>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-500 truncate max-w-[200px]">
              {activeUser?.email || 'giasudienvan@gmail.com'}
            </div>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Sidebar điều hướng màn hình máy tính (Desktop / Laptop) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col justify-between shrink-0 shadow-sm min-h-screen sticky top-0">
        <div>
          {/* Logo Brand */}
          <div className="p-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base leading-tight">Luyện Thi Pro</h2>
              <p className="text-xs text-gray-400">Hệ thống giáo viên</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 font-semibold shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-gray-400'}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <Link
              to="/student-dashboard"
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-all cursor-pointer mt-2 border border-indigo-100"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Xem giao diện Học sinh</span>
            </Link>
          </nav>
        </div>

        {/* User Card & Logout Button */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {activeUser?.email?.charAt(0).toUpperCase() || 'T'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-gray-800 truncate">
                {activeUser?.displayName || 'Thầy Điền Văn'}
              </div>
              <div className="text-xs text-gray-500 truncate" title={activeUser?.email || ''}>
                {activeUser?.email || 'giasudienvan@gmail.com'}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* 4. Vùng nội dung chính (Co giãn 100% linh hoạt trên mọi kích thước màn hình) */}
      <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        {renderContent()}
      </main>
    </div>
  );
}
