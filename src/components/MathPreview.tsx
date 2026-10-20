import React from 'react';
import { MathText } from './MathText';
import { sanitizeMathContent } from '../utils/mathSanitizer';
import { Calculator } from 'lucide-react';

interface MathPreviewProps {
  content: string;
  label?: string;
  className?: string;
}

export const MathPreview: React.FC<MathPreviewProps> = ({
  content,
  label = 'Xem trước công thức (MathType / KaTeX):',
  className = ''
}) => {
  if (!content || !content.trim()) return null;

  const sanitized = sanitizeMathContent(content);

  // Kiểm tra xem nội dung có chứa công thức toán hay không
  const hasMath = /\$|\\frac|\\sqrt|\\int|\\sum|\\lim|\\vec|<math|<m:oMath|\^|_|\\alpha|\\beta|\\Delta|\\pi/i.test(content);

  return (
    <div className={`mt-1.5 p-2.5 rounded-lg border border-teal-100 bg-teal-50/50 text-gray-900 transition-all ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1 text-[11px] font-semibold text-teal-800">
        <span className="flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5 text-teal-600" />
          <span>{label}</span>
        </span>
        {hasMath && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-100 text-teal-800 font-medium">
            MathType / LaTeX
          </span>
        )}
      </div>
      <div className="text-xs leading-relaxed text-gray-800 bg-white/90 p-2 rounded border border-teal-100/60 font-normal">
        <MathText text={sanitized} />
      </div>
    </div>
  );
};
