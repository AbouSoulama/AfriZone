import { Mail, MapPin, Send, CreditCard, Truck, Shield, Headphones } from 'lucide-react';

const SocialIcon = ({ path }: { path: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d={path} /></svg>
);

const socials = [
  { path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  { path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  { path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' },
  { path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
];

const footerLinks = {
  'Acheter': ['Comment commander', 'Moyens de paiement', 'Livraison', 'Retours & Remboursements', 'Suivre ma commande', 'Service client'],
  'Vendre': ['Devenir vendeur', 'Conditions vendeurs', 'Outils vendeurs', 'Publicité', 'Gold Seller', 'Formation vendeurs'],
  'Livrer': ['Envoi de colis', 'Tarifs livraison', 'Zones desservies', 'Devenir livreur', 'Suivi colis', 'Entreprises'],
  'AfriZone': ['À propos', 'Carrières', 'Presse', 'Partenaires', 'Blog', 'Contact'],
};

const cities = ['Dakar', 'Ouagadougou', 'Bamako', 'Abidjan', 'Lomé', 'Cotonou', 'Niamey', 'Conakry'];

export default function Footer() {
  return (
    <footer className="bg-[#1F2937] text-white">
      {/* Newsletter */}
      <div className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-extrabold mb-2">Restez informé</h3>
              <p className="text-gray-400 text-sm">Recevez nos meilleures offres et nouveautés directement dans votre boîte mail.</p>
            </div>
            <form className="flex gap-2">
              <div className="flex-1 relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="Votre adresse email"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-800 border border-gray-700 rounded-xl text-sm focus:border-[#FF6B00] focus:outline-none text-white placeholder-gray-500"
                />
              </div>
              <button type="submit" className="px-6 py-3.5 bg-[#FF6B00] hover:bg-[#E05E00] rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shrink-0">
                S'abonner <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Features strip */}
      <div className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Truck, title: 'Livraison rapide', desc: '24-48h' },
              { icon: CreditCard, title: 'Paiement sécurisé', desc: '100% sécurisé' },
              { icon: Shield, title: 'Garantie qualité', desc: 'Produits vérifiés' },
              { icon: Headphones, title: 'Support 24/7', desc: 'À votre écoute' },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FF6B00]/20 rounded-xl flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-[#FF6B00]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{f.title}</p>
                    <p className="text-[11px] text-gray-400">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <div className="mb-4">
              <img
                src="/logo-afrizone.png"
                alt="AfriZone"
                className="h-16 w-auto object-contain bg-white rounded-xl p-1.5"
              />
            </div>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              La première marketplace 100% africaine qui connecte acheteurs, vendeurs et livreurs à travers le continent.
            </p>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2"><MapPin size={14} className="text-[#FF6B00]" /> Route de Ngor, Dakar, Sénégal</div>
              {/* <div className="flex items-center gap-2"><Phone size={14} className="text-[#FF6B00]" /> +221 33 000 00 00</div> */}
              <div className="flex items-center gap-2"><Mail size={14} className="text-[#FF6B00]" /> contact@afrizone.com</div>
            </div>

            <div className="flex items-center gap-2 mt-5">
              {socials.map((social, i) => (
                <a key={i} href="#" className="w-9 h-9 bg-gray-800 hover:bg-[#FF6B00] rounded-lg flex items-center justify-center transition-colors text-white">
                  <SocialIcon path={social.path} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-bold text-sm mb-4 text-white">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-xs text-gray-400 hover:text-[#FF6B00] transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Cities strip */}
      <div className="border-t border-gray-700 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-gray-400 mb-2">VILLES DESSERVIES :</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {cities.map((city) => (
                  <a key={city} href="#" className="text-xs text-gray-500 hover:text-white transition-colors">{city}</a>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">Nous acceptons :</span>
              <div className="flex items-center gap-2">
                {['Orange Money', 'Wave', 'Moov Money', 'Visa', 'MC'].map((m) => (
                  <div key={m} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[10px] font-bold text-gray-300">
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              © 2026 AfriZone. Tous droits réservés. Fait avec <span className="text-[#FF6B00]">♥</span> en Afrique.
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Conditions d'utilisation</a>
              <a href="#" className="hover:text-white transition-colors">Politique de confidentialité</a>
              <a href="#" className="hover:text-white transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
