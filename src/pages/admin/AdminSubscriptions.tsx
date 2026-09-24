import { useEffect, useState } from 'react';
import { Loader2, Megaphone, Crown } from 'lucide-react';
import {
  adminListAds,
  adminListSubscriptions,
  formatXof,
  setAdStatus,
  type AdPlacement,
} from '../../services/subscriptions';

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Awaited<ReturnType<typeof adminListSubscriptions>>>([]);
  const [ads, setAds] = useState<AdPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [s, a] = await Promise.all([adminListSubscriptions(), adminListAds()]);
    setSubs(s);
    setAds(a);
  };

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-[#FF6B00]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Crown size={22} className="text-[#FF6B00]" /> Abonnements
        </h1>
        <p className="text-sm text-gray-500 mt-1">Suivi des plans clients / vendeurs et pubs.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b font-bold text-sm">Derniers abonnements</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Audience</th>
                <th className="px-4 py-2">Durée</th>
                <th className="px-4 py-2">Montant payé</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Fin</th>
                <th className="px-4 py-2">User</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const plan = Array.isArray(s.plan) ? s.plan[0] : s.plan;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2 font-semibold">
                      {(plan as { name?: string } | null)?.name || '—'}
                    </td>
                    <td className="px-4 py-2">
                      {(plan as { audience?: string } | null)?.audience || '—'}
                    </td>
                    <td className="px-4 py-2">
                      {Number(s.term_months ?? 1)} mois
                      {Number(s.discount_pct ?? 0) > 0 && (
                        <span className="ml-1 text-xs font-bold text-[#00A651]">
                          −{Math.round(Number(s.discount_pct) * 100)} %
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {s.amount_paid_xof != null ? formatXof(Number(s.amount_paid_xof)) : '—'}
                    </td>
                    <td className="px-4 py-2">{s.status}</td>
                    <td className="px-4 py-2">
                      {s.ends_at
                        ? new Date(s.ends_at as string).toLocaleDateString('fr-FR')
                        : '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{String(s.user_id).slice(0, 8)}…</td>
                  </tr>
                );
              })}
              {!subs.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Aucun abonnement
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b font-bold text-sm flex items-center gap-2">
          <Megaphone size={16} /> Publicités
        </div>
        <ul className="divide-y">
          {ads.map((ad) => (
            <li key={ad.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-bold">{ad.title}</p>
                <p className="text-gray-500 text-xs">
                  {ad.slot} · {ad.status}
                  {ad.endsAt ? ` · fin ${new Date(ad.endsAt).toLocaleDateString('fr-FR')}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {ad.status !== 'active' && (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-[#00A651] text-white text-xs font-bold"
                    onClick={() => setAdStatus(ad.id, 'active').then(reload)}
                  >
                    Activer
                  </button>
                )}
                {ad.status === 'active' && (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg border text-xs font-bold text-red-600"
                    onClick={() => setAdStatus(ad.id, 'ended').then(reload)}
                  >
                    Couper
                  </button>
                )}
              </div>
            </li>
          ))}
          {!ads.length && (
            <li className="px-4 py-8 text-center text-gray-400 text-sm">Aucune publicité</li>
          )}
        </ul>
      </section>
    </div>
  );
}
