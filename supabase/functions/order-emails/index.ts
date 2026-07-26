// AfriZone — Emails transactionnels commandes (client + admin)
// Deploy: supabase functions deploy order-emails --no-verify-jwt
// Secrets: RESEND_API_KEY, EMAIL_HOOK_SECRET, (optionnel) EMAIL_FROM
//          + SUPABASE_SERVICE_ROLE_KEY (injecté auto sur hosted)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2937">
    <div style="background:#FF6B00;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <strong style="font-size:18px">AfriZone</strong>
    </div>
    <div style="border:1px solid #E5E7EB;border-top:0;padding:24px;border-radius:0 0 12px 12px">
      <p>Bonjour ${escapeHtml(opts.name || 'client')},</p>
      <h2 style="margin:12px 0;font-size:20px">${escapeHtml(title)}</h2>
      <p>Commande <strong>${escapeHtml(opts.orderNumber)}</strong> — ${opts.total.toLocaleString('fr-FR')} FCFA</p>
      <p>Statut : <strong>${escapeHtml(opts.statusLabel)}</strong></p>
      <p style="margin-top:24px">
        <a href="${escapeHtml(opts.appUrl)}/commandes/${escapeHtml(opts.orderId)}"
           style="background:#FF6B00;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">
          Voir ma commande
        </a>
      </p>
      <p style="margin-top:28px;font-size:12px;color:#6B7280">Cet email est automatique — AfriZone.</p>
    </div>
  </div>`;
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
  orderId: string;
}): string {
  const title =
    opts.event === 'purchase'
      ? 'Nouvel achat payé'
      : `Mise à jour commande — ${opts.statusLabel}`;
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2937">
    <div style="background:#1F2937;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <strong style="font-size:18px">AfriZone Admin</strong>
    </div>
    <div style="border:1px solid #E5E7EB;border-top:0;padding:24px;border-radius:0 0 12px 12px">
      <h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(title)}</h2>
      <ul style="padding-left:18px;line-height:1.7">
        <li>N° : <strong>${escapeHtml(opts.orderNumber)}</strong></li>
        <li>Montant : <strong>${opts.total.toLocaleString('fr-FR')} FCFA</strong></li>
        <li>Statut : <strong>${escapeHtml(opts.statusLabel)}</strong></li>
        <li>Client : ${escapeHtml(opts.customerName)} (${escapeHtml(opts.customerEmail || '—')})</li>
        <li>Ville : ${escapeHtml(opts.city || '—')}</li>
      </ul>
      <p style="margin-top:24px">
        <a href="${escapeHtml(opts.appUrl)}/admin/commandes"
           style="background:#FF6B00;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">
          Ouvrir l’admin
        </a>
      </p>
    </div>
  </div>`;
}

async function sendResend(opts: {
  to: string;
  subject: string;
  html: string;
  from: string;
  apiKey: string;
}): Promise<{ ok: boolean; id?: string; error?: string; mode: 'live' | 'simulate' }> {
  if (!opts.apiKey) {
    console.log('[order-emails] simulate', opts.to, opts.subject);
    return { ok: true, mode: 'simulate', id: `sim-${Date.now()}` };
  }

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

function isSyntheticEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith('@phone.afrizone.app'));
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

    // Autorise : secret dédié, service role, ou JWT utilisateur (appel front)
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authOk =
      (hookSecret && incomingSecret === hookSecret) ||
      (serviceKey && incomingSecret === serviceKey) ||
      (anonKey && incomingSecret === anonKey) ||
      Boolean(req.headers.get('authorization'));

    if (!authOk) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as {
      order_id?: string;
      event?: OrderEvent;
      status?: string;
    };

    const orderId = body.order_id;
    const event: OrderEvent = body.event === 'status_update' ? 'status_update' : 'purchase';
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'order_id requis' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Config Supabase manquante' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select(
        'id, order_number, status, total, shipping_city, user_id, payment_status'
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

    const appUrl = (Deno.env.get('APP_URL') || 'https://afrizone.app').replace(/\/$/, '');
    const from =
      Deno.env.get('EMAIL_FROM') || 'AfriZone <onboarding@resend.dev>';
    const resendKey = Deno.env.get('RESEND_API_KEY') || '';

    const results: Array<Record<string, unknown>> = [];
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
      const sent = await sendResend({
        to: customerEmail,
        subject,
        html,
        from,
        apiKey: resendKey,
      });
      results.push({ role: 'customer', to: customerEmail, ...sent });
      await admin.from('email_logs').insert({
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
        orderId: String(order.id),
      });
      const sent = await sendResend({
        to: email,
        subject,
        html,
        from,
        apiKey: resendKey,
      });
      results.push({ role: 'admin', to: email, ...sent });
      await admin.from('email_logs').insert({
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
        mode: resendKey ? 'live' : 'simulate',
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
