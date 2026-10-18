import { Package, Truck, MapPin, KeyRound, Shield, ArrowRight, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fetchActiveAds, type AdPlacement } from '../services/subscriptions';

const features = [
  { icon: Truck, title: 'Enlèvement', desc: 'À votre adresse' },
  { icon: MapPin, title: 'Suivi GPS', desc: 'Départ & arrivée' },
  { icon: KeyRound, title: 'Code de remise', desc: 'Livraison validée par code' },
  { icon: Shield, title: 'Tarif clair', desc: 'Au kilo, sans surprise' },
];

export default function CTABanner() {
  const [sponsor, setSponsor] = useState<AdPlacement | null>(null);

  useEffect(() => {
    fetchActiveAds('home_banner')
      .then((ads) => setSponsor(ads[0] || null))
      .catch(() => setSponsor(null));
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-4 py-14 space-y-6">
      {sponsor && (
        <Link
          to={sponsor.linkUrl || '/catalogue'}
          className="sheen ring-gradient group flex items-center gap-5 rounded-3xl bg-white p-6 md:p-8 hover:-translate-y-0.5 hover:shadow-premium-lg transition-all"
        >
          <span className="hidden sm:flex w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-[#FF8A2B] to-[#F25500] items-center justify-center shadow-glow-orange">
            <Megaphone size={24} className="text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] text-[#FF6B00] mb-1">SPONSORISÉ</p>
            <h3 className="text-2xl font-extrabold text-[#0B0F19]">{sponsor.title}</h3>
            {sponsor.subtitle && <p className="text-sm text-gray-600 mt-1">{sponsor.subtitle}</p>}
          </div>
          <ArrowRight className="shrink-0 text-gray-300 group-hover:text-[#FF6B00] group-hover:translate-x-1 transition-all" />
        </Link>
      )}

      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#00A651] via-[#008A43] to-[#064E3B] p-8 md:p-14 ring-1 ring-white/10 shadow-[0_40px_80px_-30px_rgba(0,110,55,0.6)]">
        <div className="absolute -top-40 -right-20 w-[480px] h-[480px] bg-white/20 rounded-full blur-[110px] animate-orb mix-blend-soft-light" />
        <div className="absolute -bottom-40 -left-20 w-[380px] h-[380px] bg-emerald-300/25 rounded-full blur-[100px] animate-orb" style={{ animationDelay: '-7s' }} />
        <div className="absolute inset-0 bg-grid-light pointer-events-none" />

        <div className="relative z-10 grid md:grid-cols-2 gap-10 items-center">
          <div className="text-white">
            <div className="inline-flex items-center gap-2 glass-dark px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.2em] mb-5">
              <Package size={13} /> SERVICE DE LIVRAISON
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-[1.08]">
              Envoyez vos colis
              <br />
              <span className="bg-gradient-to-r from-[#FFD7A8] via-[#FF8A2B] to-[#FFB067] bg-clip-text text-transparent">
                partout en Afrique de l&apos;Ouest
              </span>
            </h2>
            <p className="text-base md:text-lg text-white/80 mb-8 leading-relaxed max-w-md">
              Un service rapide, sécurisé et abordable entre les villes du Burkina Faso, du Mali, du
              Sénégal et de la Guinée.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-9">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex items-center gap-3 glass-dark rounded-2xl px-3.5 py-3">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-white/15 flex items-center justify-center">
                      <Icon size={17} className="text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{f.title}</p>
                      <p className="text-[11px] text-white/65 truncate">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/colis"
                className="sheen inline-flex items-center gap-2 px-7 py-3.5 bg-[#FF6B00] text-white rounded-2xl font-bold text-sm hover:-translate-y-0.5"
              >
                Envoyer un colis <ArrowRight size={16} />
              </Link>
              <Link
                to="/suivi"
                className="inline-flex items-center gap-2 px-6 py-3.5 glass-dark text-white rounded-2xl font-bold text-sm hover:bg-white/20 transition-colors"
              >
                Suivre un colis
              </Link>
            </div>
          </div>

          <div className="relative hidden md:flex items-center justify-center h-[380px]">
            <div className="absolute w-72 h-72 rounded-full border border-white/15" />
            <div className="absolute w-96 h-96 rounded-full border border-white/10" />
            <div className="relative w-48 h-48 rounded-[2rem] bg-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] flex items-center justify-center animate-float">
              <div className="text-center">
                <span className="mx-auto mb-3 w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-[#00A651] flex items-center justify-center shadow-glow-green">
                  <Package size={40} className="text-white" />
                </span>
                <p className="text-sm font-extrabold font-display text-[#0B0F19]">AfriZone</p>
                <p className="text-xs text-gray-500">Colis Express</p>
              </div>
            </div>
            {[
              { Icon: Truck, cls: 'top-6 right-12 bg-white text-[#FF6B00]', delay: '0.4s' },
              { Icon: MapPin, cls: 'bottom-10 left-6 bg-white text-[#00A651]', delay: '1.1s' },
              { Icon: KeyRound, cls: 'top-16 left-10 bg-gradient-to-br from-[#FF8A2B] to-[#F25500] text-white', delay: '1.8s' },
              { Icon: Shield, cls: 'bottom-4 right-8 bg-gradient-to-br from-[#0B0F19] to-[#1F2937] text-white', delay: '2.5s' },
            ].map(({ Icon, cls, delay }, i) => (
              <div
                key={i}
                className={`absolute ${cls} rounded-2xl p-3.5 shadow-2xl animate-float`}
                style={{ animationDelay: delay }}
              >
                <Icon size={26} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
