import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { confirmNewsletter } from '../services/newsletter';
import BrandLogo from '../components/BrandLogo';

export default function NewsletterConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setState('error');
        setMessage('Lien de confirmation manquant.');
        return;
      }
      try {
        const res = await confirmNewsletter(token);
        if (cancelled) return;
        setState('ok');
        setMessage(
          res.status === 'already_confirmed'
            ? 'Votre inscription était déjà confirmée. Merci !'
            : 'Inscription confirmée. Vous recevrez bientôt nos actualités.'
        );
      } catch (e) {
        if (cancelled) return;
        setState('error');
        setMessage(e instanceof Error ? e.message : 'Confirmation impossible.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-gradient-to-b from-orange-50/80 to-white">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="flex justify-center"><BrandLogo size="md" /></div>
        {state === 'loading' && (
          <>
            <Loader2 className="mx-auto animate-spin text-[#FF6B00]" size={36} />
            <p className="text-sm text-gray-600">Confirmation en cours…</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="mx-auto text-[#00A651]" size={42} />
            <h1 className="text-2xl font-extrabold text-[#1F2937]">Newsletter activée</h1>
            <p className="text-sm text-gray-600">{message}</p>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="mx-auto text-red-500" size={42} />
            <h1 className="text-2xl font-extrabold text-[#1F2937]">Échec</h1>
            <p className="text-sm text-gray-600">{message}</p>
          </>
        )}
        <Link
          to="/"
          className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-[#FF6B00] text-white text-sm font-bold"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
