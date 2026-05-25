(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────
     audio.js — Web Speech API wrapper for Kannada pronunciation
     Exposed as window.SugamaAudio
     ───────────────────────────────────────────────────────────────── */

  let voicesReady     = false;
  let availableVoices = [];

  function loadVoices() {
    availableVoices = window.speechSynthesis.getVoices();
    voicesReady     = availableVoices.length > 0;
  }

  if (typeof window.speechSynthesis !== 'undefined') {
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }

  function findBestVoice() {
    if (!voicesReady) loadVoices();

    /* Priority 1 — Kannada */
    const kn = availableVoices.find(v => v.lang.startsWith('kn'));
    if (kn) return { voice: kn, lang: 'kn-IN', fallback: false };

    /* Priority 2 — Hindi (phonetically closer than English for Devanagari-adjacent sounds) */
    const hi = availableVoices.find(v => v.lang.startsWith('hi'));
    if (hi) return { voice: hi, lang: 'hi-IN', fallback: true };

    /* Priority 3 — Indian English */
    const enIN = availableVoices.find(v => v.lang === 'en-IN');
    if (enIN) return { voice: enIN, lang: 'en-IN', fallback: true };

    /* Last resort — whatever the browser has */
    return { voice: null, lang: 'kn-IN', fallback: true };
  }

  function speak(text, options) {
    options = options || {};

    if (typeof window.speechSynthesis === 'undefined') {
      return Promise.reject(new Error('Speech synthesis not supported in this browser'));
    }

    return new Promise(function (resolve, reject) {
      window.speechSynthesis.cancel();

      var utterance = new SpeechSynthesisUtterance(text);
      var best      = findBestVoice();

      utterance.lang   = best.lang;
      if (best.voice)  utterance.voice  = best.voice;
      utterance.rate   = options.rate   || 0.85;   /* Slower for learning */
      utterance.pitch  = options.pitch  || 1.0;
      utterance.volume = options.volume || 1.0;

      utterance.onend   = function ()  { resolve(); };
      utterance.onerror = function (e) {
        /* Chrome fires 'interrupted' when cancel() is called — not a real error */
        if (e.error === 'interrupted' || e.error === 'canceled') {
          resolve();
        } else {
          reject(e);
        }
      };

      /* Chrome bug: synthesis stalls after page sits idle */
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();

      window.speechSynthesis.speak(utterance);
    });
  }

  function stop() {
    if (typeof window.speechSynthesis !== 'undefined') {
      window.speechSynthesis.cancel();
    }
  }

  function isAvailable() {
    return typeof window.speechSynthesis !== 'undefined';
  }

  function hasKannadaVoice() {
    if (!voicesReady) loadVoices();
    return availableVoices.some(function (v) { return v.lang.startsWith('kn'); });
  }

  window.SugamaAudio = { speak: speak, stop: stop, isAvailable: isAvailable,
                         hasKannadaVoice: hasKannadaVoice, findBestVoice: findBestVoice };
})();
