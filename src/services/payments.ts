/**
 * Paiement Mobile Money — couche prête pour Orange / Wave.
 * Mode par défaut : simulation (MVP).
 * Mode live : appelle l'Edge Function Supabase `mobile-money` si configurée.
 */

export type MobileMoneyProvider = 'orange_money' | 'wave' | 'moov_money';

export interface PaymentProviderOption {
  id: MobileMoneyProvider;
  label: string;
  hint: string;
}

export const MOBILE_MONEY_PROVIDERS: PaymentProviderOption[] = [
  { id: 'orange_money', label: 'Orange Money', hint: 'SN · BF · ML' },
  { id: 'wave', label: 'Wave', hint: 'SN · CI' },
  { id: 'moov_money', label: 'Moov Money', hint: 'BF · ML' },
];

export interface ChargeMobileMoneyInput {
  amount: number;
  currency?: string;
  phone: string;
  provider: MobileMoneyProvider;
  orderRef?: string;
}

export interface ChargeMobileMoneyResult {
  success: boolean;
  transactionId: string;
  provider: MobileMoneyProvider;
  mode: 'simulate' | 'live';
  message: string;
}

function paymentMode(): 'simulate' | 'live' {
  const mode = (import.meta.env.VITE_PAYMENT_MODE as string | undefined)?.toLowerCase();
  return mode === 'live' ? 'live' : 'simulate';
}

function makeTxId(provider: MobileMoneyProvider): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MM-${provider.slice(0, 3).toUpperCase()}-${Date.now()}-${rand}`;
}

async function chargeLive(input: ChargeMobileMoneyInput): Promise<ChargeMobileMoneyResult> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon) {
    throw new Error('Configuration Supabase manquante pour le paiement live.');
  }

  const res = await fetch(`${base}/functions/v1/mobile-money`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency || 'XOF',
      phone: input.phone,
      provider: input.provider,
      orderRef: input.orderRef,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    transactionId?: string;
    message?: string;
    error?: string;
  };

  if (!res.ok || !body.success) {
    throw new Error(body.error || body.message || 'Échec du paiement Mobile Money.');
  }

  return {
    success: true,
    transactionId: body.transactionId || makeTxId(input.provider),
    provider: input.provider,
    mode: 'live',
    message: body.message || 'Paiement confirmé.',
  };
}

async function chargeSimulate(
  input: ChargeMobileMoneyInput
): Promise<ChargeMobileMoneyResult> {
  // Petite latence pour simuler le push USSD / validation
  await new Promise((r) => setTimeout(r, 600));
  const tx = makeTxId(input.provider);
  return {
    success: true,
    transactionId: tx,
    provider: input.provider,
    mode: 'simulate',
    message: `Paiement simulé confirmé (${tx}).`,
  };
}

export async function chargeMobileMoney(
  input: ChargeMobileMoneyInput
): Promise<ChargeMobileMoneyResult> {
  const phone = input.phone.trim();
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    throw new Error('Numéro Mobile Money invalide.');
  }
  if (!input.amount || input.amount <= 0) {
    throw new Error('Montant de paiement invalide.');
  }

  if (paymentMode() === 'live') {
    try {
      return await chargeLive(input);
    } catch (e) {
      // Fallback explicite si la fonction n'est pas déployée
      const msg = e instanceof Error ? e.message : 'Erreur paiement';
      if (msg.includes('Failed to fetch') || msg.includes('404') || msg.includes('FunctionsRelayError')) {
        throw new Error(
          'Paiement live indisponible : déployez la Edge Function mobile-money ou repassez en VITE_PAYMENT_MODE=simulate.'
        );
      }
      throw e;
    }
  }

  return chargeSimulate(input);
}

export function providerLabel(id: string): string {
  return MOBILE_MONEY_PROVIDERS.find((p) => p.id === id)?.label || 'Mobile Money';
}
