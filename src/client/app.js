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
const flashcardsContainer = $('#flashcardsContainer');
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
    const stats = data?.summaryStats || {};
    resultMeta.innerHTML = [
      renderBadge('File', data?.fileName ?? '—', 'brand'),
      renderBadge('Thời gian học', stats.estimatedStudyTime ?? '—', 'emerald'),
      renderBadge('Độ khó', `${stats.difficultyScore ?? 0}/10`, 'amber'),
      renderBadge('Tiết kiệm', stats.timeSaved ?? '—', 'purple'),
    ].join('');

    // Clear previous
    flashcardsContainer.innerHTML = '';
    
    // Render Flashcards
    const flashcards = data?.flashcards || [];
    if (flashcards.length === 0) {
      flashcardsContainer.innerHTML = '<p class="text-slate-400 text-sm">Không tạo được flashcard nào.</p>';
    } else {
      flashcards.forEach(card => {
        const cardHtml = `
          <div class="perspective-1000 w-full h-48 cursor-pointer group">
            <div class="flashcard-inner w-full h-full rounded-2xl shadow-lg ring-1 ring-white/10 group-hover:ring-brand-500/50 transition-all duration-300">
              
              <!-- Mặt trước (Câu hỏi) -->
              <div class="flashcard-face flashcard-front bg-slate-800/80 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                <span class="absolute top-3 left-4 text-xs font-semibold text-brand-400">Q.${card.id}</span>
                <h4 class="text-sm sm:text-base font-semibold text-slate-200 px-2">${card.front}</h4>
                <p class="absolute bottom-3 text-[10px] text-slate-500 uppercase tracking-widest">Click để lật</p>
              </div>

              <!-- Mặt sau (Câu trả lời) -->
              <div class="flashcard-face flashcard-back bg-brand-900/40 rounded-2xl p-6 flex flex-col justify-center items-center text-center border border-brand-500/20">
                <span class="absolute top-3 left-4 text-xs font-semibold text-emerald-400">A.${card.id}</span>
                <div class="w-full h-full pt-4 flex items-center justify-center overflow-y-auto">
                  <p class="text-[13px] sm:text-sm font-medium text-slate-200 leading-relaxed px-1 m-auto">${card.back}</p>
                </div>
              </div>

            </div>
          </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHtml.trim();
        const cardElement = tempDiv.firstChild;
        
        // Add click listener for flip
        cardElement.addEventListener('click', function() {
          const inner = this.querySelector('.flashcard-inner');
          inner.classList.toggle('flipped');
        });

        flashcardsContainer.appendChild(cardElement);
      });
    }

    resultCard.classList.remove('hidden');

  } catch (err) {
    errorMsg.textContent = err?.message ?? 'Đã xảy ra lỗi không xác định.';
    errorCard.classList.remove('hidden');
  } finally {
    setLoading(false);
  }
});
