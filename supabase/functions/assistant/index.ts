// Fonction Edge « assistant » : relaie les demandes de l'app vers Claude.
// La clé API reste ici, côté serveur. Seuls les comptes connectés peuvent l'appeler (JWT vérifié par Supabase).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_DONNEES = 60_000;

type Body = {
  type: 'question' | 'plan' | 'relance';
  ton?: string;
  donnees?: string;
  question?: string;
  heure?: string;
  contact?: string;
  sujet?: string;
  boite?: 'perso' | 'pro';
};

function prompt(b: Body): string {
  const donnees = String(b.donnees ?? '').slice(0, MAX_DONNEES);
  const ton = b.ton ?? 'neutre';
  if (b.type === 'plan') {
    return `Tu es « me », le copilote personnel de l'utilisateur. Il est ${b.heure ?? ''}. À partir de ses données (JSON ci-dessous), propose un plan de journée réaliste en français, ton ${ton} : d'abord les 3 priorités, puis un déroulé par créneaux qui tient compte de l'agenda, des relances dues, des tâches urgentes et des habitudes (factures en premier si elles sont dues ou en retard). 12 lignes au maximum, phrases courtes, sans markdown ni émojis.\n\nDonnées :\n${donnees}`;
  }
  if (b.type === 'relance') {
    const style = b.boite === 'pro' ? 'professionnel, vouvoiement' : 'personnel, ton amical';
    return `Rédige en français un court mail de relance (${style}) à ${b.contact} au sujet de : ${b.sujet}. 4 à 6 phrases, poli, avec une demande claire et une proposition de prochaine étape. Commence par une ligne « Objet : … ». Sans markdown ; termine par « [Ton prénom] ».`;
  }
  return `Tu es « me », l'assistant personnel de l'utilisateur. Réponds en français, ton ${ton}, en 2 à 5 phrases courtes faites pour être lues à voix haute : pas de listes, pas de markdown, pas d'émojis. Appuie-toi uniquement sur ses données ci-dessous (JSON) ; si l'information n'y est pas, dis-le simplement.\n\nDonnées :\n${donnees}\n\nQuestion : ${b.question ?? ''}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = (await req.json()) as Body;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5-5',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt(body) }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? `Claude a répondu ${res.status}`);
    const text = (data.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('').trim();
    return new Response(JSON.stringify({ text }), { headers: { ...CORS, 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, 'content-type': 'application/json' } });
  }
});
