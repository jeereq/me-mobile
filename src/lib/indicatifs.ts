/** Les indicatifs téléphoniques et ce qu'on en fait à la saisie. Module pur, testé dans tests/indicatifs.test.ts. */

export type Pays = { iso: string; nom: string; code: string };

const LISTE = `AF Afghanistan 93|ZA Afrique du Sud 27|AL Albanie 355|DZ Algérie 213|DE Allemagne 49|AD Andorre 376|AO Angola 244|AI Anguilla 1264|AG Antigua-et-Barbuda 1268|SA Arabie saoudite 966|AR Argentine 54|AM Arménie 374|AW Aruba 297|AU Australie 61|AT Autriche 43|AZ Azerbaïdjan 994|BS Bahamas 1242|BH Bahreïn 973|BD Bangladesh 880|BB Barbade 1246|BE Belgique 32|BZ Belize 501|BJ Bénin 229|BM Bermudes 1441|BT Bhoutan 975|BY Biélorussie 375|MM Birmanie 95|BO Bolivie 591|BA Bosnie-Herzégovine 387|BW Botswana 267|BR Brésil 55|BN Brunei 673|BG Bulgarie 359|BF Burkina Faso 226|BI Burundi 257|KH Cambodge 855|CM Cameroun 237|CA Canada 1|CV Cap-Vert 238|CF Centrafrique 236|CL Chili 56|CN Chine 86|CY Chypre 357|CO Colombie 57|KM Comores 269|CG Congo-Brazzaville 242|KP Corée du Nord 850|KR Corée du Sud 82|CR Costa Rica 506|CI Côte d’Ivoire 225|HR Croatie 385|CU Cuba 53|CW Curaçao 599|DK Danemark 45|DJ Djibouti 253|DM Dominique 1767|EG Égypte 20|AE Émirats arabes unis 971|EC Équateur 593|ER Érythrée 291|ES Espagne 34|EE Estonie 372|SZ Eswatini 268|US États-Unis 1|ET Éthiopie 251|FJ Fidji 679|FI Finlande 358|FR France 33|GA Gabon 241|GM Gambie 220|GE Géorgie 995|GH Ghana 233|GI Gibraltar 350|GR Grèce 30|GD Grenade 1473|GL Groenland 299|GP Guadeloupe 590|GU Guam 1671|GT Guatemala 502|GN Guinée 224|GQ Guinée équatoriale 240|GW Guinée-Bissau 245|GY Guyana 592|GF Guyane française 594|HT Haïti 509|HN Honduras 504|HK Hong Kong 852|HU Hongrie 36|KY Îles Caïmans 1345|CK Îles Cook 682|FO Îles Féroé 298|MH Îles Marshall 692|SB Îles Salomon 677|TC Îles Turques-et-Caïques 1649|VG Îles Vierges britanniques 1284|VI Îles Vierges américaines 1340|IN Inde 91|ID Indonésie 62|IQ Irak 964|IR Iran 98|IE Irlande 353|IS Islande 354|IL Israël 972|IT Italie 39|JM Jamaïque 1876|JP Japon 81|JO Jordanie 962|KZ Kazakhstan 7|KE Kenya 254|KG Kirghizistan 996|KI Kiribati 686|XK Kosovo 383|KW Koweït 965|LA Laos 856|LS Lesotho 266|LV Lettonie 371|LB Liban 961|LR Liberia 231|LY Libye 218|LI Liechtenstein 423|LT Lituanie 370|LU Luxembourg 352|MO Macao 853|MK Macédoine du Nord 389|MG Madagascar 261|MY Malaisie 60|MW Malawi 265|MV Maldives 960|ML Mali 223|MT Malte 356|MA Maroc 212|MQ Martinique 596|MU Maurice 230|MR Mauritanie 222|YT Mayotte 262|MX Mexique 52|FM Micronésie 691|MD Moldavie 373|MC Monaco 377|MN Mongolie 976|ME Monténégro 382|MS Montserrat 1664|MZ Mozambique 258|NA Namibie 264|NR Nauru 674|NP Népal 977|NI Nicaragua 505|NE Niger 227|NG Nigeria 234|NO Norvège 47|NC Nouvelle-Calédonie 687|NZ Nouvelle-Zélande 64|OM Oman 968|UG Ouganda 256|UZ Ouzbékistan 998|PK Pakistan 92|PW Palaos 680|PS Palestine 970|PA Panama 507|PG Papouasie-Nouvelle-Guinée 675|PY Paraguay 595|NL Pays-Bas 31|PE Pérou 51|PH Philippines 63|PL Pologne 48|PF Polynésie française 689|PR Porto Rico 1787|PT Portugal 351|QA Qatar 974|RE La Réunion 262|DO République dominicaine 1809|CZ Tchéquie 420|RO Roumanie 40|GB Royaume-Uni 44|RU Russie 7|RW Rwanda 250|KN Saint-Christophe-et-Niévès 1869|LC Sainte-Lucie 1758|SM Saint-Marin 378|PM Saint-Pierre-et-Miquelon 508|VC Saint-Vincent-et-les-Grenadines 1784|SV Salvador 503|WS Samoa 685|ST Sao Tomé-et-Principe 239|SN Sénégal 221|RS Serbie 381|SC Seychelles 248|SL Sierra Leone 232|SG Singapour 65|SK Slovaquie 421|SI Slovénie 386|SO Somalie 252|SD Soudan 249|SS Soudan du Sud 211|LK Sri Lanka 94|SE Suède 46|CH Suisse 41|SR Suriname 597|SY Syrie 963|TJ Tadjikistan 992|TW Taïwan 886|TZ Tanzanie 255|TD Tchad 235|TH Thaïlande 66|TL Timor oriental 670|TG Togo 228|TO Tonga 676|TT Trinité-et-Tobago 1868|TN Tunisie 216|TM Turkménistan 993|TR Turquie 90|TV Tuvalu 688|UA Ukraine 380|UY Uruguay 598|VU Vanuatu 678|VA Vatican 379|VE Venezuela 58|VN Viêt Nam 84|WF Wallis-et-Futuna 681|YE Yémen 967|ZM Zambie 260|ZW Zimbabwe 263`;

const sansAccent = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const PAYS_DEFAUT: Pays = { iso: 'CD', nom: 'RD Congo', code: '243' };

/** La RD Congo d'abord, puis l'ordre alphabétique. */
export const PAYS: Pays[] = [
  PAYS_DEFAUT,
  ...LISTE.split('|')
    .map((l) => {
      const m = l.match(/^(\S+) (.+) (\d+)$/)!;
      return { iso: m[1], nom: m[2], code: m[3] };
    })
    .sort((a, b) => sansAccent(a.nom).localeCompare(sansAccent(b.nom), 'fr')),
];

export const drapeau = (iso: string) => String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

export function chercherPays(q: string): Pays[] {
  const t = sansAccent(q.trim()).replace(/^\+/, '');
  if (!t) return PAYS;
  return PAYS.filter((p) => sansAccent(p.nom).includes(t) || p.code.startsWith(t) || p.iso.toLowerCase() === t);
}

/** « +33 6 12… » ou « 0033 6 12… » : le pays et le reste du numéro ; null si le texte ne commence pas par un indicatif. */
export function separer(brut: string): { pays: Pays; national: string } | null {
  const t = brut.trim();
  const m = t.match(/^(?:\+|00)(.*)$/);
  if (!m) return null;
  const chiffres = m[1].replace(/\D/g, '');
  // Le plus long indicatif d'abord : +1268 est Antigua, +1 le Canada ou les États-Unis.
  for (let n = 4; n >= 1; n--) {
    const pays = PAYS.find((p) => p.code === chiffres.slice(0, n));
    if (pays) return { pays, national: chiffres.slice(n) };
  }
  return null;
}

/** Le numéro sans indicatif : ni le 0 du début (sauf en Italie, où il en fait partie), ni l'indicatif retapé par habitude. */
export function chiffresNationaux(pays: Pays, national: string): string {
  let n = national.replace(/\D/g, '');
  if (n.startsWith(pays.code) && n.length - pays.code.length >= 9) n = n.slice(pays.code.length);
  return pays.code === '39' ? n : n.replace(/^0+/, '');
}

/** Le numéro complet à envoyer au serveur (« +243812345678 ») ; vide si rien n'est saisi. */
export function composer(pays: Pays, national: string): string {
  const n = chiffresNationaux(pays, national);
  return n ? `+${pays.code}${n}` : '';
}

export function numeroPlausible(pays: Pays, national: string): boolean {
  const n = chiffresNationaux(pays, national);
  if (pays.code === PAYS_DEFAUT.code) return n.length === 9;
  const total = pays.code.length + n.length;
  return n.length >= 6 && total >= 8 && total <= 15;
}

/** Le début d'un numéro sans indicatif, tapé dans un champ qui accepte aussi un email. */
export const commeNumero = (x: string) => /^[\d\s().-]+$/.test(x.trim());
