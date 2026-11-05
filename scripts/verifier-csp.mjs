// Ouvre le vrai site exporté (dist) avec les en-têtes de vercel.json : échoue si le navigateur bloque quelque chose ou si l'app ne s'affiche pas.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

// eslint-disable-next-line import/no-unresolved -- installé seulement par la CI.
import { chromium } from 'playwright';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const vercel = JSON.parse(await readFile('vercel.json', 'utf8'));
const entetes = vercel.headers.find((h) => h.source === '/(.*)').headers;
const entete = (cle) => entetes.find((e) => e.key === cle).value;

const serveur = createServer(async (q, r) => {
  const chemin = new URL(q.url, 'http://local').pathname;
  // upgrade-insecure-requests n'a pas de sens sur http://127.0.0.1 : le reste de la politique est testé tel quel.
  for (const e of entetes) r.setHeader(e.key, e.value.replace('; upgrade-insecure-requests', ''));
  try {
    const f = await readFile(join('dist', chemin));
    r.setHeader('Content-Type', TYPES[extname(chemin)] ?? 'application/octet-stream');
    r.end(f);
  } catch {
    r.setHeader('Content-Type', 'text/html');
    r.end(await readFile(join('dist', 'index.html')));
  }
}).listen(0, '127.0.0.1');
await new Promise((ok) => serveur.once('listening', ok));
const base = `http://127.0.0.1:${serveur.address().port}`;

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
const blocages = [];
page.on('console', (m) => {
  if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) blocages.push(m.text());
});
page.on('pageerror', (e) => {
  if (/Content Security Policy|EvalError/i.test(e.message)) blocages.push(e.message);
});
let echec = false;
for (const chemin of ['/', '/contact', '/confidentialite.html']) {
  await page.goto(base + chemin, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const texte = (await page.evaluate(() => document.body.innerText)).trim();
  const vide = chemin !== '/confidentialite.html' && !(await page.evaluate(() => document.getElementById('root')?.childElementCount));
  console.log(chemin, vide ? 'VIDE' : `ok (${texte.length} caractères)`);
  if (vide) echec = true;
}
await navigateur.close();
serveur.close();
if (entete('Content-Security-Policy') === '') echec = true;
if (blocages.length) console.error('Bloqué par la politique :', [...new Set(blocages)].join('\n'));
process.exit(echec || blocages.length ? 1 : 0);
