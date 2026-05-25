(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────
     motion.js — SugamaPath motion library
     Exposed as window.SugamaMotion
     All effects respect prefers-reduced-motion.
     ───────────────────────────────────────────────────────────────── */

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. CURSOR GLOW FOLLOWER ──────────────────────────────────────
     Radial gradient blob follows the cursor with lerp smoothing.
     Auto-injected on every page. Disabled on touch devices and when
     data-no-cursor-glow is on <body>.
     ─────────────────────────────────────────────────────────────── */
  function initCursorGlow() {
    if (reducedMotion) return;
    if (document.body.hasAttribute('data-no-cursor-glow')) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    let mouseX = window.innerWidth  / 2;
    let mouseY = window.innerHeight / 2;
    let glowX  = mouseX;
    let glowY  = mouseY;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function animate() {
      const lerp = 0.08;
      glowX += (mouseX - glowX) * lerp;
      glowY += (mouseY - glowY) * lerp;
      glow.style.transform =
        `translate(calc(${glowX}px - 50%), calc(${glowY}px - 50%))`;
      requestAnimationFrame(animate);
    }
    animate();
  }

  /* ── 2. MAGNETIC BUTTONS ──────────────────────────────────────────
     Buttons that pull toward the cursor when hovered.
     Usage: add class .btn--magnetic to any button or link.
     ─────────────────────────────────────────────────────────────── */
  function initMagneticButtons() {
    if (reducedMotion) return;

    document.querySelectorAll('.btn--magnetic').forEach(btn => {
      if (btn.dataset.magneticInit) return;
      btn.dataset.magneticInit = 'true';

      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width  / 2;
        const y = e.clientY - rect.top  - rect.height / 2;
        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px) scale(1.05)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0, 0) scale(1)';
      });
    });
  }

  /* ── 3. 3D TILT CARDS ─────────────────────────────────────────────
     Cards tilt in 3D based on cursor position within the card.
     Usage: add class .tilt-card to any container.
     Max tilt: ±5deg — subtle and professional.
     ─────────────────────────────────────────────────────────────── */
  function initTiltCards() {
    if (reducedMotion) return;

    document.querySelectorAll('.tilt-card').forEach(card => {
      if (card.dataset.tiltInit) return;
      card.dataset.tiltInit = 'true';

      card.addEventListener('mousemove', (e) => {
        const rect    = card.getBoundingClientRect();
        const x       = e.clientX - rect.left;
        const y       = e.clientY - rect.top;
        const centerX = rect.width  / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) *  5;
        card.style.transform =
          `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform =
          'perspective(1000px) rotateX(0deg) rotateY(0deg)';
      });
    });
  }

  /* ── 4. SCROLL REVEALS ────────────────────────────────────────────
     Elements fade up into view as the user scrolls.
     Usage: add class .reveal to any element.
     Optional: data-reveal-delay="200" for stagger offset (ms).
     ─────────────────────────────────────────────────────────────── */
  function initScrollReveals() {
    if (reducedMotion) {
      document.querySelectorAll('.reveal').forEach(el =>
        el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const delay = parseInt(entry.target.dataset.revealDelay, 10) || 0;
        setTimeout(() => entry.target.classList.add('is-visible'), delay);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.reveal').forEach(el => {
      if (el.dataset.revealInit) return;
      el.dataset.revealInit = 'true';
      observer.observe(el);
    });
  }

  /* ── 5. PARALLAX HERO ─────────────────────────────────────────────
     Background moves slower than the foreground on scroll.
     Usage: add class .parallax-bg to an image inside .parallax-hero.
     data-parallax-speed controls the rate (default 0.3).
     ─────────────────────────────────────────────────────────────── */
  function initParallax() {
    if (reducedMotion) return;

    const els = document.querySelectorAll('.parallax-bg');
    if (!els.length) return;

    let ticking = false;

    function update() {
      const scroll = window.pageYOffset;
      els.forEach(el => {
        const speed = parseFloat(el.dataset.parallaxSpeed) || 0.3;
        el.style.transform = `translateY(${scroll * speed}px) scale(1.05)`;
      });
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── 6. FLOATING ELEMENTS ─────────────────────────────────────────
     Continuous subtle bob for decorative glyphs / icons.
     Usage: add class .floating to any element.
     JS only disables the CSS animation when reducedMotion is on.
     ─────────────────────────────────────────────────────────────── */
  function initFloating() {
    if (reducedMotion) {
      document.querySelectorAll('.floating').forEach(el => {
        el.style.animation = 'none';
      });
    }
  }

  /* ── 7. STAGGERED LIST REVEALS ────────────────────────────────────
     Automatically stagger children of .reveal-list.
     Each child gets an incremental delay capped at 600ms.
     ─────────────────────────────────────────────────────────────── */
  function initStaggerLists() {
    if (reducedMotion) {
      document.querySelectorAll('.reveal-list > *').forEach(el =>
        el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const parent = entry.target;
        [...parent.children].forEach((child, i) => {
          child.classList.add('reveal');
          setTimeout(() => child.classList.add('is-visible'), Math.min(i * 80, 600));
        });
        observer.unobserve(parent);
      });
    }, { threshold: 0.05 });

    document.querySelectorAll('.reveal-list').forEach(el => {
      if (el.dataset.staggerInit) return;
      el.dataset.staggerInit = 'true';
      observer.observe(el);
    });
  }

  /* ── 8. COUNTER ANIMATION ─────────────────────────────────────────
     Animates a number from 0 to its target value when scrolled into view.
     Usage: <span class="count-up" data-target="42">0</span>
     data-duration overrides animation duration in ms (default 1200).
     ─────────────────────────────────────────────────────────────── */
  function initCounters() {
    if (reducedMotion) {
      document.querySelectorAll('.count-up').forEach(el => {
        el.textContent = el.dataset.target || el.textContent;
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el       = entry.target;
        const target   = parseFloat(el.dataset.target) || 0;
        const duration = parseInt(el.dataset.duration, 10) || 1200;
        const suffix   = el.dataset.suffix || '';
        const start    = performance.now();

        function tick(now) {
          const elapsed  = now - start;
          const progress = Math.min(elapsed / duration, 1);
          /* Ease out cubic */
          const eased    = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(eased * target) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('.count-up').forEach(el => {
      if (el.dataset.countInit) return;
      el.dataset.countInit = 'true';
      observer.observe(el);
    });
  }

  /* ── Rescan — call after dynamic DOM insertions ───────────────────
     lesson.js, learn.js etc. call SugamaMotion.rescan() after they
     inject cards or other elements into the page.
     ─────────────────────────────────────────────────────────────── */
  function rescan() {
    initMagneticButtons();
    initTiltCards();
    initScrollReveals();
    initStaggerLists();
    initCounters();
    initFloating();
  }

  /* ── Boot ─────────────────────────────────────────────────────── */
  function init() {
    initCursorGlow();
    initMagneticButtons();
    initTiltCards();
    initScrollReveals();
    initParallax();
    initFloating();
    initStaggerLists();
    initCounters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SugamaMotion = { init, rescan };

})();
