import { escapeHtml } from '../utils.js';

export const renderFlashcard = (card, index) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'flashcard-wrapper shrink-0 w-[85vw] sm:w-auto snap-center';
  wrapper.dataset.cardId = String(card.id ?? index);
  wrapper.style.animationDelay = `${index * 80}ms`;

  wrapper.innerHTML = `
    <div class="perspective-card relative">
      <div class="flashcard-inner">
        <div class="flashcard-face flashcard-front p-4 sm:p-6">
          <span class="card-badge card-badge-q text-[10px] sm:text-xs px-2.5 py-1">Q.${card.id}</span>
          <div class="card-content">
            <h4 class="card-question text-base sm:text-lg">${escapeHtml(card.front)}</h4>
          </div>
          <span class="card-hint text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
            <svg class="w-3 h-3 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
            Lật thẻ
          </span>
        </div>

        <div class="flashcard-face flashcard-back p-4 sm:p-6">
          <span class="card-badge card-badge-a text-[10px] sm:text-xs px-2.5 py-1">A.${card.id}</span>
          <div class="card-content overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <h4 class="card-answer text-base sm:text-lg font-medium text-slate-700 dark:text-slate-200">${escapeHtml(card.back)}</h4>
          </div>
        </div>
      </div>
    </div>
  `;

  wrapper.addEventListener('click', () => {
    const inner = wrapper.querySelector('.flashcard-inner');
    inner?.classList.toggle('flipped');
  });

  return wrapper;
};
