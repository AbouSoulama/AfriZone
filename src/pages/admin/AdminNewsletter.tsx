import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import {
  adminListNewsletterCampaigns,
  adminListNewsletterSubscribers,
  adminSendNewsletterCampaign,
  type NewsletterCampaignRow,
  type NewsletterSubscriberRow,
} from '../../services/newsletter';

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  unsubscribed: 'Désabonné',
  draft: 'Brouillon',
  sending: 'Envoi…',
  sent: 'Envoyée',
  failed: 'Échec',
};

export default function AdminNewsletterPage() {
  const [subs, setSubs] = useState<NewsletterSubscriberRow[]>([]);
  const [campaigns, setCampaigns] = useState<NewsletterCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');

  const reload = useCallback(async () => {
    const [s, c] = await Promise.all([
      adminListNewsletterSubscribers(),
      adminListNewsletterCampaigns(),
    ]);
    setSubs(s);
    setCampaigns(c);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await reload();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const counts = useMemo(() => {
    const confirmed = subs.filter((s) => s.status === 'confirmed').length;
    const pending = subs.filter((s) => s.status === 'pending').length;
    const unsubscribed = subs.filter((s) => s.status === 'unsubscribed').length;
    return { confirmed, pending, unsubscribed, total: subs.length };
  }, [subs]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counts.confirmed) {
      setError('Aucun abonné confirmé.');
      return;
    }
    if (!window.confirm(`Envoyer cette campagne à ${counts.confirmed} abonné(s) confirmé(s) ?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await adminSendNewsletterCampaign({
        subject,
        title,
        body,
        ctaUrl: ctaUrl || undefined,
        ctaLabel: ctaLabel || undefined,
      });
      setOkMsg(
        `Campagne lancée pour ${res.recipient_count} destinataire(s). Les e-mails partent en arrière-plan.`
      );
      setSubject('');
      setTitle('');
      setBody('');
      setCtaUrl('');
      setCtaLabel('');
      await reload();
      window.setTimeout(() => {
        void reload();
      }, 4000);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

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
          <Mail size={22} className="text-[#FF6B00]" /> Newsletter
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Abonnés confirmés et campagnes e-mail (SMTP AfriZone)
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Confirmés', value: counts.confirmed },
          { label: 'En attente', value: counts.pending },
          { label: 'Désabonnés', value: counts.unsubscribed },
          { label: 'Total', value: counts.total },
        ].map((c) => (
          <div key={c.label} className="bg-white border rounded-2xl px-4 py-3">
            <p className="text-xs text-gray-500 font-medium">{c.label}</p>
            <p className="text-2xl font-extrabold text-[#1F2937]">{c.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-sm">
          {okMsg}
        </div>
      )}

      <section className="bg-white border rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-sm">Nouvelle campagne</h2>
        <form className="space-y-3" onSubmit={onSend}>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-gray-500 text-xs font-medium">Sujet e-mail *</span>
              <input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
                placeholder="Ex. Nouveautés de la semaine"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-500 text-xs font-medium">Titre dans l&apos;e-mail *</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
                placeholder="Ex. Découvrez nos offres"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-gray-500 text-xs font-medium">Message *</span>
            <textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
              placeholder="Texte de la newsletter…"
            />
          </label>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-gray-500 text-xs font-medium">Lien bouton (optionnel)</span>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
                placeholder="/catalogue ou https://…"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-500 text-xs font-medium">Libellé bouton</span>
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
                placeholder="Voir le catalogue"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || counts.confirmed === 0}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#FF6B00] text-white text-sm font-bold disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Envoyer aux {counts.confirmed} confirmé(s)
          </button>
        </form>
      </section>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b font-bold text-sm">Campagnes récentes</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Sujet</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Envoyés</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Aucune campagne pour l&apos;instant
                  </td>
                </tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{c.subject}</div>
                    <div className="text-xs text-gray-400">{c.title}</div>
                    {c.error && <div className="text-xs text-red-500 mt-0.5">{c.error}</div>}
                  </td>
                  <td className="px-4 py-2.5">{STATUS_LABEL[c.status] || c.status}</td>
                  <td className="px-4 py-2.5">
                    {c.sent_count}/{c.recipient_count}
                    {c.failed_count > 0 ? (
                      <span className="text-red-500 text-xs ml-1">({c.failed_count} échec)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {new Date(c.created_at).toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b font-bold text-sm">Abonnés</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Pays</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Aucun abonné
                  </td>
                </tr>
              )}
              {subs.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2.5 font-medium">{s.email}</td>
                  <td className="px-4 py-2.5">{s.country || '—'}</td>
                  <td className="px-4 py-2.5">{STATUS_LABEL[s.status] || s.status}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {new Date(s.created_at).toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
