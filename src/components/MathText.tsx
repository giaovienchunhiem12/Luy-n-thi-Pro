import React from 'react';
import katex from 'katex';
import { sanitizeMathContent } from '../utils/mathSanitizer';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Biến đổi các công thức $...$ và $$...$$ (nằm ngoài thẻ HTML <...>) thành chuỗi HTML của KaTeX,
 * đồng thời giữ nguyên cấu trúc bảng dữ liệu <table>...</table>, hình ảnh <img .../> và định dạng xuống dòng.
 */
function renderMixedHtmlAndMath(input: string): string {
  if (!input) return '';

  // Bảo vệ các thẻ HTML hợp lệ (<img ...>, <table ...>, <u>...) và các khối công thức $$...$$ / $...$
  // Lưu ý: Không dùng <[^>]+> chung chung để tránh dấu '<' trong bất đẳng thức (VD: t < 5) nuốt mất thẻ <img> phía sau!
  const tokenRegex = /(<\/?(?:img|table|thead|tbody|tfoot|tr|th|td|u|b|strong|i|em|sub|sup|br|p|div|span|ul|ol|li)\b[^>]*>|\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let result = '';
  let insideTableDepth = 0;

  const formatPlainTextChunk = (plain: string, inTable: boolean): string => {
    const escaped = plain
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    if (inTable) {
      return escaped;
    }
    return escaped.replace(/\n/g, '<br />');
  };

  while ((match = tokenRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      result += formatPlainTextChunk(input.substring(lastIndex, match.index), insideTableDepth > 0);
    }

    const token = match[0];
    if (token.startsWith('<')) {
      if (/^<table\b/i.test(token)) {
        insideTableDepth++;
      } else if (/^<\/table\b/i.test(token)) {
        insideTableDepth = Math.max(0, insideTableDepth - 1);
      }
      result += token;
    } else if (token.startsWith('$$') && token.endsWith('$$')) {
      const mathContent = token.slice(2, -2).trim();
      try {
        result += katex.renderToString(mathContent, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        result += formatPlainTextChunk(token, insideTableDepth > 0);
      }
    } else if (token.startsWith('$') && token.endsWith('$')) {
      const mathContent = token.slice(1, -1).trim();
      try {
        result += katex.renderToString(mathContent, {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        result += formatPlainTextChunk(token, insideTableDepth > 0);
      }
    } else {
      result += formatPlainTextChunk(token, insideTableDepth > 0);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    result += formatPlainTextChunk(input.substring(lastIndex), insideTableDepth > 0);
  }

  return result;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  const sanitized = sanitizeMathContent(text);

  // Kiểm tra xem nội dung có chứa thẻ HTML (hình ảnh, đồ thị, bảng dữ liệu, gạch chân...) hay không
  const hasHtmlMarkup = /<(?:img|table|thead|tbody|tr|th|td|u|b|i|strong|em|br|p|div|span|sup|sub|ul|ol|li)\b/i.test(
    sanitized
  );

  if (hasHtmlMarkup) {
    const htmlWithKatex = renderMixedHtmlAndMath(sanitized);
    return (
      <span
        className={`leading-relaxed break-words [&_img]:max-h-60 [&_img]:max-w-full [&_img]:w-auto [&_img]:h-auto [&_img]:object-contain [&_img]:rounded-lg [&_img]:my-1.5 [&_img]:inline-block [&_img]:align-middle [&_table]:border-collapse [&_table]:my-2 [&_table]:w-auto [&_table]:max-w-full [&_table]:text-xs [&_table]:bg-white [&_table]:shadow-2xs [&_th]:border [&_th]:border-gray-400 [&_th]:bg-gray-100 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:font-bold [&_th]:text-gray-800 [&_th]:text-center [&_td]:border [&_td]:border-gray-300 [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:text-gray-800 [&_td]:text-center ${className}`}
        dangerouslySetInnerHTML={{ __html: htmlWithKatex }}
      />
    );
  }

  // Trường hợp văn bản thuần + công thức toán học
  const parts: { type: 'text' | 'inline-math' | 'block-math'; content: string }[] = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(sanitized)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: sanitized.substring(lastIndex, match.index),
      });
    }

    const mathStr = match[0];
    if (mathStr.startsWith('$$') && mathStr.endsWith('$$')) {
      parts.push({
        type: 'block-math',
        content: mathStr.slice(2, -2).trim(),
      });
    } else {
      parts.push({
        type: 'inline-math',
        content: mathStr.slice(1, -1).trim(),
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < sanitized.length) {
    parts.push({
      type: 'text',
      content: sanitized.substring(lastIndex),
    });
  }

  return (
    <span className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx}>{part.content}</span>;
        }

        try {
          const html = katex.renderToString(part.content, {
            displayMode: part.type === 'block-math',
            throwOnError: false,
          });
          return (
            <span
              key={idx}
              className={part.type === 'block-math' ? 'block my-2 overflow-x-auto' : 'inline-block mx-0.5'}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={idx}>{part.content}</span>;
        }
      })}
    </span>
  );
};
