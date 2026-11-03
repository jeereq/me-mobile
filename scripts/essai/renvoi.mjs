import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
const { chromium } = createRequire(`${process.cwd()}/`)('playwright');
const R = process.cwd(); const SORTIE = join(R, 'essai-sortie'); mkdirSync(SORTIE, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
const srv = http.createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const c = join(R, 'dist', p); const f = existsSync(c) && statSync(c).isFile() ? c : join(R, 'dist/index.html'); res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream' }); createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const U = `http://127.0.0.1:${srv.address().port}`;
const b = await chromium.launch();
const moi = { id: 'u1', email: 'awa@x.com', nom: 'Awa', role: 'UTILISATEUR', telephone: null, emailVerifie: true, motDePasse: true, abonnement: { offre: 'pro', actif: true, pro: true, fonctions: {} } };
const mails = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, sujet: `Sujet ${i}`, contact: `Contact ${i}`, date: '2026-11-03', sens: 'recu', source: 'gmail', ctx: 'pro', compte: 'awa@gmail.com', fil: `f${i}`, nonLu: i < 2, extrait: 'Bonjour' }));
const synchro = { integrations: [{ id: 'i1', fournisseur: 'google', compte: 'awa@gmail.com', ctx: 'pro', derniereSync: '2026-11-03T10:00:00Z', erreur: null }], agenda: [], taches: [{ id: 'ext:t1', titre: 'Tâche importée', echeance: '2026-11-03', source: 'gmail', ctx: 'pro' }], relances: [], mails };
async function page(vp, { delai = 0, echec = false, sansCompte = false, dossiers = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: 'dark', serviceWorkers: 'block' });
  const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route('**/fauxserveur/**', async (r) => {
    const u = new URL(r.request().url()); const p = u.pathname.replace('/fauxserveur', '').replace(/^\/api/, '');
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (p === '/auth/me') return r.fulfill({ json: { user: moi }, headers: h });
    if (p === '/sync') { if (delai) await new Promise((x) => setTimeout(x, delai)); return echec ? r.fulfill({ status: 503, json: { error: 'x' }, headers: h }) : r.fulfill({ json: sansCompte ? { ...synchro, integrations: [], mails: [], taches: [] } : { ...synchro, integrations: synchro.integrations.map((x) => ({ ...x, dossiers })) }, headers: h }); }
    if (p === '/config') return r.fulfill({ json: { config: {} }, headers: h });
    if (p === '/integrations') return r.fulfill({ json: { disponibles: [{ nom: 'google', configure: true }] }, headers: h });
    if (p === '/espace' && r.request().method() === 'GET') return r.fulfill({ json: { espace: { data: { relances: [], taches: [{ id: 't1', titre: 'Ma tâche', source: 'manuel', priorite: 'moyenne', echeance: '2026-11-03', statut: 'en_attente', mode: 'normal', creeLe: '2026-11-01T10:00:00Z' }], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: { voix: '', vitesse: 1, hauteur: 1, ton: 'neutre', sections: [], lireReponses: false }, barre: { choisi: true }, jeu: { gains: {}, badges: {}, jokers: 0, joursSauves: [], jokersGagnes: [], intro: true }, majLe: '2026-11-01T10:00:00Z' }, revision: 1 } }, headers: h });
    return r.fulfill({ json: {}, headers: h });
  });
  await ctx.addInitScript((m) => { localStorage.setItem('me.token', 't'); localStorage.setItem('me:user', JSON.stringify(m)); }, moi);
  const p = await ctx.newPage(); p.setDefaultTimeout(6000); p.on('pageerror', (e) => console.log('ERREUR PAGE', e.message));
  await p.clock.install({ time: new Date('2026-11-03T10:00:00+01:00') }).catch(() => {});
  await p.clock.resume?.().catch?.(() => {});
  return p;
}
const chemin = (p) => new URL(p.url()).pathname;
const a = (p, t) => p.getByText(t, { exact: true });
const compte = async (p, t) => a(p, t).count();
const attends = (p, ms) => p.waitForTimeout(ms);


const e = (n, ok, plus = '') => console.log(ok ? 'OK  ' : 'KO  ', n, plus);
console.log('--- Mails, serveur lent');
{ const p = await page({ width: 390, height: 844 }, { delai: 5000 });
  await p.goto(U + '/messages'); await attends(p, 2500);
  e('pas de bouton Agendas & outils', (await p.getByRole('button', { name: 'Agendas & outils' }).count()) === 0);
  e('pas de « Connecte Gmail »', (await p.getByText(/Connecte Gmail/).count()) === 0);
  e('place des mails', (await p.getByLabel('Lecture de tes mails').count()) === 1);
  await p.screenshot({ path: join(SORTIE, 'mails-attente.png') });
  await a(p, 'Sujet 0').first().waitFor({ timeout: 8000 }); e('mails arrivés', true);
  await a(p, 'Sujet 0').first().click(); await attends(p, 500); e('clic sur un mail reste sur Mails', chemin(p) === '/messages', chemin(p));
  await p.screenshot({ path: join(SORTIE, 'mail-ouvert.png') });
}
console.log('--- Serveur en panne');
{ const p = await page({ width: 390, height: 844 }, { echec: true });
  await p.goto(U + '/messages'); await attends(p, 2500);
  e('message honnête', (await p.getByText(/n’ont pas pu être lus/).count()) === 1); e('Réessayer', (await a(p, 'Réessayer').count()) === 1); e('pas de Connecte Gmail', (await p.getByText(/Connecte Gmail/).count()) === 0);
  await p.screenshot({ path: join(SORTIE, 'mails-panne.png') });
}
console.log('--- Vraiment aucun compte');
{ const p = await page({ width: 390, height: 844 }, { sansCompte: true });
  await p.goto(U + '/messages'); await attends(p, 2000);
  e('invite à connecter', (await p.getByText(/Connecte Gmail/).count()) === 1);
  await a(p, 'Agendas & outils').last().click(); await attends(p, 700); e('le bouton mène à Agendas & outils', chemin(p) === '/sources', chemin(p));
}
console.log('--- Dossiers');
{ const p = await page({ width: 1280, height: 800 }, { dossiers: true });
  await p.goto(U + '/messages'); await attends(p, 2500);
  const l = p.getByText('Boîtes partagées et chargement des mails'); e('lien en bas du volet', (await l.count()) === 1, JSON.stringify(await l.boundingBox().catch(() => null)));
  await p.screenshot({ path: join(SORTIE, 'volet-pc.png') });
  const t = await page({ width: 390, height: 844 }, { dossiers: true });
  await t.goto(U + '/messages'); await attends(t, 2500);
  await t.screenshot({ path: join(SORTIE, 'mails-tel.png') });
  const ou = t.getByRole('button', { name: /Où regarder|Toutes les boîtes/ }).first(); console.log('bouton volet', await ou.count());
  if (await ou.count()) { await ou.click(); await attends(t, 500); const l2 = t.getByText('Boîtes partagées et chargement des mails'); e('feuille : lien visible', await l2.isVisible().catch(() => false)); e('feuille : Favoris', await a(t, 'Toutes les boîtes').last().isVisible().catch(() => false)); await t.screenshot({ path: join(SORTIE, 'volet-tel.png') }); }
}
console.log('--- Accueil');
{ const p = await page({ width: 390, height: 844 }, { delai: 4000, sansCompte: true });
  await p.goto(U + '/'); await attends(p, 2000); e('pas de Premiers pas pendant la lecture', (await p.getByText('Premiers pas').count()) === 0);
  await attends(p, 3500); const c = p.getByText('Premiers pas'); e('Premiers pas après', (await c.count()) === 1);
  const yc = (await c.boundingBox())?.y; const yt = (await a(p, 'Ma tâche').first().boundingBox().catch(() => null))?.y; e('au-dessus des tâches', yc < yt, yc + ' < ' + yt);
  await p.screenshot({ path: join(SORTIE, 'accueil.png'), fullPage: true });
}
await b.close(); srv.close(); console.log('fin'); process.exit(0);
