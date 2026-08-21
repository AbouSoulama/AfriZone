/**
 * Paiements AfriZone
 * - Wave (portefeuille indépendant)
 * - Mobile Money = opérateurs télécoms (Orange, Moov, MTN) — pas un moyen séparé
 */

import { supabase } from '../lib/supabase';

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

export interface StartCheckoutInput {
  amount: number;
  phone: string;
  provider: MobileMoneyProvider;
  kind: 'order' | 'parcel';
  orderIds?: string[];
  parcelId?: string;
  customerName?: string;
  customerEmail?: string | null;
  country?: string;
}

export interface StartCheckoutResult {
  mode: 'simulate' | 'live';
  transactionId: string;
  paymentUrl?: string;
  amount?: number;
}

export function isLivePayment(): boolean {
  return paymentMode() === 'live';
}

function paymentMode(): 'simulate' | 'live' {
  const mode = (import.meta.env.VITE_PAYMENT_MODE as string | undefined)?.toLowerCase();
  return mode === 'live' ? 'live' : 'simulate';
}

function appOrigin(): string {
  const fromEnv = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!token || !anon) throw new Error('Connectez-vous pour payer.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: anon,
  };
}

export async function startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  const phone = input.phone.trim();
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    throw new Error('Numéro de paiement invalide.');
  }
  if (!input.amount || input.amount <= 0) {
    throw new Error('Montant de paiement invalide.');
  }

  if (paymentMode() !== 'live') {
    const tx = makeTxId(input.provider);
    await new Promise((r) => setTimeout(r, 400));
    return { mode: 'simulate', transactionId: tx };
  }

  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) throw new Error('Configuration Supabase manquante.');

  const res = await fetch(`${base}/functions/v1/cinetpay-checkout`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      action: 'init',
      amount: input.amount,
      phone,
      provider: input.provider,
      kind: input.kind,
      orderIds: input.orderIds,
      parcelId: input.parcelId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      country: input.country,
      returnUrl: appOrigin(),
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    transactionId?: string;
    paymentUrl?: string;
    amount?: number;
    error?: string;
    unavailable?: boolean;
  };

  if (body.unavailable) {
    throw new Error(
      'CinetPay n’est pas encore configuré. Ajoutez CINETPAY_API_KEY et CINETPAY_API_PASSWORD (Ressources → API & sécurité), ou remettez VITE_PAYMENT_MODE=simulate.'
    );
  }
  if (!res.ok || !body.paymentUrl || !body.transactionId) {
    throw new Error(body.error || 'Impossible d’ouvrir la page de paiement.');
  }

  return {
    mode: 'live',
    transactionId: body.transactionId,
    paymentUrl: body.paymentUrl,
    amount: body.amount,
  };
}

export async function checkCheckout(transactionId: string): Promise<{
  status: string;
  cinetpayStatus?: string;
  kind?: string;
  orderIds?: string[];
  parcelId?: string | null;
}> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) throw new Error('Configuration Supabase manquante.');

  const res = await fetch(`${base}/functions/v1/cinetpay-checkout`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'check', transactionId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Vérification du paiement impossible.');
  return body;
}

function makeTxId(provider: MobileMoneyProvider): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MM-${provider.slice(0, 3).toUpperCase()}-${Date.now()}-${rand}`;
}

/** Simulation locale uniquement. Le parcours live passe par startCheckout → CinetPay. */
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

  await new Promise((r) => setTimeout(r, 500));
  const tx = makeTxId(input.provider);
  return {
    success: true,
    transactionId: tx,
    provider: input.provider,
    mode: 'simulate',
    message: `Paiement simulé confirmé (${tx}).`,
  };
}

export function providerLabel(id: string): string {
  if (id === 'wave') return 'Wave';
  if (id === 'mobile_money') return 'Mobile Money';
  return MOBILE_MONEY_OPERATORS.find((p) => p.id === id)?.label || 'Mobile Money';
}

export function channelFromProvider(provider: MobileMoneyProvider): PaymentChannel {
  return provider === 'wave' ? 'wave' : 'mobile_money';
}
