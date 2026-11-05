// Avant le chargement de l'app. Fichier à part : la politique de sécurité du site refuse les scripts écrits dans la page.
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
})();
