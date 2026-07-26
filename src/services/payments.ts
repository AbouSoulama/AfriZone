/**
 * Paiements AfriZone
 * - Wave (portefeuille indépendant)
 * - Mobile Money = opérateurs télécoms (Orange, Moov, MTN) — pas un moyen séparé
 */

export type PaymentChannel = 'mobile_money' | 'wave';
export type MobileMoneyOperator = 'orange_money' | 'moov_money' | 'mtn_money';
/** Valeur persistée en base sur orders.payment_method */
export type MobileMoneyProvider = MobileMoneyOperator | 'wave';

export interface PaymentProviderOption {
  id: MobileMoneyProvider;
  label: string;
  hint: string;
}

export interface MobileMoneyOperatorOption {
  id: MobileMoneyOperator;
  label: string;
  hint: string;
}

export interface PaymentChannelOption {
  id: PaymentChannel;
  label: string;
  hint: string;
}

export const PAYMENT_CHANNELS: PaymentChannelOption[] = [
  {
    id: 'mobile_money',
    label: 'Mobile Money',
    hint: 'Orange · Moov · MTN',
  },
  {
    id: 'wave',
    label: 'Wave',
    hint: 'SN · CI',
  },
];

/** Opérateurs sous la catégorie Mobile Money */
export const MOBILE_MONEY_OPERATORS: MobileMoneyOperatorOption[] = [
  { id: 'orange_money', label: 'Orange Money', hint: 'SN · BF · ML' },
  { id: 'moov_money', label: 'Moov Money', hint: 'BF · ML' },
  { id: 'mtn_money', label: 'MTN Money', hint: 'CI · GH' },
];

/** @deprecated utiliser PAYMENT_CHANNELS + MOBILE_MONEY_OPERATORS */
export const MOBILE_MONEY_PROVIDERS: PaymentProviderOption[] = [
  ...MOBILE_MONEY_OPERATORS,
  { id: 'wave', label: 'Wave', hint: 'SN · CI' },
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
    throw new Error(body.error || body.message || 'Échec du paiement.');
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
    throw new Error('Numéro de paiement invalide.');
  }
  if (!input.amount || input.amount <= 0) {
    throw new Error('Montant de paiement invalide.');
  }

  if (paymentMode() === 'live') {
    try {
      return await chargeLive(input);
    } catch (e) {
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
  if (id === 'wave') return 'Wave';
  if (id === 'mobile_money') return 'Mobile Money';
  return MOBILE_MONEY_OPERATORS.find((p) => p.id === id)?.label || 'Mobile Money';
}

export function channelFromProvider(provider: MobileMoneyProvider): PaymentChannel {
  return provider === 'wave' ? 'wave' : 'mobile_money';
}
