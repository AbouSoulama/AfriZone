// AfriZone — Emails transactionnels (commandes + plateforme)
// Deploy: supabase functions deploy order-emails --no-verify-jwt
// Secrets: EMAIL_HOOK_SECRET, APP_URL, EMAIL_FROM,
//          MAIL_RELAY_URL (https://afrizones.com/api/email/send),
//          (optionnel) RESEND_API_KEY en secours
//          + SUPABASE_SERVICE_ROLE_KEY (injecté auto sur hosted)
//
// Modes :
// 1) Commande (legacy) : { order_id, event: purchase|status_update, status? }
// 2) Générique : { kind: 'generic', event, subject, title, body, link?,
//                  cta_label?, role?, order_id?, user_ids?: string[], to_admins?: boolean }
// 3) Newsletter confirm : { kind: 'newsletter_confirm', email, confirm_url, unsubscribe_url? }
// 4) Newsletter campaign : { kind: 'newsletter_campaign', campaign_id }

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-email-hook-secret',
};

type OrderEvent = 'purchase' | 'status_update';

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée (payée)',
  processing: 'En préparation',
  shipped: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapHtml(opts: {
  brand: string;
  brandBg: string;
  accent?: string;
  name: string;
  title: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  appUrl: string;
  preheader?: string;
  unsubscribeUrl?: string;
}): string {
  const accent = opts.accent || '#FF6B00';
  const logoUrl = `${opts.appUrl}/logo-afrizone.png`;
  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `<tr>
          <td style="padding:8px 0 4px">
            <a href="${escapeHtml(opts.ctaUrl)}"
               style="display:inline-block;background:${accent};color:#ffffff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
              ${escapeHtml(opts.ctaLabel)}
            </a>
          </td>
        </tr>`
      : '';
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>`
    : '';
  const unsub = opts.unsubscribeUrl
    ? `<p style="margin:8px 0 0;font-size:11px;color:#9CA3AF">
         <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#6B7280;text-decoration:underline">Se désabonner</a>
       </p>`
    : `<p style="margin:0;font-size:11px;color:#9CA3AF">Utilisez l’application pour le suivi — ne répondez pas à cet e-mail.</p>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;color:#1F2937">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6;padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB">
      <tr>
        <td style="background:${opts.brandBg};padding:22px 24px 18px;text-align:center">
          <img src="${logoUrl}" alt="AfriZone" width="168" style="display:block;margin:0 auto 10px;max-width:168px;height:auto;border:0" />
          <div style="color:#F9FAFB;font-size:13px;letter-spacing:0.4px">${escapeHtml(opts.brand)}</div>
          <div style="color:#D1D5DB;font-size:11px;margin-top:4px;letter-spacing:1.2px;text-transform:uppercase">Achetez · Vendez · Expédiez</div>
        </td>
      </tr>
      <tr><td style="height:4px;background:#00A651;background:linear-gradient(90deg,#00A651 0%,#FF6B00 100%);font-size:0;line-height:0">&nbsp;</td></tr>
      <tr>
        <td style="padding:28px 28px 8px">
          <p style="margin:0 0 8px;font-size:15px;color:#4B5563">Bonjour ${escapeHtml(opts.name || '')},</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827">${escapeHtml(opts.title)}</h1>
          <div style="font-size:15px;line-height:1.65;color:#374151">${opts.bodyHtml}</div>
        </td>
      </tr>
      <tr><td style="padding:8px 28px 28px"><table role="presentation" cellspacing="0" cellpadding="0">${cta}</table></td></tr>
      <tr>
        <td style="background:#FAFAFA;border-top:1px solid #E5E7EB;padding:18px 28px;text-align:center">
          <p style="margin:0 0 6px;font-size:12px;color:#6B7280">Message automatique AfriZone · <a href="${opts.appUrl}" style="color:${accent};text-decoration:none">${opts.appUrl.replace(/^https?:\/\//, '')}</a></p>
          ${unsub}
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildNewsletterConfirmHtml(opts: {
  confirmUrl: string;
  unsubscribeUrl?: string;
  appUrl: string;
}): string {
  return wrapHtml({
    brand: 'AfriZone Newsletter',
    brandBg: '#111111',
    accent: '#FF6B00',
    name: '',
    title: 'Confirmez votre inscription',
    preheader: 'Un clic pour activer la newsletter AfriZone',
    appUrl: opts.appUrl,
    bodyHtml: `<p style="margin:0 0 10px">Merci de votre intérêt pour AfriZone.</p>
      <p style="margin:0">Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail et recevoir nos offres.</p>`,
    ctaUrl: opts.confirmUrl,
    ctaLabel: 'Confirmer mon inscription',
    unsubscribeUrl: opts.unsubscribeUrl,
  });
}

function buildNewsletterCampaignHtml(opts: {
  title: string;
  body: string;
  appUrl: string;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  unsubscribeUrl: string;
}): string {
  const path = (opts.ctaUrl || '').trim();
  const ctaUrl = path
    ? path.startsWith('http')
      ? path
      : `${opts.appUrl}${path.startsWith('/') ? '' : '/'}${path}`
    : undefined;
  return wrapHtml({
    brand: 'AfriZone Newsletter',
    brandBg: '#111111',
    accent: '#FF6B00',
    name: '',
    title: opts.title,
    preheader: opts.title,
    appUrl: opts.appUrl,
    bodyHtml: `<p style="white-space:pre-wrap;margin:0">${escapeHtml(opts.body)}</p>`,
    ctaUrl,
    ctaLabel: opts.ctaLabel || (ctaUrl ? 'Découvrir' : undefined),
    unsubscribeUrl: opts.unsubscribeUrl,
  });
}

function buildClientHtml(opts: {
  name: string;
  orderNumber: string;
  statusLabel: string;
  total: number;
  event: OrderEvent;
  appUrl: string;
  orderId: string;
}): string {
  const title =
    opts.event === 'purchase'
      ? 'Paiement confirmé'
      : `Commande ${opts.statusLabel.toLowerCase()}`;
  return wrapHtml({
    brand: 'AfriZone',
    brandBg: '#111111',
    accent: '#FF6B00',
    name: opts.name || 'client',
    title,
    preheader: `${opts.orderNumber} — ${opts.statusLabel}`,
    appUrl: opts.appUrl,
    bodyHtml: `<table role="presentation" width="100%" style="margin:8px 0 4px;background:#FFF7ED;border:1px solid #FFEDD5;border-radius:12px">
        <tr><td style="padding:14px 16px">
          <p style="margin:0 0 6px">Commande <strong>${escapeHtml(opts.orderNumber)}</strong></p>
          <p style="margin:0 0 6px">Montant : <strong>${opts.total.toLocaleString('fr-FR')} FCFA</strong></p>
          <p style="margin:0">Statut : <strong style="color:#C2410C">${escapeHtml(opts.statusLabel)}</strong></p>
        </td></tr>
      </table>`,
    ctaUrl: `${opts.appUrl}/commandes/${opts.orderId}`,
    ctaLabel: 'Voir ma commande',
  });
}

function buildAdminHtml(opts: {
  orderNumber: string;
  statusLabel: string;
  total: number;
  customerName: string;
  customerEmail: string;
  city: string;
  event: OrderEvent;
  appUrl: string;
}): string {
  const title =
    opts.event === 'purchase'
      ? 'Nouvel achat payé'
      : `Mise à jour commande — ${opts.statusLabel}`;
  return wrapHtml({
    brand: 'AfriZone Admin',
    brandBg: '#111827',
    accent: '#FF6B00',
    name: 'Admin',
    title,
    appUrl: opts.appUrl,
    bodyHtml: `<ul style="padding-left:18px;line-height:1.8">
        <li>N° : <strong>${escapeHtml(opts.orderNumber)}</strong></li>
        <li>Montant : <strong>${opts.total.toLocaleString('fr-FR')} FCFA</strong></li>
        <li>Statut : <strong>${escapeHtml(opts.statusLabel)}</strong></li>
        <li>Client : ${escapeHtml(opts.customerName)} (${escapeHtml(opts.customerEmail || '—')})</li>
        <li>Ville : ${escapeHtml(opts.city || '—')}</li>
      </ul>`,
    ctaUrl: `${opts.appUrl}/admin/commandes`,
    ctaLabel: 'Ouvrir l’admin',
  });
}

function buildVendorOrderHtml(opts: {
  name: string;
  orderNumber: string;
  total: number;
  statusLabel: string;
  appUrl: string;
  orderId: string;
}): string {
  return wrapHtml({
    brand: 'AfriZone Vendeur',
    brandBg: '#052e16',
    accent: '#00A651',
    name: opts.name || 'vendeur',
    title: 'Nouvelle commande',
    appUrl: opts.appUrl,
    bodyHtml: `<p style="margin:0 0 10px">Commande <strong>${escapeHtml(opts.orderNumber)}</strong> — ${opts.total.toLocaleString('fr-FR')} FCFA</p>
      <p style="margin:0 0 10px">Statut : <strong>${escapeHtml(opts.statusLabel)}</strong></p>
      <p style="margin:0">Préparez la commande rapidement pour le client.</p>`,
    ctaUrl: `${opts.appUrl}/vendeur/commandes/${opts.orderId}`,
    ctaLabel: 'Voir la commande',
  });
}

function buildGenericHtml(opts: {
  name: string;
  title: string;
  body: string;
  appUrl: string;
  link?: string | null;
  ctaLabel?: string | null;
  brand?: string;
  brandBg?: string;
  accent?: string;
}): string {
  const path = (opts.link || '').trim();
  const ctaUrl = path
    ? path.startsWith('http')
      ? path
      : `${opts.appUrl}${path.startsWith('/') ? '' : '/'}${path}`
    : undefined;
  return wrapHtml({
    brand: opts.brand || 'AfriZone',
    brandBg: opts.brandBg || '#111111',
    accent: opts.accent || '#FF6B00',
    name: opts.name || '',
    title: opts.title,
    appUrl: opts.appUrl,
    preheader: opts.title,
    bodyHtml: `<p style="white-space:pre-wrap;margin:0">${escapeHtml(opts.body)}</p>`,
    ctaUrl,
    ctaLabel: opts.ctaLabel || (ctaUrl ? 'Ouvrir' : undefined),
  });
}

async function sendViaRelay(opts: {
  to: string;
  subject: string;
  html: string;
  relayUrl: string;
  hookSecret: string;
}): Promise<{ ok: boolean; id?: string; error?: string; mode: 'smtp' }> {
  const res = await fetch(opts.relayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-email-hook-secret': opts.hookSecret,
    },
    body: JSON.stringify({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    id?: string;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      mode: 'smtp',
      error: data.error || `Relay HTTP ${res.status}`,
    };
  }
  return { ok: true, mode: 'smtp', id: data.id };
}

async function sendResend(opts: {
  to: string;
  subject: string;
  html: string;
  from: string;
  apiKey: string;
}): Promise<{ ok: boolean; id?: string; error?: string; mode: 'live' }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    return { ok: false, mode: 'live', error: data.message || `Resend HTTP ${res.status}` };
  }
  return { ok: true, mode: 'live', id: data.id };
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from: string;
  relayUrl: string;
  hookSecret: string;
  resendKey: string;
}): Promise<{ ok: boolean; id?: string; error?: string; mode: 'smtp' | 'live' | 'simulate' }> {
  if (opts.relayUrl) {
    const relayed = await sendViaRelay({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      relayUrl: opts.relayUrl,
      hookSecret: opts.hookSecret,
    });
    if (relayed.ok) return relayed;
    console.error('[order-emails] relay failed', relayed.error);
    if (!opts.resendKey) return relayed;
  }

  if (opts.resendKey) {
    return sendResend({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      from: opts.from,
      apiKey: opts.resendKey,
    });
  }

  console.log('[order-emails] simulate', opts.to, opts.subject);
  return { ok: true, mode: 'simulate', id: `sim-${Date.now()}` };
}

function isSyntheticEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith('@phone.afrizone.app'));
}

async function logEmail(admin: SupabaseClient, row: Record<string, unknown>): Promise<void> {
  await admin.from('email_logs').insert(row);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const hookSecret = Deno.env.get('EMAIL_HOOK_SECRET') || '';
    const incomingSecret =
      req.headers.get('x-email-hook-secret') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      '';

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const authOk =
      (hookSecret && incomingSecret === hookSecret) ||
      (serviceKey && incomingSecret === serviceKey);

    if (!authOk) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as {
      kind?: string;
      order_id?: string;
      event?: string;
      status?: string;
      subject?: string;
      title?: string;
      body?: string;
      link?: string | null;
      cta_label?: string | null;
      role?: string;
      user_ids?: string[];
      to_admins?: boolean;
      email?: string;
      confirm_url?: string;
      unsubscribe_url?: string;
      campaign_id?: string;
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Config Supabase manquante' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const appUrl = (Deno.env.get('APP_URL') || 'https://afrizones.com').replace(/\/$/, '');
    const from = Deno.env.get('EMAIL_FROM') || 'AfriZone <contact@afrizones.com>';
    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    const relayUrl = (Deno.env.get('MAIL_RELAY_URL') || 'https://afrizones.com/api/email/send').replace(
      /\/$/,
      ''
    );
    const results: Array<Record<string, unknown>> = [];
    const transportMode = relayUrl ? 'smtp' : resendKey ? 'live' : 'simulate';

    const send = (to: string, subject: string, html: string) =>
      sendEmail({
        to,
        subject,
        html,
        from,
        relayUrl,
        hookSecret,
        resendKey,
      });

    // ─── Mode générique ───────────────────────────────────────────
    if (body.kind === 'generic') {
      const event = body.event || 'info';
      const subject = (body.subject || body.title || 'AfriZone').trim();
      const title = (body.title || subject).trim();
      const textBody = (body.body || '').trim();
      const role = body.role || 'user';
      if (!subject || !textBody) {
        return new Response(JSON.stringify({ error: 'subject/title et body requis' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      type Recipient = { id: string; full_name: string | null; email: string | null; role: string };
      const recipients: Recipient[] = [];

      if (body.to_admins) {
        const { data: admins } = await admin
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('role', 'admin');
        for (const a of admins || []) {
          recipients.push(a as Recipient);
        }
      }

      if (body.user_ids?.length) {
        const { data: users } = await admin
          .from('profiles')
          .select('id, full_name, email, role')
          .in('id', body.user_ids);
        for (const u of users || []) {
          if (!recipients.some((r) => r.id === u.id)) {
            recipients.push(u as Recipient);
          }
        }
      }

      const brandBg =
        role === 'admin'
          ? '#111827'
          : role === 'vendor'
            ? '#052e16'
            : role === 'driver'
              ? '#0c1a3a'
              : '#111111';
      const brand =
        role === 'admin'
          ? 'AfriZone Admin'
          : role === 'vendor'
            ? 'AfriZone Vendeur'
            : role === 'driver'
              ? 'AfriZone Livreur'
              : 'AfriZone';
      const accent =
        role === 'vendor' ? '#00A651' : role === 'driver' ? '#2563EB' : '#FF6B00';

      for (const r of recipients) {
        const email = r.email;
        if (!email || isSyntheticEmail(email)) continue;
        const html = buildGenericHtml({
          name: r.full_name || '',
          title,
          body: textBody,
          appUrl,
          link: body.link,
          ctaLabel: body.cta_label,
          brand,
          brandBg,
          accent,
        });
        const sent = await send(email, subject, html);
        results.push({ role, to: email, ...sent });
        await logEmail(admin, {
          order_id: body.order_id || null,
          recipient: email,
          role,
          event,
          status: null,
          subject,
          success: sent.ok,
          provider_id: sent.id || null,
          error: sent.error || null,
          mode: sent.mode,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: transportMode,
          kind: 'generic',
          sent: results.length,
          results,
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Newsletter : confirmation double opt-in ──────────────────
    if (body.kind === 'newsletter_confirm') {
      const email = (body.email || '').trim().toLowerCase();
      const confirmUrl = (body.confirm_url || '').trim();
      if (!email || !confirmUrl) {
        return new Response(JSON.stringify({ error: 'email et confirm_url requis' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      const subject = 'AfriZone — Confirmez votre inscription à la newsletter';
      const html = buildNewsletterConfirmHtml({
        confirmUrl,
        unsubscribeUrl: body.unsubscribe_url || undefined,
        appUrl,
      });
      const sent = await send(email, subject, html);
      results.push({ role: 'newsletter', to: email, ...sent });
      await logEmail(admin, {
        order_id: null,
        recipient: email,
        role: 'newsletter',
        event: 'newsletter_confirm',
        status: null,
        subject,
        success: sent.ok,
        provider_id: sent.id || null,
        error: sent.error || null,
        mode: sent.mode,
      });
      return new Response(
        JSON.stringify({
          success: sent.ok,
          mode: transportMode,
          kind: 'newsletter_confirm',
          results,
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Newsletter : campagne ────────────────────────────────────
    if (body.kind === 'newsletter_campaign') {
      const campaignId = body.campaign_id;
      if (!campaignId) {
        return new Response(JSON.stringify({ error: 'campaign_id requis' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const { data: campaign, error: campErr } = await admin
        .from('newsletter_campaigns')
        .select('id, subject, title, body, cta_url, cta_label, status')
        .eq('id', campaignId)
        .maybeSingle();

      if (campErr || !campaign) {
        return new Response(
          JSON.stringify({ error: campErr?.message || 'Campagne introuvable' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { data: subscribers } = await admin
        .from('newsletter_subscribers')
        .select('id, email, unsubscribe_token')
        .eq('status', 'confirmed');

      let sentCount = 0;
      let failedCount = 0;
      const sendRows: Array<Record<string, unknown>> = [];

      for (const sub of subscribers || []) {
        const email = String(sub.email || '').trim().toLowerCase();
        if (!email || isSyntheticEmail(email)) continue;
        const unsubUrl = `${appUrl}/newsletter/desabonnement?token=${sub.unsubscribe_token}`;
        const html = buildNewsletterCampaignHtml({
          title: String(campaign.title),
          body: String(campaign.body),
          appUrl,
          ctaUrl: campaign.cta_url,
          ctaLabel: campaign.cta_label,
          unsubscribeUrl: unsubUrl,
        });
        const sent = await send(email, String(campaign.subject), html);
        results.push({ role: 'newsletter', to: email, ...sent });
        if (sent.ok) sentCount += 1;
        else failedCount += 1;
        sendRows.push({
          campaign_id: campaignId,
          subscriber_id: sub.id,
          email,
          success: sent.ok,
          provider_id: sent.id || null,
          error: sent.error || null,
        });
        await logEmail(admin, {
          order_id: null,
          recipient: email,
          role: 'newsletter',
          event: 'newsletter_campaign',
          status: null,
          subject: campaign.subject,
          success: sent.ok,
          provider_id: sent.id || null,
          error: sent.error || null,
          mode: sent.mode,
        });
      }

      if (sendRows.length) {
        await admin.from('newsletter_campaign_sends').insert(sendRows);
      }

      await admin
        .from('newsletter_campaigns')
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
          recipient_count: (subscribers || []).length,
          status: sentCount === 0 && failedCount > 0 ? 'failed' : 'sent',
          error: sentCount === 0 && failedCount > 0 ? 'Aucun envoi réussi' : null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({
          success: true,
          mode: transportMode,
          kind: 'newsletter_campaign',
          sent: sentCount,
          failed: failedCount,
          results,
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Mode commande ────────────────────────────────────────────
    const orderId = body.order_id;
    const event: OrderEvent = body.event === 'status_update' ? 'status_update' : 'purchase';
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'order_id requis' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select(
        'id, order_number, status, total, shipping_city, user_id, vendor_id, payment_status'
      )
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: orderErr?.message || 'Commande introuvable' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const status = String(body.status || order.status);
    const statusLabel = STATUS_LABELS[status] || status;

    const { data: customer } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', order.user_id)
      .maybeSingle();

    const { data: admins } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'admin');

    let vendorOwner: { id: string; full_name: string | null; email: string | null } | null = null;
    if (order.vendor_id) {
      const { data: vendor } = await admin
        .from('vendors')
        .select('user_id')
        .eq('id', order.vendor_id)
        .maybeSingle();
      if (vendor?.user_id) {
        const { data: vp } = await admin
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', vendor.user_id)
          .maybeSingle();
        vendorOwner = vp;
      }
    }

    const customerEmail = customer?.email as string | undefined;
    const customerName = (customer?.full_name as string) || 'Client';

    if (customerEmail && !isSyntheticEmail(customerEmail)) {
      const subject =
        event === 'purchase'
          ? `AfriZone — Paiement confirmé (${order.order_number})`
          : `AfriZone — ${statusLabel} (${order.order_number})`;
      const html = buildClientHtml({
        name: customerName,
        orderNumber: String(order.order_number),
        statusLabel,
        total: Number(order.total) || 0,
        event,
        appUrl,
        orderId: String(order.id),
      });
      const sent = await send(customerEmail, subject, html);
      results.push({ role: 'customer', to: customerEmail, ...sent });
      await logEmail(admin, {
        order_id: order.id,
        recipient: customerEmail,
        role: 'customer',
        event,
        status,
        subject,
        success: sent.ok,
        provider_id: sent.id || null,
        error: sent.error || null,
        mode: sent.mode,
      });
    }

    if (vendorOwner?.email && !isSyntheticEmail(vendorOwner.email)) {
      const subject =
        event === 'purchase'
          ? `AfriZone — Nouvelle commande ${order.order_number}`
          : `AfriZone — Commande ${order.order_number} : ${statusLabel}`;
      const html = buildVendorOrderHtml({
        name: vendorOwner.full_name || 'vendeur',
        orderNumber: String(order.order_number),
        total: Number(order.total) || 0,
        statusLabel,
        appUrl,
        orderId: String(order.id),
      });
      const sent = await send(vendorOwner.email, subject, html);
      results.push({ role: 'vendor', to: vendorOwner.email, ...sent });
      await logEmail(admin, {
        order_id: order.id,
        recipient: vendorOwner.email,
        role: 'vendor',
        event,
        status,
        subject,
        success: sent.ok,
        provider_id: sent.id || null,
        error: sent.error || null,
        mode: sent.mode,
      });
    }

    for (const a of admins || []) {
      const email = a.email as string | undefined;
      if (!email || isSyntheticEmail(email)) continue;
      const subject =
        event === 'purchase'
          ? `[Admin] Nouvel achat ${order.order_number}`
          : `[Admin] ${order.order_number} → ${statusLabel}`;
      const html = buildAdminHtml({
        orderNumber: String(order.order_number),
        statusLabel,
        total: Number(order.total) || 0,
        customerName,
        customerEmail: customerEmail || '',
        city: String(order.shipping_city || ''),
        event,
        appUrl,
      });
      const sent = await send(email, subject, html);
      results.push({ role: 'admin', to: email, ...sent });
      await logEmail(admin, {
        order_id: order.id,
        recipient: email,
        role: 'admin',
        event,
        status,
        subject,
        success: sent.ok,
        provider_id: sent.id || null,
        error: sent.error || null,
        mode: sent.mode,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: transportMode,
        kind: 'order',
        sent: results.length,
        results,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : 'Erreur email',
      }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
