import { Link } from 'react-router-dom';
import { Check, Crown, Sparkles, ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

const CLIENT_FEATURES = [
  'Badge membre AfriZone Club',
  '−1 000 FCFA sur la livraison (jusqu’à 4× / mois)',
  'Accès prioritaire aux promos',
];

const VENDOR_PRO = [
  'Badge Pro sur la boutique',
  'Jusqu’à 3 produits mis en avant',
  'Priorité dans les vendeurs vedettes',
];

const VENDOR_BIZ = [
  'Tout Pro inclus',
  'Jusqu’à 8 produits mis en avant',
  '1 publicité sur le hero / bandeau d’accueil',
  'Commission réduite à 7 %',
];

export default function SubscriptionsPage() {
  const { isAuthenticated, user } = useAuth();

  const clientHref = isAuthenticated
    ? '/compte/abonnement'
    : '/auth/login?redirect=/compte/abonnement';

  const vendorHref =
    isAuthenticated && user?.role === 'vendeur'
      ? '/vendeur/abonnement'
      : isAuthenticated
        ? '/auth/register/vendor'
        : '/auth/login?redirect=/vendeur/abonnement';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#1F2937]">
            Abonnements AfriZone
          </h1>
          <p className="text-gray-500 mt-3 max-w-2xl mx-auto text-sm leading-relaxed">
            Déjà un compte ? Connectez-vous et souscrivez en 1 clic — pas besoin de
            recréer un profil. Nouveaux visiteurs : créez un compte client ou vendeur,
            puis choisissez votre plan.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="text-[#FF6B00]" size={22} />
              <h2 className="text-xl font-extrabold">Clients</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Plan <strong>AfriZone Club</strong> — 2 000 FCFA / mois
            </p>
            <ul className="space-y-2 text-sm text-gray-700 mb-6">
              {CLIENT_FEATURES.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check size={16} className="text-[#00A651] shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={clientHref}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#FF6B00] text-white rounded-xl font-bold text-sm"
            >
              {isAuthenticated ? 'Gérer mon abonnement' : 'Se connecter pour s’abonner'}
              <ArrowRight size={16} />
            </Link>
            <p className="text-xs text-gray-400 mt-3">
              Chemin : Mon compte → Abonnement
            </p>
          </div>

          <div className="bg-white border border-[#FF6B00]/30 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="text-[#FF6B00]" size={22} />
              <h2 className="text-xl font-extrabold">Vendeurs</h2>
            </div>
            <p className="text-sm text-gray-500 mb-2">
              <strong>Pro</strong> 7 500 FCFA · <strong>Business</strong> 25 000 FCFA / mois
            </p>
            <ul className="space-y-2 text-sm text-gray-700 mb-2">
              {VENDOR_PRO.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check size={16} className="text-[#00A651] shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="text-xs font-bold text-[#FF6B00] mb-2">Business en plus :</p>
            <ul className="space-y-2 text-sm text-gray-700 mb-6">
              {VENDOR_BIZ.slice(2).map((f) => (
                <li key={f} className="flex gap-2">
                  <Check size={16} className="text-[#00A651] shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={vendorHref}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#00A651] text-white rounded-xl font-bold text-sm"
            >
              {user?.role === 'vendeur'
                ? 'Espace vendeur → Abonnement'
                : isAuthenticated
                  ? 'Devenir vendeur'
                  : 'Se connecter (compte vendeur)'}
              <ArrowRight size={16} />
            </Link>
            <p className="text-xs text-gray-400 mt-3">
              Chemin : Espace vendeur → Abonnement & publicité
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#1F2937] text-white p-6 text-sm leading-relaxed">
          <p className="font-bold mb-2">Comptes déjà créés</p>
          <ol className="list-decimal pl-5 space-y-1 text-gray-300">
            <li>Connectez-vous avec votre email / mot de passe habituel.</li>
            <li>
              Client →{' '}
              <Link to="/compte/abonnement" className="text-[#FF6B00] font-semibold">
                /compte/abonnement
              </Link>
            </li>
            <li>
              Vendeur →{' '}
              <Link to="/vendeur/abonnement" className="text-[#FF6B00] font-semibold">
                /vendeur/abonnement
              </Link>
            </li>
            <li>Choisissez un plan payant et validez (FedaPay en mode live).</li>
          </ol>
        </div>
      </main>
      <Footer />
    </div>
  );
}
