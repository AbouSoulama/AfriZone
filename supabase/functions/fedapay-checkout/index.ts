// AfriZone — Initiation et vérification FedaPay
// Deploy: supabase functions deploy fedapay-checkout
// Secrets: FEDAPAY_SECRET_KEY, APP_URL
// Optionnel: FEDAPAY_ENV=sandbox|live (sinon déduit du préfixe sk_live_)

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

function apiBase(secretKey: string, envOverride?: string | null): string {
  const env = (envOverride || '').toLowerCase();
  if (env === 'live' || secretKey.startsWith('sk_live')) {
    return 'https://api.fedapay.com/v1';
  }
  return 'https://sandbox-api.fedapay.com/v1';
}

function roundXof(amount: number): number {
  const n = Math.ceil(Number(amount) / 5) * 5;
  return Math.max(100, n);
}

function phoneCountryIso(country: string): string {
  const map: Record<string, string> = {
    SN: 'sn',
    BF: 'bf',
    ML: 'ml',
    CI: 'ci',
    BJ: 'bj',
    TG: 'tg',
    NE: 'ne',
  };
  return map[country.toUpperCase()] || 'bf';
}

/** FedaPay attend le numéro local SANS indicatif (ex. 70000000), pas +226… */
function localPhoneDigits(raw: string, country: string): string {
  let digits = raw.replace(/\D/g, '');
  const prefixes: Record<string, string> = {
    BF: '226',
    ML: '223',
    SN: '221',
    CI: '225',
    BJ: '229',
  };
  const cc = prefixes[country.toUpperCase()] || '226';
  if (digits.startsWith(cc)) digits = digits.slice(cc.length);
  digits = digits.replace(/^0+/, '');
  return digits;
}

function merchantTxId(): string {
  return `AZ${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`.slice(0, 40);
}

function isApprovedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'approved' || s === 'transferred';
}

/** FedaPay renvoie l’objet sous la clé littérale "v1/transaction". */
function unwrapTransaction(body: Record<string, unknown>): Record<string, unknown> {
  return (
    (body['v1/transaction'] as Record<string, unknown> | undefined) ||
    ((body.v1 as Record<string, unknown> | undefined)?.transaction as
      | Record<string, unknown>
      | undefined) ||
    (body.transaction as Record<string, unknown> | undefined) ||
    body
  );
}

function fedapayErrorMessage(body: Record<string, unknown>, fallback: string): string {
  const err = body.error as Record<string, unknown> | string | undefined;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object' && err.message) return String(err.message);
  if (body.message) return String(body.message);
  if (Array.isArray(body.errors) && body.errors[0]) return String(body.errors[0]);
  return fallback;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const secretKey = Deno.env.get('FEDAPAY_SECRET_KEY');
  if (!secretKey) {
    return json(
      {
        unavailable: true,
        error:
          'FedaPay n’est pas configuré. Ajoutez FEDAPAY_SECRET_KEY (sk_sandbox_…), ou remettez VITE_PAYMENT_MODE=simulate.',
      },
      200
    );
  }

  const base = apiBase(secretKey, Deno.env.get('FEDAPAY_ENV'));
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
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secretKey}`,
  };

  try {
    if (action === 'check') {
      const transactionId = String(payload.transactionId || '').trim();
      if (!transactionId) return json({ error: 'transactionId manquant.' }, 400);

      const { data: intent } = await userClient
        .from('payment_intents')
        .select('transaction_id, status, kind, order_ids, parcel_id, amount, operator_name')
        .eq('transaction_id', transactionId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!intent) return json({ error: 'Paiement introuvable.' }, 404);

      const fpId = String(intent.operator_name || '').replace(/^fp:/, '').trim();
      let fpStatus = intent.status;

      if (fpId) {
        const checkRes = await fetch(`${base}/transactions/${encodeURIComponent(fpId)}`, {
          headers: authHeaders,
        });
        const checkBody = (await checkRes.json().catch(() => ({}))) as Record<string, unknown>;
        const entity = unwrapTransaction(checkBody);
        fpStatus = String(entity?.status || fpStatus);

        if (isApprovedStatus(fpStatus) && intent.status !== 'paid') {
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          if (serviceKey) {
            const admin = createClient(supabaseUrl, serviceKey);
            await admin.rpc('complete_cinetpay_payment', {
              p_transaction_id: transactionId,
              p_operator: String(entity?.mode || 'fedapay'),
            });
          }
        }
      }

      return json({
        transactionId,
        status: isApprovedStatus(fpStatus) || intent.status === 'paid' ? 'paid' : intent.status,
        providerStatus: fpStatus,
        kind: intent.kind,
        orderIds: intent.order_ids,
        parcelId: intent.parcel_id,
        amount: intent.amount,
      });
    }

    const amount = roundXof(Number(payload.amount));
    const phoneRaw = String(payload.phone || '').trim();
    const provider = String(payload.provider || 'fedapay');
    const kind = payload.kind === 'parcel' ? 'parcel' : 'order';
    const transactionId = merchantTxId();
    const payCountry = (payload.country || 'BF').toUpperCase();

    if (!amount || amount < 100) return json({ error: 'Montant invalide.' }, 400);

    const appUrl = (payload.returnUrl || Deno.env.get('APP_URL') || '').replace(/\/$/, '');
    // FedaPay accepte souvent HTTPS ; en local on garde localhost pour le retour navigateur.
    const callbackUrl = appUrl.startsWith('http')
      ? `${appUrl}/paiement/retour?tx=${encodeURIComponent(transactionId)}`
      : undefined;

    const fullName = (payload.customerName || 'Client AfriZone').trim();
    const parts = fullName.split(/\s+/);
    const firstName = parts[0] || 'Client';
    const lastName = parts.slice(1).join(' ') || 'AfriZone';
    const email =
      (payload.customerEmail || user.email || 'client@afrizone.app').trim() ||
      'client@afrizone.app';

    const isSandbox =
      base.includes('sandbox') || secretKey.startsWith('sk_sandbox');

    const localPhone = phoneRaw ? localPhoneDigits(phoneRaw, payCountry) : '';
    const customer: Record<string, unknown> = {
      firstname: firstName.slice(0, 80),
      lastname: lastName.slice(0, 80),
      email,
    };
    // Sandbox : les numéros Momo Test (64000001 / 66000001) sont des numéros Bénin.
    // Prefill avec +226 (BF) fait échouer le paiement même avec le bon numéro.
    // On ne force pas le téléphone ; l’utilisateur saisit le numéro test sur FedaPay.
    if (!isSandbox && localPhone.length >= 8) {
      customer.phone_number = {
        number: localPhone,
        country: phoneCountryIso(payCountry),
      };
    }

    const createPayload: Record<string, unknown> = {
      description:
        kind === 'parcel'
          ? `Colis AfriZone ${transactionId}`
          : `Commande AfriZone ${transactionId}`,
      amount,
      currency: { iso: 'XOF' },
      custom_metadata: {
        merchant_transaction_id: transactionId,
        kind,
        provider,
        user_id: user.id,
      },
      customer,
    };
    if (callbackUrl) createPayload.callback_url = callbackUrl;

    const createRes = await fetch(`${base}/transactions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(createPayload),
    });

    const createBody = (await createRes.json().catch(() => ({}))) as Record<string, unknown>;
    const txEntity = unwrapTransaction(createBody);
    const fpTxId = txEntity?.id;

    if (!fpTxId) {
      const message = fedapayErrorMessage(
        createBody,
        'Impossible de créer la transaction FedaPay.'
      );
      console.error('[fedapay-checkout] create', createBody);
      return json({ error: String(message), details: createBody }, 502);
    }

    // La création renvoie déjà payment_url ; fallback sur /token si besoin
    let paymentUrl = String(txEntity.payment_url || '').trim() || undefined;
    if (!paymentUrl) {
      const tokenRes = await fetch(`${base}/transactions/${fpTxId}/token`, {
        method: 'POST',
        headers: authHeaders,
      });
      const tokenBody = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
      paymentUrl =
        String(tokenBody.url || '').trim() ||
        String((tokenBody['v1/token'] as Record<string, unknown> | undefined)?.url || '').trim() ||
        undefined;
      if (!paymentUrl && typeof tokenBody.token === 'string') {
        paymentUrl = `https://sandbox-process.fedapay.com/${tokenBody.token}`;
      }
      if (!paymentUrl) {
        console.error('[fedapay-checkout] token', tokenBody);
        return json(
          {
            error: fedapayErrorMessage(tokenBody, 'Lien de paiement FedaPay manquant.'),
            details: tokenBody,
          },
          502
        );
      }
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
      operator_name: `fp:${fpTxId}`,
    });

    if (insertError) {
      console.error('[fedapay-checkout] insert', insertError);
      return json({ error: insertError.message }, 500);
    }

    return json({
      success: true,
      transactionId,
      paymentUrl,
      amount,
      fedapayId: fpTxId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur FedaPay.';
    console.error('[fedapay-checkout]', message);
    return json({ error: message }, 500);
  }
});
