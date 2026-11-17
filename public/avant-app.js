// Avant le chargement de l'app. Fichier à part : la politique de sécurité du site refuse les scripts écrits dans la page.
/* eslint-disable no-var -- écrit pour démarrer aussi sur un vieux navigateur, et y afficher le message de panne. */
// Safari iOS ignore user-scalable=no depuis iOS 10 : on bloque nous-mêmes le pincement.
// Le double-tap, lui, est coupé par touch-action plus haut, sans retarder ni perdre les clics rapides.
(function () {
  function bloquer(e) {
    e.preventDefault();
  }
  document.addEventListener('gesturestart', bloquer, { passive: false });
  document.addEventListener('gesturechange', bloquer, { passive: false });
  document.addEventListener(
    'touchmove',
    function (e) {
      if (e.touches.length > 1 || (e.scale !== undefined && e.scale !== 1)) e.preventDefault();
    },
    { passive: false },
  );
})();

// Après une mise à jour du site, un onglet resté ouvert (ou une page en cache) peut chercher un fichier de
// l'ancienne version, qui n'existe plus : on recharge une fois pour prendre la nouvelle.
(function () {
  var CLE = 'me-rechargement';
  function recharger() {
    try {
      if (sessionStorage.getItem(CLE)) return;
      sessionStorage.setItem(CLE, '1');
    } catch (e) {
      return;
    }
    location.reload();
  }
  // Une page qui a démarré normalement peut se recharger à nouveau lors de la prochaine mise à jour.
  setTimeout(function () {
    try {
      sessionStorage.removeItem(CLE);
    } catch (e) {}
  }, 15000);
  window.addEventListener(
    'error',
    function (e) {
      var t = e.target;
      if (t && t.tagName === 'SCRIPT' && /\/_expo\/static\//.test(t.src || '')) return recharger();
      if (/_expo\/static\//.test(e.filename || '') && /Unexpected token '<'|Requiring unknown module/.test(e.message || '')) recharger();
    },
    true,
  );
  // Un écran chargé à la demande (« Loading module …/taches-….js failed ») : la promesse est rejetée sans erreur de script.
  window.addEventListener('unhandledrejection', function (e) {
    var m = (e.reason && (e.reason.message || String(e.reason))) || '';
    if (/Loading module .* failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(m)) recharger();
  });
})();

// Le thème choisi à la dernière visite (src/lib/fond-web.ts) : pas d'écran sombre avant un thème clair,
// et des ascenseurs de la bonne couleur dès la première image.
(function () {
  try {
    var couleur = function (cle) {
      var v = localStorage.getItem(cle);
      return v && /^#[0-9a-f]{6}$/i.test(v) ? v : '';
    };
    var racine = document.documentElement;
    var fond = couleur('me-fond');
    var accent = couleur('me-accent');
    var sombre = localStorage.getItem('me-sombre');
    if (accent) racine.style.setProperty('--me-accent', accent);
    if (sombre === '0' || sombre === '1') {
      racine.style.colorScheme = sombre === '1' ? 'dark' : 'light';
      racine.style.setProperty('--me-survol', sombre === '1' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.045)');
    }
    if (!fond) return;
    racine.style.setProperty('--me-fond', fond);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', fond);
  } catch (e) {}
})();
