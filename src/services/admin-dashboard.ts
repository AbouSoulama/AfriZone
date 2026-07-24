import { supabase } from '../lib/supabase';
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type OrderView,
  mapOrder,
} from './orders';

export interface AdminDashboardStats {
  usersTotal: number;
  vendorsPending: number;
  vendorsApproved: number;
  driversPending: number;
  driversApproved: number;
  ordersTotal: number;
  ordersDelivered: number;
  ordersOpen: number;
  revenuePaid: number;
  parcelsTotal: number;
  parcelsActive: number;
  productsActive: number;
  reviewsTotal: number;
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [
    users,
    vendorsPending,
    vendorsApproved,
    driversPending,
    driversApproved,
    orders,
    parcels,
    products,
    reviews,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('vendors')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('vendors')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved'),
    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved'),
    supabase.from('orders').select('id, status, total, payment_status'),
    supabase.from('parcel_shipments').select('id, status'),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase.from('reviews').select('id', { count: 'exact', head: true }),
  ]);

  const orderRows = orders.data ?? [];
  const parcelRows = parcels.data ?? [];

  const openStatuses = new Set(['pending', 'confirmed', 'processing', 'shipped']);
  const activeParcel = new Set([
    'received',
    'pickup_scheduled',
    'collected',
    'in_transit',
    'out_for_delivery',
  ]);

  return {
    usersTotal: users.count ?? 0,
    vendorsPending: vendorsPending.count ?? 0,
    vendorsApproved: vendorsApproved.count ?? 0,
    driversPending: driversPending.count ?? 0,
    driversApproved: driversApproved.count ?? 0,
    ordersTotal: orderRows.length,
    ordersDelivered: orderRows.filter((o) => o.status === 'delivered').length,
    ordersOpen: orderRows.filter((o) => openStatuses.has(o.status as string)).length,
    revenuePaid: orderRows
      .filter((o) => o.payment_status === 'paid' && o.status !== 'cancelled' && o.status !== 'refunded')
      .reduce((s, o) => s + Number(o.total ?? 0), 0),
    parcelsTotal: parcelRows.length,
    parcelsActive: parcelRows.filter((p) => activeParcel.has(p.status as string)).length,
    productsActive: products.count ?? 0,
    reviewsTotal: reviews.count ?? 0,
  };
}

export async function fetchAdminOrders(status?: OrderStatus | 'all'): Promise<OrderView[]> {
  let query = supabase
    .from('orders')
    .select(
      `
      *,
      vendors ( shop_name ),
      order_items (
        id, product_id, quantity, price, total,
        products ( name, main_image, images, slug )
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapOrder(row as Record<string, unknown>));
}

export async function adminUpdateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) throw new Error(error.message);
}

export { ORDER_STATUS_LABELS };
