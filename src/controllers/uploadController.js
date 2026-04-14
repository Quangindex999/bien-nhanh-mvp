import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

/* ── Khởi tạo Gemini client ── */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/* ── System prompt: ép AI trả JSON thuần, không markdown ── */
const buildPrompt = (text) => `
Bạn là một chuyên gia giáo dục hàng đầu. Nhiệm vụ của bạn là phân tích nội dung tài liệu học tập dưới đây và tạo ra một bộ Flashcards chất lượng cao giúp người học ghi nhớ hiệu quả.

YÊU CẦU BẮT BUỘC:
1. Trả về DUY NHẤT một JSON object hợp lệ, KHÔNG có markdown, KHÔNG có \`\`\`json, KHÔNG có bất kỳ text nào bên ngoài JSON.
2. JSON phải tuân theo CHÍNH XÁC cấu trúc sau:
{
  "summaryStats": {
    "estimatedStudyTime": "<thời gian ước tính để học, ví dụ: 15 phút>",
    "difficultyScore": <điểm độ khó từ 1 đến 10>,
    "timeSaved": "<thời gian tiết kiệm so với đọc toàn bộ tài liệu>"
  },
  "flashcards": [
    {
      "id": 1,
      "front": "<câu hỏi ngắn gọn, rõ ràng>",
      "back": "<câu trả lời súc tích, dễ nhớ>"
    }
  ]
}
3. Tạo từ 5 đến 15 flashcards, ưu tiên các khái niệm cốt lõi.
4. Mỗi flashcard phải có "front" là câu hỏi và "back" là câu trả lời.
5. Viết bằng cùng ngôn ngữ với nội dung tài liệu.

NỘI DUNG TÀI LIỆU:
---
${text}
---
`;

/**
 * Nhận file PDF → bóc text → gửi Gemini AI → trả JSON Flashcards.
 */
export const handlePdfUpload = async (req, res, _next) => {
  try {
    const file = req?.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy file. Vui lòng upload một file PDF.',
      });
    }

    /* ── 1. Parse PDF buffer ── */
    const pdfData  = await pdfParse(file.buffer);
    const fullText = pdfData?.text?.trim() ?? '';

    if (!fullText) {
      return res.status(422).json({
        success: false,
        message: 'Không đọc được nội dung chữ từ file PDF này (có thể file chỉ chứa hình ảnh).',
      });
    }

    /* ── 2. TẠM THỜI: Dùng Mock Data thay cho Gemini AI ── */
    // Đã comment vòng lặp gọi AI để fix cứng mock data cho Frontend build
    const parsedData = {
      summaryStats: {
        estimatedStudyTime: "15 phút",
        difficultyScore: 6,
        timeSaved: "45 phút"
      },
      flashcards: [
        { id: 1, front: "Node.js là gì?", back: "Một môi trường runtime JavaScript đa nền tảng mã nguồn mở dựa trên V8 engine." },
        { id: 2, front: "Express.js là gì?", back: "Một framework web backend nhanh, linh hoạt và tối giản dành cho Node.js." },
        { id: 3, front: "Middleware trong Express là gì?", back: "Các hàm có quyền truy cập vào các đối tượng request (req), response (res), và hàm middleware tiếp theo (next)." }
      ]
    };

    /* ── 4. Trả kết quả về Frontend ── */
    return res.status(200).json({
      success: true,
      message: 'Tạo Flashcards thành công!',
      data: {
        fileName:   Buffer.from(file.originalname, 'latin1').toString('utf8'),
        totalPages: pdfData?.numpages ?? 0,
        totalChars: fullText.length,
        ...parsedData,
      },
    });

  } catch (error) {
    console.error('[uploadController] Error:', error?.message ?? error);

    /* ── Phân biệt loại lỗi ── */
    const msg = error?.message?.toLowerCase() ?? '';
    
    // Lỗi PDF có mật khẩu
    if (msg.includes('password')) {
      return res.status(422).json({
        success: false,
        message: 'File PDF này đã bị khóa bằng mật khẩu (Bảo mật). Vui lòng gỡ mật khẩu file hoặc tải lên một tài liệu khác.',
      });
    }

    const isPdfError = msg.includes('pdf');
    const isAiError  = msg.includes('api') || msg.includes('quota') || msg.includes('google') || msg.includes('429');

    if (isPdfError) {
      return res.status(422).json({
        success: false,
        message: 'File PDF không hợp lệ hoặc bị hỏng.',
      });
    }

    if (isAiError) {
      return res.status(503).json({
        success: false,
        message: 'Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi xử lý file.',
    });
  }
};
