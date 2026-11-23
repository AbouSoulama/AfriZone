/** Templates HTML brandés AfriZone (emails transactionnels). */

const APP_URL = (process.env.APP_URL || 'https://afrizones.com').replace(/\/$/, '');
/** URL publique (secours) + CID pour affichage même si images distantes bloquées */
export const LOGO_URL = `${APP_URL}/logo-afrizone.png`;
export const LOGO_CID = 'afrizone-logo@afrizones.com';
const LOGO_SRC = `cid:${LOGO_CID}`;

export const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée (payée)',
  processing: 'En préparation',
  shipped: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{
 *   brand?: string,
 *   brandBg?: string,
 *   accent?: string,
 *   name?: string,
 *   title: string,
 *   bodyHtml: string,
 *   ctaUrl?: string,
 *   ctaLabel?: string,
 *   preheader?: string,
 * }} opts
 */
export function wrapHtml(opts) {
  const accent = opts.accent || '#FF6B00';
  const brandBg = opts.brandBg || '#111111';
  const brand = opts.brand || 'AfriZone';
  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `<tr>
          <td style="padding:8px 0 4px">
            <a href="${escapeHtml(opts.ctaUrl)}"
               style="display:inline-block;background:${accent};color:#ffffff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.2px">
              ${escapeHtml(opts.ctaLabel)}
            </a>
          </td>
        </tr>`
      : '';

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(opts.preheader)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;color:#1F2937">
  ${preheader}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6;padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB">
          <tr>
            <td style="background:${brandBg};padding:22px 24px 18px;text-align:center">
              <img src="${LOGO_SRC}" alt="AfriZone" width="168" style="display:block;margin:0 auto 10px;max-width:168px;height:auto;border:0" />
              <div style="color:#F9FAFB;font-size:13px;letter-spacing:0.4px;opacity:0.92">${escapeHtml(brand)}</div>
              <div style="color:#D1D5DB;font-size:11px;margin-top:4px;letter-spacing:1.2px;text-transform:uppercase">Achetez · Vendez · Expédiez</div>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#00A651 0%,#FF6B00 100%);font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px">
              <p style="margin:0 0 8px;font-size:15px;color:#4B5563">Bonjour ${escapeHtml(opts.name || '')},</p>
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827">${escapeHtml(opts.title)}</h1>
              <div style="font-size:15px;line-height:1.65;color:#374151">${opts.bodyHtml}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px">
              <table role="presentation" cellspacing="0" cellpadding="0">${cta}</table>
            </td>
          </tr>
          <tr>
            <td style="background:#FAFAFA;border-top:1px solid #E5E7EB;padding:18px 28px;text-align:center">
              <p style="margin:0 0 6px;font-size:12px;color:#6B7280">Message automatique envoyé par AfriZone · <a href="${APP_URL}" style="color:${accent};text-decoration:none">${APP_URL.replace(/^https?:\/\//, '')}</a></p>
              ${
                opts.unsubscribeUrl
                  ? `<p style="margin:8px 0 0;font-size:11px;color:#9CA3AF"><a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#6B7280;text-decoration:underline">Se désabonner</a></p>`
                  : `<p style="margin:0;font-size:11px;color:#9CA3AF">Ne répondez pas à cet e-mail pour un suivi de commande — utilisez l’application.</p>`
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildClientHtml(opts) {
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
    bodyHtml: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 4px;background:#FFF7ED;border:1px solid #FFEDD5;border-radius:12px">
        <tr><td style="padding:14px 16px">
          <p style="margin:0 0 6px">Commande <strong>${escapeHtml(opts.orderNumber)}</strong></p>
          <p style="margin:0 0 6px">Montant : <strong>${Number(opts.total).toLocaleString('fr-FR')} FCFA</strong></p>
          <p style="margin:0">Statut : <strong style="color:#C2410C">${escapeHtml(opts.statusLabel)}</strong></p>
        </td></tr>
      </table>`,
    ctaUrl: `${APP_URL}/commandes/${opts.orderId}`,
    ctaLabel: 'Voir ma commande',
  });
}

export function buildAdminHtml(opts) {
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
    bodyHtml: `<ul style="padding-left:18px;margin:8px 0;line-height:1.8">
        <li>N° : <strong>${escapeHtml(opts.orderNumber)}</strong></li>
        <li>Montant : <strong>${Number(opts.total).toLocaleString('fr-FR')} FCFA</strong></li>
        <li>Statut : <strong>${escapeHtml(opts.statusLabel)}</strong></li>
        <li>Client : ${escapeHtml(opts.customerName)} (${escapeHtml(opts.customerEmail || '—')})</li>
        <li>Ville : ${escapeHtml(opts.city || '—')}</li>
      </ul>`,
    ctaUrl: `${APP_URL}/admin/commandes`,
    ctaLabel: 'Ouvrir l’admin',
  });
}

export function buildVendorOrderHtml(opts) {
  return wrapHtml({
    brand: 'AfriZone Vendeur',
    brandBg: '#052e16',
    accent: '#00A651',
    name: opts.name || 'vendeur',
    title: 'Nouvelle commande',
    bodyHtml: `<p style="margin:0 0 10px">Commande <strong>${escapeHtml(opts.orderNumber)}</strong> — ${Number(opts.total).toLocaleString('fr-FR')} FCFA</p>
      <p style="margin:0 0 10px">Statut : <strong>${escapeHtml(opts.statusLabel)}</strong></p>
      <p style="margin:0">Préparez la commande rapidement pour le client.</p>`,
    ctaUrl: `${APP_URL}/vendeur/commandes/${opts.orderId}`,
    ctaLabel: 'Voir la commande',
  });
}

export function buildGenericHtml(opts) {
  const path = (opts.link || '').trim();
  const ctaUrl = path
    ? path.startsWith('http')
      ? path
      : `${APP_URL}${path.startsWith('/') ? '' : '/'}${path}`
    : undefined;
  return wrapHtml({
    brand: opts.brand || 'AfriZone',
    brandBg: opts.brandBg || '#111111',
    accent: opts.accent || '#FF6B00',
    name: opts.name || '',
    title: opts.title,
    preheader: opts.title,
    bodyHtml: `<p style="white-space:pre-wrap;margin:0">${escapeHtml(opts.body)}</p>`,
    ctaUrl,
    ctaLabel: opts.ctaLabel || (ctaUrl ? 'Ouvrir' : undefined),
  });
}

export function buildNewsletterConfirmHtml(opts) {
  return wrapHtml({
    brand: 'AfriZone Newsletter',
    brandBg: '#111111',
    accent: '#FF6B00',
    name: '',
    title: 'Confirmez votre inscription',
    preheader: 'Un clic pour activer la newsletter AfriZone',
    bodyHtml: `<p style="margin:0 0 10px">Merci de votre intérêt pour AfriZone.</p>
      <p style="margin:0">Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail et recevoir nos offres.</p>`,
    ctaUrl: opts.confirmUrl,
    ctaLabel: 'Confirmer mon inscription',
    unsubscribeUrl: opts.unsubscribeUrl,
  });
}

export function buildNewsletterCampaignHtml(opts) {
  const path = String(opts.ctaUrl || '').trim();
  const ctaUrl = path
    ? path.startsWith('http')
      ? path
      : `${APP_URL}${path.startsWith('/') ? '' : '/'}${path}`
    : undefined;
  return wrapHtml({
    brand: 'AfriZone Newsletter',
    brandBg: '#111111',
    accent: '#FF6B00',
    name: '',
    title: opts.title,
    preheader: opts.title,
    bodyHtml: `<p style="white-space:pre-wrap;margin:0">${escapeHtml(opts.body)}</p>`,
    ctaUrl,
    ctaLabel: opts.ctaLabel || (ctaUrl ? 'Découvrir' : undefined),
    unsubscribeUrl: opts.unsubscribeUrl,
  });
}

export function roleBrand(role) {
  if (role === 'admin') {
    return { brand: 'AfriZone Admin', brandBg: '#111827', accent: '#FF6B00' };
  }
  if (role === 'vendor') {
    return { brand: 'AfriZone Vendeur', brandBg: '#052e16', accent: '#00A651' };
  }
  if (role === 'driver') {
    return { brand: 'AfriZone Livreur', brandBg: '#0c1a3a', accent: '#2563EB' };
  }
  return { brand: 'AfriZone', brandBg: '#111111', accent: '#FF6B00' };
}

/** Aperçus pour tests manuels */
export function previewGallery() {
  return {
    client_purchase: buildClientHtml({
      name: 'Awa',
      orderNumber: 'AFZ-1001',
      statusLabel: STATUS_LABELS.confirmed,
      total: 25000,
      event: 'purchase',
      orderId: 'demo',
    }),
    vendor_order: buildVendorOrderHtml({
      name: 'Boutique Demo',
      orderNumber: 'AFZ-1001',
      total: 25000,
      statusLabel: STATUS_LABELS.confirmed,
      orderId: 'demo',
    }),
    admin_purchase: buildAdminHtml({
      orderNumber: 'AFZ-1001',
      statusLabel: STATUS_LABELS.confirmed,
      total: 25000,
      customerName: 'Awa',
      customerEmail: 'awa@example.com',
      city: 'Ouagadougou',
      event: 'purchase',
    }),
    generic_driver: buildGenericHtml({
      ...roleBrand('driver'),
      name: 'Moussa',
      title: 'Nouvelle course assignée',
      body: 'Une livraison vous a été assignée. Ouvrez l’app livreur pour accepter.',
      link: '/livreur',
      ctaLabel: 'Ouvrir l’app',
    }),
  };
}
