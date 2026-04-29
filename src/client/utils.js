export const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

export const formatSummaryMarkdown = (text = "") => {
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

export const formatQuizTime = (seconds) => {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

export const calculateQuizScore = (quizzes, answers) => {
  if (!quizzes || !Array.isArray(quizzes)) return 0;
  let score = 0;
  quizzes.forEach((q, index) => {
    if (answers[index] === q.correctAnswer) score++;
  });
  return score;
};
