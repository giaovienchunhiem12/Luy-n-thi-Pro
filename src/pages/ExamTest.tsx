import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Award,
  ChevronRight,
  User,
  BookOpen,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Check,
  X,
  ShieldAlert,
  AlertTriangle,
  Lock,
  CameraOff,
  Copy,
  Calendar
} from 'lucide-react';
import { MathText } from '../components/MathText';
import { DEFAULT_SAMPLE_QUESTIONS, DEFAULT_SECTION_POINTS, QuestionItem, SectionPointsConfig } from '../data/sampleQuestions';

export interface ViolationLogItem {
  time: string;
  type: string;
  details: string;
}

export default function ExamTest() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const paramStudentId = searchParams.get('studentId') || '';
  const paramStudentName = searchParams.get('studentName') || '';

  // State
  const [session, setSession] = useState<any>(null);
  const [examData, setExamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Student joining
  const [isJoined, setIsJoined] = useState(false);
  const [studentName, setStudentName] = useState(paramStudentName);
  const [selectedStudent, setSelectedStudent] = useState(paramStudentId);
  const [studentList, setStudentList] = useState<{ id: string; name: string; key?: string }[]>([]);
  const [submittedStudents, setSubmittedStudents] = useState<string[]>([]);

  // Answers & Test state
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scoreBreakdown, setScoreBreakdown] = useState<{
    total: number;
    part1: number;
    part2: number;
    part3: number;
    maxScore: number;
  }>({ total: 0, part1: 0, part2: 0, part3: 0, maxScore: 10 });

  // Countdown timer & start time
  const [timeLeft, setTimeLeft] = useState<number>(45 * 60);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Anti-cheat & Monitoring states
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const [violationLogs, setViolationLogs] = useState<ViolationLogItem[]>([]);
  const [showTabWarningModal, setShowTabWarningModal] = useState<boolean>(false);
  const [toastWarning, setToastWarning] = useState<string | null>(null);
  const [autoSubmittedReason, setAutoSubmittedReason] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // In-app Modal Confirmation (Replaces window.confirm/alert for iframe safety)
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [isSubmittingExam, setIsSubmittingExam] = useState<boolean>(false);

  // Trigger floating alert toast
  const triggerToastWarning = (msg: string) => {
    setToastWarning(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastWarning(null);
    }, 4500);
  };

  // 1. Fetch Session & Exam info
  useEffect(() => {
    const fetchSessionAndExam = async () => {
      if (!sessionId) {
        setError('Đường dẫn không hợp lệ (thiếu mã phiên thi).');
        setLoading(false);
        return;
      }

      try {
        let sessionData: any = null;
        let examInfo: any = null;

        // Try looking in examSessions
        const sessionDoc = await getDoc(doc(db, 'examSessions', sessionId));
        if (sessionDoc.exists()) {
          sessionData = { id: sessionDoc.id, ...sessionDoc.data() };
          setSession(sessionData);

          // Fetch student list if classId exists
          if (sessionData.classId) {
            try {
              // 1. Try fetching from classes collection
              const classDoc = await getDoc(doc(db, 'classes', sessionData.classId));
              if (classDoc.exists() && classDoc.data().students && Array.isArray(classDoc.data().students)) {
                setStudentList(classDoc.data().students.map((st: any, sIdx: number) => ({
                  key: `${st.id || sIdx}_${sIdx}`,
                  id: st.id || st.name,
                  name: st.name
                })));
              } else {
                const qStudents = query(collection(db, 'students'), where('classId', '==', sessionData.classId));
                const studentSnap = await getDocs(qStudents);
                setStudentList(studentSnap.docs.map((d, sIdx) => ({
                  key: `${d.id}_${sIdx}`,
                  id: d.id,
                  name: d.data().name
                })));
              }

              // Fetch submitted students
              const qSubmissions = query(collection(db, 'examSubmissions'), where('sessionId', '==', sessionData.id));
              const submissionSnap = await getDocs(qSubmissions);
              setSubmittedStudents(submissionSnap.docs.map(d => d.data().studentId || d.data().studentName).filter(Boolean));
            } catch (err) {
              console.warn('Lỗi lấy danh sách học sinh:', err);
            }
          }

          // Fetch exam data using sessionData.examId
          if (sessionData.examId) {
            const examDoc = await getDoc(doc(db, 'exams', sessionData.examId));
            if (examDoc.exists()) {
              examInfo = { id: examDoc.id, ...examDoc.data() };
            }
          }
        } else {
          // Check if sessionId is directly an examId in 'exams' collection
          const examDoc = await getDoc(doc(db, 'exams', sessionId));
          if (examDoc.exists()) {
            examInfo = { id: examDoc.id, ...examDoc.data() };
            sessionData = {
              id: sessionId,
              examId: sessionId,
              examTitle: examInfo.title || 'Đề kiểm tra trực tuyến',
              className: 'Trực tiếp'
            };
            setSession(sessionData);
          }
        }

        // Tải câu hỏi từ subcollection nếu đề thi có dung lượng lớn được chia chunk
        if (examInfo && (examInfo.hasSubcollectionQuestions || (!examInfo.questions && examInfo.id))) {
          try {
            const chunksSnap = await getDocs(collection(db, 'exams', examInfo.id, 'questionChunks'));
            if (!chunksSnap.empty) {
              const sortedDocs = chunksSnap.docs.sort((a, b) => (a.data().chunkIndex || 0) - (b.data().chunkIndex || 0));
              let loadedQuestions: any[] = [];
              sortedDocs.forEach((d) => {
                loadedQuestions = loadedQuestions.concat(d.data().questions || []);
              });
              if (loadedQuestions.length > 0) {
                examInfo.questions = loadedQuestions;
              }
            }
          } catch (subErr) {
            console.warn('Lỗi đọc questionChunks từ subcollection:', subErr);
          }
        }

        // If exam exists but has no questions, or session has no exam, provide fallback
        if (!examInfo || !examInfo.questions || examInfo.questions.length === 0) {
          const fallbackQuestions = DEFAULT_SAMPLE_QUESTIONS;
          const fallbackPoints = DEFAULT_SECTION_POINTS;

          examInfo = {
            id: examInfo?.id || sessionData?.id || 'demo_exam',
            title: sessionData?.examTitle || examInfo?.title || 'Đề thi trắc nghiệm Form 2025 (Vật lí 12)',
            durationMinutes: examInfo?.durationMinutes || 45,
            sectionPoints: examInfo?.sectionPoints || fallbackPoints,
            questions: fallbackQuestions
          };
        }

        if (!sessionData) {
          sessionData = {
            id: sessionId,
            examTitle: examInfo.title,
            className: 'Toàn trường'
          };
          setSession(sessionData);
        }

        let finalQuestions = examInfo.questions || DEFAULT_SAMPLE_QUESTIONS;
        if (sessionData?.shuffleQuestions) {
          const p1 = finalQuestions.filter((q: any) => q.section?.startsWith('Phần I') && !q.section?.startsWith('Phần II') && !q.section?.startsWith('Phần III'));
          const p2 = finalQuestions.filter((q: any) => q.section?.startsWith('Phần II') && !q.section?.startsWith('Phần III'));
          const p3 = finalQuestions.filter((q: any) => q.section?.startsWith('Phần III'));
          const shuffle = (arr: any[]) => [...arr].sort(() => Math.random() - 0.5);
          finalQuestions = [...shuffle(p1), ...shuffle(p2), ...shuffle(p3)];
        }
        examInfo = { ...examInfo, questions: finalQuestions };

        setExamData(examInfo);
        const finalDuration = sessionData?.durationMinutes || examInfo?.durationMinutes || 45;
        setTimeLeft(finalDuration * 60);
      } catch (err: any) {
        console.error('Lỗi khi tải dữ liệu bài thi:', err);
        const fallbackExam = {
          id: sessionId,
          title: 'Đề thi trắc nghiệm trực tuyến Form 2025',
          durationMinutes: 45,
          sectionPoints: DEFAULT_SECTION_POINTS,
          questions: DEFAULT_SAMPLE_QUESTIONS
        };
        setSession({ id: sessionId, examTitle: fallbackExam.title, className: 'Tự do' });
        setExamData(fallbackExam);
        setTimeLeft(45 * 60);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndExam();
  }, [sessionId]);

  // 2. Real-time Countdown Timer
  useEffect(() => {
    if (isJoined && !submitted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit('Hết giờ làm bài! Hệ thống tự động nộp bài thi của bạn.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isJoined, submitted, timeLeft]);

  // =========================================================
  // 3. GIÁM SÁT VI PHẠM: CHUYỂN TAB & RỜI KHỎI MÀN HÌNH
  // =========================================================
  useEffect(() => {
    if (!isJoined || submitted) return;

    let lastTriggerTime = 0;

    const handleVisibilityOrBlur = () => {
      // Khi tab bị ẩn hoặc người dùng nhấp ra ngoài cửa sổ
      if (document.hidden) {
        const now = Date.now();
        // Debounce 1.2s tránh kích hoạt đúp
        if (now - lastTriggerTime < 1200) return;
        lastTriggerTime = now;

        const timeStr = new Date().toLocaleTimeString('vi-VN');

        setTabSwitchCount((prevCount) => {
          const newCount = prevCount + 1;
          const newLog: ViolationLogItem = {
            time: timeStr,
            type: newCount >= 2 ? 'Chuyển tab lần 2 (Bị thu bài)' : 'Chuyển tab lần 1',
            details: `Thí sinh rời khỏi màn hình làm bài (Lần ${newCount})`
          };

          setViolationLogs((logs) => [...logs, newLog]);

          if (newCount === 1) {
            // Lần 1: Cảnh báo nghiêm khắc
            setShowTabWarningModal(true);
            triggerToastWarning('CẢNH BÁO: Bạn vừa chuyển tab/rời màn hình lần 1! Nếu tái phạm lần 2, hệ thống sẽ TỰ ĐỘNG THU BÀI!');
          } else if (newCount >= 2) {
            // Lần 2: TỰ ĐỘNG NỘP BÀI THI NGAY LẬP TỨC
            setShowTabWarningModal(false);
            setAutoSubmittedReason('Hệ thống đã tự động thu và nộp bài thi do bạn chuyển tab/rời màn hình lần thứ 2.');
            finishAndSaveExam(true, 'Vi phạm chuyển tab (Bị thu bài)', [...violationLogs, newLog]);
          }

          return newCount;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    window.addEventListener('blur', handleVisibilityOrBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
      window.removeEventListener('blur', handleVisibilityOrBlur);
    };
  }, [isJoined, submitted, violationLogs]);

  // =========================================================
  // 4. CHẶN CHỤP MÀN HÌNH, COPY DỮ LIỆU, CHUỘT PHẢI & PHÍM TẮT
  // =========================================================
  useEffect(() => {
    if (!isJoined || submitted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const timeStr = new Date().toLocaleTimeString('vi-VN');

      // 1. Phím PrintScreen
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(''); // Xóa clipboard
          }
        } catch (_) {}

        triggerToastWarning('NGHIÊM CẤM: Hành vi chụp màn hình (PrintScreen) bị khóa hoàn toàn trong phòng thi!');
        setViolationLogs((logs) => [
          ...logs,
          { time: timeStr, type: 'Cố gắng chụp màn hình', details: 'Nhấn phím PrintScreen' }
        ]);
        return false;
      }

      // 2. Phím tắt chụp màn hình Windows Snipping Tool (Win+Shift+S) / Mac (Cmd+Shift+3, Cmd+Shift+4)
      if (
        (e.shiftKey && (e.metaKey || e.ctrlKey) && ['s', 'S', '3', '4', 'x', 'X'].includes(e.key)) ||
        (e.altKey && e.key === 'PrintScreen')
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerToastWarning('NGHIÊM CẤM: Phím tắt chụp ảnh màn hình bị chặn tuyệt đối!');
        setViolationLogs((logs) => [
          ...logs,
          { time: timeStr, type: 'Cố gắng chụp màn hình', details: `Phím tắt chụp màn hình (${e.key})` }
        ]);
        return false;
      }

      // 3. Phím tắt Copy / Cut / Print / View Source: Ctrl+C, Ctrl+X, Ctrl+P, Ctrl+U
      if ((e.ctrlKey || e.metaKey) && ['c', 'C', 'x', 'X', 'p', 'P', 'u', 'U'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerToastWarning('NGHIÊM CẤM: Thao tác sao chép hoặc in ấn nội dung đề thi bị vô hiệu hóa!');
        setViolationLogs((logs) => [
          ...logs,
          { time: timeStr, type: 'Cố gắng sao chép đề', details: `Phím tắt Ctrl+${e.key.toUpperCase()}` }
        ]);
        return false;
      }

      // 4. Phím tắt mở DevTools: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerToastWarning('NGHIÊM CẤM: Mở công cụ lập trình (DevTools) bị cấm!');
        setViolationLogs((logs) => [
          ...logs,
          { time: timeStr, type: 'Mở công cụ kiểm tra', details: 'F12 / DevTools' }
        ]);
        return false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerToastWarning('NGHIÊM CẤM: Menu chuột phải bị khóa để đảm bảo tính minh bạch của kỳ thi!');
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setViolationLogs((logs) => [
        ...logs,
        { time: timeStr, type: 'Dùng chuột phải', details: 'Nhấp chuột phải trên giao diện thi' }
      ]);
    };

    const handleCopyCut = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerToastWarning('NGHIÊM CẤM: Không được sao chép câu hỏi hoặc nội dung bài thi!');
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setViolationLogs((logs) => [
        ...logs,
        { time: timeStr, type: 'Sao chép văn bản', details: 'Cố gắng copy nội dung câu hỏi' }
      ]);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyCut);
    document.addEventListener('cut', handleCopyCut);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyCut);
      document.removeEventListener('cut', handleCopyCut);
    };
  }, [isJoined, submitted]);

  // 5. Handle Join
  const handleJoinExam = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = selectedStudent
      ? studentList.find(s => s.id === selectedStudent)?.name || paramStudentName || ''
      : studentName.trim() || paramStudentName;

    if (!finalName) {
      setError('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    setStartTime(new Date());
    setError('');
    setIsJoined(true);
  };

  // 6. Handle Answers
  const handlePart1Answer = (qIndex: number, optionLetter: string) => {
    if (submitted) return;
    setAnswers(prev => ({
      ...prev,
      [`Phần I-${qIndex}`]: optionLetter
    }));
  };

  const handlePart2Answer = (qIndex: number, subLetter: string, val: 'Đúng' | 'Sai') => {
    if (submitted) return;
    setAnswers(prev => {
      const current = prev[`Phần II-${qIndex}`] || {};
      return {
        ...prev,
        [`Phần II-${qIndex}`]: {
          ...current,
          [subLetter]: val
        }
      };
    });
  };

  const handlePart3Answer = (qIndex: number, val: string) => {
    if (submitted) return;
    setAnswers(prev => ({
      ...prev,
      [`Phần III-${qIndex}`]: val
    }));
  };

  // 7. Score Calculation
  const calculateResult = () => {
    const pts: SectionPointsConfig = examData?.sectionPoints || DEFAULT_SECTION_POINTS;
    const questions: QuestionItem[] = examData?.questions || DEFAULT_SAMPLE_QUESTIONS;

    let part1Score = 0;
    let part2Score = 0;
    let part3Score = 0;

    const p1Questions = questions.filter(q => q.section?.startsWith('Phần I') && !q.section?.startsWith('Phần II') && !q.section?.startsWith('Phần III'));
    const p2Questions = questions.filter(q => q.section?.startsWith('Phần II') && !q.section?.startsWith('Phần III'));
    const p3Questions = questions.filter(q => q.section?.startsWith('Phần III'));

    // Part I scoring
    p1Questions.forEach((q, i) => {
      const userAns = answers[`Phần I-${i}`];
      if (userAns && q.correctAnswer && userAns.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase()) {
        part1Score += pts.p1;
      }
    });

    // Part II scoring
    p2Questions.forEach((q, i) => {
      const userAnsObj = answers[`Phần II-${i}`] || {};
      const answerStr = (q.correctAnswer || '').toLowerCase();

      let matchCount = 0;
      ['a', 'b', 'c', 'd'].forEach((subLetter) => {
        const studentChoice = userAnsObj[subLetter];
        if (!studentChoice) return;

        let expectedChoice = '';
        if (answerStr.includes(`${subLetter}) đúng`)) expectedChoice = 'Đúng';
        else if (answerStr.includes(`${subLetter}) sai`)) expectedChoice = 'Sai';

        if (studentChoice === expectedChoice) {
          matchCount++;
        }
      });

      if (matchCount === 1) part2Score += pts.p2.opt1;
      else if (matchCount === 2) part2Score += pts.p2.opt2;
      else if (matchCount === 3) part2Score += pts.p2.opt3;
      else if (matchCount === 4) part2Score += pts.p2.opt4;
    });

    // Part III scoring
    p3Questions.forEach((q, i) => {
      const userAns = (answers[`Phần III-${i}`] || '').trim();
      const correctAns = (q.correctAnswer || '').trim();

      if (userAns && correctAns) {
        const normUser = userAns.toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
        const normCorrect = correctAns.toLowerCase().replace(/\s+/g, ' ').replace(',', '.');

        const isMatch = normUser === normCorrect ||
          parseFloat(normUser) === parseFloat(normCorrect) ||
          normUser.replace(/[^\d.-]/g, '') === normCorrect.replace(/[^\d.-]/g, '');

        if (isMatch) {
          part3Score += pts.p3;
        }
      }
    });

    const total = Math.round((part1Score + part2Score + part3Score) * 100) / 100;
    const maxScore = Math.round((p1Questions.length * pts.p1 + p2Questions.length * pts.p2.opt4 + p3Questions.length * pts.p3) * 100) / 100;

    return {
      total,
      part1: Math.round(part1Score * 100) / 100,
      part2: Math.round(part2Score * 100) / 100,
      part3: Math.round(part3Score * 100) / 100,
      maxScore: maxScore > 0 ? maxScore : 10
    };
  };

  const handleSubmitExam = () => {
    if (submitted || isSubmittingExam) return;
    setShowSubmitConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmittingExam(true);
    setShowSubmitConfirmModal(false);
    try {
      await finishAndSaveExam(false, 'Đúng giờ');
    } finally {
      setIsSubmittingExam(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAutoSubmit = (reason: string) => {
    setAutoSubmittedReason(reason);
    finishAndSaveExam(false, 'Hết giờ (Tự động nộp)');
  };

  const finishAndSaveExam = async (isViolation: boolean = false, customStatus: string = 'Đúng giờ', customLogs?: ViolationLogItem[]) => {
    const res = calculateResult();
    setScoreBreakdown(res);
    setSubmitted(true);

    if (timerRef.current) clearInterval(timerRef.current);

    const questions: QuestionItem[] = examData?.questions || DEFAULT_SAMPLE_QUESTIONS;
    const part1Questions = questions.filter(q => q.section?.startsWith('Phần I') && !q.section?.startsWith('Phần II') && !q.section?.startsWith('Phần III'));
    const part2Questions = questions.filter(q => q.section?.startsWith('Phần II') && !q.section?.startsWith('Phần III'));
    const part3Questions = questions.filter(q => q.section?.startsWith('Phần III'));

    try {
      const now = new Date();
      const formatDT = (d: Date) => {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const day = d.getDate();
        const mon = d.getMonth() + 1;
        const yr = d.getFullYear();
        return `${hh}:${mm}:${ss} ${day}/${mon}/${yr}`;
      };

      // Part 1 breakdown
      let p1Correct = 0;
      part1Questions.forEach((q, i) => {
        const u = answers[`Phần I-${i}`];
        if (u && q.correctAnswer && u.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase()) {
          p1Correct++;
        }
      });
      const p1ScoreStr = `${p1Correct}/${part1Questions.length}=${res.part1}`;

      // Part 2 breakdown
      const p2Parts = part2Questions.map((q, i) => {
        const uObj = answers[`Phần II-${i}`] || {};
        const ansStr = (q.correctAnswer || '').toLowerCase();
        let matches = 0;
        ['a', 'b', 'c', 'd'].forEach((subLetter) => {
          let exp = '';
          if (ansStr.includes(`${subLetter}) đúng`)) exp = 'Đúng';
          else if (ansStr.includes(`${subLetter}) sai`)) exp = 'Sai';
          if (uObj[subLetter] === exp) matches++;
        });
        return `${matches}/4`;
      });
      const p2ScoreStr = p2Parts.length > 0 ? `${p2Parts.join('; ')}=${res.part2}` : '0';

      // Part 3 breakdown
      let p3Correct = 0;
      part3Questions.forEach((q, i) => {
        const u = (answers[`Phần III-${i}`] || '').trim();
        const c = (q.correctAnswer || '').trim();
        if (u && c) {
          const nu = u.toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
          const nc = c.toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
          if (nu === nc || parseFloat(nu) === parseFloat(nc) || nu.replace(/[^\d.-]/g, '') === nc.replace(/[^\d.-]/g, '')) {
            p3Correct++;
          }
        }
      });
      const p3ScoreStr = `${p3Correct}/${part3Questions.length}=${res.part3}`;

      const finalName = selectedStudent
        ? studentList.find(s => s.id === selectedStudent)?.name || paramStudentName || studentName.trim()
        : studentName.trim() || paramStudentName || 'Học sinh';

      const studentIndex = selectedStudent
        ? studentList.findIndex(s => s.id === selectedStudent) + 1
        : Math.floor(Math.random() * 40) + 1;

      const finalLogs = customLogs || violationLogs;

      const studId = selectedStudent || paramStudentId || null;
      const sbdStr = paramStudentId || selectedStudent || String(studentIndex).padStart(2, '0');

      await addDoc(collection(db, 'examSubmissions'), {
        sessionId: session?.id || sessionId,
        examTitle: session?.examTitle || examData?.title || 'Bài kiểm tra trực tuyến',
        studentName: finalName,
        studentId: studId,
        sbd: sbdStr,
        totalScore: res.total,
        p1: p1ScoreStr,
        p2: p2ScoreStr,
        p3: p3ScoreStr,
        p4: '0',
        startedAtStr: formatDT(startTime),
        submittedAtStr: formatDT(now),
        status: isViolation
          ? 'Bị thu bài (Vi phạm chuyển tab 2 lần)'
          : finalLogs.length > 0
          ? `Đúng giờ (${finalLogs.length} vi phạm)`
          : customStatus,
        violationCount: finalLogs.length,
        tabSwitchCount: isViolation ? 2 : tabSwitchCount,
        violationLogs: finalLogs,
        answers: answers,
        score: res.total,
        scoreBreakdown: res,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Không thể lưu kết quả nộp bài lên Firestore:', e);
    }
  };

  const resetExam = () => {
    setShowResetConfirmModal(true);
  };

  const doResetExam = () => {
    setAnswers({});
    setSubmitted(false);
    setTabSwitchCount(0);
    setViolationLogs([]);
    setAutoSubmittedReason(null);
    setTimeLeft((examData?.durationMinutes || 45) * 60);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isLowTime = timeLeft <= 300;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-gray-700">Đang tải đề thi trực tuyến...</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error && !examData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-4 border border-rose-100">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Không thể mở bài thi</h2>
          <p className="text-xs text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 bg-teal-700 text-white font-medium rounded-xl text-xs hover:bg-teal-800 transition-colors cursor-pointer"
          >
            Quay lại trang chính
          </button>
        </div>
      </div>
    );
  }

  // Helper định dạng ngày tháng hiển thị
  const formatExamDate = (dateVal?: any, fallback: string = 'Theo lịch mở đề') => {
    if (!dateVal) return fallback;
    if (typeof dateVal === 'string') {
      if (dateVal.includes('/') || (dateVal.includes(':') && !dateVal.includes('T'))) {
        return dateVal;
      }
      try {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          return `${hours}:${minutes} ${day}/${month}/${year}`;
        }
      } catch {
        return dateVal;
      }
    }
    if (dateVal?.toDate && typeof dateVal.toDate === 'function') {
      try {
        const d = dateVal.toDate();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${hours}:${minutes} ${day}/${month}/${year}`;
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  const sessionStartDate = formatExamDate(
    session?.startDateStr || session?.startDateIso || session?.startDate || session?.assignedAt || examData?.startDateStr,
    '14:50:00 13/4/2026'
  );

  const sessionEndDate = formatExamDate(
    session?.endDateStr || session?.endDateIso || session?.endDate || session?.dueDate || examData?.endDateStr,
    '14:50:00 10/6/2026'
  );

  // Screen 1: Join Screen
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-linear-to-br from-teal-900 via-teal-800 to-emerald-950 flex items-center justify-center p-4 font-sans select-none">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-7 md:p-8 border border-teal-100 space-y-5">
          <div className="text-center space-y-1.5">
            <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto border border-teal-100 shadow-xs">
              <BookOpen className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Phòng Thi Trực Tuyến
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Chuẩn cấu trúc Đề thi THPT Form 2025 (3 Phần)
            </p>
          </div>

          {/* HỘP QUY CHẾ THI & CẢNH BÁO GIÁM SÁT NGHIÊM NGẶT */}
          <div className="p-3.5 bg-rose-50/90 border border-rose-200 rounded-2xl text-[11px] text-rose-950 space-y-2 shadow-2xs">
            <div className="font-bold flex items-center gap-1.5 text-rose-800 text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>QUY CHẾ GIÁM SÁT THI TRỰC TUYẾN</span>
            </div>
            <ul className="space-y-1.5 pl-4 list-disc text-rose-900 leading-relaxed">
              <li>
                <strong className="text-rose-950 font-bold">KHÔNG ĐƯỢC CHUYỂN TAB:</strong> Rời màn hình lần 1 hệ thống sẽ cảnh báo. Chuyển tab lần 2 hệ thống sẽ <strong>TỰ ĐỘNG THU VÀ NỘP BÀI</strong> ngay lập tức!
              </li>
              <li>
                <strong className="text-rose-950 font-bold">CHỐNG CHỤP MÀN HÌNH & COPY:</strong> Phím PrintScreen, phím tắt chụp ảnh, chuột phải và thao tác sao chép dữ liệu bị khóa hoàn toàn.
              </li>
              <li>
                <strong className="text-rose-950 font-bold">GHI NHẬN VI PHẠM:</strong> Mọi thao tác vi phạm đều được lưu trữ và đính kèm vào bảng điểm gửi giáo viên.
              </li>
            </ul>
          </div>

          <div className="p-3.5 bg-teal-50/70 rounded-2xl border border-teal-100 space-y-2 text-xs">
            <div className="flex justify-between items-center text-teal-950 font-bold">
              <span>Đề thi:</span>
              <span className="text-right truncate max-w-[200px]" title={session?.examTitle || examData?.title}>
                {session?.examTitle || examData?.title}
              </span>
            </div>
            <div className="flex justify-between items-center text-teal-800">
              <span>Thời gian làm bài:</span>
              <span className="font-bold">{examData?.durationMinutes || session?.durationMinutes || 45} phút</span>
            </div>
            <div className="flex justify-between items-center text-teal-800">
              <span>Số lượng câu hỏi:</span>
              <span className="font-bold">28 câu (18 trắc nghiệm - 4 đúng/sai - 6 ngắn)</span>
            </div>
            <div className="flex justify-between items-center text-teal-800">
              <span>Lớp học:</span>
              <span className="font-semibold">{session?.className || 'Toàn trường'}</span>
            </div>
            {/* HIỂN THỊ NGÀY LÀM BÀI VÀ NGÀY KẾT THÚC */}
            <div className="pt-2 border-t border-teal-200/70 space-y-1.5">
              <div className="flex justify-between items-center text-teal-900">
                <span className="flex items-center gap-1.5 font-bold text-teal-800">
                  <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Ngày làm bài:</span>
                </span>
                <span className="font-bold font-mono text-teal-950 bg-teal-100/70 px-2 py-0.5 rounded border border-teal-200">
                  {sessionStartDate}
                </span>
              </div>
              <div className="flex justify-between items-center text-rose-900">
                <span className="flex items-center gap-1.5 font-bold text-rose-800">
                  <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Ngày kết thúc:</span>
                </span>
                <span className="font-bold font-mono text-rose-950 bg-rose-100/70 px-2 py-0.5 rounded border border-rose-200">
                  {sessionEndDate}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleJoinExam} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {paramStudentName ? (
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-teal-700 font-semibold">Thí sinh làm bài thi:</div>
                  <div className="text-sm font-bold text-teal-900">{paramStudentName}</div>
                  {paramStudentId && (
                    <div className="text-[11px] text-teal-600 font-mono">Mã / SBD: {paramStudentId}</div>
                  )}
                </div>
              </div>
            ) : studentList.length > 0 ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-teal-600" />
                  <span>Chọn tên học sinh trong danh sách:</span>
                </label>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50">
                  {studentList
                    .filter((st) => !submittedStudents.includes(st.id))
                    .map((st, sIdx) => (
                      <button
                        key={st.key || `${st.id}-${sIdx}`}
                        type="button"
                        onClick={() => setSelectedStudent(st.id)}
                        className={`w-full text-left px-4 py-3 text-xs font-medium transition-colors ${
                          selectedStudent === st.id
                            ? 'bg-teal-600 text-white'
                            : 'hover:bg-teal-50 text-gray-700'
                        }`}
                      >
                        {st.name}
                      </button>
                    ))}
                  {studentList.filter((st) => !submittedStudents.includes(st.id)).length === 0 && (
                    <div className="p-4 text-xs text-gray-500 text-center">Tất cả học sinh đã nộp bài.</div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-teal-600" />
                  <span>Họ và tên học sinh:</span>
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs shadow-md shadow-teal-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>Tôi đã hiểu quy chế - Vào làm bài thi</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Screen 2: Exam Taking / Result Interface
  const questions: QuestionItem[] = examData?.questions || DEFAULT_SAMPLE_QUESTIONS;
  const pts: SectionPointsConfig = examData?.sectionPoints || DEFAULT_SECTION_POINTS;

  const part1Questions = questions.filter(q => q.section?.startsWith('Phần I') && !q.section?.startsWith('Phần II') && !q.section?.startsWith('Phần III'));
  const part2Questions = questions.filter(q => q.section?.startsWith('Phần II') && !q.section?.startsWith('Phần III'));
  const part3Questions = questions.filter(q => q.section?.startsWith('Phần III'));

  const candidateName = selectedStudent
    ? studentList.find(s => s.id === selectedStudent)?.name || 'Học sinh'
    : studentName.trim() || 'Học sinh';

  // Count answered questions
  const answeredCount = Object.keys(answers).filter(k => {
    const v = answers[k];
    if (!v) return false;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return typeof v === 'string' && v.trim().length > 0;
  }).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24 select-none relative">
      {/* ========================================================= */}
      {/* MODAL XÁC NHẬN NỘP BÀI THI (HOÀN TOÀN TƯƠNG THÍCH IFRAME)   */}
      {/* ========================================================= */}
      {showSubmitConfirmModal && !submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận nộp bài thi</h3>
                <p className="text-xs text-slate-500">Kiểm tra thông tin trước khi hoàn thành</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Thí sinh:</span>
                <span className="font-bold text-slate-900">{candidateName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Thời gian còn lại:</span>
                <span className="font-mono font-bold text-teal-800">{formatTime(timeLeft)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tiến độ làm bài:</span>
                <span className={`font-bold ${unansweredCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {answeredCount} / {questions.length} câu
                </span>
              </div>
            </div>

            {unansweredCount > 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Bạn còn <strong>{unansweredCount} câu</strong> chưa trả lời. Bạn có chắc chắn muốn nộp bài ngay bây giờ không?
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Bạn đã hoàn thành đủ {questions.length} câu hỏi. Sau khi bấm nộp bài, hệ thống sẽ tính điểm tự động và lưu vào bảng điểm cá nhân của bạn.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(false)}
                disabled={isSubmittingExam}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmittingExam}
                className="px-5 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSubmittingExam ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang nộp bài...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nộp bài ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL XÁC NHẬN LÀM LẠI BÀI THI                            */}
      {/* ========================================================= */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Làm lại bài thi?</h3>
                <p className="text-[11px] text-slate-500">Xóa bài làm và bắt đầu lại từ đầu</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn làm lại bài thi từ đầu không? Toàn bộ đáp án đã chọn sẽ được xóa và thời gian sẽ được đếm lại.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirmModal(false);
                  doResetExam();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-all"
              >
                Làm lại từ đầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FLOATING WARNING TOAST (KHI CỐ GẮNG CHỤP MÀN HÌNH HOẶC COPY) */}
      {/* ========================================================= */}
      {toastWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] bg-rose-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-rose-400 animate-in fade-in slide-in-from-top-4 duration-200">
          <AlertTriangle className="w-6 h-6 text-yellow-300 shrink-0 animate-bounce" />
          <div className="flex-1 text-xs font-bold leading-relaxed">
            {toastWarning}
          </div>
          <button
            onClick={() => setToastWarning(null)}
            className="p-1 hover:bg-rose-700 rounded-lg text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CẢNH BÁO VI PHẠM CHUYỂN TAB LẦN 1                    */}
      {/* ========================================================= */}
      {showTabWarningModal && !submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 border-2 border-rose-500 shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto border-4 border-rose-200 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-rose-700 tracking-tight uppercase">
              Cảnh báo vi phạm lần 1!
            </h3>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 text-left space-y-2 leading-relaxed">
              <p className="font-bold">
                ⚠️ Hệ thống phát hiện bạn vừa chuyển tab hoặc rời khỏi màn hình làm bài thi!
              </p>
              <p className="text-[11px] text-rose-800">
                Thao tác này đã được hệ thống ghi nhận vào lịch sử làm bài và chuyển tới giáo viên.
              </p>
              <div className="p-2.5 bg-white rounded-xl border border-rose-300 font-bold text-rose-900 text-center text-xs">
                🚨 NẾU RỜI MÀN HÌNH LẦN 2, BÀI THI SẼ BỊ TỰ ĐỘNG THU & NỘP NGAY LẬP TỨC!
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTabWarningModal(false)}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/30 transition-all cursor-pointer active:scale-98"
            >
              Tôi cam kết không chuyển tab nữa (Tiếp tục làm bài)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FIXED TOP HEADER: TIÊU ĐỀ, ĐỒNG HỒ & TRẠNG THÁI GIÁM SÁT   */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs px-4 md:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Thông tin đề thi & Giám sát */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-bold text-gray-900 truncate">
                {session?.examTitle || examData?.title}
              </h1>
              {!submitted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                  <Lock className="w-3 h-3 text-teal-600" />
                  <span>Giám sát bật</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500 mt-0.5">
              <span className="font-medium text-teal-800">
                Thí sinh: <span className="font-bold text-gray-800">{candidateName}</span>
              </span>
              <span>•</span>
              <span>{questions.length} câu hỏi</span>

              {/* HIỂN THỊ NGÀY LÀM BÀI & NGÀY KẾT THÚC TRÊN HEADER ĐỀ THI */}
              <span className="hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1 text-teal-900 font-medium bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                <Calendar className="w-3 h-3 text-teal-600" />
                <span>Ngày làm bài: <strong className="font-mono text-teal-950">{sessionStartDate}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1 text-rose-900 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                <Clock className="w-3 h-3 text-rose-600" />
                <span>Ngày kết thúc: <strong className="font-mono text-rose-950">{sessionEndDate}</strong></span>
              </span>

              {!submitted && (
                <>
                  <span>•</span>
                  <span className={`font-semibold ${tabSwitchCount > 0 ? 'text-rose-600 font-bold' : 'text-gray-500'}`}>
                    Rời tab: {tabSwitchCount}/2
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ĐỒNG HỒ ĐẾM NGƯỢC THỜI GIAN THỰC */}
          <div className="flex items-center gap-3 shrink-0">
            {!submitted ? (
              <div
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-mono font-bold text-xs md:text-sm shadow-2xs transition-all ${
                  isLowTime
                    ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse ring-2 ring-rose-200'
                    : 'bg-teal-50 text-teal-900 border-teal-200'
                }`}
                title="Thời gian làm bài còn lại"
              >
                <Clock className={`w-4 h-4 ${isLowTime ? 'text-rose-600' : 'text-teal-700'}`} />
                <span>{formatTime(timeLeft)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Đã nộp bài</span>
              </div>
            )}

            {!submitted ? (
              <button
                type="button"
                onClick={handleSubmitExam}
                disabled={isSubmittingExam}
                className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingExam ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang nộp...</span>
                  </>
                ) : (
                  <span>Nộp bài</span>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/student-dashboard?studentId=${encodeURIComponent(selectedStudent || paramStudentId || candidateName)}`)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm transition-all"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Về Bảng điểm</span>
                </button>
                <button
                  type="button"
                  onClick={resetExam}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs cursor-pointer transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Làm lại</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dải cảnh báo quy chế thi ghim sát dưới header khi đang thi */}
        {!submitted && (
          <div className="max-w-5xl mx-auto mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600 font-medium">
            <span className="flex items-center gap-1.5 text-rose-700">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Chống gian lận: Tuyệt đối không chuyển tab, không chụp màn hình, không copy.</span>
            </span>
            <span className="hidden sm:inline font-bold text-amber-700">
              Vi phạm chuyển tab lần 2 sẽ tự động nộp bài!
            </span>
          </div>
        )}
      </header>

      {/* ========================================================= */}
      {/* THÔNG BÁO BỊ THU BÀI TỰ ĐỘNG NẾU VI PHẠM LẦN 2           */}
      {/* ========================================================= */}
      {autoSubmittedReason && (
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl flex items-center gap-3.5 text-rose-900 shadow-md">
            <ShieldAlert className="w-8 h-8 text-rose-600 shrink-0" />
            <div className="text-xs leading-relaxed">
              <div className="font-bold text-sm text-rose-800">
                BÀI THI BỊ TỰ ĐỘNG THU DO VI PHẠM QUY CHẾ THI!
              </div>
              <div>{autoSubmittedReason} Toàn bộ vi phạm đã được ghi nhận vào báo cáo của giáo viên.</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BẢNG KẾT QUẢ ĐIỂM SAU KHI NỘP BÀI (NẾU ĐÃ NỘP)             */}
      {/* ========================================================= */}
      {submitted && (
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <div className="bg-linear-to-br from-emerald-600 to-teal-800 text-white rounded-3xl p-6 shadow-xl border border-emerald-400/30">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-bold mb-1 backdrop-blur-xs">
                  <Award className="w-4 h-4" />
                  <span>KẾT QUẢ LÀM BÀI TRỰC TUYẾN</span>
                </div>
                <h2 className="text-2xl font-black">
                  Chúc mừng bạn đã hoàn thành bài thi!
                </h2>
                <p className="text-xs text-emerald-100">
                  Thí sinh: <span className="font-bold text-white">{candidateName}</span> — Điểm số đã được lưu vào bảng điểm cá nhân của bạn.
                </p>
                <div className="text-[11px] text-emerald-200 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>📅 Ngày làm bài: <strong className="text-white font-mono">{sessionStartDate}</strong></span>
                  <span>⏳ Ngày kết thúc: <strong className="text-white font-mono">{sessionEndDate}</strong></span>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/student-dashboard?studentId=${encodeURIComponent(selectedStudent || paramStudentId || candidateName)}`)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-950 hover:bg-emerald-50 rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <Award className="w-4 h-4 text-emerald-700" />
                    <span>Quay lại Bảng điều khiển Học sinh (Xem bảng điểm)</span>
                    <ChevronRight className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              </div>

              {/* Khối Điểm số tổng */}
              <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-xs">
                <div className="text-center">
                  <div className="text-4xl md:text-5xl font-black tracking-tight text-yellow-300">
                    {scoreBreakdown.total}
                  </div>
                  <div className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider mt-0.5">
                    / {scoreBreakdown.maxScore} ĐIỂM
                  </div>
                </div>

                <div className="border-l border-white/20 pl-4 space-y-1 text-[11px]">
                  <div>Phần I: <span className="font-bold">{scoreBreakdown.part1}</span> đ</div>
                  <div>Phần II: <span className="font-bold">{scoreBreakdown.part2}</span> đ</div>
                  <div>Phần III: <span className="font-bold">{scoreBreakdown.part3}</span> đ</div>
                </div>
              </div>
            </div>

            {/* Thống kê vi phạm nếu có */}
            {violationLogs.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/20 text-xs text-yellow-200 flex items-center justify-between">
                <span>Số lần ghi nhận thao tác vi phạm / cảnh báo: <strong className="text-white">{violationLogs.length} lần</strong></span>
                <span className="text-[11px] italic text-emerald-100">Đã đồng bộ lên hệ thống giáo viên</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* NỘI DUNG ĐỀ THI: TIÊU ĐỀ CHÍNH THỨC & 3 PHẦN             */}
      {/* ========================================================= */}
      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-8 select-none">
        {/* KHUNG THÔNG TIN CHÍNH THỨC CỦA ĐỀ THI - HIỂN THỊ TRÊN ĐỀ */}
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-teal-200/90 shadow-xs relative overflow-hidden space-y-4">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-teal-700 via-emerald-500 to-teal-800" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                  ĐỀ THI TRỰC TUYẾN CHUẨN FORM 2025
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Lớp: {session?.className || 'Toàn trường'}
                </span>
              </div>
              <h1 className="text-base md:text-xl font-black text-gray-900 tracking-tight">
                {session?.examTitle || examData?.title || 'Đề kiểm tra trắc nghiệm'}
              </h1>
              <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                <span>Thời gian làm bài: <strong className="text-gray-800">{examData?.durationMinutes || session?.durationMinutes || 45} phút</strong></span>
                <span>•</span>
                <span>Tổng số: <strong className="text-gray-800">{questions.length} câu</strong> (3 Phần)</span>
              </div>
            </div>

            {/* Thẻ Thí sinh */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs w-full sm:w-auto min-w-[220px]">
              <div className="text-[11px] text-gray-500 font-medium">Thí sinh làm bài:</div>
              <div className="font-bold text-sm text-gray-900 mt-0.5">{candidateName}</div>
              <div className="text-[11px] text-gray-600 flex justify-between mt-1 pt-1 border-t border-slate-200">
                <span>Mã / SBD: <strong className="text-teal-700 font-mono">{paramStudentId || selectedStudent || 'SBD2025'}</strong></span>
                <span>Trạng thái: <strong className={submitted ? 'text-emerald-700' : 'text-teal-700'}>{submitted ? 'Đã nộp bài' : 'Đang làm bài'}</strong></span>
              </div>
            </div>
          </div>

          {/* DẢI HIỂN THỊ NGÀY LÀM BÀI & NGÀY KẾT THÚC RÕ RÀNG TRÊN ĐỀ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-teal-800 uppercase tracking-tight">Ngày làm bài</div>
                <div className="text-xs md:text-sm font-extrabold text-teal-950 font-mono truncate mt-0.5">
                  {sessionStartDate}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-rose-800 uppercase tracking-tight">Ngày kết thúc</div>
                <div className="text-xs md:text-sm font-extrabold text-rose-950 font-mono truncate mt-0.5">
                  {sessionEndDate}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Quy chế giám sát</div>
                <div className="text-xs font-semibold text-slate-800 truncate mt-0.5">
                  Khóa chụp ảnh & chống gian lận
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PHẦN I */}
        {part1Questions.length > 0 && (
          <section className="space-y-4">
            <div className="bg-teal-900 text-white p-4 rounded-2xl shadow-sm space-y-1">
              <h2 className="text-xs md:text-sm font-bold leading-relaxed">
                PHẦN I. Câu hỏi trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu {part1Questions.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.
              </h2>
              <div className="text-[11px] text-teal-200">
                Cấu hình: Mỗi câu đúng được <span className="font-bold text-yellow-300">{pts.p1} điểm</span>.
              </div>
            </div>

            <div className="space-y-4">
              {part1Questions.map((q, idx) => {
                const userChoice = answers[`Phần I-${idx}`];
                const isCorrect = submitted && userChoice === q.correctAnswer;
                const isWrong = submitted && userChoice && userChoice !== q.correctAnswer;

                return (
                  <div
                    key={idx}
                    className={`bg-white p-5 rounded-2xl border shadow-2xs space-y-3 transition-all ${
                      submitted
                        ? isCorrect
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : isWrong
                          ? 'border-rose-300 bg-rose-50/20'
                          : 'border-gray-200'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[11px] font-bold border border-teal-200">
                          Câu {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-teal-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ({pts.p1} điểm)
                        </span>
                      </div>

                      {submitted && (
                        <div className="text-xs font-bold">
                          {isCorrect && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                              <Check className="w-3.5 h-3.5" /> +{pts.p1} đ
                            </span>
                          )}
                          {isWrong && (
                            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                              <X className="w-3.5 h-3.5" /> 0 đ
                            </span>
                          )}
                          {!userChoice && (
                            <span className="text-gray-500 italic text-[11px]">Chưa trả lời</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="font-bold text-gray-900 text-sm leading-relaxed">
                      <MathText text={q.questionText} />
                    </div>

                    {q.imageUrl && (
                      <div className="my-3 flex justify-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <img src={q.imageUrl} alt="Hình minh họa" className="max-h-60 rounded-lg object-contain pointer-events-none" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const letter = ['A', 'B', 'C', 'D'][oIdx] || String(oIdx + 1);
                        const isSelected = userChoice === letter;
                        const isThisCorrect = submitted && letter === q.correctAnswer;

                        return (
                          <div
                            key={oIdx}
                            onClick={() => handlePart1Answer(idx, letter)}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-teal-50 border-teal-500 font-semibold text-teal-950 shadow-2xs'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                            } ${
                              submitted
                                ? isThisCorrect
                                  ? 'bg-emerald-100 border-emerald-500 text-emerald-950 ring-2 ring-emerald-300 font-bold'
                                  : isSelected && !isThisCorrect
                                  ? 'bg-rose-100 border-rose-400 text-rose-950 line-through'
                                  : ''
                                : ''
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                isSelected
                                  ? 'bg-teal-700 text-white'
                                  : 'bg-gray-100 text-gray-600'
                              } ${
                                submitted && isThisCorrect ? 'bg-emerald-600 text-white' : ''
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="flex-1">
                              <MathText text={opt} />
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {submitted && (
                      <div className="mt-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
                        <div className="font-bold text-gray-800 flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4 text-teal-600" />
                          <span>Đáp án đúng: <span className="text-emerald-700 font-mono font-bold text-sm">{q.correctAnswer}</span></span>
                        </div>
                        {q.solution && (
                          <div className="text-gray-600 leading-relaxed text-[11px] pt-1 border-t border-gray-200">
                            <span className="font-semibold text-gray-800">Lời giải chi tiết: </span>
                            <MathText text={q.solution} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* PHẦN II */}
        {part2Questions.length > 0 && (
          <section className="space-y-4">
            <div className="bg-teal-900 text-white p-4 rounded-2xl shadow-sm space-y-1">
              <h2 className="text-xs md:text-sm font-bold leading-relaxed">
                PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu {part2Questions.length}. Trong mỗi ý a, b, c, d ở mỗi câu, thí sinh chọn đúng hoặc sai.
              </h2>
              <div className="text-[11px] text-teal-200">
                Cấu hình thang điểm: Đúng 1 ý: <span className="font-bold text-yellow-300">{pts.p2.opt1}đ</span>, Đúng 2 ý: <span className="font-bold text-yellow-300">{pts.p2.opt2}đ</span>, Đúng 3 ý: <span className="font-bold text-yellow-300">{pts.p2.opt3}đ</span>, Đúng 4 ý: <span className="font-bold text-yellow-300">{pts.p2.opt4}đ</span>.
              </div>
            </div>

            <div className="space-y-4">
              {part2Questions.map((q, idx) => {
                const userChoices = answers[`Phần II-${idx}`] || {};
                const answerStr = (q.correctAnswer || '').toLowerCase();

                let matchCount = 0;
                ['a', 'b', 'c', 'd'].forEach((subLetter) => {
                  const studentChoice = userChoices[subLetter];
                  let expectedChoice = '';
                  if (answerStr.includes(`${subLetter}) đúng`)) expectedChoice = 'Đúng';
                  else if (answerStr.includes(`${subLetter}) sai`)) expectedChoice = 'Sai';
                  if (studentChoice && studentChoice === expectedChoice) matchCount++;
                });

                let earnedScore = 0;
                if (matchCount === 1) earnedScore = pts.p2.opt1;
                else if (matchCount === 2) earnedScore = pts.p2.opt2;
                else if (matchCount === 3) earnedScore = pts.p2.opt3;
                else if (matchCount === 4) earnedScore = pts.p2.opt4;

                return (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[11px] font-bold border border-teal-200">
                          Câu {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-teal-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          (Tối đa {pts.p2.opt4} điểm: 1 ý {pts.p2.opt1}đ, 2 ý {pts.p2.opt2}đ, 3 ý {pts.p2.opt3}đ, 4 ý {pts.p2.opt4}đ)
                        </span>
                      </div>

                      {submitted && (
                        <div className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                          Đúng {matchCount}/4 ý: +{earnedScore} đ
                        </div>
                      )}
                    </div>

                    <div className="font-bold text-gray-900 text-sm leading-relaxed">
                      <MathText text={q.questionText} />
                    </div>

                    {q.imageUrl && (
                      <div className="my-3 flex justify-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <img src={q.imageUrl} alt="Hình minh họa" className="max-h-60 rounded-lg object-contain pointer-events-none" />
                      </div>
                    )}

                    <div className="space-y-2.5 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const subLetter = ['a', 'b', 'c', 'd'][oIdx];
                        const currentChoice = userChoices[subLetter];

                        let expected = '';
                        if (answerStr.includes(`${subLetter}) đúng`)) expected = 'Đúng';
                        else if (answerStr.includes(`${subLetter}) sai`)) expected = 'Sai';

                        const isMatch = submitted && currentChoice === expected;
                        const isMismatch = submitted && currentChoice && currentChoice !== expected;

                        return (
                          <div
                            key={oIdx}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border text-xs transition-all ${
                              submitted
                                ? isMatch
                                  ? 'bg-emerald-50/70 border-emerald-300'
                                  : isMismatch
                                  ? 'bg-rose-50/70 border-rose-300'
                                  : 'bg-gray-50 border-gray-200'
                                : 'bg-gray-50/60 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex-1 text-gray-800 font-medium">
                              <MathText text={opt} />
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                disabled={submitted}
                                onClick={() => handlePart2Answer(idx, subLetter, 'Đúng')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  currentChoice === 'Đúng'
                                    ? 'bg-teal-700 text-white ring-2 ring-teal-300 shadow-xs'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                                } ${
                                  submitted && expected === 'Đúng' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : ''
                                }`}
                              >
                                Đúng
                              </button>
                              <button
                                type="button"
                                disabled={submitted}
                                onClick={() => handlePart2Answer(idx, subLetter, 'Sai')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  currentChoice === 'Sai'
                                    ? 'bg-rose-600 text-white ring-2 ring-rose-300 shadow-xs'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                                } ${
                                  submitted && expected === 'Sai' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : ''
                                }`}
                              >
                                Sai
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {submitted && (
                      <div className="mt-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
                        <div className="font-bold text-gray-800">
                          Đáp án đúng: <span className="text-emerald-700 font-bold">{q.correctAnswer}</span>
                        </div>
                        {q.solution && (
                          <div className="text-gray-600 leading-relaxed text-[11px] pt-1 border-t border-gray-200">
                            <span className="font-semibold text-gray-800">Lời giải chi tiết: </span>
                            <MathText text={q.solution} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* PHẦN III */}
        {part3Questions.length > 0 && (
          <section className="space-y-4">
            <div className="bg-teal-900 text-white p-4 rounded-2xl shadow-sm space-y-1">
              <h2 className="text-xs md:text-sm font-bold leading-relaxed">
                PHẦN III. Câu trắc nghiệm yêu cầu trả lời ngắn. Thí sinh trả lời từ câu 1 đến câu {part3Questions.length}.
              </h2>
              <div className="text-[11px] text-teal-200">
                Cấu hình: Mỗi câu trả lời đúng được <span className="font-bold text-yellow-300">{pts.p3} điểm</span>.
              </div>
            </div>

            <div className="space-y-4">
              {part3Questions.map((q, idx) => {
                const userAns = answers[`Phần III-${idx}`] || '';
                const correctAns = (q.correctAnswer || '').trim();

                let isMatch = false;
                if (submitted && userAns && correctAns) {
                  const normUser = userAns.toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
                  const normCorrect = correctAns.toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
                  isMatch = normUser === normCorrect ||
                    parseFloat(normUser) === parseFloat(normCorrect) ||
                    normUser.replace(/[^\d.-]/g, '') === normCorrect.replace(/[^\d.-]/g, '');
                }

                return (
                  <div
                    key={idx}
                    className={`bg-white p-5 rounded-2xl border shadow-2xs space-y-3 transition-all ${
                      submitted
                        ? isMatch
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : userAns
                          ? 'border-rose-300 bg-rose-50/20'
                          : 'border-gray-200'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[11px] font-bold border border-teal-200">
                          Câu {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-teal-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ({pts.p3} điểm)
                        </span>
                      </div>

                      {submitted && (
                        <div className="text-xs font-bold">
                          {isMatch ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                              <Check className="w-3.5 h-3.5" /> +{pts.p3} đ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                              <X className="w-3.5 h-3.5" /> 0 đ
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="font-bold text-gray-900 text-sm leading-relaxed">
                      <MathText text={q.questionText} />
                    </div>

                    {q.imageUrl && (
                      <div className="my-3 flex justify-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <img src={q.imageUrl} alt="Hình minh họa" className="max-h-60 rounded-lg object-contain pointer-events-none" />
                      </div>
                    )}

                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Câu trả lời ngắn của bạn:
                      </label>
                      <input
                        type="text"
                        disabled={submitted}
                        value={userAns}
                        onChange={(e) => handlePart3Answer(idx, e.target.value)}
                        placeholder="Nhập đáp án (ví dụ số hoặc từ ngữ)..."
                        className={`w-full max-w-md px-3.5 py-2.5 rounded-xl border text-xs font-bold focus:outline-none transition-all ${
                          submitted
                            ? isMatch
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-mono'
                              : 'bg-rose-50 border-rose-400 text-rose-950 font-mono'
                            : 'bg-white border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 text-gray-900 font-mono'
                        }`}
                      />
                    </div>

                    {submitted && (
                      <div className="mt-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
                        <div className="font-bold text-gray-800">
                          Đáp án chuẩn: <span className="text-emerald-700 font-mono font-bold text-sm">{q.correctAnswer}</span>
                        </div>
                        {q.solution && (
                          <div className="text-gray-600 leading-relaxed text-[11px] pt-1 border-t border-gray-200">
                            <span className="font-semibold text-gray-800">Lời giải chi tiết: </span>
                            <MathText text={q.solution} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Nút nộp bài */}
        <div className="pt-6 border-t border-gray-200 flex justify-center">
          {!submitted ? (
            <button
              type="button"
              onClick={handleSubmitExam}
              disabled={isSubmittingExam}
              className="px-8 py-3.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-2xl text-sm shadow-md shadow-emerald-600/30 cursor-pointer transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmittingExam ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang nộp bài...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Nộp bài thi</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-6 py-3 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Xem lại điểm tổng kết ở đầu trang</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/student-dashboard?studentId=${encodeURIComponent(selectedStudent || paramStudentId || candidateName)}`)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>Trở về Bảng điểm học sinh</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
