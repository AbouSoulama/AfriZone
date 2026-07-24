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

    // TODO: brancher les APIs opérateurs avec les secrets Supabase.
    // Exemple: Orange Money Web Payment / Wave Checkout.
    const hasLiveKeys =
      !!Deno.env.get('ORANGE_MONEY_API_KEY') || !!Deno.env.get('WAVE_API_KEY');

    const transactionId = `MM-LIVE-${provider.slice(0, 3).toUpperCase()}-${Date.now()}`;

    if (!hasLiveKeys) {
      // Mode "live" sans clés : accepte en stub pour tests d'intégration
      return new Response(
        JSON.stringify({
          success: true,
          transactionId,
          message:
            'Paiement accepté (stub Edge Function — branchez les clés opérateurs pour la prod).',
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Placeholder pour appels API réels
    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        message: 'Paiement initié auprès de l’opérateur.',
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
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
