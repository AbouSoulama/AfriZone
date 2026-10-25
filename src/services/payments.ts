/**
 * Paiements AfriZone — opérateurs télécoms par pays (Orange, Moov, Telecel, Malitel, MTN).
 *
 * Mode test (défaut tant que les contrats marchands ne sont pas branchés) :
 *   simule un paiement réussi, enregistre le moyen + une référence, sans débit réel.
 * Mode live : uniquement quand VITE_PAYMENT_MODE=live ET VITE_OPERATORS_LIVE=1
 *   (après branchement des APIs opérateurs).
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
  provider: string;
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

/**
 * Les APIs opérateurs ne sont pas encore branchées.
 * Tant que VITE_OPERATORS_LIVE n’est pas à « 1 », on reste en mode test
 * même si VITE_PAYMENT_MODE=live (évite de bloquer les essais).
 */
export function areOperatorPaymentsReady(): boolean {
  const flag = (import.meta.env.VITE_OPERATORS_LIVE as string | undefined)?.toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function paymentMode(): 'simulate' | 'live' {
  const mode = (import.meta.env.VITE_PAYMENT_MODE as string | undefined)?.toLowerCase();
  if (mode === 'live' && areOperatorPaymentsReady()) return 'live';
  return 'simulate';
}

/** true uniquement quand le débit réel est effectivement actif. */
export function isLivePayment(): boolean {
  return paymentMode() === 'live';
}

/** true tant que les contrats marchands ne sont pas branchés. */
export function isPaymentTestMode(): boolean {
  return !isLivePayment();
}

/** @deprecated FedaPay retiré — toujours false. */
export function isFedaPaySandbox(): boolean {
  return false;
}

export async function startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  const phone = input.phone.trim();
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    throw new Error('Numéro de paiement invalide (au moins 8 chiffres).');
  }
  if (!input.amount || input.amount <= 0) {
    throw new Error('Montant de paiement invalide.');
  }
  if (!input.provider) {
    throw new Error('Choisissez un moyen de paiement.');
  }

  if (paymentMode() !== 'live') {
    // Mode test : petite latence pour simuler la confirmation opérateur.
    const tx = makeTxId(input.provider);
    await new Promise((r) => setTimeout(r, 700));
    return { mode: 'simulate', transactionId: tx, amount: input.amount };
  }

  // Live réel : à brancher opérateur par opérateur.
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
  // En mode test, les paiements sont confirmés immédiatement côté client.
  if (isPaymentTestMode() && transactionId.startsWith('MM-')) {
    return { status: 'paid', providerStatus: 'approved' };
  }

  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) throw new Error('Configuration Supabase manquante.');

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!token || !anon) throw new Error('Connectez-vous pour payer.');

  const res = await fetch(`${base}/functions/v1/mobile-money`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
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
  const slug = provider.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'MM';
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MM-${slug}-${Date.now()}-${rand}`;
}

/** Simulation locale (équivalent de startCheckout en mode test). */
export async function chargeMobileMoney(
  input: ChargeMobileMoneyInput
): Promise<ChargeMobileMoneyResult> {
  const result = await startCheckout({
    amount: input.amount,
    phone: input.phone,
    provider: input.provider,
    kind: 'order',
  });
  return {
    success: true,
    transactionId: result.transactionId,
    provider: input.provider,
    mode: result.mode,
    message:
      result.mode === 'simulate'
        ? `Paiement test confirmé (${result.transactionId}). Aucun débit réel.`
        : `Paiement initié (${result.transactionId}).`,
  };
}

export function providerLabel(id: string): string {
  return paymentMethodLabel(id);
}

export const OPERATOR_COLLECTION_NOT_READY =
  'Le prélèvement réel n’est pas encore branché. Passez en mode test (VITE_PAYMENT_MODE=simulate) ou activez VITE_OPERATORS_LIVE=1 après les contrats marchands.';

export const TEST_PAYMENT_HINT =
  'Mode test actif : aucun argent n’est débité. Choisissez un opérateur, un numéro, puis validez pour simuler un paiement réussi.';

export function channelFromProvider(provider: MobileMoneyProvider): PaymentChannel {
  return provider === 'wave' ? 'wave' : 'mobile_money';
}
