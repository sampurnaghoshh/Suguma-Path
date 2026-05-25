/**
 * animations.js — SugamaPath scroll-reveal
 *
 * Watches .reveal elements with IntersectionObserver.
 * Adds .is-visible when they enter the viewport, triggering
 * the opacity+translate transition defined in global.css.
 * Staggers siblings by their index (60ms per step).
 */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el      = entry.target;
        const parent  = el.parentElement;
        const siblings = parent
          ? [...parent.querySelectorAll('.reveal')]
          : [el];
        const idx = siblings.indexOf(el);

        /* Stagger: 60ms per sibling, max 300ms */
        el.style.transitionDelay = `${Math.min(idx * 60, 300)}ms`;
        el.classList.add('is-visible');

        observer.unobserve(el);
      });
    },
    {
      threshold:  0.1,
      rootMargin: '0px 0px -48px 0px',
    }
  );

  /* Observe all .reveal elements present at DOM-ready */
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
})();
