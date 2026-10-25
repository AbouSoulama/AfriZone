import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Package,
  Zap,
  Shield,
  Headphones,
  RefreshCw,
  Megaphone,
  MapPin,
  CheckCircle2,
  Truck,
} from 'lucide-react';
import { fetchActiveAds } from '../services/subscriptions';
import { supabase } from '../lib/supabase';

type Glow = { a: string; b: string };

type Slide = {
  id: string | number;
  kind: 'brand' | 'parcel' | 'ad';
  title: string;
  highlight?: string;
  subtitle: string;
  description: string;
  cta: string;
  to: string;
  secondaryCta?: { label: string; to: string };
  glow: Glow;
  /** orange = fond dégradé d’origine, ink = fond sombre */
  surface?: 'orange' | 'ink';
  icon: typeof ShoppingBag;
  badge: string;
  imageUrl?: string | null;
};

/** Slides plateforme uniquement (pas de fausses promos) — les pubs Business viennent de la DB */
const PLATFORM_SLIDES: Slide[] = [
  {
    id: 'brand',
    kind: 'brand',
    title: 'Bienvenue sur AfriZone',
    subtitle: 'Marketplace ouest-africaine',
    surface: 'orange',
    description:
      'Achetez, vendez et expédiez au Burkina Faso, au Mali, au Sénégal et en Guinée — vendeurs locaux, livraison suivie.',
    cta: 'Découvrir le catalogue',
    to: '/catalogue',
    glow: { a: 'rgba(255,128,32,0.6)', b: 'rgba(16,200,110,0.4)' },
    icon: ShoppingBag,
    badge: 'AFRIZONE',
  },
  {
    id: 'colis',
    kind: 'parcel',
    title: 'Envoyez vos colis',
    highlight: 'en toute confiance',
    subtitle: 'Entre nos villes partenaires',
    description:
      'Enlèvement à votre adresse, GPS au départ et à l’arrivée, livraison validée par un code de remise.',
    cta: 'Envoyer un colis',
    to: '/colis',
    secondaryCta: { label: 'Suivre un colis', to: '/suivi' },
    glow: { a: 'rgba(0,166,81,0.5)', b: 'rgba(255,107,0,0.35)' },
    icon: Package,
    badge: 'SERVICE',
  },
];

const AD_GLOWS: Glow[] = [
  { a: 'rgba(16,185,129,0.5)', b: 'rgba(255,107,0,0.3)' },
  { a: 'rgba(249,115,22,0.55)', b: 'rgba(236,72,153,0.3)' },
  { a: 'rgba(59,130,246,0.5)', b: 'rgba(0,166,81,0.3)' },
];

const features = [
  { icon: Zap, text: 'Livraison rapide', sub: 'Suivi GPS en direct', tint: 'from-orange-400 to-[#F25500]' },
  { icon: Shield, text: 'Paiement sécurisé', sub: 'Orange · Moov · Telecel · MTN', tint: 'from-emerald-400 to-[#00A651]' },
  { icon: Headphones, text: 'Support 24/7', sub: 'Assistant & contact', tint: 'from-sky-400 to-indigo-500' },
  { icon: RefreshCw, text: 'Retours faciles', sub: 'Vendeurs vérifiés', tint: 'from-amber-300 to-orange-500' },
];

function BrandVisual() {
  return (
    <div className="relative w-56 h-56 md:w-72 md:h-72 flex items-center justify-center">
      <div className="absolute inset-6 rounded-full bg-white/20 blur-2xl animate-pulse-soft" />
      <div className="absolute inset-0 rounded-full border border-white/25 animate-welcome-ring" />
      <div
        className="absolute inset-3 rounded-full border border-white/20 animate-welcome-ring"
        style={{ animationDelay: '1.1s' }}
      />
      <div
        className="absolute inset-8 rounded-full border border-white/15 animate-welcome-ring"
        style={{ animationDelay: '2.1s' }}
      />
      <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-full bg-white/18 backdrop-blur-[2px] flex items-center justify-center shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] animate-welcome-bag">
        <ShoppingBag size={104} strokeWidth={1.25} className="text-white drop-shadow-lg" />
      </div>
      {[
        { top: '8%', left: '12%', delay: '0s' },
        { top: '18%', right: '8%', delay: '0.8s' },
        { bottom: '16%', left: '6%', delay: '1.5s' },
        { bottom: '10%', right: '14%', delay: '2.2s' },
      ].map((spark, i) => (
        <span
          key={i}
          className="absolute w-2 h-2 rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-welcome-spark"
          style={{
            top: spark.top,
            left: spark.left,
            right: spark.right,
            bottom: spark.bottom,
            animationDelay: spark.delay,
          }}
        />
      ))}
    </div>
  );
}

function ParcelVisual() {
  return (
    <div className="relative w-[360px] h-[340px]">
      <div className="absolute inset-8 rounded-[2.5rem] bg-gradient-to-br from-emerald-400 to-[#00A651] blur-3xl opacity-35" />
      <div className="absolute inset-x-4 top-6 glass-dark rounded-3xl p-5 shadow-2xl animate-float">
        <div className="flex items-center justify-between">
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Exemple de suivi</p>
          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-400/15 px-2 py-0.5 rounded-full">
            En route
          </span>
        </div>
        <p className="mt-1 text-white font-extrabold font-display text-lg">AZ-BF-2481</p>
        <div className="mt-4 space-y-3">
          {[
            { label: 'Ouagadougou', done: true },
            { label: 'En transit', done: true },
            { label: 'Bobo-Dioulasso', done: false },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  step.done
                    ? 'bg-gradient-to-br from-emerald-400 to-[#00A651]'
                    : 'border-2 border-dashed border-white/30'
                }`}
              >
                {step.done ? <CheckCircle2 size={13} className="text-white" /> : null}
              </span>
              <span className={`text-sm ${step.done ? 'text-white font-semibold' : 'text-white/50'}`}>
                {step.label}
              </span>
              {i === 1 && <Truck size={16} className="ml-auto text-[#FFB067]" />}
            </div>
          ))}
        </div>
      </div>
      <div
        className="absolute right-2 bottom-2 glass-dark rounded-2xl px-4 py-3 shadow-2xl animate-float flex items-center gap-2"
        style={{ animationDelay: '1.5s' }}
      >
        <MapPin size={16} className="text-[#FFB067]" />
        <span className="text-white text-xs font-bold">GPS départ & arrivée</span>
      </div>
    </div>
  );
}

export default function HeroCarousel() {
  const [adSlides, setAdSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ads = await fetchActiveAds('hero');
        if (cancelled || !ads.length) {
          if (!cancelled) setAdSlides([]);
          return;
        }
        const vendorIds = [...new Set(ads.map((a) => a.vendorId).filter(Boolean))] as string[];
        const vendorMap = new Map<string, { shopName: string; shopSlug: string; logo: string | null }>();
        if (vendorIds.length) {
          const { data } = await supabase
            .from('vendors')
            .select('id, shop_name, shop_slug, shop_logo_url')
            .in('id', vendorIds);
          for (const v of data || []) {
            vendorMap.set(v.id as string, {
              shopName: v.shop_name as string,
              shopSlug: v.shop_slug as string,
              logo: (v.shop_logo_url as string) ?? null,
            });
          }
        }
        setAdSlides(
          ads.map((ad, i) => {
            const vendor = ad.vendorId ? vendorMap.get(ad.vendorId) : undefined;
            const link =
              ad.linkUrl ||
              (vendor?.shopSlug ? `/boutique/${vendor.shopSlug}` : '/catalogue');
            return {
              id: ad.id,
              kind: 'ad' as const,
              title: ad.title,
              subtitle: ad.subtitle || vendor?.shopName || 'Offre partenaire',
              description:
                ad.subtitle ||
                (vendor
                  ? `Boutique ${vendor.shopName} — sponsorisée AfriZone Business.`
                  : 'Publicité vendeur AfriZone Business.'),
              cta: vendor ? 'Voir la boutique' : 'Découvrir',
              to: link,
              glow: AD_GLOWS[i % AD_GLOWS.length],
              icon: Megaphone,
              badge: 'SPONSORISÉ',
              imageUrl: ad.imageUrl || vendor?.logo || null,
            };
          })
        );
      } catch {
        if (!cancelled) setAdSlides([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = useMemo(() => {
    const [welcome, ...rest] = PLATFORM_SLIDES;
    return [welcome, ...adSlides, ...rest];
  }, [adSlides]);

  useEffect(() => {
    setCurrent(0);
  }, [slides.length]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  const next = () => setCurrent((c) => (c + 1) % slides.length);
  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <div
        className="relative rounded-3xl overflow-hidden shadow-[0_30px_60px_-28px_rgba(255,107,0,0.45)] min-h-[420px] h-[440px] md:min-h-0 md:h-[420px] ring-1 ring-black/10"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {slides.map((slide, i) => {
          const Icon = slide.icon;
          const active = i === current;
          const orange = slide.surface === 'orange';
          const welcome = slide.kind === 'brand';
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                orange
                  ? 'bg-gradient-to-br from-[#FF6B00] via-[#FF8533] to-[#FF6B00] animate-welcome-pan'
                  : 'bg-ink'
              } ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.04] pointer-events-none'}`}
            >
              {welcome && (
                <>
                  <div className="absolute -top-28 -left-20 w-[420px] h-[420px] rounded-full bg-white/25 blur-[90px] animate-orb" />
                  <div
                    className="absolute -bottom-32 -right-16 w-[380px] h-[380px] rounded-full bg-[#FFE0B8]/35 blur-[100px] animate-orb"
                    style={{ animationDelay: '-7s' }}
                  />
                  <div
                    className="absolute top-1/3 left-1/2 w-72 h-72 -translate-x-1/2 rounded-full bg-white/10 blur-[80px] animate-pulse-soft"
                  />
                  <div className="absolute inset-y-0 w-40 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-welcome-sweep pointer-events-none z-0" />
                </>
              )}
              {!welcome && (
                <>
                  <div className="absolute inset-0 bg-grid-light pointer-events-none" />
                  <div
                    className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full blur-[110px] animate-orb mix-blend-screen"
                    style={{ background: slide.glow.a }}
                  />
                  <div
                    className="absolute -bottom-48 -right-24 w-[520px] h-[520px] rounded-full blur-[120px] animate-orb mix-blend-screen"
                    style={{ background: slide.glow.b, animationDelay: '-6s' }}
                  />
                </>
              )}

              {slide.imageUrl && (
                <>
                  <img
                    src={slide.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-35 scale-110 blur-[2px]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F19] via-[#0B0F19]/80 to-[#0B0F19]/30" />
                </>
              )}

              <div className="relative z-10 h-full flex items-start md:items-center px-5 sm:px-7 md:px-16 pt-7 pb-[4.75rem] md:pt-0 md:pb-12">
                <div className={`flex-1 text-white max-w-2xl min-w-0 ${active && !welcome ? 'animate-rise' : ''}`}>
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.16em] mb-3 ${
                      welcome ? 'bg-white/20' : 'glass-dark'
                    } ${active && welcome ? 'animate-rise-stagger' : ''}`}
                    style={active && welcome ? { animationDelay: '60ms' } : undefined}
                  >
                    {welcome ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] animate-pulse-soft" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF8A2B] shadow-[0_0_12px_#FF8A2B]" />
                    )}
                    {slide.badge}
                  </span>
                  <h2
                    className={`font-extrabold leading-[1.05] tracking-tight ${
                      welcome ? 'text-[1.7rem] sm:text-3xl md:text-5xl' : 'text-3xl md:text-6xl'
                    } ${active && welcome ? 'animate-rise-stagger' : ''}`}
                    style={active && welcome ? { animationDelay: '140ms' } : undefined}
                  >
                    {slide.title}
                    {slide.highlight && (
                      <>
                        <br />
                        <span className="text-gradient-brand">{slide.highlight}</span>
                      </>
                    )}
                  </h2>
                  <p
                    className={`${
                      welcome
                        ? 'mt-2 text-base sm:text-lg md:text-xl font-semibold text-white/95'
                        : 'mt-4 text-sm md:text-base font-semibold text-white/60 uppercase tracking-[0.18em]'
                    } ${active && welcome ? 'animate-rise-stagger' : ''}`}
                    style={active && welcome ? { animationDelay: '240ms' } : undefined}
                  >
                    {slide.subtitle}
                  </p>
                  <p
                    className={`leading-relaxed max-w-xl ${
                      welcome
                        ? 'mt-2 text-sm md:text-base text-white/85 pr-2'
                        : 'mt-3 text-base md:text-lg text-white/75'
                    } ${active && welcome ? 'animate-rise-stagger' : ''}`}
                    style={active && welcome ? { animationDelay: '340ms' } : undefined}
                  >
                    {slide.description}
                  </p>
                  <div
                    className={`flex flex-wrap items-center gap-3 w-full ${welcome ? 'mt-5 md:mt-6' : 'mt-8'} ${
                      active && welcome ? 'animate-rise-stagger' : ''
                    }`}
                    style={active && welcome ? { animationDelay: '460ms' } : undefined}
                  >
                    <Link
                      to={slide.to}
                      className={
                        orange
                          ? 'sheen inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-7 py-3.5 bg-white text-[#00A651] rounded-full font-bold text-sm shadow-lg hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_rgba(0,0,0,0.35)] transition-all'
                          : 'sheen inline-flex items-center gap-2 px-7 py-3.5 bg-[#FF6B00] text-white rounded-2xl font-bold text-sm hover:-translate-y-0.5'
                      }
                    >
                      {slide.cta}
                      <ChevronRight size={17} className={welcome ? 'animate-zoni-bob' : undefined} />
                    </Link>
                    {slide.secondaryCta && (
                      <Link
                        to={slide.secondaryCta.to}
                        className="inline-flex items-center gap-2 px-6 py-3.5 glass-dark text-white rounded-2xl font-bold text-sm hover:bg-white/15 transition-colors"
                      >
                        {slide.secondaryCta.label}
                      </Link>
                    )}
                  </div>
                </div>

                <div
                  className={`flex-shrink-0 ml-6 ${welcome ? 'hidden md:flex' : 'hidden lg:flex'} ${
                    active && welcome ? 'animate-rise-stagger' : ''
                  }`}
                  style={active && welcome ? { animationDelay: '280ms' } : undefined}
                >
                  {slide.kind === 'brand' && <BrandVisual />}
                  {slide.kind === 'parcel' && <ParcelVisual />}
                  {slide.kind === 'ad' &&
                    (slide.imageUrl ? (
                      <div className="relative">
                        <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-[#FF8A2B] to-[#00A651] blur-3xl opacity-40" />
                        <div className="relative w-72 h-72 rounded-[2rem] overflow-hidden ring-1 ring-white/20 shadow-2xl rotate-3 animate-float">
                          <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-64 h-64 glass-dark rounded-full flex items-center justify-center">
                        <Icon size={96} className="text-white drop-shadow-2xl" />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          );
        })}

        <div className="absolute bottom-4 left-5 right-5 sm:left-7 sm:right-7 md:bottom-6 md:left-16 md:right-16 z-20 flex items-center justify-between gap-3 pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Diapositive ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === current
                    ? 'w-10 bg-gradient-to-r from-[#FF8A2B] to-[#FFB067] shadow-[0_0_14px_rgba(255,138,43,0.8)]'
                    : 'w-3 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={prev}
              aria-label="Précédent"
              className="w-9 h-9 md:w-11 md:h-11 glass-dark hover:bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              aria-label="Suivant"
              className="w-9 h-9 md:w-11 md:h-11 glass-dark hover:bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-5">
        {features.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.text}
              className="group flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-black/[0.04] hover:-translate-y-0.5 hover:shadow-premium-lg transition-all duration-300"
            >
              <span
                className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${item.tint} flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 group-hover:-rotate-6`}
              >
                <Icon size={18} className="text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1F2937] truncate">{item.text}</p>
                <p className="text-[11px] text-gray-500 truncate">{item.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
