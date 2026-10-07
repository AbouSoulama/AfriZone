// AfriZone — Emails transactionnels (commandes + plateforme)
// Deploy: supabase functions deploy order-emails --no-verify-jwt
// Secrets: RESEND_API_KEY, EMAIL_HOOK_SECRET, APP_URL, (optionnel) EMAIL_FROM
//          + SUPABASE_SERVICE_ROLE_KEY (injecté auto sur hosted)
//
// Modes :
// 1) Commande (legacy) : { order_id, event: purchase|status_update, status? }
// 2) Générique : { kind: 'generic', event, subject, title, body, link?,
//                  cta_label?, role?, order_id?, user_ids?: string[], to_admins?: boolean }

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
  name: string;
  title: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `<p style="margin-top:24px">
        <a href="${escapeHtml(opts.ctaUrl)}"
           style="background:#FF6B00;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">
          ${escapeHtml(opts.ctaLabel)}
        </a>
      </p>`
      : '';
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2937">
    <div style="background:${opts.brandBg};color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <strong style="font-size:18px">${escapeHtml(opts.brand)}</strong>
    </div>
    <div style="border:1px solid #E5E7EB;border-top:0;padding:24px;border-radius:0 0 12px 12px">
      <p>Bonjour ${escapeHtml(opts.name || '')},</p>
      <h2 style="margin:12px 0;font-size:20px">${escapeHtml(opts.title)}</h2>
      <div style="line-height:1.6">${opts.bodyHtml}</div>
      ${cta}
      <p style="margin-top:28px;font-size:12px;color:#6B7280">Cet email est automatique — AfriZone.</p>
    </div>
  </div>`;
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
    brandBg: '#FF6B00',
    name: opts.name || 'client',
    title,
    bodyHtml: `<p>Commande <strong>${escapeHtml(opts.orderNumber)}</strong> — ${opts.total.toLocaleString('fr-FR')} FCFA</p>
      <p>Statut : <strong>${escapeHtml(opts.statusLabel)}</strong></p>`,
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
    brandBg: '#1F2937',
    name: 'Admin',
    title,
    bodyHtml: `<ul style="padding-left:18px;line-height:1.7">
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
    brandBg: '#00A651',
    name: opts.name || 'vendeur',
    title: 'Nouvelle commande',
    bodyHtml: `<p>Commande <strong>${escapeHtml(opts.orderNumber)}</strong> — ${opts.total.toLocaleString('fr-FR')} FCFA</p>
      <p>Statut : <strong>${escapeHtml(opts.statusLabel)}</strong></p>
      <p>Préparez la commande rapidement pour le client.</p>`,
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
}): string {
  const path = (opts.link || '').trim();
  const ctaUrl = path
    ? path.startsWith('http')
      ? path
      : `${opts.appUrl}${path.startsWith('/') ? '' : '/'}${path}`
    : undefined;
  return wrapHtml({
    brand: opts.brand || 'AfriZone',
    brandBg: opts.brandBg || '#FF6B00',
    name: opts.name || '',
    title: opts.title,
    bodyHtml: `<p style="white-space:pre-wrap">${escapeHtml(opts.body)}</p>`,
    ctaUrl,
    ctaLabel: opts.ctaLabel || (ctaUrl ? 'Ouvrir' : undefined),
  });
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

async function logEmail(
  admin: SupabaseClient,
  row: Record<string, unknown>
): Promise<void> {
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
    // Auth stricte : secret hook OU service role (plus d’acceptation JWT quelconque)
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
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Config Supabase manquante' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const appUrl = (Deno.env.get('APP_URL') || 'https://afrizone.app').replace(/\/$/, '');
    const from = Deno.env.get('EMAIL_FROM') || 'AfriZone <onboarding@resend.dev>';
    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    const results: Array<Record<string, unknown>> = [];

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
          ? '#1F2937'
          : role === 'vendor'
            ? '#00A651'
            : role === 'driver'
              ? '#2563EB'
              : '#FF6B00';
      const brand =
        role === 'admin'
          ? 'AfriZone Admin'
          : role === 'vendor'
            ? 'AfriZone Vendeur'
            : role === 'driver'
              ? 'AfriZone Livreur'
              : 'AfriZone';

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
        });
        const sent = await sendResend({
          to: email,
          subject,
          html,
          from,
          apiKey: resendKey,
        });
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
          mode: resendKey ? 'live' : 'simulate',
          kind: 'generic',
          sent: results.length,
          results,
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Mode commande (legacy enrichi : client + admin + vendeur) ─
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
      const sent = await sendResend({
        to: customerEmail,
        subject,
        html,
        from,
        apiKey: resendKey,
      });
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
      const sent = await sendResend({
        to: vendorOwner.email,
        subject,
        html,
        from,
        apiKey: resendKey,
      });
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
      const sent = await sendResend({
        to: email,
        subject,
        html,
        from,
        apiKey: resendKey,
      });
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
        mode: resendKey ? 'live' : 'simulate',
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
