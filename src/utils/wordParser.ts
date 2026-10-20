// @ts-ignore
import mammoth from "mammoth";
// @ts-ignore
import JSZip from 'jszip';

import { sanitizeMathContent } from './mathSanitizer';

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
