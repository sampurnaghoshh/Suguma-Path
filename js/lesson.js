(function () {
'use strict';

/* ─────────────────────────────────────────────────────────────────
   lesson.js — dynamic lesson page (vocabulary flashcards + alphabet)
   ───────────────────────────────────────────────────────────────── */

const PROGRESS_KEY = 'sugamapath_kannada_progress';

let lessonData   = null;   /* full JSON */
let items        = [];     /* lesson items array */
let currentIndex = 0;
let isFlipped    = false;
let isSpeaking   = false;

/* ── localStorage helpers ───────────────────────────────────────── */

function getProgress(lessonId) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return all[lessonId] || { knownIds: [], itemsCompleted: [], stillLearningIds: [], lastVisited: null, quizScore: null };
  } catch {
    return { knownIds: [], itemsCompleted: [], stillLearningIds: [], lastVisited: null, quizScore: null };
  }
}

function saveProgress(lessonId, progress) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    all[lessonId] = progress;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch { /* storage unavailable */ }
}

/* ── URL helpers ────────────────────────────────────────────────── */

function getLessonId() {
  return new URLSearchParams(window.location.search).get('id');
}

/* ── DOM refs (populated after HTML is ready) ───────────────────── */

function el(id) { return document.getElementById(id); }

/* ── Fetch and boot ─────────────────────────────────────────────── */

async function init() {
  const lessonId = getLessonId();
  if (!lessonId) { showError('No lesson specified. <a href="learn.html">Back to lessons</a>'); return; }

  showLoading();

  try {
    const res = await fetch(`data/kannada-${lessonId}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    lessonData = await res.json();
    items      = lessonData.items || [];

    if (items.length === 0) { showError('This lesson has no items yet.'); return; }

    /* Resume from last position if partially done */
    const prog = getProgress(lessonId);
    prog.lastVisited = new Date().toISOString().slice(0, 10);
    saveProgress(lessonId, prog);

    /* Start at first un-known item, or 0 */
    const firstUnknown = items.findIndex(it => !prog.knownIds.includes(it.id));
    currentIndex = firstUnknown >= 0 ? firstUnknown : 0;

    renderPage();
  } catch (err) {
    showError(`Could not load lesson. <a href="learn.html">Back to lessons</a>`);
    console.error(err);
  }
}

/* ── Page scaffold ──────────────────────────────────────────────── */

function renderPage() {
  const main = el('lesson-main');
  if (!main) return;

  /* Inject page structure */
  main.innerHTML = `
    <!-- Sticky lesson header -->
    <div class="lesson-header" id="lesson-header" role="banner" aria-label="Lesson progress">
      <div class="container--narrow">
        <div class="lesson-header__inner">
          <a href="learn.html" class="lesson-back" aria-label="Back to all lessons">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Lessons
          </a>
          <div class="lesson-header__meta">
            <span class="lesson-header__title" id="header-title"></span>
            <span class="lesson-header__counter" id="header-counter" aria-live="polite"></span>
          </div>
        </div>
        <div class="progress-bar lesson-header__bar" role="progressbar" aria-label="Lesson progress"
             aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" id="header-progress-bar">
          <div class="progress-bar__fill" id="header-progress-fill" style="width:0%"></div>
        </div>
      </div>
    </div>

    <!-- Card stage -->
    <div class="lesson-stage" id="lesson-stage">
      <div class="container--narrow">
        <div class="lesson-card-wrap" id="card-wrap" aria-live="polite" aria-atomic="true">
          <!-- card rendered here -->
        </div>
      </div>
    </div>

    <!-- Completion screen (hidden initially) -->
    <div class="lesson-complete" id="lesson-complete" hidden>
      <div class="container--narrow">
        <div class="lesson-complete__inner">
          <div class="lesson-complete__icon" aria-hidden="true">✓</div>
          <h2 class="lesson-complete__title">Lesson complete</h2>
          <p class="lesson-complete__body" id="complete-body"></p>
          <div class="lesson-complete__actions">
            <button class="btn btn--primary" id="btn-quiz" type="button">Take Quiz</button>
            <button class="btn btn--ghost" id="btn-review" type="button">Review all cards</button>
            <a class="btn btn--ghost" href="learn.html">Back to lessons</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky action bar -->
    <div class="lesson-actions" id="lesson-actions" role="toolbar" aria-label="Lesson navigation">
      <div class="container--narrow">
        <div class="lesson-actions__inner">
          <button class="btn btn--ghost lesson-actions__btn" id="btn-prev" type="button"
                  aria-label="Previous card">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Prev
          </button>

          <div class="lesson-actions__center">
            <button class="btn lesson-actions__rate lesson-actions__rate--learning" id="btn-learning"
                    type="button" aria-label="Mark as still learning (L)">
              Still learning
            </button>
            <button class="btn lesson-actions__rate lesson-actions__rate--known" id="btn-known"
                    type="button" aria-label="Mark as known (K)">
              I knew it
            </button>
          </div>

          <button class="btn btn--ghost lesson-actions__btn" id="btn-next" type="button"
                  aria-label="Next card">
            Next
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M7 4l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div class="lesson-toast" id="lesson-toast" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  /* Populate header + browser tab */
  el('header-title').textContent = lessonData.title;
  if (typeof window.setLessonTitle === 'function') window.setLessonTitle(lessonData.title);

  /* Wire up action buttons */
  el('btn-prev').addEventListener('click', () => navigate(-1));
  el('btn-next').addEventListener('click', () => navigate(1));
  el('btn-known').addEventListener('click', () => markItem(true));
  el('btn-learning').addEventListener('click', () => markItem(false));
  el('btn-quiz').addEventListener('click', onQuiz);
  el('btn-review').addEventListener('click', onReview);

  bindKeyboard();
  goToCard(currentIndex);
}

/* ── Card rendering ─────────────────────────────────────────────── */

function goToCard(index) {
  currentIndex = Math.max(0, Math.min(index, items.length - 1));
  isFlipped    = false;

  const wrap = el('card-wrap');
  if (!wrap) return;

  const item = items[currentIndex];

  if (lessonData.type === 'alphabet') {
    wrap.innerHTML = renderAlphabetCard(item);
    wrap.querySelector('.alphabet-card__glyph-btn')
        ?.addEventListener('click', () => speakItem(item));
    wrap.querySelector('.alphabet-card__example-btn')
        ?.addEventListener('click', () => speakItem(item, true));
  } else {
    wrap.innerHTML = renderVocabCard(item);
    const card = wrap.querySelector('.flashcard');
    card?.addEventListener('click', flipCard);
    wrap.querySelector('.flashcard__speak-front')
        ?.addEventListener('click', e => { e.stopPropagation(); speakItem(item); });
    wrap.querySelector('.flashcard__speak-back')
        ?.addEventListener('click', e => { e.stopPropagation(); speakItem(item); });
  }

  updateHeader();
  updateActionBar();
}

function renderVocabCard(item) {
  const prog    = getProgress(lessonData.id);
  const isKnown = prog.knownIds.includes(item.id);
  const isLearning = prog.stillLearningIds.includes(item.id);
  const statusClass = isKnown ? 'flashcard--known' : isLearning ? 'flashcard--learning' : '';

  return `
    <div class="flashcard ${statusClass}" role="group" tabindex="0"
         aria-label="Flash card — click or press Space to flip"
         id="flashcard">
      <div class="flashcard__inner" id="flashcard-inner">

        <!-- Front -->
        <div class="flashcard__face flashcard__face--front">
          <div class="flashcard__hint">Tap to reveal</div>
          <div class="flashcard__kannada" lang="kn">${item.kannada}</div>
          <div class="flashcard__roman">${item.roman}</div>
          <button class="flashcard__speak flashcard__speak-front btn btn--ghost btn--small"
                  type="button" aria-label="Hear pronunciation">
            ${speakerIcon()}
            Listen
          </button>
          ${isKnown ? '<span class="flashcard__status flashcard__status--known">Known</span>' : ''}
          ${isLearning ? '<span class="flashcard__status flashcard__status--learning">Still learning</span>' : ''}
        </div>

        <!-- Back -->
        <div class="flashcard__face flashcard__face--back">
          <div class="flashcard__english">${item.english}</div>
          <div class="flashcard__context">${item.context}</div>
          ${item.scenario ? `
            <div class="flashcard__scenario">
              <span class="flashcard__scenario-label">In Bengaluru</span>
              ${item.scenario}
            </div>` : ''}
          <button class="flashcard__speak flashcard__speak-back btn btn--ghost btn--small"
                  type="button" aria-label="Hear pronunciation again">
            ${speakerIcon()}
            Listen again
          </button>
        </div>

      </div>
    </div>
    <p class="lesson-flip-hint" aria-hidden="true">
      <kbd>Space</kbd> to flip &nbsp;·&nbsp; <kbd>K</kbd> knew it &nbsp;·&nbsp; <kbd>L</kbd> still learning
    </p>
  `;
}

function renderAlphabetCard(item) {
  return `
    <div class="alphabet-card">
      <button class="alphabet-card__glyph-btn" type="button"
              aria-label="Tap to hear ${item.roman}">
        <span class="alphabet-card__glyph" lang="kn">${item.glyph}</span>
        <span class="alphabet-card__tap-hint">Tap to hear</span>
      </button>

      <div class="alphabet-card__details">
        <div class="alphabet-card__roman">${item.roman}</div>
        ${item.ipa ? `<div class="alphabet-card__ipa">/${item.ipa}/</div>` : ''}
      </div>

      ${item.example ? `
        <div class="alphabet-card__example">
          <button class="alphabet-card__example-btn" type="button"
                  aria-label="Hear example: ${item.exampleRoman}">
            ${speakerIcon(16)}
          </button>
          <span class="alphabet-card__example-word" lang="kn">${item.example}</span>
          <span class="alphabet-card__example-roman">${item.exampleRoman}</span>
          <span class="alphabet-card__example-meaning">— ${item.exampleMeaning}</span>
        </div>
      ` : ''}
    </div>
    <p class="lesson-flip-hint" aria-hidden="true">
      <kbd>Space</kbd> or <kbd>↵</kbd> to hear &nbsp;·&nbsp; <kbd>K</kbd> knew it &nbsp;·&nbsp; <kbd>L</kbd> still learning
    </p>
  `;
}

/* ── Flip ───────────────────────────────────────────────────────── */

function flipCard() {
  if (lessonData.type !== 'vocabulary') return;
  isFlipped = !isFlipped;

  const inner = el('flashcard-inner');
  const card  = el('flashcard');
  if (!inner || !card) return;

  inner.classList.toggle('is-flipped', isFlipped);
  card.setAttribute('aria-label', isFlipped
    ? 'Card is flipped — showing English meaning. Press Space to flip back.'
    : 'Flash card — press Space to flip');
}

/* ── Speak ──────────────────────────────────────────────────────── */

function speakItem(item, useExample) {
  if (!window.SugamaAudio?.isAvailable()) {
    showToast('Audio not supported in this browser');
    return;
  }
  if (isSpeaking) { window.SugamaAudio.stop(); }

  const text = useExample
    ? (item.example || item.glyph)
    : (item.kannada || item.glyph);

  isSpeaking = true;
  window.SugamaAudio.speak(text).finally(() => { isSpeaking = false; });
}

/* ── Mark item ──────────────────────────────────────────────────── */

function markItem(known) {
  if (!lessonData) return;

  const item = items[currentIndex];
  const prog = getProgress(lessonData.id);

  if (known) {
    if (!prog.knownIds.includes(item.id))      prog.knownIds.push(item.id);
    if (!prog.itemsCompleted.includes(item.id)) prog.itemsCompleted.push(item.id);
    prog.stillLearningIds = prog.stillLearningIds.filter(id => id !== item.id);
    showToast('Marked as known');
  } else {
    if (!prog.stillLearningIds.includes(item.id)) prog.stillLearningIds.push(item.id);
    prog.knownIds      = prog.knownIds.filter(id => id !== item.id);
    prog.itemsCompleted = prog.itemsCompleted.filter(id => id !== item.id);
    showToast('Added to review pile');
  }

  saveProgress(lessonData.id, prog);

  /* Check completion */
  if (prog.knownIds.length >= items.length) {
    showCompletion(prog);
    return;
  }

  /* Advance to next unknown item */
  let next = currentIndex + 1;
  if (next >= items.length) next = items.findIndex(it => !prog.knownIds.includes(it.id));
  if (next < 0) next = 0;

  setTimeout(() => goToCard(next), 300);
}

/* ── Navigate ───────────────────────────────────────────────────── */

function navigate(delta) {
  const target = currentIndex + delta;
  if (target < 0 || target >= items.length) return;
  goToCard(target);
}

/* ── Header / progress ──────────────────────────────────────────── */

function updateHeader() {
  const prog    = getProgress(lessonData.id);
  const known   = prog.knownIds.length;
  const total   = items.length;
  const pct     = Math.round((known / total) * 100);
  const counter = el('header-counter');
  const fill    = el('header-progress-fill');
  const bar     = el('header-progress-bar');

  if (counter) counter.textContent = `${currentIndex + 1} / ${total}`;
  if (fill)    fill.style.width    = `${pct}%`;
  if (bar)     bar.setAttribute('aria-valuenow', pct);
}

function updateActionBar() {
  const prev = el('btn-prev');
  const next = el('btn-next');
  if (prev) prev.disabled = currentIndex === 0;
  if (next) next.disabled = currentIndex === items.length - 1;
}

/* ── Completion ─────────────────────────────────────────────────── */

function showCompletion(prog) {
  const stage    = el('lesson-stage');
  const complete = el('lesson-complete');
  const actions  = el('lesson-actions');
  const body     = el('complete-body');

  if (stage)    stage.hidden    = true;
  if (actions)  actions.hidden  = true;
  if (complete) complete.hidden = false;

  const stillLearning = prog.stillLearningIds.length;
  if (body) {
    body.textContent = stillLearning > 0
      ? `You know ${items.length - stillLearning} of ${items.length} phrases. ${stillLearning} still in your review pile — the quiz will focus on those.`
      : `You know all ${items.length} phrases in this lesson. Take the quiz to lock them in.`;
  }
}

function onQuiz() {
  const complete = el('lesson-complete');
  const stage    = el('lesson-stage');
  const actions  = el('lesson-actions');

  if (complete) complete.hidden = true;
  if (stage)    stage.hidden    = false;
  if (actions)  actions.hidden  = true;

  if (window.SugamaQuiz) {
    window.SugamaQuiz.startQuiz(lessonData, items, {
      onFlashcards: function () {
        if (actions) actions.hidden = false;
        onReview();
      }
    });
  } else {
    showToast('Quiz not loaded — try refreshing the page');
  }
}

function onReview() {
  const stage    = el('lesson-stage');
  const complete = el('lesson-complete');
  const actions  = el('lesson-actions');

  if (stage)    stage.hidden    = false;
  if (actions)  actions.hidden  = false;
  if (complete) complete.hidden = true;

  goToCard(0);
}

/* ── Keyboard shortcuts ─────────────────────────────────────────── */

function bindKeyboard() {
  document.addEventListener('keydown', e => {
    /* Let quiz handle its own keyboard — buttons get Tab/Enter/Space natively */
    if (document.getElementById('quiz-container')) return;
    /* Skip when focus is inside an input or button (except our card) */
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    /* Allow our own buttons to pass through arrow / space only for the card */

    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        if (lessonData?.type === 'vocabulary') {
          flipCard();
        } else {
          speakItem(items[currentIndex]);
        }
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        navigate(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        navigate(-1);
        break;
      case 'k':
      case 'K':
        markItem(true);
        break;
      case 'l':
      case 'L':
        markItem(false);
        break;
      case 'Escape':
        window.SugamaAudio?.stop();
        break;
    }
  });
}

/* ── Loading / error states ─────────────────────────────────────── */

function showLoading() {
  const main = el('lesson-main');
  if (main) main.innerHTML = `
    <div class="lesson-loading" aria-label="Loading lesson" aria-busy="true">
      <div class="lesson-loading__spinner" aria-hidden="true"></div>
      <p>Loading lesson…</p>
    </div>`;
}

function showError(html) {
  const main = el('lesson-main');
  if (main) main.innerHTML = `
    <div class="lesson-error container--narrow">
      <p>${html}</p>
    </div>`;
}

/* ── Toast ──────────────────────────────────────────────────────── */

let toastTimer = null;

function showToast(msg) {
  const toast = el('lesson-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

/* ── Icons ──────────────────────────────────────────────────────── */

function speakerIcon(size) {
  size = size || 14;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
}

/* ── Boot ───────────────────────────────────────────────────────── */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
