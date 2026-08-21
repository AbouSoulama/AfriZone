import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { checkCheckout } from '../services/payments';

type Phase = 'wait' | 'paid' | 'pending' | 'error';

export default function PaymentReturnPage() {
  const [params] = useSearchParams();
  const tx = params.get('tx') || '';
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [phase, setPhase] = useState<Phase>('wait');
  const [message, setMessage] = useState('Vérification du paiement…');
  const [kind, setKind] = useState<string>('order');
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [parcelId, setParcelId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!tx) {
      setPhase('error');
      setMessage('Référence de paiement manquante.');
      return;
    }
    if (!isAuthenticated) {
      setPhase('error');
      setMessage('Reconnectez-vous pour voir le résultat du paiement.');
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      attempts += 1;
      try {
        const remote = await checkCheckout(tx).catch(() => null);
        const { data: intent } = await supabase
          .from('payment_intents')
          .select('status, kind, order_ids, parcel_id')
          .eq('transaction_id', tx)
          .maybeSingle();

        const paid =
          remote?.status === 'paid' ||
          intent?.status === 'paid' ||
          String(remote?.cinetpayStatus || '').toUpperCase() === 'ACCEPTED';

        if (cancelled) return;

        const nextKind = remote?.kind || intent?.kind || 'order';
        const nextOrders = remote?.orderIds || intent?.order_ids || [];
        const nextParcel = remote?.parcelId ?? intent?.parcel_id ?? null;
        setKind(nextKind);
        setOrderIds(Array.isArray(nextOrders) ? nextOrders : []);
        setParcelId(nextParcel);

        if (paid) {
          setPhase('paid');
          setMessage('Paiement confirmé.');
          return;
        }

        if (attempts >= 8) {
          setPhase('pending');
          setMessage(
            'Le paiement est en cours de confirmation. Vous recevrez une notification dès qu’il sera validé. Vous pouvez aussi consulter Mes commandes.'
          );
          return;
        }

        window.setTimeout(() => {
          void tick();
        }, 2500);
      } catch (e) {
        if (cancelled) return;
        setPhase('error');
        setMessage(e instanceof Error ? e.message : 'Impossible de vérifier le paiement.');
      }
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [tx, isAuthenticated, authLoading]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border bg-white p-8">
          {phase === 'wait' && (
            <Loader2 size={48} className="mx-auto mb-4 animate-spin text-[#FF6B00]" />
          )}
          {phase === 'paid' && (
            <CheckCircle size={48} className="mx-auto mb-4 text-[#00A651]" />
          )}
          {(phase === 'error' || phase === 'pending') && (
            <XCircle
              size={48}
              className={`mx-auto mb-4 ${phase === 'pending' ? 'text-amber-500' : 'text-red-500'}`}
            />
          )}
          <h1 className="mb-2 text-2xl font-extrabold">
            {phase === 'paid'
              ? 'Paiement confirmé'
              : phase === 'pending'
                ? 'Confirmation en cours'
                : phase === 'wait'
                  ? 'Retour de paiement'
                  : 'Paiement non confirmé'}
          </h1>
          <p className="mb-6 text-sm text-gray-500">{message}</p>
          {tx && (
            <p className="mb-6 font-mono text-xs text-gray-400">Réf. {tx}</p>
          )}
          <div className="flex flex-col gap-2">
            {kind === 'parcel' ? (
              <Link
                to={parcelId ? `/colis/${parcelId}` : '/colis/mes-envois'}
                className="rounded-xl bg-[#FF6B00] py-3 font-bold text-white"
              >
                Voir mes envois
              </Link>
            ) : (
              <Link
                to={orderIds[0] ? `/commandes/${orderIds[0]}` : '/commandes'}
                className="rounded-xl bg-[#FF6B00] py-3 font-bold text-white"
              >
                Voir mes commandes
              </Link>
            )}
            <Link to="/" className="py-3 text-sm font-semibold text-gray-600">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
