import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-sm text-[#FF6B00] font-bold mb-2">Légal</p>
        <h1 className="text-3xl font-extrabold text-[#1F2937] mb-2">Politique de confidentialité</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : 24 juillet 2026</p>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">1. Données collectées</h2>
            <p>
              Nom, téléphone, email, ville, adresses de livraison, informations de boutique / véhicule
              (vendeurs et livreurs), historique de commandes, avis et notifications.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">2. Finalités</h2>
            <p>
              Exécution des commandes et livraisons, validation des comptes professionnels, support
              client, sécurité de la plateforme et amélioration du service.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">3. Paiements</h2>
            <p>
              Les paiements Mobile Money sont traités via les opérateurs / passerelles partenaires.
              AfriZone ne stocke pas de codes secrets USSD ni de PIN.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">4. Conservation & droits</h2>
            <p>
              Vous pouvez demander l’accès, la correction ou la suppression de vos données via{' '}
              <Link to="/contact" className="text-[#FF6B00] font-semibold">
                Contact
              </Link>{' '}
              ou depuis votre espace compte, dans les limites légales et opérationnelles.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">5. Cookies</h2>
            <p>
              Le site utilise le stockage local pour la session, le panier et la ville sélectionnée,
              afin d’améliorer l’expérience utilisateur.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
