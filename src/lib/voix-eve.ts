/** Quelle voix installée sera Eve : une voix française féminine, la meilleure de l'appareil. Module pur, testé dans tests/voix-eve.test.ts. */

export type VoixEve = { identifier: string; name: string; language: string; quality?: string };

// Les voix françaises féminines courantes : iPhone et Mac, Windows, Chrome, Android (identifiants « fr-fr-x-… »).
const FEMININES = /\b(audrey|aur[eé]lie|am[eé]lie|marie|virginie|chantal|julie|hortense|denise|eloise|[eé]lo[iï]se|brigitte|coralie|vivienne|google fran[cç]ais)\b|fr-fr-x-(fra|frc|vlf)/i;
const MASCULINES = /\b(thomas|daniel|nicolas|henri|paul|claude|remy|r[eé]my|antoine|jacques|jean|alain|fabrice|yves)\b|fr-fr-x-(frb|frd)/i;

const score = (v: VoixEve) => {
  const nom = `${v.name} ${v.identifier}`;
  return (FEMININES.test(nom) ? 10 : 0) - (MASCULINES.test(nom) ? 10 : 0) + (/^fr[-_]fr/i.test(v.language) ? 3 : 0) + (v.quality === 'Enhanced' ? 2 : 0);
};

export function choisirVoixEve(voix: VoixEve[]): string | undefined {
  const fr = voix.filter((v) => v.language.toLowerCase().startsWith('fr'));
  return [...fr].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0]?.identifier;
}
