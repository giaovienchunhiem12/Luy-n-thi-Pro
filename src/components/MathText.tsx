import React from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  const parts: Array<{ type: 'text' | 'inline' | 'block'; content: string }> = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
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

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx}>{part.content}</span>;
        }
        try {
          const html = katex.renderToString(part.content, {
            displayMode: part.type === 'block',
            throwOnError: false
          });
          return (
            <span
              key={idx}
              dangerouslySetInnerHTML={{ __html: html }}
              className={part.type === 'block' ? 'block my-2 overflow-x-auto text-center' : 'inline-block mx-0.5'}
            />
          );
        } catch (e) {
          return <span key={idx} className="text-red-500">[{part.content}]</span>;
        }
      })}
    </span>
  );
};
