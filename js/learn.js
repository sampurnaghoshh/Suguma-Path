(function () {
'use strict';

/* ─────────────────────────────────────────────────────────────────
   learn.js — Lesson grid rendering and progress display
   ───────────────────────────────────────────────────────────────── */

const LESSONS = [
  {
    id: 'greetings',
    num: '01',
    title: 'Greetings & First Words',
    titleKannada: 'ನಮಸ್ಕಾರ ಮತ್ತು ಮೊದಲ ಮಾತುಗಳು',
    subtitle: 'Break the ice with locals',
    description: 'Hello, thank you, sorry, yes, no. The phrases that make every interaction warmer. Locals notice when you try.',
    estimatedMinutes: 8,
    count: 15,
    type: 'vocabulary',
    priority: 'core'
  },
  {
    id: 'conversation',
    num: '02',
    title: 'Daily Conversation',
    titleKannada: 'ದಿನನಿತ್ಯದ ಮಾತುಕತೆ',
    subtitle: 'Introduce yourself and get by',
    description: "The handful of phrases you'll repeat constantly when meeting new people — your PG owner, your auto driver, your neighbor.",
    estimatedMinutes: 8,
    count: 10,
    type: 'vocabulary',
    priority: 'core'
  },
  {
    id: 'getting-around',
    num: '03',
    title: 'Getting Around Bengaluru',
    titleKannada: 'ಬೆಂಗಳೂರಿನಲ್ಲಿ ಓಡಾಟ',
    subtitle: 'Autos, directions, and surviving the chaos',
    description: "Survive the auto rickshaw negotiation, ask for directions in Bengaluru's chaos, find your way back home.",
    estimatedMinutes: 12,
    count: 15,
    type: 'vocabulary',
    priority: 'core'
  },
  {
    id: 'food',
    num: '04',
    title: 'Food & Restaurants',
    titleKannada: 'ಆಹಾರ ಮತ್ತು ಹೋಟೆಲ್',
    subtitle: 'Order, eat, and pay like a local',
    description: "Whether it's a Darshini, a mess, or a fancy restaurant — handle ordering, dietary preferences, and the bill.",
    estimatedMinutes: 10,
    count: 15,
    type: 'vocabulary',
    priority: 'core'
  },
  {
    id: 'shopping',
    num: '05',
    title: 'Shopping & Money',
    titleKannada: 'ಖರೀದಿ ಮತ್ತು ಹಣ',
    subtitle: 'Numbers, prices, and bargaining',
    description: 'From vegetable vendors at HSR to electronics shops on SP Road — count, ask prices, and bargain confidently.',
    estimatedMinutes: 10,
    count: 15,
    type: 'vocabulary',
    priority: 'core'
  },
  {
    id: 'emergencies',
    num: '06',
    title: 'Help & Emergencies',
    titleKannada: 'ಸಹಾಯ ಮತ್ತು ತುರ್ತು',
    subtitle: 'When something goes wrong',
    description: "Phrases for when something goes wrong — feeling sick, needing a doctor, asking for help, being lost.",
    estimatedMinutes: 8,
    count: 12,
    type: 'vocabulary',
    priority: 'core'
  },
  {
    id: 'vowels',
    num: '07',
    title: 'Bonus: Kannada Vowels',
    titleKannada: 'ಕನ್ನಡ ಸ್ವರಗಳು',
    subtitle: 'If you want to learn the script',
    description: 'Optional: learn to read Kannada signs and menus. Start with the 16 vowels (swaras).',
    estimatedMinutes: 12,
    count: 16,
    type: 'alphabet',
    priority: 'bonus'
  },
  {
    id: 'consonants',
    num: '08',
    title: 'Bonus: Kannada Consonants',
    titleKannada: 'ಕನ್ನಡ ವ್ಯಂಜನಗಳು',
    subtitle: 'Read signs, menus, and bus boards',
    description: 'Optional: the consonants that combine with vowels to form every Kannada word.',
    estimatedMinutes: 15,
    count: 23,
    type: 'alphabet',
    priority: 'bonus'
  }
];

const PROGRESS_KEY = 'sugamapath_kannada_progress';

function getProgress(lessonId) {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return data[lessonId] || { itemsCompleted: [], quizScore: null, lastVisited: null };
  } catch {
    return { itemsCompleted: [], quizScore: null, lastVisited: null };
  }
}

function formatTime(minutes) {
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} hr`;
}

function clockIcon() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
}

function arrowIcon() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderCard(lesson) {
  const progress = getProgress(lesson.id);
  const completed = progress.itemsCompleted.length;
  const pct = lesson.count > 0 ? Math.min(100, Math.round((completed / lesson.count) * 100)) : 0;
  const isComplete = pct === 100;
  const isStarted = completed > 0;

  const typeLabel = lesson.type === 'alphabet' ? 'Script' : 'Vocabulary';

  const progressLabel = isComplete
    ? 'Complete'
    : isStarted
    ? `${completed} of ${lesson.count} phrases`
    : 'Not started';

  const ctaLabel = isComplete ? 'Review' : isStarted ? 'Continue' : 'Start lesson';

  const quizBadge = progress.quizScore != null && progress.quizScore > 0
    ? `<span class="lesson-card__badge lesson-card__badge--quiz">Quiz: ${progress.quizScore}/5 ★</span>`
    : '';

  const card = document.createElement('a');
  card.href = `lesson.html?id=${lesson.id}`;
  card.className = `lesson-card${isComplete ? ' lesson-card--complete' : ''} reveal`;
  card.dataset.priority = lesson.priority;
  card.setAttribute('aria-label', `${lesson.title} — ${progressLabel}`);

  card.innerHTML = `
    <div class="lesson-card__header">
      <span class="lesson-card__num" aria-hidden="true">${lesson.num}</span>
      <span class="lesson-card__type lesson-card__type--${lesson.type}">${typeLabel}</span>
    </div>

    <div class="lesson-card__body">
      <h3 class="lesson-card__title">${lesson.title}</h3>
      <div class="lesson-card__subtitle">${lesson.subtitle}</div>
      <div class="lesson-card__title-kn" aria-hidden="true">${lesson.titleKannada}</div>
      <p class="lesson-card__desc">${lesson.description}</p>
    </div>

    <div class="lesson-card__meta">
      <span class="lesson-card__badge">
        ${clockIcon()}
        ${formatTime(lesson.estimatedMinutes)}
      </span>
      <span class="lesson-card__badge">${lesson.count} items</span>
      ${quizBadge}
    </div>

    <div
      class="lesson-card__progress-wrap"
      role="progressbar"
      aria-valuenow="${pct}"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="${pct}% complete"
    >
      <div
        class="lesson-card__progress-bar${isComplete ? ' lesson-card__progress-bar--complete' : ''}"
        style="width: ${pct}%"
      ></div>
    </div>

    <div class="lesson-card__progress-label">
      <span>${progressLabel}</span>
      ${pct > 0 ? `<span class="lesson-card__pct${isComplete ? ' lesson-card__pct--complete' : ''}">${pct}%</span>` : ''}
    </div>

    <span class="lesson-card__cta${isComplete ? ' lesson-card__cta--done' : ''}" aria-hidden="true">
      ${ctaLabel}
      ${arrowIcon()}
    </span>
  `;

  return card;
}

function renderSeparator() {
  const sep = document.createElement('div');
  sep.className = 'lesson-grid__separator';
  sep.setAttribute('role', 'separator');
  sep.setAttribute('aria-label', 'Bonus script lessons');
  sep.innerHTML = `<span class="lesson-grid__sep-label">Optional — Learn the Script</span>`;
  return sep;
}

function renderSummary() {
  const summaryEl = document.getElementById('learn-summary');
  if (!summaryEl) return;

  const coreOnly = LESSONS.filter(l => l.priority === 'core');
  const totalMinutes = coreOnly.reduce((sum, l) => sum + l.estimatedMinutes, 0);
  const totalItems   = LESSONS.reduce((sum, l) => sum + l.count, 0);

  let completedItems   = 0;
  let completedLessons = 0;

  LESSONS.forEach(lesson => {
    const p = getProgress(lesson.id);
    completedItems += p.itemsCompleted.length;
    if (p.itemsCompleted.length >= lesson.count) completedLessons++;
  });

  const overallPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  summaryEl.innerHTML = `
    <span class="learn-summary__stat">
      ${clockIcon()}
      ~${formatTime(totalMinutes)} core lessons
    </span>
    <span class="learn-summary__sep" aria-hidden="true"></span>
    <span class="learn-summary__stat">
      ${LESSONS.length} lessons total
    </span>
    <span class="learn-summary__sep" aria-hidden="true"></span>
    <span class="learn-summary__stat">
      ${completedLessons} completed
    </span>
    ${overallPct > 0 ? `
      <span class="learn-summary__overall" aria-label="Overall progress: ${overallPct}%">
        ${overallPct}% overall
      </span>
    ` : ''}
  `;
}

function renderGrid() {
  const grid = document.getElementById('lesson-grid');
  if (!grid) return;

  grid.innerHTML = '';

  LESSONS.forEach((lesson, i) => {
    /* Inject separator at the core → bonus boundary */
    if (lesson.priority === 'bonus' && (i === 0 || LESSONS[i - 1].priority === 'core')) {
      grid.appendChild(renderSeparator());
    }
    grid.appendChild(renderCard(lesson));
  });

  /* Wire up IntersectionObserver for the freshly created cards */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          const el       = e.target;
          const siblings = [...grid.querySelectorAll('.reveal')];
          const idx      = siblings.indexOf(el);
          el.style.transitionDelay = `${Math.min(idx * 50, 250)}ms`;
          el.classList.add('is-visible');
          observer.unobserve(el);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    grid.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  } else {
    grid.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
  }
}

function init() {
  renderSummary();
  renderGrid();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
