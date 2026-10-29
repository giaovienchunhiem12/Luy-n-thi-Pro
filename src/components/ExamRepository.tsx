import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import mammoth from 'mammoth';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  addDoc,
  getDocs,
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
  FolderPlus,
  FilePlus,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  FileText,
  Menu,
  Trash2,
  Send,
  Eye,
  Folder,
  CheckCircle2,
  AlertCircle,
  X,
  UploadCloud,
  Download,
  ExternalLink,
  Edit3,
  Plus,
  Check,
  Image as ImageIcon,
  Layers
} from 'lucide-react';
import { MathText } from './MathText';
import { MathPreview } from './MathPreview';
import { sanitizeMathContent, convertOmmlToLatex } from '../utils/mathSanitizer';
import { parseWordFile, parsePdfFileToText } from '../utils/wordParser';
import { compressExamQuestions, estimateObjectSizeBytes } from '../utils/imageCompressor';
// @ts-ignore
import JSZip from 'jszip';
import { DEFAULT_SAMPLE_QUESTIONS, DEFAULT_SECTION_POINTS } from '../data/sampleQuestions';

export interface ExamItem {
  id: string;
  title: string;
  teacherId: string;
  folderId?: string;
  createdAtStr: string;
  questionCountStr: string;
  durationMinutes: number;
  isRecommended: boolean;
  hasSubcollectionQuestions?: boolean;
  subject?: string;
  grade?: string;
  assignedClassNames?: string[];
  questions?: {
    imageUrl?: string;
    questionText: string;
    questionTextAfter?: string;
    options: string[];
    correctAnswer: string;
    section: string;
    sectionGroup?: string;
    questionType?: string;
    solution?: string;
  }[];
  sectionPoints?: {
    p1: number;
    p2: {
      opt1: number;
      opt2: number;
      opt3: number;
      opt4: number;
    };
    p3: number;
  };
}

export interface FolderItem {
  id: string;
  name: string;
  teacherId: string;
}

export const isSection1 = (sec?: string) => Boolean(sec && (/(?:Phần|Part)\s*(?:I(?![IVX\w])|1\b|thứ\s*nhất)/i.test(sec) || /^1\b|^I(?![IVX\w])/i.test(sec)) && !/(?:Phần|Part)\s*(?:II|2\b)/i.test(sec) && !/(?:Phần|Part)\s*(?:III|3\b)/i.test(sec));
export const isSection2 = (sec?: string) => Boolean(sec && (/(?:Phần|Part)\s*(?:II(?![IVX\w])|2\b|thứ\s*hai)/i.test(sec) || /^2\b|^II(?![IVX\w])/i.test(sec)) && !/(?:Phần|Part)\s*(?:III|3\b)/i.test(sec));
export const isSection3 = (sec?: string) => Boolean(sec && (/(?:Phần|Part)\s*(?:III(?![IVX\w])|3\b|thứ\s*ba)/i.test(sec) || /^3\b|^III(?![IVX\w])/i.test(sec)));

export const parsePart2Answers = (ansStr: string): { [key: string]: 'Đúng' | 'Sai' } => {
  const res: { [key: string]: 'Đúng' | 'Sai' } = { a: 'Đúng', b: 'Sai', c: 'Đúng', d: 'Sai' };
  if (!ansStr) return res;
  ['a', 'b', 'c', 'd'].forEach((letter, idx) => {
    const upperLetter = ['A', 'B', 'C', 'D'][idx];
    const regex = new RegExp(`(?:${letter}|${upperLetter})\\s*[\\.\\)]?\\s*(Đúng|Sai)`, 'i');
    const m = ansStr.match(regex);
    if (m) {
      res[letter] = m[1].toLowerCase() === 'đúng' ? 'Đúng' : 'Sai';
    }
  });
  return res;
};

export default function ExamRepository() {
  const { user: authUser } = useAuth();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');

  const carouselRef = useRef<HTMLDivElement>(null);

  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [showSettingModal, setShowSettingModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [selectedExamForAction, setSelectedExamForAction] = useState<ExamItem | null>(null);
  const [examToDelete, setExamToDelete] = useState<ExamItem | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassIdToAssign, setSelectedClassIdToAssign] = useState<string>('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [settingTitle, setSettingTitle] = useState('');
  const [settingGrade, setSettingGrade] = useState('12');
  const [settingSubject, setSettingSubject] = useState('Toán');
  const [settingExamType, setSettingExamType] = useState('Cuối kỳ I');
  const [settingDescription, setSettingDescription] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [settingTab, setSettingTab] = useState<'all' | 'p1' | 'p2' | 'p3'>('all');
  const [settingViewMode, setSettingViewMode] = useState<'edit' | 'preview'>('edit');
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [sectionPoints, setSectionPoints] = useState({
    p1: 0.25,
    p2: { opt1: 0.1, opt2: 0.25, opt3: 0.5, opt4: 1.0 },
    p3: 0.25
  });

  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.exam-card-menu')) {
        setActiveMenuId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const user = auth.currentUser || authUser;
    if (!user) return;
    const q = query(collection(db, 'classes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClassesList(snapshot.docs.map((d) => ({ id: d.id, name: d.data().name })));
    });
    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    const user = auth.currentUser || authUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const qExams = query(collection(db, 'exams'));
    const qFolders = query(collection(db, 'folders'));

    const unsubFolders = onSnapshot(qFolders, (snap) => {
      setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FolderItem)));
    });

    const unsubExams = onSnapshot(qExams, async (snap) => {
      if (snap.empty) {
        await seedInitialExams(user.uid || 'teacher_giasudienvan');
      } else {
        const list: ExamItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        } as ExamItem));
        setExams(list);
        setLoading(false);
      }
    });

    return () => {
      unsubFolders();
      unsubExams();
    };
  }, [authUser]);


  useEffect(() => {
    if (
      showDetailModal &&
      selectedExamForAction &&
      selectedExamForAction.hasSubcollectionQuestions &&
      (!selectedExamForAction.questions || selectedExamForAction.questions.length === 0)
    ) {
      getDocs(collection(db, 'exams', selectedExamForAction.id, 'questionChunks'))
        .then((snap) => {
          const sortedDocs = snap.docs.sort((a, b) => (a.data().chunkIndex || 0) - (b.data().chunkIndex || 0));
          let allQ: any[] = [];
          sortedDocs.forEach((d) => {
            allQ = allQ.concat(d.data().questions || []);
          });
          setSelectedExamForAction((prev) => (prev ? { ...prev, questions: allQ } : null));
        })
        .catch((err) => console.error('Lỗi tải câu hỏi từ subcollection:', err));
    }
  }, [showDetailModal, selectedExamForAction?.id]);

  const seedInitialExams = async (uid: string) => {
    const sampleExams = [
      { title: '1201 - ôn chương 1-2', createdAtStr: '25/12/2026', questionCountStr: '18-2-2-0', durationMinutes: 45, isRecommended: true },
      { title: 'CĐ 2_ KTTX.docx', createdAtStr: '10/03/2026', questionCountStr: '11-2-5-0', durationMinutes: 45, isRecommended: true },
      { title: 'CĐ3_KTTX.docx', createdAtStr: '16/03/2026', questionCountStr: '10-1-3-0', durationMinutes: 45, isRecommended: true },
      { title: 'CĐ4_KTTX.docx', createdAtStr: '16/03/2026', questionCountStr: '10-2-3-0', durationMinutes: 45, isRecommended: false }
    ];

    try {
      for (const item of sampleExams) {
        await addDoc(collection(db, 'exams'), {
          ...item,
          teacherId: uid,
          questions: DEFAULT_SAMPLE_QUESTIONS,
          sectionPoints: DEFAULT_SECTION_POINTS,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error('Lỗi nạp dữ liệu mẫu:', e);
    }
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 320;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const extractTextFromHtmlPreservingUnderline = (html: string): string => {
    // 1. Chuẩn hóa MathType, MathML, OMML và ký hiệu toán học trước
    let processed = sanitizeMathContent(html);

    // 2. Bảo toàn gạch chân đáp án và định dạng đoạn văn
    processed = processed
      .replace(/<span[^>]*style=["'][^"']*text-decoration:\s*underline[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '<u>$1</u>')
      .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/(?:p|div|tr|h[1-6]|li)>/gi, '\n\n')
      .replace(/<(?:p|div|tr|h[1-6]|li)[^>]*>/gi, '\n')
      .replace(/<td[^>]*>/gi, ' ')
      .replace(/<(?!(\/?u\b|\/?img\b))[^>]+>/gi, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&');

    return sanitizeMathContent(processed);
  };

  const extractRawTextFromFile = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const fileNameLower = (file.name || '').toLowerCase();

    // 1. Kiểm tra chữ ký file PDF (%PDF- : 0x25, 0x50, 0x44, 0x46) hoặc đuôi .pdf TRƯỚC TIÊN
    // Tuyệt đối không giải mã UTF-8/HTML trên luồng byte nhị phân của PDF (tránh khớp nhầm '<p ' sinh ra ký tự rác nhị phân)
    let isPdf = fileNameLower.endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf && bytes.length >= 4) {
      // Kiểm tra %PDF trong 1024 byte đầu tiên (một số file PDF có header offset nhỏ)
      const checkLen = Math.min(bytes.length - 4, 1024);
      for (let i = 0; i <= checkLen; i++) {
        if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) {
          isPdf = true;
          break;
        }
      }
    }

    if (isPdf) {
      try {
        const text = await parsePdfFileToText(arrayBuffer);
        if (text && text.trim().length > 5) {
          return text.normalize('NFC');
        } else {
          console.warn('PDF extracted text is too short:', text);
        }
      } catch (e) {
        console.warn('Không thể trích xuất text từ file PDF:', e);
      }
      throw new Error('FILE_PDF_UNREADABLE');
    }

    // 2. Kiểm tra chữ ký ZIP (.docx là file zip nén, bắt đầu bằng 2 byte 'PK' [0x50, 0x4B])
    const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B;

    if (isZip) {
      // 2.1 Sử dụng parseWordFile (Mammoth + cấu hình bắt ảnh công thức sang base64)
      try {
        const htmlVal = await parseWordFile(arrayBuffer);
        if (htmlVal && htmlVal.trim()) {
          const preservedText = extractTextFromHtmlPreservingUnderline(htmlVal);
          if (preservedText.trim()) {
            return preservedText.normalize('NFC');
          }
        }
      } catch (zipErr: any) {
        console.warn('Không thể chuyển đổi html từ file docx qua parseWordFile:', zipErr?.message);
      }

      // 2.2 Thử trích xuất thô qua Mammoth nếu convertToHtml không thành công
      try {
        // @ts-ignore
        const rawResult = await mammoth.extractRawText({ arrayBuffer });
        const val = (rawResult && rawResult.value) || '';
        if (val.trim()) {
          return sanitizeMathContent(val.normalize('NFC'));
        }
      } catch (e) {
        console.warn('Không thể trích xuất raw text từ file docx:', e);
      }
    }

    // 3. Nếu là file Word nhị phân cũ .doc (OLE2 CFBF: 0xD0, 0xCF, 0x11, 0xE0)
    const isBinaryDoc = bytes.length >= 8 && bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0;
    if (isBinaryDoc) {
      const utf16 = new TextDecoder('utf-16le', { fatal: false }).decode(bytes).normalize('NFC');
      const m16 = utf16.match(/[\p{L}\p{N}\s.,;:!?()\-+/><=]{5,}/gu) || [];
      const joined16 = m16.join(' ');
      if (/(?:câu|bài|phần|đáp\s*án)/i.test(joined16)) {
        return joined16;
      }
      throw new Error('FILE_BINARY_DOC_LEGACY');
    }

    // 4. Giải mã dạng chuỗi văn bản (UTF-8) cho file .doc dạng HTML hoặc .txt
    const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(bytes).normalize('NFC');

    // Kiểm tra xem có phải dữ liệu nhị phân rác hay không (chứa nhiều ký tự điều khiển hoặc replacement char \uFFFD)
    const binaryGarbageCount = (decodedText.match(/[\uFFFD\x00-\x08\x0E-\x1F]/g) || []).length;
    if (decodedText.length > 0 && binaryGarbageCount / decodedText.length > 0.05) {
      throw new Error('FILE_UNSUPPORTED_OR_EMPTY');
    }

    // Kiểm tra định dạng HTML / Word web archive (như file mẫu tải về hoặc file lưu dạng HTML .doc)
    const hasHtmlTags = /<!DOCTYPE\s+html|<html[\s>]|<body[\s>]|xmlns:w=|xmlns:o=|<p\s+class=|<div\s+class=/i.test(decodedText);
    if (hasHtmlTags) {
      const extractedHtml = extractTextFromHtmlPreservingUnderline(decodedText);
      if (extractedHtml.trim()) {
        return extractedHtml.normalize('NFC');
      }
    }

    // 5. Nếu là file văn bản thuần (.txt)
    if (decodedText.trim() && /(?:câu|bài|phần|đáp\s*án)/i.test(decodedText)) {
      return decodedText;
    }

    if (decodedText.trim().length > 30) {
      return decodedText;
    }

    throw new Error('FILE_UNSUPPORTED_OR_EMPTY');
  };

  const handleProceedToSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setNotification({ type: 'error', message: 'Vui lòng chọn file đề thi trước khi tiếp tục.' });
      return;
    }

    const fileName = selectedFile.name;
    setSettingTitle(fileName.replace(/\.[^/.]+$/, ''));
    setSettingDescription(`Đề thi trích xuất từ file: ${fileName}`);
    setSettingSubject(selectedSubject);

    try {
      let text = await extractRawTextFromFile(selectedFile);
      text = text
        .normalize('NFC')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u00A0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, ' ')
        .replace(/\t/g, ' ');

      if (!text.trim()) {
        setNotification({
          type: 'error',
          message: 'Không trích xuất được văn bản từ file (file có thể chỉ chứa hình ảnh hoặc bảng không đọc được). Vui lòng kiểm tra lại file.'
        });
        return;
      }

      // Chuẩn hóa ký tự số La Mã Unicode, khoảng cách chữ và loại bỏ các dòng hướng dẫn phần bị ngắt dòng
      text = text
        .normalize('NFC')
        .replace(/[Ⅰⅰ]/g, 'I')
        .replace(/[Ⅱⅱ]/g, 'II')
        .replace(/[Ⅲⅲ]/g, 'III')
        .replace(/(?:^|\n)\s*P\s*H\s*[ẦAÀ]\s*N(?=\s*(?:I{1,3}\b|[123]\b))/gi, '\nPHẦN')
        .replace(/(?:^|\n)\s*PHẦN\s+I\s+I\s+I\b/gi, '\nPHẦN III')
        .replace(/(?:^|\n)\s*PHẦN\s+I\s+I\b/gi, '\nPHẦN II')
        .replace(/\(?\s*Thí\s*sinh\s*trả\s*lời\s*từ\s*câu\s*\d+[\s\r\n]+đến\s*[\s\r\n]*câu\s*\d+[^\n.]*\.?\s*\)?/gi, '')
        .replace(/\(?\s*Mỗi\s*câu\s*hỏi\s*thí\s*sinh\s*chỉ\s*chọn\s*[\s\r\n]*một\s*phương\s*án[^\n.]*\.?\s*\)?/gi, '')
        .replace(/\(?\s*Trong\s*mỗi\s*ý\s*a\s*[\.\)]?\s*,\s*b\s*[\.\)]?\s*,\s*c\s*[\.\)]?\s*,\s*d\s*[\.\)]?[\s\r\n]*ở\s*mỗi\s*câu[^\n.]*\.?\s*\)?/gi, '')
        .replace(/(?:^|\n)\s*C\s*â\s*u\s*(?=\d+)/g, '\nCâu ')
        .replace(/(?:^|\n)\s*C\s*Â\s*U\s*(?=\d+)/g, '\nCÂU ')
        // Đảm bảo nếu 'Câu X.' bị dính trên cùng 1 dòng ngay sau phương án của câu trước thì tách xuống dòng mới
        // Nhưng KHÔNG tách các cụm hướng dẫn như "từ câu 1 đến câu 18"
        .replace(/(?<![tT]ừ\s|[đĐ]ến\s|[tT]ới\s|[ởỞ]\s|[tT]heo\s|[nN]hư\s)(?<=[.?!\)]|\s{2,})((?:Câu|CAU|Bài|BÀI)\s*\d+\s*(?:[\.\:\)]|\s*\[))/g, '\n$1');

      // Loại bỏ triệt để các dòng chân tiêu đề / header / footer / số trang / dòng hướng dẫn phụ nằm trong văn bản
      text = text
        .split('\n')
        .map(line =>
          line
            .replace(/\s*[-–—|]*\s*\b(?:Trang|Page)\s+\d+\s*(?:\/|trên|of)\s*\d+(?:\s*[-–—|]*\s*Mã\s*đề(?:\s*thi)?\s*[:.]?\s*\d+)?\s*$/i, '')
            .replace(/\s*\(?\s*Thí\s*sinh\s*trả\s*lời\s*từ\s*câu\s*\d+\s*đến\s*câu\s*\d+[^)]*\)?/gi, '')
            .replace(/\s*\(?\s*Mỗi\s*câu\s*hỏi\s*thí\s*sinh\s*chỉ\s*chọn\s*một\s*phương\s*án\.?\s*\)?/gi, '')
            .replace(/\s*\(?\s*Trong\s*mỗi\s*ý\s*a\s*[\.\)]?\s*,\s*b\s*[\.\)]?\s*,\s*c\s*[\.\)]?\s*,\s*d\s*[\.\)]?\s*ở\s*mỗi\s*câu[^)]*\)?/gi, '')
        )
        .filter(line => {
          const trimmed = line.trim();
          if (!trimmed) return true;
          if (/^[-–—_=*~•·.\s]{3,}$/.test(trimmed)) return false;
          if (/^(?:[-–—_\s•*|]*)(?:Trang|Page)\s*\d+(?:\s*(?:\/|trên|of|\-)\s*\d+)?(?:\s*[-–—|.,;]*\s*(?:Mã\s*đề(?:\s*thi)?\s*[:.]?\s*\d+)?)?(?:[-–—_\s•*|]*)$/i.test(trimmed)) return false;
          if (/^(?:[-–—_\s•*|]*)(?:Mã\s*đề(?:\s*thi)?\s*[:.]?\s*\d+)(?:\s*[-–—|.,;]*\s*(?:Trang|Page)\s*\d+(?:\s*\/\s*\d+)?)?(?:[-–—_\s•*|]*)$/i.test(trimmed)) return false;
          if (/^(?:SỞ\s+GIÁO\s+DỤC|SỞ\s+GD\s*&\s*ĐT|TRƯỜNG\s+THPT|TRƯỜNG\s+THCS|PHÒNG\s+GD|BỘ\s+GIÁO\s+DỤC|ĐỀ\s+CHÍNH\s+THỨC|ĐỀ\s+THAM\s+KHẢO|ĐỀ\s+MINH\s+HỌA|KỲ\s+THI\s+TỐT\s+NGHIỆP|ĐỀ\s+KIỂM\s+TRA|ĐỀ\s+THI\s+THỬ)\b/i.test(trimmed)) return false;
          if (/^(?:Họ\s*(?:và\s*)?tên\s*(?:thí\s*sinh|học\s*sinh)?\s*[:.]|Số\s*báo\s*danh\s*[:.]|Thời\s*gian\s*làm\s*bài\s*[:.]|\(?\s*Đề\s*(?:thi\s*)?(?:gồm\s*)?có\s*\d+\s*trang|\(?\s*Không\s*kể\s*thời\s*gian\s*phát\s*đề)/i.test(trimmed)) return false;
          if (/^\(?\s*(?:Thí\s*sinh\s*trả\s*lời\s*từ\s*câu|Mỗi\s*câu\s*hỏi\s*thí\s*sinh\s*chỉ\s*chọn|Trong\s*mỗi\s*ý\s*a\s*[\.\)]?)/i.test(trimmed)) return false;
          return true;
        })
        .join('\n');

      // Biểu thức regex nhận diện từ khóa Lời giải tuyệt đối chuẩn xác
      const robustSolutionRegex = /(?<=^|[\r\n\s]|<[^>]+>)(?:\[?\s*(?:L\s*ờ\s*i\s*g\s*i\s*ả\s*i|B\s*à\s*i\s*g\s*i\s*ả\s*i|H\s*ư\s*ớ\s*n\s*g\s*d\s*ẫ\s*n\s*g\s*i\s*ả\s*i|G\s*i\s*ả\s*i\s*c\s*h\s*i\s*t\s*i\s*ế\s*t|HD\s*giải|HDG|H\s*ư\s*ớ\s*n\s*g\s*d\s*ẫ\s*n)\s*\]?[\:\.\-]?|Giải\s*[\:\.\-])\s*/i;

      // 1. Phân chia ranh giới 3 phần dựa vào các tiêu đề lớn (Phần I, Phần II, Phần III):
      // Yêu cầu tiêu đề phần nằm ở đầu dòng (hoặc sau thẻ HTML) để không bắt nhầm chữ "phần" trong câu văn
      const p1Regex = /(?:^|\n|<[^>]+>)\s*(?:(?:PH\s*[ẦAÀÂa-z]*\s*N|PART)\s*(?:I(?![IVX\w])|1\b|MỘT\b|THỨ\s*NHẤT)|I\s*[\.\:\)]\s*(?=CÂU\s*TRẮC\s*NGHIỆM|CÂU\s*HỎI|TRẮC\s*NGHIỆM|PHẦN))[\.\:\-\s\)]*/gi;
      const p2Regex = /(?:^|\n|<[^>]+>)\s*(?:(?:PH\s*[ẦAÀÂa-z]*\s*N|PART)\s*(?:II(?![IVX\w])|2\b|HAI\b|THỨ\s*HAI)|II\s*[\.\:\)]\s*(?=CÂU\s*TRẮC\s*NGHIỆM|CÂU\s*HỎI|TRẮC\s*NGHIỆM|ĐÚNG\s*SAI|PHẦN))[\.\:\-\s\)]*/gi;
      const p3Regex = /(?:^|\n|<[^>]+>)\s*(?:(?:PH\s*[ẦAÀÂa-z]*\s*N|PART)\s*(?:III(?![IVX\w])|3\b|BA\b|THỨ\s*BA)|III\s*[\.\:\)]\s*(?=CÂU\s*TRẮC\s*NGHIỆM|CÂU\s*HỎI|TRẮC\s*NGHIỆM|TRẢ\s*LỜI\s*NGẮN|PHẦN))[\.\:\-\s\)]*/gi;

      // Các tiêu đề bổ sung trong trường hợp file không ghi số La Mã hoặc chỉ ghi loại câu hỏi ở đầu dòng
      const p1AltRegex = /(?:^|\n|<[^>]+>)\s*(?:(?:PH\s*[ẦAÀÂa-z]*\s*N|PART)\s*[I123]*[\.\:\-\s]*)?(?:CÂU\s*HỎI\s*TRẮC\s*NGHIỆM\s*NHIỀU\s*(?:PHƯƠNG\s*ÁN\s*)?LỰA\s*CHỌN|CÂU\s*TRẮC\s*NGHIỆM\s*NHIỀU\s*PHƯƠNG\s*ÁN|TRẮC\s*NGHIỆM\s*NHIỀU\s*PHƯƠNG\s*ÁN|TRẮC\s*NGHIỆM\s*4\s*LỰA\s*CHỌN)/gi;
      const p2AltRegex = /(?:^|\n|<[^>]+>)\s*(?:(?:PH\s*[ẦAÀÂa-z]*\s*N|PART)\s*[I123]*[\.\:\-\s]*)?(?:CÂU\s*TRẮC\s*NGHIỆM\s*ĐÚNG\s*SAI|CÂU\s*HỎI\s*TRẮC\s*NGHIỆM\s*ĐÚNG\s*SAI|CÂU\s*HỎI\s*ĐÚNG\s*SAI|TRẮC\s*NGHIỆM\s*ĐÚNG\s*SAI)/gi;
      const p3AltRegex = /(?:^|\n|<[^>]+>)\s*(?:(?:PH\s*[ẦAÀÂa-z]*\s*N|PART)\s*[I123]*[\.\:\-\s]*)?(?:CÂU\s*TRẮC\s*NGHIỆM\s*(?:YÊU\s*CẦU\s*)?TRẢ\s*LỜI\s*NGẮN|CÂU\s*HỎI\s*TRẮC\s*NGHIỆM\s*TRẢ\s*LỜI\s*NGẮN|CÂU\s*HỎI\s*TRẢ\s*LỜI\s*NGẮN|TRẮC\s*NGHIỆM\s*TRẢ\s*LỜI\s*NGẮN)/gi;

      const findValidSectionMatches = (regexList: RegExp[], fullText: string): number[] => {
        const indices: number[] = [];
        for (const rgx of regexList) {
          const all = Array.from(fullText.matchAll(rgx));
          for (const m of all) {
            const idx = m.index || 0;
            const before = fullText.substring(Math.max(0, idx - 80), idx);
            const after = fullText.substring(idx, Math.min(fullText.length, idx + 220));
            // Loại bỏ dòng giới thiệu chung như "Đề thi gồm 3 phần: Phần I, Phần II, Phần III"
            const isSummaryHeader = /(?:gồm\s*có|đề\s*thi\s*gồm|cấu\s*trúc\s*đề)/i.test(before + after) &&
              /Phần\s*(?:I|1)[\s\S]{0,60}Phần\s*(?:II|2)/i.test(before + after);
            if (!isSummaryHeader) {
              const leading = m[0].match(/^[\r\n\s]+/);
              const pos = idx + (leading ? leading[0].length : 0);
              if (!indices.some(existing => Math.abs(existing - pos) < 15)) {
                indices.push(pos);
              }
            }
          }
          if (indices.length > 0) break;
        }
        return indices.sort((a, b) => a - b);
      };

      // Tách phần thân đề thi và phần BẢNG ĐÁP ÁN / HƯỚNG DẪN GIẢI CHI TIẾT ở cuối file (nếu có)
      let examBodyText = text;
      let trailingAnswerSection = '';

      const p1MatchesAll = findValidSectionMatches([p1Regex, p1AltRegex], text);
      const p2MatchesAll = findValidSectionMatches([p2Regex, p2AltRegex], text);
      const p3MatchesAll = findValidSectionMatches([p3Regex, p3AltRegex], text);

      const firstP1 = p1MatchesAll.length > 0 ? p1MatchesAll[0] : -1;
      const firstP2 = p2MatchesAll.find(i => i > firstP1) ?? (p2MatchesAll[0] ?? -1);
      const firstP3 = p3MatchesAll.find(i => i > Math.max(firstP1, firstP2)) ?? (p3MatchesAll[0] ?? -1);

      const lastSectionStart = Math.max(firstP1, firstP2, firstP3, 0);
      if (lastSectionStart > 0) {
        const afterLastSection = text.substring(lastSectionStart + 20);
        // Tìm dấu hiệu kết thúc đề thi ("--- HẾT ---", "BẢNG ĐÁP ÁN", "ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI")
        const endMarkerRegex = /(?:^|\n)\s*(?:-+\s*H\s*Ế\s*T\s*-+|H\s*Ế\s*T\s*(?:\n|$)|BẢNG\s*ĐÁP\s*ÁN|ĐÁP\s*ÁN\s*(?:VÀ\s*)?(?:HƯỚNG\s*DẪN|LỜI\s*GIẢI)|HƯỚNG\s*DẪN\s*GIẢI\s*CHI\s*TIẾT|LỜI\s*GIẢI\s*CHI\s*TIẾT)/i;
        const endM = afterLastSection.match(endMarkerRegex);
        if (endM && endM.index !== undefined) {
          const cutIndex = lastSectionStart + 20 + endM.index;
          examBodyText = text.substring(0, cutIndex).trim();
          trailingAnswerSection = text.substring(cutIndex).trim();
        }
      }

      // Bóc tách bảng đáp án cho Phần I (1A 2B...) từ trailingAnswerSection (nếu có)
      const p1AnswerKeyMap: Record<number, string> = {};
      if (trailingAnswerSection) {
        const directPairs = Array.from(trailingAnswerSection.matchAll(/(?:Câu\s*)?(\d{1,2})\s*[\.\:\-\)]?\s*\b([A-D])\b/g));
        directPairs.forEach(m => {
          const qNum = parseInt(m[1], 10);
          if (qNum >= 1 && qNum <= 50 && !p1AnswerKeyMap[qNum]) {
            p1AnswerKeyMap[qNum] = m[2].toUpperCase();
          }
        });
      }

      const idx1 = firstP1 !== -1 && firstP1 < examBodyText.length ? firstP1 : -1;
      const idx2 = firstP2 !== -1 && firstP2 < examBodyText.length ? firstP2 : -1;
      const idx3 = firstP3 !== -1 && firstP3 < examBodyText.length ? firstP3 : -1;

      let rawP1 = '';
      let rawP2 = '';
      let rawP3 = '';

      if (idx1 !== -1 && idx2 !== -1 && idx3 !== -1 && idx1 < idx2 && idx2 < idx3) {
        rawP1 = examBodyText.substring(idx1, idx2);
        rawP2 = examBodyText.substring(idx2, idx3);
        rawP3 = examBodyText.substring(idx3);
      } else if (idx1 !== -1 && idx2 !== -1 && idx1 < idx2) {
        rawP1 = examBodyText.substring(idx1, idx2);
        rawP2 = examBodyText.substring(idx2);
      } else if (idx2 !== -1 && idx3 !== -1 && idx2 < idx3) {
        rawP1 = examBodyText.substring(0, idx2);
        rawP2 = examBodyText.substring(idx2, idx3);
        rawP3 = examBodyText.substring(idx3);
      } else if (idx1 !== -1 && idx3 !== -1 && idx1 < idx3) {
        rawP1 = examBodyText.substring(idx1, idx3);
        rawP3 = examBodyText.substring(idx3);
      } else if (idx2 !== -1) {
        rawP1 = examBodyText.substring(0, idx2);
        rawP2 = examBodyText.substring(idx2);
      } else if (idx3 !== -1) {
        rawP1 = examBodyText.substring(0, idx3);
        rawP3 = examBodyText.substring(idx3);
      } else {
        rawP1 = examBodyText;
      }

      // Hàm loại bỏ dòng tiêu đề Phần I/II/III và dòng chân tiêu đề hướng dẫn ("Thí sinh trả lời từ câu 1 đến câu 18...") ở đầu mỗi phần
      const stripSectionHeaderAndInstructions = (secText: string): string => {
        if (!secText.trim()) return '';
        let cleaned = secText.trim();

        // Nếu có 'Câu 1.' hoặc 'Câu 1:' hoặc 'Câu 1 [IP]' xuất hiện trong 650 ký tự đầu tiên, cắt bỏ phần tiêu đề/hướng dẫn phía trước nó
        const firstQuestionMatch = cleaned.match(/(?:^|\n)\s*(?<!(?:từ|đến|tới|ở|theo|như)\s+)(?:\[?\s*(?:Câu|Bài|CAU|BÀI|Question)\s*(?:số\s*)?\d+\s*(?:\([^\)\n]*\))?\s*\]?\s*(?:[\.\:\-\)]+|(?=\s*\[))(?!\s*(?:đến|tới))|(?:\[?\s*(?:Câu|Bài|CAU|BÀI)\s+\d+\s*\]?\s+)(?!(?:đến|tới)\b))/i);
        if (firstQuestionMatch && firstQuestionMatch.index !== undefined && firstQuestionMatch.index < 650) {
          const leadingNewline = firstQuestionMatch[0].match(/^\s*\n/);
          const cutPos = firstQuestionMatch.index + (leadingNewline ? leadingNewline[0].length : 0);
          return cleaned.substring(cutPos).trim();
        }

        // Nếu câu hỏi không có tiền tố "Câu 1.", loại bỏ các dòng đầu tiên nếu chúng là tiêu đề PHẦN hoặc chân tiêu đề hướng dẫn
        const lines = cleaned.split('\n');
        while (lines.length > 0) {
          const firstLine = lines[0].trim();
          const isHeaderOrInstruction =
            !firstLine ||
            /^(?:PH\s*[ẦAÀÂa-z]*\s*N|PART|[I]{1,3}[\.\:\)])\b/i.test(firstLine) ||
            /^(?:CÂU\s*(?:HỎI\s*)?TRẮC\s*NGHIỆM|TRẮC\s*NGHIỆM\s*(?:NHIỀU|ĐÚNG|TRẢ))/i.test(firstLine) ||
            /^\(?\s*(?:Thí\s*sinh\s*trả\s*lời\s*từ\s*câu|Mỗi\s*câu\s*hỏi\s*thí\s*sinh|Trong\s*mỗi\s*ý\s*a\s*[\.\)]?)/i.test(firstLine) ||
            /^(?:SỞ\s+GIÁO\s+DỤC|TRƯỜNG\s+THPT|ĐỀ\s+KIỂM\s+TRA|ĐỀ\s+CHÍNH\s+THỨC|MÔN\s*:|Thời\s*gian\s*làm\s*bài)/i.test(firstLine);
          if (isHeaderOrInstruction) {
            lines.shift();
          } else {
            break;
          }
        }
        return lines.join('\n').trim();
      };

      // Hàm tách hình ảnh minh họa (<img class="pdf-figure-img" .../> hoặc ảnh độc lập trong câu hỏi)
      // đồng thời BẢO TOÀN ĐÚNG VỊ TRÍ ĐỊNH DẠNG (nội dung phía trên hình -> hình ảnh -> nội dung phía dưới hình nếu có)
      const splitStemByFigure = (rawStem: string): { questionText: string; imageUrl?: string; questionTextAfter?: string } => {
        let stem = rawStem;
        const pdfFigRegex = /<img[^>]*class=["'][^"']*pdf-figure-img[^"']*["'][^>]*src=["'](data:image\/[^"']+)["'][^>]*>/i;
        const pdfMatch = stem.match(pdfFigRegex);

        const cleanQuestionLead = (str: string) =>
          str
            .replace(/<img[^>]*>/gi, '')
            .replace(/<\/?u>/gi, '')
            .replace(/^\s*\[IP\]\s*/i, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        if (pdfMatch && pdfMatch.index !== undefined) {
          const imageUrl = pdfMatch[1];
          const beforeRaw = stem.substring(0, pdfMatch.index);
          const afterRaw = stem.substring(pdfMatch.index + pdfMatch[0].length);
          const beforeClean = cleanQuestionLead(beforeRaw);
          const afterClean = cleanQuestionLead(afterRaw);

          if (beforeClean && afterClean) {
            return {
              questionText: beforeClean,
              imageUrl,
              questionTextAfter: afterClean,
            };
          } else if (beforeClean) {
            return {
              questionText: beforeClean,
              imageUrl,
            };
          } else {
            return {
              questionText: afterClean,
              imageUrl,
            };
          }
        }

        // Kiểm tra thẻ <img> từ file Word (không phải công thức toán inline nhỏ math-formula-img)
        const wordImgRegex = /<img(?![^>]*math-formula-img)[^>]*src=["'](data:image\/[^"']+)["'][^>]*>/i;
        const wordMatch = stem.match(wordImgRegex);
        if (wordMatch && wordMatch.index !== undefined) {
          const imageUrl = wordMatch[1];
          const beforeClean = cleanQuestionLead(stem.substring(0, wordMatch.index));
          const afterClean = cleanQuestionLead(stem.substring(wordMatch.index + wordMatch[0].length));
          if (beforeClean && afterClean) {
            return {
              questionText: beforeClean,
              imageUrl,
              questionTextAfter: afterClean,
            };
          }
          return {
            questionText: beforeClean || afterClean,
            imageUrl,
          };
        }

        return {
          questionText: cleanQuestionLead(stem),
        };
      };

      // 2. Hàm tách các khối câu hỏi độc lập trong một phần:
      const extractQuestionBlocks = (rawSecStr: string, expectedType: 'p1' | 'p2' | 'p3' = 'p1') => {
        const secStr = stripSectionHeaderAndInstructions(rawSecStr);
        if (!secStr) return [];

        // 2.1. Nhận diện theo tiền tố chuẩn 'Câu 1.', 'Câu 1:', 'Câu 1)', 'Câu 1 [IP]', 'Câu 1 (0,25 điểm).' hoặc 'Bài 1.'
        // Loại trừ tuyệt đối cụm "từ câu 1 đến câu 18" hoặc "ở câu 1"
        const questionPrefixRegex = /(?:^|\n)\s*(?<!(?:từ|đến|tới|ở|theo|như)\s+)(?:\[?\s*(?:Câu|Bài|CAU|BÀI|Question)\s*(?:số\s*)?(\d+)\s*(?:\([^\)\n]{1,30}\))?\s*\]?\s*(?:[\.\:\-\)]+|(?=\s*\[|\s+[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ0-9\(]))\s*(?:\[IP\]\s*[\.\:\-\)]*\s*)?)(?!\s*(?:đến|tới)\s*(?:câu|bài))/gi;
        let matches = Array.from(secStr.matchAll(questionPrefixRegex));

        // Nếu chỉ tìm thấy < 2 câu ở đầu dòng, thử tìm các vị trí 'Câu X.' có dấu chấm/hai chấm rõ ràng
        if (matches.length < 2) {
          const strictInlineRegex = /(?<=^|[\r\n\s])(?<!từ\s|đến\s|tới\s|ở\s|theo\s|như\s)(?:\[?\s*(?:Câu|Bài|CAU|BÀI)\s*(\d+)\s*\]?(?:[\.\:\)]+|\s*\[IP\])\s*)/gi;
          const inlineMatches = Array.from(secStr.matchAll(strictInlineRegex));
          if (inlineMatches.length > matches.length) {
            matches = inlineMatches;
          }
        }

        // Thử nhận diện dạng đánh số thứ tự đầu dòng '1.', '2.', '3.' nếu không dùng chữ 'Câu'
        if (matches.length === 0) {
          const numRegex = /(?:^|\n)\s*(\d{1,2})[\.\)]\s+(?=[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\(\[])/g;
          const numMatches = Array.from(secStr.matchAll(numRegex));
          if (numMatches.length >= 2) {
            const nums = numMatches.map(m => parseInt(m[1], 10));
            const isSeq = nums.slice(0, 3).every((n, i) => i === 0 || n === nums[i - 1] + 1);
            if (isSeq) {
              matches = numMatches;
            }
          }
        }

        if (matches.length > 0) {
          const blocks: { num: number; text: string }[] = [];
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const start = match.index! + match[0].length;
            const end = (i + 1 < matches.length) ? matches[i + 1].index! : secStr.length;
            const num = parseInt(match[1], 10) || (i + 1);
            const bText = secStr.substring(start, end).trim();
            if (bText) {
              blocks.push({ num, text: bText });
            }
          }
          if (blocks.length > 0) return blocks;
        }

        // 2.2. Nhận diện cấu trúc thông minh khi KHÔNG CÓ tiền tố 'Câu X.':
        if (expectedType === 'p1') {
          const optAMatches = Array.from(secStr.matchAll(/(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?A[\.\:\)](?:<\/u>)?\s*/g));
          const mcStarts: number[] = [];
          for (let i = 0; i < optAMatches.length; i++) {
            const aM = optAMatches[i];
            const nextAIdx = (i + 1 < optAMatches.length) ? optAMatches[i + 1].index! : secStr.length;
            const chunk = secStr.substring(aM.index!, nextAIdx);
            const hasB = /(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?B[\.\:\)](?:<\/u>)?\s*/.test(chunk);
            if (hasB) {
              mcStarts.push(aM.index!);
            }
          }

          if (mcStarts.length >= 1) {
            const blocks: { num: number; text: string }[] = [];
            let prevEnd = 0;
            for (let i = 0; i < mcStarts.length; i++) {
              const curA = mcStarts[i];
              const nextA = (i + 1 < mcStarts.length) ? mcStarts[i + 1] : secStr.length;
              let blockEnd = nextA;
              if (i + 1 < mcStarts.length) {
                const chunk = secStr.substring(curA, nextA);
                const solM = chunk.match(robustSolutionRegex);
                if (solM && solM.index !== undefined) {
                  const solPart = chunk.substring(solM.index);
                  const endM = solPart.match(/(?:\n\s*\n)([\s\S]*)$/);
                  if (endM) {
                    blockEnd = curA + solM.index + (solPart.length - endM[1].length);
                  } else {
                    const dnl = chunk.lastIndexOf('\n\n');
                    if (dnl > solM.index) blockEnd = curA + dnl;
                  }
                } else {
                  const dM = chunk.match(/(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?D[\.\:\)](?:<\/u>)?\s*/);
                  if (dM && dM.index !== undefined) {
                    const afterD = chunk.substring(dM.index);
                    const nlIdx = afterD.indexOf('\n');
                    if (nlIdx !== -1) blockEnd = curA + dM.index + nlIdx;
                  }
                }
              }
              const qText = secStr.substring(prevEnd, blockEnd).trim();
              if (qText) blocks.push({ num: i + 1, text: qText });
              prevEnd = blockEnd;
            }
            if (blocks.length > 0) return blocks;
          }
        } else if (expectedType === 'p2') {
          const subAMatches = Array.from(secStr.matchAll(/(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?a[\.\:\)](?:<\/u>)?\s*/g));
          const tfStarts: number[] = [];
          for (let i = 0; i < subAMatches.length; i++) {
            const aM = subAMatches[i];
            const nextAIdx = (i + 1 < subAMatches.length) ? subAMatches[i + 1].index! : secStr.length;
            const chunk = secStr.substring(aM.index! + aM[0].length, nextAIdx);
            const hasB = /(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?b[\.\:\)](?:<\/u>)?\s*/.test(chunk);
            if (!hasB) continue;

            const isAnswerLine = /^(?:đúng|sai|đ\b|s\b|true|false)\b/i.test(chunk.trim());
            if (isAnswerLine) continue;

            tfStarts.push(aM.index!);
          }

          if (tfStarts.length >= 1) {
            const blocks: { num: number; text: string }[] = [];
            let prevEnd = 0;
            for (let i = 0; i < tfStarts.length; i++) {
              const curA = tfStarts[i];
              const nextA = (i + 1 < tfStarts.length) ? tfStarts[i + 1] : secStr.length;
              let blockEnd = nextA;
              if (i + 1 < tfStarts.length) {
                const chunk = secStr.substring(curA, nextA);
                const dM = chunk.match(/(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?d[\.\:\)](?:<\/u>)?\s*/);
                if (dM && dM.index !== undefined) {
                  const afterD = chunk.substring(dM.index);
                  const nlIdx = afterD.indexOf('\n');
                  if (nlIdx !== -1) blockEnd = curA + dM.index + nlIdx;
                }
              }
              const qText = secStr.substring(prevEnd, blockEnd).trim();
              if (qText) blocks.push({ num: i + 1, text: qText });
              prevEnd = blockEnd;
            }
            if (blocks.length > 0) return blocks;
          }
        } else if (expectedType === 'p3') {
          const allSol = Array.from(secStr.matchAll(new RegExp(robustSolutionRegex, 'gi')));
          if (allSol.length >= 1) {
            const blocks: { num: number; text: string }[] = [];
            let prevEnd = 0;
            for (let i = 0; i < allSol.length; i++) {
              const curSol = allSol[i];
              const nextSol = allSol[i + 1];
              let blockEnd = secStr.length;
              if (nextSol) {
                const chunk = secStr.substring(curSol.index!, nextSol.index!);
                const ansM = chunk.match(/(?:Đáp án|Đáp số|Kết quả)\s*[:=]\s*[^\n]+\n/i);
                if (ansM && ansM.index !== undefined) {
                  blockEnd = curSol.index! + ansM.index + ansM[0].length;
                } else {
                  const dnl = chunk.lastIndexOf('\n\n');
                  if (dnl !== -1) blockEnd = curSol.index! + dnl;
                }
              }
              const qText = secStr.substring(prevEnd, blockEnd).trim();
              if (qText) blocks.push({ num: i + 1, text: qText });
              prevEnd = blockEnd;
            }
            if (blocks.length > 0) return blocks;
          }

          const paras = secStr.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
          if (paras.length >= 2) {
            return paras.map((p, idx) => ({ num: idx + 1, text: p }));
          }
        }

        // Chỉ trả về 1 câu duy nhất nếu thực sự có nội dung câu hỏi dài hơn 10 ký tự
        if (secStr.length > 10) {
          return [{ num: 1, text: secStr }];
        }
        return [];
      };

      // 3. Hàm phân tích câu hỏi PHẦN I (Trắc nghiệm nhiều lựa chọn A, B, C, D)
      const parseP1Question = (blockText: string, qNumber?: number) => {
        let content = blockText.trim();
        let solution = '';

        // Tách từ khóa 'Lời giải:' tuyệt đối chuẩn xác
        const solM = content.match(robustSolutionRegex);
        if (solM && solM.index !== undefined) {
          solution = content.substring(solM.index + solM[0].length).trim();
          content = content.substring(0, solM.index).trim();
        }

        // Bắt các phương án A, B, C, D in hoa độc lập
        const optRegex = /(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?([A-D])[\.\:\)](?:<\/u>)?\s*/g;
        const matches = Array.from(content.matchAll(optRegex));

        let firstOptIndex = -1;
        let optMatches: RegExpMatchArray[] = [];
        const letters = ['A', 'B', 'C', 'D'];

        // Duyệt từ vị trí 'A.' CUỐI CÙNG mà phía sau nó có đủ B, C (và D) theo đúng thứ tự
        for (let i = matches.length - 1; i >= 0; i--) {
          if (matches[i][1] === 'A') {
            const afterA = matches.slice(i + 1);
            const bIdx = afterA.findIndex(m => m[1] === 'B');
            if (bIdx !== -1) {
              const bM = afterA[bIdx];
              const afterB = afterA.slice(bIdx + 1);
              const cIdx = afterB.findIndex(m => m[1] === 'C');
              if (cIdx !== -1) {
                const cM = afterB[cIdx];
                const afterC = afterB.slice(cIdx + 1);
                const dM = afterC.find(m => m[1] === 'D');
                firstOptIndex = matches[i].index!;
                optMatches = [matches[i], bM, cM, dM].filter(Boolean) as RegExpMatchArray[];
                break;
              }
            }
          }
        }

        let rawStem = content;
        let options: string[] = [];
        let underlineAnswer = '';

        if (firstOptIndex !== -1 && optMatches.length >= 2) {
          rawStem = content.substring(0, firstOptIndex).trim();

          for (let k = 0; k < optMatches.length; k++) {
            const curM = optMatches[k];
            const nextM = optMatches[k + 1];
            const start = curM.index! + curM[0].length;
            const end = nextM ? nextM.index! : content.length;
            let rawBody = content.substring(start, end).trim();
            const letter = letters[k];

            // Nếu có thẻ <img class="pdf-figure-img"...> vô tình nằm trong phần phương án thì chuyển nó lên rawStem
            const strayPdfImgs = rawBody.match(/<img[^>]*class=["'][^"']*pdf-figure-img[^"']*["'][^>]*>/gi);
            if (strayPdfImgs) {
              rawStem += '\n' + strayPdfImgs.join('\n');
              rawBody = rawBody.replace(/<img[^>]*class=["'][^"']*pdf-figure-img[^"']*["'][^>]*>/gi, '').trim();
            }

            if (/<u>/i.test(curM[0]) || /<u>/i.test(rawBody)) {
              underlineAnswer = letter;
            }

            const cleanBody = rawBody
              .replace(/<\/?u>/gi, '')
              .replace(/^[A-D][\.\:\)]\s*/i, '')
              .trim();
            options.push(`${letter}. ${cleanBody}`);
          }
        }

        const { questionText, imageUrl, questionTextAfter } = splitStemByFigure(rawStem);

        while (options.length < 4) {
          const letter = letters[options.length];
          options.push(`${letter}. Phương án ${letter}`);
        }

        if (!underlineAnswer) {
          const underLetterM = content.match(/<u>\s*([A-D])[\.\:\)]?\s*<\/u>/i);
          if (underLetterM) {
            underlineAnswer = underLetterM[1].toUpperCase();
          }
        }

        let correctAnswer = underlineAnswer;
        if (!correctAnswer) {
          const ansM = content.match(/(?:^|[\r\n\s])(?:Đáp án|Đáp số|Kết quả|Chọn)\s*[:=]?\s*\b([A-D])\b/i);
          if (ansM) {
            correctAnswer = ansM[1].toUpperCase();
          } else if (solution) {
            const solAnsM = solution.match(/(?:^|[\r\n\s])(?:Đáp án|Đáp số|Kết quả|Chọn)\s*[:=]?\s*\b([A-D])\b/i);
            if (solAnsM) {
              correctAnswer = solAnsM[1].toUpperCase();
            }
          }
        }

        if (!correctAnswer && qNumber && p1AnswerKeyMap[qNumber]) {
          correctAnswer = p1AnswerKeyMap[qNumber];
        }

        if (!correctAnswer) {
          correctAnswer = 'A';
        }

        return {
          questionText: questionText || content.replace(/<img[^>]*>/gi, '').replace(/<\/?u>/gi, '').trim(),
          questionTextAfter,
          imageUrl,
          options,
          correctAnswer,
          questionType: 'trắc nghiệm' as const,
          solution: solution.replace(/<img[^>]*class=["'][^"']*pdf-figure-img[^"']*["'][^>]*>/gi, '').replace(/<\/?u>/gi, '').trim()
        };
      };

      // 4. Hàm phân tích câu hỏi PHẦN II (Trắc nghiệm đúng sai 4 ý a, b, c, d)
      const parseP2Question = (blockText: string) => {
        let content = blockText.trim();
        let solution = '';

        // Tách từ khóa 'Lời giải:' chuẩn xác
        const solM = content.match(robustSolutionRegex);
        if (solM && solM.index !== undefined) {
          solution = content.substring(solM.index + solM[0].length).trim();
          content = content.substring(0, solM.index).trim();
        }

        const subLetters = ['a', 'b', 'c', 'd'];
        const detectedTfAnswers: { [key: string]: 'Đúng' | 'Sai' } = {};

        // 1. Kiểm tra dòng tóm tắt đáp án a) Đúng - b) Sai...
        const summaryRegex = /(?:^|[\r\n\s])(?:Đáp án|Đáp số|Kết quả)?\s*[:=]?\s*a[\.\)]\s*(đúng|sai|đ|s|true|false)\b[\s\-\,\;]+b[\.\)]\s*(đúng|sai|đ|s|true|false)\b[\s\-\,\;]+c[\.\)]\s*(đúng|sai|đ|s|true|false)\b[\s\-\,\;]+d[\.\)]\s*(đúng|sai|đ|s|true|false)\b/i;
        const summaryMatch = content.match(summaryRegex) || (solution ? solution.match(summaryRegex) : null);
        if (summaryMatch && summaryMatch.index !== undefined) {
          const partA = summaryMatch[1].toLowerCase();
          const partB = summaryMatch[2].toLowerCase();
          const partC = summaryMatch[3].toLowerCase();
          const partD = summaryMatch[4].toLowerCase();

          detectedTfAnswers['a'] = (partA.startsWith('đ') || partA === 'true') ? 'Đúng' : 'Sai';
          detectedTfAnswers['b'] = (partB.startsWith('đ') || partB === 'true') ? 'Đúng' : 'Sai';
          detectedTfAnswers['c'] = (partC.startsWith('đ') || partC === 'true') ? 'Đúng' : 'Sai';
          detectedTfAnswers['d'] = (partD.startsWith('đ') || partD === 'true') ? 'Đúng' : 'Sai';
        }

        // 2. Bóc tách 4 ý a), b), c), d) (ưu tiên dấu đóng ngoặc đơn ')' hoặc đầu dòng để không bắt nhầm chữ 'a.' trong câu văn)
        const parenSubRegex = /(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?([a-d])\)(?:<\/u>)?\s*/g;
        let matches = Array.from(content.matchAll(parenSubRegex));
        if (matches.length < 3) {
          const lowerSubRegex = /(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?([a-d])[\.\:\)](?:<\/u>)?\s*/g;
          matches = Array.from(content.matchAll(lowerSubRegex));
        }
        if (matches.length < 3) {
          const anyCaseSubRegex = /(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?([a-dA-D])[\.\:\)](?:<\/u>)?\s*/g;
          matches = Array.from(content.matchAll(anyCaseSubRegex));
        }

        let firstSubIndex = -1;
        let subMatches: RegExpMatchArray[] = [];

        for (let i = matches.length - 1; i >= 0; i--) {
          if (matches[i][1].toLowerCase() === 'a') {
            const afterA = matches.slice(i + 1);
            const bIdx = afterA.findIndex(m => m[1].toLowerCase() === 'b');
            if (bIdx !== -1) {
              const bM = afterA[bIdx];
              const afterB = afterA.slice(bIdx + 1);
              const cIdx = afterB.findIndex(m => m[1].toLowerCase() === 'c');
              if (cIdx !== -1) {
                const cM = afterB[cIdx];
                const afterC = afterB.slice(cIdx + 1);
                const dM = afterC.find(m => m[1].toLowerCase() === 'd');
                firstSubIndex = matches[i].index!;
                subMatches = [matches[i], bM, cM, dM].filter(Boolean) as RegExpMatchArray[];
                break;
              }
            }
          }
        }

        let rawStem = content;
        let options: string[] = [];

        if (firstSubIndex !== -1 && subMatches.length >= 2) {
          rawStem = content.substring(0, firstSubIndex).trim();

          for (let k = 0; k < subMatches.length; k++) {
            const curM = subMatches[k];
            const nextM = subMatches[k + 1];
            const start = curM.index! + curM[0].length;
            const end = nextM ? nextM.index! : content.length;
            let rawBody = content.substring(start, end).trim();
            const letter = subLetters[k];

            const strayPdfImgs = rawBody.match(/<img[^>]*class=["'][^"']*pdf-figure-img[^"']*["'][^>]*>/gi);
            if (strayPdfImgs) {
              rawStem += '\n' + strayPdfImgs.join('\n');
              rawBody = rawBody.replace(/<img[^>]*class=["'][^"']*pdf-figure-img[^"']*["'][^>]*>/gi, '').trim();
            }

            if (/<u>\s*(?:đúng|dung|true|đ)\s*<\/u>/i.test(rawBody) || /\(?(?:đúng|dung|true)\)?$/i.test(rawBody)) {
              detectedTfAnswers[letter] = 'Đúng';
            } else if (/<u>\s*(?:sai|false|s)\s*<\/u>/i.test(rawBody) || /\(?(?:sai|false)\)?$/i.test(rawBody)) {
              detectedTfAnswers[letter] = 'Sai';
            }

            const cleanBody = rawBody
              .replace(/<\/?u>/gi, '')
              .replace(/\((?:Đúng|Sai|True|False|\s*\/?\s*)+\)\s*$/gi, '')
              .replace(/[\(\[\{]\s*[\}\]\)]/g, '')
              .trim();

            options.push(`${letter}) ${cleanBody || 'Ý thứ ' + (k + 1)}`);
          }
        }

        const { questionText, imageUrl, questionTextAfter } = splitStemByFigure(rawStem);

        while (options.length < 4) {
          const letter = subLetters[options.length];
          options.push(`${letter}) Ý thứ ${options.length + 1}`);
        }

        // Nhận diện kết quả đúng sai từ lời giải nếu chưa có
        if (solution) {
          ['a', 'b', 'c', 'd'].forEach(l => {
            if (!detectedTfAnswers[l]) {
              const pat = new RegExp('(?:^|[\\r\\n\\s])' + l + '[\\.\\:\\)]\\s*(?:là\\s*|chọn\\s*)?(đúng|sai|đ|s|true|false)', 'i');
              const m = solution.match(pat);
              if (m) {
                detectedTfAnswers[l] = (m[1].toLowerCase().startsWith('đ') || m[1].toLowerCase() === 'true') ? 'Đúng' : 'Sai';
              }
            }
          });
        }

        const correctAnswer = subLetters.map(l => `${l}) ${detectedTfAnswers[l] || 'Đúng'}`).join(' - ');

        return {
          questionText: questionText || content.replace(/<img[^>]*>/gi, '').replace(/<\/?u>/gi, '').trim(),
          questionTextAfter,
          imageUrl,
          options,
          correctAnswer,
          questionType: 'đúng sai' as const,
          solution: solution.replace(/<img[^>]*class=["'][^"']*pdf-figure-img[^"']*["'][^>]*>/gi, '').replace(/<\/?u>/gi, '').trim()
        };
      };

      // 5. Hàm phân tích câu hỏi PHẦN III (Trắc nghiệm trả lời ngắn)
      const parseP3Question = (blockText: string) => {
        let rawContent = blockText.trim();
        let solution = '';

        // Tách từ khóa 'Lời giải:' chuẩn xác
        const solM = rawContent.match(robustSolutionRegex);
        if (solM && solM.index !== undefined) {
          solution = rawContent.substring(solM.index + solM[0].length).trim();
          rawContent = rawContent.substring(0, solM.index).trim();
        }

        let underlineAnswer = '';
        const underM = rawContent.match(/<u>([^<]+)<\/u>/i);
        if (underM) {
          const cand = underM[1].trim();
          if (cand.length > 0 && cand.length <= 30) {
            underlineAnswer = cand;
          }
        }

        let correctAnswer = underlineAnswer;
        if (!correctAnswer) {
          const ansPatterns = [
            /(?:^|[\r\n\s])(?:Đáp án|Đáp số|Kết quả|Trả lời)\s*[:=]\s*([^\n]+)/i,
            /(?:^|[\r\n\s])(?:K\s*ế\s*t\s*q\s*u\s*ả\s*l\s*ấ\s*y\s*đ\s*ế\s*n\s*[^\:]*là|K\s*ế\s*t\s*q\s*u\s*ả\s*là|Đ\s*á\s*p\s*s\s*ố\s*là)\s*([^\n\.]+)/i
          ];

          for (const pat of ansPatterns) {
            const m = rawContent.match(pat) || (solution ? solution.match(pat) : null);
            if (m) {
              correctAnswer = m[1].replace(/[\$\,\.\s]+$/, '').trim();
              rawContent = rawContent.replace(pat, '').trim();
              break;
            }
          }
        }

        if (!correctAnswer) {
          correctAnswer = '10';
        }

        const { questionText, imageUrl, questionTextAfter } = splitStemByFigure(rawContent);

        return {
          questionText: questionText || rawContent.replace(/<img[^>]*>/gi, '').replace(/<\/?u>/gi, '').trim(),
          questionTextAfter,
          imageUrl,
          options: [],
          correctAnswer,
          questionType: 'trả lời ngắn' as const,
          solution: solution.replace(/<img[^>]*class=["'][^"']*pdf-figure-img[^"']*["'][^>]*>/gi, '').replace(/<\/?u>/gi, '').trim()
        };
      };

      // Hàm kiểm tra đặc trưng cấu trúc của một khối câu hỏi (phục vụ tự động phân loại khi tiêu đề phần bị thiếu/mờ)
      const classifyBlockStructure = (bText: string): 'p1' | 'p2' | 'p3' => {
        const cleanPart = bText.split(robustSolutionRegex)[0] || bText;
        // Kiểm tra có đủ a), b), c) của Phần II không
        const hasLowerA = /(?<=^|[\r\n\s]|<[^>]+>)a[\.\:\)]\s/.test(cleanPart);
        const hasLowerB = /(?<=^|[\r\n\s]|<[^>]+>)b[\.\:\)]\s/.test(cleanPart);
        const hasLowerC = /(?<=^|[\r\n\s]|<[^>]+>)c[\.\:\)]\s/.test(cleanPart);
        if (hasLowerA && hasLowerB && hasLowerC) {
          return 'p2';
        }
        // Kiểm tra có đủ A., B., C. của Phần I không
        const hasUpperA = /(?<=^|[\r\n\s]|<[^>]+>)A[\.\:\)]\s/.test(cleanPart);
        const hasUpperB = /(?<=^|[\r\n\s]|<[^>]+>)B[\.\:\)]\s/.test(cleanPart);
        const hasUpperC = /(?<=^|[\r\n\s]|<[^>]+>)C[\.\:\)]\s/.test(cleanPart);
        if (hasUpperA && hasUpperB && hasUpperC) {
          return 'p1';
        }
        return 'p3';
      };

      // 6. Bóc tách câu hỏi chuẩn xác cho từng phần
      const finalQuestions: any[] = [];

      let p1Blocks = rawP1.trim() ? extractQuestionBlocks(rawP1, 'p1') : [];
      let p2Blocks = rawP2.trim() ? extractQuestionBlocks(rawP2, 'p2') : [];
      let p3Blocks = rawP3.trim() ? extractQuestionBlocks(rawP3, 'p3') : [];

      const hasAllThreeExplicitSections = idx1 !== -1 && idx2 !== -1 && idx3 !== -1 && idx1 < idx2 && idx2 < idx3;

      // Nếu không bắt được đủ cả 3 tiêu đề Phần I, Phần II, Phần III (khiến câu hỏi bị dồn vào 1 phần),
      // tự động tách theo sự quay vòng số câu (Câu 1..18 -> Câu 1..4 -> Câu 1..6) kết hợp nhận diện cấu trúc A,B,C,D / a,b,c,d / trả lời ngắn
      if (!hasAllThreeExplicitSections) {
        if (p1Blocks.length > 0 && p2Blocks.length === 0 && p3Blocks.length === 0) {
          const autoP1: typeof p1Blocks = [];
          const autoP2: typeof p2Blocks = [];
          const autoP3: typeof p3Blocks = [];
          let currentStage: 'p1' | 'p2' | 'p3' = 'p1';

          p1Blocks.forEach((b, i) => {
            const structType = classifyBlockStructure(b.text);
            // Nếu số thứ tự câu quay về 1 (reset) sau câu đầu tiên
            if (i > 0 && b.num === 1 && p1Blocks[i - 1].num > 1) {
              if (currentStage === 'p1') currentStage = structType === 'p3' ? 'p3' : 'p2';
              else if (currentStage === 'p2') currentStage = 'p3';
            }

            if (structType === 'p2') {
              currentStage = 'p2';
              autoP2.push(b);
            } else if (structType === 'p1') {
              autoP1.push(b);
            } else {
              if (currentStage === 'p2' || currentStage === 'p3' || autoP2.length > 0) {
                currentStage = 'p3';
                autoP3.push(b);
              } else {
                autoP3.push(b);
              }
            }
          });

          if (autoP2.length > 0 || autoP3.length > 0) {
            p1Blocks = autoP1;
            p2Blocks = autoP2;
            p3Blocks = autoP3;
          }
        } else if (p1Blocks.length > 0 && p2Blocks.length > 0 && p3Blocks.length === 0) {
          // Trường hợp có Phần I và Phần II nhưng tiêu đề Phần III bị khuất nên Phần III dính vào cuối Phần II
          const realP2: typeof p2Blocks = [];
          const overflowP3: typeof p3Blocks = [];
          let enteredP3 = false;
          p2Blocks.forEach((b, i) => {
            const structType = classifyBlockStructure(b.text);
            if (i > 0 && ((b.num === 1 && p2Blocks[i - 1].num > 1) || structType === 'p3')) {
              enteredP3 = true;
            }
            if (enteredP3 && structType !== 'p2') {
              overflowP3.push(b);
            } else {
              realP2.push(b);
            }
          });
          if (overflowP3.length > 0) {
            p2Blocks = realP2;
            p3Blocks = overflowP3;
          }
        }
      }

      p1Blocks.forEach((b, idx) => {
        finalQuestions.push({
          ...parseP1Question(b.text, b.num || idx + 1),
          sectionGroup: 'PHẦN I: Câu hỏi trắc nghiệm nhiều phương án lựa chọn',
          section: `Phần I - Câu ${idx + 1}`
        });
      });

      p2Blocks.forEach((b, idx) => {
        finalQuestions.push({
          ...parseP2Question(b.text),
          sectionGroup: 'PHẦN II: Câu trắc nghiệm đúng sai',
          section: `Phần II - Câu ${idx + 1}`
        });
      });

      p3Blocks.forEach((b, idx) => {
        finalQuestions.push({
          ...parseP3Question(b.text),
          sectionGroup: 'PHẦN III: Câu trắc nghiệm trả lời ngắn',
          section: `Phần III - Câu ${idx + 1}`
        });
      });

      if (finalQuestions.length === 0) {
        setNotification({
          type: 'error',
          message: 'Không tìm thấy câu hỏi hợp lệ trong file đề thi. Vui lòng kiểm tra lại định dạng file.'
        });
        return;
      }

      setParsedQuestions(finalQuestions);
      setShowCreateExamModal(false);
      setShowSettingModal(true);
      setNotification({
        type: 'success',
        message: `Đã trích xuất chính xác ${finalQuestions.length} câu hỏi (Phần I: ${p1Blocks.length}, Phần II: ${p2Blocks.length}, Phần III: ${p3Blocks.length})!`
      });
    } catch (err: any) {
      console.warn('Lưu ý khi bóc tách tệp:', err);
      let userMsg = 'Lỗi bóc tách file đề thi.';
      if (err?.message === 'FILE_BINARY_DOC_LEGACY') {
        userMsg = 'Tệp bạn tải lên có định dạng Word cũ (.doc nhị phân). Vui lòng mở tệp bằng Word hoặc Google Docs, chọn "Lưu dưới dạng..." (Save As) thành file .docx (Word Document) rồi tải lại để hệ thống nhận diện đầy đủ nhất!';
      } else if (err?.message === 'FILE_PDF_UNREADABLE') {
        userMsg = 'Tệp PDF này không chứa văn bản có thể trích xuất (có thể là file scan hoặc hình ảnh). Vui lòng sử dụng file PDF có lớp văn bản hoặc file Word (.docx)!';
      } else if (err?.message === 'FILE_UNSUPPORTED_OR_EMPTY') {
        userMsg = 'Tệp rỗng hoặc định dạng không được hỗ trợ. Vui lòng tải file PDF hoặc Word (.docx) chuẩn Form 2025.';
      } else {
        userMsg = `Không thể bóc tách nội dung: ${err?.message || 'Vui lòng kiểm tra lại file PDF / Word (.docx)'}`;
      }
      setNotification({ type: 'error', message: userMsg });
    }
  };

  const handleDownloadForm2025Template = () => {
    const subjectName = selectedSubject || 'Vật lí';

    const escapeHtml = (str: string) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const p1Questions = DEFAULT_SAMPLE_QUESTIONS.filter(q => isSection1(q.section));
    const p2Questions = DEFAULT_SAMPLE_QUESTIONS.filter(q => isSection2(q.section));
    const p3Questions = DEFAULT_SAMPLE_QUESTIONS.filter(q => isSection3(q.section));

    const letters = ['A', 'B', 'C', 'D'];
    const subLetters = ['a', 'b', 'c', 'd'];

    let p1Html = '';
    p1Questions.forEach((q, idx) => {
      const formattedOptions = q.options.map((opt, oIdx) => {
        const letter = letters[oIdx] || 'A';
        const rawOpt = opt.match(/^[A-D][\.\)]/i) ? opt : `${letter}. ${opt}`;
        const escaped = escapeHtml(rawOpt);
        return escaped;
      });
      const imgHtml = q.imageUrl ? `<p><img src="${q.imageUrl}" style="max-height: 220px;" /></p>` : '';
      p1Html += `
        <p><b>Câu ${idx + 1}.</b> ${escapeHtml(q.questionText)}</p>
        ${imgHtml}
        <p style="margin-left: 20px;">
          ${formattedOptions.join('<br>')}
        </p>
        <p><b>Đáp án:</b> ${escapeHtml(q.correctAnswer)}</p>
        ${q.solution ? `<p><b>Lời giải:</b> ${escapeHtml(q.solution)}</p>` : ''}
        <br>
      `;
    });

    let p2Html = '';
    p2Questions.forEach((q, idx) => {
      const formattedOptions = q.options.map((opt, oIdx) => {
        const subL = subLetters[oIdx] || 'a';
        const rawOpt = opt.match(/^[a-d][\.\)]/i) ? opt : `${subL}) ${opt}`;
        return `${escapeHtml(rawOpt)} (Đúng / Sai)`;
      });
      const imgHtml = q.imageUrl ? `<p><img src="${q.imageUrl}" style="max-height: 220px;" /></p>` : '';
      p2Html += `
        <p><b>Câu ${idx + 1}.</b> ${escapeHtml(q.questionText)}</p>
        ${imgHtml}
        <p style="margin-left: 20px;">
          ${formattedOptions.join('<br>')}
        </p>
        <p><b>Đáp án:</b> ${escapeHtml(q.correctAnswer)}</p>
        ${q.solution ? `<p><b>Lời giải:</b> ${escapeHtml(q.solution)}</p>` : ''}
        <br>
      `;
    });

    let p3Html = '';
    p3Questions.forEach((q, idx) => {
      const imgHtml = q.imageUrl ? `<p><img src="${q.imageUrl}" style="max-height: 220px;" /></p>` : '';
      p3Html += `
        <p><b>Câu ${idx + 1}.</b> ${escapeHtml(q.questionText)}</p>
        ${imgHtml}
        <p><b>Đáp án:</b> ${escapeHtml(q.correctAnswer)}</p>
        ${q.solution ? `<p><b>Lời giải:</b> ${escapeHtml(q.solution)}</p>` : ''}
        <br>
      `;
    });

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Đề Kiểm Tra Chuẩn Form 2025 - Môn ${subjectName}</title>
      </head>
      <body style="font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.5; margin: 25px;">
        <div style="text-align: center; font-weight: bold; font-size: 13pt;">
          SỞ GIÁO DỤC VÀ ĐÀO TẠO THÀNH PHỐ HỒ CHÍ MINH<br>
          TRƯỜNG THPT PHÚ LÂM<br>
          ----------------------------------------
        </div>
        <br>
        <div style="text-align: center; font-weight: bold; font-size: 14pt;">
          KIỂM TRA ĐỊNH KỲ - NĂM HỌC 2026 - 2027<br>
          MÔN: ${subjectName.toUpperCase()} 12 - CHƯƠNG 1: VẬT LÍ NHIỆT (ĐỀ SỐ 1)<br>
          <span style="font-weight: normal; font-size: 11pt; font-style: italic;">Thời gian làm bài: 50 phút (Đề thi chuẩn cấu trúc Form 2025 gồm 3 phần)</span>
        </div>
        <hr style="margin: 20px 0;">
        
        <p style="font-size: 13pt;"><b>PHẦN I. Câu hỏi trắc nghiệm nhiều phương án lựa chọn.</b> (Thí sinh trả lời từ câu 1 đến câu 18. Mỗi câu hỏi thí sinh chỉ chọn một phương án)</p>
        ${p1Html}

        <hr style="margin: 20px 0;">
        <p style="font-size: 13pt;"><b>PHẦN II. Câu trắc nghiệm đúng sai.</b> (Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai)</p>
        ${p2Html}

        <hr style="margin: 20px 0;">
        <p style="font-size: 13pt;"><b>PHẦN III. Câu trắc nghiệm trả lời ngắn.</b> (Thí sinh trả lời từ câu 1 đến câu 6)</p>
        ${p3Html}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const isPhysics = subjectName.toLowerCase().includes('vật') || subjectName.toLowerCase().includes('lí');
    link.download = isPhysics ? 'VL12_CHUONG_1_DE_SO_1.doc' : `De_Kiem_Tra_Form_2025_${subjectName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setNotification({ type: 'success', message: `Đã tải đề thi mẫu chuẩn Form 2025 môn ${subjectName}: VL12 Chương 1 (đầy đủ 18 câu P1, 4 câu P2, 6 câu P3)!` });
  };

  const handleUpdateQuestion = (globalIdx: number, field: string, value: any) => {
    setParsedQuestions(prev => {
      const next = [...prev];
      next[globalIdx] = { ...next[globalIdx], [field]: value };
      return next;
    });
  };

  const handleUpdateOption = (globalIdx: number, optIdx: number, val: string) => {
    setParsedQuestions(prev => {
      const next = [...prev];
      const targetQ = next[globalIdx];
      const opts = [...(targetQ.options || [])];
      const letters = ['A', 'B', 'C', 'D'];
      const subLetters = ['a', 'b', 'c', 'd'];
      const isP2 = isSection2(targetQ.section);
      const prefix = isP2 ? `${subLetters[optIdx]}) ` : `${letters[optIdx]}. `;
      const clean = val.replace(/^[a-dA-D][\.\)]\s*/, '');
      opts[optIdx] = `${prefix}${clean}`;
      next[globalIdx] = { ...targetQ, options: opts };
      return next;
    });
  };

  const handleSelectPart1Answer = (globalIdx: number, letter: string) => {
    handleUpdateQuestion(globalIdx, 'correctAnswer', letter.toUpperCase());
  };

  const handleTogglePart2Answer = (globalIdx: number, subLetter: 'a' | 'b' | 'c' | 'd', value: 'Đúng' | 'Sai') => {
    setParsedQuestions(prev => {
      const next = [...prev];
      const targetQ = next[globalIdx];
      const current = parsePart2Answers(targetQ.correctAnswer || '');
      current[subLetter] = value;
      const newAnsStr = `a) ${current.a} - b) ${current.b} - c) ${current.c} - d) ${current.d}`;
      next[globalIdx] = { ...targetQ, correctAnswer: newAnsStr };
      return next;
    });
  };

  const handleDeleteQuestion = (globalIdx: number) => {
    setParsedQuestions(prev => prev.filter((_, idx) => idx !== globalIdx));
  };

  const handleAddNewQuestion = (sectionType: 'P1' | 'P2' | 'P3') => {
    setParsedQuestions(prev => {
      if (sectionType === 'P1') {
        const p1List = prev.filter(q => isSection1(q.section));
        const newQ = {
          questionText: `Nội dung câu hỏi trắc nghiệm mới số ${p1List.length + 1}...`,
          options: ['A. Phương án A', 'B. Phương án B', 'C. Phương án C', 'D. Phương án D'],
          correctAnswer: 'A',
          questionType: 'trắc nghiệm',
          solution: 'Lời giải chi tiết cho câu hỏi...',
          sectionGroup: 'PHẦN I: Câu hỏi trắc nghiệm nhiều phương án lựa chọn',
          section: `Phần I - Câu ${p1List.length + 1}`
        };
        const lastP1Idx = prev.map(q => isSection1(q.section)).lastIndexOf(true);
        const next = [...prev];
        if (lastP1Idx !== -1) {
          next.splice(lastP1Idx + 1, 0, newQ);
        } else {
          next.unshift(newQ);
        }
        return next;
      } else if (sectionType === 'P2') {
        const p2List = prev.filter(q => isSection2(q.section));
        const newQ = {
          questionText: `Nội dung câu hỏi đúng sai mới số ${p2List.length + 1}...`,
          options: ['a) Ý phát biểu a', 'b) Ý phát biểu b', 'c) Ý phát biểu c', 'd) Ý phát biểu d'],
          correctAnswer: 'a) Đúng - b) Sai - c) Đúng - d) Sai',
          questionType: 'đúng sai',
          solution: 'Lời giải chi tiết cho từng ý a, b, c, d...',
          sectionGroup: 'PHẦN II: Câu trắc nghiệm đúng sai',
          section: `Phần II - Câu ${p2List.length + 1}`
        };
        const lastP2Idx = prev.map(q => isSection2(q.section)).lastIndexOf(true);
        const next = [...prev];
        if (lastP2Idx !== -1) {
          next.splice(lastP2Idx + 1, 0, newQ);
        } else {
          next.push(newQ);
        }
        return next;
      } else {
        const p3List = prev.filter(q => isSection3(q.section));
        const newQ = {
          questionText: `Nội dung câu hỏi tính toán trả lời ngắn mới số ${p3List.length + 1}...`,
          options: [],
          correctAnswer: '10',
          questionType: 'trả lời ngắn',
          solution: 'Các bước tính toán chi tiết để ra kết quả...',
          sectionGroup: 'PHẦN III: Câu trắc nghiệm trả lời ngắn',
          section: `Phần III - Câu ${p3List.length + 1}`
        };
        return [...prev, newQ];
      }
    });
  };

  const handleSaveFinalExam = async () => {
    const user = auth.currentUser || authUser;
    if (!user || !settingTitle.trim()) return;

    setIsSavingExam(true);
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    const p1Count = parsedQuestions.filter(q => isSection1(q.section)).length;
    const p2Count = parsedQuestions.filter(q => isSection2(q.section)).length;
    const p3Count = parsedQuestions.filter(q => isSection3(q.section)).length;
    const countStr = `${p1Count}-${p2Count}-${p3Count}-0`;

    try {
      // 1. Tự động nén tất cả hình ảnh trong câu hỏi để đảm bảo không vượt quá 1MB của Firestore
      const optimizedQuestions = await compressExamQuestions(parsedQuestions);

      const payload = {
        title: settingTitle.trim(),
        teacherId: user.uid || 'teacher_giasudienvan',
        teacherEmail: user.email || 'giasudienvan@gmail.com',
        folderId: selectedFolderId !== 'all' ? selectedFolderId : null,
        createdAtStr: formattedDate,
        questionCountStr: countStr,
        durationMinutes: 45,
        isRecommended: false,
        grade: settingGrade,
        subject: settingSubject,
        examType: settingExamType,
        description: settingDescription,
        sectionPoints: sectionPoints,
        questions: optimizedQuestions,
        createdAt: serverTimestamp()
      };

      const estimatedBytes = estimateObjectSizeBytes(payload);

      // 2. Nếu đề thi có dung lượng lớn hơn 850KB, tự động lưu câu hỏi vào subcollection
      if (estimatedBytes > 850_000) {
        const docRef = await addDoc(collection(db, 'exams'), {
          ...payload,
          questions: [], // Doc chính chỉ chứa metadata để không vượt quá giới hạn 1MB
          hasSubcollectionQuestions: true
        });

        // Chia câu hỏi thành các chunk nhỏ lưu vào subcollection
        const chunkSize = 10;
        for (let i = 0; i < optimizedQuestions.length; i += chunkSize) {
          const chunk = optimizedQuestions.slice(i, i + chunkSize);
          await addDoc(collection(db, 'exams', docRef.id, 'questionChunks'), {
            chunkIndex: Math.floor(i / chunkSize),
            questions: chunk,
            createdAt: serverTimestamp()
          });
        }
      } else {
        await addDoc(collection(db, 'exams'), payload);
      }

      setShowSettingModal(false);
      setSelectedFile(null);
      setNotification({ type: 'success', message: `Đã lưu đề thi "${settingTitle.trim()}" thành công!` });
    } catch (error) {
      console.error('Lỗi lưu đề:', error);
      setNotification({ type: 'error', message: 'Không thể lưu đề thi.' });
    } finally {
      setIsSavingExam(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser || authUser;
    if (!user || !newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      await addDoc(collection(db, 'folders'), {
        name: newFolderName.trim(),
        teacherId: user.uid || 'teacher_giasudienvan',
        teacherEmail: user.email || 'giasudienvan@gmail.com',
        createdAt: serverTimestamp()
      });
      setNewFolderName('');
      setShowCreateFolderModal(false);
      setNotification({ type: 'success', message: `Đã tạo thư mục "${newFolderName.trim()}"!` });
    } catch (error) {
      console.error('Lỗi tạo thư mục:', error);
      setNotification({ type: 'error', message: 'Lỗi khi tạo thư mục.' });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleDeleteFolder = (folderId: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderToDelete({ id: folderId, name: folderName });
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      await deleteDoc(doc(db, 'folders', folderToDelete.id));
      const examsInFolder = exams.filter(ex => ex.folderId === folderToDelete.id);
      for (const ex of examsInFolder) {
        await updateDoc(doc(db, 'exams', ex.id), { folderId: 'default' });
      }
      if (selectedFolderId === folderToDelete.id) {
        setSelectedFolderId('all');
      }
      setNotification({ type: 'success', message: `Đã xóa thư mục "${folderToDelete.name}".` });
      setFolderToDelete(null);
    } catch (error) {
      console.error('Lỗi khi xóa thư mục:', error);
      setNotification({ type: 'error', message: 'Lỗi khi xóa thư mục.' });
    }
  };

  const confirmDeleteExam = async () => {
    if (!examToDelete) return;
    try {
      await deleteDoc(doc(db, 'exams', examToDelete.id));
      setNotification({ type: 'success', message: `Đã xóa đề thi "${examToDelete.title}" thành công.` });
      setExamToDelete(null);
    } catch (error) {
      console.error('Lỗi xóa đề:', error);
      setNotification({ type: 'error', message: 'Không thể xóa đề thi này.' });
    }
  };

  const deleteDefaultExams = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'exams'), where('teacherId', '==', user.uid), where('isRecommended', '==', true));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
    setNotification({ type: 'success', message: 'Đã xóa hết các đề mặc định.' });
  };

  const handleAssignExamToClass = async () => {
    if (!selectedExamForAction || !selectedClassIdToAssign) return;
    const targetClass = classesList.find((c) => c.id === selectedClassIdToAssign);
    if (!targetClass) return;

    try {
      const assigned = selectedExamForAction.assignedClassNames || [];
      const updatedAssigned = Array.from(new Set([...assigned, targetClass.name]));
      await updateDoc(doc(db, 'exams', selectedExamForAction.id), {
        assignedClassNames: updatedAssigned
      });
      setNotification({ type: 'success', message: `Đã giao đề cho lớp "${targetClass.name}"!` });
      setShowAssignModal(false);
      setSelectedClassIdToAssign('');
      setSelectedExamForAction(null);
    } catch (error) {
      console.error('Lỗi giao đề:', error);
      setNotification({ type: 'error', message: 'Lỗi khi giao đề.' });
    }
  };

  const filteredExams = exams.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolderId === 'all' || item.folderId === selectedFolderId;
    return matchesSearch && matchesFolder;
  });

  const recommendedExams = exams.filter((item) => item.isRecommended);

  return (
    <div className="flex-1 bg-white min-h-screen p-6 md:p-8 relative">
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm transition-all duration-200 ${
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

      <div className="flex items-center justify-between pb-6 border-b border-gray-100 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quản lý đề kiểm tra</h1>
        <button
          onClick={deleteDefaultExams}
          className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-xs font-medium hover:bg-rose-200 cursor-pointer"
        >
          Xóa đề mặc định
        </button>
        <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center font-bold text-xs text-teal-700">
          EDU
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-8">
        <div className="flex items-center flex-1 max-w-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nhập tên đề..."
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-l-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-3 rounded-r-lg flex items-center justify-center cursor-pointer">
            <Search className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-lg cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-gray-500" />
            <span>Tạo mới thư mục</span>
          </button>

          <button
            onClick={() => setShowCreateExamModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-medium text-sm rounded-lg shadow-sm cursor-pointer"
          >
            <FilePlus className="w-4 h-4" />
            <span>Tạo mới đề</span>
          </button>

          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden p-0.5 bg-white">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded cursor-pointer ${viewMode === 'grid' ? 'bg-teal-700 text-white' : 'text-gray-500'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded cursor-pointer ${viewMode === 'list' ? 'bg-teal-700 text-white' : 'text-gray-500'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {folders.length > 0 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedFolderId('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
              selectedFolderId === 'all' ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            Tất cả đề thi
          </button>
          {folders.map((f) => (
            <div
              key={f.id}
              onClick={() => setSelectedFolderId(f.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${
                selectedFolderId === f.id ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{f.name}</span>
              <button
                type="button"
                onClick={(e) => handleDeleteFolder(f.id, f.name, e)}
                className={`p-0.5 rounded hover:bg-black/10 transition-colors ml-1 ${
                  selectedFolderId === f.id ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-rose-600'
                }`}
                title={`Xóa thư mục ${f.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {recommendedExams.length > 0 && (
        <div className="mb-10">
          <h2 className="text-base font-bold text-gray-800 mb-4">Được đề xuất</h2>
          <div className="relative group">
            <button
              onClick={() => scrollCarousel('left')}
              className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div ref={carouselRef} className="flex items-center gap-4 overflow-x-auto scroll-smooth no-scrollbar py-2 px-1">
              {recommendedExams.map((item) => (
                <div key={item.id} className="min-w-[280px] max-w-[300px] bg-white rounded-xl border border-gray-200 p-4 shadow-2xs relative shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100 mb-2">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-gray-900 truncate">{item.title}</h3>
                  <div className="text-xs text-gray-500 mt-1">Ngày tạo: {item.createdAtStr}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Số câu: {item.questionCountStr}</div>

                  <div className="absolute top-3 right-3 exam-card-menu">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === item.id ? null : item.id);
                      }}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                    {activeMenuId === item.id && (
                      <div className="absolute right-0 top-7 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30 text-xs font-medium">
                        <button
                          onClick={() => {
                            setSelectedExamForAction(item);
                            setShowAssignModal(true);
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-gray-50 text-gray-700"
                        >
                          <Send className="w-3.5 h-3.5 text-blue-600" />
                          <span>Giao đề cho lớp</span>
                        </button>
                        <button
                          onClick={() => {
                            setExamToDelete(item);
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-rose-50 text-rose-600 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa đề thi</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => scrollCarousel('right')}
              className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <h2 className="text-base font-bold text-gray-800 mb-4">Danh sách đề kiểm tra</h2>
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Đang tải dữ liệu kho đề...</div>
      ) : filteredExams.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm">
          Không tìm thấy đề thi nào phù hợp.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredExams.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs relative flex flex-col justify-between hover:border-teal-300 transition-all">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="exam-card-menu relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === item.id ? null : item.id);
                      }}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                    {activeMenuId === item.id && (
                      <div className="absolute right-0 top-7 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30 text-xs font-medium">
                        <button
                          onClick={() => {
                            setSelectedExamForAction(item);
                            setShowDetailModal(true);
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-gray-50 text-gray-700"
                        >
                          <Eye className="w-3.5 h-3.5 text-teal-600" />
                          <span>Xem chi tiết đề</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedExamForAction(item);
                            setShowAssignModal(true);
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-gray-50 text-gray-700"
                        >
                          <Send className="w-3.5 h-3.5 text-blue-600" />
                          <span>Giao đề cho lớp</span>
                        </button>
                        <button
                          onClick={() => {
                            setExamToDelete(item);
                            setActiveMenuId(null);
                          }}
                          className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-rose-50 text-rose-600 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa đề thi</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-sm text-gray-900 line-clamp-2 mb-1" title={item.title}>
                  {item.title}
                </h3>
                <div className="text-xs text-gray-500">Ngày tạo: {item.createdAtStr}</div>
                <div className="text-xs text-gray-500">Cấu trúc: {item.questionCountStr}</div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                  {item.subject || 'Đề chung'}
                </span>
                <button
                  onClick={() => {
                    setSelectedExamForAction(item);
                    setShowDetailModal(true);
                  }}
                  className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Xem</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
                <th className="py-3 px-4">Tên đề kiểm tra</th>
                <th className="py-3 px-4">Môn học</th>
                <th className="py-3 px-4">Ngày tạo</th>
                <th className="py-3 px-4">Cấu trúc (P1-P2-P3)</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExams.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="truncate max-w-xs">{item.title}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{item.subject || 'Chưa cập nhật'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{item.createdAtStr}</td>
                  <td className="py-3 px-4 text-gray-600 font-mono text-xs">{item.questionCountStr}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedExamForAction(item);
                          setShowDetailModal(true);
                        }}
                        className="p-1.5 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 cursor-pointer"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedExamForAction(item);
                          setShowAssignModal(true);
                        }}
                        className="p-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
                        title="Giao đề"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setExamToDelete(item)}
                        className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                        title="Xóa đề"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateExamModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-teal-600" />
                <span>Tải lên đề kiểm tra mới (.docx, .doc, .pdf)</span>
              </h3>
              <button onClick={() => setShowCreateExamModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProceedToSetting} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Chọn môn học cho đề kiểm tra:</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="">-- Chọn môn học --</option>
                  <option value="Vật lí">Vật lí</option>
                  <option value="Toán">Toán</option>
                  <option value="Hóa học">Hóa học</option>
                  <option value="Sinh học">Sinh học</option>
                  <option value="Lịch sử">Lịch sử</option>
                  <option value="Địa lí">Địa lí</option>
                  <option value="GDCD">Giáo dục kinh tế và pháp luật</option>
                </select>
              </div>

              {selectedSubject && (
                <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-teal-900">File Word chuẩn Form 2025:</div>
                    <div className="text-[11px] text-teal-700 mt-0.5">Tải file mẫu để điền đề đúng định dạng cấu trúc 3 phần.</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadForm2025Template}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-lg shadow-xs cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải file mẫu .doc</span>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tải file đề (.docx, .doc, .txt, .pdf):</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setSelectedFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                    isDragging ? 'border-teal-500 bg-teal-50/50' : 'border-gray-300 hover:border-teal-400 bg-gray-50/50'
                  }`}
                >
                  <input
                    type="file"
                    accept=".docx,.doc,.txt,.pdf"
                    onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                    className="hidden"
                    id="exam-file-input"
                  />
                  <label htmlFor="exam-file-input" className="cursor-pointer flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    {selectedFile ? (
                      <div className="text-sm font-bold text-teal-800">{selectedFile.name}</div>
                    ) : (
                      <>
                        <div className="text-xs font-medium text-gray-700 mb-1">Kéo thả file vào đây hoặc <span className="text-teal-700 font-bold">chọn file</span></div>
                        <div className="text-[11px] text-gray-400">Hỗ trợ định dạng Word (.docx, .doc), văn bản (.txt) và PDF (.pdf)</div>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateExamModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || !selectedSubject}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  Tiếp tục: Cài đặt đề thi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 bg-gray-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-gray-900 flex items-center gap-2">
                    <span>Cấu hình & Chỉnh sửa đề thi</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                      Chuẩn Form 2025
                    </span>
                  </h3>
                  <div className="text-[11px] text-gray-500 hidden sm:block">
                    Thầy/Cô có thể chỉnh sửa trực tiếp nội dung câu hỏi, phương án, đổi đáp án và lời giải
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSettingModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 cursor-pointer transition-colors"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Exam Metadata */}
              <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tên đề thi:</label>
                    <input
                      type="text"
                      value={settingTitle}
                      onChange={(e) => setSettingTitle(e.target.value)}
                      placeholder="Nhập tên đề kiểm tra..."
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Khối lớp:</label>
                    <select
                      value={settingGrade}
                      onChange={(e) => setSettingGrade(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="10">Lớp 10</option>
                      <option value="11">Lớp 11</option>
                      <option value="12">Lớp 12</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Môn học:</label>
                    <input
                      type="text"
                      value={settingSubject}
                      onChange={(e) => setSettingSubject(e.target.value)}
                      placeholder="Ví dụ: Vật lí..."
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mô tả chi tiết đề thi:</label>
                  <input
                    type="text"
                    value={settingDescription}
                    onChange={(e) => setSettingDescription(e.target.value)}
                    placeholder="Mô tả tóm tắt nội dung kiến thức của đề thi..."
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Toolbar: Tabs, View Mode, Tip */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  {/* Section Tabs */}
                  {(() => {
                    const p1Total = parsedQuestions.filter(q => isSection1(q.section)).length;
                    const p2Total = parsedQuestions.filter(q => isSection2(q.section)).length;
                    const p3Total = parsedQuestions.filter(q => isSection3(q.section)).length;
                    return (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSettingTab('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            settingTab === 'all'
                              ? 'bg-teal-700 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Tất cả ({parsedQuestions.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettingTab('p1')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            settingTab === 'p1'
                              ? 'bg-teal-700 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Phần I ({p1Total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettingTab('p2')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            settingTab === 'p2'
                              ? 'bg-teal-700 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Phần II ({p2Total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettingTab('p3')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            settingTab === 'p3'
                              ? 'bg-teal-700 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Phần III ({p3Total})
                        </button>
                      </div>
                    );
                  })()}

                  {/* View Mode Toggle & Add Action */}
                  <div className="flex items-center gap-2">
                    <div className="bg-gray-100 p-0.5 rounded-lg flex items-center border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setSettingViewMode('edit')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                          settingViewMode === 'edit'
                            ? 'bg-white text-teal-800 shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Chỉnh sửa trực tiếp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettingViewMode('preview')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                          settingViewMode === 'preview'
                            ? 'bg-white text-teal-800 shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem trước đề</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Helper Tip */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-3.5 py-2.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">Đáp án:</span> Hệ thống tự động nhận diện đáp án từ file Word. Thầy/Cô có thể bấm vào chữ cái (A, B, C, D) hoặc nút [Đúng/Sai] để đổi đáp án nhanh, hoặc chỉnh sửa trực tiếp nội dung câu hỏi và lời giải chi tiết bên dưới.
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-6">
                {['Phần I', 'Phần II', 'Phần III'].map((sectionTitle) => {
                  if (settingTab === 'p1' && sectionTitle !== 'Phần I') return null;
                  if (settingTab === 'p2' && sectionTitle !== 'Phần II') return null;
                  if (settingTab === 'p3' && sectionTitle !== 'Phần III') return null;

                  const sectionQuestions = parsedQuestions.filter(q => {
                    if (sectionTitle === 'Phần I') return isSection1(q.section);
                    if (sectionTitle === 'Phần II') return isSection2(q.section);
                    if (sectionTitle === 'Phần III') return isSection3(q.section);
                    return false;
                  });

                  const headerMap: any = {
                    'Phần I': `PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (${sectionQuestions.length} CÂU)`,
                    'Phần II': `PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI (${sectionQuestions.length} CÂU)`,
                    'Phần III': `PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN (${sectionQuestions.length} CÂU)`
                  };

                  const sectionType: 'P1' | 'P2' | 'P3' = sectionTitle === 'Phần I' ? 'P1' : sectionTitle === 'Phần II' ? 'P2' : 'P3';

                  return (
                    <div key={sectionTitle} className="space-y-4">
                      {/* Section Header */}
                      <div className="bg-teal-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-between shadow-xs sticky top-0 z-10">
                        <span className="text-xs font-bold tracking-wide">{headerMap[sectionTitle]}</span>
                        <button
                          type="button"
                          onClick={() => handleAddNewQuestion(sectionType)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white text-[11px] font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm câu {sectionTitle}</span>
                        </button>
                      </div>

                      {sectionQuestions.length === 0 ? (
                        <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center text-xs text-gray-500">
                          Chưa có câu hỏi nào trong {sectionTitle}.
                        </div>
                      ) : (
                        sectionQuestions.map((q, idx) => {
                          const globalIdx = parsedQuestions.indexOf(q);

                          if (settingViewMode === 'preview') {
                            return (
                              <div key={globalIdx} className="p-4 bg-gray-50/90 border border-gray-200 rounded-xl space-y-2.5">
                                <div className="flex items-center justify-between text-xs font-bold text-teal-800">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded">Câu {idx + 1}</span>
                                    <span className="text-gray-500 font-normal">({sectionTitle})</span>
                                    <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold border border-amber-300 shadow-2xs">
                                      {sectionType === 'P1'
                                        ? `${sectionPoints.p1} điểm`
                                        : sectionType === 'P2'
                                        ? `1.0 điểm (${sectionPoints.p2.opt1}đ - ${sectionPoints.p2.opt2}đ - ${sectionPoints.p2.opt3}đ - ${sectionPoints.p2.opt4}đ)`
                                        : `${sectionPoints.p3} điểm`}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-700 font-normal flex items-center gap-1.5">
                                    <span>Đáp án đúng:</span>
                                    <span className="font-bold text-teal-700">
                                      {q.correctAnswer}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-xs text-gray-900 font-medium leading-relaxed pl-1">
                                  <MathText text={q.questionText} />
                                </div>

                                {q.imageUrl && (
                                  <div className="my-2 flex justify-center bg-white p-3 rounded-xl border border-gray-200">
                                    <img
                                      src={q.imageUrl}
                                      alt={`Hình minh họa câu ${idx + 1}`}
                                      className="max-h-64 max-w-full object-contain rounded-lg"
                                    />
                                  </div>
                                )}

                                {q.questionTextAfter && (
                                  <div className="text-xs text-gray-900 font-medium leading-relaxed pl-1">
                                    <MathText text={q.questionTextAfter} />
                                  </div>
                                )}

                                {q.options && q.options.length > 0 && (
                                  <div className="grid grid-cols-1 gap-2 pl-2 text-xs">
                                    {q.options.map((opt: string, oIdx: number) => {
                                      const letters = ['A', 'B', 'C', 'D'];
                                      const subLetters = ['a', 'b', 'c', 'd'];
                                      const isP1 = sectionType === 'P1';
                                      const isP2 = sectionType === 'P2';
                                      const currentLetter = isP1 ? letters[oIdx] : subLetters[oIdx];
                                      const isChosenP1 = isP1 && q.correctAnswer && q.correctAnswer.trim().toUpperCase() === currentLetter;
                                      
                                      const p2Answers = isP2 ? parsePart2Answers(q.correctAnswer) : null;
                                      const p2Status = p2Answers && p2Answers[currentLetter];

                                      return (
                                        <div
                                          key={oIdx}
                                          className={`p-2 rounded-lg border text-xs leading-relaxed flex items-start gap-1.5 ${
                                            isChosenP1
                                              ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                                              : 'bg-white border-gray-200 text-gray-700'
                                          }`}
                                        >
                                          <span className={`font-bold ${isChosenP1 ? 'text-teal-800' : ''}`}>
                                            {isP1 ? `${currentLetter}. ` : `${currentLetter}) `}
                                          </span>
                                          <span className="flex-1">
                                            <MathText text={opt.replace(/^[a-dA-D][\.\)]\s*/, '')} />
                                          </span>
                                          {isChosenP1 && (
                                            <span className="text-[10px] bg-teal-600 text-white font-bold px-1.5 py-0.5 rounded">
                                              Đáp án đúng
                                            </span>
                                          )}
                                          {isP2 && p2Status && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                              p2Status === 'Đúng' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                            }`}>
                                              {p2Status}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {q.solution && (
                                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-teal-900 bg-teal-50/70 p-2.5 rounded-lg leading-relaxed">
                                    <b className="text-teal-800 font-bold">💡 Lời giải chi tiết: </b>
                                    <MathText text={q.solution} />
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // Chế độ chỉnh sửa trực tiếp (Direct Edit Mode)
                          return (
                            <div
                              key={globalIdx}
                              className="p-4 sm:p-5 bg-white border-2 border-gray-200 hover:border-teal-400 rounded-xl shadow-xs space-y-3.5 transition-colors"
                            >
                              {/* Top Bar of Card */}
                              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2.5 py-1 bg-teal-700 text-white font-bold text-xs rounded-lg shadow-2xs">
                                    Câu {idx + 1}
                                  </span>
                                  <span className="text-[11px] font-semibold text-gray-500">
                                    {sectionTitle}
                                  </span>
                                  <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold border border-amber-300 shadow-2xs">
                                    {sectionType === 'P1'
                                      ? `${sectionPoints.p1} điểm`
                                      : sectionType === 'P2'
                                      ? `1.0 điểm (${sectionPoints.p2.opt1}đ - ${sectionPoints.p2.opt2}đ - ${sectionPoints.p2.opt3}đ - ${sectionPoints.p2.opt4}đ)`
                                      : `${sectionPoints.p3} điểm`}
                                  </span>
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-medium border border-teal-200">
                                    Đáp án đúng: <b className="font-bold text-teal-700">{q.correctAnswer}</b>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(globalIdx)}
                                  className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded cursor-pointer transition-colors"
                                  title="Xóa câu hỏi này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa</span>
                                </button>
                              </div>

                              {/* Question Content */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[11px] font-bold text-gray-700">
                                    Nội dung câu hỏi:
                                  </label>
                                  {!q.imageUrl && (
                                    <label className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-teal-50 text-teal-700 border border-teal-300 rounded-md text-[11px] font-semibold cursor-pointer transition-colors">
                                      <UploadCloud className="w-3 h-3" />
                                      <span>Thêm ảnh minh họa</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const imgFile = e.target.files?.[0];
                                          if (!imgFile) return;
                                          const reader = new FileReader();
                                          reader.onload = () => {
                                            if (typeof reader.result === 'string') {
                                              handleUpdateQuestion(globalIdx, 'imageUrl', reader.result);
                                            }
                                          };
                                          reader.readAsDataURL(imgFile);
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                                <textarea
                                  rows={3}
                                  value={q.questionText}
                                  onChange={(e) => handleUpdateQuestion(globalIdx, 'questionText', e.target.value)}
                                  placeholder="Nhập nội dung câu hỏi..."
                                  className="w-full min-h-[80px] px-3 py-2 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed resize-y"
                                />
                                <MathPreview content={q.questionText} label="Xem trước câu hỏi (MathType / KaTeX):" />
                              </div>

                              {/* Hình ảnh / Đồ thị / Bảng dữ liệu nằm đúng vị trí định dạng trong câu hỏi */}
                              {q.imageUrl && (
                                <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-[11px] font-bold text-gray-700">
                                      🖼️ Hình ảnh / Đồ thị / Bảng dữ liệu trong câu hỏi:
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-700 border border-teal-300 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors">
                                        <UploadCloud className="w-3.5 h-3.5" />
                                        <span>Đổi ảnh khác</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const imgFile = e.target.files?.[0];
                                            if (!imgFile) return;
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                              if (typeof reader.result === 'string') {
                                                handleUpdateQuestion(globalIdx, 'imageUrl', reader.result);
                                              }
                                            };
                                            reader.readAsDataURL(imgFile);
                                          }}
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQuestion(globalIdx, 'imageUrl', undefined)}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                        <span>Xóa ảnh</span>
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex justify-center bg-white p-2.5 rounded-lg border border-gray-200">
                                    <img
                                      src={q.imageUrl}
                                      alt={`Hình minh họa câu ${idx + 1}`}
                                      className="max-h-60 max-w-full object-contain rounded"
                                    />
                                  </div>
                                </div>
                              )}

                              {q.questionTextAfter !== undefined && q.questionTextAfter !== '' && (
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                    Nội dung câu hỏi phía dưới hình / bảng:
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={q.questionTextAfter}
                                    onChange={(e) => handleUpdateQuestion(globalIdx, 'questionTextAfter', e.target.value)}
                                    placeholder="Nội dung câu hỏi tiếp theo dưới hình ảnh..."
                                    className="w-full min-h-[60px] px-3 py-2 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed resize-y"
                                  />
                                  <MathPreview content={q.questionTextAfter} label="Xem trước phần dưới hình:" />
                                </div>
                              )}

                              {/* Options & Answers Section */}
                              {sectionType === 'P1' && (
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-700 mb-1.5">
                                    Phương án lựa chọn <span className="text-gray-400 font-normal">(Mỗi đáp án 1 dòng riêng — Bấm vào chữ cái để chọn đáp án đúng):</span>
                                  </label>
                                  <div className="space-y-2">
                                    {['A', 'B', 'C', 'D'].map((letter, oIdx) => {
                                      const isChosen = q.correctAnswer && q.correctAnswer.trim().toUpperCase() === letter;
                                      const rawOpt = (q.options && q.options[oIdx]) || '';
                                      const cleanBody = rawOpt.replace(/^[A-D][\.\)]\s*/i, '');
                                      const autoRows = Math.max(2, Math.ceil((cleanBody.length || 1) / 95));

                                      return (
                                        <div
                                          key={letter}
                                          className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors ${
                                            isChosen ? 'bg-teal-50/70 border-teal-400' : 'bg-gray-50 border-gray-200'
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => handleSelectPart1Answer(globalIdx, letter)}
                                            className={`mt-1 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                                              isChosen
                                                ? 'bg-teal-700 text-white shadow-xs ring-2 ring-teal-400'
                                                : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                                            }`}
                                            title={isChosen ? 'Đáp án đúng' : `Click để chọn ${letter} là đáp án đúng`}
                                          >
                                            {letter}
                                          </button>
                                          <textarea
                                            rows={autoRows}
                                            value={cleanBody}
                                            onChange={(e) => handleUpdateOption(globalIdx, oIdx, e.target.value)}
                                            placeholder={`Phương án ${letter}...`}
                                            className="flex-1 min-h-[44px] px-3 py-2 text-xs text-gray-800 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:outline-none leading-relaxed resize-y"
                                          />
                                          {isChosen && (
                                            <span className="mt-1.5 text-[10px] text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded shrink-0">
                                              Đáp án
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {sectionType === 'P2' && (
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-700 mb-1.5">
                                    4 ý lựa chọn đúng / sai <span className="text-gray-400 font-normal">(Bấm chọn Đúng hoặc Sai cho từng ý):</span>
                                  </label>
                                  <div className="space-y-2">
                                    {['a', 'b', 'c', 'd'].map((letter, oIdx) => {
                                      const tfMap = parsePart2Answers(q.correctAnswer);
                                      const isTrue = tfMap[letter] === 'Đúng';
                                      const rawOpt = (q.options && q.options[oIdx]) || '';
                                      const cleanBody = rawOpt.replace(/^[a-d][\.\)]\s*/i, '');

                                      return (
                                        <div
                                          key={letter}
                                          className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200"
                                        >
                                          <span className="w-6 text-center font-bold text-xs text-teal-800 shrink-0">
                                            {letter})
                                          </span>
                                          <textarea
                                            rows={2}
                                            value={cleanBody}
                                            onChange={(e) => handleUpdateOption(globalIdx, oIdx, e.target.value)}
                                            placeholder={`Nội dung ý ${letter}...`}
                                            className="flex-1 min-w-[200px] min-h-[44px] px-2.5 py-2 text-xs text-gray-800 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:outline-none leading-relaxed resize-y"
                                          />
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleTogglePart2Answer(globalIdx, letter as any, 'Đúng')}
                                              className={`px-2.5 py-1 text-xs rounded-md font-semibold cursor-pointer transition-colors ${
                                                isTrue
                                                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                                              }`}
                                            >
                                              ✓ Đúng
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleTogglePart2Answer(globalIdx, letter as any, 'Sai')}
                                              className={`px-2.5 py-1 text-xs rounded-md font-semibold cursor-pointer transition-colors ${
                                                !isTrue
                                                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                                                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                                              }`}
                                            >
                                              ✕ Sai
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {sectionType === 'P3' && (
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                    Đáp án đúng (Kết quả tính toán ngắn):
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-300 rounded-lg">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                                      <span className="text-xs font-semibold text-teal-900">Đáp án:</span>
                                      <input
                                        type="text"
                                        value={q.correctAnswer}
                                        onChange={(e) => handleUpdateQuestion(globalIdx, 'correctAnswer', e.target.value)}
                                        placeholder="Ví dụ: 126 hoặc 2,15..."
                                        className="w-40 px-2 py-1 bg-white border border-teal-300 rounded text-xs font-bold text-teal-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                      />
                                    </div>
                                    <span className="text-[11px] text-gray-400">
                                      Nhập kết quả số hoặc chuỗi ngắn của câu hỏi
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Solution Textarea */}
                              <div>
                                <label className="block text-[11px] font-bold text-teal-800 mb-1">
                                  💡 Lời giải / Hướng dẫn giải chi tiết:
                                </label>
                                <textarea
                                  rows={4}
                                  value={q.solution || ''}
                                  onChange={(e) => handleUpdateQuestion(globalIdx, 'solution', e.target.value)}
                                  placeholder="Nhập lời giải chi tiết, các bước tính toán để học sinh tham khảo sau khi nộp bài..."
                                  className="w-full min-h-[100px] px-3 py-2.5 text-xs font-medium text-gray-800 bg-teal-50/40 border border-teal-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed resize-y"
                                />
                                <MathPreview content={q.solution || ''} label="Xem trước lời giải (MathType / KaTeX):" />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 bg-gray-50 shrink-0">
              <div className="text-xs text-gray-600 font-medium">
                Tổng cộng: <b className="text-teal-800 font-bold">{parsedQuestions.length} câu</b>
                {(() => {
                  const p1 = parsedQuestions.filter(q => isSection1(q.section)).length;
                  const p2 = parsedQuestions.filter(q => isSection2(q.section)).length;
                  const p3 = parsedQuestions.filter(q => isSection3(q.section)).length;
                  return (
                    <span className="text-gray-400 ml-1">
                      (P1: {p1} | P2: {p2} | P3: {p3})
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSettingModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveFinalExam}
                  disabled={isSavingExam || parsedQuestions.length === 0}
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {isSavingExam ? <span>Đang lưu...</span> : <span>Lưu vào kho đề</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-base text-gray-900">Tạo thư mục mới</h3>
              <button onClick={() => setShowCreateFolderModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tên thư mục:</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ví dụ: Đề ôn thi học kỳ 1..."
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateFolderModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder}
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isCreatingFolder ? 'Đang tạo...' : 'Tạo thư mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && selectedExamForAction && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-base text-gray-900">Giao đề cho lớp học</h3>
              <button onClick={() => setShowAssignModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Đề kiểm tra:</div>
                <div className="font-bold text-sm text-gray-900">{selectedExamForAction.title}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Chọn lớp học:</label>
                <select
                  value={selectedClassIdToAssign}
                  onChange={(e) => setSelectedClassIdToAssign(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- Chọn lớp học --</option>
                  {classesList.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAssignExamToClass}
                  disabled={!selectedClassIdToAssign}
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  Xác nhận giao đề
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedExamForAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="font-bold text-base text-gray-900">{selectedExamForAction.title}</h3>
                <div className="text-xs text-gray-500 mt-0.5">Ngày tạo: {selectedExamForAction.createdAtStr} | Môn: {selectedExamForAction.subject || 'Chưa cập nhật'}</div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {selectedExamForAction.questions && selectedExamForAction.questions.length > 0 ? (
                ['Phần I', 'Phần II', 'Phần III'].some(s => selectedExamForAction.questions!.some(q => (s === 'Phần I' ? isSection1(q.section) : s === 'Phần II' ? isSection2(q.section) : isSection3(q.section)))) ? (
                  ['Phần I', 'Phần II', 'Phần III'].map((sectionTitle) => {
                    const sectionQuestions = selectedExamForAction.questions!.filter(q => {
                      if (sectionTitle === 'Phần I') return isSection1(q.section);
                      if (sectionTitle === 'Phần II') return isSection2(q.section);
                      if (sectionTitle === 'Phần III') return isSection3(q.section);
                      return false;
                    });
                    if (sectionQuestions.length === 0) return null;

                    const headerMap: any = {
                      'Phần I': `PHẦN I. Câu hỏi trắc nghiệm nhiều phương án lựa chọn (${sectionQuestions.length} câu)`,
                      'Phần II': `PHẦN II. Câu trắc nghiệm đúng sai (${sectionQuestions.length} câu)`,
                      'Phần III': `PHẦN III. Câu trắc nghiệm trả lời ngắn (${sectionQuestions.length} câu)`
                    };

                    return (
                      <div key={sectionTitle} className="space-y-3">
                        <div className="bg-teal-700 text-white text-xs font-bold px-3 py-2 rounded-lg sticky top-0 z-10 shadow-sm">
                          {headerMap[sectionTitle]}
                        </div>
                        {sectionQuestions.map((q, idx) => {
                          const isP1 = sectionTitle === 'Phần I';
                          const isP2 = sectionTitle === 'Phần II';
                          const letters = ['A', 'B', 'C', 'D'];
                          const subLetters = ['a', 'b', 'c', 'd'];
                          const p2Answers = isP2 ? parsePart2Answers(q.correctAnswer) : null;

                          return (
                            <div key={idx} className="p-4 bg-gray-50/90 border border-gray-200 rounded-xl space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-bold text-teal-800">
                                <div className="flex items-center gap-2">
                                  <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded">Câu {idx + 1}</span>
                                  <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold border border-amber-300 shadow-2xs">
                                    {isP1
                                      ? `${selectedExamForAction?.sectionPoints?.p1 ?? 0.25} điểm`
                                      : isP2
                                      ? `1.0 điểm (${selectedExamForAction?.sectionPoints?.p2?.opt1 ?? 0.1}đ - ${selectedExamForAction?.sectionPoints?.p2?.opt2 ?? 0.25}đ - ${selectedExamForAction?.sectionPoints?.p2?.opt3 ?? 0.5}đ - ${selectedExamForAction?.sectionPoints?.p2?.opt4 ?? 1.0}đ)`
                                      : `${selectedExamForAction?.sectionPoints?.p3 ?? 0.25} điểm`}
                                  </span>
                                </div>
                                <span className="text-gray-600 font-normal">
                                  Đáp án đúng: <b className="text-teal-700">{q.correctAnswer}</b>
                                </span>
                              </div>
                              <div className="text-xs text-gray-900 font-medium leading-relaxed pl-1">
                                <MathText text={q.questionText} />
                              </div>
                              {q.imageUrl && (
                                <div className="my-2 flex justify-center bg-white p-3 rounded-xl border border-gray-200">
                                  <img
                                    src={q.imageUrl}
                                    alt={`Hình minh họa câu ${idx + 1}`}
                                    className="max-h-64 max-w-full object-contain rounded-lg"
                                  />
                                </div>
                              )}
                              {q.questionTextAfter && (
                                <div className="text-xs text-gray-900 font-medium leading-relaxed pl-1">
                                  <MathText text={q.questionTextAfter} />
                                </div>
                              )}
                              {q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-1 gap-2 pl-2 text-xs text-gray-700">
                                  {q.options.map((opt, oIdx) => {
                                    const currentLetter = isP1 ? letters[oIdx] : subLetters[oIdx];
                                    const isChosenP1 = isP1 && q.correctAnswer && q.correctAnswer.trim().toUpperCase() === currentLetter;
                                    const p2Status = p2Answers && p2Answers[currentLetter];

                                    return (
                                      <div
                                        key={oIdx}
                                        className={`p-2 rounded-lg border text-xs leading-relaxed flex items-start gap-1.5 ${
                                          isChosenP1
                                            ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                                            : 'bg-white border-gray-200 text-gray-700'
                                        }`}
                                      >
                                        <span className={`font-bold ${isChosenP1 ? 'text-teal-800' : ''}`}>
                                          {isP1 ? `${currentLetter}. ` : `${currentLetter}) `}
                                        </span>
                                        <span className="flex-1">
                                          <MathText text={opt.replace(/^[a-dA-D][\.\)]\s*/, '')} />
                                        </span>
                                        {isChosenP1 && (
                                          <span className="text-[10px] bg-teal-600 text-white font-bold px-1.5 py-0.5 rounded shrink-0">
                                            Đáp án đúng
                                          </span>
                                        )}
                                        {isP2 && p2Status && (
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                            p2Status === 'Đúng' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                          }`}>
                                            {p2Status}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {q.solution && (
                                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-teal-900 bg-teal-50/70 p-2.5 rounded-lg leading-relaxed">
                                  <b className="text-teal-800 font-bold">💡 Lời giải chi tiết: </b>
                                  <MathText text={q.solution} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                ) : (
                  selectedExamForAction.questions.map((q, idx) => (
                    <div key={idx} className="p-4 bg-gray-50/90 border border-gray-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-teal-800">
                        <div className="flex items-center gap-2">
                          <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded">{q.section || `Câu ${idx + 1}`}</span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold border border-amber-300 shadow-2xs">
                            {isSection1(q.section)
                              ? `${selectedExamForAction?.sectionPoints?.p1 ?? 0.25} điểm`
                              : isSection2(q.section)
                              ? `1.0 điểm (${selectedExamForAction?.sectionPoints?.p2?.opt1 ?? 0.1}đ - ${selectedExamForAction?.sectionPoints?.p2?.opt2 ?? 0.25}đ - ${selectedExamForAction?.sectionPoints?.p2?.opt3 ?? 0.5}đ - ${selectedExamForAction?.sectionPoints?.p2?.opt4 ?? 1.0}đ)`
                              : `${selectedExamForAction?.sectionPoints?.p3 ?? 0.25} điểm`}
                          </span>
                        </div>
                        <span className="text-gray-600 font-normal">
                          Đáp án đúng: <b className="text-teal-700">{q.correctAnswer}</b>
                        </span>
                      </div>
                      <div className="text-xs text-gray-900 font-medium leading-relaxed pl-1">
                        <MathText text={q.questionText} />
                      </div>
                      {q.imageUrl && (
                        <div className="my-2 flex justify-center bg-white p-3 rounded-xl border border-gray-200">
                          <img
                            src={q.imageUrl}
                            alt={`Hình minh họa câu ${idx + 1}`}
                            className="max-h-64 max-w-full object-contain rounded-lg"
                          />
                        </div>
                      )}
                      {q.questionTextAfter && (
                        <div className="text-xs text-gray-900 font-medium leading-relaxed pl-1">
                          <MathText text={q.questionTextAfter} />
                        </div>
                      )}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 text-xs text-gray-700">
                          {q.options.map((opt, oIdx) => {
                            const letters = ['A', 'B', 'C', 'D'];
                            const isChosen = q.correctAnswer && q.correctAnswer.trim().toUpperCase() === letters[oIdx];
                            return (
                              <div
                                key={oIdx}
                                className={`p-2 rounded-lg border text-xs leading-relaxed flex items-start gap-1.5 ${
                                  isChosen
                                    ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                                    : 'bg-white border-gray-200 text-gray-700'
                                }`}
                              >
                                <span className={`font-bold ${isChosen ? 'text-teal-800' : ''}`}>
                                  {letters[oIdx] ? `${letters[oIdx]}. ` : ''}
                                </span>
                                <span className="flex-1">
                                  <MathText text={opt.replace(/^[a-dA-D][\.\)]\s*/, '')} />
                                </span>
                                {isChosen && (
                                  <span className="text-[10px] bg-teal-600 text-white font-bold px-1.5 py-0.5 rounded shrink-0">
                                    Đáp án đúng
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {q.solution && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-teal-900 bg-teal-50/70 p-2.5 rounded-lg leading-relaxed">
                          <b className="text-teal-800 font-bold">💡 Lời giải chi tiết: </b>
                          <MathText text={q.solution} />
                        </div>
                      )}
                    </div>
                  ))
                )
              ) : (
                <div className="text-center py-12 text-gray-500 text-sm">Đề thi này không có câu hỏi chi tiết.</div>
              )}
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium shadow-sm cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {examToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-bold text-base text-gray-900">Xác nhận xóa đề thi</h3>
                <p className="text-xs text-gray-500">
                  Thầy có chắc chắn muốn xóa đề <span className="font-semibold text-gray-800">"{examToDelete.title}"</span>? Hành động này không thể hoàn tác.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExamToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteExam}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium shadow-sm cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {folderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-bold text-base text-gray-900">Xác nhận xóa thư mục</h3>
                <p className="text-xs text-gray-500">
                  Thầy có chắc chắn muốn xóa thư mục <span className="font-semibold text-gray-800">"{folderToDelete.name}"</span>? Các đề thi bên trong sẽ được chuyển về danh mục mặc định.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFolderToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteFolder}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium shadow-sm cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}