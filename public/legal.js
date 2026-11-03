// La taille de texte choisie dans Compte > Apparence : sur le web, l'app la garde dans ce même localStorage.
try {
  const echelle = { petit: 0.88, grand: 1.15, 'tres-grand': 1.3 }[localStorage.getItem('me:taille-texte')];
  if (echelle) document.documentElement.style.setProperty('--echelle', echelle);
} catch (_) {}
