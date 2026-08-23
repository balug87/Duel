/* Temporary bootstrap: load last known-good match.js from the draw-fix commit. */
(function () {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/balug87/Duel@1c98a389d7bbb66c851188f5449d34b4596448ef/js/match.js';
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
})();
