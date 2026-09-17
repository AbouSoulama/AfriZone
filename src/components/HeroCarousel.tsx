import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Gift,
  Zap,
  Shield,
  Headphones,
  RefreshCw,
  Megaphone,
} from 'lucide-react';
import { fetchActiveAds } from '../services/subscriptions';
import { supabase } from '../lib/supabase';

type Slide = {
  id: string | number;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
  to: string;
  bg: string;
  accent: string;
  icon: typeof ShoppingBag;
  badge: string;
  imageUrl?: string | null;
};

/** Slides plateforme uniquement (pas de fausses promos) — les pubs Business viennent de la DB */
const PLATFORM_SLIDES: Slide[] = [
  {
    id: 'brand',
    title: 'Bienvenue sur AfriZone',
    subtitle: 'Marketplace ouest-africaine',
    description:
      'Achetez, vendez et expédiez au Burkina Faso, au Mali et au Sénégal — vendeurs locaux, livraison suivie.',
    cta: 'Découvrir le catalogue',
    to: '/catalogue',
    bg: 'from-[#FF6B00] via-[#FF8533] to-[#FF6B00]',
    accent: '#00A651',
    icon: ShoppingBag,
    badge: 'AFRIZONE',
  },
  {
    id: 'colis',
    title: 'Envoi de Colis',
    subtitle: 'Entre nos villes partenaires',
    description:
      'Expédiez vos colis en toute sécurité avec suivi — Ouagadougou, Bamako, Dakar et plus.',
    cta: 'Envoyer un colis',
    to: '/colis',
    bg: 'from-[#1F2937] via-[#374151] to-[#1F2937]',
    accent: '#FF6B00',
    icon: Gift,
    badge: 'SERVICE',
  },
];

const AD_BGS = [
  'from-[#064E3B] via-[#047857] to-[#065F46]',
  'from-[#7C2D12] via-[#C2410C] to-[#9A3412]',
  'from-[#1E3A8A] via-[#2563EB] to-[#1D4ED8]',
];

const features = [
  { icon: Zap, text: 'Livraison rapide', color: '#FF6B00' },
  { icon: Shield, text: 'Paiement sécurisé', color: '#00A651' },
  { icon: Headphones, text: 'Support 24/7', color: '#00A651' },
  { icon: RefreshCw, text: 'Retours faciles', color: '#FF6B00' },
];

export default function HeroCarousel() {
  const [adSlides, setAdSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);

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
              title: ad.title,
              subtitle: ad.subtitle || vendor?.shopName || 'Offre partenaire',
              description:
                ad.subtitle ||
                (vendor
                  ? `Boutique ${vendor.shopName} — sponsorisée AfriZone Business.`
                  : 'Publicité vendeur AfriZone Business.'),
              cta: vendor ? 'Voir la boutique' : 'Découvrir',
              to: link,
              bg: AD_BGS[i % AD_BGS.length],
              accent: '#FF6B00',
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
    // Pubs Business en premier (réelles), puis slides plateforme
    if (adSlides.length) return [...adSlides, ...PLATFORM_SLIDES];
    return PLATFORM_SLIDES;
  }, [adSlides]);

  useEffect(() => {
    setCurrent(0);
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const next = () => setCurrent((c) => (c + 1) % slides.length);
  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <div className="relative rounded-2xl overflow-hidden shadow-2xl h-[340px] md:h-[420px]">
        {slides.map((slide, i) => {
          const Icon = slide.icon;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 bg-gradient-to-br ${slide.bg} transition-all duration-700 ${
                i === current ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              }`}
            >
              {slide.imageUrl && (
                <>
                  <img
                    src={slide.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/30" />
                </>
              )}
              {!slide.imageUrl && (
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                  <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
                </div>
              )}

              <div className="relative z-10 h-full flex items-center max-w-7xl mx-auto px-8 md:px-16">
                <div className="flex-1 text-white max-w-xl">
                  <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold tracking-wider mb-3">
                    {slide.badge}
                  </span>
                  <h2 className="text-3xl md:text-5xl font-extrabold mb-2 leading-tight">
                    {slide.title}
                  </h2>
                  <p className="text-lg md:text-xl font-semibold mb-3 opacity-90">{slide.subtitle}</p>
                  <p className="text-sm md:text-base opacity-80 mb-6 leading-relaxed">
                    {slide.description}
                  </p>
                  <Link
                    to={slide.to}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                    style={{ color: slide.accent }}
                  >
                    {slide.cta}
                    <ChevronRight size={16} />
                  </Link>
                </div>
                <div className="hidden md:flex flex-shrink-0 ml-8">
                  {slide.imageUrl ? (
                    <div className="w-52 h-52 rounded-3xl overflow-hidden border-4 border-white/30 shadow-2xl bg-white/10">
                      <img
                        src={slide.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-52 h-52 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Icon size={100} className="text-white drop-shadow-lg" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={prev}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-sm hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all z-20"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={next}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-sm hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all z-20"
        >
          <ChevronRight size={22} />
        </button>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${
                i === current ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {features.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <Icon size={20} style={{ color: item.color }} />
              <span className="text-xs font-semibold text-[#1F2937]">{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
