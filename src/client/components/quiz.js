import supabase from '../supabaseClient.js';
import { state } from '../store.js';
import { formatQuizTime, calculateQuizScore } from '../utils.js';

const QUIZ_CLASS_MAP = {
  card: 'bg-white border-gray-300 text-gray-900 shadow-sm hover:border-emerald-400/40 dark:bg-white/5 dark:border-white/10 dark:text-slate-100 dark:shadow-lg dark:shadow-black/20',
  explanation:
    'bg-gray-50 border-gray-300 text-gray-800 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-slate-300',
  option:
    'bg-white border-gray-300 text-slate-700 hover:bg-gray-50 hover:border-emerald-400/50 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:border-emerald-500/50',
  correct:
    'bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300',
  wrong: 'bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300',
};

let quizHeader = null;
let quizSubmitBtn = null;
let quizRetakeBtn = null;
let quizTimeEl = null;
let quizScoreEl = null;

const getQuizContainer = () => document.querySelector('#quizContainer');
const getQuizList = () => document.querySelector('#quizList');

export const resetQuizState = () => {
  state.userAnswers = {};
  state.currentQuizzes = [];
  state.isQuizSubmitted = false;
  state.quizSeconds = 0;
  if (state.quizTimer) {
    clearInterval(state.quizTimer);
    state.quizTimer = null;
  }
  if (quizTimeEl) quizTimeEl.textContent = '00:00';
  if (quizScoreEl) quizScoreEl.classList.add('hidden');
  if (quizSubmitBtn) quizSubmitBtn.classList.remove('hidden');
  if (quizRetakeBtn) quizRetakeBtn.classList.add('hidden');
};

const updateQuizHeader = () => {
  if (quizTimeEl) quizTimeEl.textContent = formatQuizTime(state.quizSeconds);
  if (quizScoreEl) quizScoreEl.classList.toggle('hidden', !state.isQuizSubmitted);
  if (quizRetakeBtn) quizRetakeBtn.classList.toggle('hidden', !state.isQuizSubmitted);
};

const startQuizTimer = () => {
  if (state.quizTimer) clearInterval(state.quizTimer);
  state.quizTimer = setInterval(() => {
    state.quizSeconds += 1;
    if (quizTimeEl) quizTimeEl.textContent = formatQuizTime(state.quizSeconds);
  }, 1000);
};

export const renderQuiz = (quiz, index) => {
  const card = document.createElement('div');
  card.className = `rounded-2xl p-6 transition-all duration-300 ${QUIZ_CLASS_MAP.card}`;
  card.dataset.quizIndex = String(index);
  card.dataset.correctAnswer = quiz.correctAnswer;

  const questionHeader = document.createElement('h4');
  questionHeader.className = 'text-lg font-semibold mb-5 leading-relaxed text-gray-900 dark:text-slate-100';
  questionHeader.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-bold mr-2">Câu ${index + 1}:</span> ${quiz.question}`;
  card.appendChild(questionHeader);

  const optionsGrid = document.createElement('div');
  optionsGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4';

  const explElement = document.createElement('div');
  explElement.className = `${state.isQuizSubmitted ? '' : 'hidden'} quiz-expl mt-4 p-4 rounded-xl border text-sm leading-relaxed ${QUIZ_CLASS_MAP.explanation}`;
  explElement.innerHTML = `<span class="font-bold text-slate-800 dark:text-slate-200">Giải thích:</span> ${quiz.explanation}`;

  const selectedAnswer = state.userAnswers[index];

  const optionBtns = quiz.options.map((opt) => {
    const btn = document.createElement('button');
    btn.className = `text-left px-5 py-3 rounded-xl border transition-all duration-200 text-sm font-medium ${QUIZ_CLASS_MAP.option}`;
    btn.textContent = opt;
    btn.dataset.original = opt;
    if (state.isQuizSubmitted) btn.disabled = true;

    if (state.isQuizSubmitted) {
      const isCorrect = opt === quiz.correctAnswer;
      const isWrongSelected = selectedAnswer === opt && selectedAnswer !== quiz.correctAnswer;
      if (isCorrect) {
        btn.className = `text-left px-5 py-3 rounded-xl border transition-all duration-200 text-sm font-medium ${QUIZ_CLASS_MAP.correct}`;
      } else if (isWrongSelected) {
        btn.className = `text-left px-5 py-3 rounded-xl border transition-all duration-200 text-sm font-medium ${QUIZ_CLASS_MAP.wrong}`;
      }
    }

    btn.addEventListener('click', () => {
      if (state.isQuizSubmitted) return;
      state.userAnswers[index] = opt;
      optionBtns.forEach((b) => {
        const selected = b.dataset.original === opt;
        b.className = selected
          ? 'text-left px-5 py-3 rounded-xl border transition-all duration-200 text-sm font-medium bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-300'
          : `text-left px-5 py-3 rounded-xl border transition-all duration-200 text-sm font-medium ${QUIZ_CLASS_MAP.option}`;
      });
    });

    return btn;
  });

  optionBtns.forEach((btn) => optionsGrid.appendChild(btn));
  card.appendChild(optionsGrid);
  card.appendChild(explElement);
  return card;
};

const renderQuizControls = (quizzes = []) => {
  const quizList = getQuizList();
  const quizContainer = getQuizContainer();
  if (!quizList || !quizContainer) return;
  const quizItems = Array.isArray(quizzes) ? quizzes : [];

  if (!quizHeader) {
    quizHeader = document.createElement('div');
    quizHeader.className = 'flex flex-wrap items-center justify-between gap-3 mb-5 rounded-2xl border border-slate-200 bg-white/70 dark:bg-white/5 dark:border-white/10 px-4 py-3';
    quizHeader.innerHTML = `
      <div class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <span class="inline-flex items-center px-2 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">⏱</span>
        <span id="quizTime">00:00</span>
      </div>
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        <button id="quizRetakeBtn" type="button" class="hidden inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white font-bold text-sm shadow-md hover:bg-brand-600 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12a7.5 7.5 0 0112.364-5.894M19.5 12a7.5 7.5 0 01-12.364 5.894M4.5 12H8m11.5 0H16" />
          </svg>
          Thi lại
        </button>
        <div id="quizScoreWrap" class="hidden text-sm font-bold text-emerald-600 dark:text-emerald-400">
          <span id="quizScore">Điểm: 0/0</span>
        </div>
      </div>
    `;
  }

  quizTimeEl = quizHeader.querySelector('#quizTime');
  quizScoreEl = quizHeader.querySelector('#quizScoreWrap');
  quizRetakeBtn = quizHeader.querySelector('#quizRetakeBtn');

  if (!quizSubmitBtn) {
    quizSubmitBtn = document.createElement('button');
    quizSubmitBtn.type = 'button';
    quizSubmitBtn.className = 'hidden mt-8 w-full sm:w-auto px-5 py-3 rounded-xl bg-brand-500 text-white font-bold text-sm shadow-md hover:bg-brand-600 transition-colors';
    quizSubmitBtn.textContent = 'Nộp bài hoàn tất';
    quizSubmitBtn.addEventListener('click', submitQuiz);
  }

  if (quizRetakeBtn && !quizRetakeBtn.dataset.bound) {
    quizRetakeBtn.dataset.bound = 'true';
    quizRetakeBtn.addEventListener('click', handleRetakeQuiz);
  }

  if (!quizContainer.contains(quizHeader)) quizContainer.insertBefore(quizHeader, quizList);
  if (!quizContainer.contains(quizSubmitBtn)) quizContainer.appendChild(quizSubmitBtn);

  if (state.quizTimer) {
    clearInterval(state.quizTimer);
    state.quizTimer = null;
  }

  if (state.isQuizSubmitted) {
    const score = calculateQuizScore(quizItems, state.userAnswers);
    if (quizTimeEl) quizTimeEl.textContent = formatQuizTime(state.quizSeconds);
    if (quizScoreEl) {
      const scoreLabel = quizScoreEl.querySelector('#quizScore');
      if (scoreLabel) scoreLabel.textContent = `Điểm: ${score}/${quizItems.length}`;
      quizScoreEl.classList.remove('hidden');
    }
    if (quizRetakeBtn) quizRetakeBtn.classList.remove('hidden');
    if (quizSubmitBtn) quizSubmitBtn.classList.add('hidden');
  } else {
    if (quizTimeEl) quizTimeEl.textContent = formatQuizTime(state.quizSeconds);
    if (quizScoreEl) quizScoreEl.classList.add('hidden');
    if (quizRetakeBtn) quizRetakeBtn.classList.add('hidden');
    if (quizSubmitBtn) quizSubmitBtn.classList.remove('hidden');
    if (quizItems.length) startQuizTimer();
  }

  updateQuizHeader();
};

const applyQuizSubmittedState = () => {
  const quizList = getQuizList();
  const score = calculateQuizScore(state.currentQuizzes, state.userAnswers);
  const quizCards = quizList?.querySelectorAll('[data-quiz-index]') || [];

  quizCards.forEach((card) => {
    const index = Number(card.dataset.quizIndex);
    const correctAnswer = card.dataset.correctAnswer;
    const selectedAnswer = state.userAnswers[index];
    const buttons = card.querySelectorAll('button[data-original]');
    const expl = card.querySelector('.quiz-expl');

    buttons.forEach((btn) => {
      btn.disabled = true;
      const original = btn.dataset.original;
      const isSelected = original === selectedAnswer;
      const isCorrect = original === correctAnswer;

      if (isCorrect) {
        btn.className = `text-left px-5 py-3 rounded-xl border transition-all duration-200 text-sm font-medium ${QUIZ_CLASS_MAP.correct}`;
      } else if (isSelected && selectedAnswer !== correctAnswer) {
        btn.className = `text-left px-5 py-3 rounded-xl border transition-all duration-200 text-sm font-medium ${QUIZ_CLASS_MAP.wrong}`;
      } else {
        btn.className = `text-left px-5 py-3 rounded-xl border transition-all duration-200 text-sm font-medium ${QUIZ_CLASS_MAP.option}`;
      }
    });

    expl?.classList.remove('hidden');
  });

  if (quizScoreEl) {
    const scoreLabel = quizScoreEl.querySelector('#quizScore');
    if (scoreLabel) {
      scoreLabel.textContent = `Điểm: ${score}/${state.currentQuizzes.length}`;
    }
    quizScoreEl.classList.remove('hidden');
  }

  if (quizSubmitBtn) quizSubmitBtn.classList.add('hidden');
  if (quizRetakeBtn) quizRetakeBtn.classList.remove('hidden');
};

const submitQuiz = async () => {
  if (state.isQuizSubmitted) return;
  state.isQuizSubmitted = true;
  if (state.quizTimer) {
    clearInterval(state.quizTimer);
    state.quizTimer = null;
  }

  const stateToSave = { answers: state.userAnswers, seconds: state.quizSeconds, submitted: true };

  try {
    if (state.currentMaterialId) {
      const { error } = await supabase
        .from('study_materials')
        .update({ quiz_state: stateToSave })
        .eq('id', state.currentMaterialId);
      if (error) throw error;
    }
  } catch (err) {
    console.error('[Quiz] Save state failed:', err);
  }

  applyQuizSubmittedState();
  updateQuizHeader();
};

const handleRetakeQuiz = async () => {
  if (!state.currentMaterialId) return;

  state.userAnswers = {};
  state.quizSeconds = 0;
  state.isQuizSubmitted = false;
  if (state.quizTimer) {
    clearInterval(state.quizTimer);
    state.quizTimer = null;
  }

  try {
    const { error } = await supabase
      .from('study_materials')
      .update({ quiz_state: null })
      .eq('id', state.currentMaterialId);
    if (error) throw error;
  } catch (err) {
    console.error('[Quiz] Retake reset failed:', err);
    window.alert('Không thể thiết lập lại bài thi.');
    return;
  }

  initQuizView(state.currentQuizzes);
};

export const initQuizView = (quizzes) => {
  const quizList = document.querySelector('#quizList');
  if (!quizList) return;

  const quizCountEl = document.querySelector('#quizCount');
  if (quizCountEl) quizCountEl.textContent = String((quizzes || []).length);

  quizList.innerHTML = '';
  state.currentQuizzes = quizzes || [];

  state.currentQuizzes.forEach((quiz, index) => {
    quizList.appendChild(renderQuiz(quiz, index));
  });

  renderQuizControls(state.currentQuizzes);
  if (state.isQuizSubmitted) applyQuizSubmittedState();
};
