import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { Link } from 'react-router-dom';

const FAQ = [
  {
    q: 'Comment passer une commande ?',
    a: 'Parcourez le catalogue, ajoutez des articles au panier, puis validez le checkout avec votre adresse et un paiement Mobile Money.',
  },
  {
    q: 'Quels moyens de paiement sont acceptés ?',
    a: 'Orange Money, Wave et Moov Money selon votre pays. Le paiement est confirmé avant la préparation de la commande.',
  },
  {
    q: 'Puis-je suivre ma livraison ?',
    a: 'Oui : suivez le statut dans Mes commandes. Pour un envoi de colis indépendant, utilisez la page Suivi avec le numéro de tracking.',
  },
  {
    q: 'Comment devenir vendeur ?',
    a: 'Inscrivez-vous en tant que vendeur, déposez vos documents, puis attendez la validation admin. Ensuite gérez vos produits et commandes depuis /vendeur.',
  },
  {
    q: 'Comment devenir livreur ?',
    a: 'Inscrivez-vous via Devenir livreur, indiquez votre véhicule et vos zones. Après validation, les courses apparaissent dans votre espace livreur.',
  },
  {
    q: 'Puis-je noter un produit ?',
    a: 'Oui, une fois la commande marquée comme livrée, ouvrez le détail de commande et publiez un avis (produit + vendeur).',
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-sm text-[#FF6B00] font-bold mb-2">Aide</p>
        <h1 className="text-3xl font-extrabold text-[#1F2937] mb-2">FAQ</h1>
        <p className="text-sm text-gray-500 mb-8">
          Questions fréquentes. Besoin d’aide ?{' '}
          <Link to="/contact" className="text-[#FF6B00] font-semibold">
            Contactez-nous
          </Link>
          .
        </p>

        <div className="space-y-3">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="font-bold text-sm text-[#1F2937]">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
