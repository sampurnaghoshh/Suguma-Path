/**
 * reading.js — SugamaPath Reading Tool
 *
 * Handles:
 *  - Tab switching (Paste Text / From URL / Upload PDF)
 *  - Formatting pasted plain text into readable HTML
 *  - Fetching URLs via Wikipedia REST API or CORS proxy chain + Readability.js
 *  - PDF text extraction via SugamaPDF (pdf-extract.js + PDF.js)
 *  - Reading Mode: Original / Simplified / Summary (via Groq AI)
 *  - Real-time accessibility control updates (font, sliders)
 *  - Persisting reading settings via SugamaPath.saveSettings
 */

document.addEventListener('DOMContentLoaded', init);

function init() {

  /* =========================================================================
     DOM references
     ========================================================================= */
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Paste tab
  const textarea  = document.getElementById('text-input');
  const charCount = document.getElementById('char-count');
  const formatBtn = document.getElementById('format-btn');

  // URL tab
  const urlInput = document.getElementById('url-input');
  const fetchBtn = document.getElementById('fetch-btn');

  // PDF tab
  const pdfDropzone = document.getElementById('pdf-dropzone');
  const pdfFileInput = document.getElementById('pdf-input');
  const pdfPanel     = document.getElementById('panel-pdf');

  // Font toggle
  const fontBtns = document.querySelectorAll('.font-toggle__btn');

  // AI Reading Mode controls
  const modeBtns          = document.querySelectorAll('.mode-btn');
  const levelBtns         = document.querySelectorAll('.level-btn');
  const formatBtns        = document.querySelectorAll('.format-btn');
  const modeSubSimplified = document.getElementById('mode-sub-simplified');
  const modeSubSummary    = document.getElementById('mode-sub-summary');

  // Translation dropdown
  const translateSelect = document.getElementById('translate-select');

  // Sliders + live-value displays
  const sliders = {
    fontSize:      document.getElementById('slider-font-size'),
    lineHeight:    document.getElementById('slider-line-height'),
    letterSpacing: document.getElementById('slider-letter-spacing'),
    wordSpacing:   document.getElementById('slider-word-spacing'),
  };
  const displays = {
    fontSize:      document.getElementById('val-font-size'),
    lineHeight:    document.getElementById('val-line-height'),
    letterSpacing: document.getElementById('val-letter-spacing'),
    wordSpacing:   document.getElementById('val-word-spacing'),
  };

  const resetBtn    = document.getElementById('reset-controls');
  const readingArea = document.getElementById('reading-area');


  /* =========================================================================
     Reading-specific settings
     ========================================================================= */
  const READING_DEFAULTS = {
    font:          'lexend',
    fontSize:      18,
    lineHeight:    1.85,
    letterSpacing: 0.04,
    wordSpacing:   0.12,
  };

  const SLIDER_CONFIG = [
    { key: 'fontSize',      prop: '--r-font-size',      format: v => `${v}px`,                        saveKey: 'rFontSize',      ariaUnit: 'pixels' },
    { key: 'lineHeight',    prop: '--r-line-height',    format: v => `${parseFloat(v).toFixed(2)}`,   saveKey: 'rLineHeight',    ariaUnit: '' },
    { key: 'letterSpacing', prop: '--r-letter-spacing', format: v => `${parseFloat(v).toFixed(3)}em`, saveKey: 'rLetterSpacing', ariaUnit: 'em' },
    { key: 'wordSpacing',   prop: '--r-word-spacing',   format: v => `${parseFloat(v).toFixed(2)}em`, saveKey: 'rWordSpacing',   ariaUnit: 'em' },
  ];

  const saved = window.SugamaPath.loadSettings();
  let state = {
    font:          saved.font                                    || READING_DEFAULTS.font,
    fontSize:      saved.rFontSize      != null ? saved.rFontSize      : READING_DEFAULTS.fontSize,
    lineHeight:    saved.rLineHeight    != null ? saved.rLineHeight    : READING_DEFAULTS.lineHeight,
    letterSpacing: saved.rLetterSpacing != null ? saved.rLetterSpacing : READING_DEFAULTS.letterSpacing,
    wordSpacing:   saved.rWordSpacing   != null ? saved.rWordSpacing   : READING_DEFAULTS.wordSpacing,
  };


  /* =========================================================================
     AI Reading Mode state + cache
     ========================================================================= */
  const aiMode = {
    mode:            'original',   // 'original' | 'simplified' | 'summary'
    level:           2,            // 1 | 2 | 3
    format:          'keypoints',  // 'keypoints' | 'tldr'
    translateLanguage: 'none',     // 'none' | language name e.g. 'Hindi'
  };

  const aiCache = {
    originalHtml:       null,  // HTML from paste/fetch — never mutated by AI
    originalText:       null,  // plain text sent to Groq
    results:            {},    // cacheKey → { html, text }
    translationResults: {},    // `${baseKey}__${lang}` → HTML string
  };

  // BCP47 language code map for lang/dir attributes
  const LANG_CODES = {
    Hindi: 'hi', Bengali: 'bn', Tamil: 'ta', Telugu: 'te', Kannada: 'kn',
    Malayalam: 'ml', Marathi: 'mr', Gujarati: 'gu', Punjabi: 'pa', Odia: 'or',
    Urdu: 'ur', Spanish: 'es', French: 'fr', German: 'de', Portuguese: 'pt',
    Japanese: 'ja', 'Chinese (Simplified)': 'zh', Arabic: 'ar', Russian: 'ru',
    Indonesian: 'id',
  };
  const RTL_LANGS = new Set(['ar', 'ur']);

  // Debounce timer for applyAIMode — prevents rapid-fire API calls
  let aiDebounceTimer = null;


  /* =========================================================================
     Tab switching
     ========================================================================= */
  tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => activateTab(index));

    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (index + 1) % tabBtns.length;
        activateTab(next);
        tabBtns[next].focus();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (index - 1 + tabBtns.length) % tabBtns.length;
        activateTab(prev);
        tabBtns[prev].focus();
      }
    });
  });

  function activateTab(index) {
    tabBtns.forEach((b, i) => {
      b.setAttribute('aria-selected', i === index ? 'true' : 'false');
      b.setAttribute('tabindex', i === index ? '0' : '-1');
    });
    tabPanels.forEach((p, i) => { p.hidden = i !== index; });
  }


  /* =========================================================================
     Paste Text tab
     ========================================================================= */
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charCount.textContent = len.toLocaleString() + (len === 1 ? ' char' : ' chars');
  });

  textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      formatBtn.click();
    }
  });

  formatBtn.addEventListener('click', () => {
    const raw = textarea.value.trim();
    if (!raw) {
      textarea.classList.add('input-shake');
      textarea.focus();
      setTimeout(() => textarea.classList.remove('input-shake'), 400);
      return;
    }
    const html  = plainTextToHtml(raw);
    const words = countWords(raw);
    renderContent({ title: null, byline: null, html, words, sourceUrl: null, isPlain: true, text: raw });
  });


  /* =========================================================================
     URL tab
     ========================================================================= */
  document.querySelectorAll('.url-sample-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      urlInput.value = btn.dataset.url;
      urlInput.focus();
    });
  });

  fetchBtn.addEventListener('click', () => startFetch());
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') startFetch(); });


  /* ---- fetch helpers ---------------------------------------------------- */

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  function parseWikipediaUrl(url) {
    const m = url.match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i);
    return m ? { lang: m[1], rawTitle: m[2] } : null;
  }

  function parseWithReadability(html, baseUrl) {
    if (typeof window.Readability === 'undefined') {
      throw new Error('Readability library failed to load. Please refresh the page.');
    }
    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, 'text/html');
    if (doc.head) {
      const base = doc.createElement('base');
      base.href  = baseUrl;
      doc.head.prepend(base);
    }
    const reader  = new window.Readability(doc, { charThreshold: 100 });
    const article = reader.parse();
    if (!article || !article.content) {
      throw new Error('Could not extract readable content. The page may be a dynamic app or behind a paywall.');
    }
    return article;
  }

  async function startFetch() {
    let url = urlInput.value.trim();
    if (!url) { urlInput.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    renderLoading('Loading article…');

    try {
      let html;
      const wiki = parseWikipediaUrl(url);

      if (wiki) {
        const apiUrl = `https://${wiki.lang}.wikipedia.org/api/rest_v1/page/html/${wiki.rawTitle}`;
        html = await fetchWithTimeout(apiUrl, 8000);
      } else {
        const PROXIES = [
          { label: 'Fetching article…',          build: u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
          { label: 'Trying alternative source…', build: u => `https://corsproxy.io/?${encodeURIComponent(u)}` },
          { label: 'Trying one more route…',     build: u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
        ];

        html = null;
        for (const proxy of PROXIES) {
          renderLoading(proxy.label);
          try { html = await fetchWithTimeout(proxy.build(url), 8000); break; }
          catch (_) { /* try next */ }
        }

        if (html === null) {
          const err = new Error('All proxies exhausted.');
          err.allProxiesFailed = true;
          throw err;
        }
      }

      const article = parseWithReadability(html, url);
      const words   = countWords(article.textContent || '');

      renderContent({
        title:     article.title  || null,
        byline:    article.byline || null,
        html:      article.content,
        words,
        sourceUrl: url,
        isPlain:   false,
        text:      article.textContent || '',
      });

    } catch (err) {
      let message;
      if (err.allProxiesFailed) {
        message = 'We tried 3 different ways to fetch this page, but none worked.';
      } else if (err.name === 'AbortError') {
        message = 'The request timed out. The server may be slow or blocking access.';
      } else if (err.message.toLowerCase().includes('failed to fetch') ||
                 err.message.toLowerCase().includes('networkerror')) {
        message = 'Could not connect. Check your internet connection and try again.';
      } else {
        message = err.message;
      }
      renderError(message, err.allProxiesFailed === true);
    }
  }


  /* =========================================================================
     PDF tab — drag-and-drop + file picker
     ========================================================================= */
  let pdfExtractedText = null; // holds text between extraction and user clicking "Extract & Format"
  let pdfExtractBtn    = null;

  if (pdfDropzone) {
    // Drag events
    pdfDropzone.addEventListener('dragover', e => {
      e.preventDefault();
      pdfDropzone.classList.add('pdf-dropzone--dragging');
    });

    ['dragleave', 'dragend'].forEach(evt => {
      pdfDropzone.addEventListener(evt, () => pdfDropzone.classList.remove('pdf-dropzone--dragging'));
    });

    pdfDropzone.addEventListener('drop', e => {
      e.preventDefault();
      pdfDropzone.classList.remove('pdf-dropzone--dragging');
      const file = e.dataTransfer?.files?.[0];
      if (file) handlePdfFile(file);
    });

    // Click → trigger hidden file input
    pdfDropzone.addEventListener('click', () => pdfFileInput && pdfFileInput.click());
    pdfDropzone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pdfFileInput && pdfFileInput.click(); }
    });
  }

  if (pdfFileInput) {
    pdfFileInput.addEventListener('change', () => {
      const file = pdfFileInput.files?.[0];
      if (file) handlePdfFile(file);
      pdfFileInput.value = ''; // allow re-selecting same file
    });
  }

  async function handlePdfFile(file) {
    if (!pdfPanel) return;

    // Show progress inside the dropzone area
    const progressArea = pdfPanel.querySelector('.pdf-progress-area');
    if (progressArea) {
      progressArea.innerHTML = `
        <div class="pdf-loading" role="status" aria-live="polite">
          <div class="loading-spinner" style="width:24px;height:24px;border-width:2px" aria-hidden="true"></div>
          <span id="pdf-progress-text">Reading PDF…</span>
        </div>`;
    }

    try {
      if (typeof window.SugamaPDF === 'undefined') {
        throw new Error('pdf-extract.js did not load. Check your script tags.');
      }

      const result = await window.SugamaPDF.extractTextFromPDF(file, (page, total) => {
        const el = document.getElementById('pdf-progress-text');
        if (el) el.textContent = `Extracting page ${page} of ${total}…`;
      });

      pdfExtractedText = result.text;
      showPdfFileInfo(file, result);

    } catch (err) {
      if (progressArea) {
        progressArea.innerHTML = `<p class="pdf-error">${escHtml(err.message)}</p>`;
      }
    }
  }

  function showPdfFileInfo(file, result) {
    const progressArea = pdfPanel && pdfPanel.querySelector('.pdf-progress-area');
    if (!progressArea) return;

    const sizeMB = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const displayName = file.name.replace(/\.pdf$/i, '');

    progressArea.innerHTML = `
      <div class="pdf-file-info">
        <div class="pdf-file-info__meta">
          <svg class="pdf-file-info__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <div class="pdf-file-info__details">
            <span class="pdf-file-info__name" title="${escHtml(file.name)}">${escHtml(displayName)}</span>
            <span class="pdf-file-info__stats">${sizeMB} · ${result.pageCount} page${result.pageCount !== 1 ? 's' : ''} · ${result.charCount.toLocaleString()} chars extracted</span>
          </div>
        </div>
        <button class="btn btn--ghost btn--small js-pdf-remove" aria-label="Remove this PDF">✕</button>
      </div>
      <button id="pdf-extract-btn" class="btn btn--primary btn--full" aria-label="Extract text and open in reading area">
        Extract &amp; Format
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>`;

    pdfExtractBtn = document.getElementById('pdf-extract-btn');
    if (pdfExtractBtn) {
      pdfExtractBtn.addEventListener('click', () => {
        if (!pdfExtractedText) return;
        const html  = plainTextToHtml(pdfExtractedText);
        const words = countWords(pdfExtractedText);
        renderContent({
          title:     null,   // PDF text already contains its own heading
          byline:    `From: ${displayName} · ${result.pageCount} page${result.pageCount !== 1 ? 's' : ''}`,
          html,
          words,
          sourceUrl: null,
          isPlain:   true,
          text:      pdfExtractedText,
        });
      });
    }

    progressArea.querySelector('.js-pdf-remove').addEventListener('click', () => {
      pdfExtractedText = null;
      resetPdfDropzone();
    });
  }

  function resetPdfDropzone() {
    const progressArea = pdfPanel && pdfPanel.querySelector('.pdf-progress-area');
    if (progressArea) progressArea.innerHTML = '';
  }


  /* =========================================================================
     AI Reading Mode — buttons + logic
     ========================================================================= */

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      aiMode.mode = btn.dataset.mode;
      syncModeUI();
      if (aiCache.originalText !== null) scheduleAIMode();
    });
  });

  levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      aiMode.level = parseInt(btn.dataset.level, 10);
      levelBtns.forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      if (aiMode.mode === 'simplified' && aiCache.originalText !== null) scheduleAIMode();
    });
  });

  formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      aiMode.format = btn.dataset.format;
      formatBtns.forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      if (aiMode.mode === 'summary' && aiCache.originalText !== null) scheduleAIMode();
    });
  });

  if (translateSelect) {
    translateSelect.addEventListener('change', () => {
      aiMode.translateLanguage = translateSelect.value;
      if (aiCache.originalText !== null) scheduleAIMode();
    });
  }

  function syncModeUI() {
    modeBtns.forEach(b => {
      b.classList.toggle('is-active', b.dataset.mode === aiMode.mode);
      b.setAttribute('aria-pressed', b.dataset.mode === aiMode.mode ? 'true' : 'false');
    });
    if (modeSubSimplified) modeSubSimplified.hidden = aiMode.mode !== 'simplified';
    if (modeSubSummary)    modeSubSummary.hidden    = aiMode.mode !== 'summary';
  }

  function scheduleAIMode() {
    clearTimeout(aiDebounceTimer);
    aiDebounceTimer = setTimeout(() => applyAIMode(), 500);
  }

  async function applyAIMode() {
    // Nothing to do — bail out early and restore original cleanly
    if (aiMode.mode === 'original' && aiMode.translateLanguage === 'none') {
      restoreOriginalContent();
      return;
    }

    const outputEl      = document.getElementById('reading-output');
    const aiBannerEl    = document.getElementById('ai-banner');
    const transBannerEl = document.getElementById('translate-banner');
    if (!outputEl || !aiBannerEl || !transBannerEl) return;

    // ── Step 1: resolve base content (original / simplified / summary) ────
    let baseHtml, baseText;

    if (aiMode.mode === 'original') {
      baseHtml = aiCache.originalHtml;
      baseText = aiCache.originalText;
      aiBannerEl.innerHTML = '';
    } else {
      const baseCacheKey = aiMode.mode === 'simplified'
        ? `simplified_${aiMode.level}`
        : `summary_${aiMode.format}`;

      const cached = aiCache.results[baseCacheKey];
      if (cached) {
        baseHtml = cached.html;
        baseText = cached.text;
      } else {
        const isLargeAI = aiCache.originalText.length > 15000;
        showLoadingBanner(aiBannerEl, isLargeAI
          ? 'Large content — processing in chunks. This may take 20–30 seconds…'
          : 'Simplifying with AI…');
        dimOutput(outputEl);
        try {
          if (typeof window.SugamaSimplify === 'undefined') {
            throw new Error('simplify.js did not load. Check your script tags.');
          }
          const raw = await window.SugamaSimplify.simplifyText(aiCache.originalText, {
            mode: aiMode.mode, level: aiMode.level, format: aiMode.format,
            onRetry: () => showLoadingBanner(aiBannerEl, 'AI service is busy — retrying…'),
            onProgress: (done, total) => {
              if (total > 1) showLoadingBanner(aiBannerEl, `Simplifying chunk ${done} of ${total}…`);
            },
          });
          baseHtml = aiResponseToHtml(raw);
          baseText = raw;
          aiCache.results[baseCacheKey] = { html: baseHtml, text: baseText };
        } catch (err) {
          undimOutput(outputEl);
          showAIErrorBanner(aiBannerEl, err);
          return;
        }
      }
      renderAIBannerLabel(aiBannerEl, aiMode.mode === 'simplified'
        ? `simplified_${aiMode.level}` : `summary_${aiMode.format}`);
    }

    // ── Step 2: apply translation if requested ────────────────────────────
    const lang = aiMode.translateLanguage;

    if (lang === 'none') {
      transBannerEl.innerHTML = '';
      renderFinal(outputEl, baseHtml, 'en', null);
      return;
    }

    const baseKey = aiMode.mode === 'original' ? 'original'
      : (aiMode.mode === 'simplified' ? `simplified_${aiMode.level}` : `summary_${aiMode.format}`);
    const transKey = `${baseKey}__${lang}`;

    if (aiCache.translationResults[transKey]) {
      renderFinal(outputEl, aiCache.translationResults[transKey], lang, baseHtml);
      return;
    }

    const textToTranslate = aiMode.mode === 'original' ? aiCache.originalText : baseText;
    const isLargeTr = textToTranslate.length > 15000;
    showLoadingBanner(transBannerEl, isLargeTr
      ? `Large content — translating in chunks to ${lang}. This may take 20–30 seconds…`
      : `Translating to ${lang}…`);
    dimOutput(outputEl);
    try {
      if (typeof window.SugamaTranslate === 'undefined') {
        throw new Error('translate.js did not load. Check your script tags.');
      }
      const raw = await window.SugamaTranslate.translateText(textToTranslate, lang, {
        onRetry: () => showLoadingBanner(transBannerEl, 'Translator busy — retrying…'),
        onProgress: (done, total) => {
          if (total > 1) showLoadingBanner(transBannerEl, `Translating chunk ${done} of ${total} to ${lang}…`);
        },
      });
      const translatedHtml = aiResponseToHtml(raw);
      aiCache.translationResults[transKey] = translatedHtml;
      renderFinal(outputEl, translatedHtml, lang, baseHtml);
    } catch (err) {
      undimOutput(outputEl);
      outputEl.innerHTML = baseHtml;
      setOutputLang(outputEl, 'en');
      applyStateToOutput();
      showTranslateErrorBanner(transBannerEl, err);
    }
  }

  function dimOutput(el) {
    el.style.opacity       = '0.35';
    el.style.pointerEvents = 'none';
  }

  function undimOutput(el) {
    el.style.opacity       = '1';
    el.style.pointerEvents = '';
  }

  function showLoadingBanner(bannerEl, message) {
    bannerEl.innerHTML = `
      <div class="ai-banner ai-banner--loading" role="status" aria-live="polite">
        <div class="ai-banner__spinner" aria-hidden="true"></div>
        <span>${escHtml(message)}</span>
      </div>`;
  }

  function renderAIBannerLabel(bannerEl, cacheKey) {
    const LEVEL_NAMES = {
      '1': 'Level 1 (most simplified)',
      '2': 'Level 2 (balanced)',
      '3': 'Level 3 (lighter touch)',
    };
    let label;
    if (cacheKey.startsWith('simplified_')) {
      label = `AI-simplified — ${LEVEL_NAMES[cacheKey.split('_')[1]] || ''}`;
    } else if (cacheKey === 'summary_keypoints') {
      label = 'AI summary — Key Points';
    } else {
      label = 'AI summary — TL;DR';
    }

    bannerEl.innerHTML = `
      <div class="ai-banner" role="region" aria-label="AI processing active">
        <div class="ai-banner__left">
          <svg class="ai-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <span class="ai-banner__label">${escHtml(label)}</span>
        </div>
        <button class="ai-banner__toggle btn btn--ghost btn--small js-ai-original-toggle"
                aria-label="Show original unprocessed text">
          Show original
        </button>
      </div>`;

    bannerEl.querySelector('.js-ai-original-toggle').addEventListener('click', () => {
      aiMode.mode = 'original';
      aiMode.translateLanguage = 'none';
      if (translateSelect) translateSelect.value = 'none';
      syncModeUI();
      restoreOriginalContent();
    });
  }

  // Puts final HTML into outputEl, sets lang/dir, wires the translate-banner toggle
  function renderFinal(outputEl, html, lang, baseHtml) {
    undimOutput(outputEl);
    outputEl.innerHTML = html;
    setOutputLang(outputEl, lang);
    applyStateToOutput();

    const transBannerEl = document.getElementById('translate-banner');
    if (!transBannerEl) return;

    if (lang === 'en' || !baseHtml) {
      transBannerEl.innerHTML = '';
      return;
    }

    let viewingBase = false;
    transBannerEl.innerHTML = `
      <div class="translate-banner" role="region" aria-label="Translation active">
        <div class="ai-banner__left">
          <svg class="ai-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
            <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
          </svg>
          <span class="ai-banner__label translate-banner__label">Translated to ${escHtml(lang)}</span>
        </div>
        <button class="ai-banner__toggle btn btn--ghost btn--small"
                aria-label="Toggle between translated and English text">
          Show in English
        </button>
      </div>`;

    transBannerEl.querySelector('.ai-banner__toggle').addEventListener('click', function () {
      viewingBase = !viewingBase;
      if (viewingBase) {
        outputEl.innerHTML = baseHtml;
        setOutputLang(outputEl, 'en');
        this.textContent = `Show in ${lang}`;
        transBannerEl.querySelector('.translate-banner__label').textContent =
          `Translated to ${lang} (viewing English)`;
      } else {
        outputEl.innerHTML = html;
        setOutputLang(outputEl, lang);
        this.textContent = 'Show in English';
        transBannerEl.querySelector('.translate-banner__label').textContent =
          `Translated to ${lang}`;
      }
      applyStateToOutput();
    });
  }

  function restoreOriginalContent() {
    const aiBannerEl    = document.getElementById('ai-banner');
    const transBannerEl = document.getElementById('translate-banner');
    const outputEl      = document.getElementById('reading-output');
    if (!outputEl) return;
    if (aiBannerEl)    aiBannerEl.innerHTML    = '';
    if (transBannerEl) transBannerEl.innerHTML = '';
    outputEl.innerHTML           = aiCache.originalHtml;
    outputEl.style.opacity       = '1';
    outputEl.style.pointerEvents = '';
    setOutputLang(outputEl, 'en');
    applyStateToOutput();
  }

  function showAIErrorBanner(bannerEl, err) {
    const is429 = err.status === 429;
    let msg;
    if (err.code === 'NO_KEY') {
      msg = 'API key not configured. Copy <code>js/config.example.js</code> → <code>js/config.js</code> and add your Groq key.';
    } else if (err.status === 401 || err.status === 403) {
      msg = 'API key rejected. Check <code>js/config.js</code>.';
    } else if (err.status >= 500) {
      msg = 'The AI service is temporarily unavailable. Try again in a moment.';
    } else if (err.name === 'AbortError') {
      msg = 'AI request timed out (60 s). The service may be overloaded — try again.';
    } else if (!is429) {
      msg = 'Can\'t reach the AI service. Check your internet connection.';
    }

    const timerId = `rl-ai-${Date.now()}`;
    bannerEl.innerHTML = `
      <div class="ai-banner ai-banner--error" role="alert">
        <span class="ai-banner__error-msg">
          ${is429
            ? `Rate limit reached — Groq's free tier allows ~6 000 tokens/min.
               <span id="${timerId}"> Retrying in 60s…</span>`
            : msg}
        </span>
        ${is429
          ? `<div style="display:flex;gap:var(--sp-2)">
               <button class="ai-banner__toggle btn btn--ghost btn--small js-rl-retry">Retry now</button>
               <button class="ai-banner__toggle btn btn--ghost btn--small js-ai-fallback">Show original</button>
             </div>`
          : `<button class="ai-banner__toggle btn btn--ghost btn--small js-ai-fallback">Show original instead</button>`}
      </div>`;

    bannerEl.querySelector('.js-ai-fallback').addEventListener('click', () => {
      aiMode.mode = 'original'; syncModeUI(); restoreOriginalContent();
    });

    if (is429) {
      startCountdown(timerId, () => scheduleAIMode());
      bannerEl.querySelector('.js-rl-retry').addEventListener('click', () => {
        stopCountdown(timerId);
        scheduleAIMode();
      });
    }
  }

  function showTranslateErrorBanner(bannerEl, err) {
    const is429 = err.status === 429;
    let msg;
    if (err.code === 'NO_KEY') {
      msg = 'API key not configured.';
    } else if (err.name === 'AbortError') {
      msg = 'Translation timed out. Try again.';
    } else if (err.status >= 500) {
      msg = 'The translation service is temporarily unavailable.';
    } else if (!is429) {
      msg = 'Translation failed. Showing English content.';
    }

    const timerId = `rl-tr-${Date.now()}`;
    bannerEl.innerHTML = `
      <div class="translate-banner ai-banner--error" role="alert">
        <span class="ai-banner__error-msg">
          ${is429
            ? `Rate limit reached — Groq's free tier allows ~6 000 tokens/min.
               <span id="${timerId}"> Retrying in 60s…</span>`
            : escHtml(msg)}
        </span>
        ${is429
          ? `<div style="display:flex;gap:var(--sp-2)">
               <button class="ai-banner__toggle btn btn--ghost btn--small js-rl-retry">Retry now</button>
               <button class="ai-banner__toggle btn btn--ghost btn--small js-translate-fallback">Keep English</button>
             </div>`
          : `<button class="ai-banner__toggle btn btn--ghost btn--small js-translate-fallback">Keep English</button>`}
      </div>`;

    bannerEl.querySelector('.js-translate-fallback').addEventListener('click', () => {
      aiMode.translateLanguage = 'none';
      if (translateSelect) translateSelect.value = 'none';
      bannerEl.innerHTML = '';
    });

    if (is429) {
      startCountdown(timerId, () => scheduleAIMode());
      bannerEl.querySelector('.js-rl-retry').addEventListener('click', () => {
        stopCountdown(timerId);
        scheduleAIMode();
      });
    }
  }

  // Countdown helpers — keyed by DOM element id so multiple can coexist
  const _countdownIntervals = {};

  function startCountdown(elementId, onExpire, seconds = 60) {
    let remaining = seconds;
    _countdownIntervals[elementId] = setInterval(() => {
      const el = document.getElementById(elementId);
      if (!el) { stopCountdown(elementId); return; }
      remaining--;
      if (remaining <= 0) {
        stopCountdown(elementId);
        el.textContent = ' Retrying now…';
        onExpire();
      } else {
        el.textContent = ` Retrying in ${remaining}s…`;
      }
    }, 1000);
  }

  function stopCountdown(elementId) {
    clearInterval(_countdownIntervals[elementId]);
    delete _countdownIntervals[elementId];
  }

  function aiResponseToHtml(text) {
    if (!text) return '<p>The AI returned an empty response.</p>';
    const lines = text.split('\n');
    const parts = [];
    let inList  = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) { parts.push('</ul>'); inList = false; }
        continue;
      }
      const isBullet = /^[-*•]\s+/.test(trimmed);
      let content = isBullet ? trimmed.replace(/^[-*•]\s+/, '') : trimmed;
      content = escHtml(content).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      if (isBullet) {
        if (!inList) { parts.push('<ul class="ai-list">'); inList = true; }
        parts.push(`<li>${content}</li>`);
      } else {
        if (inList) { parts.push('</ul>'); inList = false; }
        parts.push(`<p>${content}</p>`);
      }
    }
    if (inList) parts.push('</ul>');
    return parts.join('\n') || '<p>No content extracted.</p>';
  }


  /* =========================================================================
     Font toggle
     ========================================================================= */
  fontBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const font = btn.dataset.font;
      state.font = font;

      fontBtns.forEach(b => {
        b.classList.toggle('is-active', b.dataset.font === font);
        b.setAttribute('aria-pressed', b.dataset.font === font ? 'true' : 'false');
      });

      document.documentElement.classList.toggle('font-dyslexic', font === 'dyslexic');

      const output = document.getElementById('reading-output');
      if (output) {
        output.style.fontFamily = font === 'dyslexic'
          ? "'OpenDyslexic', 'Lexend', sans-serif"
          : "'Lexend', 'Segoe UI', sans-serif";
      }

      window.SugamaPath.updateSetting('font', font);
    });
  });


  /* =========================================================================
     Sliders
     ========================================================================= */
  SLIDER_CONFIG.forEach(cfg => {
    const slider  = sliders[cfg.key];
    const display = displays[cfg.key];
    if (!slider || !display) return;

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      state[cfg.key] = val;
      display.textContent = cfg.format(val);
      slider.setAttribute('aria-valuenow', val);

      const output = document.getElementById('reading-output');
      if (output) output.style.setProperty(cfg.prop, cfg.format(val));

      window.SugamaPath.saveSettings({ [cfg.saveKey]: val });
    });
  });


  /* =========================================================================
     Reset controls
     ========================================================================= */
  resetBtn.addEventListener('click', () => {
    state = { ...READING_DEFAULTS, font: 'lexend' };
    applyState();
    window.SugamaPath.saveSettings({
      font:           'lexend',
      rFontSize:       READING_DEFAULTS.fontSize,
      rLineHeight:     READING_DEFAULTS.lineHeight,
      rLetterSpacing:  READING_DEFAULTS.letterSpacing,
      rWordSpacing:    READING_DEFAULTS.wordSpacing,
    });
  });


  /* =========================================================================
     applyState / applyStateToOutput
     ========================================================================= */
  function applyState() {
    fontBtns.forEach(b => {
      b.classList.toggle('is-active', b.dataset.font === state.font);
      b.setAttribute('aria-pressed', b.dataset.font === state.font ? 'true' : 'false');
    });
    document.documentElement.classList.toggle('font-dyslexic', state.font === 'dyslexic');

    SLIDER_CONFIG.forEach(cfg => {
      const slider  = sliders[cfg.key];
      const display = displays[cfg.key];
      if (!slider || !display) return;
      slider.value = state[cfg.key];
      display.textContent = cfg.format(state[cfg.key]);
      slider.setAttribute('aria-valuenow', state[cfg.key]);
    });

    applyStateToOutput();
  }

  function applyStateToOutput() {
    const output = document.getElementById('reading-output');
    if (!output) return;
    SLIDER_CONFIG.forEach(cfg => output.style.setProperty(cfg.prop, cfg.format(state[cfg.key])));
    output.style.fontFamily = state.font === 'dyslexic'
      ? "'OpenDyslexic', 'Lexend', sans-serif"
      : "'Lexend', 'Segoe UI', sans-serif";
  }


  /* =========================================================================
     Render helpers
     ========================================================================= */

  function renderEmpty() {
    readingArea.innerHTML = `
      <div class="reading-empty" role="region" aria-label="Reading area, empty">
        <div class="reading-empty__ornament" aria-hidden="true">§</div>
        <h2 class="reading-empty__title">Your reading space</h2>
        <p class="reading-empty__subtitle">
          Paste text, enter a URL, or upload a PDF to begin.<br>
          Every setting you adjust stays with you.
        </p>
        <div class="reading-empty__hints">
          <p class="reading-empty__hint">
            Try: <code>en.wikipedia.org/wiki/Database</code>
          </p>
        </div>
      </div>`;
  }

  function renderLoading(message) {
    readingArea.innerHTML = `
      <div class="reading-loading" role="status" aria-live="polite" aria-label="${escHtml(message)}">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p>${escHtml(message)}</p>
      </div>`;
  }

  function renderError(message, allProxiesFailed = false) {
    const hint = allProxiesFailed
      ? `Try opening the page in a new tab, copying the article text,
         and pasting it in the <strong>Paste Text</strong> tab.`
      : `Some sites block external access. Try copying the article text
         and pasting it in the <strong>Paste Text</strong> tab instead.`;

    readingArea.innerHTML = `
      <div class="reading-error" role="alert">
        <div class="reading-error__icon" aria-hidden="true">⚠️</div>
        <p class="reading-error__title">Couldn't load content</p>
        <p class="reading-error__message">${escHtml(message)}</p>
        <p class="reading-error__hint">${hint}</p>
        <div style="display:flex; gap: var(--sp-3); flex-wrap: wrap; justify-content: center; margin-top: var(--sp-2)">
          <button class="btn btn--secondary js-switch-paste">Switch to Paste Text</button>
          <button class="btn btn--ghost js-retry">Try Again</button>
        </div>
      </div>`;

    readingArea.querySelector('.js-switch-paste').addEventListener('click', () => {
      activateTab(0);
      renderEmpty();
      textarea.focus();
    });
    readingArea.querySelector('.js-retry').addEventListener('click', () => startFetch());
  }

  function renderContent({ title, byline, html, words, sourceUrl, isPlain, text }) {
    aiCache.originalHtml       = html;
    aiCache.originalText       = text || '';
    aiCache.results            = {};
    aiCache.translationResults = {};

    const wordDisplay = `${words.toLocaleString()} words`;
    const timeDisplay = estimateReadTime(words);

    const sourceBadge = sourceUrl
      ? `<a class="reading-bar__source" href="${encodeURI(sourceUrl)}" target="_blank" rel="noopener noreferrer" title="${escHtml(sourceUrl)}">
           🔗 View original
         </a>`
      : '';

    const titleHtml  = title  ? `<h1>${escHtml(title)}</h1>` : '';
    const bylineHtml = byline ? `<p class="article-byline">${escHtml(byline)}</p>` : '';

    readingArea.innerHTML = `
      <div class="reading-content-wrapper">

        <div class="reading-bar" aria-label="Article information">
          <div class="reading-bar__stats">
            <span>${wordDisplay}</span>
            <span class="reading-bar__sep" aria-hidden="true">·</span>
            <span>${timeDisplay}</span>
            ${sourceBadge ? `<span class="reading-bar__sep" aria-hidden="true">·</span>${sourceBadge}` : ''}
          </div>
          <div class="reading-bar__actions">
            <button class="btn btn--ghost btn--small js-clear" aria-label="Clear and start over">
              Clear
            </button>
          </div>
        </div>

        <div id="ai-banner"></div>
        <div id="translate-banner"></div>

        <div
          class="reading-output${isPlain ? ' plain-text' : ''}"
          id="reading-output"
          role="article"
          aria-label="${title ? escHtml(title) : 'Formatted text'}"
          tabindex="0"
        >
          ${titleHtml}
          ${bylineHtml}
          ${html}
        </div>

      </div>`;

    applyStateToOutput();

    readingArea.querySelector('.js-clear').addEventListener('click', () => {
      aiCache.originalHtml       = null;
      aiCache.originalText       = null;
      aiCache.results            = {};
      aiCache.translationResults = {};
      renderEmpty();
    });

    if (window.innerWidth < 860) {
      readingArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const output = document.getElementById('reading-output');
    if (output) output.focus({ preventScroll: true });

    if (aiMode.mode !== 'original' && aiCache.originalText) {
      scheduleAIMode();
    }
  }


  /* =========================================================================
     Utility helpers
     ========================================================================= */

  function plainTextToHtml(text) {
    return text
      .split(/\n{2,}/)                      // split on paragraph breaks
      .map(para => {
        const cleaned = para
          .split('\n')                       // single newlines within a paragraph
          .map(line => line.trim())
          .filter(Boolean)
          .join(' ');                        // join as flowing prose, not <br>
        return cleaned ? `<p>${escHtml(cleaned)}</p>` : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  function countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function estimateReadTime(words) {
    const mins = Math.ceil(words / 200);
    return `~${mins} min read`;
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function setOutputLang(el, lang) {
    const code = lang === 'en' ? 'en' : (LANG_CODES[lang] || 'en');
    el.setAttribute('lang', code);
    el.dir = RTL_LANGS.has(code) ? 'rtl' : '';
  }


  /* =========================================================================
     Initialise
     ========================================================================= */
  applyState();
  syncModeUI();
  renderEmpty();
}
