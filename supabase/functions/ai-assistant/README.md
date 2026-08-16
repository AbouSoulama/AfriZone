# Edge Function `ai-assistant` — Assistant « Zoni »

Cette fonction fait le pont entre le widget de chat AfriZone et un fournisseur d'IA
compatible avec l'API OpenAI (`POST /chat/completions`).

**Elle est optionnelle.** Sans elle, l'assistant fonctionne déjà : le widget répond à
partir de la base de connaissances locale (`src/lib/assistant-knowledge.ts`). La fonction
ajoute la compréhension du langage naturel pour les questions formulées librement.

## 1. Déployer

```bash
supabase functions deploy ai-assistant --no-verify-jwt
```

## 2. Configurer les secrets

| Secret        | Requis | Défaut                              | Description                                   |
| ------------- | ------ | ----------------------------------- | --------------------------------------------- |
| `AI_API_KEY`  | oui    | —                                   | Clé du fournisseur IA (Groq recommandé)       |
| `AI_BASE_URL` | non    | `https://api.groq.com/openai/v1`    | URL de base compatible OpenAI                  |
| `AI_MODEL`    | non    | `llama-3.1-8b-instant`              | Modèle utilisé                                 |

```bash
# Recommandé : Groq — gratuit, sans carte bancaire, très rapide
# 1. Créer un compte sur https://console.groq.com
# 2. API Keys → Create API Key → copier la clé (gsk_...)
supabase secrets set AI_API_KEY=gsk_...
supabase secrets set AI_BASE_URL=https://api.groq.com/openai/v1
supabase secrets set AI_MODEL=llama-3.1-8b-instant

# Alternative : Google Gemini (quota gratuit, carte parfois demandée)
# supabase secrets set AI_API_KEY=... AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai AI_MODEL=gemini-2.0-flash

# OpenAI (payant — non nécessaire)
# supabase secrets set AI_API_KEY=sk-...
```

Le modèle `llama-3.1-8b-instant` est le plus généreux sur le palier gratuit Groq
(~14 400 requêtes/jour). Pour des réponses plus riches, passez à
`llama-3.3-70b-versatile` (~1 000 requêtes/jour). Aucune carte n’est exigée.

Sans `AI_API_KEY`, la fonction renvoie `{ "unavailable": true }` et le client bascule
silencieusement sur ses réponses locales.

## 3. Tester

```bash
curl -X POST "https://VOTRE_REF.supabase.co/functions/v1/ai-assistant" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_ANON_KEY" \
  -d '{"question":"Comment suivre ma commande ?"}'
```

## Contrat d'API

Requête :

```json
{
  "question": "Comment payer avec Wave ?",
  "systemPrompt": "…généré côté client à partir de la base de connaissances…",
  "history": [{ "role": "user", "content": "…" }]
}
```

Réponse : `{ "reply": "…", "model": "…" }` · `{ "unavailable": true }` · `{ "error": "…" }`

## Sécurité

- La clé IA reste côté serveur, jamais exposée au navigateur.
- La question est limitée à 1000 caractères et l'historique aux 8 derniers messages.
- Le prompt système interdit au modèle de demander un mot de passe, un code PIN Mobile
  Money ou des données bancaires.

## Maintenir les connaissances à jour

Toute la connaissance métier vit dans `src/lib/assistant-knowledge.ts` :
`PLATFORM_OVERVIEW` (règles de la plateforme), `PLATFORM_ROUTES` (pages) et
`KNOWLEDGE_TOPICS` (questions fréquentes). Quand une fonctionnalité évolue, il suffit de
mettre ce fichier à jour : le mode local et le mode IA en héritent tous les deux, sans
redéployer la fonction.
