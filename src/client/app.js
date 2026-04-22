/* ══════════════════════════════════════
   Biến Nhanh — Frontend Logic (ES6+)
   Complete overhaul: Flashcard rendering + 3D Flip
   ══════════════════════════════════════ */

const $ = (sel) => document.querySelector(sel);

const supabaseUrl = "https://wjqdxhnoftymjzrtuxhl.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcWR4aG5vZnR5bWp6cnR1eGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDc4NDksImV4cCI6MjA5MTkyMzg0OX0._EHc2_0cU78PuFuyo23DljNNROnA5Lia6piKCwqRIQc";

// 2. Khởi tạo client
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
if (!supabase) {
  console.error(
    "[Supabase] Client chưa được khởi tạo. Kiểm tra SUPABASE_URL / SUPABASE_ANON_KEY.",
  );
}

/* ── Theme Logic ── */
const THEME_STORAGE_KEY = "theme";
const THEME_MODE_KEY = "theme-mode";
const themeButtons = document.querySelectorAll(".theme-toggle-btn");
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const btnLogout = $("#btnLogout");
const userProfile = $("#userProfile");
const userAvatar = $("#userAvatar");
const userEmail = $("#userEmail");
const userDropdown = $("#userDropdown");
const dropdownEmail = $("#dropdownEmail");
const appHeader = document.querySelector("#appContainer header");

const getSystemTheme = () => (themeMedia.matches ? "dark" : "light");

const getStoredThemeMode = () =>
  localStorage.getItem(THEME_MODE_KEY) || "system";

const applyTheme = (mode, persist = true) => {
  const activeMode = ["light", "dark", "system"].includes(mode)
    ? mode
    : "system";
  const resolvedTheme = activeMode === "system" ? getSystemTheme() : activeMode;
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  document.documentElement.style.colorScheme = resolvedTheme;

  if (persist) {
    localStorage.setItem(THEME_MODE_KEY, activeMode);
    localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
  }

  themeButtons.forEach((btn) => {
    const isActive = btn.dataset.themeValue === activeMode;
    const icon = btn.querySelector("svg");
    const label = btn.querySelector("span");

    btn.className = isActive
      ? "theme-toggle-btn cursor-pointer inline-flex items-center gap-2 rounded-full px-2 sm:px-3 py-2 text-xs font-semibold transition-all duration-300 whitespace-nowrap bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-sm"
      : "theme-toggle-btn cursor-pointer inline-flex items-center gap-2 rounded-full px-2 sm:px-3 py-2 text-xs font-semibold transition-all duration-300 whitespace-nowrap text-gray-600 dark:text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white";

    icon?.classList.toggle("text-current", true);
    label?.classList.toggle("hidden", window.innerWidth < 640);
  });
};

const initTheme = () => {
  applyTheme(getStoredThemeMode(), false);

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.themeValue || "system");
    });
  });

  themeMedia.addEventListener("change", () => {
    if (getStoredThemeMode() !== "system") return;
    applyTheme("system", true);
  });
};

/* ── DOM refs ── */
const dropZone = $("#dropZone");
const fileInput = $("#fileInput");
const fileInfo = $("#fileInfo");
const fileName = $("#fileName");
const fileSize = $("#fileSize");
const clearFile = $("#clearFile");
const uploadBtn = $("#uploadBtn");
const btnText = $("#btnText");
const btnIconDef = $("#btnIconDefault");
const btnSpinner = $("#btnSpinner");
const resultSection = $("#resultSection");
const resultFileName = $("#resultFileName");
const statsBadges = $("#statsBadges");
const cardCount = $("#cardCount");
const flashcardsGrid = $("#flashcardsGrid");
const errorCard = $("#errorCard");
const errorMsg = $("#errorMessage");

const tabSummary = $("#tabSummary");
const tabFlashcards = $("#tabFlashcards");
const tabQuiz = $("#tabQuiz");
const tabStudyPlan = $("#tabStudyPlan");
const summaryContainer = $("#summaryContainer");
const summaryContent = $("#summaryContent");
const flashcardsContainer = $("#flashcardsContainer");
const quizContainer = $("#quizContainer");
const studyPlanContainer = $("#studyPlanContainer");
const studyPlanList = $("#studyPlanList");
const quizCount = $("#quizCount");
const quizList = $("#quizList");
const landingContainer = $("#landingContainer");
const appContainer = $("#appContainer");
const startAppBtn = $("#startAppBtn");

const showLanding = () => {
  landingContainer?.classList.remove("hidden");
  appContainer?.classList.add("hidden");
};

const showApp = () => {
  landingContainer?.classList.add("hidden");
  appContainer?.classList.remove("hidden");
  appContainer?.classList.add("animate-fade-in");
  userProfile?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const signInWithGoogle = async () => {
  try {
    if (!supabase?.auth) throw new Error("Supabase client chưa sẵn sàng.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  } catch (err) {
    console.error("[Auth] Google sign-in failed:", err);
  }
};

const signOut = async () => {
  try {
    if (!supabase?.auth) throw new Error("Supabase client chưa sẵn sàng.");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.reload();
  } catch (err) {
    console.error("[Auth] Sign out failed:", err);
  }
};

const updateUserProfile = (user) => {
  if (!userProfile || !userAvatar || !userEmail) return;
  if (!user) {
    userProfile.classList.add("hidden");
    userProfile.classList.remove("flex");
    return;
  }

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
  const email = user.user_metadata?.email || user.email || "Người dùng";

  if (avatarUrl) userAvatar.src = avatarUrl;
  userAvatar.alt = email;
  userEmail.textContent = email;
  if (dropdownEmail) dropdownEmail.textContent = email;
  userProfile.classList.remove("hidden");
  userDropdown?.classList.add("hidden");
  userProfile.classList.add("flex");
};

const initSession = async () => {
  try {
    if (!supabase?.auth) {
      showLanding();
      return;
    }

    const { data } = await supabase.auth.getSession();
    const sessionUser = data?.session?.user || null;
    if (sessionUser) {
      updateUserProfile(sessionUser);
      showApp();
    } else {
      updateUserProfile(null);
      showLanding();
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      if (user) {
        updateUserProfile(user);
        showApp();
      } else {
        updateUserProfile(null);
        showLanding();
      }
    });
  } catch (err) {
    console.error("[Auth] Session init failed:", err);
    showLanding();
  }
};

initTheme();
initSession();

startAppBtn?.addEventListener("click", signInWithGoogle);
btnLogout?.addEventListener("click", (e) => {
  e.stopPropagation();
  userDropdown?.classList.add("hidden");
  signOut();
});

userProfile?.addEventListener("click", (e) => {
  e.stopPropagation();
  userDropdown?.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (userProfile && !userProfile.contains(e.target)) {
    userDropdown?.classList.add("hidden");
  }
});

/* ══════════════════
   Tabs Logic
   ══════════════════ */

const TAB_ACTIVE =
  "px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 bg-brand-500 text-white shadow-lg shadow-brand-500/30";
const TAB_INACTIVE =
  "px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10";

const switchTab = (tab) => {
  const tabMap = {
    summary: { btn: tabSummary, panel: summaryContainer },
    flashcards: { btn: tabFlashcards, panel: flashcardsContainer },
    quiz: { btn: tabQuiz, panel: quizContainer },
    studyPlan: { btn: tabStudyPlan, panel: studyPlanContainer },
  };

  Object.entries(tabMap).forEach(([key, item]) => {
    if (!item.btn || !item.panel) return;
    const active = key === tab;
    item.btn.className = active ? TAB_ACTIVE : TAB_INACTIVE;
    item.panel.classList.toggle("hidden", !active);
  });
};

tabSummary?.addEventListener("click", () => switchTab("summary"));
tabFlashcards?.addEventListener("click", () => switchTab("flashcards"));
tabQuiz?.addEventListener("click", () => switchTab("quiz"));
tabStudyPlan?.addEventListener("click", () => switchTab("studyPlan"));

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
  resultSection.classList.add("hidden");
  errorCard.classList.add("hidden");
};

const setLoading = (loading) => {
  uploadBtn.disabled = loading;
  btnIconDef.classList.toggle("hidden", loading);
  btnSpinner.classList.toggle("hidden", !loading);
  btnText.textContent = loading ? "Đang phân tích..." : "Tạo Flashcards";
};

const showFile = (file) => {
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileInfo.classList.remove("hidden");
  uploadBtn.disabled = false;
  hideAll();
};

const clearSelection = () => {
  selectedFile = null;
  fileInput.value = "";
  fileInfo.classList.add("hidden");
  uploadBtn.disabled = true;
  hideAll();
};

/* ══════════════════
   Stats Badge Renderer
   ══════════════════ */

const STAT_CONFIG = [
  {
    key: "totalCards",
    label: "Số thẻ",
    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z"/></svg>`,
    colorClass: "brand",
  },
  {
    key: "estimatedStudyTime",
    label: "Thời gian học",
    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    colorClass: "emerald",
  },
  {
    key: "difficultyScore",
    label: "Độ khó",
    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`,
    colorClass: "amber",
  },
  {
    key: "timeSaved",
    label: "Tiết kiệm",
    icon: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>`,
    colorClass: "purple",
  },
];

const STAT_CLASS_MAP = {
  brand: {
    wrapper: "bg-brand-500/10 border-brand-500/20 hover:bg-brand-500/15",
    icon: "bg-brand-500/15 text-brand-400",
    value: "text-brand-300",
  },
  emerald: {
    wrapper: "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15",
    icon: "bg-emerald-500/15 text-emerald-400",
    value: "text-emerald-300",
  },
  amber: {
    wrapper: "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15",
    icon: "bg-amber-500/15 text-amber-400",
    value: "text-amber-300",
  },
  purple: {
    wrapper: "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/15",
    icon: "bg-purple-500/15 text-purple-400",
    value: "text-purple-300",
  },
};

const renderStatBadge = (config, value) => {
  const classes = STAT_CLASS_MAP[config.colorClass];

  return `
  <div class="stat-badge relative overflow-hidden ${classes.wrapper} rounded-xl px-4 py-3 flex items-center gap-3 transition-colors duration-300 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10">
    <div class="w-8 h-8 rounded-lg ${classes.icon} flex items-center justify-center shrink-0">
      ${config.icon}
    </div>
    <div class="min-w-0">
      <p class="text-[11px] font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wider">${config.label}</p>
      <p class="text-sm font-bold ${classes.value} mt-0.5 truncate text-gray-900 dark:text-slate-100">${value}</p>
    </div>
  </div>
`;
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatSummaryMarkdown = (text = "") => {
  const lines = String(text).split(/\r?\n/);
  const html = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<div class="h-3"></div>';
      if (trimmed.startsWith("### "))
        return `<h3 class="text-lg font-bold text-slate-900 dark:text-white mt-5 mb-2">${escapeHtml(trimmed.slice(4))}</h3>`;
      if (trimmed.startsWith("## "))
        return `<h2 class="text-xl font-extrabold text-slate-900 dark:text-white mt-6 mb-3">${escapeHtml(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith("# "))
        return `<h1 class="text-2xl font-extrabold text-slate-900 dark:text-white mt-6 mb-4">${escapeHtml(trimmed.slice(2))}</h1>`;
      if (trimmed.startsWith("- "))
        return `<li class="ml-5 list-disc mb-2 text-slate-700 dark:text-slate-300 leading-relaxed">${escapeHtml(trimmed.slice(2))}</li>`;
      const bolded = escapeHtml(trimmed).replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-semibold text-slate-900 dark:text-white">$1</strong>',
      );
      return `<p class="mb-3 text-slate-700 dark:text-slate-300 leading-relaxed">${bolded}</p>`;
    })
    .join("");
  return `<div class="space-y-1">${html}</div>`;
};

/* ══════════════════
   Flashcard Renderer
   ══════════════════ */

const renderFlashcard = (card, index) => {
  const wrapper = document.createElement("div");
  wrapper.className = "flashcard-wrapper";
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
  wrapper.addEventListener("click", () => {
    const inner = wrapper.querySelector(".flashcard-inner");
    inner.classList.toggle("flipped");
  });

  return wrapper;
};

/* ══════════════════
   Quiz Renderer
   ══════════════════ */

const QUIZ_CLASS_MAP = {
  card: "bg-white border-gray-300 text-gray-900 shadow-sm hover:border-emerald-400/40 dark:bg-white/5 dark:border-white/10 dark:text-slate-100 dark:shadow-lg dark:shadow-black/20",
  explanation:
    "bg-gray-50 border-gray-300 text-gray-800 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-slate-300",
  option:
    "bg-white border-gray-300 text-gray-800 hover:bg-gray-50 hover:border-emerald-400/50 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:border-emerald-500/50",
  correct:
    "bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300",
  wrong: "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300",
};

const renderSummary = (summaryText) => {
  if (!summaryContent) return;
  const content = typeof summaryText === "string" ? summaryText.trim() : "";
  summaryContent.innerHTML = `
    <div class="summary-content text-[15px] leading-7 text-gray-800 dark:text-slate-300 bg-white dark:bg-transparent">
      ${content ? formatSummaryMarkdown(content) : '<p class="text-gray-500 dark:text-slate-400">Đang cập nhật</p>'}
    </div>
  `;
};

const renderStudyPlan = (studyPlan = []) => {
  if (!studyPlanList) return;
  if (!Array.isArray(studyPlan) || studyPlan.length === 0) {
    studyPlanList.innerHTML =
      '<p class="text-slate-500 dark:text-slate-400">Không có dữ liệu</p>';
    return;
  }

  const safePlan = studyPlan.filter((day) => day && typeof day === "object");
  if (safePlan.length === 0) {
    studyPlanList.innerHTML =
      '<p class="text-slate-500 dark:text-slate-400">Không có dữ liệu</p>';
    return;
  }

  studyPlanList.innerHTML = `
    <div class="relative border-l-2 border-purple-300 dark:border-purple-500 ml-4">
      ${safePlan
        .map((day) => {
          const tasks = Array.isArray(day.tasks) ? day.tasks : [];
          return `
        <div class="relative mb-8 ml-8">
          <div class="absolute w-4 h-4 rounded-full bg-purple-500 -left-[2.35rem] top-1.5 ring-4 ring-purple-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.2)]"></div>
          <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-xl">
            <div class="flex flex-wrap items-center gap-3 mb-3">
              <span class="px-3 py-1 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 text-xs font-semibold">Ngày ${escapeHtml(day.day ?? "—")}</span>
              <h4 class="font-bold text-gray-900 dark:text-white">${escapeHtml(day.title ?? "Đang cập nhật")}</h4>
            </div>
            <ul class="space-y-2">
              ${tasks.length ? tasks.map((task) => `<li class="flex gap-3 text-gray-800 dark:text-slate-300"><span class="mt-2 w-2 h-2 rounded-full bg-brand-500 shrink-0"></span><span>${escapeHtml(task)}</span></li>`).join("") : '<li class="text-gray-500 dark:text-slate-400">Không có dữ liệu</li>'}
            </ul>
          </div>
        </div>
      `;
        })
        .join("")}
    </div>
  `;
};

const renderQuiz = (quiz, index) => {
  const card = document.createElement("div");
  card.className = `rounded-2xl p-6 transition-all duration-300 ${QUIZ_CLASS_MAP.card}`;

  const questionHeader = document.createElement("h4");
  questionHeader.className =
    "text-lg font-semibold mb-5 leading-relaxed text-gray-900 dark:text-slate-100";
  questionHeader.innerHTML = `<span class="text-emerald-400 font-bold mr-2">Câu ${index + 1}:</span> ${quiz.question}`;
  card.appendChild(questionHeader);

  const optionsGrid = document.createElement("div");
  optionsGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4";

  let hasAnswered = false;

  const explElement = document.createElement("div");
  explElement.className = `hidden mt-4 p-4 rounded-xl border text-sm leading-relaxed ${QUIZ_CLASS_MAP.explanation}`;
  explElement.innerHTML = `<span class="font-semibold text-gray-900 dark:text-white">Giải thích:</span> ${quiz.explanation}`;

  const optionBtns = quiz.options.map((opt) => {
    const btn = document.createElement("button");
    btn.className = `text-left px-5 py-3 rounded-xl border transition-all duration-200 text-sm font-medium ${QUIZ_CLASS_MAP.option}`;
    btn.textContent = opt;
    // Store original option for comparison
    btn.dataset.original = opt;

    btn.addEventListener("click", () => {
      if (hasAnswered) return;
      hasAnswered = true;

      // Reveal explanation
      explElement.classList.remove("hidden");
      explElement.classList.add("animate-fade-in");

      const isCorrect = opt === quiz.correctAnswer;

      optionBtns.forEach((b) => {
        b.disabled = true;
        b.classList.add("cursor-default", "opacity-70");
        b.className = `text-left px-5 py-3 rounded-xl border transition-all duration-500 text-sm font-medium ${QUIZ_CLASS_MAP.option}`;

        if (b.dataset.original === quiz.correctAnswer) {
          b.className = `text-left px-5 py-3 rounded-xl border transition-all duration-500 text-sm font-semibold ${QUIZ_CLASS_MAP.correct} shadow-[0_0_15px_rgba(16,185,129,0.15)]`;
        } else if (b === btn && !isCorrect) {
          b.className = `text-left px-5 py-3 rounded-xl border transition-all duration-500 text-sm font-medium ${QUIZ_CLASS_MAP.wrong}`;
        }
      });
    });

    return btn;
  });

  optionBtns.forEach((btn) => optionsGrid.appendChild(btn));
  card.appendChild(optionsGrid);
  card.appendChild(explElement);

  return card;
};

/* ══════════════════
   Drag & Drop
   ══════════════════ */

["dragenter", "dragover"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  }),
);

["dragleave", "drop"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  }),
);

dropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  const isPdf =
    file?.type === "application/pdf" ||
    file?.name?.toLowerCase().endsWith(".pdf");
  const isDocx =
    file?.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file?.name?.toLowerCase().endsWith(".docx");

  if (isPdf || isDocx) {
    showFile(file);
  } else {
    clearSelection();
    errorMsg.textContent = "Chỉ hỗ trợ file PDF hoặc Word. Vui lòng thử lại.";
    errorCard.classList.remove("hidden");
  }
});

/* ══════════════════
   Click to select
   ══════════════════ */

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isDocx =
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx");

  if (isPdf || isDocx) {
    showFile(file);
  } else {
    clearSelection();
    errorMsg.textContent = "Chỉ hỗ trợ file PDF hoặc Word. Vui lòng thử lại.";
    errorCard.classList.remove("hidden");
  }
});

clearFile.addEventListener("click", (e) => {
  e.stopPropagation();
  clearSelection();
});

/* ══════════════════
   Upload & Render
   ══════════════════ */

uploadBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  hideAll();
  setLoading(true);

  try {
    const formData = new FormData();
    formData.append("pdfFile", selectedFile);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json();

    console.log("[Biến Nhanh] Response:", json);

    if (!res.ok || !json?.success) {
      throw new Error(json?.message ?? "Upload thất bại.");
    }

    /* ── Lấy dữ liệu từ response ── */
    const data = json.data;
    if (!data) {
      throw new Error("Response không chứa dữ liệu.");
    }

    const flashcards = Array.isArray(data.flashcards) ? data.flashcards : [];
    const quizzes = Array.isArray(data.quizzes) ? data.quizzes : [];
    const stats = data.summaryStats || data.summary_stats || {};

    // 1. Lấy Tiêu đề
    const docTitle =
      data.documentTitle ||
      data.document_title ||
      data.fileName ||
      data.file_name ||
      "Tài liệu không tên";
    resultFileName.textContent = `Nội dung: ${docTitle}`;

    // 2. Lấy Tóm tắt (Bao trùm cả camelCase, snake_case và nằm ngoài data)
    const summaryData =
      data.onePageSummary ||
      (data.summaryStats && data.summaryStats.onePageSummary) ||
      (data.summary_stats && data.summary_stats.onePageSummary) ||
      (data.summaryStats && data.summaryStats.one_page_summary) ||
      (data.summary_stats && data.summary_stats.one_page_summary) ||
      "";

    // 3. Lấy Lịch ôn thi
    const studyPlanData =
      data.studyPlan ||
      (data.summaryStats && data.summaryStats.studyPlan) ||
      (data.summary_stats && data.summary_stats.studyPlan) ||
      (data.summaryStats && data.summaryStats.study_plan) ||
      (data.summary_stats && data.summary_stats.study_plan) ||
      [];

    if (flashcards.length === 0) {
      throw new Error("AI không tạo được flashcard nào từ nội dung PDF này.");
    }

    /* ── 2. Render Stats Badges ── */

    /* ── 2. Render Stats Badges ── */
    const statsValues = {
      totalCards: `${flashcards.length} thẻ`,
      estimatedStudyTime: stats.estimatedStudyTime ?? "—",
      difficultyScore:
        stats.difficultyScore != null ? `${stats.difficultyScore}/10` : "—",
      timeSaved: stats.timeSaved ?? "—",
    };

    statsBadges.innerHTML = STAT_CONFIG.map((cfg) =>
      renderStatBadge(cfg, statsValues[cfg.key]),
    ).join("");

    renderSummary(summaryData);
    renderStudyPlan(studyPlanData);

    /* ── 3. Render Flashcards ── */
    cardCount.textContent = flashcards.length;
    flashcardsGrid.innerHTML = "";

    flashcards.forEach((card, index) => {
      const el = renderFlashcard(card, index);
      flashcardsGrid.appendChild(el);
    });

    /* ── 3.1. Render Quizzes ── */
    quizCount.textContent = quizzes.length;
    quizList.innerHTML = "";
    quizzes.forEach((quiz, index) => {
      quizList.appendChild(renderQuiz(quiz, index));
    });

    // Reset tabs to default (summary)
    switchTab("summary");

    /* ── 4. Show result ── */
    resultSection.classList.remove("hidden");

    // Scroll to results smoothly
    setTimeout(() => {
      resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  } catch (err) {
    console.error("[Biến Nhanh] Error:", err);
    errorMsg.textContent = err?.message ?? "Đã xảy ra lỗi không xác định.";
    errorCard.classList.remove("hidden");
  } finally {
    setLoading(false);
  }
});
