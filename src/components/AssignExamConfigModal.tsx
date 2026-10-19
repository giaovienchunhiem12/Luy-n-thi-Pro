import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Users,
  ShieldAlert,
  Shuffle,
  Eye,
  Lock,
  Calendar,
  AlertTriangle,
  CameraOff,
  Copy,
  CheckCircle2,
  Send,
  Sparkles,
  Info
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface AssignConfigData {
  examId: string;
  examTitle: string;
  classId: string;
  className: string;
  sessionName: string;
  durationMinutes: number;
  startDate: string;
  endDate: string;
  attemptsAllowed: number;
  examPassword: string;
  // Giám sát & Chống gian lận
  enableAntiCheat: boolean;
  autoSubmitOnSecondTab: boolean;
  maxTabSwitches: number;
  preventScreenshot: boolean;
  preventCopyPaste: boolean;
  recordViolations: boolean;
  // Trộn & Hiển thị
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showScoreAfterSubmit: boolean;
  showSolutionAfterSubmit: boolean;
  requireStudentVerification: boolean;
}

interface AssignExamConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam?: {
    id: string;
    title: string;
    durationMinutes?: number;
    grade?: string;
    subject?: string;
    questionCountStr?: string;
  } | null;
  examsList?: { id: string; title: string; durationMinutes?: number }[];
  classesList: { id: string; name: string }[];
  onSuccess: (sessionId: string, sessionName: string, examLink: string) => void;
}

export default function AssignExamConfigModal({
  isOpen,
  onClose,
  exam,
  examsList = [],
  classesList = [],
  onSuccess
}: AssignExamConfigModalProps) {
  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'general' | 'anticheat' | 'display'>('general');

  // Selected Exam & Class
  const [selectedExamId, setSelectedExamId] = useState<string>(exam?.id || examsList[0]?.id || '');
  const [selectedClassId, setSelectedClassId] = useState<string>(classesList[0]?.id || '');
  const [customTitle, setCustomTitle] = useState<string>('');

  // Thời gian
  const defaultExamDuration = exam?.durationMinutes || 45;
  const [durationMinutes, setDurationMinutes] = useState<number>(defaultExamDuration);

  // Ngày bắt đầu & kết thúc mặc định
  const getInitialDates = () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
    const pad = (n: number) => String(n).padStart(2, '0');
    const toLocalISO = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return {
      start: toLocalISO(now),
      end: toLocalISO(future)
    };
  };

  const [dateRange, setDateRange] = useState(getInitialDates());
  const [attemptsAllowed, setAttemptsAllowed] = useState<number>(1);
  const [examPassword, setExamPassword] = useState<string>('');

  // Giám sát & Chống gian lận (Anti-cheat)
  const [enableAntiCheat, setEnableAntiCheat] = useState<boolean>(true);
  const [autoSubmitOnSecondTab, setAutoSubmitOnSecondTab] = useState<boolean>(true);
  const [preventScreenshot, setPreventScreenshot] = useState<boolean>(true);
  const [preventCopyPaste, setPreventCopyPaste] = useState<boolean>(true);
  const [recordViolations, setRecordViolations] = useState<boolean>(true);

  // Trộn câu & Hiển thị
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(false);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(false);
  const [showScoreAfterSubmit, setShowScoreAfterSubmit] = useState<boolean>(true);
  const [showSolutionAfterSubmit, setShowSolutionAfterSubmit] = useState<boolean>(true);
  const [requireStudentVerification, setRequireStudentVerification] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update selected exam when exam prop changes
  useEffect(() => {
    if (exam?.id) {
      setSelectedExamId(exam.id);
      if (exam.durationMinutes) {
        setDurationMinutes(exam.durationMinutes);
      }
    }
  }, [exam]);

  const currentExamTitle =
    exam?.title || examsList.find((e) => e.id === selectedExamId)?.title || 'Đề kiểm tra trực tuyến';
  const currentClassName =
    classesList.find((c) => c.id === selectedClassId)?.name || 'Tự do / Toàn trường';

  const generatedSessionName =
    customTitle.trim() || `${currentExamTitle}_${currentClassName === 'Tự do / Toàn trường' ? 'Chung' : currentClassName}`;

  // Xử lý nộp form tạo cấu hình giao đề
  const handleSaveAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !selectedExamId) return;

    setIsSubmitting(true);

    try {
      // Format start and end date strings for display
      const formatDateStr = (isoStr: string) => {
        try {
          const d = new Date(isoStr);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          const ss = '00';
          const day = d.getDate();
          const mon = d.getMonth() + 1;
          const yr = d.getFullYear();
          return `${hh}:${mm}:${ss} ${day}/${mon}/${yr}`;
        } catch (_) {
          return '14:50:00 13/4/2026';
        }
      };

      const sessionData = {
        name: generatedSessionName,
        examTitle: currentExamTitle,
        examId: selectedExamId,
        className: currentClassName,
        classId: selectedClassId || '',
        startDateStr: formatDateStr(dateRange.start),
        endDateStr: formatDateStr(dateRange.end),
        startDateIso: dateRange.start,
        endDateIso: dateRange.end,
        status: 'Đang diễn ra',
        teacherId: user.uid,
        durationMinutes: Number(durationMinutes) || 45,
        attemptsAllowed: Number(attemptsAllowed) || 1,
        examPassword: examPassword.trim(),
        // Cấu hình giám sát gian lận (Anti-cheat)
        enableAntiCheat,
        autoSubmitOnSecondTab,
        maxTabSwitches: 2, // Vi phạm lần 2 tự động nộp bài
        preventScreenshot,
        preventCopyPaste,
        recordViolations,
        // Cấu hình đề & hiển thị
        shuffleQuestions,
        shuffleOptions,
        showScoreAfterSubmit,
        showSolutionAfterSubmit,
        requireStudentVerification,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'examSessions'), sessionData);
      const testLink = `${window.location.origin}/exam-test/${docRef.id}`;

      onSuccess(docRef.id, generatedSessionName, testLink);
      onClose();
    } catch (error) {
      console.error('Lỗi khi lưu cấu hình giao đề:', error);
      alert('Không thể tạo phiên giao đề. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-200 my-auto">
        {/* HEADER MODAL */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
                <Send className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Cài đặt cấu hình giao đề thi cho lớp
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1 pl-9">
              Thiết lập thời gian làm bài, chống gian lận trực tuyến và bảo mật phòng thi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* THÔNG TIN TÓM TẮT ĐỀ THI */}
        <div className="p-3.5 bg-gradient-to-r from-teal-50/70 to-emerald-50/50 rounded-2xl border border-teal-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider block">
              Đề thi được chọn
            </span>
            <span className="text-sm font-bold text-gray-900 line-clamp-1">
              {currentExamTitle}
            </span>
          </div>
          <span className="px-3 py-1 bg-white border border-teal-200 text-teal-800 text-xs font-bold rounded-full shadow-2xs">
            Form 2025
          </span>
        </div>

        {/* TABS ĐIỀU HƯỚNG CẤU HÌNH */}
        <div className="flex border-b border-gray-200 text-xs font-semibold gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'general'
                ? 'border-teal-700 text-teal-800 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Thời gian & Đối tượng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('anticheat')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'anticheat'
                ? 'border-teal-700 text-teal-800 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Chống gian lận & Giám sát</span>
            <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[10px] font-extrabold rounded-full">
              Khuyên dùng
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('display')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'display'
                ? 'border-teal-700 text-teal-800 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>Trộn đề & Hiển thị kết quả</span>
          </button>
        </div>

        <form onSubmit={handleSaveAndAssign} className="space-y-4">
          {/* ========================================================= */}
          {/* TAB 1: THỜI GIAN & ĐỐI TƯỢNG                              */}
          {/* ========================================================= */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Nếu không có đề cố định, cho chọn đề */}
              {!exam && examsList.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Chọn đề thi:
                  </label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    required
                  >
                    {examsList.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lớp học */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Giao cho lớp học:
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    <option value="">N/A (Tự do / Tất cả học sinh)</option>
                    {classesList.map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        Lớp {cl.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Tên phiên giao đề (Tùy chỉnh):
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={generatedSessionName}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Thời gian làm bài */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    <span>Thời gian làm bài (Phút):</span>
                  </label>
                  <span className="text-xs font-bold text-teal-700 font-mono">
                    {durationMinutes} phút
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value) || 45)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-teal-500"
                    required
                  />
                  {/* Quick select pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {[15, 45, 50, 60, 90].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          durationMinutes === mins
                            ? 'bg-teal-700 text-white border-teal-700'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {mins}p
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bắt đầu & Kết thúc */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-gray-50/80 rounded-2xl border border-gray-200/80">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    <span>Thời gian bắt đầu:</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    <span>Hạn chót nộp bài:</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              {/* Số lần làm bài & Mật khẩu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Số lần làm bài:
                  </label>
                  <select
                    value={attemptsAllowed}
                    onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    <option value={1}>1 lần duy nhất (Chuẩn thi cử)</option>
                    <option value={2}>2 lần làm bài</option>
                    <option value={0}>Không giới hạn (Luyện tập tự do)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-gray-500" />
                    <span>Mật khẩu phòng thi (Tùy chọn):</span>
                  </label>
                  <input
                    type="text"
                    value={examPassword}
                    onChange={(e) => setExamPassword(e.target.value)}
                    placeholder="Để trống nếu không cần mật khẩu"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: CHỐNG GIAN LẬN & GIÁM SÁT THI TRỰC TUYẾN          */}
          {/* ========================================================= */}
          {activeTab === 'anticheat' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold block">Quy định giám sát trực tuyến nghiêm ngặt:</span>
                  Hệ thống tự động phát hiện mọi thao tác chuyển tab, chụp ảnh màn hình, sao chép câu hỏi và thu bài tự động ngay lập tức nếu học sinh tái phạm lần thứ 2.
                </div>
              </div>

              {/* 1. Cảnh báo chuyển tab & tự động nộp bài lần 2 */}
              <div className="p-3.5 bg-rose-50/50 rounded-2xl border border-rose-200/80 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-rose-950">
                      Cảnh báo chuyển tab & Tự động nộp bài khi chuyển tab lần 2
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Khi học sinh chuyển sang tab khác hoặc thu nhỏ cửa sổ: Lần 1 hiện thông báo cảnh báo nghiêm khắc. <b>Nếu chuyển tab lần 2, hệ thống sẽ TỰ ĐỘNG THU VÀ NỘP BÀI THI</b> ngay lập tức.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={autoSubmitOnSecondTab}
                    onChange={(e) => setAutoSubmitOnSecondTab(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>

              {/* 2. Chống chụp màn hình */}
              <div className="p-3.5 bg-white rounded-2xl border border-gray-200 flex items-start justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CameraOff className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-gray-900">
                      Chặn chụp màn hình & phím tắt (PrintScreen / Snipping Tool)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Khóa phím PrintScreen, Win+Shift+S, Cmd+Shift+4 và tự động xóa dữ liệu khỏi clipboard của máy thí sinh.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={preventScreenshot}
                    onChange={(e) => setPreventScreenshot(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-700"></div>
                </label>
              </div>

              {/* 3. Chặn copy, bôi đen, chuột phải */}
              <div className="p-3.5 bg-white rounded-2xl border border-gray-200 flex items-start justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-gray-900">
                      Chặn sao chép (Copy / Cut / Paste) & Khóa chuột phải
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Vô hiệu hóa thao tác bôi đen chữ, phím tắt Ctrl+C, Ctrl+X, Ctrl+P, F12 (Inspect) và menu chuột phải.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={preventCopyPaste}
                    onChange={(e) => setPreventCopyPaste(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-700"></div>
                </label>
              </div>

              {/* 4. Ghi nhận nhật ký vi phạm */}
              <div className="p-3.5 bg-white rounded-2xl border border-gray-200 flex items-start justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-gray-900">
                      Ghi nhận nhật ký vi phạm chi tiết cho giáo viên
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Lưu lại chính xác từng mốc thời gian, loại vi phạm vào mục "Kết quả bài làm" để giáo viên kiểm tra khi chấm bài.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={recordViolations}
                    onChange={(e) => setRecordViolations(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: TRỘN ĐỀ & HIỂN THỊ KẾT QUẢ                         */}
          {/* ========================================================= */}
          {activeTab === 'display' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Đảo câu hỏi */}
                <div className="p-3.5 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Shuffle className="w-3.5 h-3.5 text-teal-600" />
                      <span>Đảo câu hỏi</span>
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shuffleQuestions}
                        onChange={(e) => setShuffleQuestions(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-4.5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-700"></div>
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Xáo trộn thứ tự các câu hỏi trong từng phần của đề thi.
                  </p>
                </div>

                {/* Đảo phương án */}
                <div className="p-3.5 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Shuffle className="w-3.5 h-3.5 text-teal-600" />
                      <span>Đảo phương án A, B, C, D</span>
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shuffleOptions}
                        onChange={(e) => setShuffleOptions(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-4.5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-700"></div>
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Xáo trộn thứ tự 4 đáp án A, B, C, D trong các câu trắc nghiệm.
                  </p>
                </div>
              </div>

              {/* Cấu hình xem điểm */}
              <div className="p-3.5 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-teal-600" />
                  <span>Quyền xem điểm số sau khi nộp bài</span>
                </span>
                <div className="space-y-1.5 text-xs text-gray-700 pl-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="score_view"
                      checked={showScoreAfterSubmit}
                      onChange={() => setShowScoreAfterSubmit(true)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Cho phép học sinh xem điểm số ngay sau khi nộp bài</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="score_view"
                      checked={!showScoreAfterSubmit}
                      onChange={() => setShowScoreAfterSubmit(false)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Ẩn điểm số (Giáo viên công bố sau)</span>
                  </label>
                </div>
              </div>

              {/* Cấu hình xem đáp án & Lời giải */}
              <div className="p-3.5 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-teal-600" />
                  <span>Quyền xem đáp án & Lời giải chi tiết</span>
                </span>
                <div className="space-y-1.5 text-xs text-gray-700 pl-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sol_view"
                      checked={showSolutionAfterSubmit}
                      onChange={() => setShowSolutionAfterSubmit(true)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Cho phép xem đáp án & lời giải chi tiết ngay sau khi nộp</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sol_view"
                      checked={!showSolutionAfterSubmit}
                      onChange={() => setShowSolutionAfterSubmit(false)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Không cho phép xem đáp án (Bảo mật đề)</span>
                  </label>
                </div>
              </div>

              {/* Yêu cầu xác thực học sinh */}
              <div className="p-3.5 bg-white rounded-2xl border border-gray-200 flex items-start justify-between gap-3 shadow-2xs">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-600" />
                    <span>Yêu cầu xác thực học sinh khi vào thi</span>
                  </span>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Học sinh phải chọn đúng tên trong danh sách lớp hoặc điền chính xác Họ tên để hệ thống chấm và ghi nhận.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={requireStudentVerification}
                    onChange={(e) => setRequireStudentVerification(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-4.5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-700"></div>
                </label>
              </div>
            </div>
          )}

          {/* FOOTER NÚT BẤM */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>

            <div className="flex items-center gap-2">
              {activeTab !== 'general' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className="px-3.5 py-2.5 text-gray-600 hover:text-gray-900 text-xs font-semibold cursor-pointer"
                >
                  Quay lại
                </button>
              )}
              {activeTab !== 'display' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'general' ? 'anticheat' : 'display')}
                  className="px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Tiếp theo
                </button>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !selectedExamId}
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang tạo link...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Xác nhận & Giao đề ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
