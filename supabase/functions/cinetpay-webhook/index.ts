// AfriZone — Webhook CinetPay API v1 (notify_url)
// Deploy: supabase functions deploy cinetpay-webhook --no-verify-jwt
// Secrets: CINETPAY_API_KEY, CINETPAY_API_PASSWORD

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function ok(): Response {
  return new Response('OK', { status: 200, headers: cors });
}

function apiBase(apiKey: string): string {
  return apiKey.startsWith('sk_live_')
    ? 'https://api.cinetpay.co'
    : 'https://api.cinetpay.net';
}

async function parseBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v != null) out[k] = String(v);
    }
    return out;
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

async function getAccessToken(base: string, apiKey: string, apiPassword: string): Promise<string> {
  const res = await fetch(`${base}/v1/oauth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, api_password: apiPassword }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body?.access_token) throw new Error('Auth CinetPay échouée');
  return body.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS' || req.method === 'GET') return ok();
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const apiKey = Deno.env.get('CINETPAY_API_KEY');
  const apiPassword = Deno.env.get('CINETPAY_API_PASSWORD');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!apiKey || !apiPassword || !serviceKey) {
    console.error('[cinetpay-webhook] secrets manquants');
    return ok();
  }

  const body = await parseBody(req);
  // API v1 : merchant_transaction_id / transaction_id
  // Ancien Checkout : cpm_trans_id
  const merchantTx =
    (body.merchant_transaction_id || body.cpm_trans_id || body.transaction_id || '').trim();
  const cinetpayTx = (body.transaction_id || '').trim();
  const lookupId = merchantTx || cinetpayTx;

  if (!lookupId) {
    console.error('[cinetpay-webhook] id manquant', body);
    return ok();
  }

  try {
    const base = apiBase(apiKey);
    const token = await getAccessToken(base, apiKey, apiPassword);
    const checkRes = await fetch(
      `${base}/v1/payment/${encodeURIComponent(lookupId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const checkBody = await checkRes.json().catch(() => ({}));
    const status = String(checkBody?.status || '').toUpperCase();

    if (status !== 'SUCCESS') {
      console.log('[cinetpay-webhook] ignore', lookupId, status);
      return ok();
    }

    // On confirme avec notre merchant_transaction_id (stocké dans payment_intents)
    const confirmId =
      String(checkBody?.merchant_transaction_id || merchantTx || lookupId).trim();

    const admin = createClient(supabaseUrl, serviceKey);
    const { error } = await admin.rpc('complete_cinetpay_payment', {
      p_transaction_id: confirmId,
      p_operator: checkBody?.payment_method || body.payment_method || null,
    });
    if (error) console.error('[cinetpay-webhook] rpc', error);
  } catch (e) {
    console.error('[cinetpay-webhook]', e);
  }

  return ok();
});
