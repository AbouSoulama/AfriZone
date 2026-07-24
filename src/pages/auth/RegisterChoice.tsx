import { Link } from 'react-router-dom';
import { ArrowRight, Bike, ShoppingBag, Store } from 'lucide-react';

const roles = [
  {
    to: '/auth/register/client',
    title: 'Client',
    description: 'Achetez des produits et envoyez des colis partout en Afrique de l’Ouest.',
    icon: ShoppingBag,
    accent: '#00A651',
    bg: 'bg-green-50',
    border: 'hover:border-[#00A651]',
    cta: 'Créer un compte client',
  },
  {
    to: '/auth/register/vendor',
    title: 'Vendeur',
    description: 'Ouvrez votre boutique, gérez vos produits et recevez des commandes.',
    icon: Store,
    accent: '#FF6B00',
    bg: 'bg-orange-50',
    border: 'hover:border-[#FF6B00]',
    cta: 'Créer une boutique',
  },
  {
    to: '/auth/register/driver',
    title: 'Livreur',
    description: 'Rejoignez le réseau AfriZone et livrez commandes et colis dans votre ville.',
    icon: Bike,
    accent: '#1F2937',
    bg: 'bg-gray-100',
    border: 'hover:border-[#1F2937]',
    cta: 'Devenir livreur',
  },
];

export default function RegisterChoicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <Link to="/">
            <img src="/logo-afrizone.png" alt="AfriZone" className="h-16 w-auto mx-auto" />
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937] mt-4">
            Créer un compte
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Choisissez le type de compte qui correspond à votre besoin
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <Link
                key={role.to}
                to={role.to}
                className={`group bg-white border-2 border-gray-100 ${role.border} rounded-2xl p-6 transition-all hover:shadow-lg flex flex-col`}
              >
                <div
                  className={`w-12 h-12 ${role.bg} rounded-xl flex items-center justify-center mb-4`}
                  style={{ color: role.accent }}
                >
                  <Icon size={24} />
                </div>
                <h2 className="text-lg font-extrabold text-[#1F2937] mb-2">{role.title}</h2>
                <p className="text-sm text-gray-500 flex-1 mb-5 leading-relaxed">
                  {role.description}
                </p>
                <span
                  className="inline-flex items-center gap-2 text-sm font-bold"
                  style={{ color: role.accent }}
                >
                  {role.cta}
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="text-center text-sm text-gray-600 mt-8">
          Vous avez déjà un compte ?{' '}
          <Link to="/auth/login" className="text-[#FF6B00] font-bold hover:underline">
            Se connecter
          </Link>
        </p>
        <p className="text-center mt-3">
          <Link to="/" className="text-sm text-gray-500 hover:text-[#1F2937]">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </div>
  );
}
