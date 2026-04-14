/* ══════════════════════════════════════
   Biến Nhanh — Frontend Logic (ES6+)
   ══════════════════════════════════════ */

const $ = (sel) => document.querySelector(sel);

/* ── DOM refs ── */
const dropZone   = $('#dropZone');
const fileInput   = $('#fileInput');
const fileInfo    = $('#fileInfo');
const fileName    = $('#fileName');
const fileSize    = $('#fileSize');
const clearFile   = $('#clearFile');
const uploadBtn   = $('#uploadBtn');
const btnText     = $('#btnText');
const btnIconDef  = $('#btnIconDefault');
const btnSpinner  = $('#btnSpinner');
const resultCard  = $('#resultCard');
const resultMeta  = $('#resultMeta');
const resultPrev  = $('#resultPreview');
const errorCard   = $('#errorCard');
const errorMsg    = $('#errorMessage');

let selectedFile = null;

/* ══════════════════
   Helpers
   ══════════════════ */

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const hideAll = () => {
  resultCard.classList.add('hidden');
  errorCard.classList.add('hidden');
};

const setLoading = (loading) => {
  uploadBtn.disabled = loading;
  btnIconDef.classList.toggle('hidden', loading);
  btnSpinner.classList.toggle('hidden', !loading);
  btnText.textContent = loading ? 'Đang xử lý...' : 'Xử lý file';
};

const showFile = (file) => {
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileInfo.classList.remove('hidden');
  uploadBtn.disabled = false;
  hideAll();
};

const clearSelection = () => {
  selectedFile = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  uploadBtn.disabled = true;
  hideAll();
};

const renderBadge = (label, value, color = 'slate') => 
  `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-${color}-500/10 text-${color}-400 border border-${color}-500/10">
    <span class="font-medium">${label}:</span> ${value}
  </span>`;

/* ══════════════════
   Drag & Drop
   ══════════════════ */

['dragenter', 'dragover'].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  })
);

['dragleave', 'drop'].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  })
);

dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file?.type === 'application/pdf') {
    showFile(file);
  } else {
    clearSelection();
    errorMsg.textContent = 'Chỉ hỗ trợ file PDF. Vui lòng thử lại.';
    errorCard.classList.remove('hidden');
  }
});

/* ══════════════════
   Click to select
   ══════════════════ */

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) showFile(file);
});

clearFile.addEventListener('click', (e) => {
  e.stopPropagation();
  clearSelection();
});

/* ══════════════════
   Upload
   ══════════════════ */

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  hideAll();
  setLoading(true);

  try {
    const formData = new FormData();
    formData.append('pdfFile', selectedFile);

    const res  = await fetch('/api/upload', { method: 'POST', body: formData });
    const json = await res.json();

    if (!res.ok || !json?.success) {
      throw new Error(json?.message ?? 'Upload thất bại.');
    }

    const { data } = json;

    /* ── Render result ── */
    resultMeta.innerHTML = [
      renderBadge('File', data?.fileName ?? '—', 'brand'),
      renderBadge('Trang', data?.totalPages ?? 0, 'emerald'),
      renderBadge('Tổng ký tự', (data?.totalChars ?? 0).toLocaleString('vi-VN'), 'amber'),
    ].join('');

    resultPrev.textContent = data?.preview || '(Không có nội dung text)';
    resultCard.classList.remove('hidden');

  } catch (err) {
    errorMsg.textContent = err?.message ?? 'Đã xảy ra lỗi không xác định.';
    errorCard.classList.remove('hidden');
  } finally {
    setLoading(false);
  }
});
