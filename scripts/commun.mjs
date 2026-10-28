/**
 * Code commun avec le serveur : `src/lib/commun/` est la copie exacte de `me-api/src/commun/` (rappels, modes, jours,
 * prévisions, objectifs, tâches de projet, synchro par différences). On le modifie dans me-api, jamais ici.
 *
 *   npm run commun            recopie les fichiers depuis me-api
 *   npm run commun:verifier   échoue si la copie diffère (lancé par la CI)
 *
 * La liste des fichiers vient de `src/commun/fichiers.json` dans me-api (un test de me-api la garde complète).
 * Source : `--depuis <dossier me-api>` pour une copie locale, sinon GitHub. Branche : `COMMUN_REF`, sinon la branche de
 * la PR en cours si me-api en a une du même nom (les deux PR avancent ensemble), sinon `main`.
 * Seule différence permise : les imports perdent leur extension `.js` (Metro et les tests de l'app les résolvent sans).
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEPOT = 'jeereq/me-api';
const DOSSIER_SOURCE = 'src/commun';
const CIBLE = 'src/lib/commun';
const args = process.argv.slice(2);
const verifier = args.includes('--verifier');
const depuis = args.includes('--depuis') ? args[args.indexOf('--depuis') + 1] : '';

const garder = (nom) => nom.endsWith('.ts') || nom === 'README.md';
/** `from './modes.js'` devient `from './modes'`. */
const adapter = (texte) => texte.replace(/(from\s+'\.\.?\/[^']+)\.js'/g, "$1'");
const brut = (ref, nom) => `https://raw.githubusercontent.com/${DEPOT}/${encodeURIComponent(ref)}/${DOSSIER_SOURCE}/${nom}`;

/** La liste des fichiers sur cette branche, ou null si la branche n'existe pas dans me-api. */
async function liste(ref) {
  const r = await fetch(brut(ref, 'fichiers.json'));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${brut(ref, 'fichiers.json')} : ${r.status}`);
  return (await r.json()).fichiers;
}

/** Les fichiers de la source : nom → contenu adapté. */
async function source() {
  const fichiers = new Map();
  if (depuis) {
    const dossier = join(depuis, DOSSIER_SOURCE);
    const noms = JSON.parse(await readFile(join(dossier, 'fichiers.json'), 'utf8')).fichiers;
    for (const nom of noms) fichiers.set(nom, adapter(await readFile(join(dossier, nom), 'utf8')));
    return { fichiers, origine: dossier };
  }
  const voulue = process.env.COMMUN_REF || process.env.GITHUB_HEAD_REF || 'main';
  let ref = voulue;
  let noms = await liste(ref);
  if (!noms && ref !== 'main') noms = await liste((ref = 'main'));
  if (!noms) throw new Error(`Pas de ${DOSSIER_SOURCE}/fichiers.json dans ${DEPOT}@${ref}`);
  for (const nom of noms) {
    const r = await fetch(brut(ref, nom));
    if (!r.ok) throw new Error(`${brut(ref, nom)} : ${r.status}`);
    fichiers.set(nom, adapter(await r.text()));
  }
  return { fichiers, origine: `${DEPOT}@${ref}` };
}

async function copieActuelle() {
  const fichiers = new Map();
  try {
    for (const nom of (await readdir(CIBLE)).filter(garder)) fichiers.set(nom, await readFile(join(CIBLE, nom), 'utf8'));
  } catch {
    // Pas encore de copie.
  }
  return fichiers;
}

const { fichiers, origine } = await source();
if (!fichiers.size) throw new Error(`Aucun fichier dans ${origine}`);
const actuels = await copieActuelle();

if (verifier) {
  const ecarts = [...new Set([...fichiers.keys(), ...actuels.keys()])].filter((nom) => fichiers.get(nom) !== actuels.get(nom));
  if (ecarts.length) {
    console.error(`${CIBLE} diffère de ${origine} : ${ecarts.join(', ')}.\nLance \`npm run commun\` pour recopier le code commun (on le modifie dans me-api, jamais ici).`);
    process.exit(1);
  }
  console.log(`${CIBLE} est à jour avec ${origine} (${fichiers.size} fichiers).`);
} else {
  await mkdir(CIBLE, { recursive: true });
  for (const nom of actuels.keys()) if (!fichiers.has(nom)) await rm(join(CIBLE, nom));
  for (const [nom, texte] of fichiers) await writeFile(join(CIBLE, nom), texte);
  console.log(`${fichiers.size} fichiers copiés depuis ${origine} dans ${CIBLE}.`);
}
