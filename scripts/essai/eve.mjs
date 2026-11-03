import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
const { chromium } = createRequire(`${process.cwd()}/`)('playwright');
const R = process.cwd(); const SORTIE = join(R, 'essai-sortie'); mkdirSync(SORTIE, { recursive: true });
const MP3 = readFileSync(join(R, 'assets/sons/eve.mp3'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const srv = http.createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const c = join(R, 'dist', p); const f = existsSync(c) && statSync(c).isFile() ? c : join(R, 'dist/index.html'); res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream' }); createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const U = `http://127.0.0.1:${srv.address().port}`;
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const e = (n, ok, plus = '') => console.log(ok ? 'OK  ' : 'KO  ', n, plus);
const moi = { id: 'u1', email: 'awa@x.com', nom: 'Awa', role: 'UTILISATEUR', telephone: null, emailVerifie: true, motDePasse: true };
const cr = { id: 'c1', titre: 'Point du lundi', date: '2026-11-03', genre: 'reunion', notes: 'On avance.\n→ Envoyer le devis', actions: [], decisions: [], creeLe: '2026-11-03T10:00:00Z' };
async function page(vp, { connecte = false, eve = true, refus = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: 'dark', serviceWorkers: 'block' });
  const envois = []; const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route('**/fauxserveur/**', async (r) => {
    const q = r.request(); const p = new URL(q.url()).pathname.replace('/fauxserveur', '').replace(/^\/api/, '');
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (p === '/auth/options') return r.fulfill({ json: { google: false, email: true, oubli: true, sms: true, indicatifs: ['243'], eve }, headers: h });
    if (p.startsWith('/voix/audio/')) return r.fulfill({ status: 200, body: MP3, contentType: 'audio/mpeg', headers: { ...h, 'cross-origin-resource-policy': 'cross-origin' } });
    if (p === '/voix/essai' || p === '/voix/eve') { envois.push({ p, ...q.postDataJSON() }); return refus ? r.fulfill({ status: 429, json: { error: 'Eve a assez parlé pour aujourd’hui.' }, headers: h }) : r.fulfill({ json: { jeton: 'j' + envois.length }, headers: h }); }
    if (p === '/auth/me' && connecte) return r.fulfill({ json: { user: moi }, headers: h });
    if (p === '/sync') return r.fulfill({ json: { integrations: [], agenda: [], taches: [], relances: [], mails: [] }, headers: h });
    if (p === '/config') return r.fulfill({ json: { config: {} }, headers: h });
    if (p === '/espace' && q.method() === 'GET') return r.fulfill({ json: { espace: { data: { relances: [], taches: [{ id: 't1', titre: 'Ma tâche', source: 'manuel', priorite: 'moyenne', echeance: '2026-11-03', statut: 'en_attente', mode: 'normal', creeLe: '2026-11-01T10:00:00Z' }], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], comptesRendus: [cr], audio: { voix: '', vitesse: 1, hauteur: 1, ton: 'neutre', sections: [], lireReponses: false }, barre: { choisi: true }, majLe: '2026-11-01T10:00:00Z' }, revision: 1 } }, headers: h });
    return r.fulfill({ json: {}, headers: h });
  });
  await ctx.addInitScript((m) => {
    if (m) { localStorage.setItem('me.token', 't'); localStorage.setItem('me:user', JSON.stringify(m)); }
    window.__dit = [];
    const S = window.speechSynthesis; const parler = S.speak.bind(S);
    S.speak = (u) => { window.__dit.push(u.text); setTimeout(() => u.onend && u.onend({}), 30); };
  }, connecte ? moi : null);
  const p = await ctx.newPage(); p.setDefaultTimeout(7000); p.on('pageerror', (x) => console.log('ERREUR PAGE', x.message.slice(0, 200)));
  return { p, envois };
}
const a = (p, t) => p.getByText(t, { exact: true });
console.log('--- Accueil, Eve branchée');
{ const { p, envois } = await page({ width: 1280, height: 800 });
  await p.goto(U + '/'); await a(p, 'Écoute Eve').first().waitFor({ timeout: 30000 }); await a(p, 'Écoute Eve').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  e('titre et bouton', (await a(p, 'Écouter Eve').count()) === 1); e('champ de phrase', (await p.getByLabel('Ta phrase pour Eve').count()) === 1);
  await p.screenshot({ path: join(SORTIE, 'landing-pc.png') });
  await a(p, 'Écouter Eve').click(); await p.waitForTimeout(800); e('extrait : Arrêter', (await a(p, 'Arrêter').count()) === 1);
  await a(p, 'Arrêter').click(); await p.waitForTimeout(300); e('extrait : arrêté', (await a(p, 'Écouter Eve').count()) === 1);
  await p.getByLabel('Ta phrase pour Eve').fill('Bonjour Kinshasa'); await a(p, 'Faire lire').click(); await p.waitForTimeout(1200);
  e('phrase envoyée', envois[0]?.p === '/voix/essai' && envois[0]?.texte === 'Bonjour Kinshasa', JSON.stringify(envois[0])); e('Eve lit', (await a(p, 'Eve lit…').count()) === 1);
}
console.log('--- Accueil, téléphone, Eve non branchée');
{ const { p } = await page({ width: 390, height: 844 }, { eve: false });
  await p.goto(U + '/'); await a(p, 'Écoute Eve').first().waitFor({ timeout: 30000 }); await a(p, 'Écoute Eve').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  e('extrait seul', (await p.getByLabel('Ta phrase pour Eve').count()) === 0 && (await a(p, 'Écouter Eve').count()) === 1);
  await p.screenshot({ path: join(SORTIE, 'landing-tel.png') });
}
console.log('--- Compte rendu, connecté');
{ const { p, envois } = await page({ width: 1280, height: 800 }, { connecte: true });
  await p.goto(U + '/comptes-rendus?id=c1'); await a(p, 'Écouter').first().waitFor({ timeout: 20000 }); await a(p, 'Écouter').first().click(); await p.waitForTimeout(1500);
  e('passe par Eve', envois.length === 1 && envois[0].p === '/voix/eve', JSON.stringify(envois[0] ?? {}).slice(0, 120)); e('pas la voix du téléphone', (await p.evaluate(() => window.__dit.length)) === 0); e('Arrêter affiché', (await a(p, 'Arrêter').count()) === 1);
  await a(p, 'Arrêter').click(); await p.waitForTimeout(300); e('arrêté', (await a(p, 'Écouter').count()) >= 1);
  await p.screenshot({ path: join(SORTIE, 'cr.png') });
}
console.log('--- Plafond atteint : le téléphone reprend');
{ const { p, envois } = await page({ width: 1280, height: 800 }, { connecte: true, refus: true });
  await p.goto(U + '/comptes-rendus?id=c1'); await a(p, 'Écouter').first().waitFor({ timeout: 20000 }); await a(p, 'Écouter').first().click(); await p.waitForTimeout(1500);
  const dit = await p.evaluate(() => window.__dit); e('repli', envois.length === 1 && dit.length > 0, JSON.stringify(dit).slice(0, 110));
  await p.waitForTimeout(500); e('fin : Écouter revient', (await a(p, 'Écouter').count()) >= 1);
}
console.log('--- Choix de la voix');
{ const { p } = await page({ width: 390, height: 844 }, { connecte: true });
  await p.goto(U + '/compte?section=assistant'); await p.waitForTimeout(2000); e('Eve proposée', (await a(p, 'Eve').count()) === 1); e('Voix du téléphone', (await a(p, 'Voix du téléphone').count()) === 1);
  await p.screenshot({ path: join(SORTIE, 'choix.png'), fullPage: true });
}
await b.close(); srv.close(); console.log('fin'); process.exit(0);
