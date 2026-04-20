import pdfParse from 'pdf-parse-fork';
import mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import { supabase } from '../config/supabase.js';

/* ── Khởi tạo Gemini client ── */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/* ── System prompt: ép AI trả JSON thuần, không markdown ── */
const buildPrompt = (text) => `
Bạn là một chuyên gia giáo dục hàng đầu. Nhiệm vụ của bạn là phân tích nội dung tài liệu học tập dưới đây và tạo ra một bộ Flashcards, Câu hỏi Trắc nghiệm, Tóm tắt 1 trang và Kế hoạch ôn thi chất lượng cao giúp người học ghi nhớ hiệu quả.

YÊU CẦU BẮT BUỘC:
1. Trả về DUY NHẤT một JSON object hợp lệ, KHÔNG có markdown, KHÔNG có \`\`\`json, KHÔNG có bất kỳ text nào bên ngoài JSON.
2. JSON phải tuân theo CHÍNH XÁC cấu trúc sau:
{
  "documentTitle": "<Tiêu đề tài liệu chuẩn Tiếng Việt, tự trích xuất từ nội dung>",
  "summaryStats": {
    "estimatedStudyTime": "<thời gian ước tính để học, ví dụ: 15 phút>",
    "difficultyScore": <điểm độ khó từ 1 đến 10>,
    "timeSaved": "<thời gian tiết kiệm so với đọc toàn bộ tài liệu>"
  },
  "onePageSummary": "<Một đoạn tóm tắt 1 trang, có thể dùng markdown cơ bản như in đậm và gạch đầu dòng. Tập trung vào ý cốt lõi nhất của tài liệu>",
  "studyPlan": [
    {
      "day": 1,
      "title": "<Tên chủ đề/ngày ôn tập>",
      "tasks": ["<Việc 1>", "<Việc 2>"]
    }
  ],
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
8. Tạo onePageSummary súc tích, dễ đọc, có thể dùng markdown cơ bản.
9. Tạo studyPlan gồm từ 3 đến 7 ngày, số ngày phụ thuộc vào độ dài và độ phức tạp của tài liệu.
10. Mỗi phần trong studyPlan phải có day, title và tasks (mảng nhiệm vụ ngắn gọn, thực tế).
11. Viết bằng cùng ngôn ngữ với nội dung tài liệu.

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

    /* ── Tạo mã vân tay (File Hash) ── */
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    console.log(`- File Hash: ${fileHash}`);

    /* ── Kiểm tra "Trí nhớ" (Check Supabase Cache) ── */
    try {
      const { data: cachedData, error: cacheError } = await supabase
        .from('study_materials')
        .select('*')
        .eq('file_hash', fileHash)
        .single();
        
      if (!cacheError && cachedData) {
        console.log('- Dữ liệu lấy từ Supabase Cache');
        
        // Đảm bảo sử dụng document_title để tránh lệch schema
        const displayTitle = cachedData.document_title || cachedData.file_name || safeFileName;
        const cachedSummaryStats = cachedData.summary_stats ?? {};
        
        return res.status(200).json({
          success: true,
          message: 'Tạo Flashcards thành công (từ Cache)!',
          data: {
            fileName: safeFileName,
            documentTitle: displayTitle,
            totalPages: cachedSummaryStats?.totalPages || 0,
            totalChars: 0,
            summaryStats: cachedSummaryStats,
            onePageSummary: cachedSummaryStats.onePageSummary ?? '',
            studyPlan: Array.isArray(cachedSummaryStats.studyPlan) ? cachedSummaryStats.studyPlan : [],
            flashcards: cachedData.flashcards,
            quizzes: cachedData.quizzes
          }
        });
      }
    } catch (dbErr) {
      console.warn('- Lỗi khi check cache Supabase:', dbErr.message);
    }

    /* ── 1. Parse file buffer ── */
    let pdfData = null;
    let fullText = '';
    const isPdfFile = file.mimetype === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf');
    const isDocxFile = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.originalname?.toLowerCase().endsWith('.docx');

    try {
      if (isPdfFile) {
        console.log('- Đang bắt đầu parse PDF...');
        pdfData = await pdfParse(file.buffer);
        fullText = pdfData?.text?.trim() ?? '';
      } else if (isDocxFile) {
        console.log('- Đang bắt đầu parse DOCX...');
        const docxResult = await mammoth.extractRawText({ buffer: file.buffer });
        fullText = docxResult?.value?.trim() ?? '';
      } else {
        return res.status(400).json({
          success: false,
          message: 'Định dạng file không được hỗ trợ. Chỉ chấp nhận PDF hoặc Word (.docx).',
        });
      }
    } catch (parseErr) {
      console.warn('[uploadController] Lỗi khi parse file:', parseErr?.message);
    }
    console.log('- Nội dung text lấy được (10 ký tự đầu):', fullText.substring(0, 10));

    if (!fullText) {
      return res.status(422).json({
        success: false,
        message: isDocxFile
          ? 'Không đọc được nội dung chữ từ file Word này để gửi cho AI.'
          : 'Không đọc được nội dung chữ từ file PDF này để gửi cho AI (có thể file chỉ chứa hình ảnh).',
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

        const jsonStr = aiResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
          parsedGeminiData = JSON.parse(jsonStr);
        } catch (parseErr) {
          throw new Error(`AI trả về JSON không hợp lệ: ${parseErr.message}`);
        }

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

    const finalDocumentTitle = parsedGeminiData.documentTitle || safeFileName;
    const finalSummaryStats = {
      ...(parsedGeminiData.summaryStats ?? {}),
      onePageSummary: parsedGeminiData.onePageSummary ?? '',
      studyPlan: Array.isArray(parsedGeminiData.studyPlan) ? parsedGeminiData.studyPlan : [],
    };

    /* ── 3. Lưu lại thành quả (Save to Supabase) ── */
    try {
      const { error: upsertError } = await supabase
        .from('study_materials')
        .upsert({
          file_hash: fileHash,
          file_name: safeFileName,
          document_title: finalDocumentTitle,
          summary_stats: finalSummaryStats,
          flashcards: parsedGeminiData.flashcards,
          quizzes: parsedGeminiData.quizzes
        }, { onConflict: 'file_hash' });

      if (upsertError) {
        console.warn('- Lỗi khi lưu vào Supabase:', upsertError.message);
      } else {
        console.log('- Đã lưu dữ liệu vào Supabase thành công!');
      }
    } catch (saveErr) {
      console.warn('- Lỗi Exception khi lưu Supabase:', saveErr.message);
    }

    /* ── 4. Trả kết quả về Frontend ── */
    return res.status(200).json({
      success: true,
      message: 'Tạo Flashcards thành công!',
      data: {
        fileName: safeFileName,
        documentTitle: finalDocumentTitle,
        totalPages: pdfData?.numpages || 0,
        totalChars: fullText.length,
        summaryStats: finalSummaryStats,
        onePageSummary: parsedGeminiData.onePageSummary ?? '',
        studyPlan: Array.isArray(parsedGeminiData.studyPlan) ? parsedGeminiData.studyPlan : [],
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
