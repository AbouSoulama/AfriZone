// AfriZone — Webhook FedaPay (transaction.approved / transferred)
// Deploy: supabase functions deploy fedapay-webhook --no-verify-jwt
// Secrets: FEDAPAY_SECRET_KEY
// Dashboard FedaPay → Webhooks → URL = https://<project>.supabase.co/functions/v1/fedapay-webhook
// Events: transaction.approved, transaction.transferred (recommandé)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-fedapay-signature',
};

function ok(body: Record<string, unknown> = { received: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
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

function isApprovedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'approved' || s === 'transferred';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS' || req.method === 'GET') return ok();
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const secretKey = Deno.env.get('FEDAPAY_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!secretKey || !serviceKey) {
    console.error('[fedapay-webhook] secrets manquants');
    return ok({ received: true, skipped: true });
  }

  const raw = await req.text();
  let event: Record<string, unknown> = {};
  try {
    event = JSON.parse(raw || '{}');
  } catch {
    console.error('[fedapay-webhook] JSON invalide');
    return ok();
  }

  const eventName = String(
    event.name || event.type || event.event || ''
  ).toLowerCase();

  /** FedaPay renvoie l’objet sous "v1/transaction". */
  const entity =
    (event['v1/transaction'] as Record<string, unknown> | undefined) ||
    (event.entity as Record<string, unknown> | undefined) ||
    (event.data as Record<string, unknown> | undefined) ||
    (event.transaction as Record<string, unknown> | undefined) ||
    event;

  const fpId = String(entity.id || event.transaction_id || '').trim();
  const meta =
    (entity.custom_metadata as Record<string, unknown> | undefined) ||
    (entity.metadata as Record<string, unknown> | undefined) ||
    {};
  let merchantTx = String(
    meta.merchant_transaction_id || meta.merchantTransactionId || ''
  ).trim();

  // Toujours re-vérifier auprès de l’API (ne pas faire confiance au seul payload)
  try {
    const base = apiBase(secretKey, Deno.env.get('FEDAPAY_ENV'));
    if (fpId) {
      const checkRes = await fetch(`${base}/transactions/${encodeURIComponent(fpId)}`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });
      const checkBody = await checkRes.json().catch(() => ({}));
      const tx =
        checkBody?.['v1/transaction'] ||
        checkBody?.v1?.transaction ||
        checkBody?.transaction ||
        checkBody;
      const status = String(tx?.status || '');
      const txMeta = (tx?.custom_metadata || {}) as Record<string, unknown>;
      merchantTx =
        String(txMeta.merchant_transaction_id || merchantTx || '').trim();

      if (!isApprovedStatus(status)) {
        console.log('[fedapay-webhook] ignore', eventName, fpId, status);
        return ok({ received: true, status });
      }

      if (!merchantTx) {
        // Fallback : retrouver l’intent via operator_name = fp:{id}
        const adminLookup = createClient(supabaseUrl, serviceKey);
        const { data: intent } = await adminLookup
          .from('payment_intents')
          .select('transaction_id')
          .eq('operator_name', `fp:${fpId}`)
          .maybeSingle();
        merchantTx = String(intent?.transaction_id || '').trim();
      }

      if (!merchantTx) {
        console.error('[fedapay-webhook] merchant_transaction_id manquant', fpId);
        return ok({ received: true, error: 'no_merchant_id' });
      }

      const admin = createClient(supabaseUrl, serviceKey);
      const { error } = await admin.rpc('complete_cinetpay_payment', {
        p_transaction_id: merchantTx,
        p_operator: String(tx?.mode || tx?.payment_method || 'fedapay'),
      });
      if (error) console.error('[fedapay-webhook] rpc', error);
      else console.log('[fedapay-webhook] paid', merchantTx, fpId);
    } else if (
      eventName.includes('approved') ||
      eventName.includes('transferred')
    ) {
      console.error('[fedapay-webhook] id manquant', event);
    }
  } catch (e) {
    console.error('[fedapay-webhook]', e);
  }

  return ok();
});
