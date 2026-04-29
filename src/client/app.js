import supabase from './supabaseClient.js';
import { state } from './store.js';
import { renderFlashcard } from './components/flashcard.js';
import { initQuizView, resetQuizState } from './components/quiz.js';
import { renderStats, renderSummary, renderStudyPlan } from './components/summary.js';
import { formatBytes, escapeHtml } from './utils.js';

/* ══════════════════════════════════════
   Biến Nhanh — Frontend Logic (ES6+)
   Complete overhaul: Flashcard rendering + 3D Flip
   ══════════════════════════════════════ */

const $ = (sel) => document.querySelector(sel);


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
const dashboardContainer = $("#dashboardContainer");
const workspaceContainer = $("#workspaceContainer");
const subjectsGrid = $("#subjectsGrid");
const btnCreateSubject = $("#btnCreateSubject");
const btnBackToDashboard = $("#btnBackToDashboard");

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
const getDisplayName = (user) => {
  const email = user?.user_metadata?.email || user?.email || "";
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  if (name) return name.split(" ")[0];
  if (email.includes("@")) return email.split("@")[0].split(/[._-]/)[0];
  return "bạn";
};
/* ══════════════════
   Routing & History API
   ══════════════════ */

// Hàm đổi URL mà không load lại trang
const navigate = (path) => {
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
  }
  handleRoute();
};

// Hàm quyết định giao diện dựa theo URL và trạng thái đăng nhập
const handleRoute = async () => {
  const path = window.location.pathname;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user || null;

  if (path.startsWith("/app")) {
    if (user) {
      showApp(); // Đã login, cho vào App
    } else {
      navigate("/"); // Chưa login mà mò vào /app -> Đuổi về trang chủ
    }
  } else {
    // Đang ở trang chủ "/"
    showLanding();

    if (user && startAppBtn) {
      // Đã login -> Biến nút Đăng nhập thành nút "Đi tới Workspace"
      startAppBtn.textContent = "Đi tới Workspace";
      startAppBtn.onclick = (e) => {
        e.preventDefault();
        navigate("/app");
      };
    } else if (!user && startAppBtn) {
      // Chưa login -> Nút Đăng nhập bình thường
      startAppBtn.innerHTML = `
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Bắt đầu miễn phí
      `;
      startAppBtn.onclick = signInWithGoogle;
    }
  }
};

// Bắt sự kiện khi user bấm nút <- (Back) hoặc -> (Forward) trên trình duyệt
window.addEventListener("popstate", (e) => {
  if (window.location.pathname.startsWith("/app")) {
    if (window.location.hash === "#workspace" && e.state && e.state.subjectId) {
      // Nút Forward: Lấy ID từ state và mở lại môn học (truyền true để không push state vòng lặp)
      openSubject(e.state.subjectId, e.state.subjectName, true);
      return; // Dừng tại đây
    } else if (window.location.hash !== "#workspace") {
      // Nút Back: Quay về Dashboard
      resetWorkspaceState();
      showDashboard(); // Đảm bảo UI dashboard hiển thị lại
    }
  }
  handleRoute();
});

const showLanding = () => {
  landingContainer?.classList.remove("hidden");
  appContainer?.classList.add("hidden");
};

const materialsContainer = $("#materialsContainer");
const materialsList = $("#materialsList");

const getMaterialTitle = (material) =>
  material?.file_name || material?.document_title || "Tài liệu không tên";

const loadMaterials = async (subjectId) => {
  if (!materialsContainer || !materialsList || !subjectId || !supabase?.from) return;

  materialsContainer.classList.remove("hidden");
  materialsList.innerHTML = `
    <div class="col-span-full rounded-2xl border border-dashed border-slate-300/70 dark:border-white/10 bg-white/40 dark:bg-white/5 px-5 py-8 text-center text-slate-600 dark:text-slate-400 font-medium">
      Đang tải tài liệu...
    </div>
  `;

  try {
    const { data, error } = await supabase
      .from("study_materials")
      .select("*, quiz_state")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const materials = Array.isArray(data) ? data : [];
    if (!materials.length) {
      materialsList.innerHTML = `
        <div class="col-span-full rounded-2xl border border-dashed border-slate-300/70 dark:border-white/10 bg-white/40 dark:bg-white/5 px-5 py-8 text-center text-slate-600 dark:text-slate-400 font-medium">
          Chưa có tài liệu nào cho môn này
        </div>
      `;
      return;
    }

    materialsList.innerHTML = materials
      .map((material) => {
        const createdAt = material.created_at
          ? new Date(material.created_at).toLocaleDateString("vi-VN")
          : "—";
        const title = escapeHtml(getMaterialTitle(material));
        return `
          <div class="group relative flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 hover:border-brand-400 dark:hover:border-brand-500 cursor-pointer transition-all shadow-sm" data-material-id="${material.id}">
            <div class="flex items-center gap-4 overflow-hidden min-w-0">
              <div class="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/5 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-slate-800 dark:text-slate-100 truncate">${title}</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">${createdAt}</p>
              </div>
            </div>

            <button type="button" class="delete-material-btn p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0" aria-label="Xóa tài liệu">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        `;
      })
      .join("");

    materialsList.querySelectorAll("[data-material-id]").forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        const material = materials[idx];
        state.currentMaterialId = material.id;
        state.currentFlashcards = Array.isArray(material.flashcards) ? material.flashcards : [];
        // Dọn dẹp đồng hồ cũ để chống rò rỉ
        if (state.quizTimer) {
          clearInterval(state.quizTimer);
        }

        // Phục hồi state từ DB
        let quizState = material.quiz_state;
        if (typeof quizState === 'string') {
          try { quizState = JSON.parse(quizState); } catch(e) {}
        }
        quizState = quizState || {};

        if (quizState.submitted === true || String(quizState.submitted) === "true") {
          state.isQuizSubmitted = true;
          state.userAnswers = quizState.answers || {};
          state.quizSeconds = Number(quizState.seconds || 0);
        } else {
          state.isQuizSubmitted = false;
          state.userAnswers = {};
          state.quizSeconds = 0;
        }
        openMaterial(material);
      });
    });

    materialsList.querySelectorAll(".delete-material-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const materialId = btn.closest("[data-material-id]")?.getAttribute("data-material-id");
        const material = materials.find((item) => String(item.id) === String(materialId));
        if (!material) return;
        if (!window.confirm("Bạn có chắc chắn muốn xóa tài liệu này khỏi lịch sử?")) return;

        try {
          const { error } = await supabase.from("study_materials").delete().eq("id", material.id);
          if (error) throw error;

          if (getMaterialTitle(material) === fileName?.textContent) {
            hideAll();
          }

          await loadMaterials(state.currentSubjectId);
        } catch (err) {
          console.error("Lỗi xóa tài liệu:", err);
          window.alert("Không thể xóa tài liệu.");
        }
      });
    });
  } catch (err) {
    console.error("[Materials] Load failed:", err);
    materialsList.innerHTML = `
      <div class="col-span-full rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
        Không thể tải lịch sử tài liệu.
      </div>
    `;
  }
};

const openMaterial = (material) => {
  if (!material) return;
  setLoading(true);
  resetQuizState();
  const title = getMaterialTitle(material);
  resultFileName.textContent = `Nội dung: ${title}`;

  const summaryStats = material.summary_stats || {};
  const flashcards = Array.isArray(material.flashcards) ? material.flashcards : [];
  const quizzes = Array.isArray(material.quizzes) ? material.quizzes : [];

  state.currentMaterialId = material.id;
  state.currentFlashcards = [...flashcards];
  let quizState = material.quiz_state;
  if (typeof quizState === 'string') {
    try { quizState = JSON.parse(quizState); } catch(e) {}
  }
  quizState = quizState || {};

  if (quizState.submitted === true || String(quizState.submitted) === "true") {
    state.userAnswers = quizState.answers || {};
    state.quizSeconds = Number(quizState.seconds || 0);
    state.isQuizSubmitted = true;
  } else {
    state.userAnswers = {};
    state.quizSeconds = 0;
    state.isQuizSubmitted = false;
  }

  renderSummary(summaryStats.onePageSummary || summaryStats.one_page_summary || "");
  renderStudyPlan(summaryStats.studyPlan || summaryStats.study_plan || []);

  cardCount.textContent = flashcards.length;
  flashcardsGrid.innerHTML = "";
  flashcards.forEach((card, index) => flashcardsGrid.appendChild(renderFlashcard(card, index)));

  initQuizView(quizzes);
  switchTab("summary");
  resultSection.classList.remove("hidden");
  setLoading(false);
  if (materialsContainer) materialsContainer.classList.remove("hidden");
};

const showDashboard = () => {
  dashboardContainer?.classList.remove("hidden");
  workspaceContainer?.classList.add("hidden");
  materialsContainer?.classList.add("hidden");
  hideAll();

  const welcomeEl = document.querySelector("#dashboardWelcome");
  if (welcomeEl) {
    const displayName = getDisplayName(state.activeUser || {});
    welcomeEl.textContent = `Chào mừng trở lại, ${displayName}! Năng suất hôm nay nhé! 🚀`;
  }

  const dashboardTitle = document.querySelector("#dashboardTitle");
  if (dashboardTitle) {
    dashboardTitle.innerHTML = `<span class="bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">Các môn học của tôi</span>`;
  }
};

const showWorkspace = () => {
  dashboardContainer?.classList.add("hidden");
  workspaceContainer?.classList.remove("hidden");
  appContainer?.classList.remove("hidden");
  appContainer?.classList.add("animate-fade-in");
  userProfile?.classList.remove("hidden");
  if (btnBackToDashboard) {
    btnBackToDashboard.textContent = `← Quay lại • Đang mở: ${state.currentSubjectName || "Môn học"}`;
  }
  if (materialsContainer) materialsContainer.classList.remove("hidden");
};

const showApp = () => {
  landingContainer?.classList.add("hidden");
  appContainer?.classList.remove("hidden");
  appContainer?.classList.add("animate-fade-in");

  // LOGIC GIỮ TRẠNG THÁI MÀN HÌNH:
  if (state.currentSubjectId) {
    showWorkspace(); // Nếu đang mở môn học, giữ nguyên màn hình Upload
  } else {
    showDashboard(); // Nếu chưa mở môn nào, hiện danh sách Dashboard
  }

  userProfile?.classList.remove("hidden");
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
    state.currentSubjectId = null;
    state.currentSubjectName = "";
    subjectsGrid && (subjectsGrid.innerHTML = "");
    btnBackToDashboard &&
      (btnBackToDashboard.textContent = "← Quay lại danh sách Môn học");
    userDropdown?.classList.add("hidden");
    window.location.reload();
  } catch (err) {
    console.error("[Auth] Sign out failed:", err);
  }
};

const updateUserProfile = (user) => {
  state.activeUser = user || null;
  if (!userProfile || !userAvatar || !userEmail) return;
  if (!user) {
    userProfile.classList.add("hidden");
    userProfile.classList.remove("flex");
    userDropdown?.classList.add("hidden");
    return;
  }

  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
  const email = user.user_metadata?.email || user.email || "Người dùng";

  if (avatarUrl) userAvatar.src = avatarUrl;
  userAvatar.alt = email;
  userEmail.textContent = email;
  if (dropdownEmail) dropdownEmail.textContent = email;
  userProfile.classList.remove("hidden");
  userDropdown?.classList.add("hidden");
  userProfile.classList.add("flex");
};

// Thêm tham số isHistoryNav để biết đây là hành động do bấm nút Back/Forward
const openSubject = (subjectId, subjectName, isHistoryNav = false) => {
  if (!isHistoryNav) {
    // Nếu là click bình thường, lưu ID môn học vào hành lý (state) của trình duyệt
    if (window.location.hash !== "#workspace") {
      window.history.pushState({ subjectId, subjectName }, "", "/app#workspace");
    } else {
      window.history.replaceState({ subjectId, subjectName }, "", "/app#workspace");
    }
  }

  state.currentSubjectId = subjectId;
  state.currentSubjectName = subjectName || "Môn học";
  showWorkspace();
  loadMaterials(subjectId);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const renderSubjectCard = (subject) => {
  const title = escapeHtml(subject.name ?? "Chưa đặt tên").replace(/'/g, "&#39;");
  const cardHTML = `
  <div class="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-brand-400 dark:hover:border-brand-500 cursor-pointer transition-all shadow-sm hover:shadow-md group relative overflow-hidden hover:-translate-y-1.5 hover:shadow-xl hover:shadow-brand-500/15 duration-300 ring-1 ring-slate-200 dark:ring-white/10 hover:ring-brand-400 dark:hover:ring-brand-500" onclick="openSubject('${subject.id}', '${title}')">
    <div class="absolute inset-0 bg-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
    <button type="button" aria-label="Xóa môn học" class="absolute top-3 right-3 z-20 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" data-delete-subject="${subject.id}">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14" />
      </svg>
    </button>
    <div class="relative z-10 flex items-center gap-3 mb-3 pr-10">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/5 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      </div>
      <h3 class="font-bold text-slate-800 dark:text-slate-100 text-lg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">${title}</h3>
    </div>
    <p class="relative z-10 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Bấm để quản lý tài liệu</p>
  </div>
`;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = cardHTML.trim();
  const el = wrapper.firstElementChild;
  el?.querySelector("[data-delete-subject]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa môn học này và toàn bộ tài liệu bên trong?")) return;

    try {
      const { error: materialsError } = await supabase.from("study_materials").delete().eq("subject_id", subject.id);
      if (materialsError) throw materialsError;
      const { error: subjectError } = await supabase.from("subjects").delete().eq("id", subject.id);
      if (subjectError) throw subjectError;
      if (state.currentSubjectId === subject.id) {
        resetWorkspaceState();
        showDashboard();
      }
      await loadSubjects();
    } catch (err) {
      console.error("[Subjects] Delete failed:", err);
      window.alert(err?.message ?? "Không thể xóa môn học.");
    }
  });
  return el;
};

const loadSubjects = async () => {
  if (!subjectsGrid || !supabase?.from) return;
  subjectsGrid.innerHTML =
    '<div class="col-span-full rounded-2xl border border-dashed border-slate-300/70 dark:border-white/10 bg-white/40 dark:bg-white/5 px-5 py-8 text-center text-slate-600 dark:text-slate-400 font-medium">Đang tải môn học...</div>';

  try {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const subjects = Array.isArray(data) ? data : [];
    if (subjects.length === 0) {
      subjectsGrid.innerHTML =
        '<div class="col-span-full rounded-2xl border border-dashed border-slate-300/70 dark:border-white/10 bg-white/40 dark:bg-white/5 px-5 py-8 text-center text-slate-600 dark:text-slate-400 font-medium">Chưa có môn học nào. Hãy tạo môn đầu tiên!</div>';
      return;
    }

    subjectsGrid.innerHTML = "";
    subjects.forEach((subject) => {
      subjectsGrid.appendChild(renderSubjectCard(subject));
    });
  } catch (err) {
    console.error("[Subjects] Load failed:", err);
    subjectsGrid.innerHTML =
      '<div class="col-span-full rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">Không thể tải danh sách môn học.</div>';
  }
};

const createSubject = async () => {
  const subjectName = window.prompt("Nhập tên môn học mới:")?.trim();
  if (!subjectName) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error("Không tìm thấy người dùng đăng nhập.");

    const { error } = await supabase
      .from("subjects")
      .insert([{ name: subjectName, user_id: userId }]);
    if (error) throw error;

    await loadSubjects();
  } catch (err) {
    console.error("[Subjects] Create failed:", err);
    window.alert(err?.message ?? "Không thể tạo môn học mới.");
  }
};

const resetWorkspaceState = () => {
  state.currentSubjectId = null;
  state.currentSubjectName = "";
  hideAll();
  clearSelection();
  setLoading(false);
  resetQuizState();
};

// Biến cờ (flag) để theo dõi xem đã tải lần đầu chưa, tránh load lại khi chuyển tab
let isInitialLoadDone = false;
let activeUserId = null;

const initSession = async () => {
  try {
    if (!supabase?.auth) {
      navigate("/");
      return;
    }

    // Lấy session ngay khi load trang
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("[Auth] Get session error:", error);
      navigate("/");
      return;
    }

    const sessionUser = session?.user || null;

    if (sessionUser) {
      activeUserId = sessionUser.id;
      updateUserProfile(sessionUser);
      handleRoute(); // Tự quyết định xem nên ở / hay vào /app

      if (!isInitialLoadDone) {
        await loadSubjects();
        isInitialLoadDone = true;
      }
    } else {
      updateUserProfile(null);
      handleRoute();
    }

    // Lắng nghe thay đổi trạng thái đăng nhập
    supabase.auth.onAuthStateChange(async (event, currentSession) => {
      const user = currentSession?.user || null;

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (user) {
          updateUserProfile(user);
          const isGenuineLogin = event === "SIGNED_IN" && activeUserId !== user.id;

          if (isGenuineLogin && window.location.pathname !== "/app") {
            navigate("/app");
          } else {
            handleRoute();
          }

          activeUserId = user.id;

          if (!isInitialLoadDone) {
            await loadSubjects();
            isInitialLoadDone = true;
          }
        } else {
          isInitialLoadDone = false;
          activeUserId = null;
          updateUserProfile(null);
          if (window.location.pathname !== "/") navigate("/");
        }
      } else if (event === "SIGNED_OUT") {
        isInitialLoadDone = false;
        activeUserId = null;
        updateUserProfile(null);
        navigate("/");
      }
    });
  } catch (err) {
    console.error("[Auth] Session init failed:", err);
    navigate("/");
  }
};

initTheme();
initSession();

// startAppBtn?.addEventListener("click", signInWithGoogle);
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

window.openSubject = openSubject;
btnCreateSubject?.addEventListener("click", createSubject);
btnBackToDashboard?.addEventListener("click", () => {
  resetWorkspaceState();
  showDashboard();
  btnBackToDashboard.textContent = "← Quay lại danh sách Môn học";
  window.history.pushState({}, "", "/app"); // Xóa đuôi #workspace khỏi URL
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ══════════════════
   Tabs Logic
   ══════════════════ */

const TAB_ACTIVE =
  "px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 bg-brand-500 text-white shadow-lg shadow-brand-500/30";
const TAB_INACTIVE =
  "px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white";

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
tabQuiz?.addEventListener("click", () => {
  if (state.isQuizSubmitted && state.quizTimer) {
    clearInterval(state.quizTimer);
    state.quizTimer = null;
  }
  switchTab("quiz");
});
tabStudyPlan?.addEventListener("click", () => switchTab("studyPlan"));

let selectedFile = null;

/* ══════════════════
   Helpers
   ══════════════════ */



const hideAll = () => {
  resultSection.classList.add("hidden");
  errorCard.classList.add("hidden");
};

const setLoading = (loading) => {
  uploadBtn.disabled = loading;
  btnIconDef.classList.toggle("hidden", loading);
  btnSpinner.classList.toggle("hidden", !loading);
  btnText.textContent = loading ? "Đang phân tích..." : "Phân tích";
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
   Flashcard Renderer
   ══════════════════ */


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
    resetQuizState();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      throw new Error("Bạn chưa đăng nhập hoặc phiên đã hết hạn.");
    }

    const formData = new FormData();
    formData.append("pdfFile", selectedFile);
    if (state.currentSubjectId) formData.append("subjectId", state.currentSubjectId);
    formData.append("userId", userId);

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

    resetQuizState();

    /* ── 2. Render Stats Badges ── */

    /* ── 2. Render Stats Badges ── */
    const statsValues = {
      totalCards: `${flashcards.length} thẻ`,
      estimatedStudyTime: stats.estimatedStudyTime ?? "—",
      difficultyScore:
        stats.difficultyScore != null ? `${stats.difficultyScore}/10` : "—",
      timeSaved: stats.timeSaved ?? "—",
    };

    renderStats(statsValues);
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
    initQuizView(quizzes);

    // Reset tabs to default (summary)
    switchTab("summary");

    /* ── 4. Show result ── */
    resultSection.classList.remove("hidden");
    if (state.currentSubjectId) loadMaterials(state.currentSubjectId);

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
