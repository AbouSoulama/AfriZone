/**
 * Paiements AfriZone — opérateurs télécoms par pays (Orange, Moov, Telecel, Malitel, MTN).
 * Le choix est enregistré sur la commande. L’encaissement réel exige un contrat marchand
 * chez chaque opérateur : sans clés API, le mode live refuse le paiement au lieu de le simuler.
 */
import { paymentMethodLabel } from '../data/country-payments';

import { supabase } from '../lib/supabase';

export type PaymentChannel = 'mobile_money' | 'wave';
export type MobileMoneyOperator = 'orange_money' | 'moov_money' | 'mtn_money';
/** Anciens identifiants. Les nouveaux moyens sont `orange_bf`, `moov_bf`, etc. */
export type MobileMoneyProvider = MobileMoneyOperator | 'wave' | 'mobile_money' | (string & {});

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
  kind: 'order' | 'parcel' | 'subscription';
  orderIds?: string[];
  parcelId?: string;
  subscriptionId?: string;
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

/** Sandbox FedaPay (clés sk_sandbox) — affichage des consignes de test côté UI. */
export function isFedaPaySandbox(): boolean {
  const env = (import.meta.env.VITE_FEDAPAY_ENV as string | undefined)?.toLowerCase();
  if (env === 'live') return false;
  if (env === 'sandbox') return true;
  // Défaut : localhost / mode live sans VITE_FEDAPAY_ENV = sandbox
  if (typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname)) {
    return true;
  }
  return env !== 'live';
}

function paymentMode(): 'simulate' | 'live' {
  const mode = (import.meta.env.VITE_PAYMENT_MODE as string | undefined)?.toLowerCase();
  return mode === 'live' ? 'live' : 'simulate';
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
  // Sur FedaPay le client choisit le moyen ; le téléphone sert surtout de contact client.
  if (paymentMode() !== 'live' && (!phone || phone.replace(/\D/g, '').length < 8)) {
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

  void phone;
  throw new Error(OPERATOR_COLLECTION_NOT_READY);
}

export async function checkCheckout(transactionId: string): Promise<{
  status: string;
  providerStatus?: string;
  /** @deprecated alias providerStatus */
  cinetpayStatus?: string;
  kind?: string;
  orderIds?: string[];
  parcelId?: string | null;
}> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) throw new Error('Configuration Supabase manquante.');

  const res = await fetch(`${base}/functions/v1/fedapay-checkout`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'check', transactionId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Vérification du paiement impossible.');
  return {
    ...body,
    cinetpayStatus: body.providerStatus,
  };
}

function makeTxId(provider: string): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MM-${provider.slice(0, 3).toUpperCase()}-${Date.now()}-${rand}`;
}

/** Simulation locale uniquement. Le parcours live passe par startCheckout → FedaPay. */
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
  return paymentMethodLabel(id);
}

/** Message affiché quand le site est en mode live sans contrat opérateur branché. */
export const OPERATOR_COLLECTION_NOT_READY =
  'Le prélèvement réel n’est pas encore branché. AfriZone enregistre le moyen choisi, mais aucun argent n’est débité tant qu’un contrat marchand n’est pas actif chez cet opérateur (Orange, Moov, Telecel, Malitel ou MTN).';

export function channelFromProvider(provider: MobileMoneyProvider): PaymentChannel {
  return provider === 'wave' ? 'wave' : 'mobile_money';
}
