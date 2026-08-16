import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { useCart } from '../context/CartContext';
import {
  askAssistant,
  newMessageId,
  welcomeMessage,
  type AssistantMessage,
} from '../services/assistant';
import type { AssistantAudience, AssistantContext } from '../lib/assistant-knowledge';
import { cn } from '../utils/cn';

const STORAGE_KEY = 'afrizone_assistant_history';
const TEASER_KEY = 'afrizone_zoni_teaser_dismissed';
const MAX_STORED = 30;

/** Rendu minimal du gras `**texte**` produit par la base de connaissances ou le modèle. */
function RichText({ value }: { value: string }) {
  return (
    <>
      {value.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={index} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </>
  );
}

function loadHistory(): AssistantMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AssistantMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: AssistantMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    /* quota dépassé ou stockage indisponible : l'historique reste en mémoire */
  }
}

function teaserWasDismissed(): boolean {
  try {
    return sessionStorage.getItem(TEASER_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissTeaser() {
  try {
    sessionStorage.setItem(TEASER_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function AssistantWidget() {
  const { user } = useAuth();
  const { country } = useCountry();
  const { itemCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const context = useMemo<AssistantContext>(
    () => ({
      role: (user?.role as AssistantAudience) || 'visiteur',
      path: location.pathname,
      userName: user?.fullName?.split(' ')[0] ?? null,
      country,
      cartCount: itemCount,
    }),
    [user, location.pathname, country, itemCount]
  );

  const hasUserMessages = messages.some((m) => m.role === 'user');

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([welcomeMessage(context)]);
    }
    // Le message d'accueil ne doit être créé qu'à la première ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (messages.length) saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open || teaserWasDismissed()) return;
    const timer = window.setTimeout(() => setShowTeaser(true), 3500);
    return () => window.clearTimeout(timer);
  }, [open]);

  const closeTeaser = () => {
    setShowTeaser(false);
    dismissTeaser();
  };

  const toggleOpen = () => {
    setOpen((v) => !v);
    setShowTeaser(false);
    dismissTeaser();
  };

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || isThinking) return;

    const userMessage: AssistantMessage = {
      id: newMessageId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };

    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setIsThinking(true);

    try {
      const reply = await askAssistant(text, messages, context);
      setMessages([
        ...history,
        {
          id: newMessageId(),
          role: 'assistant',
          content: reply.text,
          links: reply.links,
          suggestions: reply.suggestions,
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([welcomeMessage(context)]);
  };

  const goTo = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const welcomeSuggestions =
    !hasUserMessages && !isThinking ? (lastAssistant?.suggestions ?? []).slice(0, 4) : [];

  return (
    <>
      {!open && showTeaser && (
        <div className="fixed bottom-[5.75rem] right-6 z-[60] w-[min(18.5rem,calc(100vw-3.5rem))] animate-fade-in">
          <div className="relative rounded-2xl rounded-br-sm border border-orange-100 bg-white px-4 py-3 shadow-2xl">
            <button
              onClick={closeTeaser}
              aria-label="Fermer le message"
              className="absolute right-1.5 top-1.5 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={14} />
            </button>
            <p className="pr-5 text-sm font-semibold text-gray-900">Besoin d’un coup de main ?</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              Je suis Zoni. Commande, paiement, livraison, colis : posez-moi votre question.
            </p>
            <button
              onClick={toggleOpen}
              className="mt-2.5 text-xs font-bold text-[#FF6B00] hover:underline"
            >
              Discuter maintenant →
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-[60]">
        <button
          onClick={toggleOpen}
          aria-label={open ? "Fermer l'assistant AfriZone" : "Ouvrir l'assistant AfriZone"}
          className={cn(
            'relative flex items-center justify-center gap-2.5 overflow-visible',
            'bg-[#FF6B00] text-white shadow-2xl transition-all hover:bg-[#E05E00]',
            open
              ? 'h-14 w-14 rounded-full'
              : 'h-14 rounded-full pl-3.5 pr-5 animate-zoni-bob hover:-translate-y-0.5'
          )}
        >
          {!open && (
            <span className="pointer-events-none absolute inset-0 rounded-full">
              <span className="absolute inset-0 rounded-full bg-[#FF6B00] animate-zoni-ring" />
            </span>
          )}
          {open ? (
            <X size={24} className="relative" />
          ) : (
            <>
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <MessageCircle size={20} />
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#FF6B00] bg-[#00A651]" />
              </span>
              <span className="relative text-left leading-tight">
                <span className="block text-sm font-bold">Besoin d’aide ?</span>
                <span className="block text-[11px] font-medium text-white/85">Zoni vous répond</span>
              </span>
            </>
          )}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Assistant AfriZone"
          className={cn(
            'fixed bottom-24 right-4 z-[60] flex flex-col overflow-hidden bg-white shadow-2xl',
            'h-[min(32rem,calc(100vh-8rem))] w-[min(24.5rem,calc(100vw-2rem))]',
            'rounded-2xl border border-gray-200 sm:right-6'
          )}
        >
          <header className="flex items-center gap-3 bg-gradient-to-r from-[#FF6B00] to-[#E05E00] px-4 py-3 text-white">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <Bot size={20} />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#E05E00] bg-[#00A651]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">Zoni · Assistant AfriZone</p>
              <p className="text-xs text-white/80">En ligne · réponses immédiates</p>
            </div>
            <button
              onClick={reset}
              aria-label="Effacer la conversation"
              className="rounded-lg p-2 transition-colors hover:bg-white/20"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="rounded-lg p-2 transition-colors hover:bg-white/20"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-gray-50 px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div className={cn('max-w-[85%] space-y-2')}>
                  <div
                    className={cn(
                      'whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      message.role === 'user'
                        ? 'rounded-br-sm bg-[#FF6B00] text-white'
                        : 'rounded-bl-sm border border-gray-200 bg-white text-gray-800'
                    )}
                  >
                    <RichText value={message.content} />
                  </div>

                  {message.links && message.links.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {message.links.map((link) => (
                        <button
                          key={link.to}
                          onClick={() => goTo(link.to)}
                          className="rounded-full border border-[#FF6B00]/30 bg-[#FF6B00]/10 px-3 py-1.5 text-xs font-semibold text-[#C24E00] transition-colors hover:bg-[#FF6B00]/20"
                        >
                          {link.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-start">
                <div className="flex gap-1.5 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-3">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {welcomeSuggestions.length > 0 && (
            <div className="scrollbar-hide flex gap-2 overflow-x-auto border-t border-gray-100 bg-white px-3 py-2">
              {welcomeSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => send(suggestion)}
                  className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-[#FF6B00] hover:text-[#FF6B00]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question…"
              maxLength={500}
              className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#FF6B00] focus:bg-white"
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              aria-label="Envoyer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF6B00] text-white transition-colors hover:bg-[#E05E00] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
