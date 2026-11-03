/**
 * Refait les captures de la page d'accueil, l'image de partage et les captures du manifeste à partir de la vraie app.
 * À lancer après `npx expo export -p web`, avec Playwright installé : c'est ce que fait le workflow « Captures ».
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';

import { AUJOURDHUI, espaceExemple } from './exemple.mjs';

const { chromium } = createRequire(`${process.cwd()}/`)('playwright');
const RACINE = process.cwd();
const APERCU = join(RACINE, 'assets/images/apercu');
const PUBLIC = join(RACINE, 'public');
mkdirSync(APERCU, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const serveur = http.createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const candidats = chemin.startsWith('/_racine/') ? [join(RACINE, chemin.slice(9))] : [join(RACINE, 'dist', chemin)];
  const fichier = candidats.find((f) => existsSync(f) && statSync(f).isFile()) ?? join(RACINE, 'dist/index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream' });
  createReadStream(fichier).pipe(res);
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const ADRESSE = `http://127.0.0.1:${serveur.address().port}`;

const navigateur = await chromium.launch();
const echecs = [];

async function contexte(options) {
  const ctx = await navigateur.newContext({ locale: 'fr-FR', timezoneId: 'Africa/Kinshasa', colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block', ...options });
  const espace = JSON.stringify(espaceExemple());
  await ctx.addInitScript((e) => {
    localStorage.setItem('me:espace:local', e);
  }, espace);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('erreur de page :', e.message));
  await page.clock.setFixedTime(new Date(`${AUJOURDHUI}T09:30:00+01:00`));
  return page;
}

const voir = (page, texte) => page.getByText(texte, { exact: true }).first();

async function prise(page, nom, chemin, attendu, avant) {
  try {
    await page.goto(ADRESSE + chemin);
    await voir(page, attendu).waitFor({ timeout: 30000 });
    if (avant) await avant(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(APERCU, `${nom}.jpg`), type: 'jpeg', quality: 82 });
    console.log('ok', nom);
  } catch (e) {
    echecs.push(nom);
    console.log('ÉCHEC', nom, e.message.split('\n')[0]);
    console.log((await page.locator('body').innerText().catch(() => '')).slice(0, 600));
  }
}

const cliquer = (texte) => async (page) => {
  await voir(page, texte).click();
  await page.waitForTimeout(400);
};
const suite = (...etapes) => async (page) => {
  for (const e of etapes) await e(page);
};
const ouvrirProjet = async (page) => {
  await voir(page, 'Lancement du site').click();
  await page.waitForTimeout(600);
};

// 600 × 1298 pour un téléphone de 390 × 844 points.
const tel = await contexte({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 600 / 390, isMobile: true, hasTouch: true });
await prise(tel, 'tel-accueil', '/', 'Mission du jour');
await prise(tel, 'tel-finances', '/finances', 'Mes budgets');
await prise(tel, 'tel-budgets', '/finances', 'Mes budgets', cliquer('Budgets'));
await prise(tel, 'tel-bilan', '/finances', 'Mes budgets', suite(cliquer('Mouvements'), cliquer('Analyses')));
await prise(tel, 'tel-projet', '/projets', 'Lancement du site', ouvrirProjet);

const pc = await contexte({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await prise(pc, 'pc-accueil', '/', 'Mission du jour');
await prise(pc, 'pc-finances', '/finances', 'Mes budgets');
await prise(pc, 'pc-planning', '/projets', 'Lancement du site', suite(ouvrirProjet, cliquer('Planning')));

// L'image de partage, composée à partir des captures qu'on vient de faire.
const og = await (await navigateur.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await og.goto(`${ADRESSE}/_racine/scripts/captures/og.html`);
await og.waitForLoadState('networkidle');
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: join(PUBLIC, 'og.jpg'), type: 'jpeg', quality: 86 });

await navigateur.close();
serveur.close();
if (echecs.length) {
  console.log('Captures en échec :', echecs.join(', '));
  process.exit(1);
}
