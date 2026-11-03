import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Sparkles, Calculator, CornerDownLeft, RotateCcw } from 'lucide-react';
import { MathText } from './MathText';
import { decodePdfMathSymbols } from '../utils/mathSanitizer';

export interface MathEquationModalProps {
  isOpen: boolean;
  initialValue: string;
  fieldLabel: string;
  onClose: () => void;
  onApply: (newValue: string) => void;
}

type PaletteTab = 'structures' | 'operators' | 'greek' | 'presets';

interface TemplateButton {
  label: string;
  preview: string;
  insert: string;
  cursorOffset?: number;
  title: string;
}

const STRUCTURE_TEMPLATES: TemplateButton[] = [
  { label: 'a/b', preview: '$\\frac{a}{b}$', insert: '$\\frac{a}{b}$', cursorOffset: -4, title: 'Phân số (Fraction)' },
  { label: '√x', preview: '$\\sqrt{x}$', insert: '$\\sqrt{x}$', cursorOffset: -2, title: 'Căn bậc hai (Square root)' },
  { label: 'ⁿ√x', preview: '$\\sqrt[n]{x}$', insert: '$\\sqrt[3]{x}$', cursorOffset: -2, title: 'Căn bậc n (Nth root)' },
  { label: 'xⁿ', preview: '$x^{n}$', insert: '$x^{2}$', cursorOffset: -2, title: 'Lũy thừa / Số mũ (Superscript)' },
  { label: 'xᵢ', preview: '$x_{i}$', insert: '$x_{1}$', cursorOffset: -2, title: 'Chỉ số dưới (Subscript)' },
  { label: 'xᵢⁿ', preview: '$x_{i}^{n}$', insert: '$x_{1}^{2}$', cursorOffset: -2, title: 'Chỉ số dưới kèm số mũ' },
  { label: '10ⁿ', preview: '$10^{-n}$', insert: '$10^{-6}$', cursorOffset: -2, title: 'Lũy thừa cơ số 10 (10^-n)' },
  { label: 'v⃗', preview: '$\\vec{F}$', insert: '$\\vec{F}$', cursorOffset: -2, title: 'Vectơ (Vector arrow)' },
  { label: 'A̅B̅', preview: '$\\overline{AB}$', insert: '$\\overline{AB}$', cursorOffset: -2, title: 'Đoạn thẳng / Giá trị trung bình' },
  { label: '∠ABC', preview: '$\\widehat{ABC}$', insert: '$\\widehat{ABC}$', cursorOffset: -2, title: 'Góc (Angle hat)' },
  { label: '|x|', preview: '$\\left| x \\right|$', insert: '$\\left| x \\right|$', cursorOffset: -8, title: 'Giá trị tuyệt đối' },
  { label: '(a/b)', preview: '$\\left( \\frac{a}{b} \\right)$', insert: '$\\left( \\frac{a}{b} \\right)$', cursorOffset: -11, title: 'Ngoặc tròn co giãn' },
  { label: '∫', preview: '$\\int_{a}^{b} f(x)dx$', insert: '$\\int_{a}^{b} $', cursorOffset: -1, title: 'Tích phân xác định' },
  { label: '∑', preview: '$\\sum_{i=1}^{n}$', insert: '$\\sum_{i=1}^{n} $', cursorOffset: -1, title: 'Tổng Sigma' },
  { label: 'lim', preview: '$\\lim_{x \\to 0}$', insert: '$\\lim_{x \\to 0} $', cursorOffset: -1, title: 'Giới hạn (Limit)' },
  {
    label: 'Hệ PT',
    preview: '$\\begin{cases} a \\\\ b \\end{cases}$',
    insert: '$\\begin{cases} x = 1 \\\\ y = 2 \\end{cases}$',
    cursorOffset: -14,
    title: 'Hệ phương trình (Cases)'
  },
];

const OPERATOR_TEMPLATES: TemplateButton[] = [
  { label: '=', preview: '=', insert: ' = ', title: 'Dấu bằng (=)' },
  { label: '+', preview: '+', insert: ' + ', title: 'Dấu cộng (+)' },
  { label: '-', preview: '-', insert: ' - ', title: 'Dấu trừ (-)' },
  { label: '±', preview: '$\\pm$', insert: ' \\pm ', title: 'Cộng trừ (±)' },
  { label: '×', preview: '$\\times$', insert: ' \\times ', title: 'Phép nhân (×)' },
  { label: '⋅', preview: '$\\cdot$', insert: ' \\cdot ', title: 'Nhân chấm (⋅)' },
  { label: '÷', preview: '$\\div$', insert: ' \\div ', title: 'Phép chia (÷)' },
  { label: '≤', preview: '$\\le$', insert: ' \\le ', title: 'Nhỏ hơn hoặc bằng (≤)' },
  { label: '≥', preview: '$\\ge$', insert: ' \\ge ', title: 'Lớn hơn hoặc bằng (≥)' },
  { label: '≠', preview: '$\\ne$', insert: ' \\ne ', title: 'Khác (≠)' },
  { label: '≈', preview: '$\\approx$', insert: ' \\approx ', title: 'Xấp xỉ bằng (≈)' },
  { label: '≡', preview: '$\\equiv$', insert: ' \\equiv ', title: 'Đồng nhất / Trùng (≡)' },
  { label: '∝', preview: '$\\propto$', insert: ' \\propto ', title: 'Tỉ lệ thuận (∝)' },
  { label: '→', preview: '$\\rightarrow$', insert: ' \\rightarrow ', title: 'Mũi tên suy ra / phản ứng (→)' },
  { label: '⇒', preview: '$\\Rightarrow$', insert: ' \\Rightarrow ', title: 'Suy ra (⇒)' },
  { label: '⇔', preview: '$\\Leftrightarrow$', insert: ' \\Leftrightarrow ', title: 'Tương đương (⇔)' },
  { label: '°', preview: '$^\\circ$', insert: '°', title: 'Độ (°)' },
  { label: '°C', preview: '$^\\circ\\text{C}$', insert: '°C', title: 'Độ C (°C)' },
  { label: '∞', preview: '$\\infty$', insert: '\\infty', title: 'Vô cực (∞)' },
  { label: '⊥', preview: '$\\perp$', insert: ' \\perp ', title: 'Vuông góc (⊥)' },
  { label: '∠', preview: '$\\angle$', insert: '\\angle ', title: 'Góc (∠)' },
  { label: '∈', preview: '$\\in$', insert: ' \\in ', title: 'Thuộc (∈)' },
  { label: '⊂', preview: '$\\subset$', insert: ' \\subset ', title: 'Tập con (⊂)' },
  { label: '∪', preview: '$\\cup$', insert: ' \\cup ', title: 'Hợp (∪)' },
];

const GREEK_TEMPLATES: TemplateButton[] = [
  { label: 'λ', preview: '$\\lambda$', insert: 'λ', title: 'Lambda (λ - bước sóng, nhiệt nóng chảy riêng)' },
  { label: 'Δ', preview: '$\\Delta$', insert: 'Δ', title: 'Delta hoa (Δ - độ biến thiên)' },
  { label: 'π', preview: '$\\pi$', insert: 'π', title: 'Pi (π ≈ 3,14)' },
  { label: 'ω', preview: '$\\omega$', insert: 'ω', title: 'Omega (ω - tần số góc)' },
  { label: 'Ω', preview: '$\\Omega$', insert: 'Ω', title: 'Omega hoa (Ω - điện trở Ohm)' },
  { label: 'α', preview: '$\\alpha$', insert: 'α', title: 'Alpha (α)' },
  { label: 'β', preview: '$\\beta$', insert: 'β', title: 'Beta (β)' },
  { label: 'γ', preview: '$\\gamma$', insert: 'γ', title: 'Gamma (γ)' },
  { label: 'φ', preview: '$\\varphi$', insert: 'φ', title: 'Phi (φ - pha ban đầu)' },
  { label: 'Φ', preview: '$\\Phi$', insert: 'Φ', title: 'Phi hoa (Φ - từ thông)' },
  { label: 'ρ', preview: '$\\rho$', insert: 'ρ', title: 'Rho (ρ - khối lượng riêng, điện trở suất)' },
  { label: 'μ', preview: '$\\mu$', insert: 'μ', title: 'Mu (μ - hệ số ma sát, micro)' },
  { label: 'ε', preview: '$\\varepsilon$', insert: 'ε', title: 'Epsilon (ε - hằng số điện môi, suất điện động)' },
  { label: 'σ', preview: '$\\sigma$', insert: 'σ', title: 'Sigma (σ)' },
  { label: 'τ', preview: '$\\tau$', insert: 'τ', title: 'Tau (τ)' },
  { label: 'θ', preview: '$\\theta$', insert: 'θ', title: 'Theta (θ)' },
  { label: 'η', preview: '$\\eta$', insert: 'η', title: 'Eta (η - hiệu suất)' },
  { label: 'Σ', preview: '$\\Sigma$', insert: 'Σ', title: 'Sigma hoa (Σ)' },
];

const PRESET_FORMULAS: { category: string; items: { name: string; latex: string }[] }[] = [
  {
    category: 'Nhiệt học & Khí lí tưởng',
    items: [
      { name: 'Nhiệt nóng chảy riêng (λ = Q/m)', latex: '$\\lambda = \\frac{Q}{m}$' },
      { name: 'Nhiệt lượng nóng chảy (Q = λm)', latex: '$Q = \\lambda m$' },
      { name: 'Tỉ số Q = λ/m (Phương án nhiễu)', latex: '$Q = \\frac{\\lambda}{m}$' },
      { name: 'Nhiệt lượng thu/tỏa (Q = mcΔt)', latex: '$Q = mc\\Delta t$' },
      { name: 'Nhiệt hóa hơi riêng (L = Q/m)', latex: '$L = \\frac{Q}{m}$' },
      { name: 'Định luật I Nhiệt động lực học', latex: '$\\Delta U = A + Q$' },
      { name: 'Phương trình trạng thái khí lí tưởng', latex: '$\\frac{pV}{T} = \\text{hằng số}$' },
      { name: 'Phương trình Clapeyron', latex: '$pV = nRT$' },
      { name: 'Động năng trung bình phân tử', latex: '$\\overline{E}_{đ} = \\frac{3}{2}kT$' },
    ],
  },
  {
    category: 'Dao động, Sóng & Điện - Từ',
    items: [
      { name: 'Bước sóng (λ = v/f = vT)', latex: '$\\lambda = \\frac{v}{f}$' },
      { name: 'Chu kì con lắc đơn', latex: '$T = 2\\pi\\sqrt{\\frac{l}{g}}$' },
      { name: 'Chu kì con lắc lò xo', latex: '$T = 2\\pi\\sqrt{\\frac{m}{k}}$' },
      { name: 'Tần số góc (ω = 2π/T)', latex: '$\\omega = \\frac{2\\pi}{T}$' },
      { name: 'Định luật Ôm (I = U/R)', latex: '$I = \\frac{U}{R}$' },
      { name: 'Định luật Coulomb', latex: '$F = k\\frac{|q_{1}q_{2}|}{r^{2}}$' },
      { name: 'Cảm ứng từ (B = F / Il sinα)', latex: '$B = \\frac{F}{I l \\sin\\alpha}$' },
      { name: 'Hệ thức Einstein (E = mc²)', latex: '$E = mc^{2}$' },
    ],
  },
];

/**
 * Tạm thời thay thế các thẻ HTML (<img ...>, <table ...>...</table>, <...>) bằng token an toàn
 * để các biểu thức chính quy sửa công thức KHÔNG BAO GIỜ chạm vào chuỗi base64 của hình ảnh.
 */
function protectHtmlBlocksForFormulaFix(input: string): {
  safeText: string;
  restore: (text: string) => string;
} {
  if (!input) {
    return { safeText: '', restore: (t) => t };
  }
  const blocks: string[] = [];
  const safeText = input.replace(
    /<table\b[\s\S]*?<\/table>|<\/?[a-zA-Z][^>]*>/gi,
    (match) => {
      const idx = blocks.length;
      blocks.push(match);
      return `\x00HTML_PRESERVE_${idx}\x00`;
    }
  );
  return {
    safeText,
    restore: (text: string) =>
      text.replace(/\x00HTML_PRESERVE_(\d+)\x00/g, (_, idxStr) => blocks[Number(idxStr)] || ''),
  };
}

/**
 * Tự động sửa lỗi công thức trong một chuỗi văn bản hoặc đáp án:
 * - Giải mã ký tự PUA / ô vuông ▯ thành dấu =
 * - Chuyển biểu thức dạng a/b đơn giản hoặc tử/mẫu bị xuống dòng thành \frac{a}{b}
 * - Bảo toàn 100% các thẻ <img ...> và <table ...> ở mọi vị trí
 */
export function autoFixFormulaText(rawText: string): string {
  if (!rawText) return '';
  const { safeText, restore } = protectHtmlBlocksForFormulaFix(rawText);
  let text = decodePdfMathSymbols(safeText);

  // Thay thế các ký tự hộp lỗi font còn sót
  text = text.replace(/[\u25AF\u25A1\uFFFD]+/g, '=');

  // Nếu một phương án có dạng 2 dòng bị tách tử/mẫu (ví dụ dòng 1 kết thúc bằng "=" và dòng 2 có tử/mẫu)
  // Lưu ý: Không gộp nếu dòng 2 là hình ảnh hoặc bảng dữ liệu
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (
    lines.length === 2 &&
    /=\s*$/.test(lines[0]) &&
    !/\x00HTML_PRESERVE_\d+\x00/.test(lines[1])
  ) {
    const tokens = lines[1].split(/\s+/).filter(Boolean);
    if (tokens.length === 2) {
      text = `${lines[0]} $\\frac{${tokens[0]}}{${tokens[1]}}$`;
    } else if (tokens.length === 1) {
      text = `${lines[0]} ${tokens[0]}`;
    }
  }

  // Chuyển đổi phân số dạng gõ tay "λ = Q/m" hoặc "Q = λ/m" (ngoài thẻ HTML / URL) sang \frac{tử}{mẫu}
  text = text.replace(
    /(^|[\s=+\-(])([A-Za-zα-ωΑ-ΩΔλμωπρστφθ0-9]+(?:\^\{?[0-9+\-]+\}?|_\{?[0-9a-zA-Z]+\}?)?)\s*\/\s*([A-Za-zα-ωΑ-ΩΔλμωπρστφθ0-9]+(?:\^\{?[0-9+\-]+\}?|_\{?[0-9a-zA-Z]+\}?)?)(?=$|[\s.,;)\-+])/g,
    (match, prefix, num, den) => {
      // Không biến đổi nếu chứa token HTML bảo vệ
      if (num.includes('\x00') || den.includes('\x00')) {
        return match;
      }
      // Không biến đổi đơn vị đo thông thường như m/s, km/h, J/kg, W/m, vòng/phút nếu đứng sau khoảng trắng không có dấu =
      if (/^(?:m|km|cm|mm|J|kJ|W|kW|N|C|V|mol|g|kg|vòng)$/i.test(num) && /^(?:s|h|phút|giây|kg|g|mol|m|cm|lít|K)$/i.test(den) && !/=/.test(prefix)) {
        return match;
      }
      return `${prefix}\\frac{${num}}{${den}}`;
    }
  );

  return restore(text).trim();
}

/**
 * Khôi phục phân số bị tách rời tử số (nhảy lên cuối câu hỏi) và mẫu số (rớt xuống dòng cuối của đáp án D)
 * đồng thời chuẩn hóa toàn bộ ký tự lỗi font ▯ trong một câu hỏi (bảo toàn 100% hình ảnh và bảng dữ liệu)
 */
export function repairDetachedFractionsInQuestion<T extends {
  questionText: string;
  questionTextAfter?: string;
  options: string[];
  correctAnswer?: string;
  questionType?: string;
  solution?: string;
}>(q: T): T {
  const cleanPuaPreservingHtml = (str: string): string => {
    const { safeText, restore } = protectHtmlBlocksForFormulaFix(str);
    return restore(decodePdfMathSymbols(safeText).replace(/[\u25AF\u25A1\uFFFD]+/g, '='));
  };

  let questionText = cleanPuaPreservingHtml(q.questionText || '');
  let questionTextAfter = q.questionTextAfter
    ? cleanPuaPreservingHtml(q.questionTextAfter)
    : q.questionTextAfter;
  let options = (q.options || []).map((opt) => cleanPuaPreservingHtml(opt || ''));
  let solution = q.solution ? cleanPuaPreservingHtml(q.solution) : q.solution;

  // Khôi phục tự động cho câu hỏi Phần II (Đúng/Sai) nếu 4 ý a), b), c), d) bị dính vào nội dung câu hỏi
  // và các ô phương án a), b), c), d) đang bị gán nhầm chữ "Đúng -" / "Sai -"
  const areOptionsTfPlaceholders =
    options.length === 4 &&
    options.every((opt) =>
      /^(?:[a-d][\.\)]\s*)?(?:đúng|sai|đ|s|true|false|ý\s*thứ\s*\d+)[\s\-\–\—\,\;\.]*$/i.test(opt.trim())
    );

  if (q.questionType === 'đúng sai' || areOptionsTfPlaceholders) {
    const cleanStemCandidate = questionText
      .replace(/(?:^|[\r\n\s])(?:Đáp\s*án|Đáp\s*số|Kết\s*quả)\s*[:=\-\.]?\s*$/i, '')
      .trim();

    const subMatches = Array.from(cleanStemCandidate.matchAll(/(?<=^|[\r\n\s])([a-d])[\.\)]\s+/g));
    const aIdx = subMatches.findIndex((m) => m[1] === 'a');
    if (aIdx !== -1) {
      const aM = subMatches[aIdx];
      const afterA = subMatches.slice(aIdx + 1);
      const bM = afterA.find((m) => m[1] === 'b');
      const cM = bM ? afterA.slice(afterA.indexOf(bM) + 1).find((m) => m[1] === 'c') : undefined;
      const dM = cM ? afterA.slice(afterA.indexOf(cM) + 1).find((m) => m[1] === 'd') : undefined;

      if (aM && bM && cM) {
        const cluster = [aM, bM, cM, dM].filter(Boolean) as RegExpMatchArray[];
        const newStem = cleanStemCandidate.substring(0, aM.index!).trim();
        const extractedOpts: string[] = [];
        const subLetters = ['a', 'b', 'c', 'd'];

        for (let k = 0; k < cluster.length; k++) {
          const cur = cluster[k];
          const next = cluster[k + 1];
          const start = cur.index! + cur[0].length;
          const end = next ? next.index! : cleanStemCandidate.length;
          const body = cleanStemCandidate
            .substring(start, end)
            .replace(/(?:^|[\r\n\s])(?:Đáp\s*án|Đáp\s*số|Kết\s*quả)\s*[:=\-\.]?\s*$/i, '')
            .trim();
          extractedOpts.push(`${subLetters[k]}) ${body}`);
        }

        if (extractedOpts.length >= 3 && areOptionsTfPlaceholders) {
          while (extractedOpts.length < 4) {
            extractedOpts.push(`${subLetters[extractedOpts.length]}) Ý thứ ${extractedOpts.length + 1}`);
          }
          questionText = newStem || questionText;
          options = extractedOpts;
        }
      }
    }
  }

  // Kiểm tra trường hợp các đáp án có dấu "=" bị bỏ lửng (ví dụ C. "λ =" và D. "Q =\nm   m")
  if (options.length >= 2) {
    const lastIdx = options.length - 1;
    const lastOptLines = options[lastIdx].split('\n').map((l) => l.trim()).filter(Boolean);
    const lastLineText = lastOptLines[lastOptLines.length - 1] || '';

    // Tìm các phương án kết thúc bằng dấu "=" (trên dòng đầu tiên của phương án đó)
    const danglingIndices: number[] = [];
    options.forEach((opt, idx) => {
      const firstLine = opt.split('\n')[0].trim();
      if (/=\s*$/.test(firstLine) && !/<(?:img|table)\b/i.test(firstLine)) {
        danglingIndices.push(idx);
      }
    });

    if (
      danglingIndices.length > 0 &&
      lastOptLines.length >= 2 &&
      !/<(?:img|table)\b/i.test(lastLineText)
    ) {
      const denTokens = lastLineText.split(/\s+/).filter(Boolean);
      const targetStem = questionTextAfter && questionTextAfter.trim() ? questionTextAfter : questionText;

      // Tìm các ký hiệu tử số bị nhảy lên cuối câu hỏi ngay sau dấu '?' hoặc ':'
      const stemTrailingMatch = targetStem.match(/^(.*[\?\:\.])\s+([A-Za-zα-ωΑ-ΩΔλμωπρστφθ0-9\s]{1,20})$/s);
      if (stemTrailingMatch) {
        const cleanStem = stemTrailingMatch[1].trim();
        const numTokens = stemTrailingMatch[2].trim().split(/\s+/).filter(Boolean);

        if (
          numTokens.length === danglingIndices.length &&
          denTokens.length === danglingIndices.length
        ) {
          if (questionTextAfter && questionTextAfter.trim()) {
            questionTextAfter = cleanStem;
          } else {
            questionText = cleanStem;
          }
          // Xóa dòng mẫu số thừa ở cuối phương án cuối
          options[lastIdx] = lastOptLines.slice(0, -1).join('\n');

          // Ghép từng cặp (tử số, mẫu số) vào đúng phương án có dấu "=" bị bỏ lửng
          danglingIndices.forEach((optIdx, k) => {
            const baseOpt = options[optIdx].trim();
            options[optIdx] = `${baseOpt} \\frac{${numTokens[k]}}{${denTokens[k]}}`;
          });
        }
      }
    }
  }

  options = options.map((opt) => {
    const prefixMatch = opt.match(/^([A-Da-d][\.\)]\s*)/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const body = opt.substring(prefix.length);
      return `${prefix}${autoFixFormulaText(body)}`;
    }
    return autoFixFormulaText(opt);
  });

  return {
    ...q,
    questionText: autoFixFormulaText(questionText),
    questionTextAfter: questionTextAfter ? autoFixFormulaText(questionTextAfter) : questionTextAfter,
    options,
    solution: solution ? autoFixFormulaText(solution) : solution,
  };
}

/**
 * Ẩn chuỗi mã base64 dài của thẻ <img ...> thành nhãn gọn [Hình ảnh 1], [Hình ảnh 2] trong ô nhập <textarea>
 * để giáo viên dễ dàng chỉnh sửa văn bản/công thức mà không bị rối bởi hàng chục nghìn ký tự base64,
 * đồng thời khôi phục lại nguyên vẹn 100% thẻ <img ...> khi lưu thay đổi.
 */
export function maskImgTagsForTextarea(rawText: string): string {
  if (!rawText || !/<img\b/i.test(rawText)) return rawText || '';
  let idx = 0;
  return rawText.replace(/<img\b[^>]*>/gi, () => {
    idx++;
    return `[Hình ảnh ${idx}]`;
  });
}

export function unmaskImgTagsFromTextarea(displayText: string, originalRawText: string): string {
  if (!originalRawText || !/<img\b/i.test(originalRawText)) return displayText;
  const imgs = originalRawText.match(/<img\b[^>]*>/gi) || [];
  if (imgs.length === 0) return displayText;
  let result = displayText;
  imgs.forEach((imgTag, i) => {
    const token = `[Hình ảnh ${i + 1}]`;
    if (result.includes(token)) {
      result = result.replace(token, () => imgTag);
    }
  });
  return result;
}

export function extractImgSourcesFromHtml(rawText?: string): string[] {
  if (!rawText || !/<img\b/i.test(rawText)) return [];
  const matches = Array.from(rawText.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi));
  return matches.map((m) => m[1]).filter(Boolean);
}

export const MathEquationModal: React.FC<MathEquationModalProps> = ({
  isOpen,
  initialValue,
  fieldLabel,
  onClose,
  onApply,
}) => {
  const [value, setValue] = useState(initialValue);
  const [activeTab, setActiveTab] = useState<PaletteTab>('structures');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Bộ tạo nhanh Phân số 2 chiều (Visual Fraction Builder)
  const [fracLhs, setFracLhs] = useState('');
  const [fracNum, setFracNum] = useState('Q');
  const [fracDen, setFracDen] = useState('m');

  // Bộ tạo nhanh Căn thức (Visual Root Builder)
  const [rootDeg, setRootDeg] = useState('');
  const [rootExpr, setRootExpr] = useState('2gh');

  // Bộ tạo nhanh Số mũ / Chỉ số (Visual Sub/Sup Builder)
  const [scriptBase, setScriptBase] = useState('10');
  const [scriptSub, setScriptSub] = useState('');
  const [scriptSup, setScriptSup] = useState('-6');

  useEffect(() => {
    if (isOpen) {
      const cleaned = decodePdfMathSymbols(initialValue || '');
      setValue(cleaned);

      // Nếu nội dung đang chọn có sẵn dấu "=" (ví dụ "λ =" hoặc "Q ="), điền sẵn vào ô Vế trái của bộ tạo phân số
      const lhsMatch = cleaned.match(/^([A-Za-zα-ωΑ-ΩΔλμωπρστφθ0-9_^{}]+\s*=)/);
      if (lhsMatch) {
        setFracLhs(lhsMatch[1].trim());
      } else {
        setFracLhs('');
      }

      const existingFrac = cleaned.match(/\\frac\{([^{}]*)\}\{([^{}]*)\}/);
      if (existingFrac) {
        setFracNum(existingFrac[1] || 'Q');
        setFracDen(existingFrac[2] || 'm');
      }
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const displayValue = maskImgTagsForTextarea(value);

  const insertAtCursor = (snippet: string, cursorOffset = 0) => {
    const el = textareaRef.current;
    if (!el) {
      setValue((prev) => `${prev}${snippet}`);
      return;
    }

    const start = el.selectionStart ?? displayValue.length;
    const end = el.selectionEnd ?? displayValue.length;
    const selectedText = displayValue.substring(start, end);

    let finalSnippet = snippet;
    // Nếu người dùng đang bôi đen một đoạn và bấm vào nút Phân số \frac{a}{b}, đưa đoạn bôi đen lên tử số
    if (selectedText && snippet.includes('\\frac{a}{b}')) {
      finalSnippet = `$\\frac{${selectedText}}{b}$`;
    } else if (selectedText && snippet.includes('\\sqrt{x}')) {
      finalSnippet = `$\\sqrt{${selectedText}}$`;
    }

    const nextDisplay = displayValue.substring(0, start) + finalSnippet + displayValue.substring(end);
    setValue(unmaskImgTagsFromTextarea(nextDisplay, value));

    setTimeout(() => {
      el.focus();
      const newPos = Math.max(0, start + finalSnippet.length + cursorOffset);
      el.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const buildFractionString = () => {
    const lhs = fracLhs.trim();
    const num = fracNum.trim() || 'a';
    const den = fracDen.trim() || 'b';
    if (lhs) {
      const normalizedLhs = lhs.endsWith('=') ? lhs : `${lhs} =`;
      return `$${normalizedLhs} \\frac{${num}}{${den}}$`;
    }
    return `$\\frac{${num}}{${den}}$`;
  };

  const buildRootString = () => {
    const deg = rootDeg.trim();
    const expr = rootExpr.trim() || 'x';
    return deg ? `$\\sqrt[${deg}]{${expr}}$` : `$\\sqrt{${expr}}$`;
  };

  const buildScriptString = () => {
    const base = scriptBase.trim() || 'x';
    const sub = scriptSub.trim();
    const sup = scriptSup.trim();
    let res = base;
    if (sub) res += `_{${sub}}`;
    if (sup) res += `^{${sup}}`;
    return `$${res}$`;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-teal-800 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-serif font-bold text-base">
              ∑
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide flex items-center gap-2">
                <span>Trình soạn thảo & Sửa lỗi Công thức (MathType / Equation)</span>
                <span className="text-[10px] px-2 py-0.5 bg-amber-400 text-teal-950 font-extrabold rounded-full">
                  Trực tiếp
                </span>
              </h3>
              <p className="text-[11px] text-teal-100">
                Đang chỉnh sửa: <b className="text-white underline">{fieldLabel}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* 1. Bộ đóng khung Phân số / Căn thức / Số mũ trực quan (Không cần gõ lệnh) */}
          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-teal-700" />
                <span>Tạo nhanh công thức theo ô trực quan (Kiểu MathType / Word Equation):</span>
              </span>
              <span className="text-[11px] text-teal-700">
                Điền tử số, mẫu số hoặc số mũ vào ô rồi bấm <b>Chèn</b> hoặc <b>Thay thế</b>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Khung 1: Phân số 2 chiều */}
              <div className="bg-white border border-teal-200/90 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
                <div className="text-[11px] font-bold text-teal-800 mb-2 flex items-center justify-between">
                  <span>1. Phân số (Tử số / Mẫu số)</span>
                  <span className="px-1.5 py-0.5 bg-teal-50 rounded text-teal-700 font-mono text-[10px]">
                    <MathText text={buildFractionString()} />
                  </span>
                </div>
                <div className="flex items-center gap-2 my-1">
                  <input
                    type="text"
                    value={fracLhs}
                    onChange={(e) => setFracLhs(e.target.value)}
                    placeholder="Vế trái (λ =)"
                    className="w-24 px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:border-teal-600 focus:outline-none text-center"
                    title="Vế trái của công thức (ví dụ: λ = hoặc Q =)"
                  />
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={fracNum}
                      onChange={(e) => setFracNum(e.target.value)}
                      placeholder="Tử số (VD: Q)"
                      className="w-full px-2 py-1 text-xs font-bold text-teal-900 bg-teal-50/40 border border-teal-300 rounded-md focus:bg-white focus:border-teal-600 focus:outline-none text-center"
                    />
                    <div className="w-full h-[2px] bg-gray-800 rounded-full" />
                    <input
                      type="text"
                      value={fracDen}
                      onChange={(e) => setFracDen(e.target.value)}
                      placeholder="Mẫu số (VD: m)"
                      className="w-full px-2 py-1 text-xs font-bold text-teal-900 bg-teal-50/40 border border-teal-300 rounded-md focus:bg-white focus:border-teal-600 focus:outline-none text-center"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => insertAtCursor(buildFractionString())}
                    className="flex-1 px-2 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    + Chèn vào con trỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue(buildFractionString())}
                    className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                    title="Thay thế toàn bộ ô hiện tại bằng công thức phân số này"
                  >
                    Thay thế
                  </button>
                </div>
              </div>

              {/* Khung 2: Căn thức */}
              <div className="bg-white border border-teal-200/90 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
                <div className="text-[11px] font-bold text-teal-800 mb-2 flex items-center justify-between">
                  <span>2. Căn thức (√)</span>
                  <span className="px-1.5 py-0.5 bg-teal-50 rounded text-teal-700 font-mono text-[10px]">
                    <MathText text={buildRootString()} />
                  </span>
                </div>
                <div className="flex items-center gap-2 my-2">
                  <div className="w-16">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Bậc căn:</label>
                    <input
                      type="text"
                      value={rootDeg}
                      onChange={(e) => setRootDeg(e.target.value)}
                      placeholder="2"
                      className="w-full px-2 py-1.5 text-xs text-center bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Biểu thức trong căn:</label>
                    <div className="flex items-center border border-teal-300 rounded-md bg-teal-50/40 px-2 py-1">
                      <span className="font-bold text-sm text-teal-800 mr-1">√</span>
                      <input
                        type="text"
                        value={rootExpr}
                        onChange={(e) => setRootExpr(e.target.value)}
                        placeholder="VD: 2gh, LC"
                        className="w-full text-xs font-bold text-teal-900 bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => insertAtCursor(buildRootString())}
                    className="flex-1 px-2 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    + Chèn căn thức
                  </button>
                </div>
              </div>

              {/* Khung 3: Số mũ & Chỉ số dưới */}
              <div className="bg-white border border-teal-200/90 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
                <div className="text-[11px] font-bold text-teal-800 mb-2 flex items-center justify-between">
                  <span>3. Số mũ & Chỉ số dưới</span>
                  <span className="px-1.5 py-0.5 bg-teal-50 rounded text-teal-700 font-mono text-[10px]">
                    <MathText text={buildScriptString()} />
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 my-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Cơ số:</label>
                    <input
                      type="text"
                      value={scriptBase}
                      onChange={(e) => setScriptBase(e.target.value)}
                      placeholder="10, v"
                      className="w-full px-2 py-1.5 text-xs font-bold text-center bg-teal-50/40 border border-teal-300 rounded-md focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Chỉ số dưới:</label>
                    <input
                      type="text"
                      value={scriptSub}
                      onChange={(e) => setScriptSub(e.target.value)}
                      placeholder="1, max"
                      className="w-full px-2 py-1.5 text-xs text-center bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Số mũ trên:</label>
                    <input
                      type="text"
                      value={scriptSup}
                      onChange={(e) => setScriptSup(e.target.value)}
                      placeholder="-6, 2"
                      className="w-full px-2 py-1.5 text-xs text-center bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => insertAtCursor(buildScriptString())}
                    className="flex-1 px-2 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    + Chèn mũ / chỉ số
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Bảng ký hiệu MathType / Equation */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/60">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-1.5 flex-wrap gap-1.5">
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('structures')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    activeTab === 'structures'
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cấu trúc Equation (Phân số, Căn, Vectơ)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('operators')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    activeTab === 'operators'
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Dấu & Toán tử (=, ±, ×, ÷, ≤, ≥, →)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('greek')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    activeTab === 'greek'
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Chữ Hy Lạp (λ, Δ, π, ω, α, β, φ, Ω)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('presets')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    activeTab === 'presets'
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Công thức mẫu dựng sẵn
                </button>
              </div>
            </div>

            <div className="p-3">
              {activeTab === 'structures' && (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {STRUCTURE_TEMPLATES.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => insertAtCursor(item.insert, item.cursorOffset)}
                      title={item.title}
                      className="flex flex-col items-center justify-center p-2 bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-400 rounded-lg shadow-2xs cursor-pointer transition-all min-h-[52px]"
                    >
                      <span className="text-xs text-gray-900">
                        <MathText text={item.preview} />
                      </span>
                      <span className="text-[10px] text-gray-500 mt-1 font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'operators' && (
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                  {OPERATOR_TEMPLATES.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => insertAtCursor(item.insert)}
                      title={item.title}
                      className="flex flex-col items-center justify-center p-2 bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-400 rounded-lg shadow-2xs cursor-pointer transition-all min-h-[44px]"
                    >
                      <span className="text-sm font-bold text-gray-900">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'greek' && (
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
                  {GREEK_TEMPLATES.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => insertAtCursor(item.insert)}
                      title={item.title}
                      className="flex flex-col items-center justify-center p-2 bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-400 rounded-lg shadow-2xs cursor-pointer transition-all min-h-[44px]"
                    >
                      <span className="text-sm font-serif font-bold text-teal-900">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'presets' && (
                <div className="space-y-3">
                  {PRESET_FORMULAS.map((group, gIdx) => (
                    <div key={gIdx}>
                      <div className="text-[11px] font-bold text-gray-600 mb-1.5">{group.category}:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map((preset, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => insertAtCursor(preset.latex)}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-400 rounded-lg text-xs cursor-pointer transition-all shadow-2xs"
                            title={`Bấm để chèn: ${preset.name}`}
                          >
                            <span className="text-[11px] text-gray-600">{preset.name}:</span>
                            <span className="font-semibold text-teal-900">
                              <MathText text={preset.latex} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. Ô nhập nội dung + Thanh công cụ tự động sửa lỗi */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-gray-800">
                Nội dung văn bản & Mã công thức (Đặt công thức trong dấu <code className="px-1 py-0.5 bg-gray-100 rounded text-teal-800">$...$</code> hoặc dùng nút bên trên):
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setValue(autoFixFormulaText(value))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                  title="Tự động xóa ký tự ô vuông ▯, đổi a/b thành phân số 2 chiều \frac{a}{b}"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Tự động sửa lỗi ký tự ▯ & phân số</span>
                </button>
                <button
                  type="button"
                  onClick={() => setValue(decodePdfMathSymbols(initialValue || ''))}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                  title="Khôi phục về nội dung ban đầu"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Khôi phục</span>
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              rows={3}
              value={displayValue}
              onChange={(e) => setValue(unmaskImgTagsFromTextarea(e.target.value, value))}
              placeholder="Ví dụ: $\lambda = \frac{Q}{m}$ hoặc $Q = m\lambda\Delta t$..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono text-gray-900 bg-white border-2 border-teal-500/80 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed resize-y"
            />
          </div>

          {/* 4. Xem trước kết quả hiển thị MathType / KaTeX lớn */}
          <div className="bg-gradient-to-br from-teal-50/70 to-emerald-50/40 border-2 border-teal-200 rounded-xl p-4">
            <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>👁️ Xem trước hiển thị công thức chuẩn (MathType / KaTeX):</span>
            </div>
            <div className="min-h-[56px] p-3 bg-white rounded-lg border border-teal-100 text-sm sm:text-base text-gray-900 flex items-center leading-relaxed overflow-x-auto">
              {value.trim() ? (
                <MathText text={value} />
              ) : (
                <span className="text-xs text-gray-400 italic">Chưa có nội dung công thức...</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            Mẹo: Bôi đen chữ trong ô rồi bấm nút <b>a/b</b> hoặc <b>√x</b> để đóng khung phân số/căn thức nhanh.
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 cursor-pointer transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(value);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 shadow-sm cursor-pointer transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Áp dụng công thức</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
