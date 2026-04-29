import pdfParse from "pdf-parse-fork";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";
import { supabase } from "../config/supabase.js";

/* ── Khởi tạo Gemini client ── */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isGeminiQuotaError = (err) => {
  const message =
    `${err?.message ?? ""} ${err?.details ?? ""} ${JSON.stringify(err?.errorDetails ?? [])}`.toLowerCase();
  return (
    message.includes("429 too many requests") ||
    message.includes("quota exceeded") ||
    message.includes("free_tier") ||
    message.includes("rate limit") ||
    message.includes("retry in")
  );
};

const getRetryDelayMs = (err) => {
  const retryInfo = `${err?.message ?? ""}`.match(/retry in\s+([0-9.]+)s/i);
  if (retryInfo?.[1]) {
    const seconds = Number.parseFloat(retryInfo[1]);
    if (Number.isFinite(seconds) && seconds > 0)
      return Math.ceil(seconds * 1000);
  }
  return 0;
};

/**
 * Nhận file PDF → bóc text → gửi Gemini AI → trả JSON Flashcards.
 * Hỗ trợ Global Cache: Chia sẻ kết quả AI cho mọi User tải cùng 1 file.
 */
export const handlePdfUpload = async (req, res, _next) => {
  try {
    const file = req?.file;
    const { subjectId, userId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để sử dụng tính năng này.",
      });
    }

    const safeFileName = file
      ? Buffer.from(file.originalname, "latin1").toString("utf8")
      : "";

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy file. Vui lòng upload một file PDF.",
      });
    }

    /* ── Tạo mã vân tay (File Hash) ── */
    const fileHash = crypto
      .createHash("sha256")
      .update(file.buffer)
      .digest("hex");
    console.log(`- File Hash: ${fileHash} | User: ${userId}`);

    /* ── KIỂM TRA BỘ NHỚ ĐỆM TOÀN CẦU (GLOBAL CACHE) ── */
    try {
      // Tìm xem CÓ BẤT KỲ AI trên hệ thống từng tải file này chưa (Bỏ .eq('user_id'))
      const { data: globalCachedData, error: cacheError } = await supabase
        .from("study_materials")
        .select("*")
        .eq("file_hash", fileHash)
        .limit(1) // Chỉ cần lấy 1 bản ghi bất kỳ làm bản gốc
        .maybeSingle();

      if (!cacheError && globalCachedData) {
        console.log(
          "⚡ BẮT ĐƯỢC FILE GLOBAL TRÙNG! Đang nhân bản dữ liệu (0s)...",
        );

        const displayTitle =
          globalCachedData.document_title ||
          globalCachedData.file_name ||
          safeFileName;
        const cachedSummaryStats = globalCachedData.summary_stats ?? {};

        // 1. TẠO BẢN SAO: Dù lấy dữ liệu của người khác, vẫn phải tạo record mới cho User này
        // để họ lưu vào Môn học của riêng họ mà không ảnh hưởng tới người kia.
        const { error: cloneError } = await supabase
          .from("study_materials")
          .insert([
            {
              file_hash: fileHash,
              file_name: safeFileName, // Lấy tên file do user này tự đặt
              user_id: userId,
              subject_id: subjectId || null,
              document_title: displayTitle,
              summary_stats: cachedSummaryStats,
              flashcards: globalCachedData.flashcards,
              quizzes: globalCachedData.quizzes,
            },
          ]);

        if (cloneError)
          console.warn("- Lỗi khi nhân bản record:", cloneError.message);

        // 2. Trả kết quả ngay lập tức
        return res.status(200).json({
          success: true,
          message: "Tạo Flashcards thành công (từ Global Cache)!",
          data: {
            fileName: safeFileName,
            documentTitle: displayTitle,
            totalPages: cachedSummaryStats?.totalPages || 0,
            totalChars: 0,
            summaryStats: cachedSummaryStats,
            onePageSummary: cachedSummaryStats.onePageSummary ?? "",
            studyPlan: Array.isArray(cachedSummaryStats.studyPlan)
              ? cachedSummaryStats.studyPlan
              : [],
            flashcards: globalCachedData.flashcards,
            quizzes: globalCachedData.quizzes,
          },
        });
      }
    } catch (dbErr) {
      console.warn("- Cache miss hoặc file mới hoàn toàn.");
    }

    /* ── TỪ ĐÂY TRỞ XUỐNG LÀ XỬ LÝ FILE MỚI HOÀN TOÀN (GỌI GOOGLE AI) ── */
    let pdfData = null;
    let fullText = "";
    const isPdfFile =
      file.mimetype === "application/pdf" ||
      file.originalname?.toLowerCase().endsWith(".pdf");
    const isDocxFile =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname?.toLowerCase().endsWith(".docx");

    try {
      if (isPdfFile) {
        console.log("- Đang bắt đầu parse PDF...");
        pdfData = await pdfParse(file.buffer);
        fullText = pdfData?.text?.trim() ?? "";
      } else if (isDocxFile) {
        console.log("- Đang bắt đầu parse DOCX...");
        const docxResult = await mammoth.extractRawText({
          buffer: file.buffer,
        });
        fullText = docxResult?.value?.trim() ?? "";
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Định dạng file không được hỗ trợ. Chỉ chấp nhận PDF hoặc Word (.docx).",
        });
      }
    } catch (parseErr) {
      console.warn("[uploadController] Lỗi khi parse file:", parseErr?.message);
    }

    if (!fullText) {
      return res.status(422).json({
        success: false,
        message: isDocxFile
          ? "Không đọc được nội dung chữ từ file Word này để gửi cho AI."
          : "Không đọc được nội dung chữ từ file PDF này để gửi cho AI (có thể file chỉ chứa hình ảnh).",
      });
    }

    /* ── Gọi Gemini API ── */
    console.log("- File mới toàn cầu! Đang gửi prompt tới Gemini AI...");
    let parsedGeminiData = null;
    let attempt = 1;
    const MAX_RETRIES = 3;

    while (attempt <= MAX_RETRIES) {
      try {
        console.log(`- Request AI lần ${attempt}/${MAX_RETRIES}...`);
        // BẬT CHẾ ĐỘ ÉP BUỘC TRẢ VỀ JSON CHUẨN (Native JSON Mode)
        const result = await model.generateContent({
          contents: [
            { role: "user", parts: [{ text: buildPrompt(fullText) }] },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        });
        const aiResponse = result.response.text();

        // const jsonStr = aiResponse
        //   .replace(/```json/gi, "")
        //   .replace(/```/g, "")
        //   .trim();
        // parsedGeminiData = JSON.parse(jsonStr);
        // Vì đã ép JSON ở trên, giờ chỉ việc parse thẳng, bỏ luôn đống Regex cắt chuỗi lằng nhằng
        parsedGeminiData = JSON.parse(aiResponse);
        console.log("- Gemini trả về JSON hợp lệ!");
        break;
      } catch (err) {
        console.warn(`[Lần ${attempt}] Lỗi gọi Gemini:`, err?.message);
        if (isGeminiQuotaError(err)) {
          const delayMs = Math.max(getRetryDelayMs(err), 30_000);
          if (attempt < MAX_RETRIES) {
            console.warn(
              `- Phát hiện lỗi quota/rate limit. Đợi ${Math.ceil(delayMs / 1000)} giây trước khi thử lại...`,
            );
            await sleep(delayMs);
            attempt++;
            continue;
          }

          throw new Error(
            "Gemini đang hết quota hoặc bị giới hạn tạm thời. Vui lòng thử lại sau hoặc kiểm tra billing/quota của API key.",
          );
        }

        attempt++;
        if (attempt > MAX_RETRIES) {
          throw new Error(
            "Server AI đang tắc nghẽn, vui lòng thử lại sau giây lát.",
          );
        }
      }
    }

    const finalDocumentTitle = parsedGeminiData.documentTitle || safeFileName;
    const finalSummaryStats = {
      ...(parsedGeminiData.summaryStats ?? {}),
      onePageSummary: parsedGeminiData.onePageSummary ?? "",
      studyPlan: Array.isArray(parsedGeminiData.studyPlan)
        ? parsedGeminiData.studyPlan
        : [],
    };

    /* ── Lưu lại thành quả MỚI vào Supabase ── */
    try {
      const { error: insertError } = await supabase
        .from("study_materials")
        .insert([
          {
            file_hash: fileHash,
            file_name: safeFileName,
            user_id: userId,
            subject_id: subjectId || null,
            document_title: finalDocumentTitle,
            summary_stats: finalSummaryStats,
            flashcards: parsedGeminiData.flashcards,
            quizzes: parsedGeminiData.quizzes,
          },
        ]);

      if (insertError) {
        console.warn("- Lỗi khi lưu vào Supabase:", insertError.message);
      } else {
        console.log("- Đã lưu dữ liệu MỚI vào Supabase thành công!");
      }
    } catch (saveErr) {
      console.warn("- Lỗi Exception khi lưu Supabase:", saveErr.message);
    }

    /* ── Trả kết quả về Frontend ── */
    return res.status(200).json({
      success: true,
      message: "Tạo Flashcards thành công!",
      data: {
        fileName: safeFileName,
        documentTitle: finalDocumentTitle,
        totalPages: pdfData?.numpages || 0,
        totalChars: fullText.length,
        summaryStats: finalSummaryStats,
        onePageSummary: parsedGeminiData.onePageSummary ?? "",
        studyPlan: Array.isArray(parsedGeminiData.studyPlan)
          ? parsedGeminiData.studyPlan
          : [],
        flashcards: parsedGeminiData.flashcards,
        quizzes: parsedGeminiData.quizzes,
      },
    });
  } catch (error) {
    console.error("[uploadController] Error:", error?.message ?? error);

    if (error?.message?.toLowerCase().includes("password")) {
      return res
        .status(422)
        .json({ success: false, message: "File PDF bị khóa mật khẩu." });
    }

    if (isGeminiQuotaError(error)) {
      return res.status(429).json({
        success: false,
        message:
          "Gemini hiện đã hết quota hoặc đang bị giới hạn tạm thời. Vui lòng thử lại sau hoặc kiểm tra billing/quota của API key.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error?.message || "Đã xảy ra lỗi khi xử lý file.",
    });
  }
};
