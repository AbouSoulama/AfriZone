// AfriZone — Edge Function Mobile Money
// Deploy: supabase functions deploy mobile-money
// Secrets: ORANGE_MONEY_API_KEY, WAVE_API_KEY, etc.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json();
    const amount = Number(body.amount);
    const phone = String(body.phone || '').trim();
    const provider = String(body.provider || 'orange_money');

    if (!amount || amount <= 0 || phone.replace(/\D/g, '').length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'Paramètres de paiement invalides.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Ne jamais confirmer un paiement sans appel réel à l'opérateur.
    // Chaque pays a son contrat : Orange BF ≠ Orange ML ≠ Orange SN ≠ Orange GN, etc.
    void provider;
    return new Response(
      JSON.stringify({
        success: false,
        unavailable: true,
        error:
          'Prélèvement opérateur non branché. Il faut un contrat marchand (Orange, Moov, Telecel, Malitel ou MTN) et les clés API correspondantes.',
      }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : 'Erreur serveur paiement',
      }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
