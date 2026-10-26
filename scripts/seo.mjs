/**
 * Référencement : finit le site exporté par `npx expo export -p web`.
 *
 * Les pages HTML sont écrites avec `%SITE%` là où il faut l'adresse du site (canonique, og:url, og:image,
 * fiche JSON-LD). Ce script remplace ce repère par l'adresse réelle, écrit le sitemap et complète robots.txt.
 *
 * L'adresse vient de `EXPO_PUBLIC_SITE_URL`, sinon de `VERCEL_PROJECT_PRODUCTION_URL` que Vercel fournit au build.
 * Sans adresse connue, les liens restent relatifs et le sitemap n'est pas écrit : le site marche, il est juste
 * moins bien partagé sur les réseaux.
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DOSSIER = process.argv[2] || 'dist';

/** Les pages que les moteurs doivent connaître, avec le fichier qui les sert (voir les rewrites de vercel.json). */
const PAGES = [
  { chemin: '/', fichier: 'index.html', priorite: '1.0', frequence: 'weekly' },
  { chemin: '/a-propos', fichier: 'a-propos.html', priorite: '0.8', frequence: 'monthly' },
  { chemin: '/confidentialite', fichier: 'confidentialite.html', priorite: '0.5', frequence: 'yearly' },
  { chemin: '/conditions', fichier: 'conditions.html', priorite: '0.5', frequence: 'yearly' },
];

/** Normalise l'adresse : protocole ajouté si besoin, pas de barre oblique finale. */
function adresseDuSite() {
  const brut = (process.env.EXPO_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (!brut) return '';
  const avecProtocole = /^https?:\/\//.test(brut) ? brut : `https://${brut}`;
  return avecProtocole.replace(/\/+$/, '');
}

/** Tous les fichiers .html du dossier exporté, sous-dossiers compris. */
async function pagesHtml(dossier) {
  const entrees = await readdir(dossier, { withFileTypes: true });
  const trouvees = [];
  for (const e of entrees) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) trouvees.push(...(await pagesHtml(chemin)));
    else if (e.name.endsWith('.html')) trouvees.push(chemin);
  }
  return trouvees;
}

const jour = (d) => d.toISOString().slice(0, 10);

async function main() {
  const site = adresseDuSite();

  const fichiers = await pagesHtml(DOSSIER);
  let remplacees = 0;
  for (const f of fichiers) {
    const avant = await readFile(f, 'utf8');
    if (!avant.includes('%SITE%')) continue;
    await writeFile(f, avant.replaceAll('%SITE%', site), 'utf8');
    remplacees += 1;
  }
  console.log(site ? `SEO : ${remplacees} page(s) rattachée(s) à ${site}` : `SEO : pas d'adresse de site, ${remplacees} page(s) laissée(s) en liens relatifs`);

  if (!site) return;

  const urls = [];
  for (const p of PAGES) {
    let modifieLe = jour(new Date());
    try {
      modifieLe = jour((await stat(join(DOSSIER, p.fichier))).mtime);
    } catch {
      continue; // La page n'a pas été exportée : on ne l'annonce pas.
    }
    urls.push(`  <url>\n    <loc>${site}${p.chemin}</loc>\n    <lastmod>${modifieLe}</lastmod>\n    <changefreq>${p.frequence}</changefreq>\n    <priority>${p.priorite}</priority>\n  </url>`);
  }
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  await writeFile(join(DOSSIER, 'sitemap.xml'), sitemap, 'utf8');

  const robots = join(DOSSIER, 'robots.txt');
  const texte = await readFile(robots, 'utf8').catch(() => 'User-agent: *\nAllow: /\n');
  if (!texte.includes('Sitemap:')) await writeFile(robots, `${texte.trimEnd()}\n\nSitemap: ${site}/sitemap.xml\n`, 'utf8');

  console.log(`SEO : sitemap de ${urls.length} page(s) et robots.txt écrits`);
}

main().catch((e) => {
  console.error('SEO :', e);
  process.exit(1);
});
