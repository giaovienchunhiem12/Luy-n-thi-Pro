import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  GraduationCap,
  BookOpen,
  Send,
  Image as ImageIcon,
  Upload,
  Settings2,
  Trash2,
  Check,
  X,
  Layout,
  Maximize2,
  Columns,
  Link as LinkIcon,
  RotateCcw,
  Palette,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export type BannerLayoutMode = 'full' | 'split' | 'cover' | 'standalone';
export type BannerObjectFit = 'fill' | 'cover' | 'contain';

export interface TeacherBannerConfig {
  imageUrl: string;
  layoutMode: BannerLayoutMode;
  objectFit: BannerObjectFit;
  objectPositionY: number; // 0 to 100 (%)
  bannerHeight: number; // px (180 to 420)
  overlayOpacity: number; // 0 to 85 (%)
  hideGreetingText: boolean;
  badgeText: string;
  titleText: string;
  subtitleText: string;
  bannerCaption: string;
  themeGradient: string;
  showOnStudentDashboard: boolean;
  fitVersion?: number;
  updatedAt?: string;
}

const STORAGE_KEY = 'teacher_dashboard_banner_v1';
const CURRENT_FIT_VERSION = 2;

// 3 mẫu Banner Giáo dục / Luyện thi Vật Lí sắc nét dựng sẵn bằng SVG Data URI
export const PRESET_BANNERS: Array<{
  id: string;
  name: string;
  caption: string;
  previewGradient: string;
  svgDataUrl: string;
}> = [
  {
    id: 'physics-2025',
    name: 'Luyện Thi Vật Lí Chuẩn Form 2025',
    caption: '',
    previewGradient: 'from-teal-700 via-teal-600 to-indigo-700',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320" width="1200" height="320">
        <defs>
          <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f766e"/>
            <stop offset="50%" stop-color="#0d9488"/>
            <stop offset="100%" stop-color="#3730a3"/>
          </linearGradient>
          <linearGradient id="card1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
          </linearGradient>
          <linearGradient id="accent1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#2dd4bf"/>
            <stop offset="100%" stop-color="#fbbf24"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="320" rx="24" fill="url(#bg1)"/>
        <g stroke="#ffffff" stroke-opacity="0.07" stroke-width="1">
          <line x1="0" y1="64" x2="1200" y2="64"/>
          <line x1="0" y1="128" x2="1200" y2="128"/>
          <line x1="0" y1="192" x2="1200" y2="192"/>
          <line x1="0" y1="256" x2="1200" y2="256"/>
          <line x1="200" y1="0" x2="200" y2="320"/>
          <line x1="400" y1="0" x2="400" y2="320"/>
          <line x1="600" y1="0" x2="600" y2="320"/>
          <line x1="800" y1="0" x2="800" y2="320"/>
          <line x1="1000" y1="0" x2="1000" y2="320"/>
        </g>
        <circle cx="1020" cy="70" r="140" fill="#2dd4bf" fill-opacity="0.15"/>
        <circle cx="180" cy="270" r="160" fill="#818cf8" fill-opacity="0.18"/>
        <path d="M 40 250 Q 140 160, 240 250 T 440 250 T 640 250 T 840 250 T 1040 250" fill="none" stroke="#5eead4" stroke-width="3.5" stroke-opacity="0.4"/>
        <rect x="36" y="24" width="1128" height="272" rx="20" fill="url(#card1)" stroke="#ffffff" stroke-opacity="0.24" stroke-width="1.5"/>
        <g transform="translate(960, 160)">
          <ellipse cx="0" cy="0" rx="115" ry="42" fill="none" stroke="#5eead4" stroke-width="2.5" stroke-opacity="0.75" transform="rotate(-30)"/>
          <ellipse cx="0" cy="0" rx="115" ry="42" fill="none" stroke="#a5b4fc" stroke-width="2.5" stroke-opacity="0.75" transform="rotate(30)"/>
          <ellipse cx="0" cy="0" rx="115" ry="42" fill="none" stroke="#fde047" stroke-width="2.5" stroke-opacity="0.75" transform="rotate(90)"/>
          <circle cx="0" cy="0" r="20" fill="#fbbf24"/>
          <circle cx="0" cy="0" r="10" fill="#ffffff"/>
        </g>
        <rect x="76" y="48" width="250" height="32" rx="16" fill="#ffffff" fill-opacity="0.2"/>
        <text x="201" y="69" fill="#fde047" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">★ HỆ THỐNG LUYỆN THI PRO ★</text>
        <text x="76" y="122" fill="#ffffff" font-family="Arial, sans-serif" font-size="36" font-weight="900">CHINH PHỤC VẬT LÍ 10 - 11 - 12</text>
        <text x="76" y="160" fill="#ccfbf1" font-family="Arial, sans-serif" font-size="22" font-weight="bold">Luyện Đề Chuẩn Cấu Trúc Mới Bộ GD&amp;ĐT</text>
        <rect x="76" y="178" width="480" height="4" rx="2" fill="url(#accent1)"/>
        <g transform="translate(76, 198)">
          <rect x="0" y="0" width="150" height="40" rx="10" fill="#0f172a" fill-opacity="0.45" stroke="#5eead4" stroke-opacity="0.4"/>
          <text x="75" y="26" fill="#5eead4" font-family="Georgia, serif" font-size="17" font-weight="bold" text-anchor="middle">x = A cos(ωt + φ)</text>
          <rect x="166" y="0" width="135" height="40" rx="10" fill="#0f172a" fill-opacity="0.45" stroke="#fde047" stroke-opacity="0.4"/>
          <text x="233" y="26" fill="#fde047" font-family="Georgia, serif" font-size="17" font-weight="bold" text-anchor="middle">pV = nRT</text>
          <rect x="317" y="0" width="150" height="40" rx="10" fill="#0f172a" fill-opacity="0.45" stroke="#a5b4fc" stroke-opacity="0.4"/>
          <text x="392" y="26" fill="#e0e7ff" font-family="Georgia, serif" font-size="17" font-weight="bold" text-anchor="middle">E = mc² = hf</text>
        </g>
        <text x="76" y="272" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="15" font-weight="bold">✓ Phần I: Trắc nghiệm 4 lựa chọn   ✓ Phần II: Đúng / Sai   ✓ Phần III: Trả lời ngắn</text>
      </svg>
    `)}`
  },
  {
    id: 'master-class',
    name: 'Lớp Học Vật Lí Thầy Điền Văn - Bứt Phá 9+',
    caption: '',
    previewGradient: 'from-indigo-800 via-blue-700 to-teal-600',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320" width="1200" height="320">
        <defs>
          <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e1b4b"/>
            <stop offset="50%" stop-color="#1d4ed8"/>
            <stop offset="100%" stop-color="#0d9488"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="320" rx="24" fill="url(#bg2)"/>
        <circle cx="1020" cy="60" r="180" fill="#38bdf8" fill-opacity="0.15"/>
        <circle cx="140" cy="280" r="150" fill="#fbbf24" fill-opacity="0.12"/>
        <rect x="36" y="24" width="1128" height="272" rx="20" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>
        <g transform="translate(960, 160)">
          <circle cx="0" cy="0" r="102" fill="#ffffff" fill-opacity="0.08" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8,6"/>
          <circle cx="0" cy="0" r="76" fill="#fbbf24" fill-opacity="0.16" stroke="#fbbf24" stroke-width="2"/>
          <text x="0" y="-6" fill="#fde047" font-family="Arial, sans-serif" font-size="42" font-weight="900" text-anchor="middle">9.5+</text>
          <text x="0" y="24" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">MỤC TIÊU ĐẠI HỌC</text>
          <text x="0" y="44" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">VẬT LÍ THPT</text>
        </g>
        <rect x="76" y="48" width="290" height="32" rx="16" fill="#fbbf24" fill-opacity="0.2" stroke="#fbbf24" stroke-opacity="0.5"/>
        <text x="221" y="69" fill="#fde047" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">🎓 LỚP LUYỆN THI THẦY ĐIỀN VĂN</text>
        <text x="76" y="122" fill="#ffffff" font-family="Arial, sans-serif" font-size="36" font-weight="900">BỨT PHÁ ĐIỂM SỐ KỲ THI THPT</text>
        <text x="76" y="160" fill="#bae6fd" font-family="Arial, sans-serif" font-size="20" font-weight="bold">Rèn luyện tư duy bản chất • Giải nhanh • Chống sai ngu</text>
        <g transform="translate(76, 186)">
          <rect x="0" y="0" width="175" height="54" rx="12" fill="#ffffff" fill-opacity="0.12"/>
          <text x="87" y="24" fill="#fde047" font-family="Arial, sans-serif" font-size="19" font-weight="900" text-anchor="middle">100%</text>
          <text x="87" y="43" fill="#e0f2fe" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Đề chuẩn Form 2025</text>
          <rect x="192" y="0" width="175" height="54" rx="12" fill="#ffffff" fill-opacity="0.12"/>
          <text x="279" y="24" fill="#5eead4" font-family="Arial, sans-serif" font-size="19" font-weight="900" text-anchor="middle">24/7</text>
          <text x="279" y="43" fill="#e0f2fe" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Chấm &amp; Xem lời giải</text>
          <rect x="384" y="0" width="175" height="54" rx="12" fill="#ffffff" fill-opacity="0.12"/>
          <text x="471" y="24" fill="#f472b6" font-family="Arial, sans-serif" font-size="19" font-weight="900" text-anchor="middle">LaTeX &amp; Đồ thị</text>
          <text x="471" y="43" fill="#e0f2fe" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Hiển thị công thức chuẩn</text>
        </g>
        <text x="76" y="272" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Học tập chủ động — Kỷ luật — Hiệu quả vượt trội</text>
      </svg>
    `)}`
  },
  {
    id: 'exam-arena',
    name: 'Phòng Khảo Thí & Kiểm Tra Trực Tuyến',
    caption: '',
    previewGradient: 'from-emerald-800 via-teal-700 to-cyan-800',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320" width="1200" height="320">
        <defs>
          <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#064e3b"/>
            <stop offset="55%" stop-color="#0f766e"/>
            <stop offset="100%" stop-color="#155e75"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="320" rx="24" fill="url(#bg3)"/>
        <rect x="36" y="24" width="1128" height="272" rx="20" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1.5"/>
        <rect x="76" y="48" width="270" height="32" rx="16" fill="#10b981" fill-opacity="0.25" stroke="#34d399" stroke-opacity="0.5"/>
        <text x="211" y="69" fill="#6ee7b7" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle">🛡️ KHẢO THÍ TRỰC TUYẾN THÔNG MINH</text>
        <text x="76" y="122" fill="#ffffff" font-family="Arial, sans-serif" font-size="35" font-weight="900">PHÒNG THI &amp; NGÂN HÀNG ĐỀ</text>
        <text x="76" y="160" fill="#a7f3d0" font-family="Arial, sans-serif" font-size="20" font-weight="bold">Tự động trộn đề • Chấm điểm tức thì • Xuất báo cáo chi tiết</text>
        <g transform="translate(860, 62)">
          <rect x="0" y="0" width="230" height="196" rx="16" fill="#0f172a" fill-opacity="0.35" stroke="#5eead4" stroke-opacity="0.3"/>
          <rect x="34" y="100" width="26" height="62" rx="6" fill="#34d399"/>
          <rect x="76" y="72" width="26" height="90" rx="6" fill="#2dd4bf"/>
          <rect x="118" y="42" width="26" height="120" rx="6" fill="#fbbf24"/>
          <rect x="160" y="22" width="26" height="140" rx="6" fill="#38bdf8"/>
          <text x="115" y="182" fill="#ccfbf1" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">THỐNG KÊ PHỔ ĐIỂM LỚP HỌC</text>
        </g>
        <text x="76" y="205" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="bold">• Nhập đề nhanh từ file Word (.docx) &amp; PDF giữ nguyên công thức, hình vẽ</text>
        <text x="76" y="236" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="bold">• Tùy chỉnh thang điểm từng phần linh hoạt theo mọi cấu trúc đề</text>
        <text x="76" y="267" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="bold">• Giám sát chuyển tab, toàn màn hình &amp; lưu vết làm bài minh bạch</text>
      </svg>
    `)}`
  }
];

const DEFAULT_CONFIG: TeacherBannerConfig = {
  imageUrl: PRESET_BANNERS[0].svgDataUrl,
  layoutMode: 'full',
  objectFit: 'fill',
  objectPositionY: 50,
  bannerHeight: 260,
  overlayOpacity: 25,
  hideGreetingText: false,
  badgeText: 'Trang Tổng quan Giáo viên',
  titleText: '',
  subtitleText:
    'Chào mừng thầy cô trở lại hệ thống Luyện Thi Pro. Dưới đây là các mục quản lý, thông báo, lớp học, kho đề, giao bài và tài khoản.',
  bannerCaption: '',
  themeGradient: 'from-teal-700 via-teal-600 to-indigo-700',
  showOnStudentDashboard: true,
  fitVersion: CURRENT_FIT_VERSION
};

/**
 * Chuẩn hóa cấu hình đã lưu để đảm bảo ảnh Banner luôn vừa khít 100% khung xanh
 * (không bị cắt mất 2 bên trái/phải và không bị chữ đè lên đáy ảnh)
 */
export function normalizeBannerConfig(rawConfig?: Partial<TeacherBannerConfig> | null): TeacherBannerConfig {
  if (!rawConfig) return DEFAULT_CONFIG;
  const merged: TeacherBannerConfig = {
    ...DEFAULT_CONFIG,
    ...rawConfig
  };

  // Tự động nâng cấp cấu hình cũ sang chế độ Vừa khít 100% khung xanh (objectFit: 'fill', layoutMode: 'full')
  if ((rawConfig.fitVersion || 0) < CURRENT_FIT_VERSION) {
    merged.layoutMode = 'full';
    merged.objectFit = 'fill';
    merged.bannerHeight = 260;
    if (
      merged.bannerCaption ===
      'Hệ thống Luyện Thi & Khảo Thí Trực Tuyến Chuẩn Form 2025'
    ) {
      merged.bannerCaption = '';
    }
    merged.fitVersion = CURRENT_FIT_VERSION;
  }

  return merged;
}

export function loadSavedBannerConfig(): TeacherBannerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeBannerConfig(parsed);
    }
  } catch (e) {
    console.warn('Không thể đọc cấu hình banner từ localStorage:', e);
  }
  return DEFAULT_CONFIG;
}

/**
 * Nén ảnh Banner độ phân giải cao (tối đa 1600x750, chất lượng 0.88)
 */
async function compressBannerImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return reject(new Error('Không đọc được file ảnh'));
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width || 1200;
          let h = img.naturalHeight || img.height || 400;
          const maxW = 1600;
          const maxH = 750;
          if (w > maxW) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          }
          if (h > maxH) {
            w = Math.round((w * maxH) / h);
            h = maxH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          let out = canvas.toDataURL('image/webp', 0.88);
          if (!out || out === 'data:,' || !out.startsWith('data:image/webp')) {
            out = canvas.toDataURL('image/jpeg', 0.88);
          }
          resolve(out);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file ảnh'));
    reader.readAsDataURL(file);
  });
}

interface TeacherBannerSectionProps {
  teacherName: string;
  onNavigate: (view: 'overview' | 'classes' | 'exams' | 'assign' | 'account' | 'notifications') => void;
}

export default function TeacherBannerSection({ teacherName, onNavigate }: TeacherBannerSectionProps) {
  const [config, setConfig] = useState<TeacherBannerConfig>(() => loadSavedBannerConfig());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<TeacherBannerConfig>(config);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const quickFileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Đồng bộ thời gian thực với Firestore (systemConfig/teacherBanner)
  useEffect(() => {
    const bannerDocRef = doc(db, 'systemConfig', 'teacherBanner');
    const unsub = onSnapshot(
      bannerDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<TeacherBannerConfig>;
          const normalized = normalizeBannerConfig(data);
          setConfig(normalized);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          } catch {}
          // Nếu dữ liệu trên Firestore còn ở bản cũ (bị cắt ảnh), tự động cập nhật bản vừa khít khung
          if ((data.fitVersion || 0) < CURRENT_FIT_VERSION) {
            setDoc(bannerDocRef, normalized, { merge: true }).catch(() => {});
          }
        }
      },
      (err) => {
        console.warn('Không thể lắng nghe cấu hình banner từ Firestore:', err);
      }
    );
    return () => unsub();
  }, []);

  const persistBannerConfig = async (nextConfig: TeacherBannerConfig, toastMessage?: string) => {
    const payload: TeacherBannerConfig = {
      ...nextConfig,
      fitVersion: CURRENT_FIT_VERSION,
      updatedAt: new Date().toISOString()
    };
    setConfig(payload);
    setDraftConfig(payload);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Lỗi lưu banner vào localStorage:', e);
    }

    try {
      await setDoc(doc(db, 'systemConfig', 'teacherBanner'), payload, { merge: true });
    } catch (e) {
      console.warn('Lỗi đồng bộ banner lên Firestore:', e);
    }

    if (toastMessage) {
      setSaveToast(toastMessage);
      setTimeout(() => setSaveToast(null), 3200);
    }
  };

  // Xử lý khi người dùng chọn file ảnh trực tiếp từ nút nhanh ngoài Banner
  const handleQuickFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressedDataUrl = await compressBannerImageFile(file);
      const updated: TeacherBannerConfig = {
        ...config,
        imageUrl: compressedDataUrl,
        objectFit: 'fill', // Mặc định tự động co giãn vừa khít 100% khung không cắt chữ
        bannerCaption: ''
      };
      await persistBannerConfig(updated, 'Đã tải lên và căn vừa khít khung Banner!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      if (quickFileInputRef.current) quickFileInputRef.current.value = '';
    }
  };

  // Xử lý chọn file ảnh trong Modal thiết kế
  const handleModalFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploading(true);
    try {
      const compressedDataUrl = await compressBannerImageFile(file);
      setDraftConfig((prev) => ({
        ...prev,
        imageUrl: compressedDataUrl,
        objectFit: 'fill',
        bannerCaption: ''
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      if (modalFileInputRef.current) modalFileInputRef.current.value = '';
    }
  };

  const openModal = () => {
    setDraftConfig(config);
    setUrlInput(config.imageUrl.startsWith('http') ? config.imageUrl : '');
    setIsModalOpen(true);
  };

  const displayTitle = config.titleText.trim() || `Xin chào, ${teacherName}!`;
  const frameHeight = Math.max(190, Math.min(420, config.bannerHeight || 260));

  return (
    <div className="relative space-y-3">
      {/* Input chọn ảnh nhanh ẩn */}
      <input
        ref={quickFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleQuickFileSelect}
        className="hidden"
      />

      {/* Thông báo lưu thành công */}
      {saveToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CHẾ ĐỘ MẶC ĐỊNH ('full'): ẢNH BANNER VỪA KHÍT 100% TOÀN BỘ KHUNG XANH */}
      {/* ===================================================================== */}
      {config.layoutMode === 'full' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith('image/')) {
              setIsUploading(true);
              try {
                const compressed = await compressBannerImageFile(file);
                await persistBannerConfig(
                  { ...config, imageUrl: compressed, objectFit: 'fill', bannerCaption: '' },
                  'Đã cập nhật ảnh Banner vừa khít khung!'
                );
              } finally {
                setIsUploading(false);
              }
            }
          }}
          style={{ height: `${frameHeight}px` }}
          className={`group relative w-full rounded-3xl overflow-hidden shadow-md bg-gradient-to-r ${config.themeGradient} border-2 transition-all ${
            isDragging ? 'border-amber-300 scale-[1.005]' : 'border-teal-600/20'
          }`}
        >
          {config.imageUrl ? (
            <img
              src={config.imageUrl}
              alt="Teacher Overview Banner"
              style={{
                objectFit: config.objectFit || 'fill',
                objectPosition: `center ${config.objectPositionY ?? 50}%`
              }}
              className="w-full h-full block select-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white">
              <ImageIcon className="w-10 h-10 text-teal-200 mb-2" />
              <p className="text-sm font-bold">Chưa có hình ảnh Banner</p>
              <p className="text-xs text-teal-100 mt-1">
                Bấm nút "Đổi ảnh Banner" hoặc kéo thả ảnh vào khung này
              </p>
            </div>
          )}

          {/* Thanh công cụ nổi góc trên bên phải (Hiện khi di chuột hoặc trên màn hình cảm ứng) */}
          <div className="absolute top-3 right-3 z-20 flex flex-wrap items-center gap-1.5 opacity-95 md:opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() =>
                persistBannerConfig(
                  { ...config, layoutMode: 'split', objectFit: 'fill' },
                  'Đã chuyển sang chế độ Khung bên phải (Giữ lời chào bên trái)'
                )
              }
              className="px-2.5 py-1.5 rounded-xl bg-slate-900/75 hover:bg-slate-900 text-white text-[11px] font-bold backdrop-blur-md border border-white/25 shadow-md flex items-center gap-1 cursor-pointer"
              title="Hiện lời chào bên trái và khung ảnh Banner bên phải"
            >
              <Columns className="w-3.5 h-3.5 text-amber-300" />
              <span>Chia 2 cột</span>
            </button>
            <button
              type="button"
              onClick={() => quickFileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-teal-300" />
              <span>{isUploading ? 'Đang tải...' : 'Đổi ảnh Banner'}</span>
            </button>
            <button
              type="button"
              onClick={openModal}
              className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Tùy chỉnh</span>
            </button>
          </div>

          {/* Các nút điều hướng nhanh gọn ở góc trái dưới (Hiện nhẹ khi di chuột để không che ảnh Banner) */}
          <div className="absolute bottom-3 left-4 z-20 flex flex-wrap items-center gap-2 opacity-95 md:opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onNavigate('classes')}
              className="px-3 py-1.5 bg-white/95 hover:bg-white text-teal-900 font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <GraduationCap className="w-3.5 h-3.5 text-teal-600" /> Quản lý Lớp
            </button>
            <button
              type="button"
              onClick={() => onNavigate('exams')}
              className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white font-bold rounded-xl text-xs border border-white/25 backdrop-blur-md shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-300" /> Kho Đề Thi
            </button>
            <button
              type="button"
              onClick={() => onNavigate('assign')}
              className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white font-bold rounded-xl text-xs border border-white/25 backdrop-blur-md shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-teal-300" /> Giao Bài Online
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CHẾ ĐỘ 2 ('split'): CHIA 2 CỘT (CHỮ BÊN TRÁI - BANNER VỪA KHÍT PHẢI)  */}
      {/* ===================================================================== */}
      {config.layoutMode === 'split' && (
        <div
          className={`bg-gradient-to-r ${config.themeGradient} rounded-3xl p-5 md:p-6 text-white shadow-md relative overflow-hidden`}
        >
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            {/* Cột trái: Lời chào & Các nút tác vụ nhanh */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-xs text-white">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{config.badgeText || 'Trang Tổng quan Giáo viên'}</span>
                </span>

                <button
                  type="button"
                  onClick={() =>
                    persistBannerConfig(
                      { ...config, layoutMode: 'full', objectFit: 'fill' },
                      'Đã mở rộng ảnh Banner vừa khít toàn bộ khung xanh!'
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-400/25 hover:bg-amber-400/35 border border-amber-300/50 text-amber-100 transition-all cursor-pointer"
                  title="Phóng ảnh Banner vừa khít 100% toàn bộ khung xanh"
                >
                  <Maximize2 className="w-3 h-3 text-amber-300" />
                  <span>Phóng đầy khung xanh</span>
                </button>

                <button
                  type="button"
                  onClick={openModal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 hover:bg-white/25 border border-white/25 text-white transition-all cursor-pointer"
                >
                  <Settings2 className="w-3 h-3 text-teal-200" />
                  <span>Tùy chỉnh</span>
                </button>
              </div>

              <h1 className="text-xl md:text-2xl font-black tracking-tight leading-tight">
                {displayTitle}
              </h1>

              {config.subtitleText && (
                <p className="text-xs text-teal-50/95 leading-relaxed">
                  {config.subtitleText}
                </p>
              )}

              <div className="pt-1.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('classes')}
                  className="px-3.5 py-2 bg-white text-teal-800 font-bold rounded-xl text-xs shadow-sm hover:bg-teal-50 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <GraduationCap className="w-4 h-4 text-teal-600" /> Quản lý Lớp
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('exams')}
                  className="px-3.5 py-2 bg-teal-900/60 text-white font-bold rounded-xl text-xs border border-teal-400/40 hover:bg-teal-900 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4 text-teal-300" /> Kho Đề Thi
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('assign')}
                  className="px-3.5 py-2 bg-teal-900/60 text-white font-bold rounded-xl text-xs border border-teal-400/40 hover:bg-teal-900 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4 text-teal-300" /> Giao Bài Online
                </button>
              </div>
            </div>

            {/* Cột phải: Khung hiển thị Banner vừa khít 100% không bị cắt chữ */}
            <div className="lg:col-span-7">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    setIsUploading(true);
                    try {
                      const compressed = await compressBannerImageFile(file);
                      await persistBannerConfig(
                        { ...config, imageUrl: compressed, objectFit: 'fill', bannerCaption: '' },
                        'Đã cập nhật ảnh Banner vừa khít khung!'
                      );
                    } finally {
                      setIsUploading(false);
                    }
                  }
                }}
                style={{ height: `${Math.max(185, Math.min(340, config.bannerHeight || 225))}px` }}
                className={`group relative w-full rounded-2xl overflow-hidden border-2 transition-all shadow-lg ${
                  isDragging
                    ? 'border-amber-300 bg-white/20 scale-[1.01]'
                    : 'border-white/25 bg-slate-900/20 hover:border-white/50'
                }`}
              >
                {config.imageUrl ? (
                  <>
                    <img
                      src={config.imageUrl}
                      alt="Teacher Banner"
                      style={{
                        objectFit: config.objectFit || 'fill',
                        objectPosition: `center ${config.objectPositionY ?? 50}%`
                      }}
                      className="w-full h-full block select-none"
                    />

                    {/* Thanh công cụ nổi trên góc phải của khung Banner */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-95 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => quickFileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-teal-300" />
                        <span>{isUploading ? 'Đang tải...' : 'Đổi ảnh Banner'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={openModal}
                        className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white backdrop-blur-md border border-white/20 shadow-md cursor-pointer"
                        title="Cài đặt bố cục & khung Banner"
                      >
                        <Settings2 className="w-4 h-4 text-amber-300" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-white/10 backdrop-blur-xs">
                    <ImageIcon className="w-8 h-8 text-teal-200 mb-2" />
                    <p className="text-sm font-bold text-white">Khu vực hiển thị Banner</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => quickFileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-white text-teal-800 hover:bg-teal-50 text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-teal-600" />
                        <span>Tải ảnh lên</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CHẾ ĐỘ 3 ('cover'): PHỦ NỀN TOÀN KHUNG XANH KÈM CHỮ NỔI               */}
      {/* ===================================================================== */}
      {config.layoutMode === 'cover' && (
        <div
          style={{ minHeight: `${frameHeight}px` }}
          className={`bg-gradient-to-r ${config.themeGradient} rounded-3xl p-6 md:p-8 text-white shadow-md relative overflow-hidden flex flex-col justify-between`}
        >
          {config.imageUrl && (
            <img
              src={config.imageUrl}
              alt="Full Banner Cover"
              style={{
                objectFit: config.objectFit || 'fill',
                objectPosition: `center ${config.objectPositionY ?? 50}%`
              }}
              className="absolute inset-0 w-full h-full block select-none"
            />
          )}

          <div
            style={{
              backgroundColor: `rgba(15, 23, 42, ${(config.overlayOpacity ?? 25) / 100})`
            }}
            className="absolute inset-0 pointer-events-none transition-colors"
          />

          <div className="relative z-10 flex items-center justify-between gap-2">
            {!config.hideGreetingText ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-white border border-white/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{config.badgeText || 'Trang Tổng quan Giáo viên'}</span>
              </span>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => quickFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-slate-900/75 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-teal-300" />
                <span>Đổi ảnh Banner</span>
              </button>
              <button
                type="button"
                onClick={openModal}
                className="px-3 py-1.5 rounded-xl bg-slate-900/75 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Tùy chỉnh</span>
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-auto pt-6 space-y-3">
            {!config.hideGreetingText && (
              <>
                <h1 className="text-xl md:text-3xl font-black drop-shadow-sm">{displayTitle}</h1>
                {config.subtitleText && (
                  <p className="text-xs md:text-sm text-white/90 max-w-2xl leading-relaxed drop-shadow-xs">
                    {config.subtitleText}
                  </p>
                )}
              </>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('classes')}
                className="px-4 py-2 bg-white text-teal-900 font-bold rounded-xl text-xs shadow-md hover:bg-teal-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4 text-teal-600" /> Quản lý Lớp
              </button>
              <button
                type="button"
                onClick={() => onNavigate('exams')}
                className="px-4 py-2 bg-slate-900/75 text-white font-bold rounded-xl text-xs border border-white/30 backdrop-blur-md hover:bg-slate-900 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <BookOpen className="w-4 h-4 text-teal-300" /> Kho Đề Thi
              </button>
              <button
                type="button"
                onClick={() => onNavigate('assign')}
                className="px-4 py-2 bg-slate-900/75 text-white font-bold rounded-xl text-xs border border-white/30 backdrop-blur-md hover:bg-slate-900 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-4 h-4 text-teal-300" /> Giao Bài Online
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CHẾ ĐỘ 4 ('standalone'): BANNER TOÀN KHUNG + THANH CHÀO BÊN DƯỚI      */}
      {/* ===================================================================== */}
      {config.layoutMode === 'standalone' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div
            style={{ height: `${frameHeight}px` }}
            className={`relative w-full bg-gradient-to-r ${config.themeGradient} overflow-hidden group`}
          >
            {config.imageUrl ? (
              <img
                src={config.imageUrl}
                alt="Standalone Banner"
                style={{
                  objectFit: config.objectFit || 'fill',
                  objectPosition: `center ${config.objectPositionY ?? 50}%`
                }}
                className="w-full h-full block select-none"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/80 text-sm font-bold">
                Chưa có ảnh Banner — Bấm "Đổi ảnh Banner" để tải ảnh lên
              </div>
            )}

            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => quickFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-teal-300" />
                <span>Đổi ảnh Banner</span>
              </button>
              <button
                type="button"
                onClick={openModal}
                className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Tùy chỉnh Banner</span>
              </button>
            </div>
          </div>

          <div className="p-4 md:px-6 bg-gradient-to-r from-teal-700 via-teal-600 to-indigo-700 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white">
                  <Sparkles className="w-3 h-3" />
                  <span>{config.badgeText || 'Trang Tổng quan Giáo viên'}</span>
                </span>
                <h1 className="text-base md:text-lg font-black">{displayTitle}</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('classes')}
                className="px-3.5 py-1.5 bg-white text-teal-800 font-bold rounded-xl text-xs shadow-sm hover:bg-teal-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4 text-teal-600" /> Quản lý Lớp
              </button>
              <button
                type="button"
                onClick={() => onNavigate('exams')}
                className="px-3.5 py-1.5 bg-teal-900/60 text-white font-bold rounded-xl text-xs border border-teal-400/40 hover:bg-teal-900 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <BookOpen className="w-4 h-4 text-teal-300" /> Kho Đề Thi
              </button>
              <button
                type="button"
                onClick={() => onNavigate('assign')}
                className="px-3.5 py-1.5 bg-teal-900/60 text-white font-bold rounded-xl text-xs border border-teal-400/40 hover:bg-teal-900 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-4 h-4 text-teal-300" /> Giao Bài Online
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL THIẾT KẾ & CÀI ĐẶT BANNER CHI TIẾT                              */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-indigo-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-black">
                    Thiết kế &amp; Căn chỉnh Khung Banner
                  </h2>
                  <p className="text-xs text-teal-100">
                    Hình ảnh Banner tự động căn vừa khít 100% kích thước khung
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Cột trái: Tải ảnh & Kho mẫu */}
                <div className="lg:col-span-7 space-y-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    1. Chọn hình ảnh Banner
                  </label>

                  <div
                    onClick={() => modalFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleModalFileSelect(file);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
                      isDragging
                        ? 'border-teal-600 bg-teal-50/70'
                        : 'border-teal-300 hover:border-teal-500 bg-teal-50/30 hover:bg-teal-50/60'
                    }`}
                  >
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleModalFileSelect(file);
                      }}
                      className="hidden"
                    />
                    <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto mb-2 shadow-sm">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-teal-950">
                      {isUploading ? 'Đang xử lý ảnh sắc nét...' : 'Bấm để tải ảnh Banner từ máy tính'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Hỗ trợ JPG, PNG, WebP, GIF • Tự động vừa khít 100% khung xanh
                    </p>
                  </div>

                  {/* Xem trước ảnh đang chọn */}
                  {draftConfig.imageUrl && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-gray-600 flex items-center justify-between">
                        <span>Xem trước tỉ lệ vừa khít khung:</span>
                        <button
                          type="button"
                          onClick={() => setDraftConfig((prev) => ({ ...prev, imageUrl: '' }))}
                          className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa ảnh
                        </button>
                      </div>
                      <div className="w-full h-36 rounded-2xl overflow-hidden border border-gray-300 bg-slate-900">
                        <img
                          src={draftConfig.imageUrl}
                          alt="Preview"
                          style={{
                            objectFit: draftConfig.objectFit || 'fill',
                            objectPosition: `center ${draftConfig.objectPositionY ?? 50}%`
                          }}
                          className="w-full h-full block"
                        />
                      </div>
                    </div>
                  )}

                  {/* Nhập URL ảnh trực tuyến */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <LinkIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Hoặc dán đường dẫn (URL) hình ảnh trực tuyến..."
                        className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (urlInput.trim()) {
                          setDraftConfig((prev) => ({
                            ...prev,
                            imageUrl: urlInput.trim(),
                            objectFit: 'fill'
                          }));
                        }
                      }}
                      className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      Áp dụng link
                    </button>
                  </div>

                  {/* Kho mẫu Banner dựng sẵn */}
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-teal-600" />
                      <span>Hoặc chọn Mẫu Banner Giáo dục dựng sẵn:</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {PRESET_BANNERS.map((preset) => {
                        const isSelected = draftConfig.imageUrl === preset.svgDataUrl;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                imageUrl: preset.svgDataUrl,
                                bannerCaption: '',
                                themeGradient: preset.previewGradient
                              }))
                            }
                            className={`group text-left rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-teal-600 ring-2 ring-teal-500/30 bg-teal-50/40'
                                : 'border-gray-200 hover:border-teal-400 bg-white'
                            }`}
                          >
                            <div className="h-16 w-full overflow-hidden bg-slate-900 relative">
                              <img
                                src={preset.svgDataUrl}
                                alt={preset.name}
                                className="w-full h-full object-fill"
                              />
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shadow">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                            <div className="p-2">
                              <div className="text-[11px] font-bold text-gray-800 line-clamp-1">
                                {preset.name}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Cột phải: Chọn kiểu bố cục & Co giãn */}
                <div className="lg:col-span-5 space-y-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    2. Kiểu khung hiển thị Banner
                  </label>

                  <div className="grid grid-cols-1 gap-2">
                    {[
                      {
                        id: 'full' as BannerLayoutMode,
                        title: 'Vừa khít toàn bộ khung xanh (Khuyên dùng)',
                        desc: 'Ảnh Banner phủ kín 100% kích thước khung lớn, không bị cắt chữ hay hình',
                        icon: Maximize2
                      },
                      {
                        id: 'split' as BannerLayoutMode,
                        title: 'Chia 2 bên (Lời chào trái - Banner phải)',
                        desc: 'Bên trái hiện lời chào & nút, bên phải hiện trọn vẹn ảnh Banner',
                        icon: Columns
                      },
                      {
                        id: 'standalone' as BannerLayoutMode,
                        title: 'Banner toàn khung + Thanh nút bên dưới',
                        desc: 'Ảnh Banner rộng 100% ở trên, thanh lời chào & nút nằm ngay dưới',
                        icon: Layout
                      },
                      {
                        id: 'cover' as BannerLayoutMode,
                        title: 'Làm nền dưới chữ chào mừng',
                        desc: 'Ảnh Banner làm nền, chữ chào mừng và nút hiển thị đè lên trên',
                        icon: ImageIcon
                      }
                    ].map((mode) => {
                      const Icon = mode.icon;
                      const active = draftConfig.layoutMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setDraftConfig((prev) => ({ ...prev, layoutMode: mode.id }))}
                          className={`p-2.5 rounded-2xl border-2 text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                            active
                              ? 'border-teal-600 bg-teal-50/60 shadow-2xs'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              active ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-gray-900 flex items-center justify-between">
                              <span>{mode.title}</span>
                              {active && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{mode.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Tuỳ chỉnh Co giãn ảnh & Chiều cao */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                      <Sliders className="w-3.5 h-3.5 text-teal-600" />
                      <span>Cách co giãn ảnh theo kích thước khung</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'fill' as BannerObjectFit, label: 'Vừa khít 100% khung' },
                        { id: 'contain' as BannerObjectFit, label: 'Giữ tỉ lệ gốc' },
                        { id: 'cover' as BannerObjectFit, label: 'Phóng lấp đầy' }
                      ].map((fit) => (
                        <button
                          key={fit.id}
                          type="button"
                          onClick={() => setDraftConfig((prev) => ({ ...prev, objectFit: fit.id }))}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            draftConfig.objectFit === fit.id
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {fit.label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-medium text-gray-600 mb-1">
                        <span>Chiều cao khung Banner</span>
                        <span className="font-bold text-teal-700">{draftConfig.bannerHeight}px</span>
                      </div>
                      <input
                        type="range"
                        min={190}
                        max={400}
                        step={10}
                        value={draftConfig.bannerHeight}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            bannerHeight: Number(e.target.value)
                          }))
                        }
                        className="w-full accent-teal-600 cursor-pointer"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold text-teal-800 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftConfig.showOnStudentDashboard}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            showOnStudentDashboard: e.target.checked
                          }))
                        }
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>Hiển thị đồng bộ Banner này ở Cổng Học Sinh</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setDraftConfig(DEFAULT_CONFIG)}
                className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục mẫu mặc định</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await persistBannerConfig(draftConfig, 'Đã lưu thiết kế Banner vừa khít khung!');
                    setIsModalOpen(false);
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu &amp; Áp dụng Banner</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
