import { supabase } from '../lib/supabase';
import { countryCodeFromLabelOrCity } from '../types/catalog';
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

function orderMatchesCountry(
  row: {
    shipping_country?: string | null;
    shipping_city?: string | null;
    vendors?: { country?: string } | { country?: string }[] | null;
  },
  country: string
): boolean {
  const sc = String(row.shipping_country || '').toUpperCase();
  if (sc === country) return true;
  const vendors = row.vendors;
  const v = Array.isArray(vendors) ? vendors[0] : vendors;
  if (String(v?.country || '').toUpperCase() === country) return true;
  return countryCodeFromLabelOrCity(row.shipping_city) === country;
}

export async function fetchAdminDashboardData(
  country?: string | 'ALL'
): Promise<AdminDashboardData> {
  const all = !country || country === 'ALL';

  let vendorsQuery = supabase
    .from('vendors')
    .select('id, user_id, status, country, shop_name, city, created_at');
  if (!all) vendorsQuery = vendorsQuery.eq('country', country);

  let driversQuery = supabase
    .from('drivers')
    .select('id, user_id, status, country, driver_code, city, created_at');
  if (!all) driversQuery = driversQuery.eq('country', country);

  let productsQuery = supabase
    .from('products')
    .select('id, is_active, vendor_id, vendors!inner(country)')
    .eq('is_active', true);
  if (!all) productsQuery = productsQuery.eq('vendors.country', country);

  const [
    profilesRes,
    vendorsRes,
    driversRes,
    ordersRes,
    parcelsRes,
    recentOrdersRes,
    productsRes,
    reviewsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id, role, city'),
    vendorsQuery,
    driversQuery,
    supabase
      .from('orders')
      .select(
        'id, status, total, payment_status, shipping_country, shipping_city, vendors(country)'
      ),
    supabase
      .from('parcel_shipments')
      .select('id, status, pickup_city, delivery_city'),
    supabase
      .from('orders')
      .select(
        'id, order_number, status, total, created_at, shipping_city, shipping_country, payment_status, vendors(shop_name, country)'
      )
      .order('created_at', { ascending: false })
      .limit(all ? 8 : 40),
    productsQuery,
    supabase.from('reviews').select('id, product_id'),
  ]);

  const vendorRows = vendorsRes.error ? [] : vendorsRes.data ?? [];
  const driverRows = driversRes.error ? [] : driversRes.data ?? [];
  const productRows = productsRes.error ? [] : productsRes.data ?? [];

  const vendorUserIds = new Set(vendorRows.map((v) => v.user_id as string));
  const driverUserIds = new Set(driverRows.map((d) => d.user_id as string));

  const filteredProfiles = (profilesRes.error ? [] : profilesRes.data ?? []).filter((p) => {
    if (all) return true;
    const role = p.role as string;
    if (role === 'admin') return true;
    if (role === 'vendeur') return vendorUserIds.has(p.id as string);
    if (role === 'livreur') return driverUserIds.has(p.id as string);
    return countryCodeFromLabelOrCity(p.city as string | null) === country;
  });

  const orderRows = (ordersRes.error ? [] : ordersRes.data ?? []).filter((o) =>
    all ? true : orderMatchesCountry(o as Parameters<typeof orderMatchesCountry>[0], country!)
  );

  const parcelRows = (parcelsRes.error ? [] : parcelsRes.data ?? []).filter((p) => {
    if (all) return true;
    const from = countryCodeFromLabelOrCity(p.pickup_city as string);
    const to = countryCodeFromLabelOrCity(p.delivery_city as string);
    return from === country || to === country;
  });

  const countryProductIds = new Set(productRows.map((p) => p.id as string));
  const reviewsTotal = all
    ? reviewsRes.error
      ? 0
      : (reviewsRes.data ?? []).length
    : (reviewsRes.data ?? []).filter((r) =>
        countryProductIds.has(r.product_id as string)
      ).length;

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
    usersTotal: filteredProfiles.length,
    clientsTotal: filteredProfiles.filter((p) => p.role === 'client').length,
    vendorsPending: vendorRows.filter((v) => v.status === 'pending').length,
    vendorsApproved: vendorRows.filter((v) => v.status === 'approved').length,
    driversPending: driverRows.filter((d) => d.status === 'pending').length,
    driversApproved: driverRows.filter((d) => d.status === 'approved').length,
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
    productsActive: productRows.length,
    reviewsTotal,
  };

  const recentOrders: AdminRecentOrder[] = (recentOrdersRes.data ?? [])
    .filter((row) =>
      all
        ? true
        : orderMatchesCountry(row as Parameters<typeof orderMatchesCountry>[0], country!)
    )
    .slice(0, 8)
    .map((row) => {
      const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
      return {
        id: row.id as string,
        orderNumber: row.order_number as string,
        status: row.status as OrderStatus,
        total: Number(row.total),
        createdAt: row.created_at as string,
        vendorName: vendor
          ? ((vendor as { shop_name?: string }).shop_name ?? null)
          : null,
        shippingCity: (row.shipping_city as string) || '',
        paymentStatus: (row.payment_status as string) || 'pending',
      };
    });

  const pendingVendors: AdminPendingVendor[] = vendorRows
    .filter((v) => v.status === 'pending')
    .sort(
      (a, b) =>
        new Date(b.created_at as string).getTime() -
        new Date(a.created_at as string).getTime()
    )
    .slice(0, 5)
    .map((v) => ({
      id: v.id as string,
      shopName: v.shop_name as string,
      city: v.city as string,
      createdAt: v.created_at as string,
    }));

  const pendingDrivers: AdminPendingDriver[] = driverRows
    .filter((d) => d.status === 'pending')
    .sort(
      (a, b) =>
        new Date(b.created_at as string).getTime() -
        new Date(a.created_at as string).getTime()
    )
    .slice(0, 5)
    .map((d) => ({
      id: d.id as string,
      driverCode: d.driver_code as string,
      city: d.city as string,
      createdAt: d.created_at as string,
    }));

  return { stats, recentOrders, pendingVendors, pendingDrivers };
}

/** @deprecated use fetchAdminDashboardData */
export async function fetchAdminDashboardStats(
  country?: string | 'ALL'
): Promise<AdminDashboardStats> {
  const data = await fetchAdminDashboardData(country);
  return data.stats;
}

export async function fetchAdminOrders(
  status?: OrderStatus | 'all',
  country?: string | 'ALL'
): Promise<OrderView[]> {
  let query = supabase
    .from('orders')
    .select(
      `
      *,
      vendors ( shop_name, country ),
      order_items (
        id, product_id, quantity, price, total,
        products ( name, main_image, images, slug )
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((row) => {
    if (!country || country === 'ALL') return true;
    return orderMatchesCountry(
      row as Parameters<typeof orderMatchesCountry>[0],
      country
    );
  });

  return rows.slice(0, 100).map((row) => mapOrder(row as Record<string, unknown>));
}

export async function adminUpdateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) throw new Error(error.message);
}

export { ORDER_STATUS_LABELS };
