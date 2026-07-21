import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag, Zap, Gift, Truck, Shield, Headphones, RefreshCw } from 'lucide-react';

const slides = [
  {
    id: 1,
    title: 'Bienvenue sur AfriZone',
    subtitle: 'Votre marketplace africaine',
    description: 'Découvrez des milliers de produits authentiques et soutenez les vendeurs locaux africains.',
    cta: 'Découvrir maintenant',
    bg: 'from-[#FF6B00] via-[#FF8533] to-[#FF6B00]',
    accent: '#00A651',
    icon: ShoppingBag,
    badge: 'NOUVEAU',
  },
  {
    id: 2,
    title: '-30% sur l\'Électronique',
    subtitle: 'Offre limitée',
    description: 'Smartphones, ordinateurs, accessoires — Les meilleures marques aux meilleurs prix.',
    cta: 'Voir les offres',
    bg: 'from-[#00A651] via-[#33B874] to-[#00A651]',
    accent: '#FF6B00',
    icon: Zap,
    badge: 'PROMO',
  },
  {
    id: 3,
    title: 'Livraison Gratuite',
    subtitle: 'Dès 15 000 FCFA',
    description: 'Profitez de la livraison gratuite sur toutes vos commandes dans Dakar et Ouagadougou.',
    cta: 'Commander',
    bg: 'from-[#1F2937] via-[#374151] to-[#1F2937]',
    accent: '#FF6B00',
    icon: Truck,
    badge: 'LIVRAISON',
  },
  {
    id: 4,
    title: 'Envoi de Colis',
    subtitle: 'Partout en Afrique',
    description: 'Expédiez vos colis en toute sécurité avec notre service de livraison fiable.',
    cta: 'Envoyer un colis',
    bg: 'from-[#FF6B00] via-[#E05E00] to-[#FF6B00]',
    accent: '#00A651',
    icon: Gift,
    badge: 'SERVICE',
  },
];

const features = [
  { icon: Zap, text: 'Livraison rapide', color: '#FF6B00' },
  { icon: Shield, text: 'Paiement sécurisé', color: '#00A651' },
  { icon: Headphones, text: 'Support 24/7', color: '#00A651' },
  { icon: RefreshCw, text: 'Retours faciles', color: '#FF6B00' },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

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
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute top-10 right-20 w-32 h-32 border-4 border-white/20 rounded-full" />
                <div className="absolute bottom-10 left-10 w-20 h-20 border-4 border-white/20 rounded-full" />
              </div>

              <div className="relative z-10 h-full flex items-center max-w-7xl mx-auto px-8 md:px-16">
                <div className="flex-1 text-white max-w-xl">
                  <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold tracking-wider mb-3">
                    {slide.badge}
                  </span>
                  <h2 className="text-3xl md:text-5xl font-extrabold mb-2 leading-tight">
                    {slide.title}
                  </h2>
                  <p className="text-lg md:text-xl font-semibold mb-3 opacity-90">
                    {slide.subtitle}
                  </p>
                  <p className="text-sm md:text-base opacity-80 mb-6 leading-relaxed">
                    {slide.description}
                  </p>
                  <button
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                    style={{ color: slide.accent }}
                  >
                    {slide.cta}
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="hidden md:flex flex-shrink-0 ml-8">
                  <div className="w-52 h-52 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Icon size={100} className="text-white drop-shadow-lg" />
                  </div>
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
            <div key={i} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
              <Icon size={20} style={{ color: item.color }} />
              <span className="text-xs font-semibold text-[#1F2937]">{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
