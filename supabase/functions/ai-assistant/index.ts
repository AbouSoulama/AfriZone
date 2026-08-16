// AfriZone — Assistant IA « Zoni »
// Deploy: supabase functions deploy ai-assistant --no-verify-jwt
// Secrets: AI_API_KEY (requis pour le mode IA), AI_BASE_URL, AI_MODEL (optionnels)
//
// Sans AI_API_KEY, la fonction répond { unavailable: true } et le client bascule
// automatiquement sur sa base de connaissances locale.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY = 8;

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) {
    return json({ unavailable: true, error: 'AI_API_KEY non configurée.' }, 200);
  }

  let payload: {
    question?: string;
    systemPrompt?: string;
    history?: HistoryItem[];
  };

  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  const question = (payload.question || '').trim();
  if (!question) return json({ error: 'Question manquante.' }, 400);
  if (question.length > MAX_QUESTION_LENGTH) {
    return json({ error: 'Question trop longue.' }, 400);
  }

  const systemPrompt =
    (payload.systemPrompt || '').trim() ||
    "Tu es Zoni, l'assistant de la marketplace AfriZone (Burkina Faso, Mali, Sénégal). Réponds en français, brièvement.";

  const history = (Array.isArray(payload.history) ? payload.history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_QUESTION_LENGTH) }));

  const baseUrl = (Deno.env.get('AI_BASE_URL') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = Deno.env.get('AI_MODEL') || DEFAULT_MODEL;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: question },
        ],
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = body?.error?.message || `Erreur fournisseur IA (${res.status}).`;
      console.error('[ai-assistant]', message);
      return json({ error: message }, 502);
    }

    const reply = body?.choices?.[0]?.message?.content;
    if (!reply || typeof reply !== 'string') {
      return json({ error: 'Réponse IA vide.' }, 502);
    }

    return json({ reply, model });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue.';
    console.error('[ai-assistant]', message);
    return json({ error: message }, 500);
  }
});
