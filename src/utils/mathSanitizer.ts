/**
 * Tiện ích chuẩn hóa và chuyển đổi công thức toán học từ MathType, MathML, OMML sang KaTeX/LaTeX
 * Hỗ trợ phân biệt công thức toán học (chuyển sang LaTeX) và hình ảnh thật (đồ thị, hình vẽ, sơ đồ)
 */
// @ts-ignore
import JSZip from 'jszip';

// Giải mã HTML Entities
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
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
      const mathRuns = u16.match(/[\p{L}\p{N}\s.,+\-*/=<>()[\]{}±≤≥≠→]{4,}/gu) || [];
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
      const relMatches = Array.from(relsXml.matchAll(/<Relationship[^>]*Id=["']([^"']+)["'][^>]*Target=["']([^"']+)["'][^>]*>/gi)) as RegExpMatchArray[];
      for (const m of relMatches) {
        if (m[1] && m[2]) {
          relsMap.set(m[1], m[2]);
        }
      }
    }

    // 1. Nhận diện các OLE Object thuộc MathType / Equation Editor
    // <w:object> ... <o:OLEObject ProgID="Equation.DSMT4" ... r:id="rIdOLE"/> ... <v:imagedata r:id="rIdImg"/> ... </w:object>
    documentXml = documentXml.replace(/<w:object\b[^>]*>([\s\S]*?)<\/w:object>/gi, (match: string) => {
      let latexFormula = '';

      // Kiểm tra có phải MathType hoặc Equation không
      const isEquation = /ProgID=["'](?:Equation|MathType)/i.test(match);

      // Tìm ảnh xem trước (companion preview image) của công thức MathType
      const imgIdMatch = match.match(/(?:<v:imagedata|<a:blip)[^>]*r:(?:id|embed)=["']([^"']+)["']/i);
      if (imgIdMatch) {
        const imgRId = imgIdMatch[1];
        const target = relsMap.get(imgRId) || '';
        if (target) {
          const fileName = target.split('/').pop() || target;
          // Đánh dấu ảnh này là ảnh công thức để KHÔNG HÓA ẢNH
          formulaImageTargets.add(fileName);
          formulaImageTargets.add(target);
        }
      }

      // Tìm nội dung LaTeX trong thuộc tính alt của shape hoặc descr
      const altMatch = match.match(/(?:alt|descr|title)=["']([^"']+)["']/i);
      if (altMatch && altMatch[1].trim()) {
        const altText = decodeHtmlEntities(altMatch[1].trim());
        if (altText && !altText.startsWith('image')) {
          latexFormula = altText.replace(/^LaTeX:\s*/i, '').trim();
        }
      }

      // Nếu chưa có LaTeX, thử đọc file nhị phân OLE .bin tương ứng
      if (!latexFormula && isEquation) {
        const oleIdMatch = match.match(/<o:OLEObject[^>]*r:id=["']([^"']+)["']/i);
        if (oleIdMatch) {
          let olePath = relsMap.get(oleIdMatch[1]) || '';
          if (olePath) {
            if (!olePath.startsWith('word/')) {
              olePath = 'word/' + olePath.replace(/^\//, '');
            }
            const oleFile = zip.file(olePath);
            if (oleFile) {
              // Sẽ đọc không đồng bộ nếu cần, hoặc từ cache
            }
          }
        }
      }

      if (latexFormula) {
        const cleanLatex = latexFormula.startsWith('$') ? latexFormula : `$${latexFormula}$`;
        return `<w:r><w:t xml:space="preserve"> ${cleanLatex} </w:t></w:r>`;
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

    // 4. Quét qua tất cả file media trong zip:
    // Mọi file có đuôi .wmf hoặc .emf trong Word hầu như 100% là ảnh công thức MathType cũ
    // Đánh dấu để loại trừ khỏi ảnh thực tế
    relsMap.forEach((target) => {
      if (/\.(?:wmf|emf)$/i.test(target)) {
        const fileName = target.split('/').pop() || target;
        formulaImageTargets.add(fileName);
        formulaImageTargets.add(target);
      }
    });

    // Lưu lại document.xml đã được chuẩn hóa vào zip
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
 */
export function sanitizeMathContent(content: string): string {
  if (!content) return '';

  let processed = content;

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

  // 4. Nếu có ảnh MathType chứa alt="...LaTeX..." thì chuyển thành công thức LaTeX thay vì ảnh
  processed = processed.replace(/<img[^>]*alt=["'](?:LaTeX:\s*|math:\s*)?([^"']+)["'][^>]*>/gi, (match, alt) => {
    const clean = alt.trim();
    // Nếu alt thực sự là công thức toán (chứa ký hiệu toán hoặc LaTeX)
    if (clean.startsWith('$') && clean.endsWith('$')) return clean;
    if (/[\\_{}^=+\-*/±≤≥≠→]/.test(clean)) {
      return `$${clean}$`;
    }
    // Nếu là alt ảnh mô tả bình thường (ví dụ: "Đồ thị", "Hình vẽ"), giữ nguyên thẻ img
    return match;
  });

  // 5. Loại bỏ thẻ img rỗng (không có src hoặc src rỗng) sinh ra từ ảnh công thức bị lọc
  processed = processed.replace(/<img\b(?![^>]*\bsrc=["']data:image\/[^"']+["'])[^>]*>/gi, '');

  // 6. Tự động bọc các biểu thức toán học LaTeX phổ biến nếu giáo viên quên gõ dấu $
  processed = wrapUnenclosedLatex(processed);

  return processed;
}

// Bọc các lệnh LaTeX đứng trần không có $ bao quanh
function wrapUnenclosedLatex(text: string): string {
  if (!text) return '';

  const parts: string[] = [];
  const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g;
  let lastIndex = 0;
  let match;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(processPlainTextChunk(text.substring(lastIndex, match.index)));
    }
    parts.push(match[0]);
    lastIndex = mathRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(processPlainTextChunk(text.substring(lastIndex)));
  }

  return parts.join('');
}

// Tìm và bọc các ký hiệu LaTeX độc lập trong đoạn text thường
function processPlainTextChunk(chunk: string): string {
  if (!chunk) return '';

  let res = chunk;

  // Nhận diện \frac{...}{...}, \sqrt{...}, \sqrt[...]{...}, \vec{...}, \overline{...}
  res = res.replace(/(\\(?:frac|sqrt|vec|overline|hat|widetilde|dot|ddot|underline)\s*(?:\[[^\]]*\])?\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}(?:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?)/g, '$$$1$$');

  // Nhận diện \int_{...}^{...}, \sum_{...}^{...}, \lim_{...}
  res = res.replace(/(\\(?:int|sum|prod|lim|bigcup|bigcap)(?:_\{[^{}]*\}|\^\{[^{}]*\}|_[a-zA-Z0-9]+|\^[a-zA-Z0-9]+)*)/g, '$$$1$$');

  // Nhận diện các chữ cái Hy Lạp đứng độc lập có dấu gạch chéo: \alpha, \beta, \gamma, \Delta, \pi, \theta, \lambda, \mu, \sigma, \omega
  res = res.replace(/(\\(?:alpha|beta|gamma|Delta|delta|pi|theta|lambda|mu|sigma|omega|phi|psi|rho|tau|eta|chi|xi|zeta|Omega|Theta|Phi|Psi|Gamma|Lambda|Sigma)\b)/g, '$$$1$$');

  // Tránh việc bọc trùng lặp như $$$...$$$
  res = res.replace(/\${3,}/g, '$$');

  return res;
}
