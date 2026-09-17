import { supabase } from '../lib/supabase';

export interface DeliveryBatchView {
  id: string;
  driverId: string | null;
  offeredFee: number;
  status: string;
  notes: string | null;
  acceptDeadlineAt: string;
  startDeadlineAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  deliveryCount?: number;
  orderNumbers?: string[];
}

function mapBatch(row: Record<string, unknown>): DeliveryBatchView {
  return {
    id: row.id as string,
    driverId: (row.driver_id as string) ?? null,
    offeredFee: Number(row.offered_fee ?? 0),
    status: row.status as string,
    notes: (row.notes as string) ?? null,
    acceptDeadlineAt: row.accept_deadline_at as string,
    startDeadlineAt: (row.start_deadline_at as string) ?? null,
    acceptedAt: (row.accepted_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Admin : crée un lot groupé avec prix fixe (livreurs peuvent accepter/refuser). */
export async function createDeliveryBatch(
  driverId: string,
  orderIds: string[],
  offeredFee: number,
  notes?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_delivery_batch', {
    p_driver_id: driverId,
    p_order_ids: orderIds,
    p_offered_fee: Math.round(offeredFee),
    p_notes: notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function reclaimOverdueDeliveries(opts?: {
  batchId?: string;
  deliveryId?: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc('admin_reclaim_overdue_deliveries', {
    p_batch_id: opts?.batchId ?? null,
    p_delivery_id: opts?.deliveryId ?? null,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function fetchDriverBatches(driverId: string): Promise<DeliveryBatchView[]> {
  const { data, error } = await supabase
    .from('delivery_batches')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapBatch(r as Record<string, unknown>));
}

export async function fetchAdminBatches(): Promise<DeliveryBatchView[]> {
  const { data, error } = await supabase
    .from('delivery_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const batches = (data ?? []).map((r) => mapBatch(r as Record<string, unknown>));
  if (!batches.length) return batches;

  const ids = batches.map((b) => b.id);
  const { data: dels } = await supabase
    .from('deliveries')
    .select('batch_id, status, orders(order_number)')
    .in('batch_id', ids);

  const byBatch = new Map<string, { count: number; numbers: string[] }>();
  for (const d of dels ?? []) {
    const bid = d.batch_id as string;
    if (!bid) continue;
    const cur = byBatch.get(bid) || { count: 0, numbers: [] };
    cur.count += 1;
    const orders = Array.isArray(d.orders) ? d.orders[0] : d.orders;
    const num = (orders as { order_number?: string } | null)?.order_number;
    if (num) cur.numbers.push(num);
    byBatch.set(bid, cur);
  }

  return batches.map((b) => ({
    ...b,
    deliveryCount: byBatch.get(b.id)?.count ?? 0,
    orderNumbers: byBatch.get(b.id)?.numbers ?? [],
  }));
}

export async function driverRespondBatch(batchId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('driver_respond_batch', {
    p_batch_id: batchId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
}

export function isOverdueDelivery(row: {
  status: string;
  assignedAt?: string;
  acceptedAt?: string | null;
  acceptDeadlineAt?: string | null;
  startDeadlineAt?: string | null;
}): boolean {
  const now = Date.now();
  if (row.status === 'assigned') {
    const deadline = row.acceptDeadlineAt
      ? new Date(row.acceptDeadlineAt).getTime()
      : row.assignedAt
        ? new Date(row.assignedAt).getTime() + 2 * 60 * 60 * 1000
        : 0;
    return deadline > 0 && now > deadline;
  }
  if (row.status === 'accepted') {
    const deadline = row.startDeadlineAt
      ? new Date(row.startDeadlineAt).getTime()
      : row.acceptedAt
        ? new Date(row.acceptedAt).getTime() + 2 * 60 * 60 * 1000
        : 0;
    return deadline > 0 && now > deadline;
  }
  return false;
}

export const COMMISSION_RATE = 0.1;

export function commissionFromPrice(price: number): {
  clientPays: number;
  platformFee: number;
  vendorNet: number;
} {
  const clientPays = Math.max(0, Math.round(Number(price) || 0));
  const platformFee = Math.round(clientPays * COMMISSION_RATE);
  const vendorNet = clientPays - platformFee;
  return { clientPays, platformFee, vendorNet };
}
