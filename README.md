# SugamaPath

> **Sugama** (ಸುಗಮ) means *comfortable* or *easy* in Kannada.

An accessible reading and language-learning platform built for neurodivergent learners — designed especially for students with dyslexia, ADHD, and reading difficulties who study technical material in English while their first language may be a regional Indian language.

SugamaPath combines three forms of accessibility into one tool:
- **Visual accessibility** — dyslexia-friendly fonts, customizable spacing, line focus
- **Cognitive accessibility** — AI-powered text simplification at multiple reading levels
- **Linguistic accessibility** — translation into 15+ languages including 10 Indian languages

---

## Table of Contents

1. [Why this exists](#why-this-exists)
2. [Features](#features)
3. [Tech stack](#tech-stack)
4. [Setup](#setup)
5. [How to use](#how-to-use)
6. [Project structure](#project-structure)
7. [Configuration](#configuration)
8. [Browser support](#browser-support)
9. [Known limitations](#known-limitations)
10. [Future roadmap](#future-roadmap)
11. [Credits](#credits)

---

## Why this exists

Existing tools tackle only fragments of the accessibility problem:

- **Dyslexia tools** (BeeLine Reader, OpenDyslexic) only handle the visual layer — they reformat text but don't simplify dense academic language
- **Language learning apps** (Duolingo, Memrise) barely support Indian scripts and offer no accessibility features
- **AI tools** (ChatGPT, Claude) can simplify text but aren't designed for accessibility-first reading

Indian engineering students — especially those with dyslexia studying in English while thinking in Kannada, Hindi, Tamil, or another regional language — fall through every crack. SugamaPath addresses all three layers in one tool.

---

## Features

### Reading Tool

**Input methods**
- Paste any text directly
- Fetch articles from URLs (Wikipedia direct API + CORS proxy fallback chain)
- Upload PDFs (textbooks, lecture slides, research papers) with smart text extraction

**Visual accessibility**
- Toggle between Lexend (designed to reduce visual stress) and OpenDyslexic (weighted bottoms reduce letter rotation)
- Live sliders for font size (14–28px), line height (1.4–2.4), letter spacing (0–0.15em), word spacing (0–0.4em)
- Three themes: Light (paper-white), Dark, High-contrast (yellow-on-black)
- All settings persist across sessions via localStorage

**Cognitive accessibility (AI-powered)**
- **Simplified mode** — three depth levels:
  - Level 1 (most simplified): Aggressive jargon replacement, short sentences, inline explanations
  - Level 2 (balanced, default): Clearer language while preserving academic vocabulary
  - Level 3 (lighter touch): Minor readability improvements without simplification
- **Summary mode** — two formats:
  - Key Points: bulleted summary preserving technical accuracy
  - TL;DR: 3-5 sentence overview
- All AI processing preserves technical terms, code, formulas, and numerical data exactly

**Linguistic accessibility (AI-powered)**
- Translate any content into 20 languages:
  - Indian: Hindi, Kannada, Tamil, Telugu, Bengali, Marathi, Gujarati, Malayalam, Punjabi, Urdu
  - Global: Spanish, French, German, Portuguese, Arabic, Mandarin Chinese, Japanese, Korean, Russian, Indonesian
- Translation works on top of simplification — read your textbook simplified AND in your mother tongue
- Right-to-left rendering for Arabic and Urdu
- Technical terms intelligently preserved in English

### Learn Kannada

- **Alphabet lessons** — Vowels (16), Consonants (34), Numbers (0–10) with click-to-hear pronunciation
- **Vocabulary lessons** — Greetings, Family, Food with flashcard interaction
- Multiple-choice quizzes after each lesson
- Progress tracking + vocabulary notebook
- Audio via Web Speech API (Kannada → Hindi fallback)

### Sitewide

- Full keyboard navigation
- ARIA labels throughout for screen reader compatibility
- Skip-to-content links
- Mobile-first responsive design
- No tracking, no analytics, no accounts — everything stays on your device

---

## Tech stack

**Frontend** (pure web, no framework)
- HTML5 with semantic structure and ARIA
- CSS3 with custom properties, Grid, Flexbox, clamp() for fluid typography
- Vanilla JavaScript (ES2020+, modules where needed)

**Typography**
- [Fraunces](https://fonts.google.com/specimen/Fraunces) — variable serif for display headings
- [Lexend](https://fonts.google.com/specimen/Lexend) — accessibility-optimized sans-serif for body
- [OpenDyslexic](https://opendyslexic.org/) — optional dyslexia-friendly font

**Libraries**
- [Readability.js](https://github.com/mozilla/readability) (Mozilla) — clean article extraction from URLs
- [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla) — client-side PDF parsing

**APIs**
- [Groq](https://groq.com) (Llama 3.3 70B) — AI text simplification, summarization, translation
- [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) — direct CORS-friendly article fetching
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — Kannada text-to-speech
- [Unsplash Source](https://source.unsplash.com) — vocabulary lesson images

---

## Setup

### Prerequisites

- A modern browser (Chrome, Edge, Firefox, or Safari — latest versions)
- A code editor with a local server. We recommend **VS Code + Live Server extension**
- A free Groq API key (for AI features)

### Installation

1. **Clone or download** this repository to your machine.

2. **Get a Groq API key**:
   - Go to [console.groq.com](https://console.groq.com)
   - Sign up (free, no credit card required)
   - Navigate to API Keys → Create API Key
   - Copy the key (starts with `gsk_...`)

3. **Configure the API key**:
   - Copy `js/config.example.js` to `js/config.js`
   - Open `js/config.js` and paste your Groq key:
     ```javascript
     window.SUGAMA_CONFIG = {
       GROQ_API_KEY: 'gsk_your_actual_key_here',
       GROQ_MODEL: 'llama-3.3-70b-versatile'
     };
     ```
   - `js/config.js` is gitignored — your key will not be committed

4. **Open with Live Server**:
   - In VS Code, install the "Live Server" extension by Ritwick Dey
   - Right-click `index.html` → "Open with Live Server"
   - Your default browser opens to `http://127.0.0.1:5500/`

   **Why Live Server matters**: Opening the HTML files directly via `file://` will break URL fetching (CORS) and may cause Web Speech API issues. Always use a local server.

---

## How to use

### Reading any text

1. Open the **Reading Tool** from the navigation
2. Choose an input method:
   - **Paste Text** — paste content directly
   - **From URL** — fetch a Wikipedia or article URL
   - **Upload PDF** — drag-drop or click to browse a PDF file
3. Click **Format Text** / **Fetch & Format** / **Extract & Format**
4. Adjust accessibility controls (font, spacing) — changes apply in real time

### Simplifying dense content

1. Load any content (paste, URL, or PDF)
2. In the **Reading Mode** section, click **Simplified**
3. Choose Level 1, 2, or 3 (Level 2 recommended for most users)
4. Wait for AI processing (5-30 seconds depending on length)
5. Toggle **Show original** ↔ **Show simplified** to compare

### Translating content

1. Load content and optionally apply simplification first
2. In the **Translation** section, choose a target language
3. Translation processes the *current view* (original or simplified)
4. Set language back to "Original language" to revert

### Common workflow for studying

```
PDF lecture slides
   ↓ Upload PDF
   ↓ Extract & Format
Original (dense academic English)
   ↓ Switch to Simplified · Level 2
Simplified English (jargon decoded, sentences shorter)
   ↓ Switch translation to Hindi
Simplified Hindi (now understandable AND in your language)
```

### Learning Kannada

1. Open **Learn Kannada** from the navigation
2. Pick a lesson module (start with Vowels)
3. For alphabet lessons: click each character → hear pronunciation → see example
4. For vocabulary lessons: flip flashcards, mark "I knew it" or "Still learning"
5. Take the quiz at the end of each lesson
6. Track progress on the Dashboard

---

## Project structure

```
SugamaPath/
├── index.html                  Landing page
├── reading.html                Reading tool (main feature page)
├── learn.html                  Kannada lesson grid
├── lesson.html                 Individual Kannada lesson (dynamic via ?id=)
├── practice.html               Script tracing practice (placeholder)
├── dashboard.html              Progress tracking (placeholder)
├── settings.html               Accessibility settings (placeholder)
│
├── css/
│   ├── global.css              Design tokens, typography, shared components
│   ├── index.css               Landing page styles
│   ├── reading.css             Reading tool styles
│   ├── learn.css               Lesson grid styles
│   └── lesson.css              Individual lesson styles
│
├── js/
│   ├── config.js               API keys (gitignored, you create this)
│   ├── config.example.js       Template for config.js
│   ├── settings.js             Sitewide settings + localStorage manager
│   ├── animations.js           Scroll-reveal intersection observer
│   ├── reading.js              Reading tool main logic
│   ├── simplify.js             Groq API wrapper for AI simplification
│   ├── translate.js            Groq API wrapper for translation
│   ├── pdf-extract.js          PDF.js wrapper with smart text extraction
│   ├── audio.js                Web Speech API wrapper for Kannada TTS
│   ├── unsplash.js             Vocabulary image fetching
│   ├── learn.js                Lesson grid + progress logic
│   └── lesson.js               Individual lesson page logic
│
├── data/
│   ├── kannada-vowels.json     16 vowels with examples
│   ├── kannada-consonants.json 34 consonants
│   ├── kannada-numbers.json    0–10 with Kannada digits
│   ├── kannada-greetings.json  Greetings & politeness vocabulary
│   ├── kannada-family.json     Family member vocabulary
│   └── kannada-food.json       Food vocabulary
│
├── .gitignore
├── README.md                   This file
└── LICENSE
```

---

## Configuration

### API key management

The Groq API key lives in `js/config.js`, which is **gitignored** to prevent accidental commits. The file should never be checked into version control.

### Rate limits

Groq's free tier provides:
- 30 requests per minute
- 6,000 tokens per minute
- 14,400 requests per day

The app handles rate limits gracefully with:
- Automatic retry on HTTP 429 (with Retry-After header support)
- 500ms debouncing on mode/level changes
- Chunked processing for long content (splits on paragraph boundaries)
- In-flight request cancellation when user changes mode

For demo or heavy use, you can create multiple API keys in Groq console and rotate them.

### Choosing a different model

To use a different Llama variant or another Groq-hosted model, edit `GROQ_MODEL` in `js/config.js`. Suggested alternatives:
- `llama-3.3-70b-versatile` (default — best quality)
- `llama-3.1-8b-instant` (faster, lower quality)
- `mixtral-8x7b-32768` (longer context window)

---

## Browser support

| Browser | Reading Tool | AI Features | PDF Upload | Kannada TTS |
|---------|--------------|-------------|------------|-------------|
| Chrome / Edge | ✅ Full | ✅ Full | ✅ Full | ✅ Yes |
| Firefox | ✅ Full | ✅ Full | ✅ Full | ⚠️ Hindi fallback |
| Safari | ✅ Full | ✅ Full | ✅ Full | ⚠️ Limited |
| Mobile Safari | ✅ Full | ✅ Full | ✅ Full | ⚠️ Limited |

Web Speech API support for Indian languages varies by browser and OS. Chrome on Android and Windows has the best Kannada voice support. Where Kannada is unavailable, the app falls back to Hindi (phonetically close).

---

## Known limitations

- **Scanned PDFs**: PDF.js extracts text from text-based PDFs only. Scanned image PDFs require OCR (not implemented).
- **Very long content**: Content over ~10,000 words is chunked into multiple API calls, taking 30+ seconds.
- **CORS proxies for URL fetching**: Public proxies (allorigins.win, corsproxy.io, codetabs.com) can be slow or unreliable. Wikipedia uses its own CORS-friendly API and is always fast.
- **Kannada voice availability**: Some browsers don't include Kannada TTS voices. The Hindi fallback works phonetically but isn't perfect.
- **API key exposure**: The Groq key lives in frontend JavaScript, which is visible to anyone who views the page source. This is acceptable for a local/demo deployment but would need a backend proxy for public production use.

---

## Future roadmap

**Phase 1 — Reading Tool depth**
- Word-by-word text-to-speech with live highlighting
- Line focus mode (dim non-focused lines)
- Bionic reading mode (bold first half of words)
- Reading position memory (resume where you left off)

**Phase 2 — Learn Kannada depth**
- Canvas-based script tracing with stroke-order validation
- Spaced repetition system for vocabulary review
- More lesson modules: Colors, Days, Months, Travel, Shopping
- Conversation practice with sample dialogues

**Phase 3 — Languages**
- Tamil, Hindi, Bengali lesson modules
- Cross-language vocabulary linking

**Phase 4 — Platform**
- Progressive Web App (offline support, installable)
- Optional cloud sync of progress (Firebase or similar)
- Browser extension for in-place simplification on any webpage

---

## Credits

**Built by**: Sampurna Ghosh
**Course**: Web Technologies, B.Tech 3rd year
**Year**: 2026

**Libraries & APIs**
- Readability.js by Mozilla — article extraction
- PDF.js by Mozilla — PDF parsing
- Llama 3.3 by Meta, served by Groq — AI processing
- Lexend font by Bonnie Shaver-Troup, Thomas Jockin et al.
- Fraunces font by Phaedra Charles, Flavia Zimbardi, David Jonathan Ross
- OpenDyslexic font by Abelardo Gonzalez

**Special thanks** to the Kannada-speaking community of Bengaluru for inspiring the localized focus, and to every dyslexic student who has had to fight their reading material instead of learning from it.

---

## License

MIT License. See `LICENSE` file for full text. You're free to use, modify, and distribute this project for any purpose. Attribution appreciated but not required.

---

*"Learning should feel like walking a comfortable path — not climbing a wall built for someone else's body."*
— The SugamaPath Principle