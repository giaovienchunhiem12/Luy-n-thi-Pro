import React from 'react';
import { MathText } from './MathText';
import { sanitizeMathContent } from '../utils/mathSanitizer';
import { Calculator, Image as ImageIcon, Table as TableIcon } from 'lucide-react';

interface MathPreviewProps {
  content: string;
  label?: string;
  className?: string;
}

export const MathPreview: React.FC<MathPreviewProps> = ({
  content,
  label = 'Xem trước nội dung (MathType / Hình ảnh / Bảng dữ liệu):',
  className = ''
}) => {
  if (!content || !content.trim()) return null;

  const sanitized = sanitizeMathContent(content);

  const hasMath = /\$|\\frac|\\sqrt|\\int|\\sum|\\lim|\\vec|<math|<m:oMath|\^|_|\\alpha|\\beta|\\Delta|\\pi/i.test(content);
  const hasImage = /<img\b/i.test(content);
  const hasTable = /<table\b/i.test(content);

  return (
    <div className={`mt-1.5 p-2.5 rounded-lg border border-teal-100 bg-teal-50/50 text-gray-900 transition-all ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1 text-[11px] font-semibold text-teal-800 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5 text-teal-600" />
          <span>{label}</span>
        </span>
        <div className="flex items-center gap-1.5">
          {hasImage && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold">
              <ImageIcon className="w-3 h-3" />
              <span>Hình ảnh / Đồ thị</span>
            </span>
          )}
          {hasTable && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 font-semibold">
              <TableIcon className="w-3 h-3" />
              <span>Bảng dữ liệu</span>
            </span>
          )}
          {hasMath && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-100 text-teal-800 font-medium">
              MathType / LaTeX
            </span>
          )}
        </div>
      </div>
      <div className="text-xs leading-relaxed text-gray-800 bg-white/90 p-2.5 rounded border border-teal-100/60 font-normal overflow-x-auto">
        <MathText text={sanitized} />
      </div>
    </div>
  );
};
