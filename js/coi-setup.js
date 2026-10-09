// Einstellungen für coi-serviceworker. Muss vor coi-serviceworker.js geladen werden.
// Der Service Worker gibt der Seite die "cross-origin isolation", damit die KI mehrere Prozessorkerne nutzen darf.

// Für alle Browser die Variante "require-corp" verwenden: Safari unterstützt "credentialless" nicht
window.coi = { coepCredentialless: () => false };

// Übernimmt der Service Worker die Seite erst nach dem Laden (oder mit alter Einstellung),
// fehlt die Freigabe noch: dann genau einmal neu laden
(function () {
  var sw = navigator.serviceWorker;
  if (!sw || window.crossOriginIsolated !== false) return;
  function reloadOnce() {
    try {
      if (window.crossOriginIsolated || sessionStorage.getItem('coiReloaded')) return;
      sessionStorage.setItem('coiReloaded', '1');
    } catch (e) { return; }
    location.reload();
  }
  if (sw.controller) setTimeout(reloadOnce, 300); // kurz warten, damit die neue Einstellung beim Service Worker ankommt
  sw.addEventListener('controllerchange', reloadOnce);
})();
