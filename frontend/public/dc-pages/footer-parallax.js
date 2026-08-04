/**
 * Parallax for the dotted world map behind the site footer.
 *
 * The map layer is taller than the footer (see `.vh-footer::before`), and this
 * drifts it against the scroll so it reads as sitting behind the page rather
 * than pasted onto it. Only a CSS custom property is written - the transform
 * itself lives in the stylesheet, so the hover scale composes with it instead
 * of fighting it.
 *
 * `background-attachment: fixed` would be the no-JS version, but it sizes and
 * positions against the viewport rather than the footer, and it is a known
 * jank source on iOS. A rAF-throttled transform is cheaper and controllable.
 *
 * Shared by every dc-page; loading it on a page with no footer is a no-op.
 */
(function () {
  "use strict";

  var RANGE = 90; // px of total travel, centred on the footer's own midpoint
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  function start() {
    var footers = document.querySelectorAll(".vh-footer");
    if (!footers.length) return;
    if (reduced && reduced.matches) return;

    var ticking = false;

    function apply() {
      ticking = false;
      var viewport = window.innerHeight || document.documentElement.clientHeight;

      for (var i = 0; i < footers.length; i += 1) {
        var footer = footers[i];
        var rect = footer.getBoundingClientRect();

        // Skip anything fully off screen - no point moving what nobody sees.
        if (rect.bottom < 0 || rect.top > viewport) continue;

        // 0 as the footer first appears at the bottom edge, 1 once its top has
        // reached the top of the viewport.
        var progress = 1 - rect.top / viewport;
        if (progress < 0) progress = 0;
        if (progress > 1) progress = 1;

        footer.style.setProperty("--vh-map-shift", ((0.5 - progress) * RANGE).toFixed(1) + "px");
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    apply();
  }

  // The framed pages render after their own scripts run, so the footer may not
  // exist yet at DOMContentLoaded. A short retry is cheaper than observing.
  function boot() {
    start();
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (document.querySelector(".vh-footer") || tries > 20) {
        clearInterval(timer);
        start();
      }
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
