/* ══════════════════════════════════════
   Biến Nhanh — Frontend Logic (ES6+)
   Complete overhaul: Flashcard rendering + 3D Flip
   ══════════════════════════════════════ */

const $ = (sel) => document.querySelector(sel);

/* ── DOM refs ── */
const dropZone          = $('#dropZone');
const fileInput         = $('#fileInput');
const fileInfo          = $('#fileInfo');
const fileName          = $('#fileName');
const fileSize          = $('#fileSize');
const clearFile         = $('#clearFile');
const uploadBtn         = $('#uploadBtn');
const btnText           = $('#btnText');
const btnIconDef        = $('#btnIconDefault');
const btnSpinner        = $('#btnSpinner');
const resultSection     = $('#resultSection');
const resultFileName    = $('#resultFileName');
const statsBadges       = $('#statsBadges');
const cardCount         = $('#cardCount');
const flashcardsGrid    = $('#flashcardsGrid');
const errorCard         = $('#errorCard');
const errorMsg          = $('#errorMessage');

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
  resultSection.classList.add('hidden');
  errorCard.classList.add('hidden');
};

const setLoading = (loading) => {
  uploadBtn.disabled = loading;
  btnIconDef.classList.toggle('hidden', loading);
  btnSpinner.classList.toggle('hidden', !loading);
  btnText.textContent = loading ? 'Đang phân tích...' : 'Tạo Flashcards';
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

/* ══════════════════
   Stats Badge Renderer
   ══════════════════ */

const STAT_CONFIG = [
  {
    key: 'totalCards',
    label: 'Số thẻ',
    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z"/></svg>`,
    colorClass: 'brand',
  },
  {
    key: 'estimatedStudyTime',
    label: 'Thời gian học',
    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    colorClass: 'emerald',
  },
  {
    key: 'difficultyScore',
    label: 'Độ khó',
    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`,
    colorClass: 'amber',
  },
  {
    key: 'timeSaved',
    label: 'Tiết kiệm',
    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>`,
    colorClass: 'purple',
  },
];

const renderStatBadge = (config, value) => `
  <div class="stat-badge relative overflow-hidden bg-${config.colorClass}-500/[0.07] border border-${config.colorClass}-500/15 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-${config.colorClass}-500/[0.12] transition-colors duration-300">
    <div class="w-8 h-8 rounded-lg bg-${config.colorClass}-500/15 flex items-center justify-center text-${config.colorClass}-400 shrink-0">
      ${config.icon}
    </div>
    <div class="min-w-0">
      <p class="text-[11px] font-medium text-slate-500 uppercase tracking-wider">${config.label}</p>
      <p class="text-sm font-bold text-${config.colorClass}-300 mt-0.5 truncate">${value}</p>
    </div>
  </div>
`;

/* ══════════════════
   Flashcard Renderer
   ══════════════════ */

const renderFlashcard = (card, index) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'flashcard-wrapper';
  wrapper.style.animationDelay = `${index * 80}ms`;

  wrapper.innerHTML = `
    <div class="perspective-card">
      <div class="flashcard-inner">

        <!-- Mặt trước (Câu hỏi) -->
        <div class="flashcard-face flashcard-front">
          <span class="card-badge card-badge-q">Q.${card.id}</span>
          <div class="card-content">
            <h4 class="card-question">${card.front}</h4>
          </div>
          <span class="card-hint">
            <svg class="w-3 h-3 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
            Lật thẻ
          </span>
        </div>

        <!-- Mặt sau (Câu trả lời) -->
        <div class="flashcard-face flashcard-back">
          <span class="card-badge card-badge-a">A.${card.id}</span>
          <div class="card-content card-content-back">
            <p class="card-answer">${card.back}</p>
          </div>
          <span class="card-hint card-hint-back">
            <svg class="w-3 h-3 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
            Lật lại
          </span>
        </div>

      </div>
    </div>
  `;

  // Click to flip
  wrapper.addEventListener('click', () => {
    const inner = wrapper.querySelector('.flashcard-inner');
    inner.classList.toggle('flipped');
  });

  return wrapper;
};

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
   Upload & Render
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

    console.log('[Biến Nhanh] Response:', json);

    if (!res.ok || !json?.success) {
      throw new Error(json?.message ?? 'Upload thất bại.');
    }

    /* ── Lấy dữ liệu từ response ── */
    const data = json.data;
    if (!data) {
      throw new Error('Response không chứa dữ liệu.');
    }

    const flashcards = data.flashcards || [];
    const stats = data.summaryStats || {};

    if (flashcards.length === 0) {
      throw new Error('AI không tạo được flashcard nào từ nội dung PDF này.');
    }

    /* ── 1. Render file name ── */
    resultFileName.textContent = data.fileName ? `Từ: ${data.fileName}` : '';

    /* ── 2. Render Stats Badges ── */
    const statsValues = {
      totalCards: `${flashcards.length} thẻ`,
      estimatedStudyTime: stats.estimatedStudyTime ?? '—',
      difficultyScore: stats.difficultyScore != null ? `${stats.difficultyScore}/10` : '—',
      timeSaved: stats.timeSaved ?? '—',
    };

    statsBadges.innerHTML = STAT_CONFIG
      .map(cfg => renderStatBadge(cfg, statsValues[cfg.key]))
      .join('');

    /* ── 3. Render Flashcards ── */
    cardCount.textContent = flashcards.length;
    flashcardsGrid.innerHTML = '';

    flashcards.forEach((card, index) => {
      const el = renderFlashcard(card, index);
      flashcardsGrid.appendChild(el);
    });

    /* ── 4. Show result ── */
    resultSection.classList.remove('hidden');

    // Scroll to results smoothly
    setTimeout(() => {
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

  } catch (err) {
    console.error('[Biến Nhanh] Error:', err);
    errorMsg.textContent = err?.message ?? 'Đã xảy ra lỗi không xác định.';
    errorCard.classList.remove('hidden');
  } finally {
    setLoading(false);
  }
});
