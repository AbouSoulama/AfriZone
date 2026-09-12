import { supabase } from '../lib/supabase';

export type PayoutProvider = 'orange_money' | 'moov_money' | 'mtn_money' | 'wave';
export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected' | 'failed';

export interface DriverPayoutAccount {
  id: string;
  driverId: string;
  provider: PayoutProvider;
  phone: string;
  accountName: string | null;
  verified: boolean;
}

export interface DriverEarning {
  id: string;
  driverId: string;
  deliveryId: string;
  grossAmount: number;
  bonusAmount: number;
  penaltyAmount: number;
  netAmount: number;
  note: string | null;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  driverId: string;
  amount: number;
  status: WithdrawalStatus;
  provider: string | null;
  phone: string | null;
  weekKey: string;
  adminNote: string | null;
  paymentReference: string | null;
  createdAt: string;
}

export const PAYOUT_PROVIDER_LABELS: Record<PayoutProvider, string> = {
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  mtn_money: 'MTN Money',
  wave: 'Wave',
};

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  paid: 'Payée',
  rejected: 'Refusée',
  failed: 'Échouée',
};

function mapAccount(row: Record<string, unknown>): DriverPayoutAccount {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    provider: row.provider as PayoutProvider,
    phone: row.phone as string,
    accountName: (row.account_name as string) ?? null,
    verified: Boolean(row.verified),
  };
}

function mapEarning(row: Record<string, unknown>): DriverEarning {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    deliveryId: row.delivery_id as string,
    grossAmount: Number(row.gross_amount),
    bonusAmount: Number(row.bonus_amount ?? 0),
    penaltyAmount: Number(row.penalty_amount ?? 0),
    netAmount: Number(row.net_amount),
    note: (row.note as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapWithdrawal(row: Record<string, unknown>): WithdrawalRequest {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    amount: Number(row.amount),
    status: row.status as WithdrawalStatus,
    provider: (row.provider as string) ?? null,
    phone: (row.phone as string) ?? null,
    weekKey: row.week_key as string,
    adminNote: (row.admin_note as string) ?? null,
    paymentReference: (row.payment_reference as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchDriverWalletBalance(driverId: string): Promise<number> {
  const { data, error } = await supabase.rpc('driver_wallet_balance', {
    p_driver_id: driverId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function isWithdrawWindowOpen(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_driver_withdraw_window');
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function fetchDriverPayoutAccount(
  driverId: string
): Promise<DriverPayoutAccount | null> {
  const { data, error } = await supabase
    .from('driver_payout_accounts')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAccount(data as Record<string, unknown>) : null;
}

export async function upsertDriverPayoutAccount(input: {
  provider: PayoutProvider;
  phone: string;
  accountName?: string;
}): Promise<DriverPayoutAccount> {
  const { data, error } = await supabase.rpc('upsert_driver_payout_account', {
    p_provider: input.provider,
    p_phone: input.phone,
    p_account_name: input.accountName ?? null,
  });
  if (error) throw new Error(error.message);
  return mapAccount(data as Record<string, unknown>);
}

export async function fetchDriverEarnings(driverId: string): Promise<DriverEarning[]> {
  const { data, error } = await supabase
    .from('driver_earnings')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapEarning(r as Record<string, unknown>));
}

export async function fetchDriverWithdrawals(driverId: string): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('driver_withdrawal_requests')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapWithdrawal(r as Record<string, unknown>));
}

export async function requestDriverWithdrawal(amount: number): Promise<{ withdrawalId: string }> {
  const { data, error } = await supabase.rpc('request_driver_withdrawal', {
    p_amount: Math.round(amount),
  });
  if (error) throw new Error(error.message);
  const body = data as { withdrawal_id?: string };
  return { withdrawalId: body.withdrawal_id || '' };
}

export async function fetchWithdrawnTotal(driverId: string): Promise<number> {
  const { data, error } = await supabase
    .from('driver_withdrawal_requests')
    .select('amount, status')
    .eq('driver_id', driverId)
    .in('status', ['paid', 'approved', 'pending']);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, r) => {
    if (r.status === 'paid') return sum + Number(r.amount);
    return sum;
  }, 0);
}
