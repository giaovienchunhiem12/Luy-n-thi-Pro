import { Buffer } from 'buffer';
// @ts-ignore
import mammoth from "mammoth";
// @ts-ignore
import JSZip from 'jszip';
// @ts-ignore
import { GlobalWorkerOptions, getDocument, version as pdfjsVersion } from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure matching worker safely on client
const currentPdfjsVersion = pdfjsVersion || '5.4.624';
if (typeof window !== 'undefined' && GlobalWorkerOptions) {
  GlobalWorkerOptions.workerSrc = pdfWorker || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${currentPdfjsVersion}/build/pdf.worker.min.mjs`;
}

import { sanitizeMathContent } from './mathSanitizer';

/**
 * Đọc kích thước thực tế của ảnh PNG/JPEG từ buffer
 */
function getImageDimensions(buf: Buffer): { width: number; height: number } {
  try {
    // PNG header check
    if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      return { width, height };
    }
    // JPEG header check
    if (buf.length > 4 && buf[0] === 0xFF && buf[1] === 0xD8) {
      let offset = 2;
      while (offset < buf.length) {
        if (buf[offset] === 0xFF) {
          const marker = buf[offset + 1];
          if (marker >= 0xC0 && marker <= 0xC3) {
            const height = buf.readUInt16BE(offset + 5);
            const width = buf.readUInt16BE(offset + 7);
            return { width, height };
          }
          offset += 2 + buf.readUInt16BE(offset + 2);
        } else {
          offset++;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return { width: 0, height: 0 };
}

/**
 * Hàm đọc file Word (.docx) chuẩn: LUÔN BẢO TOÀN VÀ HIỂN THỊ 100% TẤT CẢ HÌNH ẢNH TRONG FILE WORD
 */
export async function parseWordFileToHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        // 1. Cấu hình convertImage theo yêu cầu chuẩn xác của người dùng
        convertImage: mammoth.images.imgElement(function (image: any) {
          return image.read("base64").then(function (imageBuffer: string) {
            return {
              src: `data:${image.contentType};base64,${imageBuffer}`,
              style: "max-width: 100%; height: auto; object-fit: contain; display: inline-block; vertical-align: middle;",
            };
          });
        }),
        // 2. Định nghĩa ánh xạ các kiểu định dạng cơ bản từ Word sang HTML
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "u => u", // Giữ nguyên chân gạch dưới (phục vụ nhận diện đáp án)
          "strike => s"
        ],
      }
    );

    let htmlOutput = result.value || '';

    // 3. Chuẩn hóa chuỗi HTML trả về để đảm bảo các thẻ toán học, KaTeX, đồ thị hiển thị hoàn hảo
    htmlOutput = sanitizeMathContent(htmlOutput);

    return htmlOutput;
  } catch (error) {
    console.error("Lỗi khi đọc file Word:", error);
    throw error;
  }
}

export async function parseWordFile(arrayBuffer: ArrayBuffer): Promise<string> {
  return parseWordFileToHtml(arrayBuffer);
}

interface PdfPositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
}

interface PdfReconstructedLine {
  y: number;
  minX: number;
  maxX: number;
  height: number;
  text: string;
  items: PdfPositionedItem[];
}

interface PdfBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface PdfExtractedFigure extends PdfBoundingBox {
  centerY: number;
  dataUrl: string;
}

/**
 * Nhân 2 ma trận biến đổi 2D 6 phần tử [a, b, c, d, e, f] của PDF
 */
function multiplyTransform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * Kiểm tra xem dòng văn bản có phải là tiêu đề PHẦN I, II, III hoặc câu hướng dẫn đầu phần không
 */
function isSectionOrInstructionLineText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^(?:(?:PH\s*[ẦAÀÂa-z]*\s*N|PART)\s*(?:I{1,3}|[123]|MỘT|HAI|BA|THỨ)\b|[I]{1,3}\s*[\.\:\)]\s*(?:CÂU\s*TRẮC\s*NGHIỆM|CÂU\s*HỎI|TRẮC\s*NGHIỆM|PHẦN))/i.test(t)) {
    return true;
  }
  if (/^(?:CÂU\s*(?:HỎI\s*)?TRẮC\s*NGHIỆM|TRẮC\s*NGHIỆM\s*(?:NHIỀU|ĐÚNG|TRẢ))/i.test(t)) {
    return true;
  }
  if (/^\(?\s*(?:Thí\s*sinh\s*trả\s*lời\s*từ\s*câu|Mỗi\s*câu\s*hỏi\s*thí\s*sinh|Trong\s*mỗi\s*ý\s*a\s*[\.\)]?)/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Kiểm tra xem dòng văn bản có phải là dòng bắt đầu một câu hỏi ("Câu 1.", "Câu 2. [IP]...", "Bài 1:") không
 */
function isQuestionStartLineText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^(?:từ|đến|tới|ở|theo)\s+câu\s+\d+/i.test(t)) return false;
  return /^(?:\[?\s*(?:Câu|Bài|CAU|BÀI|Question)\s*(?:số\s*)?\d+\s*(?:\([^\)\n]{1,25}\))?\s*\]?\s*(?:[\.\:\-\)]+|(?=\s*\[|\s+[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ0-9\(])))(?!\s*(?:đến|tới)\b)/i.test(t);
}

/**
 * Kiểm tra xem dòng văn bản có chứa các phương án lựa chọn A. B. C. D. hoặc các ý a) b) c) d) hoặc Lời giải không
 */
function isOptionOrSolutionLineText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Phương án A. B. C. D. ở đầu dòng hoặc nhiều phương án trên cùng dòng
  if (/^(?:<u>\s*)?[A-D][\.\:\)](?:<\/u>)?(?:\s+\S|$)/.test(t)) return true;
  if (/(?:^|\s)(?:<u>\s*)?[A-D][\.\:\)](?:<\/u>)?\s+\S[\s\S]*\s(?:<u>\s*)?[B-D][\.\:\)](?:<\/u>)?\s+\S/.test(t)) return true;
  // Ý a) b) c) d) của Phần II
  if (/^(?:<u>\s*)?[a-d]\)(?:<\/u>)?\s+\S/.test(t)) return true;
  // Từ khóa Lời giải / Đáp án
  if (/^(?:\[?\s*(?:Lời\s*giải|Hướng\s*dẫn\s*giải|Bài\s*giải|Đáp\s*án|Đáp\s*số|Kết\s*quả)\s*\]?\s*[\.\:\-])/i.test(t)) return true;
  return false;
}

/**
 * Chuẩn hóa chuỗi dòng để so sánh chân trang / tiêu đề lặp lại giữa các trang PDF
 */
function normalizeHeaderFooterSignature(line: string): string {
  return line
    .normalize('NFC')
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/[\s\-–—_.,;:!?|\/\\()\[\]]+/g, ' ')
    .trim();
}

/**
 * Kiểm tra xem một dòng văn bản có phải là chân tiêu đề (page footer / running header / dòng hướng dẫn phụ) cần loại bỏ không
 */
function isHeaderOrFooterLine(
  line: string,
  lineY: number,
  pageHeight: number,
  pageIndex: number,
  totalPages: number,
  repeatedSignatures: Set<string>
): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  // Không bao giờ xóa dòng bắt đầu bằng Câu X, Bài X, PHẦN I/II/III hoặc phương án A. B. C. D. a) b) c) d)
  if (isQuestionStartLineText(trimmed)) return false;
  if (/^(?:(?:PH\s*[ẦAÀÂa-z]*\s*N|PART)\s*(?:I{1,3}|[123]|MỘT|HAI|BA|THỨ)\b|[I]{1,3}\s*[\.\:\)]\s*(?:CÂU\s*TRẮC\s*NGHIỆM|CÂU\s*HỎI|TRẮC\s*NGHIỆM|PHẦN))/i.test(trimmed)) {
    return false;
  }

  const isOptionLine = isOptionOrSolutionLineText(trimmed);

  // 1. Dòng kẻ ngang / chân tiêu đề phân cách (----, ____, ====, ****, ....)
  if (/^[-–—_=*~•·.\s]{3,}$/.test(trimmed)) return true;

  // 2. Dòng số trang / Mã đề thi ở bất kỳ dạng nào ("Trang 1/4", "Trang 2 - Mã đề 101", "Mã đề thi: 204", "Page 1 of 4")
  if (/^(?:[-–—_\s•*|]*)(?:Trang|Page)\s*\d+(?:\s*(?:\/|trên|of|\-)\s*\d+)?(?:\s*[-–—|.,;]*\s*(?:Mã\s*đề(?:\s*thi)?\s*[:.]?\s*\d+)?)?(?:[-–—_\s•*|]*)$/i.test(trimmed)) {
    return true;
  }
  if (/^(?:[-–—_\s•*|]*)(?:Mã\s*đề(?:\s*thi)?\s*[:.]?\s*\d+)(?:\s*[-–—|.,;]*\s*(?:Trang|Page)\s*\d+(?:\s*\/\s*\d+)?)?(?:[-–—_\s•*|]*)$/i.test(trimmed)) {
    return true;
  }
  if (!isOptionLine && trimmed.length < 95 && /\b(?:Trang|Page)\s+\d+\s*\/\s*\d+\b/i.test(trimmed)) {
    return true;
  }

  // 3. Chân tiêu đề hướng dẫn của các phần ("Thí sinh trả lời từ câu 1 đến câu 18...", "Mỗi câu hỏi thí sinh chỉ chọn một phương án", "Trong mỗi ý a), b), c), d)...")
  if (/^\(?\s*Thí\s*sinh\s*trả\s*lời\s*từ\s*câu\s*\d+\s*đến\s*câu\s*\d+[^\n]*$/i.test(trimmed)) return true;
  if (/^\(?\s*Mỗi\s*câu\s*hỏi\s*thí\s*sinh\s*chỉ\s*chọn\s*một\s*phương\s*án[^\n]*$/i.test(trimmed)) return true;
  if (/^\(?\s*Trong\s*mỗi\s*ý\s*a\s*[\.\)]?\s*,\s*b\s*[\.\)]?\s*,\s*c\s*[\.\)]?\s*,\s*d\s*[\.\)]?\s*ở\s*mỗi\s*câu[^\n]*$/i.test(trimmed)) return true;

  // 4. Tiêu đề hành chính đầu đề thi ("SỞ GD&ĐT...", "TRƯỜNG THPT...", "ĐỀ CHÍNH THỨC", "Họ và tên thí sinh...", "Số báo danh...", "Thời gian làm bài...")
  if (/^(?:SỞ\s+GIÁO\s+DỤC|SỞ\s+GD\s*&\s*ĐT|TRƯỜNG\s+THPT|TRƯỜNG\s+THCS|PHÒNG\s+GD|BỘ\s+GIÁO\s+DỤC|ĐỀ\s+CHÍNH\s+THỨC|ĐỀ\s+THAM\s+KHẢO|ĐỀ\s+MINH\s+HỌA|KỲ\s+THI\s+TỐT\s+NGHIỆM|ĐỀ\s+KIỂM\s+TRA|ĐỀ\s+THI\s+THỬ|BÀI\s+KIỂM\s+TRA)\b/i.test(trimmed)) {
    return true;
  }
  if (/^(?:Họ\s*(?:và\s*)?tên\s*(?:thí\s*sinh|học\s*sinh)?\s*[:.]|Số\s*báo\s*danh\s*[:.]|Thời\s*gian\s*làm\s*bài\s*[:.]|\(?\s*Đề\s*(?:thi\s*)?(?:gồm\s*)?có\s*\d+\s*trang|\(?\s*Không\s*kể\s*thời\s*gian\s*phát\s*đề|Môn\s*(?:thi|học|kiểm\s*tra)?\s*[:.]\s*[^\n]{1,40}$)/i.test(trimmed)) {
    return true;
  }

  // 5. Kiểm tra theo tọa độ vùng đầu trang (top 7%) và chân trang (bottom 7%) của PDF
  const isNearBottom = pageHeight > 0 && lineY < pageHeight * 0.072;
  const isVeryBottom = pageHeight > 0 && lineY < pageHeight * 0.048;
  const isNearTop = pageHeight > 0 && lineY > pageHeight * 0.93;
  const isInHeaderFooterZone = pageHeight > 0 && (lineY < pageHeight * 0.14 || lineY > pageHeight * 0.86);

  if (isVeryBottom && !isOptionLine) {
    return true;
  }

  if (isNearBottom && !isOptionLine) {
    if (/(?:trang|page|mã\s*đề|đề\s*số|gv\b|giáo\s*viên|thầy|cô|sđt|đt\b|zalo|http|www\.|\.com|\.vn|\.edu|\.net|tài\s*liệu|luyện\s*thi|ôn\s*thi|chuyên\s*đề|năm\s*học)/i.test(trimmed)) {
      return true;
    }
  }

  if (isNearTop && pageIndex > 1 && !isOptionLine) {
    if (/(?:trang|page|mã\s*đề|đề\s*kiểm\s*tra|đề\s*thi|gv\b|giáo\s*viên|thầy|cô|tài\s*liệu|luyện\s*thi|chuyên\s*đề|môn\s*:)/i.test(trimmed)) {
      return true;
    }
  }

  // 6. Dòng lặp lại ở đầu trang / chân trang trên nhiều trang (running header / footer)
  if (totalPages >= 2 && isInHeaderFooterZone && !isOptionLine) {
    const sig = normalizeHeaderFooterSignature(trimmed);
    if (sig.length >= 3 && repeatedSignatures.has(sig)) {
      return true;
    }
  }

  return false;
}

/**
 * Làm sạch phần đuôi chân trang hoặc câu hướng dẫn phụ bị dính vào cuối dòng
 */
function stripInlineHeaderFooterArtifacts(line: string): string {
  return line
    .replace(/\s*[-–—|]*\s*\b(?:Trang|Page)\s+\d+\s*(?:\/|trên|of)\s*\d+(?:\s*[-–—|]*\s*Mã\s*đề(?:\s*thi)?\s*[:.]?\s*\d+)?\s*$/i, '')
    .replace(/\s*\(?\s*Thí\s*sinh\s*trả\s*lời\s*từ\s*câu\s*\d+\s*đến\s*(?:câu\s*\d+)?[^)]*\)?/gi, '')
    .replace(/\s*\(?\s*Mỗi\s*câu\s*hỏi\s*thí\s*sinh\s*chỉ\s*chọn\s*một\s*phương\s*án\.?\s*\)?/gi, '')
    .replace(/\s*\(?\s*Trong\s*mỗi\s*ý\s*a\s*[\.\)]?\s*,\s*b\s*[\.\)]?\s*,\s*c\s*[\.\)]?\s*,\s*d\s*[\.\)]?\s*ở\s*mỗi\s*câu[^)]*\)?/gi, '')
    .trim();
}

/**
 * Trích xuất CHỈ các hình ảnh / đồ thị / mạch điện / bảng dữ liệu thực sự trong câu hỏi PDF.
 * TUYỆT ĐỐI KHÔNG chụp dòng câu hỏi ("Câu 1...") hoặc dòng phương án ("A. ... B. ... C. ... D. ...") làm hình ảnh!
 */
async function extractFiguresFromPdfPage(
  page: any,
  rawItems: PdfPositionedItem[],
  initialLines: PdfReconstructedLine[],
  pageWidth: number,
  pageHeight: number,
  contentMinY: number,
  contentMaxY: number,
  questionBreakYs: number[]
): Promise<PdfExtractedFigure[]> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return [];
  }
  if (contentMaxY <= contentMinY + 35) {
    return [];
  }

  try {
    // 1. Lấy các khung ảnh nhúng (Raster Image XObjects) từ OperatorList (nếu có)
    const xObjectBoxes: PdfBoundingBox[] = [];
    try {
      const opList = await page.getOperatorList();
      const fnArray: number[] = opList?.fnArray || [];
      const argsArray: any[] = opList?.argsArray || [];
      const ctmStack: number[][] = [];
      let ctm = [1, 0, 0, 1, 0, 0];

      // Mã lệnh chuẩn trong PDF.js: save=10, restore=11, transform=12, paintJpegXObject=82, paintImageMaskXObject=83, paintImageXObject=85, paintInlineImageXObject=86, paintImageXObjectRepeat=88
      for (let i = 0; i < fnArray.length; i++) {
        const fn = fnArray[i];
        const args = argsArray[i];
        if (fn === 10) {
          ctmStack.push([...ctm]);
        } else if (fn === 11) {
          if (ctmStack.length > 0) ctm = ctmStack.pop()!;
        } else if (fn === 12 && Array.isArray(args) && args.length >= 6) {
          ctm = multiplyTransform(ctm, args);
        } else if (fn === 82 || fn === 83 || fn === 85 || fn === 86 || fn === 88) {
          const [a, b, c, d, e, f] = ctm;
          const xs = [e, e + a, e + c, e + a + c];
          const ys = [f, f + b, f + d, f + b + d];
          const minX = Math.max(0, Math.min(...xs));
          const maxX = Math.min(pageWidth, Math.max(...xs));
          const minY = Math.max(0, Math.min(...ys));
          const maxY = Math.min(pageHeight, Math.max(...ys));
          const w = maxX - minX;
          const h = maxY - minY;

          // Chỉ nhận hình ảnh thực sự nằm trong vùng nội dung câu hỏi (bỏ qua icon nhỏ, đường kẻ mảnh hoặc watermark toàn trang)
          if (
            w >= 32 &&
            h >= 28 &&
            !(w > pageWidth * 0.85 && h > pageHeight * 0.65) &&
            !(w / h > 8 && h < 32) &&
            maxY <= contentMaxY + 12 &&
            minY >= contentMinY - 12
          ) {
            xObjectBoxes.push({ minX, minY, maxX, maxY });
          }
        }
      }
    } catch (opErr) {
      console.warn('Không thể đọc operatorList của trang PDF:', opErr);
    }

    // 2. Render trang PDF lên graphicsCanvas với fillText & strokeText bị vô hiệu hóa hoàn toàn!
    // Nhờ đó mọi chữ viết thông thường KHÔNG BAO GIỜ được vẽ lên graphicsCanvas; chỉ có đồ thị, hình vẽ vector, bảng dữ liệu và ảnh nhúng được vẽ!
    const maskScale = 0.75;
    const maskViewport = page.getViewport({ scale: maskScale });
    const maskW = Math.max(1, Math.ceil(maskViewport.width));
    const maskH = Math.max(1, Math.ceil(maskViewport.height));
    const graphicsCanvas = document.createElement('canvas');
    graphicsCanvas.width = maskW;
    graphicsCanvas.height = maskH;
    const graphicsCtx = graphicsCanvas.getContext('2d');
    if (!graphicsCtx) return [];

    graphicsCtx.fillStyle = '#FFFFFF';
    graphicsCtx.fillRect(0, 0, maskW, maskH);

    // Vô hiệu hóa việc vẽ chữ trên graphicsCanvas
    graphicsCtx.fillText = () => {};
    graphicsCtx.strokeText = () => {};

    await page.render({ canvasContext: graphicsCtx, viewport: maskViewport }).promise;

    // 3. Xóa trắng vùng tiêu đề đầu trang, chân trang, các dải tiêu đề PHẦN I/II/III và các dòng dẫn câu hỏi / phương án trên graphicsCanvas
    graphicsCtx.fillStyle = '#FFFFFF';
    const topCutPx = Math.max(0, Math.floor((pageHeight - contentMaxY) * maskScale));
    const bottomCutPx = Math.min(maskH, Math.ceil((pageHeight - contentMinY) * maskScale));
    if (topCutPx > 0) {
      graphicsCtx.fillRect(0, 0, maskW, topCutPx);
    }
    if (bottomCutPx < maskH) {
      graphicsCtx.fillRect(0, bottomCutPx, maskW, maskH - bottomCutPx);
    }

    // Xóa mép lề trái/phải của trang
    const marginPx = Math.ceil(16 * maskScale);
    graphicsCtx.fillRect(0, 0, marginPx, maskH);
    graphicsCtx.fillRect(maskW - marginPx, 0, marginPx, maskH);

    // Xóa khung nền / đường viền trang trí của các dòng tiêu đề PHẦN I, II, III và dòng mở đầu "Câu X." / phương án "A. B. C. D."
    for (const line of initialLines) {
      const lHeight = Math.max(line.height, 11);
      if (isSectionOrInstructionLineText(line.text)) {
        // Xóa toàn bộ chiều ngang của dải tiêu đề PHẦN I/II/III để không bao giờ bắt nhầm khung màu tiêu đề phần
        const ry = Math.floor((pageHeight - (line.y + lHeight * 1.45)) * maskScale);
        const rh = Math.ceil(lHeight * 2.1 * maskScale);
        graphicsCtx.fillRect(0, Math.max(0, ry), maskW, rh);
      } else if (isQuestionStartLineText(line.text) || isOptionOrSolutionLineText(line.text)) {
        // Xóa vùng ngang của chữ trên dòng Câu X. (ví dụ khung [IP]) và dòng phương án A. B. C. D. (ví dụ gạch chân <u>A.</u>, phân số inline)
        const rx = Math.max(0, Math.floor((line.minX - 4) * maskScale));
        const rw = Math.ceil((line.maxX - line.minX + 8) * maskScale);
        const ry = Math.max(0, Math.floor((pageHeight - (line.y + lHeight * 1.25)) * maskScale));
        const rh = Math.ceil(lHeight * 1.65 * maskScale);
        graphicsCtx.fillRect(rx, ry, rw, rh);
      }
    }

    // Kẻ vạch phân cách mỏng tại vị trí bắt đầu mỗi câu hỏi ("Câu 1.", "Câu 2."...) để hình của 2 câu liên tiếp không bao giờ gộp vào nhau
    for (const qY of questionBreakYs) {
      const py = Math.floor((pageHeight - (qY + 9)) * maskScale);
      graphicsCtx.fillRect(0, Math.max(0, py - 1), maskW, 3);
    }

    // 4. Quét lưới ô 2x2 trên graphicsCanvas với bán kính liên thông chặt (1 ô ~ 2.6pt)
    // Chỉ những đối tượng đồ họa thực sự (đồ thị, hình vẽ, bảng dữ liệu có khung viền liên tục) mới tạo thành khối lớn
    const imgData = graphicsCtx.getImageData(0, 0, maskW, maskH).data;
    const cellSize = 2;
    const gridW = Math.ceil(maskW / cellSize);
    const gridH = Math.ceil(maskH / cellSize);
    const grid = new Uint8Array(gridW * gridH);

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        let hasInk = false;
        for (let dy = 0; dy < cellSize && !hasInk; dy++) {
          const py = gy * cellSize + dy;
          if (py >= maskH) continue;
          for (let dx = 0; dx < cellSize; dx++) {
            const px = gx * cellSize + dx;
            if (px >= maskW) continue;
            const idx = (py * maskW + px) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];
            if (a > 35 && (r < 235 || g < 235 || b < 235)) {
              hasInk = true;
              break;
            }
          }
        }
        if (hasInk) {
          grid[gy * gridW + gx] = 1;
        }
      }
    }

    const visited = new Uint8Array(gridW * gridH);
    const candidateBoxes: { minX: number; minY: number; maxX: number; maxY: number; inkCells: number }[] = [];

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const startIdx = gy * gridW + gx;
        if (!grid[startIdx] || visited[startIdx]) continue;

        let minGx = gx;
        let maxGx = gx;
        let minGy = gy;
        let maxGy = gy;
        let inkCells = 0;
        const queue: number[] = [startIdx];
        visited[startIdx] = 1;

        while (queue.length > 0) {
          const curr = queue.pop()!;
          const cy = Math.floor(curr / gridW);
          const cx = curr % gridW;
          inkCells++;

          if (cx < minGx) minGx = cx;
          if (cx > maxGx) maxGx = cx;
          if (cy < minGy) minGy = cy;
          if (cy > maxGy) maxGy = cy;

          // Bán kính 1 ô (~2.6pt): giữ nguyên kết nối của khung bảng, trục đồ thị, mạch điện nhưng KHÔNG nối tắt qua các dòng chữ
          for (let ny = Math.max(0, cy - 1); ny <= Math.min(gridH - 1, cy + 1); ny++) {
            for (let nx = Math.max(0, cx - 1); nx <= Math.min(gridW - 1, cx + 1); nx++) {
              const nIdx = ny * gridW + nx;
              if (grid[nIdx] && !visited[nIdx]) {
                visited[nIdx] = 1;
                queue.push(nIdx);
              }
            }
          }
        }

        const pdfMinX = (minGx * cellSize) / maskScale;
        const pdfMaxX = ((maxGx + 1) * cellSize) / maskScale;
        const pdfMaxY = pageHeight - (minGy * cellSize) / maskScale;
        const pdfMinY = pageHeight - ((maxGy + 1) * cellSize) / maskScale;
        const w = pdfMaxX - pdfMinX;
        const h = pdfMaxY - pdfMinY;

        // Loại bỏ hoàn toàn các ký hiệu toán nhỏ inline (căn thức, phân số, mũi tên vectơ, gạch chân) có chiều cao < 30pt hoặc chiều rộng < 36pt
        if (inkCells >= 12 && w >= 36 && h >= 30 && !(w / h > 7.5 && h < 34) && !(h / w > 8 && w < 26)) {
          candidateBoxes.push({ minX: pdfMinX, minY: pdfMinY, maxX: pdfMaxX, maxY: pdfMaxY, inkCells });
        }
      }
    }

    // Thêm các hộp ảnh nhúng XObject từ OperatorList
    for (const xb of xObjectBoxes) {
      candidateBoxes.push({ ...xb, inkCells: 40 });
    }

    if (candidateBoxes.length === 0) return [];

    // 5. Gộp các thành phần con của cùng một hình vẽ / đồ thị (ví dụ hai nhánh đồ thị hoặc hai hình a, b nằm ngang hàng trong cùng câu hỏi)
    let mergedBoxes = [...candidateBoxes];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < mergedBoxes.length; i++) {
        for (let j = i + 1; j < mergedBoxes.length; j++) {
          const a = mergedBoxes[i];
          const b = mergedBoxes[j];
          const horizGap = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
          const vertGap = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY));
          const vertOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
          const minH = Math.min(a.maxY - a.minY, b.maxY - b.minY);

          const topY = Math.max(a.maxY, b.maxY);
          const botY = Math.min(a.minY, b.minY);
          const crossesQuestion = questionBreakYs.some(qY => qY > botY + 4 && qY < topY - 4);

          // Kiểm tra có dòng câu hỏi / phương án nào cắt ngang giữa 2 hộp không
          const crossesProtectedLine = initialLines.some(l => {
            if (!isSectionOrInstructionLineText(l.text) && !isQuestionStartLineText(l.text) && !isOptionOrSolutionLineText(l.text)) {
              return false;
            }
            return l.y > botY + 3 && l.y < topY - 3;
          });

          const isClosePartsOfSameDiagram = horizGap <= 14 && vertGap <= 6;
          const isSideBySideSubfigures = vertOverlap >= minH * 0.55 && horizGap <= 45;

          if (!crossesQuestion && !crossesProtectedLine && (isClosePartsOfSameDiagram || isSideBySideSubfigures)) {
            mergedBoxes[i] = {
              minX: Math.min(a.minX, b.minX),
              minY: Math.min(a.minY, b.minY),
              maxX: Math.max(a.maxX, b.maxX),
              maxY: Math.max(a.maxY, b.maxY),
              inkCells: a.inkCells + b.inkCells,
            };
            mergedBoxes.splice(j, 1);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    // 6. Render trang PDF ở độ phân giải cao (1.75x) để cắt hình ảnh sắc nét (giữ nguyên chữ trong bảng dữ liệu và nhãn trục O, x, y của đồ thị)
    const renderScale = 1.75;
    const renderViewport = page.getViewport({ scale: renderScale });
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = Math.ceil(renderViewport.width);
    renderCanvas.height = Math.ceil(renderViewport.height);
    const renderCtx = renderCanvas.getContext('2d');
    if (!renderCtx) return [];

    renderCtx.fillStyle = '#FFFFFF';
    renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
    await page.render({ canvasContext: renderCtx, viewport: renderViewport }).promise;

    const extractedFigures: PdfExtractedFigure[] = [];

    for (const rawBox of mergedBoxes) {
      let boxMinX = rawBox.minX;
      let boxMaxX = rawBox.maxX;
      let boxMinY = rawBox.minY;
      let boxMaxY = rawBox.maxY;

      // 6.1. Cắt gọt nghiêm ngặt: Đảm bảo khung hình KHÔNG BAO GIỜ trùm lên dòng tiêu đề PHẦN, dòng câu hỏi "Câu X." hoặc dòng phương án "A. B. C. D." / "a) b) c) d)"
      for (const l of initialLines) {
        const horizOverlap = Math.min(l.maxX, boxMaxX) - Math.max(l.minX, boxMinX);
        if (horizOverlap <= 12) continue;
        const lh = Math.max(l.height, 11);

        if (isSectionOrInstructionLineText(l.text) || isQuestionStartLineText(l.text) || isOptionOrSolutionLineText(l.text)) {
          const boxMidY = (boxMinY + boxMaxY) / 2;
          if (l.y >= boxMidY) {
            boxMaxY = Math.min(boxMaxY, l.y - lh * 0.32);
          } else {
            boxMinY = Math.max(boxMinY, l.y + lh * 1.05);
          }
        }
      }

      if (boxMaxX - boxMinX < 36 || boxMaxY - boxMinY < 28) continue;

      // 6.2. Mở rộng nhẹ để bao trọn các nhãn trục ngắn (như O, x, y, t (s), u (V), Hình 1...) nằm sát rìa trục đồ thị
      for (const item of rawItems) {
        const str = item.str.trim();
        if (!str || str.length > 14) continue;
        if (/^(?:Câu|Bài|PHẦN|A\.|B\.|C\.|D\.|a\)|b\)|c\)|d\))/i.test(str)) continue;

        // Kiểm tra xem item này có thuộc về một dòng câu dẫn dài hoặc dòng phương án không
        const belongsToProtectedLine = initialLines.some(
          l =>
            l.items.includes(item) &&
            (isSectionOrInstructionLineText(l.text) ||
              isQuestionStartLineText(l.text) ||
              isOptionOrSolutionLineText(l.text) ||
              l.text.length > 42)
        );
        if (belongsToProtectedLine) continue;

        const ix1 = item.x;
        const ix2 = item.x + item.width;
        const iy1 = item.y - item.height * 0.25;
        const iy2 = item.y + item.height * 0.95;

        const hDist = Math.max(0, Math.max(ix1, boxMinX) - Math.min(ix2, boxMaxX));
        const vDist = Math.max(0, Math.max(iy1, boxMinY) - Math.min(iy2, boxMaxY));

        if (hDist <= 14 && vDist <= 10) {
          boxMinX = Math.min(boxMinX, ix1);
          boxMaxX = Math.max(boxMaxX, ix2);
          boxMinY = Math.min(boxMinY, iy1);
          boxMaxY = Math.max(boxMaxY, iy2);
        }
      }

      // 6.3. Thêm lề trắng nhỏ 3.5pt quanh đồ thị/bảng nhưng chặn tuyệt đối không cho lấn vào dòng văn bản bên trên hoặc bên dưới
      const pad = 3.5;
      let cropMinX = Math.max(8, boxMinX - pad);
      let cropMaxX = Math.min(pageWidth - 8, boxMaxX + pad);
      let cropMinY = Math.max(contentMinY - 4, boxMinY - pad);
      let cropMaxY = Math.min(contentMaxY + 4, boxMaxY + pad);

      for (const l of initialLines) {
        const horizOverlap = Math.min(l.maxX, cropMaxX) - Math.max(l.minX, cropMinX);
        if (horizOverlap <= 12) continue;
        const lh = Math.max(l.height, 11);

        // Nếu dòng văn bản nằm phía trên khung đồ thị/bảng (hoặc là dòng Câu X.)
        if (l.y >= boxMaxY - 2 || isQuestionStartLineText(l.text)) {
          if (l.y > (boxMinY + boxMaxY) / 2) {
            cropMaxY = Math.min(cropMaxY, l.y - lh * 0.30);
          }
        }
        // Nếu dòng văn bản nằm phía dưới khung đồ thị/bảng (hoặc là dòng phương án A, B, C, D)
        if (l.y <= boxMinY + 2 || isOptionOrSolutionLineText(l.text)) {
          if (l.y < (boxMinY + boxMaxY) / 2) {
            cropMinY = Math.max(cropMinY, l.y + lh * 1.02);
          }
        }
      }

      const finalW = cropMaxX - cropMinX;
      const finalH = cropMaxY - cropMinY;
      if (finalW < 36 || finalH < 28) continue;
      if (finalW > pageWidth * 0.90 && finalH > pageHeight * 0.65) continue;
      if (finalW / finalH > 7.5 && finalH < 34) continue;

      const sx = Math.max(0, Math.floor(cropMinX * renderScale));
      const sy = Math.max(0, Math.floor((pageHeight - cropMaxY) * renderScale));
      const sw = Math.min(renderCanvas.width - sx, Math.ceil(finalW * renderScale));
      const sh = Math.min(renderCanvas.height - sy, Math.ceil(finalH * renderScale));
      if (sw < 24 || sh < 24) continue;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = sw;
      outCanvas.height = sh;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) continue;

      outCtx.fillStyle = '#FFFFFF';
      outCtx.fillRect(0, 0, sw, sh);
      outCtx.drawImage(renderCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

      // Nếu là hình vẽ nằm bên phải (Side-by-Side) và có chữ của câu dẫn bên trái vô tình chạm nhẹ vào mép trái của khung cắt
      for (const item of rawItems) {
        if (item.x < cropMinX - 10 && item.x + item.width > cropMinX) {
          const ix = 0;
          const iy = Math.floor((cropMaxY - (item.y + item.height * 1.05)) * renderScale);
          const iw = Math.ceil((item.x + item.width - cropMinX + 2) * renderScale);
          const ih = Math.ceil(item.height * 1.35 * renderScale);
          outCtx.fillStyle = '#FFFFFF';
          outCtx.fillRect(ix, Math.max(0, iy), iw, ih);
        }
      }

      const dataUrl = outCanvas.toDataURL('image/jpeg', 0.88);
      if (dataUrl && dataUrl.startsWith('data:image')) {
        extractedFigures.push({
          minX: cropMinX,
          minY: cropMinY,
          maxX: cropMaxX,
          maxY: cropMaxY,
          centerY: (cropMinY + cropMaxY) / 2,
          dataUrl,
        });
      }
    }

    extractedFigures.sort((a, b) => b.centerY - a.centerY);
    return extractedFigures;
  } catch (err) {
    console.warn('Lỗi khi trích xuất hình ảnh từ trang PDF:', err);
    return [];
  }
}

/**
 * Gom danh sách PdfPositionedItem thành các dòng văn bản theo tọa độ Y
 */
function groupItemsIntoLines(items: PdfPositionedItem[]): PdfReconstructedLine[] {
  const sortedByY = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) <= 4.2) {
      return a.x - b.x;
    }
    return b.y - a.y;
  });

  const rawLines: { y: number; height: number; items: PdfPositionedItem[] }[] = [];
  for (const item of sortedByY) {
    if (!item.str.trim() && !item.hasEOL) continue;
    let matchedLine = rawLines.find(
      (l) => Math.abs(l.y - item.y) <= Math.max(4.8, Math.min(l.height, item.height) * 0.48)
    );
    if (!matchedLine) {
      matchedLine = { y: item.y, height: item.height, items: [item] };
      rawLines.push(matchedLine);
    } else {
      matchedLine.items.push(item);
      matchedLine.height = Math.max(matchedLine.height, item.height);
      if (item.str.trim().length >= 2) {
        matchedLine.y = (matchedLine.y * 0.75) + (item.y * 0.25);
      }
    }
  }

  rawLines.sort((a, b) => b.y - a.y);

  const result: PdfReconstructedLine[] = [];
  for (const line of rawLines) {
    line.items.sort((a, b) => a.x - b.x);
    let lineStr = '';
    let prevItem: PdfPositionedItem | null = null;
    let minX = Infinity;
    let maxX = -Infinity;

    for (const item of line.items) {
      const piece = item.str;
      if (!piece) continue;
      if (item.x < minX) minX = item.x;
      if (item.x + item.width > maxX) maxX = item.x + item.width;

      if (!prevItem) {
        lineStr += piece;
      } else {
        const gap = item.x - (prevItem.x + prevItem.width);
        const spaceThreshold = Math.max(1.5, Math.min(prevItem.height, item.height) * 0.14);
        const endsWithSpace = /\s$/.test(lineStr);
        const startsWithSpace = /^\s/.test(piece);
        const isClosingPunct = /^[\.,;:!\?\)\]]/.test(piece.trim()) && gap < spaceThreshold * 2.5;
        const afterOpeningPunct = /[\(\[]$/.test(lineStr.trim()) && gap < spaceThreshold * 2.5;

        if (!endsWithSpace && !startsWithSpace && !isClosingPunct && !afterOpeningPunct) {
          if (gap > spaceThreshold * 4) {
            lineStr += '   ';
          } else if (gap > spaceThreshold) {
            lineStr += ' ';
          }
        }
        lineStr += piece;
      }
      prevItem = item;
    }

    const cleaned = lineStr
      .normalize('NFC')
      .replace(/^\s*P\s*H\s*[ẦAÀ]\s*N(?=\s*(?:I{1,3}\b|[123]\b))/i, 'PHẦN')
      .replace(/^PHẦN\s+I\s+I\s+I\b/i, 'PHẦN III')
      .replace(/^PHẦN\s+I\s+I\b/i, 'PHẦN II')
      .replace(/^\s*C\s*â\s*u\s*(?=\d+)/, 'Câu ')
      .replace(/^\s*C\s*Â\s*U\s*(?=\d+)/, 'CÂU ')
      .replace(/(?:^|\s)([A-D])\s+([\.\)])(?=\s)/g, ' $1$2')
      .replace(/(?:^|\s)([a-d])\s+(\))(?=\s)/g, ' $1$2')
      .trim();

    if (cleaned) {
      result.push({
        y: line.y,
        minX: minX === Infinity ? 0 : minX,
        maxX: maxX === -Infinity ? 0 : maxX,
        height: line.height,
        text: cleaned,
        items: line.items,
      });
    }
  }

  return result;
}

/**
 * Hàm đọc file PDF, loại bỏ hoàn toàn chân tiêu đề / header / footer và giữ lại 100% hình ảnh / đồ thị / bảng dữ liệu ở đúng vị trí trong câu hỏi
 */
export async function parsePdfFileToText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const version = pdfjsVersion || '5.4.624';
    if (typeof window !== 'undefined' && GlobalWorkerOptions) {
      GlobalWorkerOptions.workerSrc = pdfWorker || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    }

    const pdfData = new Uint8Array(arrayBuffer.slice(0));
    let pdf: any;
    try {
      pdf = await getDocument({
        data: pdfData,
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/standard_fonts/`,
      }).promise;
    } catch (workerErr) {
      console.warn("Thử lại getDocument với fallback:", workerErr);
      pdf = await getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
    }

    // Bước 1: Thu thập toàn bộ phần tử văn bản của các trang và nhận diện các dòng tiêu đề / chân trang lặp lại
    const pageDataList: {
      pageIndex: number;
      page: any;
      pageWidth: number;
      pageHeight: number;
      rawItems: PdfPositionedItem[];
      initialLines: PdfReconstructedLine[];
    }[] = [];

    const signaturePageCounts = new Map<string, number>();

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width || 595;
      const pageHeight = viewport.height || 842;
      const content = await page.getTextContent();

      const rawItems: PdfPositionedItem[] = [];
      for (const item of content.items as any[]) {
        if (item && typeof item.str === 'string') {
          const str = item.str.normalize('NFC');
          if (!str && !item.hasEOL) continue;
          const tx = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
          const x = typeof tx[4] === 'number' ? tx[4] : 0;
          const y = typeof tx[5] === 'number' ? tx[5] : 0;

          // Tính chiều cao font chính xác (tránh trường hợp tx[3] = 1 làm mất chiều cao thực item.height = 11..12pt)
          const rawH = typeof item.height === 'number' && item.height > 2 ? item.height : 0;
          const txScaleY = Math.hypot(tx[2] || 0, tx[3] || 0);
          const txScaleX = Math.hypot(tx[0] || 0, tx[1] || 0);
          const txH = Math.max(txScaleY > 2 ? txScaleY : 0, txScaleX > 2 ? txScaleX : 0);
          const fontHeight = Math.max(rawH, txH, 10.5);

          const width = typeof item.width === 'number' && item.width > 0
            ? item.width
            : str.length * fontHeight * 0.45;

          rawItems.push({
            str,
            x,
            y,
            width,
            height: fontHeight,
            hasEOL: Boolean(item.hasEOL),
          });
        }
      }

      const initialLines = groupItemsIntoLines(rawItems);

      // Ghi nhận các dòng ở 15% đầu trang hoặc 15% cuối trang để tìm chân tiêu đề lặp lại giữa các trang
      const seenOnThisPage = new Set<string>();
      for (const l of initialLines) {
        if (l.y < pageHeight * 0.15 || l.y > pageHeight * 0.85) {
          const sig = normalizeHeaderFooterSignature(l.text);
          if (sig.length >= 3 && !/^(?:phần|câu|bài)\b/i.test(sig)) {
            seenOnThisPage.add(sig);
          }
        }
      }
      seenOnThisPage.forEach(sig => {
        signaturePageCounts.set(sig, (signaturePageCounts.get(sig) || 0) + 1);
      });

      pageDataList.push({
        pageIndex: i,
        page,
        pageWidth,
        pageHeight,
        rawItems,
        initialLines,
      });
    }

    const repeatedSignatures = new Set<string>();
    signaturePageCounts.forEach((count, sig) => {
      if (count >= 2) {
        repeatedSignatures.add(sig);
      }
    });

    // Bước 2: Lọc bỏ chân tiêu đề / header / footer và trích xuất hình ảnh / đồ thị / bảng dữ liệu trên từng trang
    const pagesText: string[] = [];

    for (const pData of pageDataList) {
      const { pageIndex, page, pageWidth, pageHeight, rawItems, initialLines } = pData;
      if (rawItems.length === 0) continue;

      let contentMaxY = pageIndex === 1 ? pageHeight * 0.94 : pageHeight * 0.925;
      let contentMinY = pageHeight * 0.068;

      const questionBreakYs: number[] = [];

      for (const l of initialLines) {
        if (isQuestionStartLineText(l.text) || isSectionOrInstructionLineText(l.text)) {
          questionBreakYs.push(l.y);
        }
      }

      // Ở trang đầu tiên, không lấy logo/khung tiêu đề hành chính nằm phía trên dòng PHẦN I hoặc Câu 1 đầu tiên
      if (pageIndex === 1 && questionBreakYs.length > 0) {
        const highestQOrSectionY = Math.max(...questionBreakYs);
        contentMaxY = Math.min(pageHeight * 0.95, highestQOrSectionY + 14);
      }

      // Nếu trên trang có dòng "--- HẾT ---" hoặc "BẢNG ĐÁP ÁN", giới hạn vùng cắt hình ở phía trên dòng đó
      for (const l of initialLines) {
        if (/^(?:-+\s*H\s*Ế\s*T\s*-+|H\s*Ế\s*T\b|BẢNG\s*ĐÁP\s*ÁN|ĐÁP\s*ÁN\s*VÀ\s*HƯỚNG\s*DẪN)/i.test(l.text)) {
          if (l.y < contentMaxY - 40) {
            contentMinY = Math.max(contentMinY, l.y + 8);
          }
        }
      }

      // Trích xuất các đồ thị / hình vẽ / bảng dữ liệu trên trang này
      const pageFigures = await extractFiguresFromPdfPage(
        page,
        rawItems,
        initialLines,
        pageWidth,
        pageHeight,
        contentMinY,
        contentMaxY,
        questionBreakYs
      );

      // Tập hợp các item thuộc về dòng tiêu đề phần, dòng mở đầu câu hỏi ("Câu X.") hoặc dòng phương án ("A. B. C. D." / "a) b) c) d)")
      // Những item này được BẢO VỆ 100%, không bao giờ bị xóa!
      const protectedItems = new Set<PdfPositionedItem>();
      for (const l of initialLines) {
        if (
          isSectionOrInstructionLineText(l.text) ||
          isQuestionStartLineText(l.text) ||
          isOptionOrSolutionLineText(l.text)
        ) {
          for (const it of l.items) {
            protectedItems.add(it);
          }
        }
      }

      // Loại bỏ toàn bộ chữ nằm gọn bên trong hình vẽ / đồ thị / bảng dữ liệu đã cắt thành ảnh
      // (để chữ bên trong bảng dữ liệu hoặc nhãn trục đồ thị không bị lặp lại thành văn bản thô bên ngoài ảnh)
      const filteredItems = rawItems.filter(item => {
        const trimmed = item.str.trim();
        if (!trimmed) return false;
        if (protectedItems.has(item)) return true;

        const cx = item.x + item.width / 2;
        const cy = item.y + item.height / 3;
        const insideFigure = pageFigures.some(
          fig => cx >= fig.minX - 1 && cx <= fig.maxX + 1 && cy >= fig.minY - 1 && cy <= fig.maxY + 1
        );
        return !insideFigure;
      });

      // Dựng lại các dòng văn bản sau khi đã tách riêng phần chữ bên trong bảng/đồ thị
      const reconstructedLines = groupItemsIntoLines(filteredItems);

      // Lọc bỏ triệt để các dòng chân tiêu đề (page footers, running headers, tiêu đề phụ)
      const validLines: { y: number; text: string }[] = [];
      for (const l of reconstructedLines) {
        if (isHeaderOrFooterLine(l.text, l.y, pageHeight, pageIndex, pdf.numPages, repeatedSignatures)) {
          continue;
        }
        const cleanedText = stripInlineHeaderFooterArtifacts(l.text);
        if (!cleanedText) continue;
        if (isHeaderOrFooterLine(cleanedText, l.y, pageHeight, pageIndex, pdf.numPages, repeatedSignatures)) {
          continue;
        }
        validLines.push({ y: l.y, text: cleanedText });
      }

      // Chèn thẻ <img class="pdf-figure-img" src="..." /> vào ĐÚNG VỊ TRÍ ĐỊNH DẠNG của nó trong câu hỏi
      const combinedEntries: { y: number; text: string }[] = validLines.map(l => ({ y: l.y, text: l.text }));

      for (const fig of pageFigures) {
        // Tìm dòng 'Câu X.' mở đầu câu hỏi sở hữu hình này (nằm phía trên hoặc ngang đỉnh hình)
        const questionLinesAbove = validLines.filter(
          l => isQuestionStartLineText(l.text) && l.y >= fig.centerY - 14
        );
        const breakLinesBelow = validLines.filter(
          l => (isQuestionStartLineText(l.text) || isSectionOrInstructionLineText(l.text)) && l.y < fig.centerY - 14
        );

        let insertY = fig.centerY;

        if (questionLinesAbove.length > 0) {
          const ownerQuestionLine = questionLinesAbove[questionLinesAbove.length - 1];
          const nextBreakY = breakLinesBelow.length > 0 ? breakLinesBelow[0].y : 0;

          // Tìm các dòng phương án A. B. C. D. / a) b) c) d) hoặc Lời giải thuộc câu hỏi này
          const optionOrSolLinesInQuestion = validLines.filter(
            l =>
              l.y < ownerQuestionLine.y &&
              l.y > nextBreakY &&
              isOptionOrSolutionLineText(l.text)
          );

          const firstOptionOrSolY =
            optionOrSolLinesInQuestion.length > 0
              ? Math.max(...optionOrSolLinesInQuestion.map(l => l.y))
              : null;

          // Đảm bảo hình luôn nằm dưới dòng mở đầu 'Câu X.' và nằm TRƯỚC dòng phương án đầu tiên (A. / a))
          // Nếu câu hỏi có các dòng dẫn cả ở phía trên và phía dưới hình, fig.centerY sẽ giữ nguyên vị trí ở giữa 2 dòng dẫn đó!
          if (firstOptionOrSolY !== null) {
            insertY = Math.min(ownerQuestionLine.y - 0.5, Math.max(fig.centerY, firstOptionOrSolY + 0.5));
          } else {
            insertY = Math.min(ownerQuestionLine.y - 0.5, Math.max(fig.centerY, nextBreakY + 0.5));
          }
        }

        combinedEntries.push({
          y: insertY,
          text: `<img class="pdf-figure-img" src="${fig.dataUrl}" />`,
        });
      }

      combinedEntries.sort((a, b) => b.y - a.y);

      if (combinedEntries.length > 0) {
        pagesText.push(combinedEntries.map(e => e.text).join('\n'));
      }
    }

    const fullText = pagesText.join('\n').normalize('NFC');
    console.log("PDF extraction result length:", fullText.length);
    return sanitizeMathContent(fullText);
  } catch (error) {
    console.error("Lỗi khi đọc file PDF:", error);
    throw error;
  }
}

export async function parseDocFile(file: File): Promise<string> {
  const fileName = (file.name || '').toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // Kiểm tra chữ ký %PDF (0x25 0x50 0x44 0x46) ở đầu file (tối đa 1024 byte đầu)
  let isPdfHeader = false;
  for (let i = 0; i < Math.min(uint8.length - 4, 1024); i++) {
    if (uint8[i] === 0x25 && uint8[i + 1] === 0x50 && uint8[i + 2] === 0x44 && uint8[i + 3] === 0x46) {
      isPdfHeader = true;
      break;
    }
  }

  // 1. Nếu là file PDF: dùng trình đọc PDF.js chuyên dụng, KHÔNG BAO GIỜ fallback sang đọc text nhị phân!
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf' || isPdfHeader) {
    const pdfText = await parsePdfFileToText(arrayBuffer);
    if (pdfText && pdfText.trim().length > 0) {
      return pdfText;
    }
    throw new Error('FILE_PDF_UNREADABLE');
  }

  // 2. Kiểm tra chữ ký ZIP (PK\x03\x04 -> 0x50 0x4B 0x03 0x04) của file .docx chuẩn
  const isZipDocx =
    uint8.length > 4 &&
    uint8[0] === 0x50 &&
    uint8[1] === 0x4B &&
    uint8[2] === 0x03 &&
    uint8[3] === 0x04;

  // Kiểm tra chữ ký OLE2 Compound Document (0xD0 0xCF 0x11 0xE0) của file Word 97-2003 (.doc nhị phân cũ)
  const isOle2BinaryDoc =
    uint8.length > 8 &&
    uint8[0] === 0xD0 &&
    uint8[1] === 0xCF &&
    uint8[2] === 0x11 &&
    uint8[3] === 0xE0;

  if (isOle2BinaryDoc) {
    throw new Error('FILE_BINARY_DOC_LEGACY');
  }

  if (isZipDocx || fileName.endsWith('.docx')) {
    try {
      const html = await parseWordFileToHtml(arrayBuffer);
      if (html && html.trim().length > 0) {
        return html;
      }
    } catch (e) {
      console.warn("Mammoth parse failed:", e);
    }
  }

  // 3. Chỉ đọc dưới dạng HTML/Text nếu tệp thực sự là văn bản thuần hoặc HTML xuất từ hệ thống (không chứa byte nhị phân)
  const textDecoder = new TextDecoder('utf-8');
  const rawText = textDecoder.decode(arrayBuffer);

  // Kiểm tra tỷ lệ ký tự điều khiển / ký tự lỗi декод (U+FFFD) để chặn tuyệt đối rác nhị phân
  let badCharCount = 0;
  const sampleLen = Math.min(rawText.length, 4000);
  for (let i = 0; i < sampleLen; i++) {
    const code = rawText.charCodeAt(i);
    if (code === 0xFFFD || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      badCharCount++;
    }
  }

  if (sampleLen > 0 && badCharCount / sampleLen > 0.02) {
    throw new Error('FILE_UNSUPPORTED_BINARY');
  }

  if (/<html\b|<!DOCTYPE\s+html|<body\b|<div\b|<p\b[^>]*>/i.test(rawText)) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawText, 'text/html');
    doc.querySelectorAll('style, script, meta, link, title, xml').forEach(el => el.remove());

    doc.querySelectorAll('p, div, tr, li, h1, h2, h3, h4, h5, h6, br').forEach(el => {
      if (el.tagName.toLowerCase() === 'br') {
        el.replaceWith('\n');
      } else {
        el.append('\n');
      }
    });

    doc.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src.startsWith('data:image')) {
        img.replaceWith(`<img src="${src}" style="max-width: 100%; height: auto; display: inline-block; vertical-align: middle;" />`);
      } else {
        img.remove();
      }
    });

    doc.querySelectorAll('u').forEach(u => {
      u.replaceWith(`<u>${u.textContent}</u>`);
    });

    doc.querySelectorAll('span').forEach(span => {
      const style = (span.getAttribute('style') || '').toLowerCase();
      if (style.includes('underline')) {
        span.replaceWith(`<u>${span.textContent}</u>`);
      }
    });

    const extracted = doc.body.textContent || '';
    if (extracted.trim().length > 10) {
      return sanitizeMathContent(extracted);
    }
  }

  if (rawText.trim().length > 10) {
    return sanitizeMathContent(rawText);
  }

  throw new Error('FILE_UNSUPPORTED_OR_EMPTY');
}
