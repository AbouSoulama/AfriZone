/**
 * Moteur de réponse local de l'assistant.
 * Utilisé quand aucune clé IA n'est configurée, ou en repli si l'Edge Function échoue.
 * Fonctionne entièrement hors ligne à partir de la base de connaissances.
 */

import {
  KNOWLEDGE_TOPICS,
  QUICK_ACTIONS,
  type AssistantContext,
  type AssistantLink,
  type KnowledgeTopic,
} from './assistant-knowledge';

export interface LocalAnswer {
  text: string;
  links: AssistantLink[];
  suggestions: string[];
  matched: boolean;
}

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 'au', 'aux',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'me', 'ma', 'mon', 'mes',
  'ce', 'cet', 'cette', 'ces', 'que', 'qui', 'quoi', 'est', 'sont', 'pour', 'par',
  'sur', 'dans', 'avec', 'pas', 'plus', 'comment', 'pourquoi', 'quand', 'ou',
  'faire', 'fait', 'puis', 'peux', 'peut', 'veux', 'voudrais', 'aimerais',
  'sil', 'plait', 'merci', 'bonjour', 'salut',
]);

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input: string): string[] {
  return normalize(input)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function scoreTopic(topic: KnowledgeTopic, query: string, tokens: string[]): number {
  let score = 0;

  for (const keyword of topic.keywords) {
    const k = normalize(keyword);
    if (!k) continue;
    // Expression complète présente dans la question : signal fort
    if (query.includes(k)) score += k.includes(' ') ? 6 : 4;
  }

  const topicWords = new Set(tokenize([topic.question, topic.keywords.join(' ')].join(' ')));
  for (const token of tokens) {
    if (topicWords.has(token)) score += 2;
  }

  return score;
}

const GREETING = /^(bonjour|bonsoir|salut|coucou|hello|hi|yo|bjr|slt)\b/;
const THANKS = /\b(merci|thanks|nickel|parfait|super)\b/;

export function answerLocally(question: string, ctx: AssistantContext): LocalAnswer {
  const query = normalize(question);
  const tokens = tokenize(question);
  const suggestions = QUICK_ACTIONS[ctx.role] ?? QUICK_ACTIONS.visiteur;

  if (!query) {
    return { text: 'Posez-moi votre question, je vous guide.', links: [], suggestions, matched: false };
  }

  if (GREETING.test(query) && tokens.length <= 2) {
    const hello = ctx.userName ? `Bonjour ${ctx.userName} !` : 'Bonjour !';
    return {
      text: `${hello} Je suis Zoni, l'assistant AfriZone. Commandes, paiement, livraison, envoi de colis, espace vendeur ou livreur : dites-moi ce que vous cherchez.`,
      links: [],
      suggestions,
      matched: true,
    };
  }

  if (THANKS.test(query) && tokens.length <= 3) {
    return {
      text: "Avec plaisir ! Je reste disponible si vous avez une autre question.",
      links: [],
      suggestions,
      matched: true,
    };
  }

  const candidates = KNOWLEDGE_TOPICS.filter(
    (t) => !t.audiences || t.audiences.includes(ctx.role)
  );

  const ranked = candidates
    .map((topic) => ({ topic, score: scoreTopic(topic, query, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return {
      text: "Je n'ai pas la réponse exacte à cette question. Reformulez-la, ou contactez l'équipe AfriZone via la page Contact : un conseiller vous répondra directement.",
      links: [
        { label: 'Contacter AfriZone', to: '/contact' },
        { label: 'Voir la FAQ', to: '/faq' },
      ],
      suggestions,
      matched: false,
    };
  }

  const best = ranked[0].topic;
  const related = ranked
    .slice(1, 4)
    .filter((r) => r.score >= ranked[0].score * 0.4)
    .map((r) => r.topic.question);

  return {
    text: best.answer,
    links: best.links ?? [],
    suggestions: related.slice(0, 2),
    matched: true,
  };
}

/** Liens pertinents à afficher sous une réponse générée par le modèle distant. */
export function relatedLinks(question: string, reply: string, ctx: AssistantContext): AssistantLink[] {
  const local = answerLocally(`${question} ${reply}`, ctx);
  if (!local.matched) return [];
  const seen = new Set<string>();
  return local.links.filter((l) => (seen.has(l.to) ? false : seen.add(l.to)));
}
