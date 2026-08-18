/* Landing-page chrome: scroll-reveal and the nav's scrolled state.
   Kept separate from lang.js (shared by every page, including the legal
   ones) so the support pages don't load animation code they never use. */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal-on-scroll. If IntersectionObserver is missing or the user asked
  // for reduced motion, everything is shown immediately -- content must
  // never depend on an animation having run to become readable.
  var revealables = document.querySelectorAll('.reveal');
  if (reduceMotion || !window.IntersectionObserver) {
    revealables.forEach(function (el) {
      el.classList.add('in');
    });
  } else {
    var io = new window.IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.06 }
    );
    revealables.forEach(function (el) {
      io.observe(el);
    });

    // Failsafe: whatever happens, every section is visible a few seconds
    // after load. The observer above is an enhancement, and the cost of it
    // silently not firing -- on some browser, some embedded webview, some
    // future change to these selectors -- is a blank marketing page, which
    // is far worse than losing an animation.
    window.setTimeout(function () {
      revealables.forEach(function (el) {
        el.classList.add('in');
      });
    }, 2500);
  }

  // Hairline under the nav only once the page has actually moved.
  var nav = document.querySelector('.nav');
  if (nav) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        nav.classList.toggle('scrolled', window.scrollY > 12);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
