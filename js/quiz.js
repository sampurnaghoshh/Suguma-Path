(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────
     quiz.js — 5-question multiple-choice quiz for each lesson
     Exposed as window.SugamaQuiz
     ───────────────────────────────────────────────────────────────── */

  const PROGRESS_KEY = 'sugamapath_kannada_progress';
  const QUIZ_SIZE    = 5;

  let state = null;   /* active quiz state */

  /* ── Utility ───────────────────────────────────────────────────── */

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function el(id) { return document.getElementById(id); }

  /* Minimal HTML escaping for injected strings */
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Question building ─────────────────────────────────────────── */

  function buildQuestions(lessonData, allItems) {
    const isAlphabet  = lessonData.type === 'alphabet';
    const hasScenario = !isAlphabet && allItems.some(it => it.scenario);
    const count       = Math.min(QUIZ_SIZE, allItems.length);

    /* Pick N distinct items */
    const selected = shuffle([...allItems]).slice(0, count);

    /* Build a shuffled pool of question types */
    let typePool;
    if (isAlphabet) {
      typePool = shuffle(['A', 'B', 'A', 'B', 'A'].slice(0, count));
    } else if (hasScenario) {
      typePool = shuffle(['A', 'B', 'A', 'B', 'C'].slice(0, count));
    } else {
      typePool = shuffle(['A', 'B', 'A', 'B', 'A'].slice(0, count));
    }

    return selected.map((item, i) => {
      let type = typePool[i];
      /* Scenario type requires a scenario field on this specific item */
      if (type === 'C' && !item.scenario) type = 'A';
      return buildOneQuestion(type, item, allItems, isAlphabet);
    });
  }

  function buildOneQuestion(type, item, allItems, isAlphabet) {
    /* 3 distractors from the full item pool, never the same item */
    const pool        = allItems.filter(d => d.id !== item.id);
    const distractors = shuffle(pool).slice(0, 3);

    if (type === 'A') {
      /* ── Kannada / glyph  →  meaning / romanisation ─────────────── */
      if (isAlphabet) {
        return {
          type: 'kannada-to-english',
          prompt: { label: 'What sound does this character make?', main: item.glyph, isKannada: true },
          options: shuffle([
            { text: item.roman, isCorrect: true },
            ...distractors.map(d => ({ text: d.roman, isCorrect: false }))
          ])
        };
      }
      return {
        type: 'kannada-to-english',
        prompt: { label: 'What does this mean?', main: item.kannada, sub: item.roman, isKannada: true },
        options: shuffle([
          { text: item.english, isCorrect: true },
          ...distractors.map(d => ({ text: d.english, isCorrect: false }))
        ])
      };
    }

    if (type === 'B') {
      /* ── English / romanisation  →  Kannada / glyph ─────────────── */
      if (isAlphabet) {
        return {
          type: 'english-to-kannada',
          prompt: { label: 'Which character makes this sound?', main: item.roman, isKannada: false },
          options: shuffle([
            { text: item.glyph, isKannada: true, isCorrect: true },
            ...distractors.map(d => ({ text: d.glyph, isKannada: true, isCorrect: false }))
          ])
        };
      }
      return {
        type: 'english-to-kannada',
        prompt: { label: 'How do you say this in Kannada?', main: item.english, isKannada: false },
        options: shuffle([
          { text: item.kannada, sub: item.roman, isCorrect: true },
          ...distractors.map(d => ({ text: d.kannada, sub: d.roman, isCorrect: false }))
        ])
      };
    }

    /* type === 'C': scenario recognition */
    return {
      type: 'scenario',
      prompt: { label: 'When would you use this phrase?', main: item.kannada, sub: item.english, isKannada: true },
      options: shuffle([
        { text: item.scenario, isCorrect: true },
        ...distractors.map(d => ({ text: d.scenario || d.context, isCorrect: false }))
      ])
    };
  }

  /* ── Entry point ───────────────────────────────────────────────── */

  function startQuiz(lessonData, items, callbacks) {
    state = {
      lessonData,
      items,
      callbacks: callbacks || {},
      questions: buildQuestions(lessonData, items),
      currentQ:  0,
      answers:   []   /* 'correct' | 'wrong' per question */
    };
    showQuestion(0);
  }

  /* ── Rendering ─────────────────────────────────────────────────── */

  function showQuestion(index) {
    const wrap = el('card-wrap');
    if (!wrap) return;

    state.currentQ = index;
    syncHeader(index);

    const q     = state.questions[index];
    const qNum  = index + 1;
    const total = state.questions.length;

    wrap.innerHTML = `
      <div class="quiz-container" id="quiz-container">
        ${dotsHTML(index, total, state.answers)}

        <div class="quiz-question">
          <div class="quiz-question__number">Question ${qNum} of ${total}</div>
          <div class="quiz-question__label">${esc(q.prompt.label)}</div>
          <div class="quiz-question__prompt${q.prompt.isKannada ? ' quiz-question__prompt--kannada' : ''}"
               lang="${q.prompt.isKannada ? 'kn' : 'en'}">
            ${esc(q.prompt.main)}
          </div>
          ${q.prompt.sub
            ? `<div class="quiz-question__sub" lang="${q.prompt.isKannada ? 'en' : 'kn'}">${esc(q.prompt.sub)}</div>`
            : ''}
        </div>

        <div class="quiz-options" role="group" aria-label="Answer options">
          ${q.options.map((opt, i) => `
            <button
              class="quiz-option${opt.isKannada ? ' quiz-option--kannada' : ''}"
              type="button"
              data-idx="${i}"
              data-correct="${opt.isCorrect}"
              aria-label="Option ${i + 1}: ${esc(opt.text)}"
            >
              <span class="quiz-option__text" lang="${opt.isKannada ? 'kn' : 'en'}">${esc(opt.text)}</span>
              ${opt.sub ? `<span class="quiz-option__sub">${esc(opt.sub)}</span>` : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    wrap.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => handleAnswer(btn, btn.dataset.correct === 'true', index));
    });
  }

  function dotsHTML(currentIdx, total, answers) {
    return `<div class="quiz-progress" aria-hidden="true">${
      Array.from({ length: total }, (_, i) => {
        let cls = 'quiz-progress__dot';
        if (i < answers.length) {
          cls += answers[i] === 'correct'
            ? ' quiz-progress__dot--answered-correct'
            : ' quiz-progress__dot--answered-wrong';
        } else if (i === currentIdx) {
          cls += ' quiz-progress__dot--current';
        }
        return `<div class="${cls}"></div>`;
      }).join('')
    }</div>`;
  }

  /* ── Answer handling ───────────────────────────────────────────── */

  function handleAnswer(clickedBtn, isCorrect, qIndex) {
    const allBtns = clickedBtn.closest('.quiz-options').querySelectorAll('.quiz-option');
    allBtns.forEach(b => { b.disabled = true; });

    if (isCorrect) {
      clickedBtn.classList.add('quiz-option--correct');
      clickedBtn.querySelector('.quiz-option__text').insertAdjacentHTML(
        'afterend', '<span class="quiz-option__mark" aria-hidden="true">✓</span>'
      );
      state.answers[qIndex] = 'correct';
    } else {
      clickedBtn.classList.add('quiz-option--wrong');
      clickedBtn.querySelector('.quiz-option__text').insertAdjacentHTML(
        'afterend', '<span class="quiz-option__mark" aria-hidden="true">✗</span>'
      );
      state.answers[qIndex] = 'wrong';
      /* Reveal correct answer */
      allBtns.forEach(b => {
        if (b.dataset.correct === 'true') {
          b.classList.add('quiz-option--correct');
          b.querySelector('.quiz-option__text').insertAdjacentHTML(
            'afterend', '<span class="quiz-option__mark" aria-hidden="true">✓</span>'
          );
        }
      });
    }

    const delay = isCorrect ? 800 : 1500;
    setTimeout(() => {
      if (qIndex + 1 >= state.questions.length) {
        showResults();
      } else {
        showQuestion(qIndex + 1);
      }
    }, delay);
  }

  /* ── Results ───────────────────────────────────────────────────── */

  function showResults() {
    const score = state.answers.filter(a => a === 'correct').length;
    const total = state.questions.length;

    saveScore(state.lessonData.id, score);

    const MESSAGES = [
      /* 0 */ { title: 'Keep at it',      detail: "Take another look at the lesson — you've got this." },
      /* 1 */ { title: 'Keep at it',      detail: "Take another look at the lesson — you've got this." },
      /* 2 */ { title: 'Worth another try', detail: 'Repetition is how it sticks — give it another go.' },
      /* 3 */ { title: 'Good progress',   detail: 'Solid effort — try once more to lock it in.' },
      /* 4 */ { title: 'Great work',      detail: 'Almost perfect — one more try to nail it.' },
      /* 5 */ { title: 'Perfect!',        detail: 'ಭಲೇ! You nailed every question.' }
    ];
    const msg = MESSAGES[Math.min(score, MESSAGES.length - 1)];

    const wrap = el('card-wrap');
    if (!wrap) return;

    syncHeader(total);   /* 100 % progress bar */

    wrap.innerHTML = `
      <div class="quiz-results" id="quiz-container">
        <div class="quiz-results__score" aria-label="${score} out of ${total}">
          ${score}<span class="quiz-results__score-denom">/${total}</span>
        </div>
        <h2 class="quiz-results__message">${esc(msg.title)}</h2>
        <p class="quiz-results__detail">${esc(msg.detail)}</p>
        <div class="quiz-results__actions">
          <button class="btn btn--primary" id="quiz-btn-retake"      type="button">Retake quiz</button>
          <button class="btn btn--ghost"   id="quiz-btn-flashcards"  type="button">Back to flashcards</button>
          <a      class="btn btn--ghost"   href="learn.html">Back to lessons</a>
        </div>
      </div>
    `;

    el('quiz-btn-retake')?.addEventListener('click', () => {
      startQuiz(state.lessonData, state.items, state.callbacks);
    });

    el('quiz-btn-flashcards')?.addEventListener('click', () => {
      if (typeof state.callbacks.onFlashcards === 'function') {
        state.callbacks.onFlashcards();
      }
    });
  }

  /* ── Header sync ───────────────────────────────────────────────── */

  function syncHeader(questionIndex) {
    const counter = el('header-counter');
    const fill    = el('header-progress-fill');
    const bar     = el('header-progress-bar');
    const total   = state.questions.length;
    const done    = questionIndex >= total;

    if (counter) counter.textContent = done
      ? `${total} / ${total} done`
      : `Q ${questionIndex + 1} / ${total}`;

    const pct = total > 0 ? Math.round((questionIndex / total) * 100) : 0;
    if (fill) fill.style.width = `${pct}%`;
    if (bar)  bar.setAttribute('aria-valuenow', pct);
  }

  /* ── localStorage ──────────────────────────────────────────────── */

  function saveScore(lessonId, score) {
    try {
      const all  = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      const prog = all[lessonId] || {};
      if (prog.quizScore == null || score > prog.quizScore) prog.quizScore = score;
      prog.quizAttempts = (prog.quizAttempts || 0) + 1;
      all[lessonId] = prog;
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    } catch { /* quota exceeded or private browsing — silent */ }
  }

  /* ── Export ────────────────────────────────────────────────────── */

  window.SugamaQuiz = { startQuiz };

})();
