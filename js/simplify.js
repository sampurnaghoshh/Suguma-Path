/**
 * simplify.js — SugamaPath AI Text Simplification
 *
 * Wraps the Groq API to rewrite or summarise technical text for college
 * engineering students with dyslexia. Long inputs are automatically split
 * into ~3 000-character chunks and processed sequentially with a 2.5 s
 * inter-chunk delay to stay well under Groq's free-tier rate limit.
 *
 * Requires window.SUGAMA_CONFIG (set in js/config.js).
 * Exports: window.SugamaSimplify.simplifyText(text, options)
 *
 * options = {
 *   mode:       'simplified' | 'summary'
 *   level:      1 | 2 | 3          (simplified mode only)
 *   format:     'keypoints'|'tldr' (summary mode only)
 *   onRetry:    (attempt) => void  (called before each 429 retry)
 *   onProgress: (done, total) => void  (called after each chunk completes)
 * }
 */

(function () {

  /* -------------------------------------------------------------------------
     System prompts — engineered for B.Tech students with dyslexia.
     Technical accuracy is always preserved; only readability improves.
     ------------------------------------------------------------------------- */

  const SYSTEM_PROMPTS = {

    simplified_1:
      'You are an academic reading assistant for college engineering students ' +
      'with dyslexia or reading difficulties. Rewrite the following technical ' +
      'text to make it significantly easier to read WITHOUT losing any ' +
      'information, facts, or technical accuracy.\n\n' +
      'Rules:\n' +
      '- Preserve every concept, example, formula, and detail from the original\n' +
      '- Break long sentences (20+ words) into shorter ones\n' +
      '- Replace academic jargon with everyday equivalents, but ALWAYS keep ' +
      'the technical term in parentheses. Example: "instantiate (create)", ' +
      '"iterate (loop through)", "paradigm (approach)"\n' +
      '- Add brief inline explanations for technical concepts using em-dashes. ' +
      'Example: "polymorphism — when one function works with multiple data types"\n' +
      '- Use active voice instead of passive\n' +
      '- Use "you" to address the reader where natural\n' +
      '- Preserve all code, formulas, numbers, names, dates exactly\n' +
      '- Preserve original paragraph structure and ordering\n' +
      '- Do NOT add commentary, introductions, or summaries\n' +
      '- Return only the rewritten text',

    simplified_2:
      'You are an academic reading assistant for college engineering students ' +
      'with dyslexia or reading difficulties. Rewrite the following technical ' +
      'text to be clearer and easier to read while preserving ALL information ' +
      'and technical precision.\n\n' +
      'Rules:\n' +
      '- Preserve every concept, fact, example, formula, and technical term\n' +
      '- Break overly complex sentences (25+ words) where it improves clarity\n' +
      '- Keep technical terminology but add brief clarifications for the densest ' +
      'jargon using em-dashes. Example: "heuristic — a problem-solving shortcut"\n' +
      '- Replace unnecessarily complex words with simpler ones (use "use" ' +
      'instead of "utilize", "show" instead of "demonstrate")\n' +
      '- Maintain academic tone and rigor\n' +
      '- Preserve all code, formulas, numbers, names, dates exactly\n' +
      '- Preserve paragraph structure and original meaning\n' +
      '- Do NOT add commentary or summaries\n' +
      '- Return only the rewritten text',

    simplified_3:
      'You are an academic reading assistant for college engineering students. ' +
      'Lightly improve the readability of the following technical text without ' +
      'changing its content, depth, or technical vocabulary.\n\n' +
      'Rules:\n' +
      '- Preserve ALL technical terms, jargon, and academic vocabulary\n' +
      '- Only break sentences that are excessively long (30+ words)\n' +
      '- Replace genuinely archaic or convoluted phrasing with modern equivalents\n' +
      '- Preserve every concept, fact, example, formula, code, and number exactly\n' +
      '- Maintain full academic rigor — this is for higher learning\n' +
      '- Preserve paragraph structure\n' +
      '- Do NOT simplify or remove anything\n' +
      '- Return only the rewritten text',

    summary_keypoints:
      'Extract the key points from this technical text as a clean bulleted ' +
      'list for a college engineering student. Use markdown bullets (- ). ' +
      'Each point should be one clear sentence preserving technical accuracy. ' +
      'Include all important concepts, definitions, and conclusions. Do not ' +
      'oversimplify. 5-10 bullets depending on content length. Return only ' +
      'the bullet list.',

    summary_tldr:
      'Write a concise summary of this technical text in 3-5 sentences for ' +
      'a college engineering student. Preserve technical accuracy and key ' +
      'terms. Capture the main concepts and conclusions. Do not oversimplify. ' +
      'Return only the summary.',

  };

  /* -------------------------------------------------------------------------
     Chunking — splits on paragraph boundaries, falls back to sentences.
     Target: ~3 000 chars (~750 tokens) per chunk to stay under rate limits.
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
          // Paragraph too big — split on sentence boundaries
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
      temperature: 0.3,
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
      if (!output) throw new Error('The AI returned an empty response. Please try again.');

      return output.trim();
    }
  }

  /* -------------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------------- */

  /**
   * Simplify or summarise text via Groq.
   * Automatically chunks long inputs and processes them sequentially.
   *
   * @param {string} text
   * @param {object} options
   *   @param {string}   options.mode       'simplified' | 'summary'
   *   @param {number}   [options.level]    1|2|3
   *   @param {string}   [options.format]   'keypoints'|'tldr'
   *   @param {Function} [options.onRetry]  (attempt) => void
   *   @param {Function} [options.onProgress] (done, total) => void
   * @returns {Promise<string>}
   */
  async function simplifyText(text, options = {}) {
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

    const { mode, level, format, onRetry, onProgress } = options;

    const promptKey = mode === 'simplified' ? `simplified_${level}` : `summary_${format}`;
    const systemPrompt = SYSTEM_PROMPTS[promptKey];
    if (!systemPrompt) throw new Error(`Unknown mode key: ${promptKey}`);

    const chunks = chunkText(text, 3000);

    if (chunks.length === 1) {
      if (typeof onProgress === 'function') onProgress(1, 1);
      return await callGroqAPI(chunks[0], systemPrompt, onRetry);
    }

    // Multi-chunk: process sequentially with 2.5 s inter-chunk throttle
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

  /* -------------------------------------------------------------------------
     Export
     ------------------------------------------------------------------------- */
  window.SugamaSimplify = { simplifyText };

})();
