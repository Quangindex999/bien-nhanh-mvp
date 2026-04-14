import pdfParse from 'pdf-parse';

/**
 * Nhận file PDF từ Multer (MemoryStorage), trích xuất text,
 * trả về 100 ký tự đầu tiên để test luồng dữ liệu.
 */
export const handlePdfUpload = async (req, res, next) => {
  try {
    const file = req?.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy file. Vui lòng upload một file PDF.',
      });
    }

    /* ── Parse PDF buffer ── */
    const pdfData  = await pdfParse(file.buffer);
    const fullText = pdfData?.text ?? '';

    /* ── Trích 100 ký tự đầu ── */
    const preview = fullText.slice(0, 100).trim();

    return res.status(200).json({
      success: true,
      message: 'Đọc PDF thành công!',
      data: {
        fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        totalPages: pdfData?.numpages ?? 0,
        totalChars: fullText.length,
        preview,
      },
    });
  } catch (error) {
    console.error('[uploadController] Error:', error?.message ?? error);

    /* ── Phân biệt lỗi do file hỏng vs lỗi hệ thống ── */
    const isPdfError = error?.message?.toLowerCase()?.includes('pdf');

    return res.status(isPdfError ? 422 : 500).json({
      success: false,
      message: isPdfError
        ? 'File PDF không hợp lệ hoặc bị hỏng.'
        : 'Đã xảy ra lỗi khi xử lý file.',
    });
  }
};
