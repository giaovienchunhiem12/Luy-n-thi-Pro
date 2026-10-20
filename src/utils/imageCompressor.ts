/**
 * Tiện ích nén và tối ưu hóa hình ảnh Base64
 * Giúp giảm kích thước tài liệu Firestore xuống dưới giới hạn 1MB (1,048,576 bytes)
 */

/**
 * Nén một chuỗi Base64 Data URI bằng Canvas (Browser environment)
 */
export async function compressBase64Image(
  dataUri: string,
  maxWidth = 800,
  maxHeight = 600,
  quality = 0.75
): Promise<string> {
  if (!dataUri || !dataUri.startsWith('data:image')) {
    return dataUri;
  }

  // Nếu không ở môi trường trình duyệt có document/window
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return dataUri;
  }

  // Nếu chuỗi base64 đã rất nhỏ (dưới 4KB), không cần nén thêm
  if (dataUri.length < 4000) {
    return dataUri;
  }

  return new Promise((resolve) => {
    const img = new Image();
    // Tránh lỗi timeout hoặc treo nếu ảnh hỏng
    const timer = setTimeout(() => {
      resolve(dataUri);
    }, 4000);

    img.onload = () => {
      clearTimeout(timer);
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          return resolve(dataUri);
        }

        // Kiểm tra xem có phải ảnh công thức toán inline nhỏ không (tỉ lệ nhỏ hoặc chiều cao nhỏ)
        const isInlineFormula = height <= 120 || (width / height > 3 && height <= 200);
        const targetMaxWidth = isInlineFormula ? 500 : maxWidth;
        const targetMaxHeight = isInlineFormula ? 80 : maxHeight;

        // Tính toán tỉ lệ co dãn
        if (width > targetMaxWidth || height > targetMaxHeight) {
          const ratio = Math.min(targetMaxWidth / width, targetMaxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(dataUri);
        }

        // Vẽ nền mờ/trong suốt nếu có
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Thử xuất dạng WebP (nén rất tốt và hỗ trợ trong suốt)
        let compressed = '';
        try {
          compressed = canvas.toDataURL('image/webp', quality);
        } catch {
          // Fallback sang jpeg
          compressed = canvas.toDataURL('image/jpeg', quality);
        }

        // Nếu chuỗi nén mới nhỏ hơn chuỗi cũ, sử dụng chuỗi mới
        if (compressed && compressed.length > 50 && compressed.length < dataUri.length) {
          resolve(compressed);
        } else {
          resolve(dataUri);
        }
      } catch (err) {
        console.warn('Lỗi nén ảnh canvas:', err);
        resolve(dataUri);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(dataUri);
    };

    img.src = dataUri;
  });
}

/**
 * Quét và nén tất cả các ảnh Base64 có trong chuỗi HTML
 */
export async function compressHtmlImages(html: string): Promise<string> {
  if (!html || !html.includes('data:image')) {
    return html;
  }

  const base64Regex = /src=["'](data:image\/[^;]+;base64,[^"']+)["']/g;
  const matches = Array.from(html.matchAll(base64Regex));

  if (matches.length === 0) {
    return html;
  }

  let result = html;
  for (const match of matches) {
    const originalSrc = match[1];
    const compressedSrc = await compressBase64Image(originalSrc);
    if (compressedSrc !== originalSrc) {
      result = result.replace(originalSrc, compressedSrc);
    }
  }

  return result;
}

/**
 * Nén toàn bộ hình ảnh trong danh sách câu hỏi trước khi lưu vào Firestore
 */
export async function compressExamQuestions(questions: any[]): Promise<any[]> {
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return questions;
  }

  const processedQuestions = await Promise.all(
    questions.map(async (q) => {
      const updated = { ...q };

      // Nén ảnh đính kèm imageUrl nếu có
      if (updated.imageUrl && updated.imageUrl.startsWith('data:image')) {
        updated.imageUrl = await compressBase64Image(updated.imageUrl, 800, 600, 0.75);
      }

      // Nén ảnh inline trong nội dung câu hỏi
      if (updated.questionText && updated.questionText.includes('data:image')) {
        updated.questionText = await compressHtmlImages(updated.questionText);
      }

      // Nén ảnh trong các phương án
      if (Array.isArray(updated.options)) {
        updated.options = await Promise.all(
          updated.options.map(async (opt: string) => {
            if (opt && opt.includes('data:image')) {
              return await compressHtmlImages(opt);
            }
            return opt;
          })
        );
      }

      // Nén ảnh trong lời giải chi tiết
      if (updated.solution && updated.solution.includes('data:image')) {
        updated.solution = await compressHtmlImages(updated.solution);
      }

      return updated;
    })
  );

  return processedQuestions;
}

/**
 * Tính toán dung lượng xấp xỉ của object JSON (tính bằng byte UTF-8)
 */
export function estimateObjectSizeBytes(obj: any): number {
  try {
    const jsonStr = JSON.stringify(obj);
    return new TextEncoder().encode(jsonStr).length;
  } catch {
    return 0;
  }
}
