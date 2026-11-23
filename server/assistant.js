const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY = 8;

export function mountAssistantRoutes(app) {
  app.post('/assistant', async (req, res) => {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        unavailable: true,
        error: 'AI_API_KEY non configurée sur le VPS.',
      });
    }

    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'Question manquante.' });
    if (question.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({ error: 'Question trop longue.' });
    }

    const systemPrompt =
      String(req.body?.systemPrompt || '').trim() ||
      "Tu es Zoni, l'assistant de la marketplace AfriZone (Burkina Faso, Mali, Sénégal, Guinée). Réponds en français, brièvement.";

    const history = (Array.isArray(req.body?.history) ? req.body.history : [])
      .filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string'
      )
      .slice(-MAX_HISTORY)
      .map((m) => ({
        role: m.role,
        content: String(m.content).slice(0, MAX_QUESTION_LENGTH),
      }));

    const baseUrl = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
    const model = process.env.AI_MODEL || DEFAULT_MODEL;

    try {
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
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
      const body = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const message = body?.error?.message || `Erreur fournisseur IA (${upstream.status}).`;
        return res.status(502).json({ error: message });
      }
      const reply = body?.choices?.[0]?.message?.content;
      if (!reply || typeof reply !== 'string') {
        return res.status(502).json({ error: 'Réponse IA vide.' });
      }
      return res.json({ reply, model });
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : 'Erreur assistant',
      });
    }
  });
}
