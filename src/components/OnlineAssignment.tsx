import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import {
  Search,
  Share2,
  Trash2,
  Ban,
  Eye,
  Plus,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Users,
  Calendar,
  Clock,
  Sparkles,
  Award,
  ShieldAlert,
  Lock,
  CameraOff
} from 'lucide-react';
import ExamResultsView from './ExamResultsView';
import AssignExamConfigModal from './AssignExamConfigModal';

export interface ExamSession {
  id: string;
  name: string; // e.g. "GD12_Bài 2.docx_12A1"
  examTitle: string; // e.g. "GD12_Bài 2.docx"
  examId?: string;
  className: string; // e.g. "12A1" or "N/A"
  classId?: string;
  startDateStr: string; // e.g. "14:50:00 13/4/2026"
  endDateStr: string; // e.g. "14:50:00 10/6/2026"
  status: string; // "Không xác định", "Đang diễn ra", "Đã kết thúc", "Đã huỷ"
  teacherId: string;
  durationMinutes?: number;
  attemptsAllowed?: number;
  enableAntiCheat?: boolean;
  autoSubmitOnSecondTab?: boolean;
  maxTabSwitches?: number;
  preventScreenshot?: boolean;
  preventCopyPaste?: boolean;
  recordViolations?: boolean;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showScoreAfterSubmit?: boolean;
  showSolutionAfterSubmit?: boolean;
  requireStudentVerification?: boolean;
  linkUrl?: string;
  createdAt?: any;
}

export default function OnlineAssignment() {
  const { user: authUser } = useAuth();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchExamName, setSearchExamName] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ExamSession | null>(null);
  const [sessionToCancel, setSessionToCancel] = useState<ExamSession | null>(null);
  const [selectedSessionForResults, setSelectedSessionForResults] = useState<ExamSession | null>(null);
  const [newlyCreatedSession, setNewlyCreatedSession] = useState<{ id: string; name: string; link: string } | null>(null);

  // Form tạo phiên mới
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [examsList, setExamsList] = useState<{ id: string; title: string }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [customSessionName, setCustomSessionName] = useState('');
  const [startDate, setStartDate] = useState('2026-04-13T14:50');
  const [endDate, setEndDate] = useState('2026-06-10T14:50');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification Toast
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Lấy danh sách lớp và đề thi của giáo viên để phục vụ tạo phiên
  useEffect(() => {
    const user = auth.currentUser || authUser;
    if (!user) return;

    const qClasses = query(collection(db, 'classes'));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      setClassesList(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    });

    const qExams = query(collection(db, 'exams'));
    const unsubExams = onSnapshot(qExams, (snap) => {
      setExamsList(snap.docs.map((d) => ({ id: d.id, title: d.data().title })));
    });

    return () => {
      unsubClasses();
      unsubExams();
    };
  }, [authUser]);

  // Lắng nghe dữ liệu các phiên giao đề từ Firestore
  useEffect(() => {
    const user = auth.currentUser || authUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'examSessions'));

    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
          // Dữ liệu trống khi chưa tạo bài thi
          const list: ExamSession[] = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
          } as ExamSession));
          setSessions(list);
          setLoading(false);
      },
      (error) => {
        console.error('Lỗi tải danh sách phiên giao đề:', error);
        setLoading(false);
      }
    );


    return () => unsubscribe();
  }, []);

  // Tự động tạo dữ liệu mẫu giống hệt trong ảnh
  const seedInitialSessions = async (uid: string) => {
    const sampleData = [
      {
        name: 'GD12_Bài 2.docx_12A1',
        examTitle: 'GD12_Bài 2.docx',
        className: '12A1',
        startDateStr: '14:50:00 13/4/2026',
        endDateStr: '14:50:00 10/6/2026',
        status: 'Không xác định'
      },
      {
        name: 'GD12_Bài 1.TĂNG TRƯỞNG VÀ PHÁT TRIỂN KINH TẾ.docx_12A1',
        examTitle: 'GD12_Bài 1.TĂNG TRƯỞNG VÀ PHÁT TRIỂN KINH TẾ.docx',
        className: '12A1',
        startDateStr: '14:29:00 13/4/2026',
        endDateStr: '14:29:00 10/6/2026',
        status: 'Không xác định'
      },
      {
        name: 'Ls12_B6.docx_12A1',
        examTitle: 'Ls12_B6.docx',
        className: '12A1',
        startDateStr: '14:07:00 13/4/2026',
        endDateStr: '14:07:00 10/6/2026',
        status: 'Không xác định'
      },
      {
        name: 'Ls12_B5.docx_12A1',
        examTitle: 'Ls12_B5.docx',
        className: '12A1',
        startDateStr: '14:04:00 13/4/2026',
        endDateStr: '14:04:00 10/6/2026',
        status: 'Không xác định'
      },
      {
        name: 'Ls12_B4.docx_12A1',
        examTitle: 'Ls12_B4.docx',
        className: '12A1',
        startDateStr: '14:00:00 13/4/2026',
        endDateStr: '14:00:00 10/6/2026',
        status: 'Không xác định'
      },
      {
        name: 'Ls12_B3.docx_12A1',
        examTitle: 'Ls12_B3.docx',
        className: '12A1',
        startDateStr: '13:54:00 13/4/2026',
        endDateStr: '13:54:00 10/6/2026',
        status: 'Không xác định'
      },
      {
        name: 'Ls12_B1.docx',
        examTitle: 'Ls12_B1.docx',
        className: 'N/A',
        startDateStr: '10:26:00 13/4/2026',
        endDateStr: '10:26:00 10/6/2026',
        status: 'Không xác định'
      },
      {
        name: 'Ls12_B2.docx',
        examTitle: 'Ls12_B2.docx',
        className: 'N/A',
        startDateStr: '10:24:00 13/4/2026',
        endDateStr: '10:24:00 10/6/2026',
        status: 'Không xác định'
      },
      {
        name: 'Ls12_B2.docx_12A1',
        examTitle: 'Ls12_B2.docx',
        className: '12A1',
        startDateStr: '10:34:00 9/4/2026',
        endDateStr: '10:34:00 11/4/2026',
        status: 'Không xác định'
      }
    ];

    try {
      for (const item of sampleData) {
        await addDoc(collection(db, 'examSessions'), {
          ...item,
          teacherId: uid,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error('Lỗi khởi tạo phiên mẫu:', e);
    }
  };

  // Sao chép link thi trực tuyến
  const handleCopyLink = (session: ExamSession) => {
    const host = window.location.origin;
    const testLink = `${host}/exam-test/${session.id}`;
    navigator.clipboard.writeText(testLink);
    setNotification({
      type: 'success',
      message: `Đã sao chép link đề "${session.name}" vào bộ nhớ tạm!`
    });
  };

  // Tạo mới phiên giao đề
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser || authUser;
    if (!user || !selectedExamId) return;

    const examObj = examsList.find((e) => e.id === selectedExamId);
    const classObj = classesList.find((c) => c.id === selectedClassId);

    const examTitle = examObj ? examObj.title : 'Đề kiểm tra';
    const className = classObj ? classObj.name : 'N/A';
    const sessionName = customSessionName.trim() || `${examTitle}_${className}`;

    // Format ngày bắt đầu & kết thúc
    const formatDateTime = (val: string) => {
      if (!val) return '14:50:00 13/4/2026';
      const d = new Date(val);
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
      const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      return `${time} ${date}`;
    };

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'examSessions'), {
        name: sessionName,
        examTitle: examTitle,
        examId: selectedExamId,
        className: className,
        classId: selectedClassId || '',
        startDateStr: formatDateTime(startDate),
        endDateStr: formatDateTime(endDate),
        status: 'Đang diễn ra',
        teacherId: user.uid || 'teacher_giasudienvan',
        teacherEmail: user.email || 'giasudienvan@gmail.com',
        createdAt: serverTimestamp()
      });

      setShowCreateModal(false);
      setSelectedExamId('');
      setSelectedClassId('');
      setCustomSessionName('');

      setNotification({
        type: 'success',
        message: `Đã tạo phiên giao đề "${sessionName}" thành công!`
      });
    } catch (error) {
      console.error('Lỗi tạo phiên giao đề:', error);
      setNotification({
        type: 'error',
        message: 'Không thể tạo phiên giao đề. Vui lòng thử lại.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xóa phiên giao đề
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      await deleteDoc(doc(db, 'examSessions', sessionToDelete.id));
      setNotification({
        type: 'success',
        message: `Đã xóa phiên giao đề "${sessionToDelete.name}".`
      });
    } catch (error) {
      console.error('Lỗi xóa phiên:', error);
      setNotification({
        type: 'error',
        message: 'Lỗi khi xóa phiên giao đề.'
      });
    } finally {
      setSessionToDelete(null);
    }
  };

  // Huỷ phiên giao đề
  const confirmCancelSession = async () => {
    if (!sessionToCancel) return;
    try {
      await updateDoc(doc(db, 'examSessions', sessionToCancel.id), {
        status: 'Đã huỷ'
      });
      setNotification({
        type: 'success',
        message: `Đã huỷ phiên giao đề "${sessionToCancel.name}".`
      });
      setSessionToCancel(null);
    } catch (error) {
      console.error('Lỗi huỷ phiên:', error);
      setNotification({
        type: 'error',
        message: 'Lỗi khi huỷ phiên giao đề.'
      });
    }
  };

  // Lọc dữ liệu
  const filteredSessions = sessions.filter((s) => {
    const matchesName =
      s.name.toLowerCase().includes(searchExamName.toLowerCase()) ||
      s.examTitle.toLowerCase().includes(searchExamName.toLowerCase());
    const matchesClass = filterClass === 'all' || s.className === filterClass;
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesName && matchesClass && matchesStatus;
  });

  // Phân trang
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage) || 1;
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Danh sách các lớp độc nhất để đưa vào dropdown lọc
  const uniqueClassNames = Array.from(new Set(sessions.map((s) => s.className).filter(Boolean)));

  if (selectedSessionForResults) {
    return (
      <ExamResultsView
        session={selectedSessionForResults}
        onBack={() => setSelectedSessionForResults(null)}
      />
    );
  }

  return (
    <div className="flex-1 bg-white min-h-screen p-6 md:p-8 relative font-sans">
      {/* Toast thông báo */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* HEADER: Các phiên giao đề Online */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-100 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Các phiên giao đề Online
        </h1>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center font-bold text-xs text-teal-700">
            EDU
          </div>
        </div>
      </div>

      {/* KHỐI BỘ LỌC CHUẨN 100% THEO ẢNH MẪU */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cột 1: Tìm theo tên đề thi */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              Tìm theo tên đề thi
            </label>
            <input
              type="text"
              value={searchExamName}
              onChange={(e) => {
                setSearchExamName(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Nhập tên đề thi"
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
            />
          </div>

          {/* Cột 2: Lọc theo lớp học */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              Lọc theo lớp học
            </label>
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer"
            >
              <option value="all">Tất cả lớp học</option>
              {uniqueClassNames.map((cName) => (
                <option key={cName} value={cName}>
                  {cName}
                </option>
              ))}
            </select>
          </div>

          {/* Cột 3: Trạng thái */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              Trạng thái
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Không xác định">Không xác định</option>
              <option value="Đang diễn ra">Đang diễn ra</option>
              <option value="Đã kết thúc">Đã kết thúc</option>
              <option value="Đã huỷ">Đã huỷ</option>
            </select>
          </div>
        </div>

        {/* Nút Tạo phiên mới tiện lợi */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mới phiên giao đề</span>
          </button>
        </div>
      </div>

      {/* BẢNG DỮ LIỆU CÁC PHIÊN GIAO ĐỀ THEO MẪU ẢNH */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Đang tải các phiên giao đề Online...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Không tìm thấy phiên giao đề nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="text-xs text-gray-600 border-b border-gray-200 bg-white">
                <tr>
                  <th className="py-4 px-4 font-semibold">Tên</th>
                  <th className="py-4 px-4 font-semibold w-40">Đường dẫn</th>
                  <th className="py-4 px-4 font-semibold w-44">Hành động</th>
                  <th className="py-4 px-4 font-semibold w-24">Lớp học</th>
                  <th className="py-4 px-4 font-semibold w-44">Ngày bắt đầu</th>
                  <th className="py-4 px-4 font-semibold w-44">Ngày kết thúc</th>
                  <th className="py-4 px-4 font-semibold w-32">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {paginatedSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50/70 transition-colors">
                    {/* Cột 1: Tên & Tên đề kiểm tra */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900 text-sm">
                        {session.name}
                      </div>
                      <div className="text-xs text-gray-500 italic mt-0.5">
                        (Đề kiểm tra: {session.examTitle})
                      </div>
                    </td>

                    {/* Cột 2: Đường dẫn (Link làm bài trực tuyến + nút Share) */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-600">
                        <a
                          href={`/exam-test/${session.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1 max-w-[95px] truncate font-semibold"
                          title="Nhấp để mở bài thi trực tuyến"
                        >
                          <span className="truncate">/exam-test...</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(session)}
                          className="text-gray-500 hover:text-teal-700 p-0.5 rounded cursor-pointer"
                          title="Sao chép đường dẫn làm bài"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Cột 3: Hành động [Xem] [Xóa] [Huỷ] */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {/* Nút Xem */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSession(session);
                            setShowDetailModal(true);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-white border border-teal-600/70 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                        >
                          Xem
                        </button>

                        {/* Nút Kết quả */}
                        <button
                          type="button"
                          onClick={() => setSelectedSessionForResults(session)}
                          className="px-2.5 py-1 text-xs font-bold text-[#0d9488] bg-teal-50/80 border border-[#0d9488]/70 hover:bg-[#0d9488] hover:text-white rounded transition-all cursor-pointer shadow-2xs"
                          title="Xem danh sách kết quả bài làm của học sinh"
                        >
                          Kết quả
                        </button>

                        {/* Nút Xóa */}
                        <button
                          type="button"
                          onClick={() => setSessionToDelete(session)}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 bg-white border border-rose-400/80 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          Xóa
                        </button>

                        {/* Nút Huỷ */}
                        <button
                          type="button"
                          onClick={() => setSessionToCancel(session)}
                          className="px-2.5 py-1 text-xs font-medium text-amber-600 bg-white border border-amber-400/80 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                        >
                          Huỷ
                        </button>
                      </div>
                    </td>

                    {/* Cột 4: Lớp học */}
                    <td className="py-3.5 px-4 font-medium text-gray-800 text-xs">
                      {session.className}
                    </td>

                    {/* Cột 5: Ngày bắt đầu */}
                    <td className="py-3.5 px-4 text-xs text-gray-600 font-mono">
                      {session.startDateStr}
                    </td>

                    {/* Cột 6: Ngày kết thúc */}
                    <td className="py-3.5 px-4 text-xs text-gray-600 font-mono">
                      {session.endDateStr}
                    </td>

                    {/* Cột 7: Trạng thái */}
                    <td className="py-3.5 px-4 text-xs text-gray-600">
                      {session.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PHÂN TRANG (PAGINATION THEO ẢNH MẪU: [ < ] Trang 1 / 4 [ > ]) */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-center gap-4 bg-white text-xs text-gray-600">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Trang trước"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="font-semibold text-gray-800">
            Trang {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Trang sau"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: TẠO MỚI PHIÊN GIAO ĐỀ (CẤU HÌNH TOÀN DIỆN CHUẨN)     */}
      {/* ========================================================= */}
      <AssignExamConfigModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        examsList={examsList}
        classesList={classesList}
        onSuccess={(sId, sName, link) => {
          setNotification({
            type: 'success',
            message: `Đã tạo phiên giao đề "${sName}" thành công!`
          });
          setNewlyCreatedSession({ id: sId, name: sName, link });
        }}
      />

      {/* ========================================================= */}
      {/* MODAL: THÔNG BÁO GIAO ĐỀ THÀNH CÔNG VÀ SAO CHÉP LINK       */}
      {/* ========================================================= */}
      {newlyCreatedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-gray-900">Giao đề thi thành công!</h3>
              <p className="text-xs text-gray-500 font-medium">{newlyCreatedSession.name}</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2 text-xs">
              <span className="text-gray-500 block font-semibold">Đường dẫn làm bài trực tuyến:</span>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-200 font-mono text-[11px] text-gray-800 break-all select-all">
                <span className="flex-1">{newlyCreatedSession.link}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newlyCreatedSession.link);
                    setNotification({ type: 'success', message: 'Đã sao chép link đề thi vào clipboard!' });
                  }}
                  className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg border border-teal-200 cursor-pointer shrink-0"
                  title="Sao chép"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewlyCreatedSession(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Đóng
              </button>
              <a
                href={newlyCreatedSession.link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Làm bài thử ngay</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: XEM CHI TIẾT PHIÊN GIAO ĐỀ                         */}
      {/* ========================================================= */}
      {showDetailModal && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Chi tiết phiên giao đề</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedSession(null);
                }}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-500 block">Tên phiên giao đề:</span>
                <span className="font-bold text-gray-900 text-sm">{selectedSession.name}</span>
              </div>

              <div>
                <span className="text-gray-500 block">Đề thi liên kết:</span>
                <span className="font-semibold text-teal-800">{selectedSession.examTitle}</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Lớp học:</span>
                  <span className="font-bold text-gray-900">{selectedSession.className}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Thời gian làm bài:</span>
                  <span className="font-bold text-teal-800">{selectedSession.durationMinutes || 45} phút</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Thời gian bắt đầu:</span>
                  <span className="font-mono text-gray-800">{selectedSession.startDateStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Thời gian kết thúc:</span>
                  <span className="font-mono text-gray-800">{selectedSession.endDateStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trạng thái:</span>
                  <span className="font-semibold text-emerald-700">{selectedSession.status}</span>
                </div>
              </div>

              {/* Thông tin chống gian lận & giám sát */}
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/70 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Quy chế giám sát thi trực tuyến:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-700 pt-1">
                  <div>
                    <span className="text-gray-500">Cảnh báo chuyển tab:</span>{' '}
                    <span className="font-bold text-rose-700">Tự nộp bài lần 2</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Chống chụp màn hình:</span>{' '}
                    <span className="font-bold text-teal-800">Đã kích hoạt</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Chặn sao chép & chuột phải:</span>{' '}
                    <span className="font-bold text-teal-800">Đã kích hoạt</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Ghi nhận vi phạm:</span>{' '}
                    <span className="font-bold text-teal-800">Có nhật ký</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-gray-500 block mb-1">Đường dẫn làm bài trực tuyến:</span>
                <div className="flex items-center gap-2 bg-gray-100 p-2.5 rounded-xl font-mono text-[11px] text-gray-800 break-all select-all">
                  <span className="flex-1">
                    {window.location.origin}/exam-test/{selectedSession.id}
                  </span>
                  <button
                    onClick={() => handleCopyLink(selectedSession)}
                    className="p-1.5 bg-white text-teal-700 hover:bg-teal-50 rounded-lg border border-gray-200 shadow-2xs cursor-pointer shrink-0"
                    title="Sao chép liên kết"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedSession(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                Đóng
              </button>
              <a
                href={`/exam-test/${selectedSession.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở làm bài trực tuyến</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  const s = selectedSession;
                  setShowDetailModal(false);
                  setSelectedSession(null);
                  setSelectedSessionForResults(s);
                }}
                className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Xem kết quả</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyLink(selectedSession)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Sao chép link gửi học sinh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: XÁC NHẬN XÓA PHIÊN GIAO ĐỀ                         */}
      {/* ========================================================= */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Xác nhận xóa phiên</h3>
                <p className="text-xs text-gray-500">Xóa vĩnh viễn phiên giao đề này</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa phiên giao đề <span className="font-bold text-rose-600">"{sessionToDelete.name}"</span>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-medium cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteSession}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa phiên</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: XÁC NHẬN HỦY PHIÊN GIAO ĐỀ                         */}
      {/* ========================================================= */}
      {sessionToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Huỷ phiên giao đề</h3>
                <p className="text-xs text-gray-500">Dừng tiếp nhận bài làm</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Xác nhận chuyển trạng thái phiên <span className="font-bold">"{sessionToCancel.name}"</span> thành <span className="font-bold text-amber-600">Đã huỷ</span>? Học sinh sẽ không thể tiếp tục nộp bài.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSessionToCancel(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-medium cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={confirmCancelSession}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                Xác nhận huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
