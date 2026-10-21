import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import mammoth from 'mammoth';
import { db, auth } from '../firebase';
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
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'classes'), where('teacherId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClassesList(snapshot.docs.map((d) => ({ id: d.id, name: d.data().name })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const qExams = query(collection(db, 'exams'), where('teacherId', '==', user.uid));
    const qFolders = query(collection(db, 'folders'), where('teacherId', '==', user.uid));

    const unsubFolders = onSnapshot(qFolders, (snap) => {
      setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FolderItem)));
    });

    const unsubExams = onSnapshot(qExams, async (snap) => {
      if (snap.empty) {
        await seedInitialExams(user.uid);
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
  }, []);

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

    // 1. Kiểm tra chữ ký ZIP (.docx là file zip nén, bắt đầu bằng 2 byte 'PK' [0x50, 0x4B])
    const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B;

    if (isZip) {
      // 1.1 Sử dụng parseWordFile (Mammoth + cấu hình bắt ảnh công thức sang base64)
      try {
        const htmlVal = await parseWordFile(arrayBuffer);
        if (htmlVal && htmlVal.trim()) {
          const preservedText = extractTextFromHtmlPreservingUnderline(htmlVal);
          if (preservedText.trim()) {
            return preservedText;
          }
        }
      } catch (zipErr: any) {
        console.warn('Không thể chuyển đổi html từ file docx qua parseWordFile:', zipErr?.message);
      }

      // 1.2 Thử trích xuất thô qua Mammoth nếu convertToHtml không thành công
      try {
        // @ts-ignore
        const rawResult = await mammoth.extractRawText({ arrayBuffer });
        const val = (rawResult && rawResult.value) || '';
        if (val.trim()) {
          return sanitizeMathContent(val);
        }
      } catch (e) {
        console.warn('Không thể trích xuất raw text từ file docx:', e);
      }
    }

    // 2. Thử giải mã dạng chuỗi văn bản (UTF-8)
    const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

    // Kiểm tra định dạng HTML / Word web archive (như file mẫu tải về hoặc file lưu dạng HTML .doc)
    const hasHtmlTags = /<html|<body|<p[\s>]|<div[\s>]|xmlns:w|xmlns:o/i.test(decodedText);
    if (hasHtmlTags) {
      const extractedHtml = extractTextFromHtmlPreservingUnderline(decodedText);
      if (extractedHtml.trim()) {
        return extractedHtml;
      }
    }

    // 3. Nếu là file PDF (%PDF-)
    const isPdf = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    if (isPdf) {
      try {
        const text = await parsePdfFileToText(arrayBuffer);
        if (text && text.trim().length > 5) {
          return text;
        } else {
          console.warn('PDF extracted text is too short:', text);
        }
      } catch (e) {
        console.warn('Không thể trích xuất text từ file PDF:', e);
      }
      throw new Error('FILE_PDF_UNREADABLE');
    }

    // 4. Nếu là file Word nhị phân cũ .doc (OLE2 CFBF: 0xD0, 0xCF, 0x11, 0xE0)
    const isBinaryDoc = bytes.length >= 8 && bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0;
    if (isBinaryDoc) {
      const utf16 = new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
      const m16 = utf16.match(/[\p{L}\p{N}\s.,;:!?()\-+/><=]{5,}/gu) || [];
      const joined16 = m16.join(' ');
      if (/(?:câu|bài|phần|đáp\s*án)/i.test(joined16)) {
        return joined16;
      }
      throw new Error('FILE_BINARY_DOC_LEGACY');
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
        .replace(/\r\n/g, '\n')
        .replace(/[\u00A0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, ' ')
        .replace(/\t/g, ' ');

      if (!text.trim()) {
        setNotification({
          type: 'error',
          message: 'Không trích xuất được văn bản từ file (file có thể chỉ chứa hình ảnh hoặc bảng không đọc được). Vui lòng kiểm tra lại file.'
        });
        return;
      }

      // Chuẩn hóa ký tự số La Mã Unicode thành chữ cái ASCII thông thường
      text = text
        .replace(/[Ⅰⅰ]/g, 'I')
        .replace(/[Ⅱⅱ]/g, 'II')
        .replace(/[Ⅲⅲ]/g, 'III');

      // 1. Phân chia ranh giới 3 phần dựa vào các tiêu đề lớn:
      // Tự động nhận diện linh hoạt: 'Phần 1', 'Phần I', 'Phần 2', 'Phần II', 'Phần 3', 'Phần III'
      // Không phân biệt chữ hoa/thường, có hoặc không có dấu chấm, hai chấm, gạch ngang, ngoặc đơn
      const p1Regex = /(?:^|[\r\n\s]|<[^>]+>)(?:PH\s*[ẦAÀÂa-z\s]*N|PART)\s*(?:I(?![IVX\w])|1\b|THỨ\s*NHẤT)[\.\:\-\s\)]*/gi;
      const p2Regex = /(?:^|[\r\n\s]|<[^>]+>)(?:PH\s*[ẦAÀÂa-z\s]*N|PART)\s*(?:II(?![IVX\w])|2\b|THỨ\s*HAI)[\.\:\-\s\)]*/gi;
      const p3Regex = /(?:^|[\r\n\s]|<[^>]+>)(?:PH\s*[ẦAÀÂa-z\s]*N|PART)\s*(?:III(?![IVX\w])|3\b|THỨ\s*BA)[\.\:\-\s\)]*/gi;

      // Các tiêu đề bổ sung trong trường hợp file không ghi chữ "Phần" mà chỉ ghi loại câu hỏi
      const p1AltRegex = /(?:^|[\r\n\s]|<[^>]+>)(?:CÂU\s*HỎI\s*TRẮC\s*NGHIỆM\s*NHIỀU\s*LỰA\s*CHỌN|TRẮC\s*NGHIỆM\s*NHIỀU\s*PHƯƠNG\s*ÁN|TRẮC\s*NGHIỆM\s*4\s*LỰA\s*CHỌN)/gi;
      const p2AltRegex = /(?:^|[\r\n\s]|<[^>]+>)(?:CÂU\s*TRẮC\s*NGHIỆM\s*ĐÚNG\s*SAI|CÂU\s*HỎI\s*ĐÚNG\s*SAI|TRẮC\s*NGHIỆM\s*ĐÚNG\s*SAI)/gi;
      const p3AltRegex = /(?:^|[\r\n\s]|<[^>]+>)(?:CÂU\s*TRẮC\s*NGHIỆM\s*TRẢ\s*LỜI\s*NGẮN|CÂU\s*HỎI\s*TRẢ\s*LỜI\s*NGẮN|TRẢ\s*LỜI\s*NGẮN)/gi;

      const findBestSectionMatch = (regexList: RegExp[], fullText: string): number => {
        for (const rgx of regexList) {
          const all = Array.from(fullText.matchAll(rgx));
          if (all.length === 0) continue;
          if (all.length === 1) {
            const m = all[0];
            const leading = m[0].match(/^[\r\n\s]+/);
            return (m.index || 0) + (leading ? leading[0].length : 0);
          }
          // Khi có nhiều kết quả (ví dụ xuất hiện ở phần giới thiệu đầu trang "Đề thi gồm 3 phần: Phần 1, Phần 2, Phần 3")
          // Loại bỏ các vị trí giới thiệu tóm tắt bằng cách tìm vị trí thực sự có nội dung câu hỏi phía sau
          for (const m of all) {
            const idx = m.index || 0;
            const snippet = fullText.substring(Math.max(0, idx - 100), idx + 200);
            const isSummaryHeader = /(?:gồm|cấu trúc|thời gian làm bài)[\s\S]{0,100}(?:Phần\s*[123I]+)/i.test(snippet);
            if (!isSummaryHeader) {
              const leading = m[0].match(/^[\r\n\s]+/);
              return idx + (leading ? leading[0].length : 0);
            }
          }
          const lastM = all[all.length - 1];
          const leading = lastM[0].match(/^[\r\n\s]+/);
          return (lastM.index || 0) + (leading ? leading[0].length : 0);
        }
        return -1;
      };

      const idx1 = findBestSectionMatch([p1Regex, p1AltRegex], text);
      const idx2 = findBestSectionMatch([p2Regex, p2AltRegex], text);
      const idx3 = findBestSectionMatch([p3Regex, p3AltRegex], text);

      let rawP1 = '';
      let rawP2 = '';
      let rawP3 = '';

      if (idx1 !== -1 && idx2 !== -1 && idx3 !== -1 && idx1 < idx2 && idx2 < idx3) {
        rawP1 = text.substring(idx1, idx2);
        rawP2 = text.substring(idx2, idx3);
        rawP3 = text.substring(idx3);
      } else if (idx1 !== -1 && idx2 !== -1 && idx1 < idx2) {
        rawP1 = text.substring(idx1, idx2);
        rawP2 = text.substring(idx2);
      } else if (idx2 !== -1 && idx3 !== -1 && idx2 < idx3) {
        rawP1 = text.substring(0, idx2);
        rawP2 = text.substring(idx2, idx3);
        rawP3 = text.substring(idx3);
      } else if (idx1 !== -1 && idx3 !== -1 && idx1 < idx3) {
        rawP1 = text.substring(idx1, idx3);
        rawP3 = text.substring(idx3);
      } else if (idx2 !== -1) {
        rawP1 = text.substring(0, idx2);
        rawP2 = text.substring(idx2);
      } else if (idx3 !== -1) {
        rawP1 = text.substring(0, idx3);
        rawP3 = text.substring(idx3);
      } else {
        rawP1 = text;
      }

      // Biểu thức regex nhận diện từ khóa Lời giải tuyệt đối chuẩn xác
      // Không để bị nuốt nhầm "Giải phương trình", "khi giải...", và hỗ trợ giãn chữ như "L ờ i gi ả i:"
      const robustSolutionRegex = /(?<=^|[\r\n\s]|<[^>]+>)(?:\[?\s*(?:L\s*ờ\s*i\s*g\s*i\s*ả\s*i|B\s*à\s*i\s*g\s*i\s*ả\s*i|H\s*ư\s*ớ\s*n\s*g\s*d\s*ẫ\s*n\s*g\s*i\s*ả\s*i|G\s*i\s*ả\s*i\s*c\s*h\s*i\s*t\s*i\s*ế\s*t|HD\s*giải|HDG|H\s*ư\s*ớ\s*n\s*g\s*d\s*ẫ\s*n)\s*\]?[\:\.\-]?|Giải\s*[\:\.\-])\s*/i;

      // 2. Hàm tách các khối câu hỏi độc lập trong một phần:
      // Hỗ trợ nhận diện câu hỏi thông minh ngay cả khi file Word thiếu tiền tố 'Câu X.'
      const extractQuestionBlocks = (secStr: string, expectedType: 'p1' | 'p2' | 'p3' = 'p1') => {
        if (!secStr.trim()) return [];

        // 2.1. Thử nhận diện theo các tiền tố kinh điển 'Câu 1.', 'Câu 2.' hoặc 'Bài 1.'
        const lineRegex = /(?:^|\n|\r)\s*(?:\[?\s*(?:Câu|Bài|CAU|BÀI)\s*(\d+)\s*\]?[\.\:\-]?\s*)/gi;
        let matches = Array.from(secStr.matchAll(lineRegex));

        if (matches.length < 2) {
          const inlineRegex = /(?:^|\s)(?:\[?\s*(?:Câu|Bài|CAU|BÀI)\s*(\d+)\s*\]?[\.\:\-]?\s*)/gi;
          matches = Array.from(secStr.matchAll(inlineRegex));
        }

        if (matches.length < 2) {
          const numRegex = /(?:^|\n|\r)\s*(\d+)[\.\)]\s+/g;
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
          // Bóc tách dựa theo chuỗi phương án A, B, C, D
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
            const secHdr = secStr.match(/(?:^|[\r\n\s]|<[^>]+>)(?:PH\s*[ẦAÀÂa-z\s]*N|PART)\s*(?:I(?![IVX\w])|1\b|THỨ\s*NHẤT)[^\n]*/i);
            if (secHdr && secHdr.index !== undefined && secHdr.index < mcStarts[0]) {
              prevEnd = secHdr.index + secHdr[0].length;
            }

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
                    const dnl = afterD.search(/\n\s*\n/);
                    if (dnl !== -1) blockEnd = curA + dM.index + dnl;
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
          // Bóc tách dựa theo chuỗi 4 ý đúng sai a, b, c, d
          const subAMatches = Array.from(secStr.matchAll(/(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?[aA][\.\:\)](?:<\/u>)?\s*/g));
          const tfStarts: number[] = [];
          for (let i = 0; i < subAMatches.length; i++) {
            const aM = subAMatches[i];
            const nextAIdx = (i + 1 < subAMatches.length) ? subAMatches[i + 1].index! : secStr.length;
            const chunk = secStr.substring(aM.index! + aM[0].length, nextAIdx);
            const hasB = /(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?[bB][\.\:\)](?:<\/u>)?\s*/.test(chunk);
            if (!hasB) continue;

            const isAnswerLine = /^(?:đúng|sai|đ\b|s\b|true|false)\b/i.test(chunk.trim());
            if (isAnswerLine) continue;

            const textBefore = secStr.substring(0, aM.index!);
            const lastSolMatch = Array.from(textBefore.matchAll(new RegExp(robustSolutionRegex, 'gi'))).pop();
            if (lastSolMatch) {
              const textBetween = secStr.substring(lastSolMatch.index!, aM.index!);
              if (!textBetween.includes('\n\n')) continue;
            }

            tfStarts.push(aM.index!);
          }

          if (tfStarts.length >= 1) {
            const blocks: { num: number; text: string }[] = [];
            let prevEnd = 0;
            const secHdr = secStr.match(/(?:^|[\r\n\s]|<[^>]+>)(?:PH\s*[ẦAÀÂa-z\s]*N|PART)\s*(?:II(?![IVX\w])|2\b|THỨ\s*HAI)[^\n]*/i);
            if (secHdr && secHdr.index !== undefined && secHdr.index < tfStarts[0]) {
              prevEnd = secHdr.index + secHdr[0].length;
            }

            for (let i = 0; i < tfStarts.length; i++) {
              const curA = tfStarts[i];
              const nextA = (i + 1 < tfStarts.length) ? tfStarts[i + 1] : secStr.length;
              let blockEnd = nextA;
              if (i + 1 < tfStarts.length) {
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
                }
              }
              const qText = secStr.substring(prevEnd, blockEnd).trim();
              if (qText) blocks.push({ num: i + 1, text: qText });
              prevEnd = blockEnd;
            }
            if (blocks.length > 0) return blocks;
          }
        } else if (expectedType === 'p3') {
          // Bóc tách câu hỏi trả lời ngắn dựa vào lời giải / đáp số hoặc các đoạn cách nhau bởi dòng trống
          const allSol = Array.from(secStr.matchAll(new RegExp(robustSolutionRegex, 'gi')));
          if (allSol.length >= 1) {
            const blocks: { num: number; text: string }[] = [];
            let prevEnd = 0;
            const secHdr = secStr.match(/(?:^|[\r\n\s]|<[^>]+>)(?:PH\s*[ẦAÀÂa-z\s]*N|PART)\s*(?:III(?![IVX\w])|3\b|THỨ\s*BA)[^\n]*/i);
            if (secHdr && secHdr.index !== undefined && secHdr.index < allSol[0].index!) {
              prevEnd = secHdr.index + secHdr[0].length;
            }

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

        return [{ num: 1, text: secStr.trim() }];
      };

      // 3. Hàm phân tích câu hỏi PHẦN I (Trắc nghiệm nhiều lựa chọn A, B, C, D)
      const parseP1Question = (blockText: string) => {
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

        for (let i = 0; i < matches.length; i++) {
          if (matches[i][1] === 'A') {
            const bM = matches.slice(i + 1).find(m => m[1] === 'B');
            const cM = matches.slice(i + 1).find(m => m[1] === 'C');
            if (bM && cM) {
              firstOptIndex = matches[i].index!;
              const dM = matches.slice(i + 1).find(m => m[1] === 'D');
              optMatches = [matches[i], bM, cM, dM].filter(Boolean) as RegExpMatchArray[];
              break;
            }
          }
        }

        let questionText = content;
        let options: string[] = [];
        let underlineAnswer = '';

        if (firstOptIndex !== -1 && optMatches.length >= 2) {
          questionText = content.substring(0, firstOptIndex).trim();

          for (let k = 0; k < optMatches.length; k++) {
            const curM = optMatches[k];
            const nextM = optMatches[k + 1];
            const start = curM.index! + curM[0].length;
            const end = nextM ? nextM.index! : content.length;
            const rawBody = content.substring(start, end).trim();
            const letter = letters[k];

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
          const ansM = content.match(/(?:^|[\r\n\s])(?:Đáp án|Đáp số|Kết quả|Chọn)\s*[:=]\s*([^\n]+)/i);
          if (ansM && ansM.index !== undefined) {
            const mLetter = ansM[1].match(/\b([A-D])\b/i);
            if (mLetter) correctAnswer = mLetter[1].toUpperCase();
          } else if (solution) {
            const solAnsM = solution.match(/(?:^|[\r\n\s])(?:Đáp án|Đáp số|Kết quả|Chọn)\s*[:=]\s*([^\n]+)/i);
            if (solAnsM) {
              const mLetter = solAnsM[1].match(/\b([A-D])\b/i);
              if (mLetter) correctAnswer = mLetter[1].toUpperCase();
            }
          }
        }

        if (!correctAnswer) {
          correctAnswer = 'A';
        }

        return {
          questionText: questionText.replace(/<\/?u>/gi, '').trim() || blockText.replace(/<\/?u>/gi, '').trim(),
          options,
          correctAnswer,
          questionType: 'trắc nghiệm' as const,
          solution: solution.replace(/<\/?u>/gi, '').trim()
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

        // 2. Bóc tách 4 ý a, b, c, d
        const subRegex = /(?<=^|[\r\n\s]|<[^>]+>)(?:<u>\s*)?([a-dA-D])[\.\:\)](?:<\/u>)?\s*/g;
        const matches = Array.from(content.matchAll(subRegex));

        let firstSubIndex = -1;
        let subMatches: RegExpMatchArray[] = [];

        for (let i = 0; i < matches.length; i++) {
          if (matches[i][1].toLowerCase() === 'a') {
            const bM = matches.slice(i + 1).find(m => m[1].toLowerCase() === 'b');
            const cM = matches.slice(i + 1).find(m => m[1].toLowerCase() === 'c');
            if (bM && cM) {
              firstSubIndex = matches[i].index!;
              const dM = matches.slice(i + 1).find(m => m[1].toLowerCase() === 'd');
              subMatches = [matches[i], bM, cM, dM].filter(Boolean) as RegExpMatchArray[];
              break;
            }
          }
        }

        let questionText = content;
        let options: string[] = [];

        if (firstSubIndex !== -1 && subMatches.length >= 2) {
          questionText = content.substring(0, firstSubIndex).trim();

          for (let k = 0; k < subMatches.length; k++) {
            const curM = subMatches[k];
            const nextM = subMatches[k + 1];
            const start = curM.index! + curM[0].length;
            const end = nextM ? nextM.index! : content.length;
            const rawBody = content.substring(start, end).trim();
            const letter = subLetters[k];

            if (/<u>\s*(?:đúng|dung|true|đ)\s*<\/u>/i.test(rawBody) || /\(?(?:đúng|dung|true)\)?$/i.test(rawBody)) {
              detectedTfAnswers[letter] = 'Đúng';
            } else if (/<u>\s*(?:sai|false|s)\s*<\/u>/i.test(rawBody) || /\(?(?:sai|false)\)?$/i.test(rawBody)) {
              detectedTfAnswers[letter] = 'Sai';
            }

            const cleanBody = rawBody
              .replace(/<\/?u>/gi, '')
              .replace(/\b(?:Đúng|Sai|True|False)\b/gi, '')
              .replace(/[\(\[\{]\s*[\}\]\)]/g, '')
              .trim();

            options.push(`${letter}) ${cleanBody || 'Ý thứ ' + (k + 1)}`);
          }
        }

        while (options.length < 4) {
          const letter = subLetters[options.length];
          options.push(`${letter}) Ý thứ ${options.length + 1}`);
        }

        // Nhận diện kết quả đúng sai từ lời giải nếu chưa có
        if (solution) {
          ['a', 'b', 'c', 'd'].forEach(l => {
            if (!detectedTfAnswers[l]) {
              const pat = new RegExp('(?:^|[\\r\\n\\s])' + l + '[\\.\\:\\)]\\s*(?:là\\s*)?(đúng|sai|đ|s|true|false)', 'i');
              const m = solution.match(pat);
              if (m) {
                detectedTfAnswers[l] = (m[1].toLowerCase().startsWith('đ') || m[1].toLowerCase() === 'true') ? 'Đúng' : 'Sai';
              }
            }
          });
        }

        const correctAnswer = subLetters.map(l => `${l}) ${detectedTfAnswers[l] || 'Đúng'}`).join(' - ');

        return {
          questionText: questionText.replace(/<\/?u>/gi, '').trim() || blockText.replace(/<\/?u>/gi, '').trim(),
          options,
          correctAnswer,
          questionType: 'đúng sai' as const,
          solution: solution.replace(/<\/?u>/gi, '').trim()
        };
      };

      // 5. Hàm phân tích câu hỏi PHẦN III (Trắc nghiệm trả lời ngắn)
      const parseP3Question = (blockText: string) => {
        let content = blockText.trim();
        let solution = '';

        // Tách từ khóa 'Lời giải:' chuẩn xác
        const solM = content.match(robustSolutionRegex);
        if (solM && solM.index !== undefined) {
          solution = content.substring(solM.index + solM[0].length).trim();
          content = content.substring(0, solM.index).trim();
        }

        let underlineAnswer = '';
        const underM = content.match(/<u>([^<]+)<\/u>/i);
        if (underM) {
          const cand = underM[1].trim();
          if (cand.length > 0 && cand.length <= 30) {
            underlineAnswer = cand;
          }
        }

        let correctAnswer = underlineAnswer;
        if (!correctAnswer) {
          const ansPatterns = [
            /(?:^|[\r\n\s])(?:Đáp án|Đáp số|Kết quả)\s*[:=]\s*([^\n]+)/i,
            /(?:^|[\r\n\s])(?:K\s*ế\s*t\s*q\s*u\s*ả\s*l\s*ấ\s*y\s*đ\s*ế\s*n\s*[^\:]*là|K\s*ế\s*t\s*q\s*u\s*ả\s*là)\s*([^\n\.]+)/i
          ];

          for (const pat of ansPatterns) {
            const m = content.match(pat) || (solution ? solution.match(pat) : null);
            if (m) {
              correctAnswer = m[1].replace(/[\$\,\.\s]+$/, '').trim();
              break;
            }
          }
        }

        if (!correctAnswer) {
          correctAnswer = '10';
        }

        return {
          questionText: content.replace(/<\/?u>/gi, '').trim() || blockText.replace(/<\/?u>/gi, '').trim(),
          options: [],
          correctAnswer,
          questionType: 'trả lời ngắn' as const,
          solution: solution.replace(/<\/?u>/gi, '').trim()
        };
      };

      // 6. Bóc tách câu hỏi chuẩn xác cho từng phần
      const finalQuestions: any[] = [];

      let p1Blocks = rawP1.trim() ? extractQuestionBlocks(rawP1, 'p1') : [];
      let p2Blocks = rawP2.trim() ? extractQuestionBlocks(rawP2, 'p2') : [];
      let p3Blocks = rawP3.trim() ? extractQuestionBlocks(rawP3, 'p3') : [];

      // Tự động phân bổ lại nếu câu hỏi bị dồn hết vào một phần (do file không có tiêu đề phần 2/3):
      if (p1Blocks.length > 0 && p2Blocks.length === 0 && p3Blocks.length === 0) {
        const autoP1: typeof p1Blocks = [];
        const autoP2: typeof p2Blocks = [];
        const autoP3: typeof p3Blocks = [];

        p1Blocks.forEach((b) => {
          const bText = b.text;
          const tfSubMatches = Array.from(bText.matchAll(/(?<=^|[\r\n\s]|<[^>]+>)[a-d][\.\:\)]\s*/gi));
          const hasTFKeywords = /(?:đúng|sai|true|false)/i.test(bText);
          const hasMC = Array.from(bText.matchAll(/(?<=^|[\r\n\s]|<[^>]+>)[A-D][\.\:\)]\s*/g)).length >= 2;

          if (tfSubMatches.length >= 2 && (hasTFKeywords || !hasMC)) {
            autoP2.push(b);
          } else if (hasMC) {
            autoP1.push(b);
          } else {
            autoP3.push(b);
          }
        });

        if (autoP2.length > 0 || autoP3.length > 0) {
          p1Blocks = autoP1;
          p2Blocks = autoP2;
          p3Blocks = autoP3;
        }
      } else if (p1Blocks.length === 0 && p2Blocks.length === 0 && p3Blocks.length === 0) {
        // Tách câu hỏi từ toàn bộ văn bản và tự động phân loại thông minh theo cấu trúc
        const allBlocks = extractQuestionBlocks(text, 'p1');
        allBlocks.forEach((b) => {
          const bText = b.text;
          const tfSubMatches = Array.from(bText.matchAll(/(?<=^|[\r\n\s]|<[^>]+>)[a-d][\.\:\)]\s*/gi));
          const hasTFKeywords = /(?:đúng|sai|true|false)/i.test(bText);
          const hasMC = Array.from(bText.matchAll(/(?<=^|[\r\n\s]|<[^>]+>)[A-D][\.\:\)]\s*/g)).length >= 2;

          if (tfSubMatches.length >= 2 && (hasTFKeywords || !hasMC)) {
            p2Blocks.push(b);
          } else if (hasMC) {
            p1Blocks.push(b);
          } else {
            p3Blocks.push(b);
          }
        });
      }

      p1Blocks.forEach((b, idx) => {
        finalQuestions.push({
          ...parseP1Question(b.text),
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
        message: `Đã trích xuất chính xác ${finalQuestions.length} câu hỏi theo đúng các phần trong file!`
      });
    } catch (err: any) {
      console.warn('Lưu ý khi bóc tách tệp:', err);
      let userMsg = 'Lỗi bóc tách file đề thi.';
      if (err?.message === 'FILE_BINARY_DOC_LEGACY') {
        userMsg = 'Tệp bạn tải lên có định dạng Word cũ (.doc nhị phân). Vui lòng mở tệp bằng Word hoặc Google Docs, chọn "Lưu dưới dạng..." (Save As) thành file .docx (Word Document) rồi tải lại để hệ thống nhận diện đầy đủ nhất!';
      } else if (err?.message === 'FILE_PDF_UNREADABLE') {
        userMsg = 'Tệp PDF này không chứa văn bản có thể trích xuất (có thể là file scan hoặc hình ảnh). Vui lòng sử dụng file Word (.docx) hoặc tải file mẫu!';
      } else if (err?.message === 'FILE_UNSUPPORTED_OR_EMPTY') {
        userMsg = 'Tệp rỗng hoặc định dạng không được hỗ trợ. Vui lòng tải file Word (.docx) hoặc tải file mẫu chuẩn Form 2025 bên dưới.';
      } else {
        userMsg = `Không thể bóc tách nội dung: ${err?.message || 'Vui lòng kiểm tra lại file .docx'}`;
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
    const user = auth.currentUser;
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
        teacherId: user.uid,
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
    const user = auth.currentUser;
    if (!user || !newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      await addDoc(collection(db, 'folders'), {
        name: newFolderName.trim(),
        teacherId: user.uid,
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

                                {q.options && q.options.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 text-xs">
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
                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                  Nội dung câu hỏi:
                                </label>
                                <textarea
                                  rows={4}
                                  value={q.questionText}
                                  onChange={(e) => handleUpdateQuestion(globalIdx, 'questionText', e.target.value)}
                                  placeholder="Nhập nội dung câu hỏi..."
                                  className="w-full min-h-[100px] px-3 py-2.5 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed resize-y"
                                />
                                <MathPreview content={q.questionText} label="Xem trước câu hỏi (MathType / KaTeX):" />
                              </div>

                              {/* Options & Answers Section */}
                              {sectionType === 'P1' && (
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-700 mb-1.5">
                                    Phương án lựa chọn <span className="text-gray-400 font-normal">(Bấm vào chữ cái để chọn đáp án đúng):</span>
                                  </label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {['A', 'B', 'C', 'D'].map((letter, oIdx) => {
                                      const isChosen = q.correctAnswer && q.correctAnswer.trim().toUpperCase() === letter;
                                      const rawOpt = (q.options && q.options[oIdx]) || '';
                                      const cleanBody = rawOpt.replace(/^[A-D][\.\)]\s*/i, '');

                                      return (
                                        <div
                                          key={letter}
                                          className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${
                                            isChosen ? 'bg-teal-50/70 border-teal-400' : 'bg-gray-50 border-gray-200'
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => handleSelectPart1Answer(globalIdx, letter)}
                                            className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                                              isChosen
                                                ? 'bg-teal-700 text-white shadow-xs ring-2 ring-teal-400'
                                                : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                                            }`}
                                            title={isChosen ? 'Đáp án đúng' : `Click để chọn ${letter} là đáp án đúng`}
                                          >
                                            {letter}
                                          </button>
                                          <textarea
                                            rows={2}
                                            value={cleanBody}
                                            onChange={(e) => handleUpdateOption(globalIdx, oIdx, e.target.value)}
                                            placeholder={`Phương án ${letter}...`}
                                            className="flex-1 min-h-[44px] px-2.5 py-2 text-xs text-gray-800 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:outline-none leading-relaxed resize-y"
                                          />
                                          {isChosen && (
                                            <span className="text-[10px] text-teal-800 font-bold bg-teal-100 px-1.5 py-0.5 rounded shrink-0">
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
                              {q.options && q.options.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 text-xs text-gray-700">
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