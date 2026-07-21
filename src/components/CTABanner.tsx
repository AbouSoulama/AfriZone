import { Package, Truck, MapPin, Clock, Shield, ArrowRight, Phone } from 'lucide-react';

const features = [
  { icon: Truck, title: 'Livraison rapide', desc: '24-48h en ville' },
  { icon: Shield, title: 'Colis assurés', desc: 'Protection 100%' },
  { icon: MapPin, title: 'Suivi GPS', desc: 'Temps réel' },
  { icon: Clock, title: '24/7', desc: 'Disponible' },
];

export default function CTABanner() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#00A651] via-[#00A651] to-[#008A43] p-8 md:p-12">
        {/* Decorative */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full translate-y-20 -translate-x-20" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 border-4 border-white/20 rounded-full" />

        <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
          <div className="text-white">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-bold tracking-wider mb-4">
              <Package size={14} /> SERVICE DE LIVRAISON
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
              Envoyez vos colis
              <br />
              <span className="text-[#FF6B00]">partout en Afrique</span>
            </h2>
            <p className="text-base md:text-lg opacity-90 mb-6 leading-relaxed max-w-md">
              Service rapide, sécurisé et abordable pour envoyer vos colis vers toutes les grandes villes d'Afrique de l'Ouest.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5">
                    <Icon size={18} className="text-white shrink-0" />
                    <div>
                      <p className="text-xs font-bold">{f.title}</p>
                      <p className="text-[10px] opacity-75">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF6B00] text-white rounded-full font-bold text-sm shadow-lg hover:bg-[#E05E00] hover:shadow-xl transition-all hover:-translate-y-0.5">
                Envoyer un colis <ArrowRight size={16} />
              </button>
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-full font-bold text-sm hover:bg-white/30 transition-all border border-white/30">
            
              </button>
            </div>
          </div>

          {/* Visual */}
          <div className="relative hidden md:block">
            <div className="relative w-full aspect-square max-w-sm mx-auto">
              {/* Central package */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-44 h-44 bg-white rounded-3xl shadow-2xl flex items-center justify-center animate-pulse-soft">
                  <div className="text-center">
                    <Package size={60} className="mx-auto text-[#00A651] mb-2" />
                    <p className="text-sm font-extrabold text-[#1F2937]">AfriZone</p>
                    <p className="text-xs text-gray-500">Colis Express</p>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute top-0 right-8 bg-white rounded-2xl p-3 shadow-xl animate-pulse-soft" style={{ animationDelay: '0.2s' }}>
                <Truck size={28} className="text-[#FF6B00]" />
              </div>
              <div className="absolute bottom-8 left-0 bg-white rounded-2xl p-3 shadow-xl animate-pulse-soft" style={{ animationDelay: '0.4s' }}>
                <MapPin size={28} className="text-[#00A651]" />
              </div>
              <div className="absolute top-12 left-0 bg-[#FF6B00] rounded-2xl p-3 shadow-xl animate-pulse-soft" style={{ animationDelay: '0.6s' }}>
                <Shield size={28} className="text-white" />
              </div>
              <div className="absolute bottom-0 right-0 bg-[#00A651] rounded-2xl p-3 shadow-xl animate-pulse-soft" style={{ animationDelay: '0.8s' }}>
                <Clock size={28} className="text-white" />
              </div>

              {/* Connecting lines (simulated with divs) */}
              <div className="absolute top-1/2 left-8 w-8 h-0.5 bg-white/40" />
              <div className="absolute top-1/2 right-8 w-8 h-0.5 bg-white/40" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
