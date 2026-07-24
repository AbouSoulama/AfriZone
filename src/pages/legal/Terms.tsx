import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-sm text-[#FF6B00] font-bold mb-2">Légal</p>
        <h1 className="text-3xl font-extrabold text-[#1F2937] mb-2">Conditions générales d’utilisation</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : 24 juillet 2026</p>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">1. Objet</h2>
            <p>
              AfriZone est une marketplace qui met en relation acheteurs, vendeurs et livreurs en Afrique
              de l’Ouest (notamment Sénégal, Burkina Faso et Mali). Les présentes CGU régissent l’accès
              et l’usage de la plateforme.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">2. Comptes</h2>
            <p>
              Vous devez fournir des informations exactes à l’inscription. Un compte peut être suspendu
              en cas de fraude, de non-respect des règles ou de documents invalides (vendeurs / livreurs).
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">3. Commandes & paiements</h2>
            <p>
              Les paiements s’effectuent via Mobile Money (Orange Money, Wave, Moov Money selon
              disponibilité). Une commande confirmée engage le vendeur à préparer et expédier les
              articles dans les délais indiqués.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">4. Livraisons & colis</h2>
            <p>
              AfriZone propose la livraison marketplace et un service d’envoi de colis. Les délais
              indiqués sont estimatifs et peuvent varier selon la ville et les conditions locales.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">5. Responsabilités</h2>
            <p>
              Les vendeurs sont responsables de la conformité des produits. AfriZone agit comme
              intermédiaire technique et peut modérer les comptes et contenus.
            </p>
          </section>
          <section>
            <h2 className="font-extrabold text-[#1F2937] text-base mb-2">6. Contact</h2>
            <p>
              Pour toute question :{' '}
              <Link to="/contact" className="text-[#FF6B00] font-semibold">
                page Contact
              </Link>{' '}
              ou contact@afrizone.com.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
