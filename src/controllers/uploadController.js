import pdfParse from 'pdf-parse-fork';
import { GoogleGenerativeAI } from '@google/generative-ai';

/* ── Khởi tạo Gemini client ── */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/* ── System prompt: ép AI trả JSON thuần, không markdown ── */
const buildPrompt = (text) => `
Bạn là một chuyên gia giáo dục hàng đầu. Nhiệm vụ của bạn là phân tích nội dung tài liệu học tập dưới đây và tạo ra một bộ Flashcards và Câu hỏi Trắc nghiệm chất lượng cao giúp người học ghi nhớ hiệu quả.

YÊU CẦU BẮT BUỘC:
1. Trả về DUY NHẤT một JSON object hợp lệ, KHÔNG có markdown, KHÔNG có \`\`\`json, KHÔNG có bất kỳ text nào bên ngoài JSON.
2. JSON phải tuân theo CHÍNH XÁC cấu trúc sau:
{
  "documentTitle": "<Tiêu đề chính của tài liệu, tự trích xuất từ nội dung>",
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
  ],
  "quizzes": [
    {
      "id": 1,
      "question": "Câu hỏi trắc nghiệm...",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctAnswer": "Đáp án A",
      "explanation": "Giải thích ngắn gọn tại sao A đúng..."
    }
  ]
}
3. "documentTitle" phải được trích xuất một cách thông minh từ tiêu đề chính hoặc nội dung quan trọng nhất của tài liệu.
4. Tạo từ 5 đến 15 flashcards, ưu tiên các khái niệm cốt lõi.
5. Mỗi flashcard phải có "front" là câu hỏi và "back" là câu trả lời.
6. Tạo từ 5 đến 10 câu trắc nghiệm (quizzes) chất lượng.
7. Options trong quizzes phải gồm 4 lựa chọn, correctAnswer phải khớp HOÀN TOÀN với 1 trong 4 lựa chọn đó.
8. Viết bằng cùng ngôn ngữ với nội dung tài liệu.

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
    
    // Fix encoding for Vietnamese filename
    const safeFileName = file ? Buffer.from(file.originalname, 'latin1').toString('utf8') : '';

    console.log("=== KIỂM TRA FILE UPLOAD ===");
    console.log("- Tên file (đã fix code):", safeFileName);
    console.log("- Dung lượng:", file?.size, "bytes");
    console.log("- Mimetype:", file?.mimetype);

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy file. Vui lòng upload một file PDF.',
      });
    }

    /* ── 1. Parse PDF buffer ── */
    console.log('- Đang bắt đầu parse PDF...');
    let pdfData = null;
    let fullText = '';
    try {
      pdfData = await pdfParse(file.buffer);
      fullText = pdfData?.text?.trim() ?? '';
    } catch (parseErr) {
      console.warn('[uploadController] pdf-parse gặp lỗi, tiếp tục với mock data:', parseErr?.message);
    }
    console.log('- Nội dung text lấy được (10 ký tự đầu):', fullText.substring(0, 10));

    if (!fullText) {
      return res.status(422).json({
        success: false,
        message: 'Không đọc được nội dung chữ từ file PDF này để gửi cho AI (có thể file chỉ chứa hình ảnh).',
      });
    }

    /* ── 2. Kích hoạt Gemini API ── */
    console.log('- Đang gửi prompt tới Gemini AI...');
    let parsedGeminiData = null;
    let attempt = 1;
    const MAX_RETRIES = 3;

    while (attempt <= MAX_RETRIES) {
      try {
        console.log(`- Request AI lần ${attempt}/${MAX_RETRIES}...`);
        const result = await model.generateContent(buildPrompt(fullText));
        const aiResponse = result.response.text();
        
        let jsonStr = aiResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedGeminiData = JSON.parse(jsonStr);
        console.log('- Gemini trả về JSON hợp lệ!');
        break; 
      } catch (err) {
        console.warn(`[Lần ${attempt}] Lỗi gọi Gemini hoặc parse JSON:`, err?.message);
        attempt++;
        if (attempt > MAX_RETRIES) {
          throw new Error('Không thể tạo Flashcards sau nhiều lần thử với AI.');
        }
      }
    }

    /* ── 3. Trả kết quả về Frontend ── */
    return res.status(200).json({
      success: true,
      message: 'Tạo Flashcards thành công!',
      data: {
        fileName: safeFileName,
        documentTitle: parsedGeminiData.documentTitle || null,
        totalPages: pdfData?.numpages || 0,
        totalChars: fullText.length,
        summaryStats: parsedGeminiData.summaryStats,
        flashcards: parsedGeminiData.flashcards,
        quizzes: parsedGeminiData.quizzes
      }
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
