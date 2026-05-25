/**
 * settings.js — SugamaPath shared settings manager
 *
 * Loads, saves, and applies user preferences across all pages.
 * Every page imports this script. It reads localStorage on page load
 * and immediately applies settings to <body> so there's no flash.
 *
 * Settings shape (stored as JSON under key "sugamapath_settings"):
 * {
 *   theme:          'cream' | 'dark' | 'high-contrast',
 *   font:           'lexend' | 'dyslexic',
 *   fontSize:       number (rem, 0.85–2.0),
 *   lineHeight:     number (1.4–2.8),
 *   letterSpacing:  number (0–0.2, in em),
 *   wordSpacing:    number (0–0.5, in em),
 *   ttsRate:        number (0.5–2.0),
 *   ttsPitch:       number (0.5–2.0),
 *   ttsVoiceURI:    string | null,
 *   lineFocus:      boolean,
 *   bionicReading:  boolean,
 *   cursorRuler:    boolean,
 *   reduceMotion:   boolean,
 * }
 */

const STORAGE_KEY = 'sugamapath_settings';

/** Default values — safe, accessible baseline */
const DEFAULTS = {
  theme:         'cream',
  font:          'lexend',
  fontSize:      1.0,
  lineHeight:    1.85,
  letterSpacing: 0.04,
  wordSpacing:   0.12,
  ttsRate:       0.85,
  ttsPitch:      1.0,
  ttsVoiceURI:   null,
  lineFocus:     false,
  bionicReading: false,
  cursorRuler:   false,
  reduceMotion:  false,
};

/**
 * Load settings from localStorage, merging with defaults
 * so new settings added in future updates don't break old saves.
 */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Persist the full settings object to localStorage.
 * Always saves the complete merged object to avoid partial state.
 */
function saveSettings(partial) {
  const current = loadSettings();
  const merged = { ...current, ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('SugamaPath: could not save settings', e);
  }
  return merged;
}

/**
 * Apply the settings object to the document.
 * Called on page load and whenever a setting changes.
 */
function applySettings(settings) {
  // Use <html> (documentElement) so this is safe when called from <head>
  // scripts where document.body is still null. Theme/font classes on <html>
  // cascade identically to all children via CSS custom properties.
  const root = document.documentElement;

  /* --- Theme --- */
  root.classList.remove('theme-dark', 'theme-high-contrast');
  if (settings.theme === 'dark') {
    root.classList.add('theme-dark');
  } else if (settings.theme === 'high-contrast') {
    root.classList.add('theme-high-contrast');
  }

  /* --- Font --- */
  root.classList.toggle('font-dyslexic', settings.font === 'dyslexic');

  /* --- Reading CSS custom properties --- */
  root.style.setProperty('--reading-font-size',      `${settings.fontSize}rem`);
  root.style.setProperty('--reading-line-height',    `${settings.lineHeight}`);
  root.style.setProperty('--reading-letter-spacing', `${settings.letterSpacing}em`);
  root.style.setProperty('--reading-word-spacing',   `${settings.wordSpacing}em`);

  /* --- Reduce motion --- */
  if (settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.style.setProperty('--transition-fast', '0ms');
    root.style.setProperty('--transition-base', '0ms');
    root.style.setProperty('--transition-slow', '0ms');
  }
}

/**
 * Update a single setting, persist it, reapply everything.
 * Returns the full merged settings so callers can update their UI.
 */
function updateSetting(key, value) {
  const updated = saveSettings({ [key]: value });
  applySettings(updated);
  // Dispatch a custom event so other scripts on the same page can react
  document.dispatchEvent(new CustomEvent('sugamapath:settingschange', {
    detail: { key, value, settings: updated }
  }));
  return updated;
}

/**
 * Reset all settings to defaults.
 */
function resetSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  applySettings(DEFAULTS);
  return { ...DEFAULTS };
}

/**
 * Sync a set of form controls to the current settings.
 * Looks for elements with data-setting="key" attributes.
 */
function syncControlsToSettings(settings, container = document) {
  container.querySelectorAll('[data-setting]').forEach(el => {
    const key = el.dataset.setting;
    if (!(key in settings)) return;
    const val = settings[key];

    if (el.type === 'checkbox') {
      el.checked = Boolean(val);
    } else if (el.type === 'range') {
      el.value = val;
    } else if (el.tagName === 'SELECT') {
      el.value = val;
    } else {
      el.value = val;
    }
  });
}

/**
 * Wire up all controls with data-setting attribute.
 * Automatically persists changes on 'input' or 'change'.
 */
function wireSettingControls(container = document) {
  container.querySelectorAll('[data-setting]').forEach(el => {
    const key = el.dataset.setting;

    const handler = () => {
      let value;
      if (el.type === 'checkbox') {
        value = el.checked;
      } else if (el.type === 'range' || el.type === 'number') {
        value = parseFloat(el.value);
      } else {
        value = el.value;
      }
      updateSetting(key, value);
    };

    // Use 'input' for sliders (live feedback), 'change' for selects/checkboxes
    const event = (el.type === 'range') ? 'input' : 'change';
    el.addEventListener(event, handler);
  });
}

/* ==========================================================================
   Progress Tracking (streaks, lessons completed)
   Stored separately under "sugamapath_progress"
   ========================================================================== */
const PROGRESS_KEY = 'sugamapath_progress';

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {
      streak: 0,
      lastActive: null,
      completedLessons: [],      // array of lesson IDs
      vocabularyNotebook: [],    // array of { word, lang, meaning, addedAt }
      quizScores: {},            // lessonId → { correct, total, lastAttempt }
    };
  } catch {
    return { streak: 0, lastActive: null, completedLessons: [], vocabularyNotebook: [], quizScores: {} };
  }
}

function saveProgress(partial) {
  const current = loadProgress();
  const merged = { ...current, ...partial };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('SugamaPath: could not save progress', e);
  }
  return merged;
}

/** Mark a lesson completed and update streak. */
function markLessonComplete(lessonId) {
  const progress = loadProgress();
  const today = new Date().toDateString();

  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
  }

  // Update streak: +1 if last active was yesterday, reset if gap > 1 day
  if (progress.lastActive) {
    const last = new Date(progress.lastActive);
    const now = new Date();
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      progress.streak += 1;
    } else if (diffDays > 1) {
      progress.streak = 1;
    }
    // diffDays === 0 → same day, streak stays
  } else {
    progress.streak = 1;
  }

  progress.lastActive = today;
  saveProgress(progress);
  return progress;
}

/** Add a word to the vocabulary notebook. */
function addToNotebook(entry) {
  const progress = loadProgress();
  const exists = progress.vocabularyNotebook.some(w => w.word === entry.word && w.lang === entry.lang);
  if (!exists) {
    progress.vocabularyNotebook.push({ ...entry, addedAt: Date.now() });
    saveProgress(progress);
  }
  return progress;
}

/* ==========================================================================
   Init — run immediately when this script loads
   ========================================================================== */
(function init() {
  const settings = loadSettings();
  applySettings(settings);
})();

/* Export to global scope so all pages can use these helpers */
window.SugamaPath = {
  loadSettings,
  saveSettings,
  updateSetting,
  resetSettings,
  applySettings,
  syncControlsToSettings,
  wireSettingControls,
  loadProgress,
  saveProgress,
  markLessonComplete,
  addToNotebook,
};
