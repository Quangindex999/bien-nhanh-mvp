import { escapeHtml, formatSummaryMarkdown } from '../utils.js';

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

const STAT_CLASS_MAP = {
  brand: {
    wrapper: 'bg-brand-500/10 border-brand-500/20 hover:bg-brand-500/15',
    icon: 'bg-brand-500/15 text-brand-400',
    value: 'text-brand-300',
  },
  emerald: {
    wrapper: 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15',
    icon: 'bg-emerald-500/15 text-emerald-400',
    value: 'text-emerald-300',
  },
  amber: {
    wrapper: 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15',
    icon: 'bg-amber-500/15 text-amber-400',
    value: 'text-amber-300',
  },
  purple: {
    wrapper: 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/15',
    icon: 'bg-purple-500/15 text-purple-400',
    value: 'text-purple-300',
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

export const renderStats = (statsValues) => {
  const statsBadges = document.querySelector('#statsBadges');
  if (statsBadges) {
    statsBadges.innerHTML = STAT_CONFIG.map((cfg) => renderStatBadge(cfg, statsValues[cfg.key])).join('');
  }
};

export const renderSummary = (summaryText) => {
  const summaryContent = document.querySelector('#summaryContent');
  if (!summaryContent) return;
  const content = typeof summaryText === 'string' ? summaryText.trim() : '';
  summaryContent.innerHTML = `
    <div class="summary-content text-[15px] leading-7 text-gray-800 dark:text-slate-300 bg-white dark:bg-transparent">
      ${content ? formatSummaryMarkdown(content) : '<p class="text-gray-500 dark:text-slate-400">Đang cập nhật</p>'}
    </div>
  `;
};

export const renderStudyPlan = (studyPlan = []) => {
  const studyPlanList = document.querySelector('#studyPlanList');
  if (!studyPlanList) return;
  if (!Array.isArray(studyPlan) || studyPlan.length === 0) {
    studyPlanList.innerHTML = '<p class="text-slate-500 dark:text-slate-400">Không có dữ liệu</p>';
    return;
  }

  const safePlan = studyPlan.filter((day) => day && typeof day === 'object');
  if (safePlan.length === 0) {
    studyPlanList.innerHTML = '<p class="text-slate-500 dark:text-slate-400">Không có dữ liệu</p>';
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
              <span class="px-3 py-1 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 text-xs font-semibold">Ngày ${escapeHtml(day.day ?? '—')}</span>
              <h4 class="font-bold text-gray-900 dark:text-white">${escapeHtml(day.title ?? 'Đang cập nhật')}</h4>
            </div>
            <ul class="space-y-2">
              ${tasks.length ? tasks.map((task) => `<li class="flex gap-3 text-gray-800 dark:text-slate-300"><span class="mt-2 w-2 h-2 rounded-full bg-brand-500 shrink-0"></span><span>${escapeHtml(task)}</span></li>`).join('') : '<li class="text-gray-500 dark:text-slate-400">Không có dữ liệu</li>'}
            </ul>
          </div>
        </div>
      `;
        })
        .join('')}
    </div>
  `;
};
