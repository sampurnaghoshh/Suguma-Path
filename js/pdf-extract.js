/**
 * pdf-extract.js — SugamaPath PDF Text Extraction
 *
 * Wraps PDF.js to extract readable plain text from uploaded PDF files.
 * Requires pdfjsLib to already be loaded (via CDN script tag).
 *
 * Exports: window.SugamaPDF.extractTextFromPDF(file, onProgress)
 *
 * onProgress(currentPage, totalPages) — called after each page is processed
 *
 * Returns: { text: string, pageCount: number, charCount: number }
 */

(function () {

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
  const MIN_TEXT_CHARS = 100;              // below this → probably a scanned PDF

  /**
   * Read a File as an ArrayBuffer.
   */
  function readFileAsBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Couldn\'t read the file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Extract text from a single PDF page using positional data.
   *
   * PDF.js returns each text fragment with a transform matrix where
   * transform[4] = x position and transform[5] = y position (y increases upward).
   * We use these to decide whether fragments belong on the same line,
   * a new line within the same paragraph, or a new paragraph entirely.
   */
  async function extractPageText(page) {
    const textContent = await page.getTextContent();
    const items = textContent.items;

    if (items.length === 0) return '';

    let result  = '';
    let lastY   = null;
    let lastEndX = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.str || !item.str.trim()) continue;

      const y         = item.transform[5];
      const x         = item.transform[4];
      const itemWidth = item.width || 0;

      if (lastY === null) {
        // First item on page
        result += item.str;
      } else {
        const yDiff = Math.abs(lastY - y);

        if (yDiff < 2) {
          // Same line — join directly or with a space depending on horizontal gap
          const gap = x - lastEndX;
          result += (gap > 1 ? ' ' : '') + item.str;

        } else if (yDiff < 20) {
          // Adjacent line — still the same paragraph (wrapped sentence).
          // Join with a space so prose flows naturally rather than breaking.
          if (!result.endsWith(' ') && !result.endsWith('\n')) result += ' ';
          result += item.str;

        } else {
          // Large vertical gap → new paragraph
          result += '\n\n' + item.str;
        }
      }

      lastY    = y;
      lastEndX = x + itemWidth;
    }

    return result;
  }

  /**
   * Extract all text from a PDF file using PDF.js.
   *
   * @param {File}     file       - The PDF File object from a file input or drop.
   * @param {Function} onProgress - Called with (currentPage, totalPages) per page.
   * @returns {Promise<{text: string, pageCount: number, charCount: number}>}
   */
  async function extractTextFromPDF(file, onProgress) {
    // Validate type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      const err = new Error('Not a PDF file. Please upload a .pdf document.');
      err.code = 'NOT_PDF';
      throw err;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const err = new Error(`File too large (${sizeMB} MB). Maximum allowed size is 20 MB.`);
      err.code = 'TOO_LARGE';
      throw err;
    }

    // Ensure PDF.js is loaded
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library failed to load. Please refresh the page.');
    }

    let pdf;
    try {
      const buffer = await readFileAsBuffer(file);
      pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    } catch (e) {
      const err = new Error('Couldn\'t read this PDF. The file may be corrupt or password-protected.');
      err.code = 'PARSE_ERROR';
      throw err;
    }

    const pageCount = pdf.numPages;
    const pageTexts = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      if (typeof onProgress === 'function') onProgress(pageNum, pageCount);

      const page     = await pdf.getPage(pageNum);
      const pageText = await extractPageText(page);

      if (pageText.trim()) pageTexts.push(pageText.trim());
    }

    // Join pages, then normalise whitespace
    let text = pageTexts.join('\n\n');

    // Collapse 3+ consecutive newlines → 2, and 2+ spaces → 1
    text = text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    // Detect scanned-image PDFs (no extractable text layer)
    if (text.length < MIN_TEXT_CHARS) {
      const err = new Error(
        'This PDF has no extractable text — it may contain scanned images rather than selectable text. ' +
        'Try a text-based PDF (lecture notes, articles, ebooks).'
      );
      err.code = 'NO_TEXT';
      throw err;
    }

    // Sanity check: warn if extraction looks broken (>50% single-word lines)
    const lines          = text.split('\n').filter(l => l.trim());
    const singleWordLines = lines.filter(l => l.trim().split(/\s+/).length === 1).length;
    if (lines.length > 20 && singleWordLines / lines.length > 0.5) {
      console.warn(
        `[SugamaPDF] Extraction quality warning: ${Math.round(singleWordLines / lines.length * 100)}% ` +
        'of lines are single words. PDF may have unusual encoding.'
      );
    }

    return { text, pageCount, charCount: text.length };
  }

  /* Export */
  window.SugamaPDF = { extractTextFromPDF };

})();
