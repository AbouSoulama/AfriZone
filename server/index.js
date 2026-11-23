import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  wrapHtml,
  buildGenericHtml,
  previewGallery,
  roleBrand,
  LOGO_CID,
  LOGO_URL,
} from './email-templates.js';
import { mountMediaRoutes } from './media.js';
import { mountAssistantRoutes } from './assistant.js';
import { mountEmailDispatchRoutes } from './emails-dispatch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_CANDIDATES = [
  path.resolve(__dirname, '../public/logo-afrizone.png'),
  path.resolve('/var/www/afrizone.tech/logo-afrizone.png'),
  path.resolve(__dirname, 'logo-afrizone.png'),
];

function resolveLogoPath() {
  for (const p of LOGO_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

const app = express();
const PORT = Number(process.env.PORT || 8787);
const APP_URL = process.env.APP_URL || 'https://afrizones.com';

app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

function smtpReady() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function emailFrom() {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    `AfriZone <${process.env.SMTP_USER || 'contact@afrizones.com'}>`
  );
}

function requireEmailHook(req, res, next) {
  const secret = process.env.EMAIL_HOOK_SECRET;
  if (!secret) return next();
  const got = req.header('x-email-hook-secret') || '';
  if (got !== secret) {
    return res.status(401).json({ ok: false, error: 'Hook secret invalide.' });
  }
  return next();
}

async function sendSmtpMail({ to, subject, html, text }) {
  const transport = createTransport();
  const logoPath = resolveLogoPath();
  const attachments = logoPath
    ? [
        {
          filename: 'logo-afrizone.png',
          path: logoPath,
          cid: LOGO_CID,
          contentDisposition: 'inline',
        },
      ]
    : [];
  // Si pas de fichier local, replacer cid: par URL publique
  let finalHtml = html;
  if (!logoPath) {
    finalHtml = html.replaceAll(`cid:${LOGO_CID}`, LOGO_URL);
  }
  const info = await transport.sendMail({
    from: emailFrom(),
    to,
    subject,
    html: finalHtml,
    text:
      text ||
      String(subject || '') +
        '\n\nOuvrez cet e-mail en HTML pour voir le message AfriZone.',
    attachments,
    headers: {
      'X-AfriZone-Mail': '1',
    },
  });
  return info;
}

mountMediaRoutes(app);
mountAssistantRoutes(app);
mountEmailDispatchRoutes(app, { sendSmtpMail });

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'afrizone-api',
    appUrl: APP_URL,
    smtpConfigured: smtpReady(),
    emailFrom: emailFrom(),
    supabaseConfigured: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    aiConfigured: Boolean(process.env.AI_API_KEY),
    mediaRoot: process.env.MEDIA_ROOT || '/var/www/afrizone-media',
    paydunyaConfigured: Boolean(
      process.env.PAYDUNYA_MASTER_KEY &&
        process.env.PAYDUNYA_PRIVATE_KEY &&
        process.env.PAYDUNYA_TOKEN
    ),
    hosts: ['emails', 'media', 'assistant', 'payments'],
    time: new Date().toISOString(),
  });
});

/** Aperçu HTML des templates (auth hook si secret défini). */
app.get('/email/preview/:kind?', requireEmailHook, (req, res) => {
  const gallery = previewGallery();
  const kind = req.params.kind || 'client_purchase';
  const html = gallery[kind];
  if (!html) {
    return res.status(404).json({
      ok: false,
      error: 'Template inconnu',
      kinds: Object.keys(gallery),
    });
  }
  res.type('html').send(html);
});

/**
 * Relais SMTP utilisé par l’Edge Function order-emails.
 * Body: { to, subject, html, text? }
 */
app.post('/email/send', requireEmailHook, async (req, res) => {
  if (!smtpReady()) {
    return res.status(503).json({
      ok: false,
      error: 'SMTP non configuré sur le serveur AfriZone.',
    });
  }
  const to = String(req.body?.to || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const html = String(req.body?.html || '').trim();
  const text = req.body?.text ? String(req.body.text) : undefined;
  if (!to || !subject || !html) {
    return res.status(400).json({
      ok: false,
      error: 'Champs requis: to, subject, html',
    });
  }
  try {
    // Remplacer l’URL logo publique par CID pour affichage inline fiable
    const brandedHtml = String(html)
      .replaceAll(LOGO_URL, `cid:${LOGO_CID}`)
      .replaceAll('https://afrizones.com/logo-afrizone.png', `cid:${LOGO_CID}`)
      .replaceAll('http://afrizones.com/logo-afrizone.png', `cid:${LOGO_CID}`);
    const info = await sendSmtpMail({ to, subject, html: brandedHtml, text });
    return res.json({
      ok: true,
      mode: 'smtp',
      id: info.messageId,
      accepted: info.accepted,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Échec envoi e-mail',
    });
  }
});

app.post('/email/test', requireEmailHook, async (req, res) => {
  if (!smtpReady()) {
    return res.status(503).json({
      ok: false,
      error:
        'SMTP non configuré. Créez contact@afrizones.com dans hPanel Hostinger puis renseignez SMTP_PASS.',
    });
  }
  const to = String(req.body?.to || process.env.SMTP_USER || '').trim();
  const kind = String(req.body?.kind || 'branded').trim();
  if (!to) {
    return res.status(400).json({ ok: false, error: 'Destinataire manquant.' });
  }
  try {
    const gallery = previewGallery();
    let html;
    let subject = 'AfriZone — test e-mail';
    if (kind === 'branded' || !gallery[kind]) {
      html = wrapHtml({
        brand: 'AfriZone',
        brandBg: '#111111',
        accent: '#FF6B00',
        name: 'équipe',
        title: 'Test e-mail AfriZone',
        preheader: 'SMTP Hostinger opérationnel',
        bodyHtml: `<p style="margin:0 0 10px">L’envoi depuis <strong>contact@afrizones.com</strong> fonctionne.</p>
          <p style="margin:0">Site : <a href="${APP_URL}" style="color:#FF6B00">${APP_URL}</a></p>`,
        ctaUrl: APP_URL,
        ctaLabel: 'Ouvrir AfriZone',
      });
    } else {
      html = gallery[kind];
      subject = `AfriZone — aperçu ${kind}`;
    }
    const info = await sendSmtpMail({ to, subject, html });
    return res.json({ ok: true, messageId: info.messageId, kind });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Échec envoi e-mail',
    });
  }
});

/**
 * Envoi générique brandé (utile pour tests d’étapes sans Edge Function).
 * Body: { to, subject, title, body, link?, cta_label?, role? }
 */
app.post('/email/notify', requireEmailHook, async (req, res) => {
  if (!smtpReady()) {
    return res.status(503).json({ ok: false, error: 'SMTP non configuré.' });
  }
  const to = String(req.body?.to || '').trim();
  const subject = String(req.body?.subject || req.body?.title || 'AfriZone').trim();
  const title = String(req.body?.title || subject).trim();
  const body = String(req.body?.body || '').trim();
  const role = String(req.body?.role || 'user');
  if (!to || !body) {
    return res.status(400).json({ ok: false, error: 'to et body requis' });
  }
  const brand = roleBrand(role);
  const html = buildGenericHtml({
    ...brand,
    name: String(req.body?.name || ''),
    title,
    body,
    link: req.body?.link || null,
    ctaLabel: req.body?.cta_label || null,
  });
  try {
    const info = await sendSmtpMail({ to, subject, html });
    return res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Échec envoi',
    });
  }
});

/**
 * Paiement carte Visa/Mastercard via PayDunya (recommandé Afrique de l’Ouest).
 * Branchement complet dès que les clés marchand sont fournies.
 */
app.post('/payments/card/init', async (req, res) => {
  const master = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token = process.env.PAYDUNYA_TOKEN;
  if (!master || !privateKey || !token) {
    return res.status(503).json({
      ok: false,
      unavailable: true,
      provider: 'paydunya',
      error:
        'Paiement carte non branché. Créez un compte marchand PayDunya puis renseignez PAYDUNYA_* dans /var/www/afrizone-api/.env',
    });
  }

  const amount = Number(req.body?.amount);
  const description = String(req.body?.description || 'Paiement AfriZone').slice(0, 120);
  if (!amount || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'Montant invalide.' });
  }

  const mode = process.env.PAYDUNYA_MODE === 'live' ? 'live' : 'test';
  const base =
    mode === 'live' ? 'https://app.paydunya.com/api/v1' : 'https://app.paydunya.com/sandbox-api/v1';

  try {
    const response = await fetch(`${base}/checkout-invoice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': master,
        'PAYDUNYA-PRIVATE-KEY': privateKey,
        'PAYDUNYA-TOKEN': token,
      },
      body: JSON.stringify({
        invoice: {
          total_amount: amount,
          description,
        },
        store: {
          name: 'AfriZone',
          website_url: APP_URL,
        },
        actions: {
          cancel_url: `${APP_URL}/paiement/retour?status=cancel`,
          return_url: `${APP_URL}/paiement/retour?status=return`,
          callback_url: `${APP_URL}/api/payments/card/webhook`,
        },
      }),
    });
    const data = await response.json();
    if (!response.ok || data?.response_code !== '00') {
      return res.status(502).json({
        ok: false,
        error: data?.response_text || 'Échec initialisation PayDunya',
        provider: data,
      });
    }
    return res.json({
      ok: true,
      provider: 'paydunya',
      token: data.token,
      checkoutUrl: data.response_text,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Erreur paiement carte',
    });
  }
});

app.post('/payments/card/webhook', express.raw({ type: '*/*' }), (req, res) => {
  res.status(200).json({ ok: true, received: true });
});

app.post('/payments/mobile-money', async (req, res) => {
  const action = String(req.body?.action || 'charge').trim();
  if (action === 'check') {
    const transactionId = String(req.body?.transactionId || '').trim();
    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId requis' });
    }
    // Mode test : confirmé immédiatement. Live opérateur à brancher plus tard.
    if (transactionId.startsWith('MM-')) {
      return res.json({ status: 'paid', providerStatus: 'approved', transactionId });
    }
    return res.json({
      status: 'pending',
      providerStatus: 'pending',
      transactionId,
      message: 'Vérification opérateur non branchée.',
    });
  }

  const amount = Number(req.body?.amount);
  const phone = String(req.body?.phone || '').trim();
  if (!amount || amount <= 0 || phone.replace(/\D/g, '').length < 8) {
    return res.status(400).json({
      ok: false,
      error: 'Paramètres de paiement invalides.',
    });
  }
  return res.status(503).json({
    ok: false,
    unavailable: true,
    error:
      'Prélèvement Mobile Money non branché. Contrat marchand opérateur (ou PayDunya Mobile Money) requis.',
  });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route introuvable: ${req.method} ${req.path}` });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`AfriZone API listening on 127.0.0.1:${PORT}`);
});
