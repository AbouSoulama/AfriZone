// AfriZone — Initiation et vérification CinetPay (API v1 / panel.cinetpay.net)
// Deploy: supabase functions deploy cinetpay-checkout
// Secrets: CINETPAY_API_KEY, CINETPAY_API_PASSWORD, CINETPAY_COUNTRY (défaut BF), APP_URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function apiBase(apiKey: string): string {
  return apiKey.startsWith('sk_live_')
    ? 'https://api.cinetpay.co'
    : 'https://api.cinetpay.net';
}

function roundXof(amount: number): number {
  const n = Math.ceil(Number(amount) / 5) * 5;
  return Math.max(100, n);
}

/** CinetPay exige un téléphone international (+226…, +221…). */
function toIntlPhone(raw: string, country: string): string {
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  const prefixes: Record<string, string> = {
    BF: '226',
    ML: '223',
    SN: '221',
    CI: '225',
  };
  const cc = prefixes[country.toUpperCase()] || '226';
  if (digits.startsWith(cc)) return `+${digits}`;
  return `+${cc}${digits.replace(/^0+/, '')}`;
}

async function getAccessToken(base: string, apiKey: string, apiPassword: string): Promise<string> {
  const res = await fetch(`${base}/v1/oauth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, api_password: apiPassword }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body?.access_token) {
    throw new Error(
      body?.status || body?.message || 'Authentification CinetPay échouée (vérifiez API Key + mot de passe API).'
    );
  }
  return body.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const apiKey = Deno.env.get('CINETPAY_API_KEY');
  const apiPassword = Deno.env.get('CINETPAY_API_PASSWORD');
  const country = (Deno.env.get('CINETPAY_COUNTRY') || 'BF').toUpperCase();

  if (!apiKey || !apiPassword) {
    return json(
      {
        unavailable: true,
        error:
          'CinetPay n’est pas configuré. Ajoutez CINETPAY_API_KEY et CINETPAY_API_PASSWORD (Ressources → API & sécurité), ou remettez VITE_PAYMENT_MODE=simulate.',
      },
      200
    );
  }

  const base = apiBase(apiKey);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Authentification requise.' }, 401);

  let payload: {
    action?: string;
    amount?: number;
    phone?: string;
    provider?: string;
    kind?: 'order' | 'parcel';
    orderIds?: string[];
    parcelId?: string;
    transactionId?: string;
    customerName?: string;
    customerEmail?: string;
    country?: string;
    returnUrl?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  const action = payload.action || 'init';

  try {
    if (action === 'check') {
      const transactionId = String(payload.transactionId || '').trim();
      if (!transactionId) return json({ error: 'transactionId manquant.' }, 400);

      const { data: intent } = await userClient
        .from('payment_intents')
        .select('transaction_id, status, kind, order_ids, parcel_id, amount')
        .eq('transaction_id', transactionId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!intent) return json({ error: 'Paiement introuvable.' }, 404);

      const token = await getAccessToken(base, apiKey, apiPassword);
      const checkRes = await fetch(
        `${base}/v1/payment/${encodeURIComponent(transactionId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const checkBody = await checkRes.json().catch(() => ({}));
      const status = String(checkBody?.status || intent.status).toUpperCase();

      if (status === 'SUCCESS' && intent.status !== 'paid') {
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        if (serviceKey) {
          const admin = createClient(supabaseUrl, serviceKey);
          await admin.rpc('complete_cinetpay_payment', {
            p_transaction_id: transactionId,
            p_operator: checkBody?.payment_method || null,
          });
        }
      }

      return json({
        transactionId,
        status: status === 'SUCCESS' ? 'paid' : intent.status,
        cinetpayStatus: status,
        kind: intent.kind,
        orderIds: intent.order_ids,
        parcelId: intent.parcel_id,
        amount: intent.amount,
      });
    }

    const amount = roundXof(Number(payload.amount));
    const phoneRaw = String(payload.phone || '').trim();
    const provider = String(payload.provider || 'orange_money');
    const kind = payload.kind === 'parcel' ? 'parcel' : 'order';
    // Max 30 caractères (contrainte API v1)
    const transactionId = `AZ${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`.slice(0, 30);

    if (!phoneRaw || phoneRaw.replace(/\D/g, '').length < 8) {
      return json({ error: 'Numéro de paiement invalide.' }, 400);
    }
    if (!amount || amount < 100) return json({ error: 'Montant invalide.' }, 400);

    const appUrl = (payload.returnUrl || Deno.env.get('APP_URL') || '').replace(/\/$/, '');
    if (!appUrl.startsWith('http')) {
      return json({ error: 'URL de retour manquante (APP_URL).' }, 400);
    }

    const payCountry = (payload.country || country).toUpperCase();
    const phone = toIntlPhone(phoneRaw, payCountry);
    const notifyUrl = `${supabaseUrl}/functions/v1/cinetpay-webhook`;
    const returnUrl = `${appUrl}/paiement/retour?tx=${encodeURIComponent(transactionId)}`;
    const failedUrl = `${appUrl}/paiement/retour?tx=${encodeURIComponent(transactionId)}&failed=1`;

    if (notifyUrl.length > 120 || returnUrl.length > 120) {
      return json(
        {
          error:
            'URL trop longue pour CinetPay (max 120). Raccourcissez APP_URL / le projet Supabase si besoin.',
        },
        400
      );
    }

    const fullName = (payload.customerName || 'Client AfriZone').trim();
    const parts = fullName.split(/\s+/);
    const firstName = (parts[0] || 'Client').slice(0, 255);
    const lastName = (parts.slice(1).join(' ') || 'AfriZone').slice(0, 255);
    const email =
      (payload.customerEmail || user.email || 'client@afrizone.app').trim() ||
      'client@afrizone.app';

    const token = await getAccessToken(base, apiKey, apiPassword);
    const initRes = await fetch(`${base}/v1/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currency: 'XOF',
        merchant_transaction_id: transactionId,
        amount,
        lang: 'fr',
        designation: kind === 'parcel' ? 'Envoi de colis AfriZone' : 'Commande AfriZone',
        client_email: email,
        client_first_name: firstName,
        client_last_name: lastName,
        client_phone_number: phone,
        success_url: returnUrl,
        failed_url: failedUrl,
        notify_url: notifyUrl,
        channel: 'PUSH',
        direct_pay: false,
      }),
    });

    const initBody = await initRes.json().catch(() => ({}));
    const paymentUrl = initBody?.payment_url as string | undefined;
    if (!paymentUrl) {
      const message =
        initBody?.message ||
        initBody?.status ||
        initBody?.description ||
        'Impossible d’ouvrir la page CinetPay.';
      console.error('[cinetpay-checkout]', initBody);
      return json({ error: message, details: initBody }, 502);
    }

    const { error: insertError } = await userClient.from('payment_intents').insert({
      transaction_id: transactionId,
      user_id: user.id,
      kind,
      amount,
      currency: 'XOF',
      provider,
      status: 'pending',
      order_ids: payload.orderIds || [],
      parcel_id: payload.parcelId || null,
      payment_url: paymentUrl,
      operator_name: initBody?.payment_token ? String(initBody.payment_token).slice(0, 64) : null,
    });

    if (insertError) {
      console.error('[cinetpay-checkout] insert', insertError);
      return json({ error: insertError.message }, 500);
    }

    return json({
      success: true,
      transactionId,
      paymentUrl,
      amount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur CinetPay.';
    console.error('[cinetpay-checkout]', message);
    return json({ error: message }, 500);
  }
});
