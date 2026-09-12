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

export interface WalletLedgerEntry {
  id: string;
  driverId: string;
  entryType: 'credit' | 'debit' | 'hold' | 'payout' | 'reversal';
  amount: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
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
  reviewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  driverCode?: string | null;
  driverCity?: string | null;
  ownerName?: string | null;
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

function mapLedger(row: Record<string, unknown>): WalletLedgerEntry {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    entryType: row.entry_type as WalletLedgerEntry['entryType'],
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    referenceType: (row.reference_type as string) ?? null,
    referenceId: (row.reference_id as string) ?? null,
    note: (row.note as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapWithdrawal(row: Record<string, unknown>): WithdrawalRequest {
  const driver = Array.isArray(row.drivers) ? row.drivers[0] : row.drivers;
  const d = driver as Record<string, unknown> | null | undefined;
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
    reviewedAt: (row.reviewed_at as string) ?? null,
    paidAt: (row.paid_at as string) ?? null,
    createdAt: row.created_at as string,
    driverCode: d ? ((d.driver_code as string) ?? null) : null,
    driverCity: d ? ((d.city as string) ?? null) : null,
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

export async function fetchDriverLedger(driverId: string): Promise<WalletLedgerEntry[]> {
  const { data, error } = await supabase
    .from('driver_wallet_ledger')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapLedger(r as Record<string, unknown>));
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

export async function fetchWithdrawalsForAdmin(
  status?: WithdrawalStatus | 'all'
): Promise<WithdrawalRequest[]> {
  let query = supabase
    .from('driver_withdrawal_requests')
    .select('*, drivers ( driver_code, city, user_id )')
    .order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const userIds = rows
    .map((r) => {
      const d = Array.isArray(r.drivers) ? r.drivers[0] : r.drivers;
      return (d as Record<string, unknown> | null)?.user_id as string | undefined;
    })
    .filter(Boolean) as string[];

  let profiles: Record<string, string> = {};
  if (userIds.length) {
    const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    profiles = Object.fromEntries((p ?? []).map((x) => [x.id, x.full_name as string]));
  }

  return rows.map((r) => {
    const base = mapWithdrawal(r);
    const d = Array.isArray(r.drivers) ? r.drivers[0] : r.drivers;
    const uid = (d as Record<string, unknown> | null)?.user_id as string | undefined;
    return { ...base, ownerName: uid ? profiles[uid] ?? null : null };
  });
}

export async function adminReviewWithdrawal(input: {
  withdrawalId: string;
  action: 'approve' | 'paid' | 'reject';
  paymentReference?: string;
  adminNote?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_review_withdrawal', {
    p_withdrawal_id: input.withdrawalId,
    p_action: input.action,
    p_payment_reference: input.paymentReference ?? null,
    p_admin_note: input.adminNote ?? null,
  });
  if (error) throw new Error(error.message);
}
