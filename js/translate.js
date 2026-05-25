/**
 * translate.js — SugamaPath Translation
 *
 * Translates text into any target language using the Groq API.
 * Designed for academic/technical content — preserves English technical
 * terms, formulas, code, and markdown formatting.
 *
 * Long inputs are automatically split into ~3 000-character chunks and
 * processed sequentially with a 2.5 s inter-chunk delay to stay well
 * under Groq's free-tier rate limit.
 *
 * Requires window.SUGAMA_CONFIG (set in js/config.js).
 * Exports: window.SugamaTranslate.translateText(text, targetLanguage, options)
 *
 * options = {
 *   onRetry:    (attempt) => void      (called before each 429 retry)
 *   onProgress: (done, total) => void  (called after each chunk completes)
 * }
 */

(function () {

  function buildPrompt(targetLanguage) {
    return (
      `You are a professional translator specialized in academic and technical ` +
      `content for university students. Translate the following text into ${targetLanguage}.\n\n` +
      `Rules:\n` +
      `- Produce natural, fluent ${targetLanguage} that a native speaker would write\n` +
      `- Keep all technical terms, code, formulas, equations, numbers, names of ` +
      `people/places/products, and acronyms in their ORIGINAL English form\n` +
      `- For technical concepts without a clean equivalent, use the English term ` +
      `followed by a brief explanation in ${targetLanguage} in parentheses\n` +
      `- Preserve the original paragraph structure exactly\n` +
      `- Preserve markdown formatting (bullets with -, bold with **, etc.) if present\n` +
      `- Maintain the academic tone of the original\n` +
      `- Do NOT add commentary, translator notes, or summaries\n` +
      `- Return ONLY the translated text, nothing else`
    );
  }

  /* -------------------------------------------------------------------------
     Chunking — identical strategy to simplify.js
     ------------------------------------------------------------------------- */

  function chunkText(text, maxChunkSize = 3000) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let current = '';

    for (const para of paragraphs) {
      const candidate = current ? current + '\n\n' + para : para;

      if (candidate.length <= maxChunkSize) {
        current = candidate;
      } else {
        if (current) chunks.push(current);

        if (para.length <= maxChunkSize) {
          current = para;
        } else {
          const sentences = para.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [para];
          let subChunk = '';
          for (const sent of sentences) {
            const sub = subChunk ? subChunk + ' ' + sent : sent;
            if (sub.length <= maxChunkSize) {
              subChunk = sub;
            } else {
              if (subChunk) chunks.push(subChunk.trim());
              subChunk = sent;
            }
          }
          current = subChunk;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.length ? chunks : [text];
  }

  /* -------------------------------------------------------------------------
     Core fetch with timeout
     ------------------------------------------------------------------------- */

  function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  /* -------------------------------------------------------------------------
     Single-chunk Groq call with retry logic
     ------------------------------------------------------------------------- */

  async function callGroqAPI(chunkText, systemPrompt, onRetry) {
    const cfg = window.SUGAMA_CONFIG;

    const body = JSON.stringify({
      model:    cfg.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: chunkText    },
      ],
      temperature: 0.2,
      max_tokens:  2000,
    });

    const MAX_ATTEMPTS  = 3;
    const FALLBACK_WAIT = 3000;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0 && typeof onRetry === 'function') onRetry(attempt);

      let res;
      try {
        res = await fetchWithTimeout(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${cfg.GROQ_API_KEY}`,
              'Content-Type':  'application/json',
            },
            body,
          },
          60000
        );
      } catch (fetchErr) {
        throw fetchErr;
      }

      if (res.status === 429) {
        if (attempt === MAX_ATTEMPTS - 1) {
          const err = new Error(
            'Rate limit reached. Groq\'s free tier allows ~6 000 tokens per minute. ' +
            'Wait 60 seconds and try again, or use shorter content.'
          );
          err.status = 429;
          throw err;
        }
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
        await new Promise(r => setTimeout(r, retryAfter > 0 ? retryAfter * 1000 : FALLBACK_WAIT));
        continue;
      }

      if (!res.ok) {
        const err = new Error(`Groq API returned HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }

      const data   = await res.json();
      const output = data?.choices?.[0]?.message?.content;
      if (!output) throw new Error('The AI returned an empty translation. Please try again.');

      return output.trim();
    }
  }

  /* -------------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------------- */

  /**
   * Translate text into targetLanguage via Groq.
   * Automatically chunks long inputs and processes them sequentially.
   *
   * @param {string} text
   * @param {string} targetLanguage  e.g. "Hindi", "Kannada"
   * @param {object} options
   *   @param {Function} [options.onRetry]    (attempt) => void
   *   @param {Function} [options.onProgress] (done, total) => void
   * @returns {Promise<string>} Translated text string.
   */
  async function translateText(text, targetLanguage, options = {}) {
    const cfg = window.SUGAMA_CONFIG;

    if (
      !cfg ||
      !cfg.GROQ_API_KEY ||
      cfg.GROQ_API_KEY === 'PASTE_YOUR_KEY_HERE' ||
      cfg.GROQ_API_KEY === 'gsk_your_key_here'
    ) {
      const err = new Error(
        'No API key configured. Copy js/config.example.js → js/config.js and add your Groq key.'
      );
      err.code = 'NO_KEY';
      throw err;
    }

    const { onRetry, onProgress } = options;
    const systemPrompt = buildPrompt(targetLanguage);
    const chunks = chunkText(text, 3000);

    if (chunks.length === 1) {
      if (typeof onProgress === 'function') onProgress(1, 1);
      return await callGroqAPI(chunks[0], systemPrompt, onRetry);
    }

    const INTER_CHUNK_DELAY = 2500;
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
      if (typeof onProgress === 'function') onProgress(i + 1, chunks.length);

      const result = await callGroqAPI(chunks[i], systemPrompt, onRetry);
      results.push(result);

      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, INTER_CHUNK_DELAY));
      }
    }

    return results.join('\n\n');
  }

  /* Export */
  window.SugamaTranslate = { translateText };

})();
