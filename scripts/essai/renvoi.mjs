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

{ const p = await page({ width: 1700, height: 800 }, { dossiers: true });
  await p.goto(U + '/messages'); await attends(p, 2500);
  const l = p.getByText('Boîtes partagées et chargement des mails'); e('lien', (await l.count()) === 1, JSON.stringify(await l.boundingBox().catch(() => null)));
  await p.screenshot({ path: join(SORTIE, 'volet-1700.png') });
}
await b.close(); srv.close(); console.log('fin'); process.exit(0);
