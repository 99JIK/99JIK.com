// Google Analytics 4 loader. ID lives in SITE_DATA.site.gaTagId — empty string disables.
// Skips entirely when DNT is on or in localhost dev (so my own visits don't pollute).
(function () {
  const id = window.SITE_DATA && window.SITE_DATA.site && window.SITE_DATA.site.gaTagId;
  if (!id) return;

  // Respect Do Not Track.
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

  // Skip on localhost / dev — don't taint my own analytics.
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id);
})();
