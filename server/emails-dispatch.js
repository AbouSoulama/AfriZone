import {
  STATUS_LABELS,
  buildAdminHtml,
  buildClientHtml,
  buildGenericHtml,
  buildNewsletterCampaignHtml,
  buildNewsletterConfirmHtml,
  buildVendorOrderHtml,
  roleBrand,
} from './email-templates.js';
import { getAdminClient } from './supabase-admin.js';

const APP_URL = (process.env.APP_URL || 'https://afrizones.com').replace(/\/$/, '');

function isSyntheticEmail(email) {
  return Boolean(email?.endsWith('@phone.afrizone.app'));
}

async function logEmail(admin, row) {
  try {
    await admin.from('email_logs').insert(row);
  } catch {
    /* ignore log errors */
  }
}

function requireHook(req, res) {
  const secret = process.env.EMAIL_HOOK_SECRET || '';
  if (!secret) return true;
  const got =
    req.header('x-email-hook-secret') ||
    (req.header('authorization') || '').replace(/^Bearer\s+/i, '');
  if (got !== secret) {
    res.status(401).json({ ok: false, error: 'Non autorisé' });
    return false;
  }
  return true;
}

/**
 * @param {import('express').Express} app
 * @param {{ sendSmtpMail: Function }} deps
 */
export function mountEmailDispatchRoutes(app, deps) {
  const { sendSmtpMail } = deps;

  async function send(to, subject, html) {
    const info = await sendSmtpMail({ to, subject, html });
    return { ok: true, id: info.messageId, mode: 'smtp' };
  }

  app.post('/emails/dispatch', async (req, res) => {
    if (!requireHook(req, res)) return;

    try {
      const body = req.body || {};
      const admin = getAdminClient();
      const results = [];

      // ── Newsletter confirm ──────────────────────────────────────
      if (body.kind === 'newsletter_confirm') {
        const email = String(body.email || '').trim().toLowerCase();
        const confirmUrl = String(body.confirm_url || '').trim();
        if (!email || !confirmUrl) {
          return res.status(400).json({ error: 'email et confirm_url requis' });
        }
        const subject = 'AfriZone — Confirmez votre inscription à la newsletter';
        const html = buildNewsletterConfirmHtml({
          confirmUrl,
          unsubscribeUrl: body.unsubscribe_url || undefined,
        });
        const sent = await send(email, subject, html);
        results.push({ role: 'newsletter', to: email, ...sent });
        await logEmail(admin, {
          recipient: email,
          role: 'newsletter',
          event: 'newsletter_confirm',
          subject,
          success: sent.ok,
          provider_id: sent.id || null,
          mode: sent.mode,
        });
        return res.json({ success: sent.ok, kind: 'newsletter_confirm', results });
      }

      // ── Newsletter campaign ─────────────────────────────────────
      if (body.kind === 'newsletter_campaign') {
        const campaignId = body.campaign_id;
        if (!campaignId) {
          return res.status(400).json({ error: 'campaign_id requis' });
        }
        const { data: campaign, error: campErr } = await admin
          .from('newsletter_campaigns')
          .select('id, subject, title, body, cta_url, cta_label')
          .eq('id', campaignId)
          .maybeSingle();
        if (campErr || !campaign) {
          return res.status(404).json({ error: campErr?.message || 'Campagne introuvable' });
        }

        const { data: subscribers } = await admin
          .from('newsletter_subscribers')
          .select('id, email, unsubscribe_token')
          .eq('status', 'confirmed');

        let sentCount = 0;
        let failedCount = 0;
        const sendRows = [];

        for (const sub of subscribers || []) {
          const email = String(sub.email || '').trim().toLowerCase();
          if (!email || isSyntheticEmail(email)) continue;
          const unsubUrl = `${APP_URL}/newsletter/desabonnement?token=${sub.unsubscribe_token}`;
          const html = buildNewsletterCampaignHtml({
            title: campaign.title,
            body: campaign.body,
            ctaUrl: campaign.cta_url,
            ctaLabel: campaign.cta_label,
            unsubscribeUrl: unsubUrl,
          });
          let sent;
          try {
            sent = await send(email, campaign.subject, html);
          } catch (e) {
            sent = {
              ok: false,
              error: e instanceof Error ? e.message : 'send failed',
              mode: 'smtp',
            };
          }
          results.push({ role: 'newsletter', to: email, ...sent });
          if (sent.ok) sentCount += 1;
          else failedCount += 1;
          sendRows.push({
            campaign_id: campaignId,
            subscriber_id: sub.id,
            email,
            success: !!sent.ok,
            provider_id: sent.id || null,
            error: sent.error || null,
          });
          await logEmail(admin, {
            recipient: email,
            role: 'newsletter',
            event: 'newsletter_campaign',
            subject: campaign.subject,
            success: !!sent.ok,
            provider_id: sent.id || null,
            error: sent.error || null,
            mode: sent.mode || 'smtp',
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

        return res.json({
          success: true,
          kind: 'newsletter_campaign',
          sent: sentCount,
          failed: failedCount,
          results,
        });
      }

      // ── Generic platform ────────────────────────────────────────
      if (body.kind === 'generic') {
        const event = body.event || 'info';
        const subject = String(body.subject || body.title || 'AfriZone').trim();
        const title = String(body.title || subject).trim();
        const textBody = String(body.body || '').trim();
        const role = body.role || 'user';
        if (!subject || !textBody) {
          return res.status(400).json({ error: 'subject/title et body requis' });
        }

        const recipients = [];
        if (body.to_admins) {
          const { data: admins } = await admin
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('role', 'admin');
          for (const a of admins || []) recipients.push(a);
        }
        if (body.user_ids?.length) {
          const { data: users } = await admin
            .from('profiles')
            .select('id, full_name, email, role')
            .in('id', body.user_ids);
          for (const u of users || []) {
            if (!recipients.some((r) => r.id === u.id)) recipients.push(u);
          }
        }

        const brand = roleBrand(role);
        for (const r of recipients) {
          const email = r.email;
          if (!email || isSyntheticEmail(email)) continue;
          const html = buildGenericHtml({
            ...brand,
            name: r.full_name || '',
            title,
            body: textBody,
            link: body.link,
            ctaLabel: body.cta_label,
          });
          const sent = await send(email, subject, html);
          results.push({ role, to: email, ...sent });
          await logEmail(admin, {
            order_id: body.order_id || null,
            recipient: email,
            role,
            event,
            subject,
            success: sent.ok,
            provider_id: sent.id || null,
            mode: sent.mode,
          });
        }
        return res.json({ success: true, kind: 'generic', sent: results.length, results });
      }

      // ── Order emails ────────────────────────────────────────────
      const orderId = body.order_id;
      const event = body.event === 'status_update' ? 'status_update' : 'purchase';
      if (!orderId) {
        return res.status(400).json({ error: 'order_id ou kind requis' });
      }

      const { data: order, error: orderErr } = await admin
        .from('orders')
        .select(
          'id, order_number, status, total, shipping_city, user_id, vendor_id, payment_status'
        )
        .eq('id', orderId)
        .maybeSingle();
      if (orderErr || !order) {
        return res.status(404).json({ error: orderErr?.message || 'Commande introuvable' });
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

      let vendorOwner = null;
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

      const customerEmail = customer?.email;
      const customerName = customer?.full_name || 'Client';

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
          mode: sent.mode,
        });
      }

      for (const a of admins || []) {
        const email = a.email;
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
          mode: sent.mode,
        });
      }

      return res.json({
        success: true,
        kind: 'order',
        sent: results.length,
        results,
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: e instanceof Error ? e.message : 'Erreur email',
      });
    }
  });
}
