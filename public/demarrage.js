// L'écran de démarrage et le message de panne. Fichier à part : la politique de sécurité du site refuse les scripts écrits dans la page.
// Se ferme quand l'app est prête, jamais avant 600 ms pour ne pas clignoter. Au bout de 5 s, le squelette de
// chargement prend le relais, mais seulement s'il est là : avant, il ne resterait qu'une page noire.
(function () {
  var debut = Date.now();
  var ferme = false;
  function vide() {
    var r = document.getElementById('root');
    return !r || !r.children.length;
  }
  window.__fermerSplash = function () {
    if (ferme) return;
    ferme = true;
    setTimeout(function () {
      var s = document.getElementById('me-splash');
      if (!s) return;
      s.classList.add('fini');
      setTimeout(function () { s.remove(); }, 320);
    }, Math.max(0, 600 - (Date.now() - debut)));
  };
  (function attendre() {
    if (Date.now() - debut >= 5000 && !vide()) return window.__fermerSplash();
    if (!ferme) setTimeout(attendre, 500);
  })();

  // Rien ne s'affiche : on le dit, avec l'erreur et une sortie, plutôt qu'une page noire.
  function panne(titre, detail) {
    var p = document.getElementById('me-panne');
    if (p || !vide()) return;
    p = document.createElement('div');
    p.id = 'me-panne';
    var h = document.createElement('h1');
    h.textContent = titre;
    p.appendChild(h);
    if (detail) {
      var d = document.createElement('p');
      d.textContent = detail;
      p.appendChild(d);
    }
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Recharger';
    b.onclick = function () {
      try {
        sessionStorage.removeItem('me-rechargement');
      } catch (e) {}
      location.reload();
    };
    p.appendChild(b);
    document.body.appendChild(p);
    // Une connexion lente finit par charger l'app : le message s'efface alors.
    var t = setInterval(function () {
      if (vide()) return;
      clearInterval(t);
      p.remove();
    }, 500);
  }
  window.addEventListener(
    'error',
    function (e) {
      var t = e.target;
      var fichier = t && t.tagName === 'SCRIPT';
      if (!fichier && !e.message) return;
      var detail = fichier ? 'Fichier non chargé : ' + t.src : e.message;
      setTimeout(function () { panne("Me n'a pas pu s'afficher", detail); }, 1500);
    },
    true,
  );
  setTimeout(function () { panne('Me met du temps à charger', 'Vérifie ta connexion.'); }, 45000);
})();
