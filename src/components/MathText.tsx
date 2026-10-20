import React from 'react';
import katex from 'katex';
import { sanitizeMathContent } from '../utils/mathSanitizer';

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Chuẩn hóa nội dung MathType, MathML, LaTeX delimiters
  const sanitized = sanitizeMathContent(text);

  const parts: Array<{ type: 'text' | 'inline' | 'block'; content: string }> = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(sanitized)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: sanitized.substring(lastIndex, match.index) });
    }
    const fullMatch = match[0];
    if (fullMatch.startsWith('$$')) {
      const mathContent = fullMatch.slice(2, -2);
      parts.push({ type: 'block', content: mathContent });
    } else {
      const mathContent = fullMatch.slice(1, -1);
      parts.push({ type: 'inline', content: mathContent });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < sanitized.length) {
    parts.push({ type: 'text', content: sanitized.substring(lastIndex) });
  }

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          // Nếu đoạn văn bản chứa hình ảnh hoặc thẻ HTML (như <u> gạch chân đáp án, <br>, <img>)
          if (/<(?:img|u|b|i|strong|em|br|p|div|span)\b/i.test(part.content)) {
            return (
              <span
                key={idx}
                dangerouslySetInnerHTML={{ __html: part.content }}
                className="inline align-baseline [&_img.math-formula-img]:inline-block [&_img.math-formula-img]:align-baseline [&_img.math-formula-img]:mx-0.5 [&_img.math-formula-img]:my-0 [&_img.math-formula-img]:shadow-none [&_img.math-formula-img]:border-0 [&_img:not(.math-formula-img)]:max-w-full [&_img:not(.math-formula-img)]:h-auto [&_img:not(.math-formula-img)]:mx-auto [&_img:not(.math-formula-img)]:my-2.5 [&_img:not(.math-formula-img)]:block [&_img:not(.math-formula-img)]:rounded-lg"
              />
            );
          }
          return <span key={idx}>{part.content}</span>;
        }
        try {
          const html = katex.renderToString(part.content.trim(), {
            displayMode: part.type === 'block',
            throwOnError: false,
            strict: false
          });
          return (
            <span
              key={idx}
              dangerouslySetInnerHTML={{ __html: html }}
              className={part.type === 'block' ? 'block my-2 overflow-x-auto text-center' : 'inline-block mx-0.5 align-middle'}
            />
          );
        } catch (e) {
          return <span key={idx} className="font-mono text-teal-700 font-semibold mx-0.5">{part.content}</span>;
        }
      })}
    </span>
  );
};
