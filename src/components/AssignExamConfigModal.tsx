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
  Send,
  Info,
  Calculator,
  Sliders,
  Award
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  SectionPointsConfig,
  DEFAULT_SECTION_POINTS,
  resolveSectionScoring,
  formatPointBadge
} from '../data/sampleQuestions';
import { SectionPointsConfigurator } from './SectionPointsConfigurator';
import { sanitizeForFirestore } from '../utils/imageCompressor';

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
  sectionPoints?: SectionPointsConfig;
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

export interface ExamSummaryOption {
  id: string;
  title: string;
  durationMinutes?: number;
  questionCountStr?: string;
  sectionPoints?: SectionPointsConfig;
  questions?: any[];
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
    sectionPoints?: SectionPointsConfig;
    questions?: any[];
  } | null;
  examsList?: ExamSummaryOption[];
  classesList: { id: string; name: string }[];
  onSuccess: (sessionId: string, sessionName: string, examLink: string) => void;
}

function parseQuestionCounts(countStr?: string, questions?: any[]): { p1: number; p2: number; p3: number } {
  if (questions && Array.isArray(questions) && questions.length > 0) {
    const p1 = questions.filter(
      (q) =>
        q.section &&
        /(?:Phần|Part)\s*(?:I(?![IVX\w])|1\b)/i.test(q.section) &&
        !/(?:Phần|Part)\s*(?:II|2\b)/i.test(q.section) &&
        !/(?:Phần|Part)\s*(?:III|3\b)/i.test(q.section)
    ).length;
    const p2 = questions.filter(
      (q) =>
        q.section &&
        /(?:Phần|Part)\s*(?:II(?![IVX\w])|2\b)/i.test(q.section) &&
        !/(?:Phần|Part)\s*(?:III|3\b)/i.test(q.section)
    ).length;
    const p3 = questions.filter((q) => q.section && /(?:Phần|Part)\s*(?:III(?![IVX\w])|3\b)/i.test(q.section)).length;
    if (p1 + p2 + p3 > 0) {
      return { p1, p2, p3 };
    }
  }

  if (countStr && typeof countStr === 'string') {
    const parts = countStr.split('-').map((n) => parseInt(n.trim(), 10));
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return {
        p1: parts[0],
        p2: parts[1],
        p3: parts[2]
      };
    }
  }

  return { p1: 18, p2: 4, p3: 6 };
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
  const [activeTab, setActiveTab] = useState<'general' | 'scoring' | 'anticheat' | 'display'>('general');

  // Selected Exam & Class
  const [selectedExamId, setSelectedExamId] = useState<string>(exam?.id || examsList[0]?.id || '');
  const [selectedClassId, setSelectedClassId] = useState<string>(classesList[0]?.id || '');
  const [customTitle, setCustomTitle] = useState<string>('');

  // Điểm từng phần & Số câu hỏi từng phần của đề đang chọn
  const [sectionPoints, setSectionPoints] = useState<SectionPointsConfig>(
    exam?.sectionPoints || DEFAULT_SECTION_POINTS
  );
  const [sectionCounts, setSectionCounts] = useState<{ p1: number; p2: number; p3: number }>(() =>
    parseQuestionCounts(exam?.questionCountStr, exam?.questions)
  );

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
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Đồng bộ khi prop exam hoặc danh sách đề thay đổi
  useEffect(() => {
    if (exam?.id) {
      setSelectedExamId(exam.id);
      if (exam.durationMinutes) {
        setDurationMinutes(exam.durationMinutes);
      }
      if (exam.sectionPoints) {
        setSectionPoints({
          ...DEFAULT_SECTION_POINTS,
          ...exam.sectionPoints,
          p2: { ...DEFAULT_SECTION_POINTS.p2, ...(exam.sectionPoints.p2 || {}) }
        });
      }
      setSectionCounts(parseQuestionCounts(exam.questionCountStr, exam.questions));
    } else if (!selectedExamId && examsList.length > 0) {
      setSelectedExamId(examsList[0].id);
    }
  }, [exam, examsList]);

  // Khi người dùng đổi đề thi trong dropdown, tự động tải số câu từng phần và cấu hình điểm của đề đó
  useEffect(() => {
    if (!selectedExamId) return;

    const matchedExam =
      (exam && exam.id === selectedExamId ? exam : null) ||
      examsList.find((e) => e.id === selectedExamId);

    if (matchedExam) {
      if (matchedExam.durationMinutes) {
        setDurationMinutes(matchedExam.durationMinutes);
      }
      if (matchedExam.sectionPoints) {
        setSectionPoints({
          ...DEFAULT_SECTION_POINTS,
          ...matchedExam.sectionPoints,
          p2: { ...DEFAULT_SECTION_POINTS.p2, ...(matchedExam.sectionPoints.p2 || {}) }
        });
      }
      if (matchedExam.questionCountStr || matchedExam.questions) {
        setSectionCounts(parseQuestionCounts(matchedExam.questionCountStr, matchedExam.questions));
        return;
      }
    }

    // Nếu examsList chưa có thông tin chi tiết câu hỏi/điểm của đề, truy vấn nhanh từ Firestore
    if (db) {
      getDoc(doc(db, 'exams', selectedExamId))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.durationMinutes) setDurationMinutes(data.durationMinutes);
            if (data.sectionPoints) {
              setSectionPoints({
                ...DEFAULT_SECTION_POINTS,
                ...data.sectionPoints,
                p2: { ...DEFAULT_SECTION_POINTS.p2, ...(data.sectionPoints.p2 || {}) }
              });
            }
            setSectionCounts(parseQuestionCounts(data.questionCountStr, data.questions));
          }
        })
        .catch(() => {});
    }
  }, [selectedExamId, exam, examsList]);

  const currentExamTitle =
    (exam && exam.id === selectedExamId ? exam.title : '') ||
    examsList.find((e) => e.id === selectedExamId)?.title ||
    'Đề kiểm tra trực tuyến';

  const currentClassName =
    classesList.find((c) => c.id === selectedClassId)?.name || 'Tự do / Toàn trường';

  const generatedSessionName =
    customTitle.trim() ||
    `${currentExamTitle}_${currentClassName === 'Tự do / Toàn trường' ? 'Chung' : currentClassName}`;

  const resolvedScoring = resolveSectionScoring(sectionPoints, {
    p1Count: sectionCounts.p1,
    p2Count: sectionCounts.p2,
    p3Count: sectionCounts.p3
  });

  // Xử lý nộp form tạo cấu hình giao đề
  const handleSaveAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!selectedExamId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
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

      const finalSectionPoints: SectionPointsConfig = {
        ...sectionPoints,
        scoringMode: resolvedScoring.mode,
        allocationMethod: resolvedScoring.allocation,
        p2Distribution: resolvedScoring.p2Dist,
        p1TotalPoints: resolvedScoring.totalP1,
        p2TotalPoints: resolvedScoring.totalP2,
        p3TotalPoints: resolvedScoring.totalP3,
        p1: resolvedScoring.p1PerQ,
        p2: resolvedScoring.p2Opts,
        p3: resolvedScoring.p3PerQ
      };

      const sessionData = sanitizeForFirestore({
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
        teacherId: user?.uid || 'teacher_giasudienvan',
        durationMinutes: Number(durationMinutes) || 45,
        attemptsAllowed: Number(attemptsAllowed) || 1,
        examPassword: examPassword.trim(),
        sectionPoints: finalSectionPoints,
        // Cấu hình giám sát gian lận (Anti-cheat)
        enableAntiCheat,
        autoSubmitOnSecondTab,
        maxTabSwitches: 2,
        preventScreenshot,
        preventCopyPaste,
        recordViolations,
        // Cấu hình đề & hiển thị
        shuffleQuestions,
        shuffleOptions,
        showScoreAfterSubmit,
        showSolutionAfterSubmit,
        requireStudentVerification
      });

      const docRef = await addDoc(collection(db, 'examSessions'), {
        ...sessionData,
        createdAt: serverTimestamp()
      });

      // Đồng bộ cấu hình điểm từng phần vào đề thi gốc để lần sau mở lại vẫn giữ nguyên
      try {
        await updateDoc(doc(db, 'exams', selectedExamId), {
          sectionPoints: sanitizeForFirestore(finalSectionPoints)
        });
      } catch (_) {}

      const testLink = `${window.location.origin}/exam-test/${docRef.id}`;

      onSuccess(docRef.id, generatedSessionName, testLink);
      onClose();
    } catch (error: any) {
      console.error('Lỗi khi lưu cấu hình giao đề:', error);
      setSubmitError('Không thể tạo phiên giao đề. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl w-[96vw] max-w-5xl p-5 sm:p-7 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-200 my-auto max-h-[95vh] flex flex-col overflow-hidden">
        {/* HEADER MODAL */}
        <div className="flex items-start justify-between pb-3.5 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                  Cài đặt cấu hình giao đề thi cho lớp
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Thiết lập thời gian làm bài, cấu hình điểm từng phần, chống gian lận và bảo mật phòng thi
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* THÔNG TIN TÓM TẮT ĐỀ THI & CHẾ ĐỘ ĐIỂM */}
        <div className="px-4 py-3 bg-linear-to-r from-teal-50/80 via-emerald-50/50 to-teal-50/70 rounded-2xl border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block">
              Đề thi được chọn ({sectionCounts.p1 + sectionCounts.p2 + sectionCounts.p3} câu: Phần I: {sectionCounts.p1} câu • Phần II: {sectionCounts.p2} câu • Phần III: {sectionCounts.p3} câu)
            </span>
            <span className="text-sm sm:text-base font-extrabold text-gray-900 truncate block">
              {currentExamTitle}
            </span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-extrabold rounded-full shadow-2xs">
              Tổng điểm đề: {resolvedScoring.totalExam} điểm
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('scoring')}
              className={`px-3.5 py-1.5 border text-xs font-bold rounded-full shadow-2xs cursor-pointer transition-colors flex items-center gap-1.5 ${
                resolvedScoring.mode === 'custom_section'
                  ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                  : 'bg-white border-teal-300 text-teal-800 hover:bg-teal-50'
              }`}
              title="Nhấn để mở chi tiết Cấu hình điểm từng phần"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>
                {resolvedScoring.mode === 'custom_section'
                  ? 'Điểm tùy chỉnh từng phần'
                  : 'Chuẩn Form 2025'}
              </span>
            </button>
          </div>
        </div>

        {/* TABS ĐIỀU HƯỚNG CẤU HÌNH - RỘNG RÃI TRÊN 1 HÀNG KHÔNG BỊ THANH CUỘN NGANG */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 bg-gray-100/90 p-1.5 rounded-2xl border border-gray-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'bg-white text-teal-800 font-extrabold shadow-xs border border-teal-200/80'
                : 'text-gray-600 font-semibold hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <Clock className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Thời gian & Đối tượng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scoring')}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer ${
              activeTab === 'scoring'
                ? 'bg-white text-teal-800 font-extrabold shadow-xs border border-teal-200/80'
                : 'text-gray-600 font-semibold hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <Calculator className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Cấu hình điểm từng phần</span>
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-full">
              Mới
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('anticheat')}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer ${
              activeTab === 'anticheat'
                ? 'bg-white text-teal-800 font-extrabold shadow-xs border border-teal-200/80'
                : 'text-gray-600 font-semibold hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Chống gian lận & Giám sát</span>
            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-extrabold rounded-full hidden sm:inline">
              Khuyên dùng
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('display')}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer ${
              activeTab === 'display'
                ? 'bg-white text-teal-800 font-extrabold shadow-xs border border-teal-200/80'
                : 'text-gray-600 font-semibold hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <Shuffle className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Trộn đề & Hiển thị kết quả</span>
          </button>
        </div>

        <form onSubmit={handleSaveAndAssign} className="space-y-4 overflow-y-auto flex-1 pr-1">
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {submitError}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: THỜI GIAN & ĐỐI TƯỢNG + CẤU HÌNH NHANH ĐIỂM PHẦN   */}
          {/* ========================================================= */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Hàng 1: Chọn đề thi, Lớp học, Tên phiên giao đề (Bố cục 3 cột rộng rãi) */}
              <div className={`grid grid-cols-1 ${!exam && examsList.length > 0 ? 'lg:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
                {!exam && examsList.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Chọn đề thi:
                    </label>
                    <select
                      value={selectedExamId}
                      onChange={(e) => setSelectedExamId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-teal-500 cursor-pointer"
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

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Giao cho lớp học:
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-medium text-gray-900 focus:ring-2 focus:ring-teal-500 cursor-pointer"
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
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Tên phiên giao đề (Tùy chỉnh):
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={generatedSessionName}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Hàng 2: KHỐI CẤU HÌNH ĐIỂM TỪNG PHẦN RỘNG RÃI, RÕ RÀNG */}
              <div className="p-4 bg-linear-to-r from-amber-50/60 via-white to-teal-50/40 border border-amber-200 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-gray-900 block">
                        Cách cho điểm đề thi ({sectionCounts.p1} câu Phần I • {sectionCounts.p2} câu Phần II • {sectionCounts.p3} câu Phần III)
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Chọn giữ nguyên chuẩn Form 2025 hoặc tùy chỉnh điểm từng phần cho đề có số câu tùy ý
                      </span>
                    </div>
                  </div>

                  <div className="inline-flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setSectionPoints((prev) => ({
                          ...prev,
                          scoringMode: 'standard_2025',
                          allocationMethod: 'per_question',
                          p2Distribution: 'progressive',
                          p1: prev.p1 || 0.25,
                          p2: { opt1: 0.1, opt2: 0.25, opt3: 0.5, opt4: 1.0 },
                          p3: prev.p3 || 0.25
                        }))
                      }
                      className={`px-3.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                        resolvedScoring.mode === 'standard_2025'
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Theo Form chuẩn 2025</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSectionPoints((prev) => ({
                          ...prev,
                          scoringMode: 'custom_section',
                          allocationMethod: prev.allocationMethod || 'section_total'
                        }))
                      }
                      className={`px-3.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                        resolvedScoring.mode === 'custom_section'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Tùy chỉnh điểm từng phần</span>
                    </button>
                  </div>
                </div>

                {resolvedScoring.mode === 'standard_2025' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-teal-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-teal-950 block">Phần I ({sectionCounts.p1} câu)</span>
                        <span className="text-[11px] text-gray-500">Trắc nghiệm 4 lựa chọn</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-teal-800 block">{formatPointBadge(resolvedScoring.p1PerQ)} đ/câu</span>
                        <span className="text-[11px] font-semibold text-amber-700">Tổng: {resolvedScoring.totalP1}đ</span>
                      </div>
                    </div>

                    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-teal-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-teal-950 block">Phần II ({sectionCounts.p2} câu)</span>
                        <span className="text-[11px] text-gray-500">1-2-3-4 ý: 0.1 - 0.25 - 0.5 - 1.0đ</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-teal-800 block">1.0 đ/câu</span>
                        <span className="text-[11px] font-semibold text-amber-700">Tổng: {resolvedScoring.totalP2}đ</span>
                      </div>
                    </div>

                    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-teal-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-teal-950 block">Phần III ({sectionCounts.p3} câu)</span>
                        <span className="text-[11px] text-gray-500">Trắc nghiệm trả lời ngắn</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-teal-800 block">{formatPointBadge(resolvedScoring.p3PerQ)} đ/câu</span>
                        <span className="text-[11px] font-semibold text-amber-700">Tổng: {resolvedScoring.totalP3}đ</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-amber-300 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                          <span>Tổng điểm Phần I ({sectionCounts.p1} câu):</span>
                          <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {formatPointBadge(resolvedScoring.p1PerQ)} đ/câu
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={sectionPoints.p1TotalPoints ?? resolvedScoring.totalP1}
                            onChange={(e) => {
                              const totalP1 = Math.max(0, parseFloat(e.target.value) || 0);
                              setSectionPoints((prev) => ({
                                ...prev,
                                scoringMode: 'custom_section',
                                allocationMethod: 'section_total',
                                p1TotalPoints: totalP1,
                                p1: sectionCounts.p1 > 0 ? Math.round((totalP1 / sectionCounts.p1) * 10000) / 10000 : prev.p1
                              }));
                            }}
                            className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-sm font-extrabold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="text-xs font-semibold text-gray-500 shrink-0">điểm</span>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-amber-300 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                          <span>Tổng điểm Phần II ({sectionCounts.p2} câu):</span>
                          <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {formatPointBadge(resolvedScoring.p2PerQMax)} đ/câu
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={sectionPoints.p2TotalPoints ?? resolvedScoring.totalP2}
                            onChange={(e) => {
                              const totalP2 = Math.max(0, parseFloat(e.target.value) || 0);
                              const maxPerQ = sectionCounts.p2 > 0 ? totalP2 / sectionCounts.p2 : 1.0;
                              setSectionPoints((prev) => ({
                                ...prev,
                                scoringMode: 'custom_section',
                                allocationMethod: 'section_total',
                                p2TotalPoints: totalP2,
                                p2: {
                                  opt1: Math.round(maxPerQ * 0.1 * 10000) / 10000,
                                  opt2: Math.round(maxPerQ * 0.25 * 10000) / 10000,
                                  opt3: Math.round(maxPerQ * 0.5 * 10000) / 10000,
                                  opt4: Math.round(maxPerQ * 10000) / 10000
                                }
                              }));
                            }}
                            className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-sm font-extrabold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="text-xs font-semibold text-gray-500 shrink-0">điểm</span>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-amber-300 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                          <span>Tổng điểm Phần III ({sectionCounts.p3} câu):</span>
                          <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {formatPointBadge(resolvedScoring.p3PerQ)} đ/câu
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={sectionPoints.p3TotalPoints ?? resolvedScoring.totalP3}
                            onChange={(e) => {
                              const totalP3 = Math.max(0, parseFloat(e.target.value) || 0);
                              setSectionPoints((prev) => ({
                                ...prev,
                                scoringMode: 'custom_section',
                                allocationMethod: 'section_total',
                                p3TotalPoints: totalP3,
                                p3: sectionCounts.p3 > 0 ? Math.round((totalP3 / sectionCounts.p3) * 10000) / 10000 : prev.p3
                              }));
                            }}
                            className="w-full px-3 py-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-sm font-extrabold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="text-xs font-semibold text-gray-500 shrink-0">điểm</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-amber-900">Chia nhanh (Tổng 10đ):</span>
                        {[
                          { label: '4.5 - 4.0 - 1.5', p1: 4.5, p2: 4.0, p3: 1.5 },
                          { label: '3.0 - 4.0 - 3.0', p1: 3.0, p2: 4.0, p3: 3.0 },
                          { label: '4.0 - 4.0 - 2.0', p1: 4.0, p2: 4.0, p3: 2.0 },
                          { label: '5.0 - 3.0 - 2.0', p1: 5.0, p2: 3.0, p3: 2.0 }
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              setSectionPoints((prev) => ({
                                ...prev,
                                scoringMode: 'custom_section',
                                allocationMethod: 'section_total',
                                p1TotalPoints: preset.p1,
                                p2TotalPoints: preset.p2,
                                p3TotalPoints: preset.p3
                              }))
                            }
                            className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('scoring')}
                        className="text-teal-700 hover:underline font-bold cursor-pointer"
                      >
                        Tùy chỉnh nâng cao (điểm từng ý a,b,c,d) →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Hàng 3: Thời gian làm bài + Số lần làm bài + Mật khẩu phòng thi */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80">
                <div className="lg:col-span-5">
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
                      className="w-20 px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-teal-500"
                      required
                    />
                    <div className="flex flex-wrap gap-1">
                      {[15, 45, 50, 60, 90].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setDurationMinutes(mins)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
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

                <div className="lg:col-span-4">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
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

                <div className="lg:col-span-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-gray-500" />
                    <span>Mật khẩu phòng thi:</span>
                  </label>
                  <input
                    type="text"
                    value={examPassword}
                    onChange={(e) => setExamPassword(e.target.value)}
                    placeholder="Để trống nếu không cần"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Hàng 4: Bắt đầu & Kết thúc */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>Thời gian bắt đầu mở đề:</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hạn chót nộp bài:</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: CẤU HÌNH ĐIỂM TỪNG PHẦN (FORM CHUẨN & SỐ CÂU TÙY Ý) */}
          {/* ========================================================= */}
          {activeTab === 'scoring' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Cho phép chỉnh số câu hỏi dự kiến của từng phần nếu đề tùy ý */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-bold text-gray-800">
                  Số lượng câu hỏi từng phần của đề đang chọn:
                </span>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-1.5">
                    <span className="text-gray-600 font-semibold">Phần I:</span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={sectionCounts.p1}
                      onChange={(e) =>
                        setSectionCounts((prev) => ({
                          ...prev,
                          p1: Math.max(0, parseInt(e.target.value, 10) || 0)
                        }))
                      }
                      className="w-16 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-center text-teal-900"
                    />
                    <span className="text-gray-500">câu</span>
                  </label>

                  <label className="flex items-center gap-1.5">
                    <span className="text-gray-600 font-semibold">Phần II:</span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={sectionCounts.p2}
                      onChange={(e) =>
                        setSectionCounts((prev) => ({
                          ...prev,
                          p2: Math.max(0, parseInt(e.target.value, 10) || 0)
                        }))
                      }
                      className="w-16 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-center text-teal-900"
                    />
                    <span className="text-gray-500">câu</span>
                  </label>

                  <label className="flex items-center gap-1.5">
                    <span className="text-gray-600 font-semibold">Phần III:</span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={sectionCounts.p3}
                      onChange={(e) =>
                        setSectionCounts((prev) => ({
                          ...prev,
                          p3: Math.max(0, parseInt(e.target.value, 10) || 0)
                        }))
                      }
                      className="w-16 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-center text-teal-900"
                    />
                    <span className="text-gray-500">câu</span>
                  </label>
                </div>
              </div>

              <SectionPointsConfigurator
                value={sectionPoints}
                onChange={setSectionPoints}
                p1Count={sectionCounts.p1}
                p2Count={sectionCounts.p2}
                p3Count={sectionCounts.p3}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: CHỐNG GIAN LẬN & GIÁM SÁT THI TRỰC TUYẾN          */}
          {/* ========================================================= */}
          {activeTab === 'anticheat' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold block">Quy định giám sát trực tuyến nghiêm ngặt:</span>
                  Hệ thống tự động phát hiện mọi thao tác chuyển tab, chụp ảnh màn hình, sao chép câu hỏi và thu bài tự động ngay lập tức nếu học sinh tái phạm lần thứ 2.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. Cảnh báo chuyển tab & tự động nộp bài lần 2 */}
                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200/80 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="text-xs font-bold text-rose-950">
                        Cảnh báo & Tự động nộp bài khi chuyển tab lần 2
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Lần 1 hiện thông báo cảnh báo nghiêm khắc. <b>Nếu chuyển tab lần 2, hệ thống TỰ ĐỘNG THU VÀ NỘP BÀI THI</b> ngay lập tức.
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
                <div className="p-4 bg-white rounded-2xl border border-gray-200 flex items-start justify-between gap-3 shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CameraOff className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="text-xs font-bold text-gray-900">
                        Chặn chụp màn hình (PrintScreen / Snipping Tool)
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
                <div className="p-4 bg-white rounded-2xl border border-gray-200 flex items-start justify-between gap-3 shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Copy className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="text-xs font-bold text-gray-900">
                        Chặn sao chép (Copy / Cut / Paste) & Chuột phải
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
                <div className="p-4 bg-white rounded-2xl border border-gray-200 flex items-start justify-between gap-3 shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-bold text-gray-900">
                        Ghi nhận nhật ký vi phạm chi tiết cho giáo viên
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Lưu lại chính xác từng mốc thời gian, loại vi phạm vào mục "Kết quả bài làm" để giáo viên kiểm tra.
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
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: TRỘN ĐỀ & HIỂN THỊ KẾT QUẢ                         */}
          {/* ========================================================= */}
          {activeTab === 'display' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Đảo câu hỏi */}
                <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
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
                <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
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

                {/* Cấu hình xem điểm */}
                <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
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
                <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2 shadow-2xs">
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
              </div>

              {/* Yêu cầu xác thực học sinh */}
              <div className="p-4 bg-white rounded-2xl border border-gray-200 flex items-start justify-between gap-3 shadow-2xs">
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
          <div className="flex items-center justify-between pt-3.5 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>

            <div className="flex items-center gap-2.5">
              {activeTab !== 'general' && (
                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      activeTab === 'display'
                        ? 'anticheat'
                        : activeTab === 'anticheat'
                        ? 'scoring'
                        : 'general'
                    )
                  }
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-900 text-xs font-semibold cursor-pointer"
                >
                  Quay lại
                </button>
              )}
              {activeTab !== 'display' ? (
                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      activeTab === 'general'
                        ? 'scoring'
                        : activeTab === 'scoring'
                        ? 'anticheat'
                        : 'display'
                    )
                  }
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
