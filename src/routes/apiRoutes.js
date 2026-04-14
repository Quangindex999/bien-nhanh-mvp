import { Router } from 'express';
import multer from 'multer';
import { handlePdfUpload } from '../controllers/uploadController.js';

const router  = Router();

/* ── Multer – lưu file vào bộ nhớ (MemoryStorage) ── */
const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf';
    cb(isPdf ? null : new Error('Chỉ chấp nhận file PDF!'), isPdf);
  },
});

/* ── POST /api/upload ── */
router.post('/upload', upload.single('pdfFile'), handlePdfUpload);

export default router;
