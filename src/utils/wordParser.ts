import { Buffer } from 'buffer';
// @ts-ignore
import mammoth from "mammoth";
// @ts-ignore
import JSZip from 'jszip';
// @ts-ignore
import { GlobalWorkerOptions, getDocument, version as pdfjsVersion } from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure matching worker
const currentPdfjsVersion = pdfjsVersion || '6.4.299';
GlobalWorkerOptions.workerSrc = pdfWorker || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${currentPdfjsVersion}/build/pdf.worker.min.mjs`;

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

/**
 * Hàm đọc file PDF và trích xuất nội dung văn bản
 */
export async function parsePdfFileToText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const version = pdfjsVersion || '6.4.299';
    GlobalWorkerOptions.workerSrc = pdfWorker || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let pageText = "";
      let lastY: number | null = null;
      for (const item of content.items) {
        if ('str' in item) {
          const currentY = Array.isArray(item.transform) ? item.transform[5] : null;
          if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
            pageText += "\n";
          } else if (item.hasEOL) {
            pageText += "\n";
          } else if (pageText && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
            pageText += " ";
          }
          pageText += item.str;
          lastY = currentY;
        }
      }
      text += pageText + "\n\n";
    }
    console.log("PDF extraction result length:", text.length);
    return sanitizeMathContent(text);
  } catch (error) {
    console.error("Lỗi khi đọc file PDF:", error);
    throw error;
  }
}
