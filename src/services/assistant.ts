import {
  buildSystemPrompt,
  QUICK_ACTIONS,
  type AssistantContext,
  type AssistantLink,
} from '../lib/assistant-knowledge';
import { answerLocally, relatedLinks } from '../lib/assistant-local';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  links?: AssistantLink[];
  suggestions?: string[];
  createdAt: number;
}

export interface AssistantReply {
  text: string;
  links: AssistantLink[];
  suggestions: string[];
  source: 'ia' | 'local';
}

/** Nombre d'échanges renvoyés au modèle pour garder le contexte de la discussion. */
const HISTORY_LIMIT = 8;

/**
 * Faux tant que l'Edge Function n'a pas été jointe avec succès une première fois.
 * Évite de retenter un appel réseau coûteux quand la fonction n'est pas déployée.
 */
let remoteAvailable: boolean | null = null;

function assistantMode(): 'auto' | 'local' {
  const mode = (import.meta.env.VITE_ASSISTANT_MODE as string | undefined)?.toLowerCase();
  return mode === 'local' ? 'local' : 'auto';
}

export function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function askRemote(
  question: string,
  history: AssistantMessage[],
  ctx: AssistantContext
): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon) throw new Error('Configuration Supabase manquante.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${base}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemPrompt: buildSystemPrompt(ctx),
        question,
        history: history.slice(-HISTORY_LIMIT).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      reply?: string;
      error?: string;
      unavailable?: boolean;
    };

    // La fonction est déployée mais aucune clé IA n'est configurée : repli local définitif.
    if (body.unavailable) throw new Error('AI_UNAVAILABLE');
    if (!res.ok || !body.reply) throw new Error(body.error || `Erreur assistant (${res.status}).`);

    return body.reply.trim();
  } finally {
    clearTimeout(timeout);
  }
}

export async function askAssistant(
  question: string,
  history: AssistantMessage[],
  ctx: AssistantContext
): Promise<AssistantReply> {
  const fallback = (): AssistantReply => {
    const local = answerLocally(question, ctx);
    return {
      text: local.text,
      links: local.links,
      suggestions: local.suggestions,
      source: 'local',
    };
  };

  if (assistantMode() === 'local' || remoteAvailable === false) return fallback();

  try {
    const reply = await askRemote(question, history, ctx);
    remoteAvailable = true;
    return {
      text: reply,
      links: relatedLinks(question, reply, ctx),
      suggestions: [],
      source: 'ia',
    };
  } catch {
    // Fonction absente, clé manquante ou réseau indisponible : on bascule sur la base locale.
    remoteAvailable = false;
    return fallback();
  }
}

export function welcomeMessage(ctx: AssistantContext): AssistantMessage {
  const hello = ctx.userName ? `Bonjour ${ctx.userName} !` : 'Bonjour !';
  return {
    id: newMessageId(),
    role: 'assistant',
    content: `${hello} Je suis Zoni, l'assistant AfriZone. Je connais toute la plateforme : commandes, paiement Mobile Money et Wave, suivi de livraison, envoi de colis, espace vendeur et espace livreur. Que puis-je faire pour vous ?`,
    suggestions: QUICK_ACTIONS[ctx.role] ?? QUICK_ACTIONS.visiteur,
    createdAt: Date.now(),
  };
}
