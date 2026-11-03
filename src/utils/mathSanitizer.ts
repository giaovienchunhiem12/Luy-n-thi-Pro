/**
 * Tiện ích chuẩn hóa và chuyển đổi công thức toán học từ MathType, MathML, OMML sang KaTeX/LaTeX
 * Hỗ trợ phân biệt công thức toán học (chuyển sang LaTeX) và hình ảnh thật (đồ thị, hình vẽ, sơ đồ)
 */
// @ts-ignore
import JSZip from 'jszip';

// Bảng ánh xạ đầy đủ các ký tự Private Use Area (PUA: U+F020..U+F0FF) của font Symbol / MT Extra / Wingdings trong PDF & Word sang Unicode chuẩn
const SYMBOL_PUA_MAP: Record<number, string> = {
  0xF020: ' ',
  0xF021: '!',
  0xF022: '∀',
  0xF023: '#',
  0xF024: '∃',
  0xF025: '%',
  0xF026: '&',
  0xF027: '∋',
  0xF028: '(',
  0xF029: ')',
  0xF02A: '*',
  0xF02B: '+',
  0xF02C: ',',
  0xF02D: '-',
  0xF02E: '.',
  0xF02F: '/',
  0xF030: '0',
  0xF031: '1',
  0xF032: '2',
  0xF033: '3',
  0xF034: '4',
  0xF035: '5',
  0xF036: '6',
  0xF037: '7',
  0xF038: '8',
  0xF039: '9',
  0xF03A: ':',
  0xF03B: ';',
  0xF03C: '<',
  0xF03D: '=',
  0xF03E: '>',
  0xF03F: '?',
  0xF040: '≅',
  0xF041: 'A',
  0xF042: 'B',
  0xF043: 'Χ',
  0xF044: 'Δ',
  0xF045: 'E',
  0xF046: 'Φ',
  0xF047: 'Γ',
  0xF048: 'H',
  0xF049: 'I',
  0xF04A: 'ϑ',
  0xF04B: 'K',
  0xF04C: 'Λ',
  0xF04D: 'M',
  0xF04E: 'N',
  0xF04F: 'O',
  0xF050: 'Π',
  0xF051: 'Θ',
  0xF052: 'P',
  0xF053: 'Σ',
  0xF054: 'T',
  0xF055: 'Υ',
  0xF056: 'ς',
  0xF057: 'Ω',
  0xF058: 'Ξ',
  0xF059: 'Ψ',
  0xF05A: 'Z',
  0xF05B: '[',
  0xF05C: '∴',
  0xF05D: ']',
  0xF05E: '⊥',
  0xF05F: '_',
  0xF060: '', // Thanh ngang kéo dài của căn bậc hai trong font Symbol
  0xF061: 'α',
  0xF062: 'β',
  0xF063: 'χ',
  0xF064: 'δ',
  0xF065: 'ε',
  0xF066: 'φ',
  0xF067: 'γ',
  0xF068: 'η',
  0xF069: 'ι',
  0xF06A: 'ϕ',
  0xF06B: 'κ',
  0xF06C: 'λ',
  0xF06D: 'μ',
  0xF06E: 'ν',
  0xF06F: 'ο',
  0xF070: 'π',
  0xF071: 'θ',
  0xF072: 'ρ',
  0xF073: 'σ',
  0xF074: 'τ',
  0xF075: 'υ',
  0xF076: 'ϖ',
  0xF077: 'ω',
  0xF078: 'ξ',
  0xF079: 'ψ',
  0xF07A: 'ζ',
  0xF07B: '{',
  0xF07C: '|',
  0xF07D: '}',
  0xF07E: '~',
  0xF0A0: ' ',
  0xF0A1: 'ϒ',
  0xF0A2: '′',
  0xF0A3: '≤',
  0xF0A4: '/',
  0xF0A5: '∞',
  0xF0A6: 'ƒ',
  0xF0AB: '↔',
  0xF0AC: '←',
  0xF0AD: '↑',
  0xF0AE: '→',
  0xF0AF: '↓',
  0xF0B0: '°',
  0xF0B1: '±',
  0xF0B2: '″',
  0xF0B3: '≥',
  0xF0B4: '×',
  0xF0B5: '∝',
  0xF0B6: '∂',
  0xF0B7: '⋅',
  0xF0B8: '÷',
  0xF0B9: '≠',
  0xF0BA: '≡',
  0xF0BB: '≈',
  0xF0BC: '…',
  0xF0BD: '|',
  0xF0BE: '-',
  0xF0C0: 'ℵ',
  0xF0C1: 'ℑ',
  0xF0C2: 'ℜ',
  0xF0C4: '⊗',
  0xF0C5: '⊕',
  0xF0C6: '∅',
  0xF0C7: '∩',
  0xF0C8: '∪',
  0xF0C9: '⊃',
  0xF0CA: '⊇',
  0xF0CB: '⊄',
  0xF0CC: '⊂',
  0xF0CD: '⊆',
  0xF0CE: '∈',
  0xF0CF: '∉',
  0xF0D0: '∠',
  0xF0D1: '∇',
  0xF0D5: '∏',
  0xF0D6: '√',
  0xF0D7: '⋅',
  0xF0D8: '¬',
  0xF0D9: '∧',
  0xF0DA: '∨',
  0xF0DB: '⇔',
  0xF0DC: '⇐',
  0xF0DD: '⇑',
  0xF0DE: '⇒',
  0xF0DF: '⇓',
  0xF0E0: '◊',
  0xF0E1: '⟨',
  0xF0E5: '∑',
  0xF0E6: '(',
  0xF0E7: '',
  0xF0E8: '(',
  0xF0E9: '[',
  0xF0EA: '',
  0xF0EB: '[',
  0xF0EC: '{',
  0xF0ED: '{',
  0xF0EE: '{',
  0xF0EF: '',
  0xF0F1: '⟩',
  0xF0F2: '∫',
  0xF0F3: '∫',
  0xF0F4: '',
  0xF0F5: '∫',
  0xF0F6: ')',
  0xF0F7: '',
  0xF0F8: ')',
  0xF0F9: ']',
  0xF0FA: '',
  0xF0FB: ']',
  0xF0FC: '}',
  0xF0FD: '}',
  0xF0FE: '}',
};

/**
 * Giải mã triệt để các ký tự Private Use Area (U+F000..U+F0FF, U+E000..U+F8FF) và ký tự lỗi font (▯)
 * sinh ra từ MathType / Symbol / Equation Editor trong PDF và Word
 */
export function decodePdfMathSymbols(input: string): string {
  if (!input) return '';

  // Nếu chuỗi có chứa thẻ <img ...> hoặc <table ...>, tách riêng để không quét qua dữ liệu base64 / bảng HTML
  if (/<(?:img|table)\b/i.test(input)) {
    const preserved: string[] = [];
    const masked = input.replace(/<table\b[\s\S]*?<\/table>|<img\b[^>]*>/gi, (m) => {
      const idx = preserved.length;
      preserved.push(m);
      return `@@DEC@TOKEN@${idx}@@`;
    });
    const decoded = decodePdfMathSymbols(masked);
    return decoded.replace(/@@DEC@TOKEN@(\d+)@@/g, (_, i) => preserved[Number(i)] || '');
  }

  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 0xF020 && code <= 0xF0FF) {
      if (code in SYMBOL_PUA_MAP) {
        out += SYMBOL_PUA_MAP[code];
      } else if (code >= 0xF020 && code <= 0xF07E) {
        out += String.fromCharCode(code - 0xF000);
      }
    } else if (code === 0x2212) {
      out += '-';
    } else {
      out += input[i];
    }
  }

  // Nếu còn ký tự hộp lỗi font (▯, □,  hoặc PUA U+E000..U+F8FF) nằm ở vị trí dấu "=" trong công thức (VD: "Q ▯ mλΔt", "λ ▯")
  out = out.replace(
    /(\b[A-Za-zα-ωΑ-ΩΔλμωπρστφθ0-9]+(?:_\{?[A-Za-z0-9]+\}?|\^\{?[A-Za-z0-9+\-]+\}?)?)\s*[\uE000-\uF8FF\u25AF\u25A1\uFFFD]+\s*(?=[A-Za-zα-ωΑ-ΩΔλμωπρστφθ0-9\\\(\{\+\-\√]|$)/g,
    '$1 = '
  );

  // Loại bỏ các ký tự PUA vô hình còn sót lại
  out = out.replace(/[\uE000-\uF8FF]/g, '');

  return out;
}

// Giải mã HTML Entities
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return decodePdfMathSymbols(str)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&plusmn;/gi, '±')
    .replace(/&le;/gi, '≤')
    .replace(/&ge;/gi, '≥')
    .replace(/&ne;/gi, '≠')
    .replace(/&times;/gi, '×')
    .replace(/&divide;/gi, '÷')
    .replace(/&isin;/gi, '∈')
    .replace(/&notin;/gi, '∉')
    .replace(/&sub;/gi, '⊂')
    .replace(/&cap;/gi, '∩')
    .replace(/&cup;/gi, '∪')
    .replace(/&infin;/gi, '∞')
    .replace(/&pi;/gi, 'π')
    .replace(/&alpha;/gi, 'α')
    .replace(/&beta;/gi, 'β')
    .replace(/&gamma;/gi, 'γ')
    .replace(/&Delta;/gi, 'Δ')
    .replace(/&theta;/gi, 'θ')
    .replace(/&lambda;/gi, 'λ')
    .replace(/&mu;/gi, 'μ')
    .replace(/&sigma;/gi, 'σ')
    .replace(/&omega;/gi, 'ω')
    .replace(/&rarr;/gi, '→')
    .replace(/&sum;/gi, '∑')
    .replace(/&int;/gi, '∫');
}

// Chuyển đổi mã Word OMML (<m:oMath>) sang LaTeX
export function convertOmmlToLatex(ommlXml: string): string {
  if (!ommlXml) return '';

  let s = ommlXml;

  // 1. Phân số trong OMML: <m:f><m:num>...</m:num><m:den>...</m:den></m:f>
  s = s.replace(/<m:f\b[^>]*>[\s\S]*?<m:num\b[^>]*>([\s\S]*?)<\/m:num>[\s\S]*?<m:den\b[^>]*>([\s\S]*?)<\/m:den>[\s\S]*?<\/m:f>/gi, (_, num, den) => {
    return `\\frac{${convertOmmlToLatex(num)}}{${convertOmmlToLatex(den)}}`;
  });

  // 2. Căn thức trong OMML: <m:rad><m:radPr><m:deg>...</m:deg></m:radPr><m:e>...</m:e></m:rad>
  s = s.replace(/<m:rad\b[^>]*>[\s\S]*?(?:<m:deg\b[^>]*>([\s\S]*?)<\/m:deg>)?[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:rad>/gi, (_, deg, expr) => {
    const cleanDeg = deg ? convertOmmlToLatex(deg).trim() : '';
    const cleanExpr = convertOmmlToLatex(expr);
    return cleanDeg ? `\\sqrt[${cleanDeg}]{${cleanExpr}}` : `\\sqrt{${cleanExpr}}`;
  });

  // 3. Tích phân, Tổng sigma, Tích pi: <m:nary>
  s = s.replace(/<m:nary\b[^>]*>[\s\S]*?<m:naryPr\b[^>]*>[\s\S]*?<m:chr\s+m:val=["']([^"']+)["'][\s\S]*?<\/m:naryPr>[\s\S]*?(?:<m:sub\b[^>]*>([\s\S]*?)<\/m:sub>)?[\s\S]*?(?:<m:sup\b[^>]*>([\s\S]*?)<\/m:sup>)?[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:nary>/gi, (_, chr, sub, sup, expr) => {
    let operator = '\\int';
    if (chr === '∑' || chr === 'sum') operator = '\\sum';
    else if (chr === '∏' || chr === 'prod') operator = '\\prod';
    else if (chr === '∬') operator = '\\iint';
    else if (chr === '∭') operator = '\\iiint';
    else if (chr === '∮') operator = '\\oint';

    let limits = '';
    if (sub) limits += `_{${convertOmmlToLatex(sub)}}`;
    if (sup) limits += `^{${convertOmmlToLatex(sup)}}`;

    return `${operator}${limits}{${convertOmmlToLatex(expr)}}`;
  });

  // 4. Dấu vectơ, dấu mũ, dấu chấm: <m:acc>
  s = s.replace(/<m:acc\b[^>]*>[\s\S]*?<m:accPr\b[^>]*>[\s\S]*?<m:chr\s+m:val=["']([^"']+)["'][\s\S]*?<\/m:accPr>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:acc>/gi, (_, chr, expr) => {
    const cleanExpr = convertOmmlToLatex(expr);
    if (chr === '→' || chr === '->') return `\\vec{${cleanExpr}}`;
    if (chr === '^' || chr === '̂') return `\\hat{${cleanExpr}}`;
    if (chr === '~' || chr === '̃') return `\\tilde{${cleanExpr}}`;
    if (chr === '.' || chr === '̇') return `\\dot{${cleanExpr}}`;
    if (chr === '..' || chr === '̈') return `\\ddot{${cleanExpr}}`;
    return `\\vec{${cleanExpr}}`;
  });

  // 5. Gạch đầu (Overline / Số phức liên hợp): <m:bar>
  s = s.replace(/<m:bar\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:bar>/gi, (_, expr) => {
    return `\\overline{${convertOmmlToLatex(expr)}}`;
  });

  // 6. Giới hạn lim: <m:limLow>
  s = s.replace(/<m:limLow\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:lim\b[^>]*>([\s\S]*?)<\/m:lim>[\s\S]*?<\/m:limLow>/gi, (_, expr, lim) => {
    return `\\lim_{${convertOmmlToLatex(lim)}}{${convertOmmlToLatex(expr)}}`;
  });

  // 7. Lũy thừa kèm chỉ số dưới: <m:sSubSup>
  s = s.replace(/<m:sSubSup\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub\b[^>]*>([\s\S]*?)<\/m:sub>[\s\S]*?<m:sup\b[^>]*>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSubSup>/gi, (_, base, sub, sup) => {
    return `{${convertOmmlToLatex(base)}}_{${convertOmmlToLatex(sub)}}^{${convertOmmlToLatex(sup)}}`;
  });

  // 8. Lũy thừa: <m:sSup><m:e>...</m:e><m:sup>...</m:sup></m:sSup>
  s = s.replace(/<m:sSup\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sup\b[^>]*>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSup>/gi, (_, base, sup) => {
    return `{${convertOmmlToLatex(base)}}^{${convertOmmlToLatex(sup)}}`;
  });

  // 9. Chỉ số dưới: <m:sSub><m:e>...</m:e><m:sub>...</m:sub></m:sSub>
  s = s.replace(/<m:sSub\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub\b[^>]*>([\s\S]*?)<\/m:sub>[\s\S]*?<\/m:sSub>/gi, (_, base, sub) => {
    return `{${convertOmmlToLatex(base)}}_{${convertOmmlToLatex(sub)}}`;
  });

  // 10. Dấu ngoặc: <m:d><m:e>...</m:e></m:d>
  s = s.replace(/<m:d\b[^>]*>[\s\S]*?<m:e\b[^>]*>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:d>/gi, (_, expr) => {
    return `\\left(${convertOmmlToLatex(expr)}\\right)`;
  });

  // 11. Hệ phương trình hoặc ma trận: <m:m>
  s = s.replace(/<m:m\b[^>]*>([\s\S]*?)<\/m:m>/gi, (_, matrixInner) => {
    const rows = matrixInner.match(/<m:mr\b[^>]*>[\s\S]*?<\/m:mr>/gi) || [];
    if (rows.length > 0) {
      const rowStrs = rows.map((r: string) => {
        const cells = r.match(/<m:e\b[^>]*>[\s\S]*?<\/m:e>/gi) || [];
        return cells.map((c: string) => convertOmmlToLatex(c).trim()).join(' & ');
      });
      return `\\begin{matrix} ${rowStrs.join(' \\\\ ')} \\end{matrix}`;
    }
    return convertOmmlToLatex(matrixInner);
  });

  // 12. Chữ và ký hiệu trong OMML: <m:t>...</m:t>
  s = s.replace(/<m:t\b[^>]*>([\s\S]*?)<\/m:t>/gi, (_, t) => {
    let clean = decodeHtmlEntities(t);
    // Thay thế ký hiệu toán học phổ biến
    if (clean === '±' || clean === '+-') return ' \\pm ';
    if (clean === '≤' || clean === '<=') return ' \\le ';
    if (clean === '≥' || clean === '>=') return ' \\ge ';
    if (clean === '≠' || clean === '!=') return ' \\ne ';
    if (clean === '×' || clean === '*') return ' \\times ';
    if (clean === '÷') return ' \\div ';
    if (clean === '∈') return ' \\in ';
    if (clean === '∉') return ' \\notin ';
    if (clean === '⊂') return ' \\subset ';
    if (clean === '∪') return ' \\cup ';
    if (clean === '∩') return ' \\cap ';
    if (clean === '→' || clean === '->') return ' \\rightarrow ';
    if (clean === '⇒' || clean === '=>') return ' \\Rightarrow ';
    if (clean === '⇔' || clean === '<=>') return ' \\Leftrightarrow ';
    if (clean === '∞') return ' \\infty ';
    if (clean === 'π') return ' \\pi ';
    if (clean === 'α') return ' \\alpha ';
    if (clean === 'β') return ' \\beta ';
    if (clean === 'γ') return ' \\gamma ';
    if (clean === 'Δ') return ' \\Delta ';
    if (clean === 'θ') return ' \\theta ';
    if (clean === 'λ') return ' \\lambda ';
    if (clean === 'μ') return ' \\mu ';
    if (clean === 'σ') return ' \\sigma ';
    if (clean === 'ω') return ' \\omega ';
    return clean;
  });

  // 13. Xóa các thẻ XML khác còn sót lại
  s = s.replace(/<[^>]+>/g, '');
  return s.trim();
}

// Chuyển đổi một khối MathML thành chuỗi LaTeX
export function convertMathMLToLatex(mathmlStr: string): string {
  if (!mathmlStr) return '';

  // 1. Kiểm tra xem có thẻ annotation LaTeX do MathType nhúng sẵn không
  const annotationMatch = mathmlStr.match(/<annotation[^>]*encoding=["'](?:application\/x-tex|LaTeX|tex)["'][^>]*>([\s\S]*?)<\/annotation>/i);
  if (annotationMatch && annotationMatch[1].trim()) {
    let latex = annotationMatch[1].trim();
    latex = decodeHtmlEntities(latex);
    return latex;
  }

  // 2. Chuyển đổi đệ quy các thẻ MathML thông dụng sang LaTeX
  let s = mathmlStr;
  s = s.replace(/<math[^>]*>/gi, '').replace(/<\/math>/gi, '');

  const parseNode = (xml: string): string => {
    let res = xml;

    // Phân số: <mfrac><mi>a</mi><mi>b</mi></mfrac> -> \frac{a}{b}
    res = res.replace(/<mfrac[^>]*>([\s\S]*?)<\/mfrac>/gi, (_, inner) => {
      const parts = splitTopLevelTags(inner);
      if (parts.length >= 2) {
        return `\\frac{${parseNode(parts[0])}}{${parseNode(parts[1])}}`;
      }
      return `\\frac{${parseNode(inner)}}{}`;
    });

    // Căn bậc hai: <msqrt>...</msqrt> -> \sqrt{...}
    res = res.replace(/<msqrt[^>]*>([\s\S]*?)<\/msqrt>/gi, (_, inner) => {
      return `\\sqrt{${parseNode(inner)}}`;
    });

    // Căn bậc n: <mroot><mi>x</mi><mn>3</mn></mroot> -> \sqrt[3]{x}
    res = res.replace(/<mroot[^>]*>([\s\S]*?)<\/mroot>/gi, (_, inner) => {
      const parts = splitTopLevelTags(inner);
      if (parts.length >= 2) {
        return `\\sqrt[${parseNode(parts[1])}]{${parseNode(parts[0])}}`;
      }
      return `\\sqrt{${parseNode(inner)}}`;
    });

    // Lũy thừa kèm chỉ số dưới: <msubsup><mi>x</mi><mn>1</mn><mn>2</mn></msubsup>
    res = res.replace(/<msubsup[^>]*>([\s\S]*?)<\/msubsup>/gi, (_, inner) => {
      const parts = splitTopLevelTags(inner);
      if (parts.length >= 3) {
        return `{${parseNode(parts[0])}}_{${parseNode(parts[1])}}^{${parseNode(parts[2])}}`;
      }
      return parseNode(inner);
    });

    // Lũy thừa: <msup><mi>x</mi><mn>2</mn></msup> -> {x}^{2}
    res = res.replace(/<msup[^>]*>([\s\S]*?)<\/msup>/gi, (_, inner) => {
      const parts = splitTopLevelTags(inner);
      if (parts.length >= 2) {
        return `{${parseNode(parts[0])}}^{${parseNode(parts[1])}}`;
      }
      return `{${parseNode(inner)}}`;
    });

    // Chỉ số dưới: <msub><mi>x</mi><mn>1</mn></msub> -> {x}_{1}
    res = res.replace(/<msub[^>]*>([\s\S]*?)<\/msub>/gi, (_, inner) => {
      const parts = splitTopLevelTags(inner);
      if (parts.length >= 2) {
        return `{${parseNode(parts[0])}}_{${parseNode(parts[1])}}`;
      }
      return `{${parseNode(inner)}}`;
    });

    // Vectơ hoặc dấu trên đầu: <mover>
    res = res.replace(/<mover[^>]*>([\s\S]*?)<\/mover>/gi, (_, inner) => {
      const parts = splitTopLevelTags(inner);
      if (parts.length >= 2) {
        const top = parts[1].replace(/<[^>]+>/g, '').trim();
        if (top === '→' || top === '&rarr;' || top === '&#8594;' || top === '\\rightarrow') {
          return `\\vec{${parseNode(parts[0])}}`;
        }
        if (top === '¯' || top === '&macr;' || top === '‾') {
          return `\\overline{${parseNode(parts[0])}}`;
        }
        if (top === '^' || top === '̂') {
          return `\\hat{${parseNode(parts[0])}}`;
        }
        return `\\overset{${parseNode(parts[1])}}{${parseNode(parts[0])}}`;
      }
      return parseNode(inner);
    });

    // Nhóm mrow
    res = res.replace(/<mrow[^>]*>([\s\S]*?)<\/mrow>/gi, (_, inner) => parseNode(inner));

    // Thẻ văn bản, ký hiệu toán: <mi>, <mo>, <mn>, <mtext>
    res = res.replace(/<m[inot][^>]*>([\s\S]*?)<\/m[inot]>/gi, (_, text) => {
      let val = text.trim();
      val = decodeHtmlEntities(val);
      if (val === '±') return ' \\pm ';
      if (val === '≤') return ' \\le ';
      if (val === '≥') return ' \\ge ';
      if (val === '≠') return ' \\ne ';
      if (val === '×') return ' \\times ';
      if (val === '÷') return ' \\div ';
      if (val === '∈') return ' \\in ';
      if (val === '∉') return ' \\notin ';
      if (val === '⊂') return ' \\subset ';
      if (val === '∪') return ' \\cup ';
      if (val === '∩') return ' \\cap ';
      if (val === '→') return ' \\rightarrow ';
      if (val === '⇒') return ' \\Rightarrow ';
      if (val === '⇔') return ' \\Leftrightarrow ';
      if (val === '∞') return ' \\infty ';
      if (val === 'π') return ' \\pi ';
      if (val === 'α') return ' \\alpha ';
      if (val === 'β') return ' \\beta ';
      if (val === 'γ') return ' \\gamma ';
      if (val === 'Δ') return ' \\Delta ';
      if (val === 'θ') return ' \\theta ';
      if (val === 'λ') return ' \\lambda ';
      if (val === '∫') return ' \\int ';
      if (val === '∑') return ' \\sum ';
      return val;
    });

    res = res.replace(/<[^>]+>/g, ' ');
    return res;
  };

  const parsed = parseNode(s);
  return parsed.replace(/\s+/g, ' ').trim();
}

function splitTopLevelTags(xml: string): string[] {
  const tags: string[] = [];
  let depth = 0;
  let current = '';

  const regex = /(<\/?([a-zA-Z0-9:]+)[^>]*>)|([^<]+)/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith('</')) {
      depth--;
      current += chunk;
      if (depth === 0) {
        if (current.trim()) tags.push(current.trim());
        current = '';
      }
    } else if (chunk.startsWith('<') && !chunk.endsWith('/>')) {
      if (depth === 0 && current.trim()) {
        tags.push(current.trim());
        current = '';
      }
      depth++;
      current += chunk;
    } else if (chunk.startsWith('<') && chunk.endsWith('/>')) {
      if (depth === 0) {
        if (chunk.trim()) tags.push(chunk.trim());
      } else {
        current += chunk;
      }
    } else {
      if (depth === 0) {
        if (chunk.trim()) tags.push(chunk.trim());
      } else {
        current += chunk;
      }
    }
  }

  if (current.trim()) {
    tags.push(current.trim());
  }

  return tags.length > 0 ? tags : [xml];
}

/**
 * Trích xuất công thức LaTeX từ file nhị phân OLE (MathType DSMT4)
 */
export function extractLatexFromMathTypeOle(buffer: ArrayBuffer | Uint8Array): string {
  try {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (!bytes || bytes.length < 16) return '';

    // 1. Thử tìm chuỗi LaTeX được lưu dưới dạng văn bản trong luồng OLE (nếu giáo viên lưu từ MathType hoặc TeX toggle)
    const textDecoder = new TextDecoder('latin1');
    const rawStr = textDecoder.decode(bytes);

    // Tìm thẻ TeX hoặc annotation trong stream
    const texMatch = rawStr.match(/\\(?:frac|sqrt|vec|int|sum|alpha|beta|lim|left|begin)\b[^\x00-\x1F\x7F-\x9F]*/);
    if (texMatch && texMatch[0].length > 3) {
      return texMatch[0].trim();
    }

    // 2. Phân tích luồng MTEF (MathType Equation Format v3 hoặc v5)
    let mtefOffset = -1;
    for (let i = 0; i < bytes.length - 8; i++) {
      // MTEF Header: byte 0x05 hoặc 0x03, theo sau là platform (0x01 = Windows, 0x00 = Mac)
      if ((bytes[i] === 0x05 || bytes[i] === 0x03) && (bytes[i + 1] === 0x01 || bytes[i + 1] === 0x00)) {
        mtefOffset = i;
        break;
      }
    }

    if (mtefOffset === -1) {
      // Tìm xem có chuỗi ký tự toán học Unicode nào không
      const u16 = new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
      const mathRuns = u16.match(/[A-Za-z0-9À-ỹα-ωΑ-ΩΔλμωπρστφθ\s.,+\-*/=<>()[\]{}±≤≥≠→]{4,}/g) || [];
      const candidate = mathRuns.find(r => /[=+\-*/^]/.test(r));
      return candidate ? candidate.trim() : '';
    }

    // Duyệt các record trong MTEF
    let idx = mtefOffset + 5; // Bỏ qua 5 byte header
    let output = '';

    while (idx < bytes.length) {
      const tag = bytes[idx++];
      if (tag === 0) {
        // END record
        continue;
      }

      if (tag === 1) {
        // LINE record (bỏ qua option byte và nudge nếu có)
        if (idx < bytes.length) {
          const opt = bytes[idx++];
          if (opt & 0x08) idx += 2; // nudge
        }
        continue;
      }

      if (tag === 2) {
        // CHAR record
        if (idx >= bytes.length) break;
        const opt = bytes[idx++];
        if (opt & 0x08) idx += 2; // nudge
        if (idx >= bytes.length) break;
        idx++; // typeface
        if (idx >= bytes.length) break;

        // 16-bit char code
        let charCode = bytes[idx++];
        if (idx < bytes.length && bytes[mtefOffset] === 0x05) {
          charCode = (bytes[idx++] << 8) | charCode;
        }

        if (charCode >= 0x20 && charCode <= 0x7E) {
          output += String.fromCharCode(charCode);
        } else if (charCode === 0x00B1) {
          output += ' \\pm ';
        } else if (charCode === 0x2264) {
          output += ' \\le ';
        } else if (charCode === 0x2265) {
          output += ' \\ge ';
        } else if (charCode === 0x2260) {
          output += ' \\ne ';
        } else if (charCode === 0x221E) {
          output += ' \\infty ';
        } else if (charCode === 0x2192) {
          output += ' \\rightarrow ';
        } else if (charCode === 0x222B) {
          output += ' \\int ';
        } else if (charCode === 0x2211) {
          output += ' \\sum ';
        } else if (charCode === 0x03C0) {
          output += ' \\pi ';
        }
        continue;
      }

      if (tag === 3) {
        // TMPL record (template)
        if (idx >= bytes.length) break;
        const opt = bytes[idx++];
        if (opt & 0x08) idx += 2; // nudge
        if (idx >= bytes.length) break;
        const selector = bytes[idx++];
        idx++; // variation

        if (selector === 1) {
          // Phân số
          output += ' \\frac';
        } else if (selector === 2) {
          // Căn
          output += ' \\sqrt';
        } else if (selector === 3) {
          // Chỉ số trên/dưới
          output += '^';
        } else if (selector === 6) {
          // Vectơ
          output += ' \\vec';
        } else if (selector === 7) {
          // Gạch đầu
          output += ' \\overline';
        }
        continue;
      }

      // Các tag định nghĩa font, size, color: nhảy qua
      if (tag === 8 || tag === 9 || tag === 15 || tag === 16 || tag === 17 || tag === 18) {
        // Bỏ qua đến record tiếp theo
        continue;
      }

      if (output.length > 200) break;
    }

    return output.trim();
  } catch (e) {
    return '';
  }
}

/**
 * Xử lý trước tài liệu Word (.docx) để chuyển đổi triệt để các công thức OMML và MathType sang LaTeX
 * đồng thời phân loại rõ ràng hình ảnh thực tế (đồ thị, hình học) và KHÔNG hóa ảnh công thức
 */
export async function preprocessDocxXmlForMathAndImages(zip: any): Promise<{
  zip: any;
  formulaImageTargets: Set<string>;
}> {
  const formulaImageTargets = new Set<string>();

  try {
    const documentXmlFile = zip.file('word/document.xml');
    if (!documentXmlFile) {
      return { zip, formulaImageTargets };
    }

    let documentXml = await documentXmlFile.async('string');
    const relsFile = zip.file('word/_rels/document.xml.rels');
    const relsMap = new Map<string, string>();

    if (relsFile) {
      const relsXml = await relsFile.async('string');
      const relTags = Array.from(relsXml.matchAll(/<Relationship\b[^>]*>/gi)) as RegExpMatchArray[];
      for (const tagMatch of relTags) {
        const tag = tagMatch[0];
        const idM = tag.match(/\bId=["']([^"']+)["']/i);
        const targetM = tag.match(/\bTarget=["']([^"']+)["']/i);
        if (idM && idM[1] && targetM && targetM[1]) {
          relsMap.set(idM[1], targetM[1]);
        }
      }
    }

    // Đọc trước các file nhị phân OLE (.bin) của MathType (nếu có) để trích xuất LaTeX
    const oleLatexCache = new Map<string, string>();
    for (const [, target] of relsMap.entries()) {
      if (/\.bin$/i.test(target)) {
        const normalizedPath = target.startsWith('word/')
          ? target
          : 'word/' + target.replace(/^\.\.\//, '').replace(/^\//, '');
        const oleFile = zip.file(normalizedPath);
        if (oleFile) {
          try {
            const bytes = await oleFile.async('uint8array');
            const extracted = extractLatexFromMathTypeOle(bytes);
            if (extracted) {
              oleLatexCache.set(target, extracted);
              oleLatexCache.set(normalizedPath, extracted);
            }
          } catch {
            // ignore
          }
        }
      }
    }

    // 1. Nhận diện các OLE Object thuộc MathType / Equation Editor
    // <w:object> ... <o:OLEObject ProgID="Equation.DSMT4" ... r:id="rIdOLE"/> ... <v:imagedata r:id="rIdImg"/> ... </w:object>
    documentXml = documentXml.replace(/<w:object\b[^>]*>([\s\S]*?)<\/w:object>/gi, (match: string) => {
      let latexFormula = '';

      // Kiểm tra có phải MathType hoặc Equation không
      const isEquation = /ProgID=["'](?:Equation|MathType)/i.test(match);

      // Tìm nội dung LaTeX trong thuộc tính alt của shape hoặc descr
      const altMatch = match.match(/(?:alt|descr|title)=["']([^"']+)["']/i);
      if (altMatch && altMatch[1].trim()) {
        const altText = decodeHtmlEntities(altMatch[1].trim());
        if (altText && !/^image\d*\b/i.test(altText) && (isEquation || /^LaTeX:/i.test(altText))) {
          latexFormula = altText.replace(/^LaTeX:\s*/i, '').trim();
        }
      }

      // Nếu chưa có LaTeX, tra cứu từ cache file nhị phân OLE .bin tương ứng
      if (!latexFormula && isEquation) {
        const oleIdMatch = match.match(/<o:OLEObject[^>]*r:id=["']([^"']+)["']/i);
        if (oleIdMatch) {
          const oleTarget = relsMap.get(oleIdMatch[1]) || '';
          if (oleTarget) {
            latexFormula = oleLatexCache.get(oleTarget) || '';
          }
        }
      }

      if (latexFormula) {
        const imgIdMatch = match.match(/(?:<v:imagedata|<a:blip)[^>]*r:(?:id|embed)=["']([^"']+)["']/i);
        if (imgIdMatch) {
          const target = relsMap.get(imgIdMatch[1]) || '';
          if (target) {
            const fileName = target.split('/').pop() || target;
            formulaImageTargets.add(fileName);
            formulaImageTargets.add(target);
          }
        }
        const cleanLatex = latexFormula.startsWith('$') ? latexFormula : `$${latexFormula}$`;
        return `<w:t xml:space="preserve"> ${cleanLatex} </w:t>`;
      }

      // Nếu đối tượng OLE không trích xuất được chuỗi LaTeX (ví dụ đồ thị nhúng, hình vẽ hoặc công thức dạng ảnh),
      // chuyển trực tiếp ảnh đại diện (<v:imagedata> / <a:blip>) sang <w:drawing><wp:inline> để Mammoth giữ nguyên 100% tại đúng vị trí
      const oleImgMatch = match.match(/(?:<v:imagedata|<a:blip)\b[^>]*\br:(?:id|embed)=["']([^"']+)["']/i);
      if (oleImgMatch && oleImgMatch[1]) {
        const rId = oleImgMatch[1];
        return `<w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${rId}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
      }

      return match;
    });

    // 2. Chuyển đổi khối công thức khối Word Equation (OMML): <m:oMathPara>
    documentXml = documentXml.replace(/<m:oMathPara\b[^>]*>([\s\S]*?)<\/m:oMathPara>/gi, (_: string, omml: string) => {
      const latex = convertOmmlToLatex(omml);
      if (latex) {
        return `<w:r><w:t xml:space="preserve"> $$${latex}$$ </w:t></w:r>`;
      }
      return '';
    });

    // 3. Chuyển đổi công thức nội dòng Word Equation (OMML): <m:oMath>
    documentXml = documentXml.replace(/<m:oMath\b[^>]*>([\s\S]*?)<\/m:oMath>/gi, (_: string, omml: string) => {
      const latex = convertOmmlToLatex(omml);
      if (latex) {
        return `<w:r><w:t xml:space="preserve"> $${latex}$ </w:t></w:r>`;
      }
      return '';
    });

    // 3.4. Chuẩn hóa các thuộc tính VML (<v:imagedata o:relid=...>, <v:fill r:id=...>, <v:oval>, <v:image>)
    // để Mammoth không bỏ sót bất kỳ hình ảnh nào trong <w:pict>
    documentXml = documentXml
      .replace(/<v:imagedata\b([^>]*?)\bo:relid=["']([^"']+)["']([^>]*)>/gi, (full: string, p1: string, relId: string, p2: string) => {
        if (/\br:id=["']/i.test(full)) return full;
        return `<v:imagedata${p1} r:id="${relId}"${p2}>`;
      })
      .replace(/<v:fill\b[^>]*\b(?:r:id|o:relid)=["']([^"']+)["'][^>]*\/?>/gi, '<v:imagedata r:id="$1"/>')
      .replace(/<v:image\b([^>]*?)\b(?:r:id|o:relid)=["']([^"']+)["']([^>]*)\/?>/gi, '<v:imagedata r:id="$2"/>')
      .replace(/<(\/?)v:oval\b/gi, '<$1v:shape');

    // 3.5. Giải phóng hình ảnh / đồ thị nằm trong <mc:AlternateContent> của Word (2010-365)
    documentXml = documentXml.replace(
      /<mc:AlternateContent\b[^>]*>([\s\S]*?)<\/mc:AlternateContent>/gi,
      (fullMatch: string, inner: string) => {
        const choiceM = inner.match(/<mc:Choice\b[^>]*>([\s\S]*?)<\/mc:Choice>/i);
        const fallbackM = inner.match(/<mc:Fallback\b[^>]*>([\s\S]*?)<\/mc:Fallback>/i);
        const choiceContent = choiceM ? choiceM[1] : '';
        const fallbackContent = fallbackM ? fallbackM[1] : '';

        const fallbackHasDirectImg = /(?:<v:imagedata|<pic:pic)\b/i.test(fallbackContent);
        const choiceHasDirectImg = /(?:<pic:pic|<a:blip|<v:imagedata)\b/i.test(choiceContent);
        const choiceIsGroupOrShape = /<(?:wpg:wgp|wps:wsp)\b/i.test(choiceContent);

        // Nếu <mc:Choice> là hình vẽ nhóm (<wpg:wgp>) hoặc shape (<wps:wsp>) mà <mc:Fallback> đã có ảnh gộp phẳng (<v:imagedata>),
        // ưu tiên <mc:Fallback> để giữ nguyên 100% đồ thị/hình vẽ đã được Word kết xuất thành ảnh hoàn chỉnh
        if (choiceIsGroupOrShape && fallbackHasDirectImg) {
          return fallbackContent;
        }
        // Nếu <mc:Choice> có <pic:pic> chuẩn của <w:drawing>, ưu tiên <mc:Choice> để ảnh giữ đúng vị trí inline
        if (/<pic:pic\b/i.test(choiceContent)) {
          return choiceContent;
        }
        if (fallbackHasDirectImg) {
          return fallbackContent;
        }
        if (choiceHasDirectImg) {
          return choiceContent;
        }
        if (/<w:txbxContent\b/i.test(fallbackContent)) {
          return fallbackContent;
        }
        if (/<w:txbxContent\b/i.test(choiceContent)) {
          return choiceContent;
        }
        return fullMatch;
      }
    );

    // 3.6. Chuẩn hóa <wp:inline> và <wp:anchor> chứa hình nhóm (<wpg:wgp>) hoặc hình trong khung (<wps:wsp>)
    // Mammoth chỉ đọc đường dẫn trực tiếp: a:graphic > a:graphicData > pic:pic > pic:blipFill > a:blip
    documentXml = documentXml.replace(
      /<(wp:inline|wp:anchor)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
      (fullMatch: string, _tagName: string, attrs: string, inner: string) => {
        // Nếu có hộp văn bản <w:txbxContent> chứa bảng dữ liệu hoặc chữ bên trong shape thì giữ nguyên để không mất bảng/chữ
        if (/<w:txbxContent\b/i.test(inner) && !/<a:blip\b/i.test(inner)) {
          return fullMatch;
        }
        // Nếu có <a:blip r:embed="rId..."/> nằm sâu bên trong <wpg:wgp> hoặc <wps:wsp>
        const blipMatches = Array.from(inner.matchAll(/<a:blip\b[^>]*\br:embed=["']([^"']+)["'][^>]*>/gi));
        if (blipMatches.length > 0 && (/<wpg:wgp\b/i.test(inner) || /<wps:wsp\b/i.test(inner) || !/<pic:pic\b/i.test(inner))) {
          const uniqueRIds = Array.from(new Set(blipMatches.map((m) => m[1])));
          const normalizedGraphics = uniqueRIds
            .map(
              (rId) =>
                `<a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${rId}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic>`
            )
            .join('');
          return `<wp:inline${attrs}>${normalizedGraphics}</wp:inline>`;
        }
        return fullMatch;
      }
    );

    // 3.7. Chuyển đổi <w:pict> chứa <v:imagedata r:id="..."/> (không chứa hộp văn bản <w:txbxContent>)
    // sang <w:drawing><wp:inline>...<a:blip r:embed="..."/>...</w:drawing>
    // Lý do: Trong Mammoth, <w:pict> gọi .toExtra() làm đẩy hình ảnh xuống cuối đoạn văn <w:p>,
    // còn <w:drawing><wp:inline> giữ nguyên hình ảnh tại đúng vị trí dòng/chữ (trong cả câu hỏi, đáp án và lời giải)!
    documentXml = documentXml.replace(
      /<w:pict\b[^>]*>([\s\S]*?)<\/w:pict>/gi,
      (fullMatch: string, inner: string) => {
        if (/<w:txbxContent\b/i.test(inner)) {
          return fullMatch;
        }
        const imgDataMatches = Array.from(inner.matchAll(/<v:imagedata\b[^>]*\br:id=["']([^"']+)["'][^>]*>/gi));
        if (imgDataMatches.length > 0) {
          const uniqueRIds = Array.from(new Set(imgDataMatches.map((m) => m[1])));
          return uniqueRIds
            .map(
              (rId) =>
                `<w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${rId}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
            )
            .join('');
        }
        return fullMatch;
      }
    );

    // 4. Lưu lại document.xml đã được chuẩn hóa vào zip
    zip.file('word/document.xml', documentXml);

    return { zip, formulaImageTargets };
  } catch (e) {
    console.warn('Lỗi preprocessDocxXmlForMathAndImages:', e);
    return { zip, formulaImageTargets };
  }
}

/**
 * Hàm chuẩn hóa chuỗi công thức toán học cho KaTeX
 * - Hỗ trợ MathML từ MathType
 * - Hỗ trợ \(...\) và \[...\]
 * - Hỗ trợ thẻ chú thích LaTeX trong MathType image / OLE
 * - Tự động nhận diện công thức LaTeX chưa được bọc dấu $
 * - BẢO VỆ TUYỆT ĐỐI 100% thẻ <img src="data:image/..."> ở mọi vị trí (câu hỏi, đáp án, lời giải)
 */
export function sanitizeMathContent(content: string): string {
  if (!content) return '';

  // 0. Nếu có ảnh công thức MathType đặc biệt chứa alt="LaTeX:..." hoặc alt="math:..." thì chuyển thành LaTeX trước
  let preProcessed = content.replace(
    /<img[^>]*alt=["'](?:LaTeX:\s*|math:\s*)([^"']+)["'][^>]*>/gi,
    (_, alt) => {
      const clean = alt.trim();
      if (!clean) return '';
      return clean.startsWith('$') && clean.endsWith('$') ? clean : `$${clean}$`;
    }
  );

  // Loại bỏ thẻ img rỗng (không có src hợp lệ) hoặc ảnh vector WMF/EMF không hiển thị được trên trình duyệt
  preProcessed = preProcessed.replace(
    /<img\b(?![^>]*\bsrc=["'](?:data:image\/(?!x-wmf|x-emf|wmf|emf)|https?:\/\/|blob:|\/)[^"']+["'])[^>]*>/gi,
    ''
  );

  // Bảo vệ toàn bộ các thẻ <img ...> và <table ...> hợp lệ bằng token nguyên tử KHÔNG CHỨA DẤU GẠCH DƯỚI (_)
  // để KHÔNG BẤT KỲ regex chỉ số dưới / toán học nào chạm vào placeholder hoặc dữ liệu base64
  const preservedBlocks: string[] = [];
  preProcessed = preProcessed.replace(/<table\b[\s\S]*?<\/table>|<img\b[^>]*>/gi, (htmlBlock) => {
    const idx = preservedBlocks.length;
    preservedBlocks.push(htmlBlock);
    return `@@PRESERVED@HTML@TOKEN@${idx}@@`;
  });

  // Dọn dẹp các token lỗi cũ (nếu đề đã lưu trước đó bị dính $PRESERVED_IMG_0$)
  preProcessed = preProcessed.replace(/\$?\bPRESERVED_IMG_\d+\b\$?/g, '');

  let processed = decodePdfMathSymbols(preProcessed);

  // 1. Chuyển đổi các khối MathML sang LaTeX
  processed = processed.replace(/<math\b[\s\S]*?<\/math>/gi, (match) => {
    const latex = convertMathMLToLatex(match);
    return latex ? `$${latex}$` : '';
  });

  // 2. Chuyển đổi các khối OMML (Word Math) nếu có
  processed = processed.replace(/<m:oMath\b[\s\S]*?<\/m:oMath>/gi, (match) => {
    const latex = convertOmmlToLatex(match);
    return latex ? `$${latex}$` : '';
  });

  // 3. Nếu văn bản dùng dấu \(...\) hoặc \[...\] thì đổi sang $ và $$ chuẩn của KaTeX
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `$$${math.trim()}$$`);
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // 4. Tự động bọc các biểu thức toán học LaTeX phổ biến nếu giáo viên quên gõ dấu $
  processed = wrapUnenclosedLatex(processed);

  // 5. Khôi phục nguyên vẹn 100% các thẻ <img ...> và <table ...> đã bảo vệ
  processed = processed.replace(/@@PRESERVED@HTML@TOKEN@(\d+)@@/g, (_, idxStr) => preservedBlocks[Number(idxStr)] || '');

  return processed;
}

function applyOutsideMath(text: string, fn: (plain: string) => string): string {
  if (!text) return '';
  const parts: string[] = [];
  const mathOrTagRegex = /(\$\$[\s\S]*?\$\$|\$[^\$]+?\$|<\/?[a-zA-Z][^>]*>|@@[A-Z@]+@TOKEN@\d+@@)/g;
  let lastIndex = 0;
  let match;

  while ((match = mathOrTagRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(fn(text.substring(lastIndex, match.index)));
    }
    parts.push(match[0]);
    lastIndex = mathOrTagRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(fn(text.substring(lastIndex)));
  }

  return parts.join('');
}

// Bọc các lệnh LaTeX đứng trần không có $ bao quanh
function wrapUnenclosedLatex(text: string): string {
  if (!text) return '';

  // Bước 1: Bọc các phân số \frac{...}{...}, căn thức \sqrt{...}, vectơ \vec{...} (kèm vế trái nếu có dạng Q = \frac{...}{...})
  let res = applyOutsideMath(text, (chunk) =>
    chunk.replace(
      /(?:([A-Za-zα-ωΑ-ΩΔλμωπρστφθ0-9]+(?:_\{[^{}]*\}|\^\{[^{}]*\}|_[A-Za-z0-9]+|\^[A-Za-z0-9+\-]+)?\s*=\s*(?:[-+±]\s*)?))?(\\(?:frac|sqrt|vec|overline|hat|widetilde|dot|ddot|underline)\s*(?:\[[^\]]*\])?\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}(?:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?)/g,
      (_, lhs, cmd) => (lhs ? `$${lhs.trim()} ${cmd}$` : `$${cmd}$`)
    )
  );

  // Bước 2: Bọc tích phân \int, tổng \sum, giới hạn \lim
  res = applyOutsideMath(res, (chunk) =>
    chunk.replace(
      /(\\(?:int|sum|prod|lim|bigcup|bigcap)(?:_\{[^{}]*\}|\^\{[^{}]*\}|_[a-zA-Z0-9]+|\^[a-zA-Z0-9]+)*)/g,
      '$$$1$$'
    )
  );

  // Bước 3: Bọc các biểu thức có số mũ hoặc chỉ số dưới dạng x^{2}, 10^{-6}, Q_{1}, v_{0} đứng ngoài $...$
  res = applyOutsideMath(res, (chunk) =>
    chunk.replace(
      /([A-Za-z0-9α-ωΑ-ΩΔλμωπρστφθ\)]+(?:_\{[^{}]+\}|\^\{[^{}]+\}|_[0-9a-zA-Z]+|\^[0-9a-zA-Z+\-]+)+)/g,
      '$$$1$$'
    )
  );

  // Bước 4: Bọc các chữ cái Hy Lạp LaTeX đứng độc lập: \alpha, \beta, \gamma, \Delta, \pi, \theta, \lambda, \mu, \sigma, \omega
  res = applyOutsideMath(res, (chunk) =>
    chunk.replace(
      /(\\(?:alpha|beta|gamma|Delta|delta|pi|theta|lambda|mu|sigma|omega|phi|psi|rho|tau|eta|chi|xi|zeta|Omega|Theta|Phi|Psi|Gamma|Lambda|Sigma)\b)/g,
      '$$$1$$'
    )
  );

  // Gộp các khối $...$ liền kề nếu cùng một biểu thức toán học
  res = res.replace(/\$\s*\$(?![\$])/g, ' ');
  res = res.replace(/\${3,}/g, '$$');

  return res;
}
