import { supabase } from '../lib/supabase';
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type OrderView,
  mapOrder,
} from './orders';

export interface AdminDashboardStats {
  usersTotal: number;
  clientsTotal: number;
  vendorsPending: number;
  vendorsApproved: number;
  driversPending: number;
  driversApproved: number;
  ordersTotal: number;
  ordersDelivered: number;
  ordersOpen: number;
  ordersByStatus: Record<string, number>;
  revenuePaid: number;
  parcelsTotal: number;
  parcelsActive: number;
  productsActive: number;
  reviewsTotal: number;
}

export interface AdminRecentOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  vendorName: string | null;
  shippingCity: string;
  paymentStatus: string;
}

export interface AdminPendingVendor {
  id: string;
  shopName: string;
  city: string;
  createdAt: string;
}

export interface AdminPendingDriver {
  id: string;
  driverCode: string;
  city: string;
  createdAt: string;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  recentOrders: AdminRecentOrder[];
  pendingVendors: AdminPendingVendor[];
  pendingDrivers: AdminPendingDriver[];
}

async function safeCount(
  table: string,
  filters?: { column: string; value: string }
): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (filters) query = query.eq(filters.column, filters.value);
  const { count, error } = await query;
  if (error) {
    console.warn(`admin count ${table}`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    usersTotal,
    clientsTotal,
    vendorsPending,
    vendorsApproved,
    driversPending,
    driversApproved,
    reviewsTotal,
    ordersRes,
    parcelsRes,
    recentOrdersRes,
    pendingVendorsRes,
    pendingDriversRes,
    productsRes,
  ] = await Promise.all([
    safeCount('profiles'),
    safeCount('profiles', { column: 'role', value: 'client' }),
    safeCount('vendors', { column: 'status', value: 'pending' }),
    safeCount('vendors', { column: 'status', value: 'approved' }),
    safeCount('drivers', { column: 'status', value: 'pending' }),
    safeCount('drivers', { column: 'status', value: 'approved' }),
    safeCount('reviews'),
    supabase.from('orders').select('id, status, total, payment_status'),
    supabase.from('parcel_shipments').select('id, status'),
    supabase
      .from('orders')
      .select(
        'id, order_number, status, total, created_at, shipping_city, payment_status, vendors(shop_name)'
      )
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('vendors')
      .select('id, shop_name, city, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('drivers')
      .select('id, driver_code, city, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
  ]);

  const productsActive = productsRes.error ? 0 : productsRes.count ?? 0;

  const orderRows = ordersRes.error ? [] : ordersRes.data ?? [];
  const parcelRows = parcelsRes.error ? [] : parcelsRes.data ?? [];

  const openStatuses = new Set(['pending', 'confirmed', 'processing', 'shipped']);
  const activeParcel = new Set([
    'received',
    'pickup_scheduled',
    'collected',
    'in_transit',
    'out_for_delivery',
  ]);

  const ordersByStatus: Record<string, number> = {};
  for (const o of orderRows) {
    const s = String(o.status);
    ordersByStatus[s] = (ordersByStatus[s] || 0) + 1;
  }

  const stats: AdminDashboardStats = {
    usersTotal,
    clientsTotal,
    vendorsPending,
    vendorsApproved,
    driversPending,
    driversApproved,
    ordersTotal: orderRows.length,
    ordersDelivered: orderRows.filter((o) => o.status === 'delivered').length,
    ordersOpen: orderRows.filter((o) => openStatuses.has(o.status as string)).length,
    ordersByStatus,
    revenuePaid: orderRows
      .filter(
        (o) =>
          o.payment_status === 'paid' &&
          o.status !== 'cancelled' &&
          o.status !== 'refunded'
      )
      .reduce((s, o) => s + Number(o.total ?? 0), 0),
    parcelsTotal: parcelRows.length,
    parcelsActive: parcelRows.filter((p) => activeParcel.has(p.status as string)).length,
    productsActive,
    reviewsTotal,
  };

  const recentOrders: AdminRecentOrder[] = (recentOrdersRes.data ?? []).map((row) => {
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    return {
      id: row.id as string,
      orderNumber: row.order_number as string,
      status: row.status as OrderStatus,
      total: Number(row.total),
      createdAt: row.created_at as string,
      vendorName: vendor ? ((vendor as { shop_name?: string }).shop_name ?? null) : null,
      shippingCity: (row.shipping_city as string) || '',
      paymentStatus: (row.payment_status as string) || 'pending',
    };
  });

  const pendingVendors: AdminPendingVendor[] = (pendingVendorsRes.data ?? []).map((v) => ({
    id: v.id as string,
    shopName: v.shop_name as string,
    city: v.city as string,
    createdAt: v.created_at as string,
  }));

  const pendingDrivers: AdminPendingDriver[] = (pendingDriversRes.data ?? []).map((d) => ({
    id: d.id as string,
    driverCode: d.driver_code as string,
    city: d.city as string,
    createdAt: d.created_at as string,
  }));

  return { stats, recentOrders, pendingVendors, pendingDrivers };
}

/** @deprecated use fetchAdminDashboardData */
export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const data = await fetchAdminDashboardData();
  return data.stats;
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
